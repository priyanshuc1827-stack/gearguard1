"""app/schemas/users.py"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.models.enums import UserRole


class UserAdminCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.user
    department: Optional[str] = "Production"


class UserAdminUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    department: Optional[str] = None
