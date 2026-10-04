"""app/models/category.py"""
from beanie import Document, Indexed
from pydantic import Field
from typing import Optional, Annotated


class Category(Document):
    name: Annotated[str, Indexed(unique=True)]
    description: Optional[str] = None

    class Settings:
        name = "categories"


