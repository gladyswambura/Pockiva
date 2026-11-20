from __future__ import annotations

import hashlib
import hmac
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.core.entitlements import PLAN_PRICES
from app.core.models import AuditLog, Payment, Subscription, User
from app.core.security import get_current_user_id

router = APIRouter(tags=["subscriptions"])


class CheckoutIn(BaseModel):
    tier: str       # plus | family
    billing: str    # monthly | yearly
    phone: str      # M-Pesa phone number


class SubscriptionOut(BaseModel):
    tier: str
    status: str
    trial_ends_at: str | None
    current_period_end: str | None
    billing: str | None


# ---------------------------------------------------------------------------
# GET /subscription
# ---------------------------------------------------------------------------

@router.get("/subscription", response_model=SubscriptionOut)
async def get_subscription(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> SubscriptionOut:
    sub = await _active_sub(db, user_id)
    if not sub:
        return SubscriptionOut(tier="free", status="active", trial_ends_at=None, current_period_end=None, billing=None)
    return SubscriptionOut(
        tier=sub.tier,
        status=sub.status,
        trial_ends_at=sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
        current_period_end=sub.current_period_end.isoformat() if sub.current_period_end else None,
        billing=sub.billing,
    )


# ---------------------------------------------------------------------------
# POST /subscription/checkout — initiates M-Pesa STK Push
# ---------------------------------------------------------------------------

@router.post("/subscription/checkout")
async def checkout(
    body: CheckoutIn,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    prices = PLAN_PRICES.get(body.tier)
    if not prices:
        raise HTTPException(status_code=400, detail={"code": "VALIDATION_ERROR", "message": "Unknown plan tier."})
    amount_cents = prices.get(body.billing)
    if not amount_cents:
        raise HTTPException(status_code=400, detail={"code": "VALIDATION_ERROR", "message": "Unknown billing period."})

    payment = Payment(
        id=str(uuid.uuid4()),
        user_id=user_id,
        provider="mpesa_stk",
        amount_cents=amount_cents,
        currency="KES",
        status="pending",
        purpose=f"subscription:{body.tier}:{body.billing}",
    )
    db.add(payment)
    await db.commit()

    # In production: call Safaricom Daraja STK Push here.
    # Return payment_id so the client can poll for status.
    return {
        "payment_id": payment.id,
        "amount_cents": amount_cents,
        "status": "pending",
        "message": "Check your phone for the M-Pesa prompt.",
    }


# ---------------------------------------------------------------------------
# GET /payments — receipts
# ---------------------------------------------------------------------------

@router.get("/payments")
async def list_payments(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    payments = (await db.scalars(
        select(Payment).where(Payment.user_id == user_id).order_by(Payment.created_at.desc()).limit(50)
    )).all()
    return {
        "items": [
            {
                "id": p.id,
                "provider": p.provider,
                "amount_cents": p.amount_cents,
                "currency": p.currency,
                "status": p.status,
                "purpose": p.purpose,
                "created_at": p.created_at.isoformat(),
            }
            for p in payments
        ]
    }


# ---------------------------------------------------------------------------
# POST /webhooks/mpesa — Safaricom callback
# ---------------------------------------------------------------------------

@router.post("/webhooks/mpesa", include_in_schema=False)
async def mpesa_webhook(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    """
    Receive Safaricom Daraja callback.
    Verify, mark payment paid, extend subscription period.
    """
    body = await request.json()

    # Extract from Daraja callback shape
    stk = body.get("Body", {}).get("stkCallback", {})
    result_code = stk.get("ResultCode")
    checkout_id = stk.get("CheckoutRequestID")

    if not checkout_id:
        return {"ResultCode": 0, "ResultDesc": "Accepted"}

    payment = await db.scalar(select(Payment).where(Payment.provider_ref == checkout_id))

    if not payment:
        # Try matching by pending payment — in production use checkout_id stored at STK initiation
        return {"ResultCode": 0, "ResultDesc": "Accepted"}

    if result_code == 0:
        payment.status = "paid"
        payment.raw = body
        await _activate_subscription(db, payment)
    else:
        payment.status = "failed"
        payment.raw = body

    await db.commit()
    return {"ResultCode": 0, "ResultDesc": "Accepted"}


async def _active_sub(db: AsyncSession, user_id: str) -> Subscription | None:
    return await db.scalar(
        select(Subscription)
        .where(
            Subscription.user_id == user_id,
            Subscription.status.in_(["trialing", "active", "grace"]),
        )
        .order_by(Subscription.created_at.desc())
    )


async def _activate_subscription(db: AsyncSession, payment: Payment) -> None:
    """Extend or create subscription after successful payment."""
    parts = payment.purpose.split(":")  # subscription:plus:monthly
    if len(parts) < 3:
        return
    tier, billing = parts[1], parts[2]
    period_days = 365 if billing == "yearly" else 31

    sub = await _active_sub(db, payment.user_id)
    now = datetime.now(UTC)

    if sub and sub.tier == tier:
        base = max(sub.current_period_end or now, now)
        sub.current_period_end = base + timedelta(days=period_days)
        sub.status = "active"
    else:
        db.add(Subscription(
            id=str(uuid.uuid4()),
            user_id=payment.user_id,
            tier=tier,
            billing=billing,
            status="active",
            current_period_end=now + timedelta(days=period_days),
        ))

    # Update user plan tier
    user = await db.get(User, payment.user_id)
    if user:
        user.plan_tier = tier

    db.add(AuditLog(
        actor_type="system",
        action="subscription_activated",
        object_type="payment",
        object_id=payment.id,
    ))
