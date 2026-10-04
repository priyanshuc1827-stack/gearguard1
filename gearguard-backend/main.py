import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Ensure the backend directory is in python path for local imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db
from routers import (
    auth,
    users,
    equipment,
    requests,
    maintenance,
    categories,
    locations,
    asset_requests,
    audit_logs,
    reports
)

load_dotenv()

MONGODB_URI = os.getenv("DATABASE_URL") or os.getenv("MONGO_URI")
if not MONGODB_URI:
    raise RuntimeError("❌ Error: Neither DATABASE_URL nor MONGO_URI is defined in your .env file!")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to database
    await init_db(MONGODB_URI)
    yield
    # Shutdown logic (if any) can go here

app = FastAPI(
    title="GearGuard API",
    description="Python/FastAPI rewrite of GearGuard Node.js Express backend",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(equipment.router, prefix="/api/equipment", tags=["Equipment"])
app.include_router(requests.router, prefix="/api/requests", tags=["Requests"])
app.include_router(maintenance.router, prefix="/api/maintenance", tags=["Maintenance"])
app.include_router(categories.router, prefix="/api/categories", tags=["Categories"])
app.include_router(locations.router, prefix="/api/locations", tags=["Locations"])
app.include_router(asset_requests.router, prefix="/api/asset-requests", tags=["Asset Requests"])
app.include_router(audit_logs.router, prefix="/api/audit-logs", tags=["Audit Logs"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])

@app.get("/")
def read_root():
    return {"message": "🚀 GearGuard API running on FastAPI"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
