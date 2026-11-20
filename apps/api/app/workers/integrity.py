"""Nightly ledger integrity check.

Invariant: bank_balance = wallet + Σ envelopes + savings
bank_balance is derived as the sum of all deposit entries minus all spend entries
for the user (the true external balance). We compare it against the sum of all
account balances.
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy import func, select

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.db import SyncSession
from app.core.models import Account, AuditLog, LedgerEntry, User

log = logging.getLogger(__name__)


@celery_app.task(name="app.workers.integrity.check_ledger_invariant", bind=True, max_retries=1)
def check_ledger_invariant(self) -> dict:  # type: ignore[override]
    violations: list[dict] = []

    with SyncSession() as db:
        users = db.scalars(select(User).where(User.deleted_at.is_(None))).all()

        for user in users:
            # Sum of all account balances (wallet + savings + envelopes)
            total_balance = db.scalar(
                select(func.coalesce(func.sum(Account.balance_cents), 0)).where(
                    Account.user_id == user.id,
                    Account.archived_at.is_(None),
                )
            ) or 0

            # True bank balance from ledger: deposits in - spends out
            deposits = db.scalar(
                select(func.coalesce(func.sum(LedgerEntry.amount_cents), 0)).where(
                    LedgerEntry.user_id == user.id,
                    LedgerEntry.kind == "deposit",
                )
            ) or 0

            spends = db.scalar(
                select(func.coalesce(func.sum(LedgerEntry.amount_cents), 0)).where(
                    LedgerEntry.user_id == user.id,
                    LedgerEntry.kind == "spend",
                )
            ) or 0

            # Loan payments reduce owed but also leave the wallet — they are
            # internal transfers, so bank_balance = deposits - spends holds.
            bank_balance = deposits - spends

            if bank_balance != total_balance:
                delta = bank_balance - total_balance
                violations.append({
                    "user_id": user.id,
                    "bank_balance": bank_balance,
                    "total_balance": total_balance,
                    "delta": delta,
                })
                db.add(AuditLog(
                    actor_type="system",
                    action="integrity_violation",
                    object_type="user",
                    object_id=user.id,
                ))
                log.error(
                    "integrity_violation",
                    user_id=user.id,
                    bank_balance=bank_balance,
                    total_balance=total_balance,
                    delta=delta,
                )

        db.commit()

    if violations:
        _alert_admin(violations)

    log.info(
        "integrity_check_complete",
        users_checked=len(users),
        violations=len(violations),
        ran_at=datetime.now(UTC).isoformat(),
    )
    return {"users_checked": len(users), "violations": len(violations)}


def _alert_admin(violations: list[dict]) -> None:
    """Send SMS alert to admin phone if configured."""
    admin_phone = getattr(settings, "admin_alert_phone", None)
    if not admin_phone or not settings.at_api_key:
        return
    try:
        import africastalking
        africastalking.initialize(settings.at_username, settings.at_api_key)
        sms = africastalking.SMS
        count = len(violations)
        sms.send(
            f"Pockiva ALERT: {count} ledger integrity violation(s) detected. Check audit_log.",
            [admin_phone],
            sender_id=settings.at_sender_id,
        )
    except Exception as exc:
        log.error("admin_alert_failed", error=str(exc))
