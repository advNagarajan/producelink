from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from database import db
from auth import get_current_user
from utils import serialize_doc
from firebase_utils import broadcast_bid

router = APIRouter()


class BidBody(BaseModel):
    harvestId: str
    amount: float
    dropoffLocation: str


@router.get("/bids")
async def get_bids(harvestId: str, request: Request):
    await get_current_user(request)

    pipeline = [
        {"$match": {"harvestId": ObjectId(harvestId)}},
        {"$lookup": {
            "from": "users",
            "localField": "mandiOwnerId",
            "foreignField": "_id",
            "pipeline": [{"$project": {"name": 1, "email": 1}}],
            "as": "_mandi",
        }},
        {"$addFields": {
            "mandiOwnerId": {"$arrayElemAt": ["$_mandi", 0]},
        }},
        {"$project": {"_mandi": 0}},
        {"$sort": {"amount": -1}},
    ]

    bids = await db.bids.aggregate(pipeline).to_list(100)
    return [serialize_doc(b) for b in bids]


@router.post("/bids", status_code=201)
async def create_bid(body: BidBody, request: Request):
    user = await get_current_user(request)
    if user["role"] != "mandi_owner":
        raise HTTPException(status_code=401, detail="Unauthorized")

    harvest = await db.harvests.find_one({"_id": ObjectId(body.harvestId)})
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest not found")
    if harvest["status"] == "sold":
        raise HTTPException(status_code=400, detail="This harvest has already been sold")
    if body.amount <= harvest["basePrice"]:
        raise HTTPException(status_code=400, detail="Bid amount must be greater than the base price")

    now = datetime.now(timezone.utc)
    doc = {
        "harvestId": ObjectId(body.harvestId),
        "mandiOwnerId": ObjectId(user["id"]),
        "amount": body.amount,
        "dropoffLocation": body.dropoffLocation,
        "status": "pending",
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.bids.insert_one(doc)

    if harvest["status"] == "available":
        await db.harvests.update_one(
            {"_id": ObjectId(body.harvestId)},
            {"$set": {"status": "bidding", "updatedAt": now}},
        )

    await broadcast_bid(body.harvestId, {
        "bidId": str(result.inserted_id),
        "amount": body.amount,
        "mandiOwnerName": user.get("name", "A Mandi Owner"),
        "mandiOwnerId": user["id"],
    })

    doc["_id"] = result.inserted_id
    return serialize_doc(doc)


@router.post("/bids/{bid_id}/accept")
async def accept_bid(bid_id: str, request: Request):
    user = await get_current_user(request)
    if user["role"] != "farmer":
        raise HTTPException(status_code=401, detail="Unauthorized")

    bid = await db.bids.find_one({"_id": ObjectId(bid_id)})
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")

    harvest = await db.harvests.find_one({"_id": bid["harvestId"]})
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest not found")

    if str(harvest["farmerId"]) != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    now = datetime.now(timezone.utc)

    await db.bids.update_one(
        {"_id": ObjectId(bid_id)},
        {"$set": {"status": "accepted", "updatedAt": now}},
    )

    await db.bids.update_many(
        {"harvestId": harvest["_id"], "_id": {"$ne": ObjectId(bid_id)}},
        {"$set": {"status": "rejected", "updatedAt": now}},
    )

    await db.harvests.update_one(
        {"_id": harvest["_id"]},
        {"$set": {"status": "sold", "updatedAt": now}},
    )

    delivery_doc = {
        "harvestId": harvest["_id"],
        "requesterId": ObjectId(user["id"]),
        "pickupLocation": harvest["location"],
        "dropoffLocation": bid.get("dropoffLocation", ""),
        "status": "pending",
        "createdAt": now,
        "updatedAt": now,
    }
    await db.deliveryrequests.insert_one(delivery_doc)

    bid["status"] = "accepted"
    return {"bid": serialize_doc(bid), "message": "Bid accepted"}
