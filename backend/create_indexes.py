"""
Database index creation for ProduceLink
Run this once to create indexes for optimal query performance
"""
from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGODB_URI
import asyncio

async def create_indexes():
    """Create all necessary indexes"""
    client = AsyncIOMotorClient(MONGODB_URI)
    db_name = MONGODB_URI.rsplit("/", 1)[-1].split("?")[0] if "/" in MONGODB_URI else "producelink"
    if not db_name:
        db_name = "producelink"
    
    db = client[db_name]
    
    print("🔧 Creating database indexes...")
    
    # Users collection indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("role")
    print("✅ Users indexes created")
    
    # Harvests collection indexes
    await db.harvests.create_index("farmerId")
    await db.harvests.create_index("status")
    await db.harvests.create_index([("createdAt", -1)])
    await db.harvests.create_index([("status", 1), ("createdAt", -1)])
    print("✅ Harvests indexes created")
    
    # Bids collection indexes
    await db.bids.create_index("harvestId")
    await db.bids.create_index("mandiOwnerId")
    await db.bids.create_index("status")
    await db.bids.create_index([("harvestId", 1), ("status", 1)])
    await db.bids.create_index([("harvestId", 1), ("amount", -1)])
    print("✅ Bids indexes created")
    
    # Delivery requests collection indexes
    await db.deliveryrequests.create_index("harvestId")
    await db.deliveryrequests.create_index("transporterId")
    await db.deliveryrequests.create_index("status")
    await db.deliveryrequests.create_index([("status", 1), ("createdAt", -1)])
    print("✅ Delivery requests indexes created")
    
    # Notifications collection indexes
    await db.notifications.create_index("userId")
    await db.notifications.create_index([("userId", 1), ("read", 1)])
    await db.notifications.create_index([("userId", 1), ("createdAt", -1)])
    print("✅ Notifications indexes created")
    
    # Ratings collection indexes
    await db.ratings.create_index("targetUserId")
    await db.ratings.create_index("reviewerId")
    await db.ratings.create_index("deliveryRequestId", unique=True)
    print("✅ Ratings indexes created")
    
    # Favorites collection indexes
    await db.favorites.create_index([("userId", 1), ("harvestId", 1)], unique=True)
    await db.favorites.create_index("userId")
    print("✅ Favorites indexes created")
    
    # Chat messages collection indexes
    await db.messages.create_index([("conversationId", 1), ("timestamp", 1)])
    await db.messages.create_index("senderId")
    await db.messages.create_index("receiverId")
    print("✅ Messages indexes created")
    
    print("\n✨ All indexes created successfully!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_indexes())
