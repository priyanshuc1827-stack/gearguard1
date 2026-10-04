"""app/models/counter.py — Auto-incrementing human-readable ID counter."""
from typing import Annotated
from beanie import Document, Indexed
from pydantic import Field


class Counter(Document):
    name: Annotated[str, Indexed(unique=True)]  # e.g. "work_order", "equipment"
    seq: int = Field(default=0)

    class Settings:
        name = "counters"

    @classmethod
    async def next(cls, name: str) -> int:
        doc = await cls.find_one(cls.name == name)
        if not doc:
            doc = cls(name=name, seq=0)
            await doc.insert()
        doc.seq += 1
        await doc.save()
        return doc.seq

