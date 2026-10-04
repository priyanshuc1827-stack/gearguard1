"""app/models/team.py"""
from beanie import Document, Indexed
from pydantic import Field
from datetime import datetime, timezone
from typing import Optional, Annotated


class Team(Document):
    name: Annotated[str, Indexed(unique=True)]
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(tz=timezone.utc))

    class Settings:
        name = "teams"


