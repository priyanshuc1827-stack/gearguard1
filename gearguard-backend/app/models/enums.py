"""app/models/enums.py — All shared enumerations."""
from enum import Enum


class UserRole(str, Enum):
    admin = "admin"
    manager = "manager"
    technician = "technician"
    user = "user"
    auditor = "auditor"


class WorkOrderStatus(str, Enum):
    new = "New"
    in_progress = "In Progress"
    repaired = "Repaired"
    scrap = "Scrap"


class WorkOrderType(str, Enum):
    corrective = "Corrective"
    preventive = "Preventive"


class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class AssetRequestStatus(str, Enum):
    pending = "Pending"
    approved = "Approved"
    rejected = "Rejected"
    allocated = "Allocated"
    returned = "Returned"
