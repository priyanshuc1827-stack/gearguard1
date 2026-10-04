"""app/models/user.py"""
from beanie import Document, Indexed
from pydantic import Field
from datetime import datetime, timezone
from typing import Optional, Annotated
from app.models.enums import UserRole


class User(Document):
    name: str
    email: Annotated[str, Indexed(unique=True)]
    password: str          # bcrypt hash only — never plaintext
    role: UserRole = UserRole.user
    department: Optional[str] = "Production"
    created_at: datetime = Field(default_factory=lambda: datetime.now(tz=timezone.utc))

    class Settings:
        name = "users"
