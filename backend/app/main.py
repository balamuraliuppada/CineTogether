from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.rooms import router as rooms_router
from app.core.config import settings
from app.websocket.handler import router as ws_router

app = FastAPI(
    title="CineTogether API",
    version="0.1.0",
    description="Real-time watch-party platform API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms_router)
app.include_router(ws_router)


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok", "version": "0.1.0"}
