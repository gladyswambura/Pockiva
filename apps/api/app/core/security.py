"""Security utilities: JWT, hashing, current-user dependency."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
_bearer = HTTPBearer()


# ---------------------------------------------------------------------------
# Hashing
# ---------------------------------------------------------------------------

def hash_secret(value: str) -> str:
    return _pwd.hash(value)


def verify_secret(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


def hash_token(token: str) -> str:
    """SHA-256 hash for storing refresh tokens."""
    return hashlib.sha256(token.encode()).hexdigest()


def generate_otp() -> str:
    """6-digit numeric OTP."""
    return f"{secrets.randbelow(1_000_000):06d}"


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def create_access_token(user_id: str) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "access"},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token() -> str:
    """Opaque random token; stored as a hash in the DB."""
    return secrets.token_urlsafe(48)


def decode_access_token(token: str) -> str:
    """Returns user_id or raises 401."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "access":
            raise JWTError("wrong type")
        user_id: str = payload["sub"]
        return user_id
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

async def get_current_user_id(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    return decode_access_token(creds.credentials)


async def get_current_admin_user_id(
    user_id: str = Depends(get_current_user_id),
) -> str:
    """Require both a valid user session and explicit admin allowlisting."""
    admin_ids = {item.strip() for item in settings.admin_user_ids.split(",") if item.strip()}
    if user_id not in admin_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return user_id
