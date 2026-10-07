"""
app/routers/auth.py — Authentication endpoints.

POST /api/v1/auth/signup  — public, role always "user"
POST /api/v1/auth/login   — rate-limited, returns httpOnly JWT cookie
POST /api/v1/auth/logout  — clears cookie
GET  /api/v1/auth/me      — returns current user from cookie
"""
import re
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models.user import User
from app.models.enums import UserRole
from app.schemas.auth import SignupRequest, LoginRequest, UserOut
from app.core.security import (
    hash_password, verify_password, is_plaintext,
    create_access_token, get_current_user, TokenData,
)
from app.core.config import get_settings
from app.services.audit import audit

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


def _set_cookie(response: Response, token: str) -> None:
    cfg = get_settings()
    response.set_cookie(
        key=cfg.COOKIE_NAME,
        value=token,
        httponly=True,
        secure=cfg.COOKIE_SECURE,
        samesite=cfg.COOKIE_SAME_SITE,
        max_age=cfg.JWT_EXPIRE_HOURS * 3600,
    )


def _user_out(u: User) -> UserOut:
    return UserOut(
        id=str(u.id),
        name=u.name,
        email=u.email,
        role=u.role,
        department=getattr(u, "department", "Production") or "Production",
    )


# ── Signup ────────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest, response: Response):
    email = body.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid email")
    if len(body.password) < 8:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password must be at least 8 characters")
    if body.password != body.confirm_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Passwords do not match")

    if await User.find_one(User.email == email):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")

    user = User(name=body.name.strip(), email=email, password=hash_password(body.password), role=UserRole.user)
    await user.insert()

    token = create_access_token(str(user.id), user.role, getattr(user, "department", "Production"))
    _set_cookie(response, token)
    return _user_out(user)


# ── Login (10/minute rate limit) ──────────────────────────────────────────────

@router.post("/login", response_model=UserOut)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, response: Response):
    email = body.email.strip().lower()
    user = await User.find_one(User.email == email)

    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    # One-shot migration: if plaintext, hash it now
    if is_plaintext(user.password):
        if body.password != user.password:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
        user.password = hash_password(body.password)
        await user.save()
    elif not verify_password(body.password, user.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    token = create_access_token(str(user.id), user.role, getattr(user, "department", "Production"))
    _set_cookie(response, token)
    return _user_out(user)


# ── Logout ────────────────────────────────────────────────────────────────────

@router.post("/logout")
async def logout(response: Response):
    cfg = get_settings()
    response.delete_cookie(key=cfg.COOKIE_NAME)
    return {"message": "Logged out"}


# ── Me ────────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserOut)
async def me(current: TokenData = Depends(get_current_user)):
    from beanie import PydanticObjectId
    user = await User.get(PydanticObjectId(current.user_id))
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return _user_out(user)
