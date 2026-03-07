from fastapi import APIRouter, Request
from database import db
from auth import get_current_user
from utils import serialize_doc

router = APIRouter()


@router.get("/analytics/price-history")
async def price_history(request: Request, crop: str = ""):
    await get_current_user(request)

    match = {}
    if crop:
        match["cropType"] = {"$regex": crop, "$options": "i"}

    pipeline = [
        {"$match": {**match, "status": {"$in": ["available", "bidding", "sold"]}}},
        {"$project": {
            "cropType": 1,
            "basePrice": 1,
            "quantity": 1,
            "location": 1,
            "status": 1,
            "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$createdAt"}},
        }},
        {"$sort": {"date": 1}},
    ]
    data = await db.harvests.aggregate(pipeline).to_list(500)
    return [serialize_doc(d) for d in data]


@router.get("/analytics/crop-summary")
async def crop_summary(request: Request):
    await get_current_user(request)

    pipeline = [
        {"$group": {
            "_id": "$cropType",
            "avgPrice": {"$avg": "$basePrice"},
            "totalQty": {"$sum": "$quantity"},
            "count": {"$sum": 1},
            "minPrice": {"$min": "$basePrice"},
            "maxPrice": {"$max": "$basePrice"},
        }},
        {"$sort": {"count": -1}},
    ]
    data = await db.harvests.aggregate(pipeline).to_list(100)
    return [
        {
            "crop": d["_id"],
            "avgPrice": round(d["avgPrice"], 2),
            "totalQty": d["totalQty"],
            "count": d["count"],
            "minPrice": d["minPrice"],
            "maxPrice": d["maxPrice"],
        }
        for d in data
    ]
