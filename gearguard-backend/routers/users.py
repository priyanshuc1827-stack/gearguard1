from fastapi import APIRouter, HTTPException, status, Query
from models import User
from schemas import UserResponse, UserAdminCreate, UserUpdate
from beanie import PydanticObjectId

router = APIRouter()

VALID_ROLES = ["admin", "manager", "user", "technician", "auditor"]

@router.get("/", response_model=list[UserResponse])
async def get_all_users():
    try:
        users = await User.find_all().to_list()
        return [
            UserResponse(
                id=str(u.id),
                name=u.name,
                email=u.email,
                role=u.role
            )
            for u in users
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch users")

@router.get("/{id}", response_model=UserResponse)
async def get_user(id: str):
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    user = await User.get(oid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(id=str(user.id), name=user.name, email=user.email, role=user.role)

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(body: UserAdminCreate, adminUserId: str = Query(...)):
    role = body.role or "user"
    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Valid roles: {', '.join(VALID_ROLES)}"
        )

    email = body.email.strip().lower()
    existing = await User.find_one(User.email == email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        new_user = User(name=body.name, email=email, password=body.password, role=role)
        await new_user.insert()
        return UserResponse(id=str(new_user.id), name=new_user.name, email=new_user.email, role=new_user.role)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to create user")

@router.patch("/{id}", response_model=UserResponse)
async def update_user(id: str, body: UserUpdate, adminUserId: str = Query(...)):
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    user = await User.get(oid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.name is not None:
        user.name = body.name
    if body.email is not None:
        user.email = body.email
    if body.role is not None:
        if body.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail="Invalid role")
        user.role = body.role

    try:
        await user.save()
        return UserResponse(id=str(user.id), name=user.name, email=user.email, role=user.role)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to update user")

@router.delete("/{id}")
async def delete_user(id: str, adminUserId: str = Query(...)):
    try:
        oid = PydanticObjectId(id)
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    user = await User.get(oid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        await user.delete()
        return {"message": "User deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to delete user")
