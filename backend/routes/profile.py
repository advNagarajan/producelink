from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from database import db
from auth import get_current_user
from utils import serialize_doc

router = APIRouter()


@router.get("/profile/{user_id}")
async def get_profile(user_id: str, request: Request):
    await get_current_user(request)

    user = await db.users.find_one(
        {"_id": ObjectId(user_id)},
        {"password": 0},
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile = serialize_doc(user)

    # Rating summary
    rating_pipeline = [
        {"$match": {"targetUserId": ObjectId(user_id)}},
        {"$group": {"_id": None, "avg": {"$avg": "$score"}, "count": {"$sum": 1}}},
    ]
    rating_result = await db.ratings.aggregate(rating_pipeline).to_list(1)
    profile["rating"] = {
        "avg": round(rating_result[0]["avg"], 1) if rating_result else 0,
        "count": rating_result[0]["count"] if rating_result else 0,
    }

    # Stats based on role
    role = user.get("role")
    if role == "farmer":
        profile["totalHarvests"] = await db.harvests.count_documents({"farmerId": ObjectId(user_id)})
        profile["totalSold"] = await db.harvests.count_documents({"farmerId": ObjectId(user_id), "status": "sold"})
    elif role == "mandi_owner":
        profile["totalBids"] = await db.bids.count_documents({"mandiOwnerId": ObjectId(user_id)})
        profile["acceptedBids"] = await db.bids.count_documents({"mandiOwnerId": ObjectId(user_id), "status": "accepted"})
    elif role == "transporter":
        profile["totalDeliveries"] = await db.deliveryrequests.count_documents({"transporterId": ObjectId(user_id)})
        profile["completedDeliveries"] = await db.deliveryrequests.count_documents({"transporterId": ObjectId(user_id), "status": "delivered"})

    return profile


@router.get("/profile/{user_id}/activity")
async def get_activity(user_id: str, request: Request):
    await get_current_user(request)

    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"role": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = user.get("role")
    if role == "farmer":
        harvests = await db.harvests.find(
            {"farmerId": ObjectId(user_id)}
        ).sort("createdAt", -1).to_list(20)
        return {"harvests": [serialize_doc(h) for h in harvests]}
    elif role == "mandi_owner":
        bids = await db.bids.find(
            {"mandiOwnerId": ObjectId(user_id)}
        ).sort("createdAt", -1).to_list(20)
        return {"bids": [serialize_doc(b) for b in bids]}
    elif role == "transporter":
        deliveries = await db.deliveryrequests.find(
            {"transporterId": ObjectId(user_id)}
        ).sort("createdAt", -1).to_list(20)
        return {"deliveries": [serialize_doc(d) for d in deliveries]}

    return {}
