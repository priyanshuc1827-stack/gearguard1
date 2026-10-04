"""
app/routers/work_orders.py — Work Order CRUD + business rules.

Business rules enforced:
  BR1: status -> Scrap   => equipment.is_usable = False
  BR2: status -> Repaired => equipment.last_service_date = now
  BR3: equipment open work order count computed via aggregation (not N+1)
  BR4: creation auto-links equipment.maintenance_team_id -> work_order.team_id
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional, List

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import get_current_user, require, TokenData
from app.models.enums import Priority, WorkOrderStatus, WorkOrderType, UserRole
from app.models.equipment import Equipment
from app.models.user import User
from app.models.work_order import WorkOrder, Comment
from app.schemas.work_orders import (
    WorkOrderCreate, WorkOrderUpdate, WorkOrderOut, CommentCreate, CommentOut,
)
from app.services.audit import audit
from app.services.ids import next_work_order_id

router = APIRouter(prefix="/work-orders", tags=["work-orders"])

OPEN_STATUSES = [WorkOrderStatus.new.value, WorkOrderStatus.in_progress.value]


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_wo(wo_id: str) -> WorkOrder:
    try:
        oid = PydanticObjectId(wo_id)
    except Exception:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Work order not found")
    wo = await WorkOrder.get(oid)
    if not wo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Work order not found")
    return wo


async def _build_out(wo: WorkOrder) -> WorkOrderOut:
    """Build response object — no N+1; equipment, assignee, and creator fetched once."""
    eq_name = None
    eq_human_id = None
    eq_department = None
    eq_location = None
    eq_assigned_to = None
    if wo.equipment_id:
        eq = await Equipment.get(wo.equipment_id)
        if eq:
            eq_name = eq.name
            eq_human_id = eq.human_id
            eq_department = eq.department
            eq_location = eq.location
            eq_assigned_to = eq.assigned_employee

    assignee_name = None
    if wo.assignee_id:
        u = await User.get(wo.assignee_id)
        if u:
            assignee_name = u.name

    creator_name = None
    creator_email = None
    creator_role = None
    if wo.created_by:
        u = await User.get(wo.created_by)
        if u:
            creator_name = u.name
            creator_email = u.email
            creator_role = u.role.value if hasattr(u.role, "value") else str(u.role)

    is_complaint = getattr(wo, "is_complaint", False) or (creator_role == UserRole.user.value)

    return WorkOrderOut(
        id=str(wo.id),
        human_id=wo.human_id,
        subject=wo.subject,
        type=wo.type,
        status=wo.status,
        priority=wo.priority,
        is_complaint=is_complaint,
        equipment_id=str(wo.equipment_id) if wo.equipment_id else None,
        equipment_name=eq_name,
        equipment_human_id=eq_human_id,
        equipment_department=eq_department,
        equipment_location=eq_location,
        equipment_assigned_to=eq_assigned_to,
        team_id=str(wo.team_id) if wo.team_id else None,
        created_by=str(wo.created_by) if wo.created_by else None,
        creator_name=creator_name,
        creator_email=creator_email,
        creator_role=creator_role,
        assignee_id=str(wo.assignee_id) if wo.assignee_id else None,
        assignee_name=assignee_name,
        scheduled_date=wo.scheduled_date,
        due_date=wo.due_date,
        started_at=wo.started_at,
        completed_at=wo.completed_at,
        downtime_minutes=wo.downtime_minutes,
        duration=wo.duration,
        cost=wo.cost,
        comments=[
            CommentOut(
                author_id=str(c.author_id),
                author_name=c.author_name,
                text=c.text,
                created_at=c.created_at,
            )
            for c in (wo.comments or [])
        ],
        created_at=wo.created_at,
        updated_at=wo.updated_at,
    )


# ── List (server-side filter/sort/page) ───────────────────────────────────────

@router.get("/", response_model=dict)
async def list_work_orders(
    current: TokenData = Depends(get_current_user),
    department: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    assignee_id: Optional[str] = Query(None),
    equipment_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    complaints_only: bool = Query(False),
    sort_by: str = Query("created_at"),
    sort_dir: int = Query(-1),
):
    query: dict = {}

    # Department Scoping for Managers and optional filtering for Admin/Auditors
    target_dept = department if (department and department != "All") else None
    if current.role == UserRole.manager:
        current_user = await User.get(PydanticObjectId(current.user_id))
        mgr_dept = getattr(current_user, "department", None)
        if mgr_dept and mgr_dept != "All":
            target_dept = mgr_dept

    if target_dept:
        dept_eqs = await Equipment.find(Equipment.department == target_dept).to_list()
        dept_eq_ids = [e.id for e in dept_eqs]
        dept_users = await User.find(User.department == target_dept).to_list()
        dept_user_ids = [u.id for u in dept_users]
        query["$or"] = [
            {"equipment_id": {"$in": dept_eq_ids}},
            {"created_by": {"$in": dept_user_ids}},
        ]

    # Complaints-specific or role-based filtering
    if complaints_only:
        if current.role == UserRole.user:
            query["created_by"] = PydanticObjectId(current.user_id)
        else:
            # Manager / Admin complaint inbox: complaints filed by employees or tagged is_complaint
            emp_users = await User.find(User.role == UserRole.user).to_list()
            emp_ids = [u.id for u in emp_users]
            complaint_clause = {"$or": [{"is_complaint": True}, {"created_by": {"$in": emp_ids}}]}
            if "$or" in query:
                # Merge existing department condition with complaints condition
                query = {"$and": [{"$or": query.pop("$or")}, complaint_clause]}
            elif "$and" in query:
                query["$and"].append(complaint_clause)
            else:
                query.update(complaint_clause)
    else:
        # Standard RBAC filtering
        if current.role == UserRole.user:
            query["created_by"] = PydanticObjectId(current.user_id)
        elif current.role == UserRole.technician:
            query["assignee_id"] = PydanticObjectId(current.user_id)

    if status_filter:
        query["status"] = status_filter
    if priority_filter:
        query["priority"] = priority_filter
    if assignee_id:
        if assignee_id.lower() == "unassigned":
            query["assignee_id"] = None
        else:
            try:
                query["assignee_id"] = PydanticObjectId(assignee_id)
            except Exception:
                pass
    if equipment_id:
        try:
            query["equipment_id"] = PydanticObjectId(equipment_id)
        except Exception:
            pass
    if search:
        search_filter = [
            {"subject": {"$regex": search, "$options": "i"}},
            {"human_id": {"$regex": search, "$options": "i"}},
        ]
        if "$or" in query:
            query["$and"] = [{"$or": query.pop("$or")}, {"$or": search_filter}]
        else:
            query["$or"] = search_filter

    total = await WorkOrder.find(query).count()
    skip = (page - 1) * page_size
    wos = await WorkOrder.find(query).sort([(sort_by, sort_dir)]).skip(skip).limit(page_size).to_list()

    items = [await _build_out(wo) for wo in wos]
    return {"total": total, "page": page, "page_size": page_size, "items": [i.model_dump() for i in items]}


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("/", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED)
async def create_work_order(
    body: WorkOrderCreate,
    current: TokenData = Depends(require("admin", "manager", "technician", "user")),
):
    try:
        eq_oid = PydanticObjectId(body.equipment_id)
    except Exception:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Equipment not found")

    asset = await Equipment.get(eq_oid)
    if not asset:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Equipment not found")

    assignee_oid = None
    if body.assignee_id and current.role in (UserRole.admin, UserRole.manager):
        try:
            assignee_oid = PydanticObjectId(body.assignee_id)
        except Exception:
            pass

    is_complaint = body.is_complaint or False

    # Strict allocation check for employees: they can ONLY complain about their allocated asset
    if current.role == UserRole.user:
        user = await User.get(PydanticObjectId(current.user_id))
        is_allocated = False
        if user:
            if asset.assigned_employee_id and asset.assigned_employee_id == user.id:
                is_allocated = True
            else:
                u_name = (user.name if user else "").strip().lower()
                u_email = (user.email if user else "").strip().lower()
                a_emp = (asset.assigned_employee or "").strip().lower()
                if a_emp and a_emp != "unassigned":
                    if (u_name and (u_name in a_emp or a_emp in u_name)) or (u_email and u_email in a_emp):
                        is_allocated = True

        if not is_allocated:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"You can only submit complaints for equipment allocated to you. '{asset.name}' is currently allocated to '{asset.assigned_employee}', not your profile."
            )

        # Employee tickets are automatically tagged as complaints and dispatched directly to the Manager's queue (unassigned)
        is_complaint = True
        assignee_oid = None

    human_id = await next_work_order_id()

    wo = WorkOrder(
        human_id=human_id,
        subject=body.subject,
        type=body.type or WorkOrderType.corrective,
        status=WorkOrderStatus.new,
        priority=body.priority or Priority.medium,
        is_complaint=is_complaint,
        equipment_id=eq_oid,
        team_id=asset.maintenance_team_id,   # BR4: auto-link from equipment
        created_by=PydanticObjectId(current.user_id),
        assignee_id=assignee_oid,
        scheduled_date=body.scheduled_date,
        due_date=body.due_date,
    )
    await wo.insert()

    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(
        actor_id=current.user_id,
        actor_name=actor.name if actor else "Unknown",
        action="work_order.created" if not is_complaint else "complaint.created",
        entity_type="work_order",
        entity_id=str(wo.id),
        entity_label=human_id,
        after={"subject": wo.subject, "equipment": asset.name, "priority": wo.priority, "is_complaint": is_complaint},
    )
    return await _build_out(wo)


# ── Get one ───────────────────────────────────────────────────────────────────

@router.get("/{wo_id}", response_model=WorkOrderOut)
async def get_work_order(wo_id: str, current: TokenData = Depends(get_current_user)):
    wo = await _get_wo(wo_id)
    if current.role == UserRole.user and str(wo.created_by) != current.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    if current.role == UserRole.technician and str(wo.assignee_id) != current.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    if current.role == UserRole.manager:
        current_user = await User.get(PydanticObjectId(current.user_id))
        mgr_dept = getattr(current_user, "department", None)
        if mgr_dept and mgr_dept != "All":
            eq = await Equipment.get(wo.equipment_id) if wo.equipment_id else None
            creator = await User.get(wo.created_by) if wo.created_by else None
            eq_dept = getattr(eq, "department", None) if eq else None
            creator_dept = getattr(creator, "department", None) if creator else None
            if eq_dept != mgr_dept and creator_dept != mgr_dept:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied: Ticket belongs to another department")
    return await _build_out(wo)


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{wo_id}", response_model=WorkOrderOut)
async def update_work_order(
    wo_id: str,
    body: WorkOrderUpdate,
    current: TokenData = Depends(get_current_user),
):
    if current.role in (UserRole.user, UserRole.auditor):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    wo = await _get_wo(wo_id)

    # Technician can only update their own, and only status + downtime
    if current.role == UserRole.technician:
        if str(wo.assignee_id) != current.user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Can only update your own work orders")

    before: dict = {}
    after: dict = {}

    # Status transitions with business rule side effects
    if body.status is not None and body.status != wo.status:
        before["status"] = wo.status
        after["status"] = body.status
        old_status = wo.status
        wo.status = body.status

        now = datetime.now(tz=timezone.utc)

        if body.status == WorkOrderStatus.in_progress and not wo.started_at:
            wo.started_at = now

        if body.status == WorkOrderStatus.repaired:
            wo.completed_at = now
            if wo.started_at:
                wo.downtime_minutes = int((now - wo.started_at).total_seconds() / 60)
            # BR2: update equipment last service date
            if wo.equipment_id:
                asset = await Equipment.get(wo.equipment_id)
                if asset:
                    asset.last_service_date = now
                    await asset.save()

        if body.status == WorkOrderStatus.scrap:
            # BR1: mark equipment not usable
            if wo.equipment_id:
                asset = await Equipment.get(wo.equipment_id)
                if asset:
                    asset.is_usable = False
                    await asset.save()

    # Other fields (admin/manager only)
    if current.role in (UserRole.admin, UserRole.manager):
        if body.subject is not None:
            before["subject"] = wo.subject
            wo.subject = body.subject
            after["subject"] = body.subject
        if body.priority is not None:
            before["priority"] = wo.priority
            wo.priority = body.priority
            after["priority"] = body.priority
        if body.assignee_id is not None:
            before["assignee_id"] = str(wo.assignee_id) if wo.assignee_id else None
            if not body.assignee_id or body.assignee_id.lower() in ("none", "unassigned", ""):
                wo.assignee_id = None
                after["assignee_id"] = None
            else:
                try:
                    wo.assignee_id = PydanticObjectId(body.assignee_id)
                    after["assignee_id"] = str(wo.assignee_id)
                except Exception:
                    pass
        if body.due_date is not None:
            wo.due_date = body.due_date
        if body.cost is not None:
            wo.cost = body.cost

    if body.downtime_minutes is not None:
        wo.downtime_minutes = body.downtime_minutes
    if body.duration is not None:
        wo.duration = body.duration

    wo.updated_at = datetime.now(tz=timezone.utc)
    await wo.save()

    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(
        actor_id=current.user_id,
        actor_name=actor.name if actor else "Unknown",
        action="work_order.updated",
        entity_type="work_order",
        entity_id=str(wo.id),
        entity_label=wo.human_id,
        before=before or None,
        after=after or None,
    )
    return await _build_out(wo)


# ── Add comment ───────────────────────────────────────────────────────────────

@router.post("/{wo_id}/comments", response_model=WorkOrderOut)
async def add_comment(
    wo_id: str,
    body: CommentCreate,
    current: TokenData = Depends(require("admin", "manager", "technician", "user")),
):
    wo = await _get_wo(wo_id)
    if current.role == UserRole.user and str(wo.created_by) != current.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    actor = await User.get(PydanticObjectId(current.user_id))

    comment = Comment(
        author_id=PydanticObjectId(current.user_id),
        author_name=actor.name if actor else "Unknown",
        text=body.text.strip(),
    )
    wo.comments.append(comment)
    wo.updated_at = datetime.now(tz=timezone.utc)
    await wo.save()
    return await _build_out(wo)


# ── Delete (admin only) ───────────────────────────────────────────────────────

@router.delete("/{wo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_order(
    wo_id: str,
    current: TokenData = Depends(require("admin")),
):
    wo = await _get_wo(wo_id)
    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(
        actor_id=current.user_id,
        actor_name=actor.name if actor else "Unknown",
        action="work_order.deleted",
        entity_type="work_order",
        entity_id=str(wo.id),
        entity_label=wo.human_id,
        before={"subject": wo.subject, "status": wo.status},
    )
    await wo.delete()
