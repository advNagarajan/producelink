from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGODB_URI

client = AsyncIOMotorClient(MONGODB_URI)

_db_name = MONGODB_URI.rsplit("/", 1)[-1].split("?")[0] if "/" in MONGODB_URI else "producelink"
if not _db_name:
    _db_name = "producelink"

db = client[_db_name]
