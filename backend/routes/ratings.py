from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from bson import ObjectId
from datetime import datetime, timezone
from database import db
from auth import get_current_user
from utils import serialize_doc

router = APIRouter()


class RatingBody(BaseModel):
    targetUserId: str
    deliveryRequestId: str
    score: int = Field(ge=1, le=5)
    comment: str = ""


@router.post("/ratings", status_code=201)
async def create_rating(body: RatingBody, request: Request):
    user = await get_current_user(request)

    existing = await db.ratings.find_one({
        "fromUserId": ObjectId(user["id"]),
        "deliveryRequestId": ObjectId(body.deliveryRequestId),
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already rated this delivery")

    delivery = await db.deliveryrequests.find_one({"_id": ObjectId(body.deliveryRequestId)})
    if not delivery or delivery["status"] != "delivered":
        raise HTTPException(status_code=400, detail="Can only rate completed deliveries")

    doc = {
        "fromUserId": ObjectId(user["id"]),
        "targetUserId": ObjectId(body.targetUserId),
        "deliveryRequestId": ObjectId(body.deliveryRequestId),
        "score": body.score,
        "comment": body.comment,
        "createdAt": datetime.now(timezone.utc),
    }
    result = await db.ratings.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)


@router.get("/ratings/{user_id}")
async def get_ratings(user_id: str, request: Request):
    await get_current_user(request)

    pipeline = [
        {"$match": {"targetUserId": ObjectId(user_id)}},
        {"$lookup": {
            "from": "users",
            "localField": "fromUserId",
            "foreignField": "_id",
            "pipeline": [{"$project": {"name": 1, "role": 1}}],
            "as": "_from",
        }},
        {"$addFields": {"fromUser": {"$arrayElemAt": ["$_from", 0]}}},
        {"$project": {"_from": 0}},
        {"$sort": {"createdAt": -1}},
    ]
    ratings = await db.ratings.aggregate(pipeline).to_list(100)
    return [serialize_doc(r) for r in ratings]


@router.get("/ratings/{user_id}/summary")
async def rating_summary(user_id: str, request: Request):
    await get_current_user(request)

    pipeline = [
        {"$match": {"targetUserId": ObjectId(user_id)}},
        {"$group": {
            "_id": None,
            "avg": {"$avg": "$score"},
            "count": {"$sum": 1},
        }},
    ]
    result = await db.ratings.aggregate(pipeline).to_list(1)
    if not result:
        return {"avg": 0, "count": 0}
    return {"avg": round(result[0]["avg"], 1), "count": result[0]["count"]}
