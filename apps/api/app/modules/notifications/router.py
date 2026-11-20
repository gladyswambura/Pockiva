from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.models import Device, NotificationPref
from app.core.security import get_current_user_id

router = APIRouter(tags=["notifications"])

_DEFAULT_PREFS = [
    ("push",  "payday_routine"),
    ("push",  "low_envelope"),
    ("push",  "bill_due"),
    ("push",  "loan_due"),
    ("push",  "savings_lock_ending"),
    ("push",  "new_month"),
    ("push",  "subscription_renewal"),
    ("push",  "encouragement"),
    ("email", "receipt"),
    ("sms",   "otp"),
]


class PrefOut(BaseModel):
    id: str
    channel: str
    topic: str
    enabled: bool
    quiet_hours_start: int | None
    quiet_hours_end: int | None


class PrefPatchIn(BaseModel):
    prefs: list[dict]  # [{channel, topic, enabled, quiet_hours_start?, quiet_hours_end?}]


class DeviceIn(BaseModel):
    push_token: str
    platform: str  # web | android | ios


@router.get("/notification-prefs", response_model=list[PrefOut])
async def get_prefs(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> list[PrefOut]:
    rows = (await db.scalars(select(NotificationPref).where(NotificationPref.user_id == user_id))).all()

    if not rows:
        rows = await _bootstrap_prefs(db, user_id)

    return [PrefOut(id=r.id, channel=r.channel, topic=r.topic, enabled=r.enabled,
                    quiet_hours_start=r.quiet_hours_start, quiet_hours_end=r.quiet_hours_end)
            for r in rows]


@router.put("/notification-prefs")
async def update_prefs(
    body: PrefPatchIn,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    for item in body.prefs:
        row = await db.scalar(
            select(NotificationPref).where(
                NotificationPref.user_id == user_id,
                NotificationPref.channel == item["channel"],
                NotificationPref.topic == item["topic"],
            )
        )
        if row:
            row.enabled = item.get("enabled", row.enabled)
            row.quiet_hours_start = item.get("quiet_hours_start", row.quiet_hours_start)
            row.quiet_hours_end = item.get("quiet_hours_end", row.quiet_hours_end)
    await db.commit()
    return {"ok": True}


@router.post("/devices", status_code=201)
async def register_device(
    body: DeviceIn,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    # Upsert by push_token
    existing = await db.scalar(select(Device).where(Device.push_token == body.push_token))
    if existing:
        existing.user_id = user_id
        existing.platform = body.platform
        existing.last_seen = datetime.now(UTC)
        await db.commit()
        return {"device_id": existing.id}

    device = Device(
        id=str(uuid.uuid4()),
        user_id=user_id,
        push_token=body.push_token,
        platform=body.platform,
        last_seen=datetime.now(UTC),
    )
    db.add(device)
    await db.commit()
    return {"device_id": device.id}


async def _bootstrap_prefs(db: AsyncSession, user_id: str) -> list[NotificationPref]:
    prefs = []
    for channel, topic in _DEFAULT_PREFS:
        p = NotificationPref(
            id=str(uuid.uuid4()),
            user_id=user_id,
            channel=channel,
            topic=topic,
            enabled=True,
        )
        db.add(p)
        prefs.append(p)
    await db.commit()
    return prefs
