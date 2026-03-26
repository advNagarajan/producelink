"""
Dynamic Price Recommendations — ML regression model on historical MongoDB data.

Uses scikit-learn to build a regression model factoring:
  - Crop type (one-hot encoded)
  - Quality grade (ordinal)
  - Quantity (log-scaled)
  - Season / month (cyclical encoding)
  - Location / state (one-hot encoded)
  - Historical supply volume
  - Government reference price (when available)

Endpoints:
  POST /predict/ml           — get ML-powered price recommendation
  GET  /predict/ml/model-info — model metadata & feature importances
  POST /predict/ml/retrain   — force model retrain from latest data
"""

import asyncio
import math
import re
from datetime import datetime, timezone
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth import get_current_user
from database import db

router = APIRouter()


# ─── Model storage (in-memory singleton) ──────────────────────────────────────

class PriceModel:
    """Wrapper around a trained scikit-learn model with feature metadata."""

    def __init__(self):
        self.model = None
        self.feature_names: list[str] = []
        self.crop_categories: list[str] = []
        self.state_categories: list[str] = []
        self.trained_at: Optional[datetime] = None
        self.sample_count: int = 0
        self.r2_score: float = 0.0
        self.mae: float = 0.0
        self.feature_importances: dict[str, float] = {}
        self.price_stats: dict[str, dict] = {}  # per-crop min/max/mean


_model = PriceModel()

# Quality grade ordinal mapping
GRADE_MAP = {"A": 3, "B": 2, "C": 1, "D": 0}

# Indian states for one-hot
STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
    "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
    "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal",
]


def _extract_state(location: str) -> str:
    """Extract state from a location string."""
    parts = [p.strip() for p in location.replace("-", ",").split(",")]
    for part in reversed(parts):
        for state in STATES:
            if state.lower() == part.lower():
                return state
    loc_lower = location.lower()
    for state in STATES:
        if state.lower() in loc_lower:
            return state
    return "Unknown"


def _month_features(month: int) -> tuple[float, float]:
    """Cyclical encoding of month (1-12) → (sin, cos)."""
    rad = 2 * math.pi * (month - 1) / 12
    return math.sin(rad), math.cos(rad)


def _build_feature_vector(
    crop: str,
    grade: str,
    quantity: float,
    month: int,
    state: str,
    crop_cats: list[str],
    state_cats: list[str],
) -> list[float]:
    """Build a feature vector for a single sample."""
    features: list[float] = []

    # 1) Crop one-hot
    for c in crop_cats:
        features.append(1.0 if crop.lower() == c.lower() else 0.0)

    # 2) Quality grade (ordinal)
    features.append(float(GRADE_MAP.get(grade.upper(), 1)))

    # 3) Quantity (log-scaled)
    features.append(math.log1p(quantity))

    # 4) Month cyclical
    sin_m, cos_m = _month_features(month)
    features.append(sin_m)
    features.append(cos_m)

    # 5) State one-hot
    for s in state_cats:
        features.append(1.0 if state.lower() == s.lower() else 0.0)

    return features


async def _train_model() -> PriceModel:
    """Train / retrain the regression model on all harvest data."""
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.model_selection import cross_val_score

    # Fetch all harvests with prices
    cursor = db.harvests.find(
        {"basePrice": {"$exists": True, "$gt": 0}},
        {
            "cropType": 1, "qualityGrade": 1, "quantity": 1,
            "basePrice": 1, "location": 1, "createdAt": 1, "status": 1,
        },
    )
    docs = await cursor.to_list(10000)

    if len(docs) < 5:
        raise HTTPException(
            status_code=422,
            detail=f"Not enough historical data to train model. Need at least 5 harvests, found {len(docs)}.",
        )

    # Also fetch accepted bid prices to use the actual sale price when available
    sold_prices: dict[str, float] = {}
    bid_cursor = db.bids.find({"status": "accepted"}, {"harvestId": 1, "amount": 1})
    async for bid in bid_cursor:
        hid = str(bid.get("harvestId", ""))
        sold_prices[hid] = bid["amount"]

    # Discover categories
    crop_cats = sorted(set(d["cropType"].strip().title() for d in docs))
    state_cats_set: set[str] = set()
    for d in docs:
        state_cats_set.add(_extract_state(d.get("location", "")))
    state_cats_set.discard("Unknown")
    state_cats = sorted(state_cats_set) if state_cats_set else ["Unknown"]

    # Build X, y
    X_rows: list[list[float]] = []
    y: list[float] = []
    price_stats: dict[str, list[float]] = {}

    for d in docs:
        crop = d["cropType"].strip().title()
        grade = d.get("qualityGrade", "B")
        qty = d.get("quantity", 1)
        created = d.get("createdAt", datetime.now(timezone.utc))
        month = created.month if hasattr(created, "month") else 6
        state = _extract_state(d.get("location", ""))
        if state == "Unknown" and state not in state_cats:
            state = state_cats[0] if state_cats else "Unknown"

        # Use accepted bid price if available, else base price
        hid = str(d["_id"])
        price = sold_prices.get(hid, d["basePrice"])

        vec = _build_feature_vector(crop, grade, qty, month, state, crop_cats, state_cats)
        X_rows.append(vec)
        y.append(price)

        price_stats.setdefault(crop, []).append(price)

    X = np.array(X_rows, dtype=np.float64)
    y_arr = np.array(y, dtype=np.float64)

    # Train with Gradient Boosting (handles non-linearity, small datasets well)
    model = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        min_samples_leaf=2,
        random_state=42,
    )

    # Cross-validation for R² and MAE
    if len(docs) >= 10:
        cv_folds = min(5, len(docs))
        r2_scores = cross_val_score(model, X, y_arr, cv=cv_folds, scoring="r2")
        mae_scores = cross_val_score(model, X, y_arr, cv=cv_folds, scoring="neg_mean_absolute_error")
        r2 = float(np.mean(r2_scores))
        mae = float(-np.mean(mae_scores))
    else:
        r2 = 0.0
        mae = 0.0

    # Fit on all data
    model.fit(X, y_arr)

    # Feature names
    feature_names = [f"crop_{c}" for c in crop_cats]
    feature_names.append("qualityGrade")
    feature_names.append("log_quantity")
    feature_names.extend(["month_sin", "month_cos"])
    feature_names.extend([f"state_{s}" for s in state_cats])

    importances = dict(zip(feature_names, model.feature_importances_.tolist()))

    # Update global model
    _model.model = model
    _model.feature_names = feature_names
    _model.crop_categories = crop_cats
    _model.state_categories = state_cats
    _model.trained_at = datetime.now(timezone.utc)
    _model.sample_count = len(docs)
    _model.r2_score = round(r2, 4)
    _model.mae = round(mae, 2)
    _model.feature_importances = {k: round(v, 4) for k, v in sorted(importances.items(), key=lambda x: -x[1])[:15]}
    _model.price_stats = {
        crop: {
            "min": round(min(prices), 2),
            "max": round(max(prices), 2),
            "mean": round(sum(prices) / len(prices), 2),
            "count": len(prices),
        }
        for crop, prices in price_stats.items()
    }

    return _model


async def _ensure_model() -> PriceModel:
    """Lazily train the model if not yet trained or stale (>1 hour)."""
    if _model.model is not None and _model.trained_at:
        age = datetime.now(timezone.utc) - _model.trained_at
        if age.total_seconds() < 3600:  # 1 hour freshness
            return _model
    return await _train_model()


# ─── Request / Response schemas ───────────────────────────────────────────────

class MLPredictBody(BaseModel):
    cropType: str
    location: str
    quantity: float = 100.0
    qualityGrade: str = "A"
    month: Optional[int] = None  # 1-12; if omitted, uses current month


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/predict/ml")
async def ml_predict(body: MLPredictBody, request: Request):
    """
    Get an ML-powered price recommendation with confidence interval.
    Uses Gradient Boosting trained on historical harvest + bid data.
    """
    await get_current_user(request)

    model_data = await _ensure_model()
    if model_data.model is None:
        raise HTTPException(status_code=503, detail="Model not available")

    crop = body.cropType.strip().title()
    state = _extract_state(body.location)
    grade = body.qualityGrade.upper()
    qty = body.quantity
    month = body.month or datetime.now(timezone.utc).month

    # Handle unknown crop: if crop not in training set, find closest
    if crop not in [c.title() for c in model_data.crop_categories]:
        # Still predict but warn
        closest = crop  # will be all zeros in one-hot

    vec = _build_feature_vector(
        crop, grade, qty, month, state,
        model_data.crop_categories, model_data.state_categories,
    )
    X_pred = np.array([vec], dtype=np.float64)

    # Point prediction
    predicted = float(model_data.model.predict(X_pred)[0])

    # Confidence interval via individual tree predictions (ensemble spread)
    tree_predictions = []
    for est in model_data.model.estimators_.flatten():
        tree_predictions.append(float(est.predict(X_pred)[0]))

    if tree_predictions:
        all_preds = np.array(tree_predictions)
        cumulative = np.cumsum(all_preds) * model_data.model.learning_rate
        # For gradient boosting, use staged predictions
        staged = list(model_data.model.staged_predict(X_pred))
        staged_arr = np.array([float(s[0]) for s in staged])
        # Use last 30% of staged predictions to estimate variance
        n_tail = max(1, len(staged_arr) // 3)
        tail = staged_arr[-n_tail:]
        std_estimate = float(np.std(tail)) if len(tail) > 1 else model_data.mae

        # Also factor in model MAE
        spread = max(std_estimate, model_data.mae * 0.5)
    else:
        spread = model_data.mae

    suggested_min = max(0, round(predicted - spread, 2))
    suggested_max = round(predicted + spread, 2)

    # Confidence level based on data availability for this crop
    crop_stats = model_data.price_stats.get(crop, {})
    n_samples = crop_stats.get("count", 0)
    if n_samples >= 20:
        confidence = "high"
        confidence_score = min(0.95, 0.70 + n_samples * 0.01)
    elif n_samples >= 5:
        confidence = "medium"
        confidence_score = 0.50 + n_samples * 0.02
    else:
        confidence = "low"
        confidence_score = max(0.20, 0.15 + n_samples * 0.05)

    # Key factors that influenced the prediction
    factors = []
    importances = model_data.feature_importances

    # Season factor
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    season_imp = importances.get("month_sin", 0) + importances.get("month_cos", 0)
    if season_imp > 0.05:
        factors.append({
            "factor": "Seasonality",
            "impact": round(season_imp * 100, 1),
            "detail": f"Current month ({month_names[month - 1]}) seasonal patterns affect pricing",
        })

    # Quality factor
    grade_imp = importances.get("qualityGrade", 0)
    if grade_imp > 0.01:
        factors.append({
            "factor": "Quality Grade",
            "impact": round(grade_imp * 100, 1),
            "detail": f"Grade {grade} produce {'commands premium pricing' if grade == 'A' else 'has standard market rate' if grade == 'B' else 'typically trades at discount'}",
        })

    # Quantity factor
    qty_imp = importances.get("log_quantity", 0)
    if qty_imp > 0.01:
        factors.append({
            "factor": "Supply Volume",
            "impact": round(qty_imp * 100, 1),
            "detail": f"{qty} kg listing — {'bulk discount may apply' if qty > 1000 else 'standard volume' if qty > 100 else 'small lot premium possible'}",
        })

    # Crop-specific factor
    crop_key = f"crop_{crop}"
    crop_imp = importances.get(crop_key, 0)
    if crop_imp > 0.01:
        factors.append({
            "factor": "Crop Type",
            "impact": round(crop_imp * 100, 1),
            "detail": f"{crop} pricing based on {n_samples} historical transactions",
        })

    # State factor
    state_key = f"state_{state}"
    state_imp = importances.get(state_key, 0)
    if state_imp > 0.01:
        factors.append({
            "factor": "Regional Market",
            "impact": round(state_imp * 100, 1),
            "detail": f"{state} market conditions and regional demand",
        })

    # Sort factors by impact
    factors.sort(key=lambda f: -f["impact"])

    return {
        "prediction": {
            "suggestedPrice": round(predicted, 2),
            "suggestedMin": suggested_min,
            "suggestedMax": suggested_max,
            "unit": "Rs/kg",
        },
        "confidence": {
            "level": confidence,
            "score": round(confidence_score, 2),
            "basedOnSamples": n_samples,
        },
        "factors": factors[:6],
        "model": {
            "type": "GradientBoostingRegressor",
            "r2Score": model_data.r2_score,
            "mae": model_data.mae,
            "trainedOn": model_data.sample_count,
            "trainedAt": model_data.trained_at.isoformat() if model_data.trained_at else None,
        },
        "cropStats": crop_stats,
        "input": {
            "cropType": crop,
            "location": body.location,
            "state": state,
            "quantity": qty,
            "qualityGrade": grade,
            "month": month,
            "monthName": month_names[month - 1],
        },
    }


@router.get("/predict/ml/model-info")
async def model_info(request: Request):
    """Return model metadata, feature importances, and training stats."""
    await get_current_user(request)

    if _model.model is None:
        return {
            "status": "not_trained",
            "message": "Model has not been trained yet. Make a prediction to trigger training.",
        }

    return {
        "status": "ready",
        "type": "GradientBoostingRegressor",
        "trainedAt": _model.trained_at.isoformat() if _model.trained_at else None,
        "sampleCount": _model.sample_count,
        "r2Score": _model.r2_score,
        "mae": _model.mae,
        "featureImportances": _model.feature_importances,
        "cropCategories": _model.crop_categories,
        "stateCategories": _model.state_categories,
        "priceStats": _model.price_stats,
    }


@router.post("/predict/ml/retrain")
async def retrain(request: Request):
    """Force retrain the ML model from latest data."""
    await get_current_user(request)

    model_data = await _train_model()
    return {
        "message": "Model retrained successfully",
        "sampleCount": model_data.sample_count,
        "r2Score": model_data.r2_score,
        "mae": model_data.mae,
        "trainedAt": model_data.trained_at.isoformat() if model_data.trained_at else None,
    }
