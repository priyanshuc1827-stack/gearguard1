"""app/routers/asset_requests.py — Asset request lifecycle with BR5 and BR6."""
from datetime import datetime, timezone
from typing import List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import get_current_user, require, TokenData
from app.models.asset_request import AssetRequest
from app.models.enums import AssetRequestStatus, UserRole
from app.models.equipment import Equipment
from app.models.user import User
from app.schemas.asset_requests import AssetRequestCreate, AssetRequestAllocate, AssetRequestOut
from app.services.audit import audit

router = APIRouter(prefix="/asset-requests", tags=["asset-requests"])


async def _out(req: AssetRequest) -> AssetRequestOut:
    emp = await User.get(req.employee_id)
    asset = None
    if req.allocated_asset_id:
        asset = await Equipment.get(req.allocated_asset_id)
    return AssetRequestOut(
        id=str(req.id),
        employee_id=str(req.employee_id),
        employee_name=emp.name if emp else "Unknown",
        employee_email=emp.email if emp else None,
        asset_name=req.asset_name,
        category=req.category,
        reason=req.reason,
        status=req.status,
        allocated_asset_id=str(req.allocated_asset_id) if req.allocated_asset_id else None,
        allocated_asset_name=asset.name if asset else None,
        allocated_asset_human_id=asset.human_id if asset else None,
        allocated_asset_department=asset.department if asset else None,
        request_date=req.request_date,
        approval_date=req.approval_date,
        rejection_date=getattr(req, "rejection_date", None),
        allocated_date=req.allocated_date,
        return_date=req.return_date,
    )


@router.get("/", response_model=List[AssetRequestOut])
async def list_requests(
    department: Optional[str] = Query(None),
    current: TokenData = Depends(get_current_user)
):
    if current.role == UserRole.user:
        reqs = await AssetRequest.find(
            AssetRequest.employee_id == PydanticObjectId(current.user_id)
        ).sort("-request_date").to_list()
    elif current.role in (UserRole.manager, UserRole.auditor):
        user = await User.get(PydanticObjectId(current.user_id))
        scoped_dept = getattr(user, "department", None) if user else None
        if scoped_dept and scoped_dept != "All":
            dept_users = await User.find(User.department == scoped_dept).to_list()
            dept_uids = [u.id for u in dept_users]
            dept_eqs = await Equipment.find(Equipment.department == scoped_dept).to_list()
            dept_eq_ids = [e.id for e in dept_eqs]
            reqs = await AssetRequest.find({
                "$or": [
                    {"employee_id": {"$in": dept_uids}},
                    {"allocated_asset_id": {"$in": dept_eq_ids}},
                ]
            }).sort("-request_date").to_list()
        else:
            reqs = await AssetRequest.find_all().sort("-request_date").to_list()
    else:  # Admin
        if department and department != "All":
            dept_users = await User.find(User.department == department).to_list()
            dept_uids = [u.id for u in dept_users]
            dept_eqs = await Equipment.find(Equipment.department == department).to_list()
            dept_eq_ids = [e.id for e in dept_eqs]
            reqs = await AssetRequest.find({
                "$or": [
                    {"employee_id": {"$in": dept_uids}},
                    {"allocated_asset_id": {"$in": dept_eq_ids}},
                ]
            }).sort("-request_date").to_list()
        else:
            reqs = await AssetRequest.find_all().sort("-request_date").to_list()

    return [await _out(r) for r in reqs]


@router.post("/", response_model=AssetRequestOut, status_code=status.HTTP_201_CREATED)
async def create_request(body: AssetRequestCreate, current: TokenData = Depends(get_current_user)):
    if current.role == UserRole.auditor:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Auditors cannot create requests")

    req = AssetRequest(
        employee_id=PydanticObjectId(current.user_id),
        asset_name=body.asset_name,
        category=body.category,
        reason=body.reason,
        status=AssetRequestStatus.pending,
    )
    await req.insert()

    emp = await User.get(PydanticObjectId(current.user_id))
    await audit(
        actor_id=current.user_id, actor_name=emp.name if emp else "Unknown",
        action="asset_request.created", entity_type="asset_request",
        entity_id=str(req.id), entity_label=body.asset_name,
        after={"category": body.category, "reason": body.reason},
    )
    return await _out(req)


@router.patch("/{req_id}/approve", response_model=AssetRequestOut)
async def approve(req_id: str, current: TokenData = Depends(require("admin", "manager"))):
    req = await _get_req(req_id)
    req.status = AssetRequestStatus.approved
    req.approval_date = datetime.now(tz=timezone.utc)
    await req.save()
    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(actor_id=current.user_id, actor_name=actor.name if actor else "Unknown",
                action="asset_request.approved", entity_type="asset_request",
                entity_id=str(req.id), entity_label=req.asset_name)
    return await _out(req)


@router.patch("/{req_id}/reject", response_model=AssetRequestOut)
async def reject(req_id: str, current: TokenData = Depends(require("admin", "manager"))):
    req = await _get_req(req_id)
    req.status = AssetRequestStatus.rejected
    req.rejection_date = datetime.now(tz=timezone.utc)
    await req.save()
    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(actor_id=current.user_id, actor_name=actor.name if actor else "Unknown",
                action="asset_request.rejected", entity_type="asset_request",
                entity_id=str(req.id), entity_label=req.asset_name)
    return await _out(req)


@router.patch("/{req_id}/allocate", response_model=AssetRequestOut)
async def allocate(req_id: str, body: AssetRequestAllocate,
                   current: TokenData = Depends(require("admin", "manager"))):
    req = await _get_req(req_id)
    try:
        eq_oid = PydanticObjectId(body.equipment_id)
    except Exception:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Equipment not found")

    asset = await Equipment.get(eq_oid)
    if not asset:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Equipment not found")

    emp = await User.get(req.employee_id)
    emp_name = emp.name if emp else "Unassigned"

    # BR5: set assigned_employee and assigned_employee_id
    asset.assigned_employee = emp_name
    asset.assigned_employee_id = req.employee_id
    await asset.save()

    req.status = AssetRequestStatus.allocated
    req.allocated_asset_id = eq_oid
    req.allocated_date = datetime.now(tz=timezone.utc)
    await req.save()

    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(actor_id=current.user_id, actor_name=actor.name if actor else "Unknown",
                action="asset_request.allocated", entity_type="asset_request",
                entity_id=str(req.id), entity_label=req.asset_name,
                after={"asset": asset.name, "employee": emp_name})
    return await _out(req)


@router.patch("/{req_id}/return", response_model=AssetRequestOut)
async def return_asset(req_id: str, current: TokenData = Depends(get_current_user)):
    req = await _get_req(req_id)

    if current.role == UserRole.user and str(req.employee_id) != current.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Can only return your own assets")
    if current.role == UserRole.technician:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    # BR5: reset assigned_employee and assigned_employee_id
    if req.allocated_asset_id:
        asset = await Equipment.get(req.allocated_asset_id)
        if asset:
            asset.assigned_employee = "Unassigned"
            asset.assigned_employee_id = None
            await asset.save()

    req.status = AssetRequestStatus.returned
    req.return_date = datetime.now(tz=timezone.utc)
    await req.save()

    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(actor_id=current.user_id, actor_name=actor.name if actor else "Unknown",
                action="asset_request.returned", entity_type="asset_request",
                entity_id=str(req.id), entity_label=req.asset_name)
    return await _out(req)


async def _get_req(req_id: str) -> AssetRequest:
    try:
        oid = PydanticObjectId(req_id)
    except Exception:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    req = await AssetRequest.get(oid)
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    return req
