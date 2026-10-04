from datetime import datetime
from typing import Optional
from beanie import Document, PydanticObjectId
from pydantic import Field

class User(Document):
    name: str
    email: str
    password: str
    role: str = "user"  # admin, manager, user, technician, auditor
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"

class Team(Document):
    name: str

    class Settings:
        name = "teams"

class Equipment(Document):
    name: str
    serialNumber: str
    category: Optional[str] = None
    location: Optional[str] = None
    department: str = "General Operations"
    assignedEmployee: str = "Unassigned"
    lastServiceDate: Optional[datetime] = None
    isUsable: bool = True
    maintenanceTeamId: Optional[PydanticObjectId] = None
    assignedTechnicianId: Optional[PydanticObjectId] = None

    class Settings:
        name = "equipments"

class Request(Document):
    subject: str
    type: str = "Corrective"  # Corrective, Preventive
    status: str = "New"  # New, In Progress, Repaired, Scrap
    equipmentId: Optional[PydanticObjectId] = None
    createdBy: Optional[PydanticObjectId] = None
    scheduledDate: Optional[datetime] = None
    duration: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "requests"

class Category(Document):
    name: str
    description: Optional[str] = None

    class Settings:
        name = "categories"

class Location(Document):
    name: str
    address: Optional[str] = None

    class Settings:
        name = "locations"

class AssetRequest(Document):
    employeeId: PydanticObjectId
    assetName: str
    category: Optional[str] = None
    reason: Optional[str] = None
    status: str = "Pending"  # Pending, Approved, Rejected, Allocated, Returned
    allocatedAssetId: Optional[PydanticObjectId] = None
    requestDate: datetime = Field(default_factory=datetime.utcnow)
    approvalDate: Optional[datetime] = None
    allocatedDate: Optional[datetime] = None
    returnDate: Optional[datetime] = None

    class Settings:
        name = "assetrequests"

class AuditLog(Document):
    userId: PydanticObjectId
    action: str
    details: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "auditlogs"
