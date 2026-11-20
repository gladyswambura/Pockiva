"""Auth service — OTP flow, JWT issuance, user bootstrap."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.models import Account, OtpToken, RefreshToken, User
from app.core.security import (
    create_access_token,
    create_refresh_token,
    generate_otp,
    hash_secret,
    hash_token,
    verify_secret,
)
from app.workers.notifications import send_otp_email, send_otp_sms


async def request_otp(session: AsyncSession, identifier: str) -> str:
    """Create an OTP, store its hash, return the plaintext code (caller sends it)."""
    code = generate_otp()
    expires = datetime.now(UTC).replace(tzinfo=None) + timedelta(minutes=settings.otp_expire_minutes)
    token = OtpToken(
        id=str(uuid.uuid4()),
        identifier=identifier,
        code_hash=hash_secret(code),
        expires_at=expires,
    )
    session.add(token)
    await session.commit()
    # Send OTP via SMS or email
    if identifier.startswith("+"):
        send_otp_sms(identifier, code)
    elif "@" in identifier:
        send_otp_email(identifier, code)
    return code


async def verify_otp(session: AsyncSession, identifier: str, code: str) -> tuple[str, str]:
    """
    Verify OTP. Returns (access_token, refresh_token).
    Creates the user and their wallet+savings accounts on first login.
    """
    result = await session.scalars(
        select(OtpToken)
        .where(
            OtpToken.identifier == identifier,
            OtpToken.used.is_(False),
            OtpToken.expires_at > datetime.now(UTC).replace(tzinfo=None),
        )
        .order_by(OtpToken.created_at.desc())
        .limit(1)
    )
    token = result.first()

    if not token:
        raise HTTPException(status_code=400, detail={"code": "VALIDATION_ERROR", "message": "Code expired or not found."})

    token.attempts += 1
    if token.attempts > settings.otp_max_attempts:
        await session.commit()
        raise HTTPException(status_code=429, detail={"code": "RATE_LIMITED", "message": "Too many attempts."})

    if not verify_secret(code, token.code_hash):
        await session.commit()
        raise HTTPException(status_code=400, detail={"code": "VALIDATION_ERROR", "message": "Incorrect code."})

    token.used = True

    # Upsert user
    is_phone = identifier.startswith("+")
    user = await _get_or_create_user(session, identifier, is_phone)

    access = create_access_token(user.id)
    refresh_raw = create_refresh_token()
    refresh_expires = datetime.now(UTC).replace(tzinfo=None) + timedelta(days=settings.refresh_token_expire_days)

    session.add(RefreshToken(
        id=str(uuid.uuid4()),
        user_id=user.id,
        token_hash=hash_token(refresh_raw),
        expires_at=refresh_expires,
    ))
    await session.commit()
    return access, refresh_raw


async def refresh_tokens(session: AsyncSession, raw_token: str) -> tuple[str, str]:
    """Rotate refresh token. Returns new (access, refresh) pair."""
    token_hash = hash_token(raw_token)
    result = await session.scalars(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked.is_(False),
            RefreshToken.expires_at > datetime.now(UTC).replace(tzinfo=None),
        )
    )
    rt = result.first()
    if not rt:
        raise HTTPException(status_code=401, detail={"code": "VALIDATION_ERROR", "message": "Invalid refresh token."})

    rt.revoked = True  # rotate

    access = create_access_token(rt.user_id)
    new_raw = create_refresh_token()
    new_expires = datetime.now(UTC).replace(tzinfo=None) + timedelta(days=settings.refresh_token_expire_days)
    session.add(RefreshToken(
        id=str(uuid.uuid4()),
        user_id=rt.user_id,
        token_hash=hash_token(new_raw),
        expires_at=new_expires,
    ))
    await session.commit()
    return access, new_raw


async def logout_all(session: AsyncSession, user_id: str) -> None:
    """Revoke all refresh tokens for the user."""
    tokens = await session.scalars(
        select(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
    )
    for t in tokens:
        t.revoked = True
    await session.commit()


async def _get_or_create_user(session: AsyncSession, identifier: str, is_phone: bool) -> User:
    if is_phone:
        result = await session.scalars(select(User).where(User.phone_e164 == identifier))
    else:
        result = await session.scalars(select(User).where(User.email == identifier))

    user = result.first()
    if user:
        return user

    user = User(
        id=str(uuid.uuid4()),
        phone_e164=identifier if is_phone else None,
        email=None if is_phone else identifier,
    )
    session.add(user)
    await session.flush()  # get the id

    # Bootstrap wallet and savings accounts
    session.add(Account(id=str(uuid.uuid4()), user_id=user.id, kind="wallet"))
    session.add(Account(id=str(uuid.uuid4()), user_id=user.id, kind="savings"))
    return user
