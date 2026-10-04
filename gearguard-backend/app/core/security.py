"""
app/core/security.py — Password hashing, JWT creation/verification, RBAC dependencies.

Role matrix (authoritative source — update here, nowhere else):
  admin      : full access
  manager    : read users/audit; create/approve assets/work orders; no user admin
  technician : read/update own work orders; create work orders
  user       : read own assets; create/return asset requests
  auditor    : read-only audit, reports, assets, work orders
"""
from __future__ import annotations
import bcrypt
import jwt as pyjwt
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, status
from app.core.config import get_settings


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        if hashed.startswith("$2b$") or hashed.startswith("$2a$"):
            return bcrypt.checkpw(plain.encode(), hashed.encode())
        # Legacy plaintext — reject (migration script must be run first)
        return False
    except Exception:
        return False


def is_plaintext(stored: str) -> bool:
    """Detect un-migrated plaintext password."""
    return not (stored.startswith("$2b$") or stored.startswith("$2a$"))


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(user_id: str, role: str) -> str:
    cfg = get_settings()
    payload = {
        "sub": user_id,
        "role": role,
        "iat": datetime.now(tz=timezone.utc),
        "exp": datetime.now(tz=timezone.utc) + timedelta(hours=cfg.JWT_EXPIRE_HOURS),
    }
    return pyjwt.encode(payload, cfg.JWT_SECRET, algorithm=cfg.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    cfg = get_settings()
    return pyjwt.decode(token, cfg.JWT_SECRET, algorithms=[cfg.JWT_ALGORITHM])


# ---------------------------------------------------------------------------
# FastAPI dependency — current user from httpOnly cookie
# ---------------------------------------------------------------------------

class TokenData:
    __slots__ = ("user_id", "role")

    def __init__(self, user_id: str, role: str):
        self.user_id = user_id
        self.role = role


_UNAUTH = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    gg_token: Optional[str] = Cookie(None),
) -> TokenData:
    cfg = get_settings()
    token = gg_token  # cookie name is "gg_token"
    if not token:
        raise _UNAUTH
    try:
        payload = decode_token(token)
        uid = payload.get("sub", "")
        role = payload.get("role", "")
        if not uid or not role:
            raise _UNAUTH
        return TokenData(user_id=uid, role=role)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    except pyjwt.PyJWTError:
        raise _UNAUTH


# ---------------------------------------------------------------------------
# RBAC dependency factory
# ---------------------------------------------------------------------------

def require(*roles: str):
    """
    FastAPI Depends factory — ensures the caller has one of the listed roles.

    Usage:
        @router.post("/", dependencies=[Depends(require("admin", "manager"))])
    """
    async def _guard(current: TokenData = Depends(get_current_user)) -> TokenData:
        if current.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of: {', '.join(roles)}",
            )
        return current
    return _guard
