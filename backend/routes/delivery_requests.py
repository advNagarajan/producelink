from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from database import db
from auth import get_current_user
from utils import serialize_doc

router = APIRouter()


class DeliveryRequestBody(BaseModel):
    harvestId: str
    pickupLocation: str
    dropoffLocation: str


class StatusUpdate(BaseModel):
    status: str


@router.get("/delivery-requests")
async def get_delivery_requests(request: Request):
    user = await get_current_user(request)

    if user["role"] == "transporter":
        match = {
            "$or": [
                {"status": "pending"},
                {"transporterId": ObjectId(user["id"])},
            ]
        }
        pipeline = [
            {"$match": match},
            {"$lookup": {
                "from": "harvests",
                "localField": "harvestId",
                "foreignField": "_id",
                "pipeline": [{"$project": {"cropType": 1, "quantity": 1, "location": 1}}],
                "as": "_h",
            }},
            {"$addFields": {"harvestId": {"$arrayElemAt": ["$_h", 0]}}},
            {"$lookup": {
                "from": "users",
                "localField": "requesterId",
                "foreignField": "_id",
                "pipeline": [{"$project": {"name": 1}}],
                "as": "_r",
            }},
            {"$addFields": {"requesterId": {"$arrayElemAt": ["$_r", 0]}}},
            {"$project": {"_h": 0, "_r": 0}},
            {"$sort": {"createdAt": -1}},
        ]
    else:
        match = {"requesterId": ObjectId(user["id"])}
        pipeline = [
            {"$match": match},
            {"$lookup": {
                "from": "harvests",
                "localField": "harvestId",
                "foreignField": "_id",
                "pipeline": [{"$project": {"cropType": 1, "quantity": 1, "location": 1}}],
                "as": "_h",
            }},
            {"$addFields": {"harvestId": {"$arrayElemAt": ["$_h", 0]}}},
            {"$lookup": {
                "from": "users",
                "localField": "transporterId",
                "foreignField": "_id",
                "pipeline": [{"$project": {"name": 1}}],
                "as": "_t",
            }},
            {"$addFields": {"transporterId": {"$arrayElemAt": ["$_t", 0]}}},
            {"$project": {"_h": 0, "_t": 0}},
            {"$sort": {"createdAt": -1}},
        ]

    results = await db.deliveryrequests.aggregate(pipeline).to_list(100)
    return [serialize_doc(r) for r in results]


@router.post("/delivery-requests", status_code=201)
async def create_delivery_request(body: DeliveryRequestBody, request: Request):
    user = await get_current_user(request)
    if user["role"] == "transporter":
        raise HTTPException(status_code=401, detail="Unauthorized")

    now = datetime.now(timezone.utc)
    doc = {
        "harvestId": ObjectId(body.harvestId),
        "requesterId": ObjectId(user["id"]),
        "pickupLocation": body.pickupLocation,
        "dropoffLocation": body.dropoffLocation,
        "status": "pending",
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.deliveryrequests.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)


@router.patch("/delivery-requests/{request_id}")
async def update_delivery_request(request_id: str, body: StatusUpdate, request: Request):
    user = await get_current_user(request)
    if user["role"] != "transporter":
        raise HTTPException(status_code=401, detail="Unauthorized")

    valid_statuses = ["accepted", "in_transit", "delivered"]
    if body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")

    doc = await db.deliveryrequests.find_one({"_id": ObjectId(request_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Request not found")

    if doc["status"] != "pending" and str(doc.get("transporterId", "")) != user["id"]:
        raise HTTPException(status_code=403, detail="This request is already assigned to someone else")

    update: dict = {"status": body.status, "updatedAt": datetime.now(timezone.utc)}
    if body.status == "accepted":
        update["transporterId"] = ObjectId(user["id"])

    await db.deliveryrequests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": update},
    )

    doc.update(update)
    return serialize_doc(doc)
