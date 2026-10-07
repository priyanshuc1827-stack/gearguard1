"""
app/main.py — FastAPI application factory.
All config from environment variables. No secrets hardcoded.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import get_settings
from app.core.database import init_db
from app.routers import (
    auth, users, equipment, work_orders,
    asset_requests, teams, categories, locations,
    audit_logs, reports, compliance,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="GearGuard API",
    version="2.0.0",
    description="Equipment maintenance and asset management — FastAPI / MongoDB",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


cfg = get_settings()
cors_origins = list({cfg.CORS_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000"})
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
for pfx in [PREFIX, "/api"]:
    app.include_router(auth.router, prefix=pfx)
    app.include_router(users.router, prefix=pfx)
    app.include_router(equipment.router, prefix=pfx)
    app.include_router(work_orders.router, prefix=pfx)
    app.include_router(asset_requests.router, prefix=pfx)
    app.include_router(teams.router, prefix=pfx)
    app.include_router(categories.router, prefix=pfx)
    app.include_router(locations.router, prefix=pfx)
    app.include_router(audit_logs.router, prefix=pfx)
    app.include_router(reports.router, prefix=pfx)
    app.include_router(compliance.router, prefix=pfx)


@app.get("/")
def root():
    return {"message": "🚀 GearGuard API running on FastAPI", "version": "2.0.0"}


@app.get("/api/health")
@app.get("/api/v1/health")
def health():
    return {"status": "ok", "service": "gearguard", "version": "2.0.0"}

