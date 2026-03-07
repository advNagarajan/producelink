from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime, timezone
from database import db
from auth import get_current_user
from utils import serialize_doc

router = APIRouter()


class MessageBody(BaseModel):
    receiverId: str
    text: str


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
    return [serialize_doc(c) for c in convos]


@router.get("/chat/messages/{other_id}")
async def get_messages(other_id: str, request: Request):
    user = await get_current_user(request)
    uid = ObjectId(user["id"])
    oid = ObjectId(other_id)

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

    return [serialize_doc(m) for m in messages]


@router.post("/chat/messages", status_code=201)
async def send_message(body: MessageBody, request: Request):
    user = await get_current_user(request)
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    doc = {
        "senderId": ObjectId(user["id"]),
        "receiverId": ObjectId(body.receiverId),
        "text": body.text.strip(),
        "read": False,
        "createdAt": datetime.now(timezone.utc),
    }
    result = await db.messages.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)
