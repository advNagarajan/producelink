from fastapi import APIRouter, Request, HTTPException, Query
from bson import ObjectId
from database import db
from auth import get_current_user
from utils import serialize_doc
from pagination import PaginationParams

router = APIRouter()


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
        total_count = result[0]["totalCount"][0]["count"] if result[0]["totalCount"] else 0
    else:
        items = []
        total_count = 0
    
    return pagination.paginate_response(items, total_count)
