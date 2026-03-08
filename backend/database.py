from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGODB_URI

# Optimized: Configure connection pool settings for better performance
client = AsyncIOMotorClient(
    MONGODB_URI,
    maxPoolSize=50,  # Maximum number of connections in the pool
    minPoolSize=10,  # Minimum number of connections to maintain
    maxIdleTimeMS=45000,  # Close connections after 45 seconds of inactivity
    serverSelectionTimeoutMS=5000,  # Timeout for selecting a server
)

_db_name = MONGODB_URI.rsplit("/", 1)[-1].split("?")[0] if "/" in MONGODB_URI else "producelink"
if not _db_name:
    _db_name = "producelink"

db = client[_db_name]
