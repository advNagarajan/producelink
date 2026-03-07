import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from config import GEMINI_API_KEY

router = APIRouter()


class PredictBody(BaseModel):
    cropType: str
    location: str


@router.post("/predict")
async def predict(body: PredictBody):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="AI prediction service not configured")

    import google.generativeai as genai

    genai.configure(api_key=GEMINI_API_KEY)

    prompt = (
        f"As an agricultural market expert in India, predict the short-term market "
        f"trend and suggested base price for {body.cropType} in {body.location}. "
        f"Keep the response concise, focusing only on the expected price trend "
        f"(up/down/stable) and a brief justification based on typical seasonal factors."
    )

    def generate():
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        return response.text

    try:
        text = await asyncio.get_event_loop().run_in_executor(None, generate)
        return {"prediction": text}
    except Exception as e:
        print(f"Gemini API Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate market prediction")
