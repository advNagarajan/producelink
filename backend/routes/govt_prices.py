"""
Government Mandi Price Feed — fetches live wholesale prices from
India's data.gov.in (Agmarknet) API and compares them against farmer prices.

Endpoints:
  GET /govt-prices              — search live govt wholesale prices
  GET /govt-prices/commodities  — cached list of available commodities
  GET /govt-prices/compare/{harvest_id} — compare a harvest against govt rates
  GET /govt-prices/states       — list of Indian states for filtering
  GET /govt-prices/trend        — multi-day price trend for a commodity+state
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Awaitable, Callable, cast

import httpx
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Request

from auth import get_current_user as imported_get_current_user
from config import DATA_GOV_API_KEY
from database import db
from utils import serialize_doc

get_current_user = cast(Callable[[Request], Awaitable[dict]], imported_get_current_user)

router = APIRouter()

# ─── Constants ────────────────────────────────────────────────────────────────
DATA_GOV_BASE = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
CACHE_TTL_MINUTES = 30

# Common commodity name mapping (Agmarknet uses specific names)
COMMODITY_ALIASES: dict[str, list[str]] = {
    "tomato": ["Tomato", "Tomato (Hybrid)", "Tomato (Local)", "Tomato (Deshi)"],
    "potato": ["Potato", "Potato (Red)", "Potato (White)"],
    "onion": ["Onion", "Onion (Green)", "Onion (Red)"],
    "rice": ["Rice", "Paddy(Dhan)(Common)", "Paddy(Dhan)(Basmati)"],
    "wheat": ["Wheat", "Wheat Atta (Whole Sale)"],
    "corn": ["Maize", "Maize (Hybrid/Local)"],
    "apple": ["Apple", "Apple (Shimla)", "Apple (Kinnaur)"],
    "mango": ["Mango", "Mango (Alphonso)", "Mango (Dusseheri)", "Mango (Langra)"],
    "banana": ["Banana", "Banana - Loss (Ripe)"],
    "cabbage": ["Cabbage"],
    "cauliflower": ["Cauliflower"],
    "brinjal": ["Brinjal"],
    "chilli": ["Green Chilli", "Chillies (Green)"],
    "garlic": ["Garlic"],
    "ginger": ["Ginger(Green)", "Ginger(Dry)"],
    "peas": ["Peas(Green)", "Peas Wet"],
    "carrot": ["Carrot"],
    "capsicum": ["Capsicum"],
    "bitter gourd": ["Bitter gourd"],
    "lady finger": ["Ladies Finger"],
    "cucumber": ["Cucumber(Kheera)"],
    "lemon": ["Lemon"],
    "grapes": ["Grapes"],
    "orange": ["Orange"],
    "pomegranate": ["Pomegranate"],
    "watermelon": ["Water Melon"],
    "papaya": ["Papaya"],
    "guava": ["Guava"],
    "coconut": ["Coconut"],
    "sugarcane": ["Sugarcane"],
    "cotton": ["Cotton"],
    "soybean": ["Soyabean"],
    "groundnut": ["Groundnut"],
    "mustard": ["Mustard", "Mustard Oil"],
    "turmeric": ["Turmeric", "Turmeric (Finger)"],
    "coriander": ["Coriander(Leaves)", "Coriander Seed"],
}

INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
    "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
    "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal",
]


def _resolve_commodity(crop_type: str) -> str:
    """Resolve user crop name to the primary Agmarknet commodity name."""
    key = crop_type.strip().lower()
    if key in COMMODITY_ALIASES:
        return COMMODITY_ALIASES[key][0]
    # If not in aliases, try title-case as-is
    return crop_type.strip().title()


def _extract_state(location: str) -> str:
    """Try to extract an Indian state from a location string like 'Pune, Maharashtra'."""
    parts = [p.strip() for p in location.replace("-", ",").split(",")]
    for part in reversed(parts):
        for state in INDIAN_STATES:
            if state.lower() == part.lower():
                return state
    # Fuzzy fallback: check if any state name is contained
    loc_lower = location.lower()
    for state in INDIAN_STATES:
        if state.lower() in loc_lower:
            return state
    return ""


async def _fetch_govt_prices(
    commodity: str,
    state: str = "",
    limit: int = 50,
) -> list[dict]:
    """Fetch prices from data.gov.in API with caching in MongoDB."""
    if not DATA_GOV_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Government price feed not configured. Set DATA_GOV_API_KEY in .env.local",
        )

    # Check cache first (keyed by commodity + state)
    cache_key = f"{commodity.lower()}|{state.lower()}"
    cached = await db.govt_price_cache.find_one({"_cacheKey": cache_key})
    if cached and cached.get("fetchedAt"):
        fetched = cached["fetchedAt"]
        if fetched.tzinfo is None:
            fetched = fetched.replace(tzinfo=timezone.utc)
        age = datetime.now(timezone.utc) - fetched
        if age < timedelta(minutes=CACHE_TTL_MINUTES):
            return cached.get("records", [])

    # Build API request
    params: dict = {
        "api-key": DATA_GOV_API_KEY,
        "format": "json",
        "limit": limit,
        "offset": 0,
    }
    # Use filters for commodity and state
    filters: list[str] = []
    if commodity:
        filters.append(f"commodity eq {commodity}")
    if state:
        filters.append(f"state eq {state}")
    if filters:
        params["filters[commodity]"] = commodity
        if state:
            params["filters[state]"] = state

    data = None
    try:
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.get(DATA_GOV_BASE, params=params)
                    resp.raise_for_status()
                    data = resp.json()
                    break
            except httpx.TimeoutException:
                # Retry once before falling back to cache/error.
                if attempt == 0:
                    continue
                # If upstream is slow, serve stale cache to avoid user-facing 504s.
                if cached and cached.get("records"):
                    return cached.get("records", [])
                raise HTTPException(status_code=504, detail="Government API timeout — try again")
    except httpx.HTTPStatusError as exc:
        if cached and cached.get("records"):
            return cached.get("records", [])
        raise HTTPException(
            status_code=502,
            detail=f"Government API returned {exc.response.status_code}",
        )
    except Exception:
        if cached and cached.get("records"):
            return cached.get("records", [])
        raise HTTPException(status_code=502, detail="Could not reach government price API")

    if data is None:
        if cached and cached.get("records"):
            return cached.get("records", [])
        raise HTTPException(status_code=504, detail="Government API timeout — try again")

    records_raw = data.get("records", [])

    # Normalize records
    records: list[dict] = []
    for r in records_raw:
        try:
            rec = {
                "state": r.get("state", ""),
                "district": r.get("district", ""),
                "market": r.get("market", ""),
                "commodity": r.get("commodity", ""),
                "variety": r.get("variety", ""),
                "arrivalDate": r.get("arrival_date", ""),
                "minPrice": float(r.get("min_price", 0)),
                "maxPrice": float(r.get("max_price", 0)),
                "modalPrice": float(r.get("modal_price", 0)),
            }
            records.append(rec)
        except (ValueError, TypeError):
            continue

    # Update cache
    await db.govt_price_cache.update_one(
        {"_cacheKey": cache_key},
        {
            "$set": {
                "_cacheKey": cache_key,
                "commodity": commodity,
                "state": state,
                "records": records,
                "fetchedAt": datetime.now(timezone.utc),
                "count": len(records),
            }
        },
        upsert=True,
    )

    return records


# ─── TTL index (auto-expire old cache docs) ──────────────────────────────────
async def _ensure_cache_indexes():
    try:
        await db.govt_price_cache.create_index(
            "fetchedAt", expireAfterSeconds=CACHE_TTL_MINUTES * 60 * 2
        )
    except Exception:
        pass  # index may already exist


# Fire-and-forget index creation
_idx_task: asyncio.Task | None = None


def _init_indexes():
    global _idx_task
    try:
        loop = asyncio.get_running_loop()
        _idx_task = loop.create_task(_ensure_cache_indexes())
    except RuntimeError:
        pass


_init_indexes()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/govt-prices")
async def get_govt_prices(
    request: Request,
    commodity: str = Query("", description="Crop / commodity name"),
    state: str = Query("", description="Indian state"),
    limit: int = Query(50, ge=1, le=200),
):
    """Fetch live government wholesale (mandi) prices."""
    await get_current_user(request)

    if not commodity:
        raise HTTPException(status_code=400, detail="commodity query parameter is required")

    resolved = _resolve_commodity(commodity)
    records = await _fetch_govt_prices(resolved, state, limit)

    # If we got no results with the resolved name, try aliases
    if not records and commodity.strip().lower() in COMMODITY_ALIASES:
        for alt in COMMODITY_ALIASES[commodity.strip().lower()][1:]:
            records = await _fetch_govt_prices(alt, state, limit)
            if records:
                resolved = alt
                break

    # Compute aggregate stats
    modal_prices = [r["modalPrice"] for r in records if r["modalPrice"] > 0]
    min_prices = [r["minPrice"] for r in records if r["minPrice"] > 0]
    max_prices = [r["maxPrice"] for r in records if r["maxPrice"] > 0]

    stats = {}
    if modal_prices:
        stats = {
            "avgModalPrice": round(sum(modal_prices) / len(modal_prices), 2),
            "lowestPrice": round(min(min_prices) if min_prices else 0, 2),
            "highestPrice": round(max(max_prices) if max_prices else 0, 2),
            "medianModalPrice": round(
                sorted(modal_prices)[len(modal_prices) // 2], 2
            ),
            "marketsReporting": len(records),
            "priceSpread": round(
                (max(max_prices) - min(min_prices)) if min_prices and max_prices else 0, 2
            ),
        }

    return {
        "commodity": resolved,
        "state": state or "All India",
        "records": records,
        "stats": stats,
        "count": len(records),
        "source": "data.gov.in / Agmarknet",
    }


@router.get("/govt-prices/compare/{harvest_id}")
async def compare_with_govt(request: Request, harvest_id: str):
    """Compare a specific harvest's base price against government rates."""
    await get_current_user(request)

    harvest = await db.harvests.find_one({"_id": ObjectId(harvest_id)})
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest not found")

    crop = harvest.get("cropType", "")
    location = harvest.get("location", "")
    base_price = harvest.get("basePrice", 0)

    resolved_commodity = _resolve_commodity(crop)
    state = _extract_state(location)

    records = await _fetch_govt_prices(resolved_commodity, state, 50)

    # Fallback to all-India if state-specific gives no results
    if not records and state:
        records = await _fetch_govt_prices(resolved_commodity, "", 50)
        state = "All India"

    # Also try alias variants
    if not records and crop.strip().lower() in COMMODITY_ALIASES:
        for alt in COMMODITY_ALIASES[crop.strip().lower()][1:]:
            records = await _fetch_govt_prices(alt, state or "", 50)
            if records:
                resolved_commodity = alt
                break

    modal_prices = [r["modalPrice"] for r in records if r["modalPrice"] > 0]

    if not modal_prices:
        return {
            "harvest": serialize_doc(harvest),
            "comparison": None,
            "message": f"No government price data available for {crop} in {location}",
        }

    avg_govt = sum(modal_prices) / len(modal_prices)
    # Govt prices are per quintal (100 kg); farmer prices are per kg
    avg_govt_per_kg = avg_govt / 100

    diff = base_price - avg_govt_per_kg
    diff_pct = (diff / avg_govt_per_kg * 100) if avg_govt_per_kg > 0 else 0

    # Determine fairness badge
    if diff_pct > 30:
        badge = "well_above"
        badge_label = "Well Above Govt Rate"
    elif diff_pct > 10:
        badge = "above"
        badge_label = "Above Govt Rate"
    elif diff_pct > -10:
        badge = "fair"
        badge_label = "Fair Price"
    elif diff_pct > -30:
        badge = "below"
        badge_label = "Below Govt Rate"
    else:
        badge = "well_below"
        badge_label = "Well Below Govt Rate"

    min_govt = min(r["minPrice"] for r in records if r["minPrice"] > 0) / 100 if records else 0
    max_govt = max(r["maxPrice"] for r in records if r["maxPrice"] > 0) / 100 if records else 0

    return {
        "harvest": serialize_doc(harvest),
        "comparison": {
            "farmerPrice": base_price,
            "govtAvgPrice": round(avg_govt_per_kg, 2),
            "govtMinPrice": round(min_govt, 2),
            "govtMaxPrice": round(max_govt, 2),
            "differencePerKg": round(diff, 2),
            "differencePercent": round(diff_pct, 1),
            "badge": badge,
            "badgeLabel": badge_label,
            "commodity": resolved_commodity,
            "state": state or "All India",
            "marketsReporting": len(records),
            "note": "Government prices are wholesale (mandi) rates from Agmarknet. Quoted per quintal, converted to per-kg here.",
        },
    }


@router.get("/govt-prices/states")
async def get_states(request: Request):
    """Return list of Indian states for filtering."""
    await get_current_user(request)
    return {"states": INDIAN_STATES}


@router.get("/govt-prices/commodities")
async def get_commodities(request: Request):
    """Return the list of supported commodity mappings."""
    await get_current_user(request)
    return {
        "commodities": [
            {"name": k.title(), "agmarknetNames": v}
            for k, v in COMMODITY_ALIASES.items()
        ]
    }


@router.get("/govt-prices/trend")
async def govt_price_trend(
    request: Request,
    commodity: str = Query("", description="Crop name"),
    state: str = Query("", description="Indian state (optional)"),
):
    """
    Return multi-day price trend from cached data + current fetch.
    Aggregates historical cache entries for the commodity.
    """
    await get_current_user(request)
    if not commodity:
        raise HTTPException(status_code=400, detail="commodity is required")

    resolved = _resolve_commodity(commodity)

    # Fetch current prices (this also populates the cache)
    current_records = await _fetch_govt_prices(resolved, state, 50)

    # Also look at past harvests in our DB for a historical baseline
    pipeline = [
        {"$match": {"cropType": {"$regex": f"^{commodity}$", "$options": "i"}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$createdAt"}},
            "avgPrice": {"$avg": "$basePrice"},
            "minPrice": {"$min": "$basePrice"},
            "maxPrice": {"$max": "$basePrice"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 30},
    ]
    platform_data = await db.harvests.aggregate(pipeline).to_list(30)

    # Current govt snapshot
    modal_prices = [r["modalPrice"] for r in current_records if r["modalPrice"] > 0]
    govt_snapshot = {}
    if modal_prices:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        govt_snapshot = {
            "date": today,
            "avgModalPrice": round(sum(modal_prices) / len(modal_prices) / 100, 2),
            "minPrice": round(min(r["minPrice"] for r in current_records if r["minPrice"] > 0) / 100, 2) if current_records else 0,
            "maxPrice": round(max(r["maxPrice"] for r in current_records if r["maxPrice"] > 0) / 100, 2) if current_records else 0,
        }

    return {
        "commodity": resolved,
        "state": state or "All India",
        "platformHistory": [
            {
                "date": d["_id"],
                "avgPrice": round(d["avgPrice"], 2),
                "minPrice": d["minPrice"],
                "maxPrice": d["maxPrice"],
                "listings": d["count"],
            }
            for d in platform_data
        ],
        "govtCurrent": govt_snapshot,
        "govtRecords": current_records[:10],
    }
