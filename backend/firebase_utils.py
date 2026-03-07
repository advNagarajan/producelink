import asyncio
import json
import urllib.request
from config import FIREBASE_DATABASE_URL


def _broadcast_sync(harvest_id: str, bid_data: dict):
    url = f"{FIREBASE_DATABASE_URL}/latestBids/{harvest_id}.json"
    data = json.dumps(bid_data).encode()
    req = urllib.request.Request(url, data=data, method="PUT")
    req.add_header("Content-Type", "application/json")
    urllib.request.urlopen(req, timeout=5)


async def broadcast_bid(harvest_id: str, bid_data: dict):
    if not FIREBASE_DATABASE_URL:
        return
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _broadcast_sync, harvest_id, bid_data)
    except Exception as e:
        print(f"Firebase broadcast error: {e}")
