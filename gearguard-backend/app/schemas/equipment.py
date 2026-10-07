"""app/schemas/equipment.py"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class EquipmentCreate(BaseModel):
    name: str
    serial_number: str
    department: Optional[str] = "General Operations"
    category: Optional[str] = None
    location: Optional[str] = None
    maintenance_team_id: Optional[str] = None
    assigned_employee: Optional[str] = "Unassigned"


class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    serial_number: Optional[str] = None
    department: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    maintenance_team_id: Optional[str] = None
    assigned_employee: Optional[str] = None
    assigned_employee_id: Optional[str] = None
    is_usable: Optional[bool] = None
    last_audit_date: Optional[datetime] = None
    audit_status: Optional[str] = None
    next_audit_due: Optional[datetime] = None


class EquipmentOut(BaseModel):
    id: str
    human_id: str
    name: str
    serial_number: str
    department: str
    category: Optional[str] = None
    location: Optional[str] = None
    maintenance_team_id: Optional[str] = None
    assigned_employee: str
    assigned_employee_id: Optional[str] = None
    last_service_date: Optional[datetime] = None
    is_usable: bool
    last_audit_date: Optional[datetime] = None
    audit_status: Optional[str] = "uninspected"
    next_audit_due: Optional[datetime] = None
    open_work_order_count: int = 0
    created_at: datetime
