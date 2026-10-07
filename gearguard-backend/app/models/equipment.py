"""app/models/equipment.py"""
from beanie import Document, Indexed, Link
from pydantic import Field
from datetime import datetime, timezone
from typing import Optional, Annotated
from beanie import PydanticObjectId


class Equipment(Document):
    human_id: str = Field(default="")            # AST-NNNN — set server-side
    name: str
    serial_number: Annotated[str, Indexed(unique=True)]
    department: str = "General Operations"
    category: Optional[str] = None               # human name kept for compat
    category_id: Optional[PydanticObjectId] = None
    location: Optional[str] = None
    location_id: Optional[PydanticObjectId] = None
    maintenance_team_id: Optional[PydanticObjectId] = None
    assigned_technician_id: Optional[PydanticObjectId] = None
    assigned_employee: str = "Unassigned"
    assigned_employee_id: Optional[PydanticObjectId] = None
    last_service_date: Optional[datetime] = None
    is_usable: bool = True
    last_audit_date: Optional[datetime] = None
    audit_status: Optional[str] = "uninspected"   # "passed", "conditional", "failed", "uninspected"
    next_audit_due: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(tz=timezone.utc))

    class Settings:
        name = "equipment"
        indexes = ["human_id", "serial_number", "assigned_employee_id"]


