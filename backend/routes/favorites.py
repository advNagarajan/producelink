from fastapi import APIRouter, Request
from bson import ObjectId
from datetime import datetime, timezone
from database import db
from auth import get_current_user
from utils import serialize_doc

router = APIRouter()


@router.get("/favorites")
async def get_favorites(request: Request):
    user = await get_current_user(request)
    favs = await db.favorites.find(
        {"userId": ObjectId(user["id"])}
    ).sort("createdAt", -1).to_list(100)

    ids = [f["targetId"] for f in favs]
    if not ids:
        return []

    # resolve target names
    users = await db.users.find(
        {"_id": {"$in": ids}},
        {"name": 1, "role": 1, "farmLocation": 1, "businessName": 1},
    ).to_list(100)
    user_map = {str(u["_id"]): serialize_doc(u) for u in users}

    result = []
    for f in favs:
        data = serialize_doc(f)
        data["target"] = user_map.get(str(f["targetId"]))
        result.append(data)
    return result


@router.post("/favorites/{target_id}")
async def toggle_favorite(target_id: str, request: Request):
    user = await get_current_user(request)
    uid = ObjectId(user["id"])
    tid = ObjectId(target_id)

    existing = await db.favorites.find_one({"userId": uid, "targetId": tid})
    if existing:
        await db.favorites.delete_one({"_id": existing["_id"]})
        return {"favorited": False}
    else:
        await db.favorites.insert_one({
            "userId": uid,
            "targetId": tid,
            "createdAt": datetime.now(timezone.utc),
        })
        return {"favorited": True}


@router.get("/favorites/check/{target_id}")
async def check_favorite(target_id: str, request: Request):
    user = await get_current_user(request)
    existing = await db.favorites.find_one({
        "userId": ObjectId(user["id"]),
        "targetId": ObjectId(target_id),
    })
    return {"favorited": existing is not None}
