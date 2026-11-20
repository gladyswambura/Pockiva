"""Tests for Celery workers — dunning and integrity check."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.models import (
    Account,
    AuditLog,
    Base,
    LedgerEntry,
    Subscription,
    User,
)


# ---------------------------------------------------------------------------
# In-memory SQLite fixture (sync, no Postgres needed)
# ---------------------------------------------------------------------------

@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(engine)
    with Session() as session:
        yield session


def _user(db, user_id: str = "u1") -> User:
    u = User(id=user_id, phone_e164="+254700000001", plan_tier="plus")
    db.add(u)
    db.flush()
    return u


# ---------------------------------------------------------------------------
# Dunning tests
# ---------------------------------------------------------------------------

class TestDunning:
    def test_active_past_due_moves_to_grace(self, db):
        u = _user(db)
        sub = Subscription(
            id="s1",
            user_id=u.id,
            tier="plus",
            billing="monthly",
            status="active",
            current_period_end=datetime.now(UTC) - timedelta(days=1),
        )
        db.add(sub)
        db.commit()

        with patch("app.workers.dunning.SyncSession", return_value=_ctx(db)), \
             patch("app.workers.dunning._send_push"), \
             patch("app.workers.dunning._send_sms"):
            from app.workers.dunning import process_expired_subscriptions
            result = process_expired_subscriptions.run()

        db.refresh(sub)
        assert sub.status == "grace"
        assert result["moved_to_grace"] == 1

    def test_grace_past_due_expires_and_downgrades(self, db):
        u = _user(db)
        sub = Subscription(
            id="s2",
            user_id=u.id,
            tier="plus",
            billing="monthly",
            status="grace",
            current_period_end=datetime.now(UTC) - timedelta(days=1),
        )
        db.add(sub)
        db.commit()

        with patch("app.workers.dunning.SyncSession", return_value=_ctx(db)), \
             patch("app.workers.dunning._send_push"), \
             patch("app.workers.dunning._send_sms"):
            from app.workers.dunning import process_expired_subscriptions
            result = process_expired_subscriptions.run()

        db.refresh(sub)
        db.refresh(u)
        assert sub.status == "expired"
        assert u.plan_tier == "free"
        assert result["expired"] == 1


# ---------------------------------------------------------------------------
# Integrity tests
# ---------------------------------------------------------------------------

class TestIntegrity:
    def test_no_violation_when_balanced(self, db):
        u = _user(db)
        # wallet with 10000 cents
        wallet = Account(id="a1", user_id=u.id, kind="wallet", balance_cents=10000)
        db.add(wallet)
        # deposit entry of 10000
        db.add(LedgerEntry(
            id="e1", user_id=u.id, kind="deposit",
            to_account_id="a1", amount_cents=10000, idempotency_key="ik1",
        ))
        db.commit()

        with patch("app.workers.integrity.SyncSession", return_value=_ctx(db)), \
             patch("app.workers.integrity._alert_admin") as mock_alert:
            from app.workers.integrity import check_ledger_invariant
            result = check_ledger_invariant.run()

        assert result["violations"] == 0
        mock_alert.assert_not_called()

    def test_violation_detected_and_logged(self, db):
        u = _user(db)
        # wallet says 10000 but ledger says 9000 (delta = -1000)
        wallet = Account(id="a2", user_id=u.id, kind="wallet", balance_cents=10000)
        db.add(wallet)
        db.add(LedgerEntry(
            id="e2", user_id=u.id, kind="deposit",
            to_account_id="a2", amount_cents=9000, idempotency_key="ik2",
        ))
        db.commit()

        with patch("app.workers.integrity.SyncSession", return_value=_ctx(db)), \
             patch("app.workers.integrity._alert_admin") as mock_alert:
            from app.workers.integrity import check_ledger_invariant
            result = check_ledger_invariant.run()

        assert result["violations"] == 1
        mock_alert.assert_called_once()
        log_entry = db.query(AuditLog).filter_by(action="integrity_violation").first()
        assert log_entry is not None


# ---------------------------------------------------------------------------
# Helper — wrap a real session in a context manager mock
# ---------------------------------------------------------------------------

class _ctx:
    """Wraps an existing session so `with SyncSession() as db:` works in tests."""
    def __init__(self, session):
        self._session = session

    def __call__(self):
        return self

    def __enter__(self):
        return self._session

    def __exit__(self, *_):
        pass
