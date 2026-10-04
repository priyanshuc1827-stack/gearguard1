"""
app/core/database.py — Beanie/Motor initialisation.
No Motor monkeypatching. Uses official Beanie init_beanie().
"""
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import get_settings


async def init_db() -> None:
    cfg = get_settings()
    client = AsyncIOMotorClient(cfg.DATABASE_URL)
    # Import all document models here so Beanie registers them
    from app.models.user import User
    from app.models.team import Team
    from app.models.equipment import Equipment
    from app.models.work_order import WorkOrder
    from app.models.category import Category
    from app.models.location import Location
    from app.models.asset_request import AssetRequest
    from app.models.audit_log import AuditLog
    from app.models.counter import Counter

    await init_beanie(
        database=client[cfg.DATABASE_NAME],
        document_models=[
            User, Team, Equipment, WorkOrder,
            Category, Location, AssetRequest, AuditLog, Counter,
        ],
        allow_index_dropping=True,
    )
