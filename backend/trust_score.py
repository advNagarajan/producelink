from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId

from database import db


def _to_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


def _score_bucket(score: int) -> str:
    if score >= 85:
        return "Excellent"
    if score >= 70:
        return "Good"
    if score >= 55:
        return "Fair"
    return "Low"


async def compute_farmer_trust_score(farmer_id: ObjectId) -> dict[str, Any]:
    user = await db.users.find_one({"_id": farmer_id})
    if not user:
        return {
            "score": 0,
            "label": "Low",
            "components": {
                "onTimeDelivery": 0,
                "buyerRatings": 0,
                "disputeHistory": 0,
                "profileCompleteness": 0,
            },
            "signals": {
                "deliveryStats": {"completed": 0, "onTime": 0, "onTimeRate": 0},
                "ratings": {"avg": 0, "count": 0, "lowRatings": 0},
                "disputes": {"unresolved": 0, "resolved": 0},
                "profile": {"filled": 0, "total": 0},
            },
        }

    harvest_rows = await db.harvests.find({"farmerId": farmer_id}, {"_id": 1}).to_list(1000)
    harvest_ids = [h.get("_id") for h in harvest_rows if h.get("_id")]

    completed_deliveries = 0
    on_time_deliveries = 0
    if harvest_ids:
        deliveries = await db.deliveryrequests.find(
            {"harvestId": {"$in": harvest_ids}, "status": "delivered"}
        ).to_list(300)

        completed_deliveries = len(deliveries)
        for d in deliveries:
            start = _to_datetime(d.get("acceptedAt") or d.get("createdAt"))
            end = _to_datetime(d.get("deliveredAt") or d.get("updatedAt"))
            if not start or not end:
                continue
            elapsed_hours = (end - start).total_seconds() / 3600
            if elapsed_hours <= 72:
                on_time_deliveries += 1

    if completed_deliveries == 0:
        on_time_rate = 0.5
    else:
        on_time_rate = on_time_deliveries / completed_deliveries
    on_time_component = round(on_time_rate * 100)

    rating_summary = await db.ratings.aggregate(
        [
            {"$match": {"targetUserId": farmer_id}},
            {
                "$group": {
                    "_id": None,
                    "avg": {"$avg": "$score"},
                    "count": {"$sum": 1},
                    "lowRatings": {
                        "$sum": {
                            "$cond": [{"$lte": ["$score", 2]}, 1, 0],
                        }
                    },
                }
            },
        ]
    ).to_list(1)

    avg_rating = float(rating_summary[0].get("avg", 0)) if rating_summary else 0.0
    ratings_count = int(rating_summary[0].get("count", 0)) if rating_summary else 0
    low_ratings = int(rating_summary[0].get("lowRatings", 0)) if rating_summary else 0
    if ratings_count == 0:
        ratings_component = 60
    else:
        ratings_component = round((avg_rating / 5) * 100)

    unresolved_disputes = 0
    resolved_disputes = 0
    try:
        unresolved_disputes = await db.disputes.count_documents(
            {
                "$or": [{"farmerId": farmer_id}, {"sellerId": farmer_id}],
                "status": {"$nin": ["resolved", "closed"]},
            }
        )
        resolved_disputes = await db.disputes.count_documents(
            {
                "$or": [{"farmerId": farmer_id}, {"sellerId": farmer_id}],
                "status": {"$in": ["resolved", "closed"]},
            }
        )
    except Exception:
        unresolved_disputes = 0
        resolved_disputes = 0

    dispute_penalty = (unresolved_disputes * 22) + (resolved_disputes * 6) + (low_ratings * 8)
    dispute_component = max(0, min(100, 100 - dispute_penalty))

    profile_fields = [
        bool(user.get("name")),
        bool(user.get("email")),
        bool(user.get("farmLocation")),
        bool(user.get("phone")),
        bool(user.get("businessName")),
    ]
    profile_total = len(profile_fields)
    profile_filled = sum(1 for v in profile_fields if v)
    profile_component = round((profile_filled / profile_total) * 100) if profile_total else 0

    weighted_score = round(
        (on_time_component * 0.35)
        + (ratings_component * 0.30)
        + (dispute_component * 0.20)
        + (profile_component * 0.15)
    )
    weighted_score = max(0, min(100, weighted_score))

    return {
        "score": weighted_score,
        "label": _score_bucket(weighted_score),
        "components": {
            "onTimeDelivery": on_time_component,
            "buyerRatings": ratings_component,
            "disputeHistory": dispute_component,
            "profileCompleteness": profile_component,
        },
        "signals": {
            "deliveryStats": {
                "completed": completed_deliveries,
                "onTime": on_time_deliveries,
                "onTimeRate": round(on_time_rate * 100),
            },
            "ratings": {
                "avg": round(avg_rating, 1),
                "count": ratings_count,
                "lowRatings": low_ratings,
            },
            "disputes": {"unresolved": unresolved_disputes, "resolved": resolved_disputes},
            "profile": {"filled": profile_filled, "total": profile_total},
        },
    }