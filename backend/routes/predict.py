import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from config import GEMINI_API_KEY

router = APIRouter()

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"


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


class PredictBody(BaseModel):
    cropType: str
    location: str


@router.post("/predict")
async def predict(body: PredictBody):
    prompt = (
        f"As an agricultural market expert in India, predict the short-term market "
        f"trend and suggested base price for {body.cropType} in {body.location}. "
        f"Keep the response concise, focusing only on the expected price trend "
        f"(up/down/stable) and a brief justification based on typical seasonal factors."
    )
    try:
        text = await _ask_gemini(prompt)
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
    prompt = (
        f"As an agricultural market expert in India, give a concise bidding recommendation "
        f"for a mandi owner looking to buy {body.quantity} kg of {body.cropType} "
        f"(Grade {body.qualityGrade}) from {body.location}. "
        f"The farmer's asking price is Rs {body.basePrice}/kg. "
        f"{'The current highest bid is Rs ' + str(body.latestBid) + '/kg. ' if body.latestBid else ''}"
        f"Suggest: (1) a fair bid price range in Rs/kg, (2) whether to bid now or wait, "
        f"(3) a one-line market context. Be very concise — 3-4 short lines max."
    )
    try:
        text = await _ask_gemini(prompt)
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
