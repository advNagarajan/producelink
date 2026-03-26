from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone, date
import re
from typing import Any, Awaitable, Callable, cast
from database import db
from auth import get_current_user as imported_get_current_user
from utils import serialize_doc
from pagination import PaginationParams

router = APIRouter()
get_current_user = cast(Callable[[Request], Awaitable[dict]], imported_get_current_user)


class HarvestBody(BaseModel):
    cropType: str
    quantity: float
    unit: str
    qualityGrade: str
    basePrice: float
    harvestDate: date
    location: str
    pincode: str
    images: list[str]
    dispatchDateTime: datetime | None = None
    landSizeAcres: float | None = None


ALLOWED_UNITS = {"kg", "quintal", "ton", "crates"}
UNIT_TO_KG = {
    "kg": 1.0,
    "quintal": 100.0,
    "ton": 1000.0,
    "crates": 20.0,
}
CROP_ALIASES = {
    "tomatoes": "tomato",
    "tomato": "tomato",
    "onions": "onion",
    "onion": "onion",
    "rice": "rice",
    "paddy": "rice",
    "wheat": "wheat",
    "potato": "potato",
    "potatoes": "potato",
}
CROP_RULES: dict[str, dict[str, Any]] = {
    "tomato": {
        "max_qty_kg": 100000,
        "min_price": 5,
        "max_price": 120,
        "shelf_life_days": 10,
        "season_months": {11, 12, 1, 2, 3, 4},
        "max_yield_per_acre_kg": 30000,
    },
    "onion": {
        "max_qty_kg": 150000,
        "min_price": 8,
        "max_price": 90,
        "shelf_life_days": 45,
        "season_months": {10, 11, 12, 1, 2, 3, 4},
        "max_yield_per_acre_kg": 20000,
    },
    "rice": {
        "max_qty_kg": 300000,
        "min_price": 15,
        "max_price": 80,
        "shelf_life_days": 180,
        "season_months": {9, 10, 11, 12, 1},
        "max_yield_per_acre_kg": 3500,
    },
    "wheat": {
        "max_qty_kg": 250000,
        "min_price": 18,
        "max_price": 70,
        "shelf_life_days": 180,
        "season_months": {3, 4, 5, 6},
        "max_yield_per_acre_kg": 3000,
    },
    "potato": {
        "max_qty_kg": 200000,
        "min_price": 6,
        "max_price": 65,
        "shelf_life_days": 60,
        "season_months": {11, 12, 1, 2, 3},
        "max_yield_per_acre_kg": 18000,
    },
}
DEFAULT_RULES = {
    "max_qty_kg": 120000,
    "min_price": 5,
    "max_price": 150,
    "shelf_life_days": 30,
    "season_months": {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12},
    "max_yield_per_acre_kg": 12000,
}
PERISHABLE_CROPS = {"tomato", "potato", "onion"}


def _normalize_crop(crop: str) -> str:
    c = crop.strip().lower()
    return CROP_ALIASES.get(c, c)


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    # Mongo values may be returned as naive UTC depending on client settings.
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@router.get("/harvests")
async def get_harvests(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    user = await get_current_user(request)
    if user["role"] != "farmer":
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Optimized: Add pagination
    pagination = PaginationParams(page, page_size)
    
    # Get total count
    total_count = await db.harvests.count_documents({"farmerId": ObjectId(user["id"])})
    
    # Get paginated results
    harvests = await db.harvests.find(
        {"farmerId": ObjectId(user["id"])}
    ).sort("createdAt", -1).skip(pagination.skip).limit(pagination.limit).to_list(pagination.limit)

    return pagination.paginate_response([serialize_doc(h) for h in harvests], total_count)


@router.post("/harvests", status_code=201)
async def create_harvest(body: HarvestBody, request: Request):
    user = await get_current_user(request)
    if user["role"] != "farmer":
        raise HTTPException(status_code=401, detail="Unauthorized")

    normalized_crop = _normalize_crop(body.cropType)
    if normalized_crop not in CROP_RULES:
        raise HTTPException(status_code=400, detail="Unsupported crop type. Use a known produce category.")

    rules = CROP_RULES.get(normalized_crop, DEFAULT_RULES)

    # Field-level validation
    if body.unit not in ALLOWED_UNITS:
        raise HTTPException(status_code=400, detail="Invalid unit. Allowed: kg, quintal, ton, crates")
    if body.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")
    if body.basePrice <= 0:
        raise HTTPException(status_code=400, detail="Price must be greater than zero")
    if body.qualityGrade not in ["A", "B", "C", "D"]:
        raise HTTPException(status_code=400, detail="Grade must be one of A, B, C, D")
    if not re.fullmatch(r"\d{6}", body.pincode.strip()):
        raise HTTPException(status_code=400, detail="Pincode must be a valid 6-digit Indian pincode")
    if len(body.location.strip()) < 3:
        raise HTTPException(status_code=400, detail="Location is required")
    if len(body.images) < 2:
        raise HTTPException(status_code=400, detail="At least 2 produce images are required")

    for img in body.images:
        image_value = img.strip().lower()
        if not image_value:
            raise HTTPException(status_code=400, detail="Image URL/path cannot be empty")
        is_file_path = (
            image_value.endswith(".jpg")
            or image_value.endswith(".jpeg")
            or image_value.endswith(".png")
            or image_value.endswith(".webp")
        )
        is_data_url = (
            image_value.startswith("data:image/jpeg;base64,")
            or image_value.startswith("data:image/jpg;base64,")
            or image_value.startswith("data:image/png;base64,")
            or image_value.startswith("data:image/webp;base64,")
        )
        if not (is_file_path or is_data_url):
            raise HTTPException(status_code=400, detail="Images must be jpg, jpeg, png, or webp")

    quantity_kg = body.quantity * UNIT_TO_KG[body.unit]
    if quantity_kg > rules["max_qty_kg"]:
        raise HTTPException(status_code=400, detail=f"Quantity too high for {normalized_crop}. Max allowed is {rules['max_qty_kg']} kg")
    if body.basePrice < rules["min_price"] or body.basePrice > rules["max_price"]:
        raise HTTPException(
            status_code=400,
            detail=f"Price out of allowed bounds for {normalized_crop}. Allowed range is Rs {rules['min_price']}-{rules['max_price']} per kg",
        )

    today = datetime.now(timezone.utc).date()
    if body.harvestDate > today:
        raise HTTPException(status_code=400, detail="Harvest date cannot be in the future")
    age_days = (today - body.harvestDate).days
    if age_days > rules["shelf_life_days"]:
        raise HTTPException(status_code=400, detail=f"Harvest date is too old for {normalized_crop} freshness window")

    if normalized_crop in PERISHABLE_CROPS and body.dispatchDateTime is None:
        raise HTTPException(status_code=400, detail="Dispatch date/time is required for perishable produce")

    warnings: list[str] = []

    # Business-rule validation
    if body.harvestDate.month not in rules["season_months"]:
        warnings.append("Off-season crop listing detected")

    grade_price_floor = {
        "A": rules["min_price"] * 1.2,
        "B": rules["min_price"] * 1.05,
        "C": rules["min_price"],
        "D": rules["min_price"] * 0.85,
    }
    if body.basePrice < grade_price_floor.get(body.qualityGrade, rules["min_price"]):
        warnings.append("Price is low for selected grade")

    if body.landSizeAcres is not None and body.landSizeAcres > 0:
        feasible_max = body.landSizeAcres * rules["max_yield_per_acre_kg"] * 1.3
        if quantity_kg > feasible_max:
            raise HTTPException(status_code=400, detail="Quantity appears impossible for declared land size")

    recent_same_crop = await db.harvests.find(
        {"farmerId": ObjectId(user["id"]), "cropTypeNormalized": normalized_crop},
        {"quantityKg": 1},
    ).sort("createdAt", -1).limit(10).to_list(10)
    historical_qty = [float(h.get("quantityKg", 0)) for h in recent_same_crop if float(h.get("quantityKg", 0)) > 0]
    if historical_qty:
        avg_qty = sum(historical_qty) / len(historical_qty)
        if quantity_kg > avg_qty * 5:
            warnings.append("Quantity is much higher than your historical average for this crop")

    # Risk / fraud validation
    risk_score = 0
    risk_reasons: list[str] = []
    now_utc = datetime.now(timezone.utc)
    user_doc = await db.users.find_one({"_id": ObjectId(user["id"])}, {"createdAt": 1})
    user_created = _as_utc(user_doc.get("createdAt")) if user_doc and isinstance(user_doc.get("createdAt"), datetime) else None
    if user_created:
        account_days = (now_utc - user_created).days
        if account_days < 14:
            risk_score += 2
            risk_reasons.append("New farmer account")

    if quantity_kg > rules["max_qty_kg"] * 0.85:
        risk_score += 2
        risk_reasons.append("Unusually high quantity")
    if body.basePrice > rules["max_price"] * 0.9:
        risk_score += 1
        risk_reasons.append("Unusually high price")

    last_24h_count = await db.harvests.count_documents(
        {
            "farmerId": ObjectId(user["id"]),
            "createdAt": {"$gte": now_utc.replace(hour=0, minute=0, second=0, microsecond=0)},
        }
    )
    if last_24h_count >= 8:
        risk_score += 2
        risk_reasons.append("High listing frequency")

    current_ip = request.client.host if request.client else None
    if current_ip:
        recent_ips = await db.harvests.distinct(
            "createdByIp",
            {
                "farmerId": ObjectId(user["id"]),
                "createdAt": {"$gte": now_utc.replace(hour=0, minute=0, second=0, microsecond=0)},
            },
        )
        known_recent_ips = {ip for ip in recent_ips if ip}
        if len(known_recent_ips) >= 2 and current_ip not in known_recent_ips:
            risk_score += 1
            risk_reasons.append("Unusual source IP for today")

    duplicate_images = await db.harvests.count_documents({"images": {"$in": body.images}})
    if duplicate_images > 0:
        risk_score += 2
        risk_reasons.append("Duplicate image detected")

    risk_level = "low"
    visibility_score = 1.0
    status = "available"
    if risk_score >= 5:
        risk_level = "high"
        visibility_score = 0.0
        status = "under_review"
    elif risk_score >= 3:
        risk_level = "medium"
        visibility_score = 0.6

    now = datetime.now(timezone.utc)
    doc = {
        "farmerId": ObjectId(user["id"]),
        "cropType": body.cropType.strip(),
        "cropTypeNormalized": normalized_crop,
        "quantity": body.quantity,
        "quantityKg": round(quantity_kg, 2),
        "unit": body.unit,
        "qualityGrade": body.qualityGrade,
        "basePrice": body.basePrice,
        "harvestDate": datetime.combine(body.harvestDate, datetime.min.time(), tzinfo=timezone.utc),
        "dispatchDateTime": body.dispatchDateTime,
        "location": body.location.strip(),
        "pincode": body.pincode.strip(),
        "images": body.images,
        "landSizeAcres": body.landSizeAcres,
        "status": status,
        "visibilityScore": visibility_score,
        "validation": {
            "warnings": warnings,
            "riskScore": risk_score,
            "riskLevel": risk_level,
            "riskReasons": risk_reasons,
            "checkedAt": now,
        },
        "createdByIp": current_ip,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await db.harvests.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)
