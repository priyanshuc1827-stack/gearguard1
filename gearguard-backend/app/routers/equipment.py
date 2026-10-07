"""app/routers/equipment.py — Equipment CRUD with BR3 (open work order count) and audit."""
from datetime import datetime, timezone
from typing import Optional, List

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import get_current_user, require, TokenData
from app.models.enums import UserRole, AssetRequestStatus
from app.models.asset_request import AssetRequest
from app.models.equipment import Equipment
from app.models.user import User
from app.models.work_order import WorkOrder
from app.schemas.equipment import EquipmentCreate, EquipmentUpdate, EquipmentOut
from app.services.audit import audit
from app.services.ids import next_equipment_id

router = APIRouter(prefix="/equipment", tags=["equipment"])

OPEN_STATUSES = ["New", "In Progress"]


async def _build_out(asset: Equipment) -> EquipmentOut:
    # BR3: open work order count via query (not N+1 aggregation)
    open_count = await WorkOrder.find(
        WorkOrder.equipment_id == asset.id,
        {"status": {"$in": OPEN_STATUSES}},
    ).count()

    return EquipmentOut(
        id=str(asset.id),
        human_id=asset.human_id,
        name=asset.name,
        serial_number=asset.serial_number,
        department=asset.department,
        category=asset.category,
        location=asset.location,
        maintenance_team_id=str(asset.maintenance_team_id) if asset.maintenance_team_id else None,
        assigned_employee=asset.assigned_employee,
        assigned_employee_id=str(asset.assigned_employee_id) if asset.assigned_employee_id else None,
        last_service_date=asset.last_service_date,
        is_usable=asset.is_usable,
        last_audit_date=getattr(asset, "last_audit_date", None),
        audit_status=getattr(asset, "audit_status", "uninspected") or "uninspected",
        next_audit_due=getattr(asset, "next_audit_due", None),
        open_work_order_count=open_count,
        created_at=asset.created_at,
    )


@router.get("/", response_model=List[EquipmentOut])
async def list_equipment(
    current: TokenData = Depends(get_current_user),
    department: Optional[str] = Query(None),
    all_assets: bool = Query(False),
):
    assets = await Equipment.find_all().to_list()

    # Employees can only ever view and interact with equipment allocated to their profile
    if current.role == UserRole.user:
        user = await User.get(PydanticObjectId(current.user_id))
        if user:
            u_oid = user.id
            u_name = user.name.strip().lower()
            u_email = user.email.strip().lower()
            matched = []
            for a in assets:
                if a.assigned_employee_id and a.assigned_employee_id == u_oid:
                    matched.append(a)
                    continue
                a_emp = (a.assigned_employee or "").strip().lower()
                if a_emp and a_emp != "unassigned":
                    if (u_name and (u_name in a_emp or a_emp in u_name)) or (u_email and u_email in a_emp):
                        matched.append(a)
            assets = matched
        else:
            assets = []
    elif current.role in (UserRole.manager, UserRole.auditor):
        user = await User.get(PydanticObjectId(current.user_id))
        scoped_dept = getattr(user, "department", None) if user else None
        if scoped_dept and scoped_dept != "All":
            assets = [a for a in assets if a.department == scoped_dept]
    elif department and department != "All":
        assets = [a for a in assets if a.department == department]

    return [await _build_out(a) for a in assets]


@router.get("/{equipment_id}", response_model=EquipmentOut)
async def get_equipment(equipment_id: str, current: TokenData = Depends(get_current_user)):
    try:
        asset = await Equipment.get(PydanticObjectId(equipment_id))
    except Exception:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Equipment not found")
    if not asset:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Equipment not found")

    if current.role == UserRole.user:
        user = await User.get(PydanticObjectId(current.user_id))
        is_allocated = False
        if user:
            if asset.assigned_employee_id and asset.assigned_employee_id == user.id:
                is_allocated = True
            else:
                u_name = user.name.strip().lower()
                u_email = user.email.strip().lower()
                a_emp = (asset.assigned_employee or "").strip().lower()
                if a_emp and a_emp != "unassigned":
                    if (u_name and (u_name in a_emp or a_emp in u_name)) or (u_email and u_email in a_emp):
                        is_allocated = True

        if not is_allocated:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied — this equipment is not allocated to you.")
    elif current.role in (UserRole.manager, UserRole.auditor):
        user = await User.get(PydanticObjectId(current.user_id))
        scoped_dept = getattr(user, "department", None) if user else None
        if scoped_dept and scoped_dept != "All" and asset.department != scoped_dept:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Access denied: Asset belongs to {asset.department}, but your departmental scope is {scoped_dept}")

    return await _build_out(asset)


@router.post("/", response_model=EquipmentOut, status_code=status.HTTP_201_CREATED)
async def create_equipment(
    body: EquipmentCreate,
    current: TokenData = Depends(require("admin", "manager")),
):
    if await Equipment.find_one(Equipment.serial_number == body.serial_number):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Serial number already exists")

    human_id = await next_equipment_id()
    team_oid = None
    if body.maintenance_team_id:
        try:
            team_oid = PydanticObjectId(body.maintenance_team_id)
        except Exception:
            pass

    asset = Equipment(
        human_id=human_id,
        name=body.name,
        serial_number=body.serial_number,
        department=body.department or "General Operations",
        category=body.category,
        location=body.location,
        maintenance_team_id=team_oid,
        assigned_employee=body.assigned_employee or "Unassigned",
        is_usable=True,
    )
    await asset.insert()

    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(
        actor_id=current.user_id, actor_name=actor.name if actor else "Unknown",
        action="equipment.created", entity_type="equipment",
        entity_id=str(asset.id), entity_label=f"{human_id} {asset.name}",
        after={"serial": asset.serial_number, "department": asset.department},
    )
    return await _build_out(asset)


@router.patch("/{equipment_id}", response_model=EquipmentOut)
async def update_equipment(
    equipment_id: str,
    body: EquipmentUpdate,
    current: TokenData = Depends(require("admin", "manager")),
):
    try:
        asset = await Equipment.get(PydanticObjectId(equipment_id))
    except Exception:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Equipment not found")
    if not asset:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Equipment not found")

    before = {}
    after = {}
    for field in ("name", "serial_number", "department", "category", "location", "assigned_employee", "is_usable"):
        val = getattr(body, field, None)
        if val is not None:
            before[field] = getattr(asset, field)
            setattr(asset, field, val)
            after[field] = val

    if body.maintenance_team_id is not None:
        before["maintenance_team_id"] = str(asset.maintenance_team_id)
        try:
            asset.maintenance_team_id = PydanticObjectId(body.maintenance_team_id)
        except Exception:
            asset.maintenance_team_id = None
        after["maintenance_team_id"] = body.maintenance_team_id

    await asset.save()
    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(
        actor_id=current.user_id, actor_name=actor.name if actor else "Unknown",
        action="equipment.updated", entity_type="equipment",
        entity_id=str(asset.id), entity_label=f"{asset.human_id} {asset.name}",
        before=before or None, after=after or None,
    )
    return await _build_out(asset)


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_equipment(equipment_id: str, current: TokenData = Depends(require("admin"))):
    try:
        asset = await Equipment.get(PydanticObjectId(equipment_id))
    except Exception:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Equipment not found")
    if not asset:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Equipment not found")

    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(
        actor_id=current.user_id, actor_name=actor.name if actor else "Unknown",
        action="equipment.deleted", entity_type="equipment",
        entity_id=str(asset.id), entity_label=f"{asset.human_id} {asset.name}",
        before={"serial": asset.serial_number},
    )
    await asset.delete()


@router.post("/{equipment_id}/return", response_model=EquipmentOut)
async def return_equipment(
    equipment_id: str,
    current: TokenData = Depends(get_current_user),
):
    try:
        oid = PydanticObjectId(equipment_id)
    except Exception:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Equipment not found")

    asset = await Equipment.get(oid)
    if not asset:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Equipment not found")

    # Authorization: Employee can only return equipment allocated to them; Manager/Admin can return any
    if current.role == UserRole.user:
        user = await User.get(PydanticObjectId(current.user_id))
        is_allocated = False
        if user:
            if asset.assigned_employee_id and asset.assigned_employee_id == user.id:
                is_allocated = True
            else:
                u_name = user.name.strip().lower()
                u_email = user.email.strip().lower()
                a_emp = (asset.assigned_employee or "").strip().lower()
                if a_emp and a_emp != "unassigned":
                    if (u_name in a_emp or a_emp in u_name) or (u_email in a_emp):
                        is_allocated = True
        if not is_allocated:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied — you can only return equipment assigned to you.")

    now = datetime.now(tz=timezone.utc)
    prev_employee = asset.assigned_employee
    prev_emp_id = asset.assigned_employee_id

    # Reset equipment assignment
    asset.assigned_employee = "Unassigned"
    asset.assigned_employee_id = None
    await asset.save()

    # Update matching allocated AssetRequest if exists
    matching_req = await AssetRequest.find(
        AssetRequest.allocated_asset_id == asset.id,
        AssetRequest.status == AssetRequestStatus.allocated
    ).first_or_none()

    if matching_req:
        matching_req.status = AssetRequestStatus.returned
        matching_req.return_date = now
        await matching_req.save()
    else:
        # Create completed historical record for manager custody audit
        emp_oid = prev_emp_id or PydanticObjectId(current.user_id)
        req_record = AssetRequest(
            employee_id=emp_oid,
            asset_name=asset.name,
            status=AssetRequestStatus.returned,
            allocated_asset_id=asset.id,
            request_date=asset.created_at,
            allocated_date=asset.created_at,
            return_date=now,
        )
        await req_record.insert()

    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(
        actor_id=current.user_id,
        actor_name=actor.name if actor else "Unknown",
        action="equipment.returned",
        entity_type="equipment",
        entity_id=str(asset.id),
        entity_label=f"{asset.human_id} {asset.name}",
        before={"assigned_employee": prev_employee},
        after={"assigned_employee": "Unassigned"},
    )
    return await _build_out(asset)
