"""app/models/audit_log.py — Immutable audit trail for ALL mutations."""
from beanie import Document
from pydantic import Field
from datetime import datetime, timezone
from typing import Optional, Any
from beanie import PydanticObjectId


class AuditLog(Document):
    actor_id: PydanticObjectId           # who did it
    actor_name: str                      # denormalized for display
    action: str                          # e.g. "work_order.status_changed"
    entity_type: str                     # "work_order" | "equipment" | "user" | ...
    entity_id: str                       # string repr of the entity id
    entity_label: str                    # human-readable: "WO-1042" or "Pump Motor A"
    before: Optional[dict] = None        # diff: only changed fields
    after: Optional[dict] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(tz=timezone.utc))

    class Settings:
        name = "audit_logs"
        indexes = ["-timestamp", "entity_type", "actor_id"]
