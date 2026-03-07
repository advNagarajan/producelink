from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from database import db
from auth import get_current_user
from utils import serialize_doc

router = APIRouter()


@router.get("/market")
async def get_market(request: Request):
    user = await get_current_user(request)
    if user["role"] != "mandi_owner":
        raise HTTPException(status_code=401, detail="Unauthorized")

    pipeline = [
        {"$match": {"status": {"$in": ["available", "bidding"]}}},
        {"$lookup": {
            "from": "users",
            "localField": "farmerId",
            "foreignField": "_id",
            "pipeline": [{"$project": {"name": 1}}],
            "as": "_farmer",
        }},
        {"$addFields": {
            "farmerId": {"$arrayElemAt": ["$_farmer", 0]},
        }},
        {"$project": {"_farmer": 0}},
        {"$sort": {"createdAt": -1}},
    ]

    harvests = await db.harvests.aggregate(pipeline).to_list(100)
    return [serialize_doc(h) for h in harvests]
