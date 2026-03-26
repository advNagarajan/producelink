from fastapi import APIRouter, Request, HTTPException, Query
from bson import ObjectId
import asyncio
from typing import Awaitable, Callable, cast
from database import db
from auth import get_current_user as imported_get_current_user
from utils import serialize_doc
from pagination import PaginationParams
from trust_score import compute_farmer_trust_score

router = APIRouter()
get_current_user = cast(Callable[[Request], Awaitable[dict]], imported_get_current_user)


@router.get("/market")
async def get_market(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    user = await get_current_user(request)
    if user["role"] != "mandi_owner":
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Optimized: Add pagination
    pagination = PaginationParams(page, page_size)
    
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
        {"$facet": {
            "items": [
                {"$skip": pagination.skip},
                {"$limit": pagination.limit}
            ],
            "totalCount": [
                {"$count": "count"}
            ]
        }}
    ]
    
    result = await db.harvests.aggregate(pipeline).to_list(1)
    
    if result and result[0]["items"]:
        items = [serialize_doc(h) for h in result[0]["items"]]

        farmer_ids: list[ObjectId] = []
        for h in result[0]["items"]:
            fid = h.get("farmerId", {}).get("_id") if isinstance(h.get("farmerId"), dict) else None
            if isinstance(fid, ObjectId):
                farmer_ids.append(fid)

        unique_farmer_ids = list({fid for fid in farmer_ids})
        trust_rows = await asyncio.gather(*[compute_farmer_trust_score(fid) for fid in unique_farmer_ids]) if unique_farmer_ids else []
        trust_by_farmer = {
            str(fid): trust_rows[idx]
            for idx, fid in enumerate(unique_farmer_ids)
        }

        for item in items:
            if not isinstance(item, dict):
                continue
            farmer = item.get("farmerId") or {}
            fid = str(farmer.get("_id", "")) if isinstance(farmer, dict) else ""
            item["farmerTrust"] = trust_by_farmer.get(fid, {"score": 0, "label": "Low"})

        total_count = result[0]["totalCount"][0]["count"] if result[0]["totalCount"] else 0
    else:
        items = []
        total_count = 0
    
    return pagination.paginate_response(items, total_count)
