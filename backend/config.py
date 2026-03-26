import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / ".env.local"
load_dotenv(env_path)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/producelink")
JWT_SECRET = os.getenv("NEXTAUTH_SECRET", "producelink-dev-secret")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
FIREBASE_DATABASE_URL = os.getenv("NEXT_PUBLIC_FIREBASE_DATABASE_URL", "")
DATA_GOV_API_KEY = os.getenv("DATA_GOV_API_KEY", "")
