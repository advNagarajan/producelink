import os
from fastapi import APIRouter, Request, HTTPException
import httpx
from auth import get_current_user

router = APIRouter()

WEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
BASE_URL = "https://api.openweathermap.org/data/2.5"


@router.get("/weather")
async def get_weather(location: str, request: Request):
    await get_current_user(request)

    if not WEATHER_API_KEY:
        raise HTTPException(status_code=500, detail="Weather API not configured")

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{BASE_URL}/weather",
            params={"q": location, "appid": WEATHER_API_KEY, "units": "metric"},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Weather API error")
        current = resp.json()

        forecast_resp = await client.get(
            f"{BASE_URL}/forecast",
            params={"q": location, "appid": WEATHER_API_KEY, "units": "metric", "cnt": 8},
        )
        forecast = forecast_resp.json() if forecast_resp.status_code == 200 else None

    return {
        "current": {
            "temp": current["main"]["temp"],
            "feels_like": current["main"]["feels_like"],
            "humidity": current["main"]["humidity"],
            "description": current["weather"][0]["description"],
            "icon": current["weather"][0]["icon"],
            "wind_speed": current["wind"]["speed"],
            "city": current["name"],
        },
        "forecast": [
            {
                "dt": item["dt_txt"],
                "temp": item["main"]["temp"],
                "description": item["weather"][0]["description"],
                "icon": item["weather"][0]["icon"],
            }
            for item in (forecast.get("list", []) if forecast else [])
        ],
    }
