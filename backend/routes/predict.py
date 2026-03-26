import httpx
import json
import math
import re
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from typing import Any, Awaitable, Callable, cast
from config import GEMINI_API_KEY
from database import db
from bson import ObjectId
from auth import get_current_user as imported_get_current_user
from utils import serialize_doc

router = APIRouter()

get_current_user = cast(Callable[[Request], Awaitable[dict]], imported_get_current_user)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
    "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
    "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal",
]


def _extract_state(location: str) -> str:
    parts = [p.strip() for p in location.replace("-", ",").split(",")]
    for part in reversed(parts):
        for state in INDIAN_STATES:
            if state.lower() == part.lower():
                return state
    loc_lower = location.lower()
    for state in INDIAN_STATES:
        if state.lower() in loc_lower:
            return state
    return ""


async def _get_govt_min_price_per_kg(crop_type: str, state: str) -> float | None:
    query: dict = {"commodity": {"$regex": f"^{crop_type.strip()}$", "$options": "i"}}
    if state:
        query["state"] = state

    cached = await db.govt_price_cache.find_one(query, sort=[("fetchedAt", -1)])
    if not cached:
        return None

    records = cached.get("records") or []
    min_prices = [float(r.get("minPrice", 0)) for r in records if float(r.get("minPrice", 0)) > 0]
    if not min_prices:
        return None

    # Agmarknet minPrice is per quintal; convert to per kg.
    return round(min(min_prices) / 100, 2)


async def _ask_gemini(prompt: str) -> str:
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="AI prediction service not configured")
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius * c


async def _fetch_fuel_stations(points: list[dict[str, float]], max_results: int = 8) -> list[dict[str, Any]]:
    if not points:
        return []

    stations: dict[str, dict[str, Any]] = {}
    async with httpx.AsyncClient(timeout=18) as client:
        for p in points[:5]:
            query = f"""
            [out:json][timeout:15];
            (
              node["amenity"="fuel"](around:5000,{p['lat']},{p['lng']});
              way["amenity"="fuel"](around:5000,{p['lat']},{p['lng']});
            );
            out center;
            """
            try:
                resp = await client.post(
                    "https://overpass-api.de/api/interpreter",
                    content=query,
                    headers={"Content-Type": "text/plain"},
                )
                resp.raise_for_status()
                elements = resp.json().get("elements") or []
            except Exception:
                continue

            for e in elements:
                tags = e.get("tags") or {}
                lat = e.get("lat") or (e.get("center") or {}).get("lat")
                lng = e.get("lon") or (e.get("center") or {}).get("lon")
                if lat is None or lng is None:
                    continue
                lat_f = float(lat)
                lng_f = float(lng)
                key = f"{round(lat_f, 5)}:{round(lng_f, 5)}"
                if key not in stations:
                    stations[key] = {
                        "name": tags.get("name") or "Fuel Station",
                        "brand": tags.get("brand") or "",
                        "lat": lat_f,
                        "lng": lng_f,
                    }

    first = points[0]
    ordered = sorted(
        stations.values(),
        key=lambda s: _haversine_km(first["lat"], first["lng"], s["lat"], s["lng"]),
    )
    for s in ordered:
        s["distanceFromPickupKm"] = round(
            _haversine_km(first["lat"], first["lng"], s["lat"], s["lng"]), 1
        )
    return ordered[:max_results]


def _estimate_fuel(distance_km: float, quantity_kg: float, vehicle: str) -> dict[str, Any]:
    if quantity_kg <= 300:
        mileage_kmpl = 14.0
    elif quantity_kg <= 1200:
        mileage_kmpl = 8.0
    else:
        mileage_kmpl = 4.5

    fuel_liters = round(distance_km / max(mileage_kmpl, 1.0), 2)
    buffer_liters = round(fuel_liters * 0.12, 2)
    suggested_liters = round(fuel_liters + buffer_liters, 2)
    diesel_price_per_liter = 95.0
    estimated_fuel_cost = round(suggested_liters * diesel_price_per_liter)

    return {
        "vehicleClass": vehicle,
        "assumedMileageKmpl": mileage_kmpl,
        "estimatedFuelLiters": fuel_liters,
        "safetyBufferLiters": buffer_liters,
        "suggestedFuelLiters": suggested_liters,
        "assumedDieselPricePerLiter": diesel_price_per_liter,
        "estimatedFuelCost": estimated_fuel_cost,
    }


async def _build_user_business_snapshot(user: dict[str, Any]) -> dict[str, Any]:
    uid = ObjectId(user["id"])
    role = user.get("role", "")
    snapshot: dict[str, Any] = {
        "user": {
            "id": user.get("id"),
            "name": user.get("name"),
            "role": role,
            "email": user.get("email"),
        },
        "summary": {},
        "recent": {},
    }

    if role == "farmer":
        total_harvests = await db.harvests.count_documents({"farmerId": uid})
        total_delivery_requests = await db.deliveryrequests.count_documents({"requesterId": uid})
        sold_harvests = await db.harvests.count_documents({"farmerId": uid, "status": "sold"})

        farmer_harvests = await db.harvests.find({"farmerId": uid}, {"_id": 1}).to_list(500)
        harvest_ids = [h.get("_id") for h in farmer_harvests if h.get("_id") is not None]

        total_bids_received = 0
        pending_bids = 0
        accepted_bids = 0
        rejected_bids = 0
        recent_received_bids: list[dict[str, Any]] = []

        if harvest_ids:
            total_bids_received = await db.bids.count_documents({"harvestId": {"$in": harvest_ids}})
            pending_bids = await db.bids.count_documents({"harvestId": {"$in": harvest_ids}, "status": "pending"})
            accepted_bids = await db.bids.count_documents({"harvestId": {"$in": harvest_ids}, "status": "accepted"})
            rejected_bids = await db.bids.count_documents({"harvestId": {"$in": harvest_ids}, "status": "rejected"})
            recent_received_bids = await db.bids.find({"harvestId": {"$in": harvest_ids}}).sort("createdAt", -1).limit(8).to_list(8)

        recent_harvests = await db.harvests.find({"farmerId": uid}).sort("createdAt", -1).limit(5).to_list(5)
        recent_requests = await db.deliveryrequests.find({"requesterId": uid}).sort("createdAt", -1).limit(5).to_list(5)

        snapshot["summary"] = {
            "totalHarvests": total_harvests,
            "soldHarvests": sold_harvests,
            "totalDeliveryRequests": total_delivery_requests,
            "totalBidsReceived": total_bids_received,
            "pendingBids": pending_bids,
            "acceptedBids": accepted_bids,
            "rejectedBids": rejected_bids,
        }
        snapshot["recent"] = {
            "harvests": [serialize_doc(h) for h in recent_harvests],
            "deliveryRequests": [serialize_doc(d) for d in recent_requests],
            "receivedBids": [serialize_doc(b) for b in recent_received_bids],
        }

    elif role in ["mandi", "mandi_owner"]:
        total_bids = await db.bids.count_documents({"mandiOwnerId": uid})
        accepted_bids = await db.bids.count_documents({"mandiOwnerId": uid, "status": "accepted"})
        recent_bids = await db.bids.find({"mandiOwnerId": uid}).sort("createdAt", -1).limit(8).to_list(8)

        snapshot["summary"] = {
            "totalBids": total_bids,
            "acceptedBids": accepted_bids,
        }
        snapshot["recent"] = {
            "bids": [serialize_doc(b) for b in recent_bids],
        }

    elif role == "transporter":
        total_delivery = await db.deliveryrequests.count_documents({"transporterId": uid})
        in_transit = await db.deliveryrequests.count_documents({"transporterId": uid, "status": "in_transit"})
        completed = await db.deliveryrequests.count_documents({"transporterId": uid, "status": "delivered"})
        recent_jobs = await db.deliveryrequests.find({"transporterId": uid}).sort("updatedAt", -1).limit(8).to_list(8)

        snapshot["summary"] = {
            "totalDeliveries": total_delivery,
            "inTransit": in_transit,
            "completed": completed,
        }
        snapshot["recent"] = {
            "deliveries": [serialize_doc(d) for d in recent_jobs],
        }

    else:
        snapshot["summary"] = {"note": "No role specific summary available"}

    return snapshot


def _format_next_actions(snapshot: dict[str, Any]) -> list[str]:
    summary = snapshot.get("summary") or {}
    actions: list[str] = []

    pending_bids = int(summary.get("pendingBids", 0) or 0)
    sold_harvests = int(summary.get("soldHarvests", 0) or 0)
    total_harvests = int(summary.get("totalHarvests", 0) or 0)
    total_delivery_requests = int(summary.get("totalDeliveryRequests", 0) or 0)

    if pending_bids > 0:
        actions.append(f"Review and respond to {pending_bids} pending bids first to avoid stale offers.")
    if total_harvests == 0:
        actions.append("List your first harvest with quantity, grade, and location to start receiving bids.")
    if total_harvests > 0 and sold_harvests == 0:
        actions.append("Lower or adjust price on non-moving listings and request AI price hints before relisting.")
    if sold_harvests > 0 and total_delivery_requests < sold_harvests:
        actions.append("Create delivery requests for sold harvests that are not yet assigned for transport.")
    if not actions:
        actions.append("Monitor new bids every few hours and keep listings fresh with updated prices.")

    return actions[:3]


async def _compute_farmer_demand_forecasts(user: dict[str, Any], max_items: int = 5) -> list[dict[str, Any]]:
    uid = ObjectId(user["id"])
    now = datetime.now(timezone.utc)
    recent_cutoff = now.replace(microsecond=0) - timedelta(days=14)
    prior_cutoff = recent_cutoff - timedelta(days=14)

    farmer_state = _extract_state(str(user.get("farmLocation", "")))
    if not farmer_state:
        latest_harvest = await db.harvests.find_one({"farmerId": uid}, sort=[("createdAt", -1)])
        if latest_harvest:
            farmer_state = _extract_state(str(latest_harvest.get("location", "")))

    harvest_match: dict[str, Any] = {"createdAt": {"$gte": prior_cutoff}}
    if farmer_state:
        harvest_match["location"] = {"$regex": re.escape(farmer_state), "$options": "i"}

    harvest_signal_rows = await db.harvests.aggregate(
        [
            {"$match": harvest_match},
            {
                "$group": {
                    "_id": {"cropType": "$cropType", "qualityGrade": "$qualityGrade"},
                    "recentListings": {
                        "$sum": {
                            "$cond": [{"$gte": ["$createdAt", recent_cutoff]}, 1, 0],
                        }
                    },
                    "priorListings": {
                        "$sum": {
                            "$cond": [{"$lt": ["$createdAt", recent_cutoff]}, 1, 0],
                        }
                    },
                    "avgBasePrice": {"$avg": "$basePrice"},
                }
            },
        ]
    ).to_list(200)

    bid_match: dict[str, Any] = {"createdAt": {"$gte": prior_cutoff}}
    bid_pipeline: list[dict[str, Any]] = [
        {"$match": bid_match},
        {
            "$lookup": {
                "from": "harvests",
                "localField": "harvestId",
                "foreignField": "_id",
                "as": "_h",
            }
        },
        {"$addFields": {"harvest": {"$arrayElemAt": ["$_h", 0]}}},
    ]
    if farmer_state:
        bid_pipeline.append({"$match": {"harvest.location": {"$regex": re.escape(farmer_state), "$options": "i"}}})
    bid_pipeline.extend(
        [
            {
                "$group": {
                    "_id": {
                        "cropType": "$harvest.cropType",
                        "qualityGrade": "$harvest.qualityGrade",
                    },
                    "recentBids": {
                        "$sum": {
                            "$cond": [{"$gte": ["$createdAt", recent_cutoff]}, 1, 0],
                        }
                    },
                    "priorBids": {
                        "$sum": {
                            "$cond": [{"$lt": ["$createdAt", recent_cutoff]}, 1, 0],
                        }
                    },
                    "recentAccepted": {
                        "$sum": {
                            "$cond": [
                                {
                                    "$and": [
                                        {"$gte": ["$createdAt", recent_cutoff]},
                                        {"$eq": ["$status", "accepted"]},
                                    ]
                                },
                                1,
                                0,
                            ]
                        }
                    },
                }
            },
        ]
    )
    bid_signal_rows = await db.bids.aggregate(bid_pipeline).to_list(200)

    bid_lookup: dict[str, dict[str, Any]] = {}
    for row in bid_signal_rows:
        key = f"{str(row['_id'].get('cropType', '')).lower()}::{str(row['_id'].get('qualityGrade', '')).upper()}"
        bid_lookup[key] = row

    alerts: list[dict[str, Any]] = []
    for row in harvest_signal_rows:
        crop_type = str(row["_id"].get("cropType", "")).strip()
        grade = str(row["_id"].get("qualityGrade", "")).strip().upper() or "A"
        if not crop_type:
            continue

        key = f"{crop_type.lower()}::{grade}"
        bid_row = bid_lookup.get(key, {})

        recent_listings = int(row.get("recentListings", 0) or 0)
        prior_listings = int(row.get("priorListings", 0) or 0)
        recent_bids = int(bid_row.get("recentBids", 0) or 0)
        prior_bids = int(bid_row.get("priorBids", 0) or 0)
        recent_accepted = int(bid_row.get("recentAccepted", 0) or 0)

        bid_pressure = recent_bids / max(recent_listings, 1)
        bid_growth = ((recent_bids + 1) / (prior_bids + 1)) - 1
        accepted_rate = recent_accepted / max(recent_bids, 1)
        listing_change = ((recent_listings + 1) / (prior_listings + 1)) - 1

        demand_score = (
            min(bid_pressure, 4) * 18
            + max(min(bid_growth, 1.5), -0.5) * 20
            + accepted_rate * 25
            + max(min(listing_change, 1.0), -0.5) * 10
        )
        demand_score = max(0, min(100, round(demand_score)))

        if demand_score >= 75:
            level = "very_high"
            action = "Prioritize listing this crop in the next 7 days and keep Grade details prominent."
        elif demand_score >= 58:
            level = "high"
            action = "List in the next 1-2 weeks and monitor top bids daily for fast acceptance."
        elif demand_score >= 42:
            level = "medium"
            action = "Prepare inventory and watch demand movement before locking price."
        else:
            level = "watchlist"
            action = "Demand is still forming. Keep this as a backup crop-grade option."

        if level == "watchlist":
            continue

        confidence = min(95, max(45, 45 + (recent_bids * 5) + (recent_listings * 3)))

        alerts.append(
            {
                "cropType": crop_type,
                "qualityGrade": grade,
                "nearbyState": farmer_state or "Your region",
                "demandLevel": level,
                "confidence": confidence,
                "demandScore": demand_score,
                "signals": {
                    "recentListings": recent_listings,
                    "recentBids": recent_bids,
                    "acceptedBids": recent_accepted,
                    "avgBasePrice": round(float(row.get("avgBasePrice", 0) or 0), 1),
                },
                "why": f"{recent_bids} recent bids across {recent_listings} listings with {recent_accepted} accepted bids.",
                "recommendedAction": action,
            }
        )

    alerts.sort(key=lambda a: (a.get("demandScore", 0), a.get("confidence", 0)), reverse=True)
    return alerts[:max_items]


async def _push_demand_alert_notifications(user_id: str, alerts: list[dict[str, Any]]) -> None:
    if not alerts:
        return

    now = datetime.now(timezone.utc)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    uid = ObjectId(user_id)

    for a in alerts:
        crop = a.get("cropType", "Produce")
        grade = a.get("qualityGrade", "A")
        level = str(a.get("demandLevel", "")).replace("_", " ").title()
        key = f"demand::{crop.lower()}::{grade}::{now.date().isoformat()}"

        existing = await db.notifications.find_one(
            {
                "userId": uid,
                "metaKey": key,
                "createdAt": {"$gte": start_of_day},
            }
        )
        if existing:
            continue

        await db.notifications.insert_one(
            {
                "userId": uid,
                "title": f"Demand Alert: {crop} Grade {grade}",
                "body": f"{level} demand expected in {a.get('nearbyState', 'nearby markets')}. {a.get('recommendedAction', '')}",
                "link": "/dashboard/farmer",
                "read": False,
                "metaKey": key,
                "createdAt": now,
            }
        )


async def _try_structured_assistant_answer(
    question: str,
    snapshot: dict[str, Any],
    user: dict[str, Any],
) -> str | None:
    q = question.lower().strip()
    role = str(user.get("role", ""))
    summary = snapshot.get("summary") or {}

    if role == "farmer" and ("how many bids" in q or ("bids" in q and ("count" in q or "total" in q))):
        total = int(summary.get("totalBidsReceived", 0) or 0)
        pending = int(summary.get("pendingBids", 0) or 0)
        accepted = int(summary.get("acceptedBids", 0) or 0)
        rejected = int(summary.get("rejectedBids", 0) or 0)
        return (
            f"You have {total} total bids received.\n"
            f"- Pending: {pending}\n"
            f"- Accepted: {accepted}\n"
            f"- Rejected: {rejected}"
        )

    if role == "farmer" and ("how many listings" in q or "total listings" in q or "harvests" in q):
        total = int(summary.get("totalHarvests", 0) or 0)
        sold = int(summary.get("soldHarvests", 0) or 0)
        return (
            f"You currently have {total} listings in total.\n"
            f"- Sold: {sold}\n"
            f"- Open listings: {max(total - sold, 0)}"
        )

    if role == "farmer" and ("delivery" in q or "deliveries" in q):
        total = int(summary.get("totalDeliveryRequests", 0) or 0)
        return f"You have {total} delivery requests linked to your operations."

    if role == "farmer" and ("next best" in q or "focus" in q or "what should i do" in q):
        actions = _format_next_actions(snapshot)
        return "Next best actions:\n" + "\n".join([f"- {a}" for a in actions])

    if role == "farmer" and ("demand" in q or "forecast" in q or "alert" in q):
        alerts = await _compute_farmer_demand_forecasts(user, max_items=3)
        if not alerts:
            return "I do not see strong demand spikes in nearby markets right now. Keep monitoring daily bid activity before changing prices."
        lines = ["Top demand forecast alerts for upcoming weeks:"]
        for a in alerts:
            lines.append(
                f"- {a['cropType']} Grade {a['qualityGrade']} in {a['nearbyState']}: {a['demandLevel'].replace('_', ' ').title()} demand ({a['confidence']}% confidence)."
            )
        return "\n".join(lines)

    return None


async def _get_assistant_history(uid: ObjectId, limit: int = 12) -> list[dict[str, Any]]:
    rows = await db.ai_assistant_messages.find({"userId": uid}).sort("createdAt", -1).limit(limit).to_list(limit)
    rows.reverse()
    normalized: list[dict[str, Any]] = []
    for r in rows:
        normalized.append(
            {
                "role": r.get("role", "assistant"),
                "text": r.get("text", ""),
                "createdAt": (r.get("createdAt") or datetime.now(timezone.utc)).isoformat(),
            }
        )
    return normalized

async def _geocode_location(location: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": location,
                "format": "jsonv2",
                "limit": 1,
                "countrycodes": "in",
            },
            headers={"User-Agent": "ProduceLink/1.0 (route-optimizer)"},
        )
        resp.raise_for_status()
        data = resp.json()
        if not data:
            raise HTTPException(status_code=404, detail=f"Could not geocode location: {location}")
        first = data[0]
        return {
            "lat": float(first["lat"]),
            "lng": float(first["lon"]),
            "label": first.get("display_name", location),
        }

async def _get_route_osrm(start: dict[str, Any], end: dict[str, Any]) -> dict[str, Any]:
    coordinates = f"{start['lng']},{start['lat']};{end['lng']},{end['lat']}"
    async with httpx.AsyncClient(timeout=25) as client:
        resp = await client.get(
            f"https://router.project-osrm.org/route/v1/driving/{coordinates}",
            params={
                "overview": "full",
                "geometries": "geojson",
                "steps": "true",
                "alternatives": "false",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        routes = data.get("routes") or []
        if not routes:
            raise HTTPException(status_code=404, detail="No drivable route found for these locations")
        route = routes[0]
        geometry = route.get("geometry", {}).get("coordinates", [])
        route_points = [{"lat": c[1], "lng": c[0]} for c in geometry]

        steps = ((route.get("legs") or [{}])[0].get("steps") or [])
        checkpoints: list[dict[str, Any]] = []
        for idx, step in enumerate(steps):
            if idx % 5 != 0:
                continue
            loc = (step.get("maneuver") or {}).get("location")
            if not loc or len(loc) < 2:
                continue
            checkpoints.append(
                {
                    "lat": float(loc[1]),
                    "lng": float(loc[0]),
                    "label": step.get("name") or f"Checkpoint {len(checkpoints) + 1}",
                }
            )
            if len(checkpoints) >= 4:
                break

        return {
            "distanceKm": round(float(route.get("distance", 0)) / 1000, 1),
            "durationMinutes": round(float(route.get("duration", 0)) / 60),
            "routePath": route_points,
            "checkpoints": checkpoints,
        }


class PredictBody(BaseModel):
    cropType: str
    location: str


@router.post("/predict")
async def predict(body: PredictBody):
    state = _extract_state(body.location)
    govt_min = await _get_govt_min_price_per_kg(body.cropType, state)

    prompt = (
        f"As an agricultural market expert in India, predict the short-term market "
        f"trend and suggested base price for {body.cropType} in {body.location}. "
        f"Keep the response concise, focusing only on the expected price trend "
        f"(up/down/stable) and a brief justification based on typical seasonal factors."
    )
    if govt_min is not None:
        prompt += (
            f" IMPORTANT: Current government mandi minimum reference in {state or 'this region'} "
            f"is about Rs {govt_min}/kg. Do not suggest any base price below this threshold."
        )
    try:
        text = await _ask_gemini(prompt)
        if govt_min is not None:
            text += (
                f"\nGovt floor ({state or 'regional'}): Min Rs {govt_min}/kg. "
                f"Do not list below this reference."
            )
        return {"prediction": text}
    except Exception as e:
        print(f"Gemini API Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate market prediction")


class BidAdviceBody(BaseModel):
    cropType: str
    location: str
    quantity: float
    basePrice: float
    qualityGrade: str
    latestBid: float | None = None


@router.post("/predict/bid-advice")
async def bid_advice(body: BidAdviceBody):
    state = _extract_state(body.location)
    govt_min = await _get_govt_min_price_per_kg(body.cropType, state)

    quality_mult = {"A": 1.03, "B": 1.01, "C": 1.00, "D": 0.98}.get(body.qualityGrade.upper(), 1.00)
    floor = round((govt_min or 0) * quality_mult, 2) if govt_min else 0.0

    latest_bid = body.latestBid if body.latestBid is not None and body.latestBid > 0 else 0.0
    # Active threshold for a valid next bid.
    min_valid_bid = max(body.basePrice, latest_bid, floor)

    anchor = max(body.basePrice * 0.98, floor)
    low = round(max(anchor - 0.5, min_valid_bid), 1)
    high = round(max(anchor + 0.7, low + 0.4), 1)

    if latest_bid > 0:
        low = round(max(low, latest_bid + 0.2, min_valid_bid), 1)
        high = round(max(high, low + 0.5), 1)

    should_bid_now = (body.latestBid is None) or (body.latestBid < body.basePrice)
    timing = "Bid now" if should_bid_now else "Wait briefly for pullback"

    govt_line = (
        f"4. Govt floor ({state or 'regional'}): Min Rs {round(govt_min, 1)}/kg"
        if govt_min is not None else
        "4. Govt floor: Not available for this crop/state in cache"
    )

    try:
        text = (
            f"1. Fair Bid Price Range: Rs {low} - {high}/kg\n"
            f"2. Bid Now or Wait: {timing}.\n"
            f"3. Market Context: Asking price is {'near' if abs(body.basePrice - anchor) <= 1 else 'above'} the local fair zone; keep margin discipline.\n"
            f"{govt_line}"
        )
        return {"advice": text}
    except Exception as e:
        print(f"Gemini Bid Advice Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate bid advice")


class RouteAdviceBody(BaseModel):
    cropType: str
    quantity: float
    pickupLocation: str
    dropoffLocation: str


@router.post("/predict/route-advice")
async def route_advice(body: RouteAdviceBody):
    prompt = (
        f"As a logistics expert for agricultural transport in India, give a concise advisory "
        f"for transporting {body.quantity} kg of {body.cropType} "
        f"from {body.pickupLocation} to {body.dropoffLocation}. "
        f"Include: (1) estimated distance and travel time, (2) best vehicle type for the load, "
        f"(3) handling tips for this produce (temperature, stacking, spoilage risk), "
        f"(4) approximate transport cost range. Be very concise — 4-5 short lines max."
    )
    try:
        text = await _ask_gemini(prompt)
        return {"advice": text}
    except Exception as e:
        print(f"Gemini Route Advice Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate route advice")

class RouteOptimizeBody(BaseModel):
    cropType: str
    quantity: float
    pickupLocation: str
    dropoffLocation: str

@router.post("/predict/route-optimization")
async def route_optimization(body: RouteOptimizeBody):
    try:
        pickup = await _geocode_location(body.pickupLocation)
        dropoff = await _geocode_location(body.dropoffLocation)
        route = await _get_route_osrm(pickup, dropoff)

        distance_km = route["distanceKm"]
        duration_min = route["durationMinutes"]
        base_min = distance_km * 18
        base_max = distance_km * 28
        load_surcharge = max(0.0, body.quantity - 100) * 0.8
        cost_min = round(base_min + load_surcharge)
        cost_max = round(base_max + load_surcharge)

        if body.quantity <= 300:
            vehicle = "Light Commercial Vehicle (pickup/mini truck)"
        elif body.quantity <= 1200:
            vehicle = "Medium Truck (14-17 ft)"
        else:
            vehicle = "Heavy Truck with reinforced stacking"

        fuel_plan = _estimate_fuel(distance_km, body.quantity, vehicle)

        route_points = [
            {"lat": pickup["lat"], "lng": pickup["lng"]},
            *[{"lat": p["lat"], "lng": p["lng"]} for p in route["checkpoints"][:3]],
            {"lat": dropoff["lat"], "lng": dropoff["lng"]},
        ]
        fuel_stations = await _fetch_fuel_stations(route_points)

        prompt = (
            f"Provide an actionable logistics plan for transporting {body.quantity} kg of {body.cropType} "
            f"from {body.pickupLocation} to {body.dropoffLocation}. "
            f"Route stats: {distance_km} km, {duration_min} minutes. "
            f"Return exactly 3 short lines: "
            f"1) best travel window and traffic risk, "
            f"2) cargo handling risk + mitigation, "
            f"3) contingency tip if delay happens."
        )
        strategy = await _ask_gemini(prompt)

        return {
            "pickup": pickup,
            "dropoff": dropoff,
            "distanceKm": distance_km,
            "durationMinutes": duration_min,
            "routePath": route["routePath"],
            "checkpoints": route["checkpoints"],
            "vehicleRecommendation": vehicle,
            "estimatedCost": {
                "currency": "INR",
                "min": cost_min,
                "max": cost_max,
            },
            "fuelPlan": fuel_plan,
            "fuelStations": fuel_stations,
            "strategy": strategy,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Route optimization error: {e}")
        raise HTTPException(status_code=500, detail="Failed to optimize route")


class AssistantQuestionBody(BaseModel):
    question: str


@router.get("/predict/demand-forecast-alerts")
async def demand_forecast_alerts(
    request: Request,
    max_items: int = Query(5, ge=1, le=10),
    push_notifications: bool = Query(True),
):
    user = await get_current_user(request)
    if user.get("role") != "farmer":
        raise HTTPException(status_code=401, detail="Only farmers can access demand forecast alerts")

    alerts = await _compute_farmer_demand_forecasts(user, max_items=max_items)
    if push_notifications:
        await _push_demand_alert_notifications(user["id"], alerts)

    return {
        "alerts": alerts,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/predict/user-assistant/history")
async def user_assistant_history(request: Request, limit: int = Query(20, ge=1, le=100)):
    user = await get_current_user(request)
    uid = ObjectId(user["id"])
    history = await _get_assistant_history(uid, limit)
    return {"messages": history}


@router.post("/predict/user-assistant")
async def user_assistant(body: AssistantQuestionBody, request: Request):
    user = await get_current_user(request)
    question = (body.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    uid = ObjectId(user["id"])
    now = datetime.now(timezone.utc)

    await db.ai_assistant_messages.insert_one(
        {
            "userId": uid,
            "role": "user",
            "text": question,
            "createdAt": now,
        }
    )

    snapshot = await _build_user_business_snapshot(user)
    history = await _get_assistant_history(uid, 12)
    history_lines = "\n".join([f"{m['role'].upper()}: {m['text']}" for m in history])

    structured_answer = await _try_structured_assistant_answer(question, snapshot, user)
    if structured_answer:
        await db.ai_assistant_messages.insert_one(
            {
                "userId": uid,
                "role": "assistant",
                "text": structured_answer,
                "createdAt": datetime.now(timezone.utc),
            }
        )
        return {
            "answer": structured_answer,
            "contextSummary": snapshot.get("summary", {}),
        }

    prompt = (
        "You are ProduceLink AI Operations Assistant.\n"
        "Rules:\n"
        "1) Answer only using the provided business data context and chat history.\n"
        "2) If data is missing, explicitly say what is missing.\n"
        "3) Keep answer practical and action-oriented for the user role.\n"
        "4) Use short bullets when helpful.\n\n"
        f"USER QUESTION:\n{question}\n\n"
        f"USER BUSINESS CONTEXT JSON:\n{json.dumps(snapshot, default=str)}\n\n"
        f"RECENT CHAT HISTORY:\n{history_lines}"
    )

    try:
        answer = await _ask_gemini(prompt)
    except Exception as e:
        print(f"Gemini User Assistant Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate assistant response")

    await db.ai_assistant_messages.insert_one(
        {
            "userId": uid,
            "role": "assistant",
            "text": answer,
            "createdAt": datetime.now(timezone.utc),
        }
    )

    return {
        "answer": answer,
        "contextSummary": snapshot.get("summary", {}),
    }
