"""app/models/asset_request.py"""
from beanie import Document
from pydantic import Field
from datetime import datetime, timezone
from typing import Optional
from beanie import PydanticObjectId
from app.models.enums import AssetRequestStatus


class AssetRequest(Document):
    employee_id: PydanticObjectId
    asset_name: str
    category: Optional[str] = None
    reason: Optional[str] = None
    status: AssetRequestStatus = AssetRequestStatus.pending
    allocated_asset_id: Optional[PydanticObjectId] = None
    request_date: datetime = Field(default_factory=lambda: datetime.now(tz=timezone.utc))
    approval_date: Optional[datetime] = None
    rejection_date: Optional[datetime] = None
    allocated_date: Optional[datetime] = None
    return_date: Optional[datetime] = None

    class Settings:
        name = "asset_requests"
        indexes = ["employee_id", "status"]
