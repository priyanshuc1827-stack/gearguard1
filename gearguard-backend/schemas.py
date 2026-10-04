from pydantic import BaseModel, model_serializer, Field
from bson import ObjectId
from datetime import datetime
from typing import Any, Optional, List


def convert_object_ids_and_map_id(data: Any) -> Any:
    if isinstance(data, dict):
        new_dict = {}
        for k, v in data.items():
            new_dict[k] = convert_object_ids_and_map_id(v)
        if "id" in new_dict and new_dict["id"] is not None:
            new_dict["_id"] = str(new_dict["id"])
        elif "_id" in new_dict and new_dict["_id"] is not None:
            new_dict["id"] = str(new_dict["_id"])
        return new_dict
    elif isinstance(data, list):
        return [convert_object_ids_and_map_id(item) for item in data]
    elif isinstance(data, ObjectId):
        return str(data)
    elif isinstance(data, datetime):
        return data.isoformat()
    return data


class CustomBaseModel(BaseModel):
    @model_serializer(mode="wrap")
    def serialize_model(self, handler) -> Any:
        result = handler(self)
        return convert_object_ids_and_map_id(result)


class UserResponse(CustomBaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: Optional[datetime] = None


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    confirmPassword: Optional[str] = None
    role: Optional[str] = "user"


class UserAdminCreate(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = "user"


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class TeamResponse(CustomBaseModel):
    id: str
    name: str


class TeamCreate(BaseModel):
    name: str


class EquipmentResponse(CustomBaseModel):
    id: str
    name: str
    serialNumber: str
    category: Optional[str] = None
    location: Optional[str] = None
    department: str
    assignedEmployee: str
    lastServiceDate: Optional[datetime] = None
    isUsable: bool
    maintenanceTeamId: Optional[str] = None
    assignedTechnicianId: Optional[str] = None
    team: Optional[Any] = None
    requestCount: Optional[int] = None
    requests: Optional[List[Any]] = None


class EquipmentCreate(BaseModel):
    name: str
    serialNumber: str
    department: Optional[str] = "General Operations"
    category: Optional[str] = None
    location: Optional[str] = None
    maintenanceTeamId: Optional[str] = None
    assignedEmployee: Optional[str] = "Unassigned"


class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    serialNumber: Optional[str] = None
    department: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    maintenanceTeamId: Optional[str] = None
    assignedEmployee: Optional[str] = None
    isUsable: Optional[bool] = None
    lastServiceDate: Optional[datetime] = None
    assignedTechnicianId: Optional[str] = None


class EquipmentDropdownResponse(CustomBaseModel):
    id: str
    name: str
    serialNumber: str


class RequestResponse(CustomBaseModel):
    id: str
    subject: str
    type: str
    status: str
    equipmentId: Optional[str] = None
    createdBy: Optional[str] = None
    scheduledDate: Optional[datetime] = None
    duration: float
    created_at: Optional[datetime] = None
    createdAt: Optional[datetime] = None
    equipment: Optional[EquipmentResponse] = None
    creator: Optional[UserResponse] = None
    team: Optional[TeamResponse] = None


class RequestCreate(BaseModel):
    equipmentId: str
    subject: str
    createdBy: Optional[str] = None
    type: Optional[str] = "Corrective"
    scheduledDate: Optional[datetime] = None


class RequestUpdate(BaseModel):
    status: Optional[str] = None
    duration: Optional[float] = None
    equipmentId: Optional[str] = None
    createdBy: Optional[str] = None
    subject: Optional[str] = None
    type: Optional[str] = None
    scheduledDate: Optional[datetime] = None


class CategoryResponse(CustomBaseModel):
    id: str
    name: str
    description: Optional[str] = None


class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    adminUserId: Optional[str] = None


class LocationResponse(CustomBaseModel):
    id: str
    name: str
    address: Optional[str] = None


class LocationCreate(BaseModel):
    name: str
    address: Optional[str] = None
    adminUserId: Optional[str] = None


class AssetRequestResponse(CustomBaseModel):
    id: str
    employeeId: str
    assetName: str
    category: Optional[str] = None
    reason: Optional[str] = None
    status: str
    allocatedAssetId: Optional[str] = None
    requestDate: datetime
    approvalDate: Optional[datetime] = None
    allocatedDate: Optional[datetime] = None
    returnDate: Optional[datetime] = None
    employee: Optional[UserResponse] = None
    allocatedAsset: Optional[EquipmentResponse] = None


class AssetRequestCreate(BaseModel):
    employeeId: str
    assetName: str
    category: Optional[str] = None
    reason: Optional[str] = None


class AssetRequestAllocate(BaseModel):
    managerId: str
    equipmentId: str


class AuditLogResponse(CustomBaseModel):
    id: str
    userId: str
    action: str
    details: Optional[str] = None
    timestamp: datetime
    user: Optional[UserResponse] = None


class AuditLogCreate(BaseModel):
    userId: str
    action: str
    details: Optional[str] = None
