"""app/routers/users.py — User management (admin-only mutations, department scoping for managers)."""
from typing import Optional
from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import get_current_user, require, TokenData
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import UserOut
from app.schemas.users import UserAdminCreate, UserAdminUpdate
from app.core.security import hash_password
from app.services.audit import audit

router = APIRouter(prefix="/users", tags=["users"])

VALID_ROLES = {r.value for r in UserRole}


def _out(u: User) -> UserOut:
    return UserOut(
        id=str(u.id),
        name=u.name,
        email=u.email,
        role=u.role,
        department=getattr(u, "department", "Production") or "Production",
    )


@router.get("/", response_model=list[UserOut])
async def list_users(
    department: Optional[str] = Query(None),
    current: TokenData = Depends(require("admin", "manager", "auditor")),
):
    current_user = await User.get(PydanticObjectId(current.user_id))
    
    # Managers can strictly only see users/employees belonging to their own department
    if current.role == UserRole.manager:
        mgr_dept = getattr(current_user, "department", None)
        if mgr_dept and mgr_dept != "All":
            users = await User.find(User.department == mgr_dept).to_list()
        else:
            users = await User.find_all().to_list()
    elif department and department != "All":
        users = await User.find(User.department == department).to_list()
    else:
        users = await User.find_all().to_list()

    return [_out(u) for u in users]


@router.get("/me", response_model=UserOut)
async def get_me(current: TokenData = Depends(get_current_user)):
    user = await User.get(PydanticObjectId(current.user_id))
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return _out(user)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: str, current: TokenData = Depends(require("admin", "manager", "auditor"))):
    try:
        user = await User.get(PydanticObjectId(user_id))
    except Exception:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    # If manager, enforce that target user belongs to manager's department
    if current.role == UserRole.manager:
        current_user = await User.get(PydanticObjectId(current.user_id))
        mgr_dept = getattr(current_user, "department", None)
        if mgr_dept and mgr_dept != "All" and getattr(user, "department", None) != mgr_dept:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied: User is in another department")

    return _out(user)


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(body: UserAdminCreate, current: TokenData = Depends(require("admin"))):
    email = body.email.strip().lower()
    if await User.find_one(User.email == email):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")
    if body.role not in VALID_ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid role: {body.role}")

    dept = body.department.strip() if body.department else "Production"
    user = User(
        name=body.name.strip(),
        email=email,
        password=hash_password(body.password),
        role=body.role,
        department=dept,
    )
    await user.insert()

    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(
        actor_id=current.user_id, actor_name=actor.name if actor else "Unknown",
        action="user.created", entity_type="user",
        entity_id=str(user.id), entity_label=user.email,
        after={"role": user.role, "name": user.name, "department": user.department},
    )
    return _out(user)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(user_id: str, body: UserAdminUpdate, current: TokenData = Depends(get_current_user)):
    is_self = current.user_id == user_id
    is_admin = current.role == UserRole.admin

    if not is_admin and not is_self:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    if not is_admin and body.role is not None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins can change roles")
    if not is_admin and body.department is not None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins can change department")

    try:
        user = await User.get(PydanticObjectId(user_id))
    except Exception:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    before = {}
    after = {}
    if body.name:
        before["name"] = user.name
        user.name = body.name.strip()
        after["name"] = user.name
    if body.email:
        before["email"] = user.email
        user.email = body.email.strip().lower()
        after["email"] = user.email
    if body.role and is_admin:
        before["role"] = user.role
        user.role = body.role
        after["role"] = user.role
    if body.department and is_admin:
        before["department"] = user.department
        user.department = body.department.strip()
        after["department"] = user.department

    await user.save()
    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(
        actor_id=current.user_id, actor_name=actor.name if actor else "Unknown",
        action="user.updated", entity_type="user",
        entity_id=str(user.id), entity_label=user.email,
        before=before or None, after=after or None,
    )
    return _out(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, current: TokenData = Depends(require("admin"))):
    try:
        user = await User.get(PydanticObjectId(user_id))
    except Exception:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    actor = await User.get(PydanticObjectId(current.user_id))
    await audit(
        actor_id=current.user_id, actor_name=actor.name if actor else "Unknown",
        action="user.deleted", entity_type="user",
        entity_id=str(user.id), entity_label=user.email,
        before={"name": user.name, "role": user.role, "department": getattr(user, "department", None)},
    )
    await user.delete()
