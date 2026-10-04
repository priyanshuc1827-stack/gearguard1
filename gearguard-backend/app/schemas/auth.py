"""app/schemas/auth.py"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.models.enums import UserRole


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    confirm_password: str
    department: Optional[str] = "Production"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    department: Optional[str] = "Production"

    model_config = {"from_attributes": True}
