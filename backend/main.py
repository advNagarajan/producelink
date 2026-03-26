from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routes import auth, harvests, bids, delivery_requests, market, predict
from routes import notifications, ratings, chat, favorites, profile, invoice, weather, bulk_harvest, analytics
from routes import govt_prices, price_model

app = FastAPI(title="ProduceLink API")

# Note: GZIP compression can be enabled at the web server level (nginx, etc.)
# For local development, uvicorn handles basic compression

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": exc.detail},
    )


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(harvests.router, prefix="/api", tags=["harvests"])
app.include_router(bids.router, prefix="/api", tags=["bids"])
app.include_router(delivery_requests.router, prefix="/api", tags=["delivery"])
app.include_router(market.router, prefix="/api", tags=["market"])
app.include_router(predict.router, prefix="/api", tags=["predict"])
app.include_router(notifications.router, prefix="/api", tags=["notifications"])
app.include_router(ratings.router, prefix="/api", tags=["ratings"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(favorites.router, prefix="/api", tags=["favorites"])
app.include_router(profile.router, prefix="/api", tags=["profile"])
app.include_router(invoice.router, prefix="/api", tags=["invoice"])
app.include_router(weather.router, prefix="/api", tags=["weather"])
app.include_router(bulk_harvest.router, prefix="/api", tags=["bulk_harvest"])
app.include_router(analytics.router, prefix="/api", tags=["analytics"])
app.include_router(govt_prices.router, prefix="/api", tags=["govt_prices"])
app.include_router(price_model.router, prefix="/api", tags=["price_model"])


@app.get("/")
async def root():
    return {"status": "ProduceLink API is running"}
