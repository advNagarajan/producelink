from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from database import db
from auth import get_current_user
from utils import serialize_doc

router = APIRouter()


class HarvestBody(BaseModel):
    cropType: str
    quantity: float
    qualityGrade: str
    basePrice: float
    location: str


@router.get("/harvests")
async def get_harvests(request: Request):
    user = await get_current_user(request)
    if user["role"] != "farmer":
        raise HTTPException(status_code=401, detail="Unauthorized")

    harvests = await db.harvests.find(
        {"farmerId": ObjectId(user["id"])}
    ).sort("createdAt", -1).to_list(100)

    return [serialize_doc(h) for h in harvests]


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
