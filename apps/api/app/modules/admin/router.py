from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.core.models import Account, AuditLog, Device, LedgerEntry, Payment, Subscription, User
from app.core.security import get_current_admin_user_id

router = APIRouter(tags=["admin"])


class GrantIn(BaseModel):
    user_id: str
    days: int = 31
    reason: str


class SuspendIn(BaseModel):
    reason: str


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

@router.get("/metrics")
async def admin_metrics(
    db: AsyncSession = Depends(get_db),
    actor_id: str = Depends(get_current_admin_user_id),
) -> dict:
    now = datetime.now(UTC)
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)
    this_week_start = now - timedelta(days=7)

    active_subs = (await db.scalars(
        select(Subscription).where(Subscription.status.in_(["active", "trialing"]))
    )).all()
    trialing = [s for s in active_subs if s.status == "trialing"]
    paying   = [s for s in active_subs if s.status == "active"]

    paid_payments = (await db.scalars(
        select(Payment).where(
            Payment.status == "paid",
            Payment.created_at >= thirty_days_ago,
        )
    )).all()
    mrr_cents = sum(
        p.amount_cents if "monthly" in p.purpose else p.amount_cents // 12
        for p in paid_payments
    )

    churned = (await db.scalars(
        select(Subscription).where(
            Subscription.status == "canceled",
            Subscription.created_at >= thirty_days_ago,
        )
    )).all()

    total_users = await db.scalar(
        select(func.count(User.id)).where(User.deleted_at.is_(None))
    )
    new_this_week = await db.scalar(
        select(func.count(User.id)).where(
            User.deleted_at.is_(None),
            User.created_at >= this_week_start,
        )
    )

    return {
        "total_users": total_users,
        "new_this_week": new_this_week,
        "active_paying": len(paying),
        "trialing": len(trialing),
        "churned_30d": len(churned),
        "mrr_cents": mrr_cents,
    }


# ---------------------------------------------------------------------------
# Users — specific routes MUST come before /users/{user_id}
# ---------------------------------------------------------------------------

@router.get("/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    actor_id: str = Depends(get_current_admin_user_id),
    limit: int = 100,
    offset: int = 0,
) -> dict:
    """List all users with counts. Never returns envelope names, notes or balances."""
    users = (await db.scalars(
        select(User)
        .where(User.deleted_at.is_(None))
        .order_by(User.created_at.desc())
        .limit(limit).offset(offset)
    )).all()

    total = await db.scalar(
        select(func.count(User.id)).where(User.deleted_at.is_(None))
    )

    rows = []
    for u in users:
        envelope_count = await db.scalar(
            select(func.count(Account.id))
            .where(Account.user_id == u.id, Account.kind == "envelope")
        )
        device_count = await db.scalar(
            select(func.count(Device.id)).where(Device.user_id == u.id)
        )
        entry_count = await db.scalar(
            select(func.count(LedgerEntry.id)).where(LedgerEntry.user_id == u.id)
        )
        sub = await db.scalar(
            select(Subscription)
            .where(Subscription.user_id == u.id)
            .order_by(Subscription.created_at.desc())
        )
        if u.suspended_at:
            status = "suspended"
        elif sub and sub.status == "trialing":
            status = "trial"
        elif sub and sub.status == "active":
            status = "active"
        else:
            status = "active"

        rows.append({
            "id": u.id,
            "display_name": u.display_name,
            "email": u.email,
            "phone_e164": u.phone_e164,
            "plan_tier": u.plan_tier,
            "status": status,
            "created_at": u.created_at.isoformat(),
            "suspended_at": u.suspended_at.isoformat() if u.suspended_at else None,
            "envelope_count": envelope_count or 0,
            "device_count": device_count or 0,
            "entry_count": entry_count or 0,
        })

    return {"items": rows, "total": total}


@router.get("/users/by-email/{email}")
async def find_user_by_email(
    email: str,
    db: AsyncSession = Depends(get_db),
    actor_id: str = Depends(get_current_admin_user_id),
) -> dict:
    user = await db.scalar(select(User).where(User.email == email.lower().strip()))
    if not user:
        raise HTTPException(status_code=404, detail="No user found with that email.")
    _audit(db, actor_id, "admin_lookup_by_email", "user", user.id)
    await db.commit()
    existing_ids = [i.strip() for i in settings.admin_user_ids.split(",") if i.strip()]
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "plan_tier": user.plan_tier,
        "created_at": user.created_at.isoformat(),
        "env_line": f"ADMIN_USER_IDS={','.join(existing_ids + [user.id])}",
    }


@router.post("/users/{user_id}/suspend")
async def suspend_user(
    user_id: str,
    body: SuspendIn,
    db: AsyncSession = Depends(get_db),
    actor_id: str = Depends(get_current_admin_user_id),
) -> dict:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.suspended_at = datetime.now(UTC)
    _audit(db, actor_id, "admin_suspend_user", "user", user_id, note=body.reason)
    await db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/reactivate")
async def reactivate_user(
    user_id: str,
    body: SuspendIn,
    db: AsyncSession = Depends(get_db),
    actor_id: str = Depends(get_current_admin_user_id),
) -> dict:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.suspended_at = None
    _audit(db, actor_id, "admin_reactivate_user", "user", user_id, note=body.reason)
    await db.commit()
    return {"ok": True}


@router.get("/users/{user_id}")
async def admin_get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    actor_id: str = Depends(get_current_admin_user_id),
) -> dict:
    """Look up a user by id. Never returns envelope names or notes."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    sub = await db.scalar(
        select(Subscription)
        .where(Subscription.user_id == user_id)
        .order_by(Subscription.created_at.desc())
    )
    _audit(db, actor_id, "admin_view_user", "user", user_id)
    await db.commit()
    return {
        "id": user.id,
        "phone_e164": user.phone_e164,
        "email": user.email,
        "display_name": user.display_name,
        "plan_tier": user.plan_tier,
        "locale": user.locale,
        "created_at": user.created_at.isoformat(),
        "deleted_at": user.deleted_at.isoformat() if user.deleted_at else None,
        "subscription": {
            "tier": sub.tier,
            "status": sub.status,
            "current_period_end": sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
        } if sub else None,
    }


# ---------------------------------------------------------------------------
# Billing / grants
# ---------------------------------------------------------------------------

@router.post("/grant-free-month")
async def grant_free_month(
    body: GrantIn,
    db: AsyncSession = Depends(get_db),
    actor_id: str = Depends(get_current_admin_user_id),
) -> dict:
    sub = await db.scalar(
        select(Subscription)
        .where(Subscription.user_id == body.user_id)
        .order_by(Subscription.created_at.desc())
    )
    now = datetime.now(UTC)
    if sub:
        base = max(sub.current_period_end or now, now)
        sub.current_period_end = base + timedelta(days=body.days)
        sub.status = "active"
    else:
        db.add(Subscription(
            id=str(uuid.uuid4()),
            user_id=body.user_id,
            tier="plus",
            billing="monthly",
            status="active",
            current_period_end=now + timedelta(days=body.days),
        ))
        user = await db.get(User, body.user_id)
        if user:
            user.plan_tier = "plus"

    _audit(db, actor_id, "admin_grant_free_month", "user", body.user_id, note=body.reason)
    await db.commit()
    return {"ok": True, "days_granted": body.days}


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

@router.get("/audit-log")
async def get_audit_log(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    actor_id: str = Depends(get_current_admin_user_id),
) -> dict:
    rows = (await db.scalars(
        select(AuditLog).order_by(AuditLog.at.desc()).limit(limit)
    )).all()
    return {
        "items": [
            {
                "id": r.id,
                "actor_type": r.actor_type,
                "actor_id": r.actor_id,
                "action": r.action,
                "object_type": r.object_type,
                "object_id": r.object_id,
                "at": r.at.isoformat(),
            }
            for r in rows
        ]
    }


# ---------------------------------------------------------------------------
# Admin team
# ---------------------------------------------------------------------------

@router.get("/admins")
async def list_admins(
    actor_id: str = Depends(get_current_admin_user_id),
) -> dict:
    ids = [i.strip() for i in settings.admin_user_ids.split(",") if i.strip()]
    return {"admin_user_ids": ids}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _audit(
    db: AsyncSession,
    actor_id: str,
    action: str,
    object_type: str,
    object_id: str,
    note: str | None = None,
) -> None:
    db.add(AuditLog(
        actor_type="admin",
        actor_id=actor_id,
        action=action,
        object_type=object_type,
        object_id=object_id,
    ))
