"""app/schemas/work_orders.py"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.models.enums import WorkOrderStatus, WorkOrderType, Priority


class WorkOrderCreate(BaseModel):
    equipment_id: str
    subject: str
    type: Optional[WorkOrderType] = WorkOrderType.corrective
    priority: Optional[Priority] = Priority.medium
    assignee_id: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    is_complaint: Optional[bool] = False


class WorkOrderUpdate(BaseModel):
    subject: Optional[str] = None
    status: Optional[WorkOrderStatus] = None
    priority: Optional[Priority] = None
    assignee_id: Optional[str] = None
    due_date: Optional[datetime] = None
    downtime_minutes: Optional[int] = None
    duration: Optional[float] = None
    cost: Optional[float] = None


class CommentCreate(BaseModel):
    text: str


class CommentOut(BaseModel):
    author_id: str
    author_name: str
    text: str
    created_at: datetime


class WorkOrderOut(BaseModel):
    id: str
    human_id: str
    subject: str
    type: WorkOrderType
    status: WorkOrderStatus
    priority: Priority
    is_complaint: bool = False
    equipment_id: Optional[str] = None
    equipment_name: Optional[str] = None
    equipment_human_id: Optional[str] = None
    equipment_department: Optional[str] = None
    equipment_location: Optional[str] = None
    equipment_assigned_to: Optional[str] = None
    team_id: Optional[str] = None
    created_by: Optional[str] = None
    creator_name: Optional[str] = None
    creator_email: Optional[str] = None
    creator_role: Optional[str] = None
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    downtime_minutes: Optional[int] = None
    duration: float
    cost: Optional[float] = None
    comments: List[CommentOut] = []
    created_at: datetime
    updated_at: datetime
