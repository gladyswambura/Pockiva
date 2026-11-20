"""Subscription dunning — grace period and expiry enforcement."""
from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.celery_app import celery_app
from app.core.db import SyncSession
from app.core.models import AuditLog, Subscription, User
from app.workers.notifications import _send_push, _send_sms

log = logging.getLogger(__name__)

GRACE_DAYS = 7


@celery_app.task(name="app.workers.dunning.process_expired_subscriptions", bind=True, max_retries=2)
def process_expired_subscriptions(self) -> dict:  # type: ignore[override]
    now = datetime.now(UTC)
    moved_to_grace = 0
    expired = 0

    with SyncSession() as db:
        # 1. Active subs past period end → grace
        active_past_due = db.scalars(
            select(Subscription).where(
                Subscription.status == "active",
                Subscription.current_period_end < now,
            )
        ).all()
        for sub in active_past_due:
            sub.status = "grace"
            sub.current_period_end = now + timedelta(days=GRACE_DAYS)
            _send_push(
                db, sub.user_id, "subscription_renewal",
                "Payment overdue",
                "Your Pockiva Plus payment is overdue. You have 7 days before access is restricted.",
            )
            _send_sms(
                db, sub.user_id, "subscription_renewal",
                "Pockiva: Your Plus subscription payment is overdue. Please renew to keep full access.",
            )
            db.add(AuditLog(
                actor_type="system",
                action="subscription_grace",
                object_type="subscription",
                object_id=sub.id,
            ))
            moved_to_grace += 1

        # 2. Grace subs past grace end → expired, downgrade user
        grace_past_due = db.scalars(
            select(Subscription).where(
                Subscription.status == "grace",
                Subscription.current_period_end < now,
            )
        ).all()
        for sub in grace_past_due:
            sub.status = "expired"
            user = db.get(User, sub.user_id)
            if user:
                user.plan_tier = "free"
            _send_push(
                db, sub.user_id, "subscription_renewal",
                "Subscription expired",
                "Your Pockiva Plus subscription has expired. Upgrade to restore full access.",
            )
            _send_sms(
                db, sub.user_id, "subscription_renewal",
                "Pockiva: Your Plus subscription has expired. Visit the app to renew.",
            )
            db.add(AuditLog(
                actor_type="system",
                action="subscription_expired",
                object_type="subscription",
                object_id=sub.id,
            ))
            expired += 1

        db.commit()

    log.info("dunning_complete", moved_to_grace=moved_to_grace, expired=expired)
    return {"moved_to_grace": moved_to_grace, "expired": expired}
