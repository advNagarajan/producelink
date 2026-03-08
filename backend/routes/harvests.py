from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from database import db
from auth import get_current_user
from utils import serialize_doc
from pagination import PaginationParams

router = APIRouter()


class HarvestBody(BaseModel):
    cropType: str
    quantity: float
    qualityGrade: str
    basePrice: float
    location: str


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

    now = datetime.now(timezone.utc)
    doc = {
        "farmerId": ObjectId(user["id"]),
        "cropType": body.cropType,
        "quantity": body.quantity,
        "qualityGrade": body.qualityGrade,
        "basePrice": body.basePrice,
        "location": body.location,
        "status": "available",
        "createdAt": now,
        "updatedAt": now,
    }

    result = await db.harvests.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)
