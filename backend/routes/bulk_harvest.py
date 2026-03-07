from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from database import db
from auth import get_current_user
from utils import serialize_doc

router = APIRouter()


class BulkHarvestItem(BaseModel):
    cropType: str
    quantity: float
    qualityGrade: str
    basePrice: float
    location: str


class BulkHarvestBody(BaseModel):
    harvests: list[BulkHarvestItem]


@router.post("/harvests/bulk", status_code=201)
async def create_bulk_harvests(body: BulkHarvestBody, request: Request):
    user = await get_current_user(request)
    if user["role"] != "farmer":
        raise HTTPException(status_code=401, detail="Unauthorized")

    if len(body.harvests) > 50:
        raise HTTPException(status_code=400, detail="Max 50 harvests per batch")

    now = datetime.now(timezone.utc)
    docs = []
    for item in body.harvests:
        docs.append({
            "farmerId": ObjectId(user["id"]),
            "cropType": item.cropType,
            "quantity": item.quantity,
            "qualityGrade": item.qualityGrade,
            "basePrice": item.basePrice,
            "location": item.location,
            "status": "available",
            "createdAt": now,
            "updatedAt": now,
        })

    result = await db.harvests.insert_many(docs)
    for i, doc in enumerate(docs):
        doc["_id"] = result.inserted_ids[i]

    return {"count": len(docs), "harvests": [serialize_doc(d) for d in docs]}
