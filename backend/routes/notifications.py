from fastapi import APIRouter, Request
from bson import ObjectId
from datetime import datetime, timezone
from database import db
from auth import get_current_user
from utils import serialize_doc

router = APIRouter()


@router.get("/notifications")
async def get_notifications(request: Request):
    user = await get_current_user(request)
    notifications = await db.notifications.find(
        {"userId": ObjectId(user["id"])}
    ).sort("createdAt", -1).to_list(50)
    return [serialize_doc(n) for n in notifications]


@router.get("/notifications/unread-count")
async def unread_count(request: Request):
    user = await get_current_user(request)
    count = await db.notifications.count_documents(
        {"userId": ObjectId(user["id"]), "read": False}
    )
    return {"count": count}


@router.patch("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, request: Request):
    user = await get_current_user(request)
    await db.notifications.update_one(
        {"_id": ObjectId(notif_id), "userId": ObjectId(user["id"])},
        {"$set": {"read": True}},
    )
    return {"message": "Marked as read"}


@router.post("/notifications/read-all")
async def mark_all_read(request: Request):
    user = await get_current_user(request)
    await db.notifications.update_many(
        {"userId": ObjectId(user["id"]), "read": False},
        {"$set": {"read": True}},
    )
    return {"message": "All marked as read"}


async def create_notification(user_id: str, title: str, body: str, link: str = ""):
    """Helper called from other routes to push notifications."""
    await db.notifications.insert_one({
        "userId": ObjectId(user_id),
        "title": title,
        "body": body,
        "link": link,
        "read": False,
        "createdAt": datetime.now(timezone.utc),
    })
