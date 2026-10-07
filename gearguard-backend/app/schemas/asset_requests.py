"""app/schemas/asset_requests.py"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.enums import AssetRequestStatus


class AssetRequestCreate(BaseModel):
    asset_name: str
    category: Optional[str] = None
    reason: Optional[str] = None


class AssetRequestAllocate(BaseModel):
    equipment_id: str


class AssetRequestOut(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    employee_email: Optional[str] = None
    asset_name: str
    category: Optional[str] = None
    reason: Optional[str] = None
    status: AssetRequestStatus
    allocated_asset_id: Optional[str] = None
    allocated_asset_name: Optional[str] = None
    allocated_asset_human_id: Optional[str] = None
    allocated_asset_department: Optional[str] = None
    request_date: datetime
    approval_date: Optional[datetime] = None
    rejection_date: Optional[datetime] = None
    allocated_date: Optional[datetime] = None
    return_date: Optional[datetime] = None
