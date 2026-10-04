import re
from fastapi import APIRouter, HTTPException, status
from models import User
from schemas import UserResponse, UserCreate, LoginRequest
from beanie import PydanticObjectId

router = APIRouter()

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

@router.get("/users", response_model=list[UserResponse])
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch users"
        )

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: UserCreate):
    name = body.name.strip() if body.name else ""
    email = body.email.strip() if body.email else ""
    password = body.password
    confirm_password = body.confirmPassword
    role = body.role

    if not name or not email or not password or not confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All fields are strictly required"
        )

    if not EMAIL_REGEX.match(email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid email"
        )

    if role and role != "user":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only standard user accounts can be created via signup. Other roles must be created by an administrator."
        )

    if len(password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters"
        )

    if password != confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match"
        )

    # Check duplicate email
    existing_user = await User.find_one(User.email == email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already in use"
        )

    try:
        new_user = User(
            name=name,
            email=email,
            password=password,
            role="user"
        )
        await new_user.insert()
        return UserResponse(
            id=str(new_user.id),
            name=new_user.name,
            email=new_user.email,
            role=new_user.role
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server error during registration"
        )

@router.post("/login", response_model=UserResponse)
async def login(body: LoginRequest):
    try:
        user = await User.find_one(User.email == body.email)
        if not user or user.password != body.password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        return UserResponse(
            id=str(user.id),
            name=user.name,
            email=user.email,
            role=user.role
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )
