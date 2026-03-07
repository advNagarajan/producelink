from datetime import datetime, timedelta, timezone
import bcrypt
from jose import jwt, JWTError
from fastapi import Request, HTTPException
from config import JWT_SECRET

ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 7


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
        return {
            "id": payload["id"],
            "role": payload["role"],
            "name": payload.get("name"),
            "email": payload.get("email"),
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
