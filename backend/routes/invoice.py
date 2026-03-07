from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from database import db
from auth import get_current_user
from utils import serialize_doc

router = APIRouter()


@router.get("/invoice/{delivery_id}")
async def get_invoice(delivery_id: str, request: Request):
    user = await get_current_user(request)

    delivery = await db.deliveryrequests.find_one({"_id": ObjectId(delivery_id)})
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if delivery["status"] != "delivered":
        raise HTTPException(status_code=400, detail="Invoice only available for completed deliveries")

    harvest = await db.harvests.find_one({"_id": delivery["harvestId"]})
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest not found")

    # Find the accepted bid to get price info
    bid = await db.bids.find_one({
        "harvestId": harvest["_id"],
        "status": "accepted",
    })

    farmer = await db.users.find_one({"_id": harvest["farmerId"]}, {"name": 1, "email": 1, "farmLocation": 1})
    buyer = None
    if bid:
        buyer = await db.users.find_one({"_id": bid["mandiOwnerId"]}, {"name": 1, "email": 1, "businessName": 1})

    transporter = None
    if delivery.get("transporterId"):
        transporter = await db.users.find_one({"_id": delivery["transporterId"]}, {"name": 1, "email": 1})

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
        "farmer": serialize_doc(farmer) if farmer else None,
        "buyer": serialize_doc(buyer) if buyer else None,
        "transporter": serialize_doc(transporter) if transporter else None,
    }
