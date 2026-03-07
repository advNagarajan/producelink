from fastapi import APIRouter, Response, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from datetime import datetime, timezone
from database import db
from auth import hash_password, verify_password, create_token, get_current_user

router = APIRouter()


class RegisterBody(BaseModel):
    name: str
    email: str
    password: str
    role: str
    farmLocation: str | None = None
    businessName: str | None = None
    vehicleType: str | None = None


class LoginBody(BaseModel):
    email: str
    password: str


@router.post("/register", status_code=201)
async def register(body: RegisterBody):
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=409, detail="User already exists")

    doc = {
        "name": body.name,
        "email": body.email,
        "password": hash_password(body.password),
        "role": body.role,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }
    if body.farmLocation:
        doc["farmLocation"] = body.farmLocation
    if body.businessName:
        doc["businessName"] = body.businessName
    if body.vehicleType:
        doc["vehicleType"] = body.vehicleType

    result = await db.users.insert_one(doc)
    return {"message": "User created successfully", "userId": str(result.inserted_id)}


@router.post("/login")
async def login(body: LoginBody, response: Response):
    user = await db.users.find_one({"email": body.email})
    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token({
        "id": str(user["_id"]),
        "role": user["role"],
        "name": user["name"],
        "email": user["email"],
    })

    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=7 * 24 * 60 * 60,
    )

    return {
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
        }
    }


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("token", path="/")
    return {"message": "Logged out"}


@router.get("/me")
async def me(request: Request):
    user = await get_current_user(request)
    return user
