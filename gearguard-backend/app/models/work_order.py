"""app/models/work_order.py — Work Order (replaces Request + maintenance.Request)."""
from beanie import Document
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional, List
from beanie import PydanticObjectId
from app.models.enums import WorkOrderStatus, WorkOrderType, Priority


class Comment(BaseModel):
    """Embedded comment — not a separate collection."""
    author_id: PydanticObjectId
    author_name: str
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(tz=timezone.utc))


class WorkOrder(Document):
    human_id: str = Field(default="")          # WO-NNNN — set server-side
    subject: str
    type: WorkOrderType = WorkOrderType.corrective
    status: WorkOrderStatus = WorkOrderStatus.new
    priority: Priority = Priority.medium

    equipment_id: Optional[PydanticObjectId] = None
    team_id: Optional[PydanticObjectId] = None         # BR4: auto-linked at creation

    created_by: Optional[PydanticObjectId] = None      # actor who created
    assignee_id: Optional[PydanticObjectId] = None     # technician assigned

    is_complaint: bool = False                         # Employee complaint ticket

    scheduled_date: Optional[datetime] = None          # legacy compat
    due_date: Optional[datetime] = None                # explicit due date

    started_at: Optional[datetime] = None              # set when -> In Progress
    completed_at: Optional[datetime] = None            # set when -> Repaired
    downtime_minutes: Optional[int] = None             # computed or manual
    duration: float = 0.0                              # legacy hours field kept

    cost: Optional[float] = None

    comments: List[Comment] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=lambda: datetime.now(tz=timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(tz=timezone.utc))

    class Settings:
        name = "maintenance_requests"   # keep same collection name for data compat
        indexes = ["human_id", "status", "assignee_id", "equipment_id", "priority", "is_complaint", "created_by"]
