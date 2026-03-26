from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from typing import Any
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
    workflowMeta: dict[str, Any] | None = None


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

    current = doc.get("status")
    allowed_transitions = {
        "pending": "accepted",
        "accepted": "in_transit",
        "in_transit": "delivered",
    }
    expected_next = allowed_transitions.get(current)
    if expected_next != body.status:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transition: {current} -> {body.status}. Allowed next state is {expected_next}",
        )

    workflow_meta = body.workflowMeta or {}

    update: dict = {"status": body.status, "updatedAt": datetime.now(timezone.utc)}
    if body.status == "accepted":
        update["transporterId"] = ObjectId(user["id"])
        update["acceptedAt"] = datetime.now(timezone.utc)

    if body.status == "in_transit":
        checklist = workflow_meta.get("pickupChecklist") or {}
        route_plan = workflow_meta.get("routePlan") or {}
        if not all(
            [
                checklist.get("cargoLoaded"),
                checklist.get("documentsChecked"),
                checklist.get("pickupVerified"),
            ]
        ):
            raise HTTPException(status_code=400, detail="Pickup checklist must be fully completed before starting transit")
        if not route_plan.get("distanceKm") or not route_plan.get("durationMinutes"):
            raise HTTPException(status_code=400, detail="Route optimization details are required before marking in transit")

        update["transitStartedAt"] = datetime.now(timezone.utc)
        update["pickupChecklist"] = checklist
        update["routePlan"] = {
            "distanceKm": float(route_plan.get("distanceKm", 0)),
            "durationMinutes": float(route_plan.get("durationMinutes", 0)),
            "strategy": route_plan.get("strategy", ""),
            "checkpoints": route_plan.get("checkpoints", []),
        }

    if body.status == "delivered":
        confirmation = workflow_meta.get("deliveryConfirmation") or {}
        receiver_name = str(confirmation.get("receiverName", "")).strip()
        proof_note = str(confirmation.get("proofNote", "")).strip()
        delivered_qty = confirmation.get("deliveredQuantity")

        if not receiver_name:
            raise HTTPException(status_code=400, detail="Receiver name is required before marking delivered")
        if len(proof_note) < 8:
            raise HTTPException(status_code=400, detail="Delivery proof note must be at least 8 characters")
        if delivered_qty is None or float(delivered_qty) <= 0:
            raise HTTPException(status_code=400, detail="Delivered quantity must be a positive number")

        update["deliveredAt"] = datetime.now(timezone.utc)
        update["deliveryConfirmation"] = {
            "receiverName": receiver_name,
            "proofNote": proof_note,
            "deliveredQuantity": float(delivered_qty),
        }

    await db.deliveryrequests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": update},
    )

    doc.update(update)
    return serialize_doc(doc)
