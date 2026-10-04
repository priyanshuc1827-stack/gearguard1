"""app/models/location.py"""
from beanie import Document, Indexed
from pydantic import Field
from typing import Optional, Annotated


class Location(Document):
    name: Annotated[str, Indexed(unique=True)]
    address: Optional[str] = None

    class Settings:
        name = "locations"


