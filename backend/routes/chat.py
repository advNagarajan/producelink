from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional
from database import db
from auth import get_current_user
from utils import serialize_doc

router = APIRouter()


class MessageBody(BaseModel):
    receiverId: Optional[str] = None
    text: Optional[str] = None
    toUser: Optional[str] = None
    body: Optional[str] = None


@router.get("/chat/conversations")
async def get_conversations(request: Request):
    user = await get_current_user(request)
    uid = ObjectId(user["id"])

    pipeline = [
        {"$match": {"$or": [{"senderId": uid}, {"receiverId": uid}]}},
        {"$sort": {"createdAt": -1}},
        {"$group": {
            "_id": {
                "$cond": [{"$eq": ["$senderId", uid]}, "$receiverId", "$senderId"]
            },
            "lastMessage": {"$first": "$text"},
            "lastAt": {"$first": "$createdAt"},
            "unread": {
                "$sum": {
                    "$cond": [
                        {"$and": [
                            {"$eq": ["$receiverId", uid]},
                            {"$eq": ["$read", False]},
                        ]},
                        1, 0,
                    ]
                },
            },
        }},
        {"$lookup": {
            "from": "users",
            "localField": "_id",
            "foreignField": "_id",
            "pipeline": [{"$project": {"name": 1, "role": 1}}],
            "as": "_u",
        }},
        {"$addFields": {"user": {"$arrayElemAt": ["$_u", 0]}}},
        {"$project": {"_u": 0}},
        {"$sort": {"lastAt": -1}},
    ]
    convos = await db.messages.aggregate(pipeline).to_list(50)

    normalized = []
    for c in convos:
        s = serialize_doc(c)
        normalized.append(
            {
                "userId": s.get("_id"),
                "userName": (s.get("user") or {}).get("name", "User"),
                "lastMessage": s.get("lastMessage", ""),
                "lastTime": s.get("lastAt") or datetime.now(timezone.utc).isoformat(),
                "unread": int(s.get("unread", 0) or 0),
            }
        )
    return normalized


@router.get("/chat/users/{user_id}")
async def get_chat_user(user_id: str, request: Request):
    await get_current_user(request)
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")

    user = await db.users.find_one(
        {"_id": oid},
        {"name": 1, "role": 1, "email": 1},
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    u = serialize_doc(user)
    return {
        "id": u.get("_id"),
        "name": u.get("name", "User"),
        "role": u.get("role", ""),
    }


@router.get("/chat/users")
async def list_chat_users(
    request: Request,
    q: str = Query("", description="Search by name/email"),
    role: str = Query("", description="Role filter: farmer/mandi/transporter"),
):
    user = await get_current_user(request)
    current_uid = ObjectId(user["id"])

    query: dict = {"_id": {"$ne": current_uid}}
    if role:
        query["role"] = role
    if q.strip():
        query["$or"] = [
            {"name": {"$regex": q.strip(), "$options": "i"}},
            {"email": {"$regex": q.strip(), "$options": "i"}},
        ]

    users = await db.users.find(query, {"name": 1, "role": 1}).sort("name", 1).limit(25).to_list(25)
    return [
        {
            "id": str(u["_id"]),
            "name": u.get("name", "User"),
            "role": u.get("role", ""),
        }
        for u in users
    ]


@router.get("/chat/messages/{other_id}")
async def get_messages(other_id: str, request: Request):
    user = await get_current_user(request)
    try:
        uid = ObjectId(user["id"])
        oid = ObjectId(other_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")

    messages = await db.messages.find({
        "$or": [
            {"senderId": uid, "receiverId": oid},
            {"senderId": oid, "receiverId": uid},
        ]
    }).sort("createdAt", 1).to_list(200)

    # mark as read
    await db.messages.update_many(
        {"senderId": oid, "receiverId": uid, "read": False},
        {"$set": {"read": True}},
    )

    normalized = []
    for m in messages:
        s = serialize_doc(m)
        normalized.append(
            {
                "_id": s.get("_id"),
                "fromUser": s.get("senderId"),
                "toUser": s.get("receiverId"),
                "body": s.get("text", ""),
                "createdAt": s.get("createdAt"),
            }
        )
    return normalized


@router.post("/chat/messages", status_code=201)
async def send_message(body: MessageBody, request: Request):
    user = await get_current_user(request)
    receiver_id = body.receiverId or body.toUser
    text = body.text or body.body

    if not receiver_id:
        raise HTTPException(status_code=400, detail="receiverId is required")
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        receiver_oid = ObjectId(receiver_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid receiver id")

    doc = {
        "senderId": ObjectId(user["id"]),
        "receiverId": receiver_oid,
        "text": text.strip(),
        "read": False,
        "createdAt": datetime.now(timezone.utc),
    }
    result = await db.messages.insert_one(doc)
    doc["_id"] = result.inserted_id
    s = serialize_doc(doc)
    return {
        "_id": s.get("_id"),
        "fromUser": s.get("senderId"),
        "toUser": s.get("receiverId"),
        "body": s.get("text", ""),
        "createdAt": s.get("createdAt"),
    }
