from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from typing import Awaitable, Callable, cast
from database import db
from auth import get_current_user as imported_get_current_user
from utils import serialize_doc

get_current_user = cast(Callable[[Request], Awaitable[dict]], imported_get_current_user)

router = APIRouter()


@router.get("/invoice/{delivery_id}")
async def get_invoice(delivery_id: str, request: Request):
    user = await get_current_user(request)

    # Optimized: Use aggregation pipeline to fetch all data in single query
    pipeline = [
        {"$match": {"_id": ObjectId(delivery_id)}},
        {"$lookup": {
            "from": "harvests",
            "localField": "harvestId",
            "foreignField": "_id",
            "as": "harvest"
        }},
        {"$unwind": "$harvest"},
        {"$lookup": {
            "from": "bids",
            "let": {"harvestId": "$harvestId"},
            "pipeline": [
                {"$match": {
                    "$expr": {"$eq": ["$harvestId", "$$harvestId"]},
                    "status": "accepted"
                }}
            ],
            "as": "bid"
        }},
        {"$lookup": {
            "from": "users",
            "localField": "harvest.farmerId",
            "foreignField": "_id",
            "pipeline": [{"$project": {"name": 1, "email": 1, "farmLocation": 1}}],
            "as": "farmer"
        }},
        {"$lookup": {
            "from": "users",
            "localField": "transporterId",
            "foreignField": "_id",
            "pipeline": [{"$project": {"name": 1, "email": 1}}],
            "as": "transporter"
        }},
        {"$addFields": {
            "bid": {"$arrayElemAt": ["$bid", 0]},
            "farmer": {"$arrayElemAt": ["$farmer", 0]},
            "transporter": {"$arrayElemAt": ["$transporter", 0]}
        }}
    ]
    
    result = await db.deliveryrequests.aggregate(pipeline).to_list(1)
    if not result:
        raise HTTPException(status_code=404, detail="Delivery not found")
    
    delivery = result[0]
    
    if delivery["status"] != "delivered":
        raise HTTPException(status_code=400, detail="Invoice only available for completed deliveries")
    
    harvest = delivery["harvest"]
    bid = delivery.get("bid")
    
    # Lookup buyer if there's a bid
    buyer = None
    if bid:
        buyer_doc = await db.users.find_one(
            {"_id": bid["mandiOwnerId"]},
            {"name": 1, "email": 1, "businessName": 1}
        )
        buyer = serialize_doc(buyer_doc) if buyer_doc else None

    price_per_kg = bid["amount"] if bid else harvest["basePrice"]
    total = price_per_kg * harvest["quantity"]

    return {
        "invoiceId": str(delivery["_id"]),
        "date": delivery.get("updatedAt", delivery["createdAt"]).isoformat(),
        "crop": harvest["cropType"],
        "quantity": harvest["quantity"],
        "qualityGrade": harvest.get("qualityGrade", ""),
        "pricePerKg": price_per_kg,
        "total": total,
        "pickup": delivery["pickupLocation"],
        "dropoff": delivery["dropoffLocation"],
        "farmer": serialize_doc(delivery.get("farmer")) if delivery.get("farmer") else None,
        "buyer": buyer,
        "transporter": serialize_doc(delivery.get("transporter")) if delivery.get("transporter") else None,
    }
