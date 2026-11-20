"""SQLAlchemy ORM models for Pockiva.

All money is stored as integer cents (bigint). No floats.
Fields ending _enc are ciphertext bytes in privacy mode.
Uses portable types (no PostgreSQL-specific dialects) so SQLite works for local dev.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    Enum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    LargeBinary,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return str(uuid.uuid4())


AccountKind = Enum("wallet", "savings", "envelope", name="account_kind")
EntryKind = Enum(
    "deposit", "allocate", "release", "spend", "save", "unsave",
    "loan_received", "loan_payment",
    name="entry_kind",
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    phone_e164: Mapped[str | None] = mapped_column(Text, unique=True)
    email: Mapped[str | None] = mapped_column(Text)
    display_name: Mapped[str | None] = mapped_column(Text)
    country: Mapped[str] = mapped_column(String(2), nullable=False, default="KE")
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="KES")
    locale: Mapped[str] = mapped_column(Text, nullable=False, default="en")
    plan_tier: Mapped[str] = mapped_column(Text, nullable=False, default="free")
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column()
    suspended_at: Mapped[datetime | None] = mapped_column()

    accounts: Mapped[list["Account"]] = relationship(back_populates="user")
    devices: Mapped[list["Device"]] = relationship(back_populates="user")
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="user")

    __table_args__ = (
        Index("users_email_lower", func.lower(email), unique=True),
    )


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    push_token: Mapped[str | None] = mapped_column(Text)
    platform: Mapped[str | None] = mapped_column(Text)
    last_seen: Mapped[datetime | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="devices")


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(AccountKind, nullable=False)
    group_code: Mapped[str | None] = mapped_column(Text)
    name_enc: Mapped[bytes | None] = mapped_column(LargeBinary)
    color: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    plan_cents: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    goal_cents: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    balance_cents: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    funded_cents: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    spent_cents: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    lock_until: Mapped[date | None] = mapped_column(Date)
    archived_at: Mapped[datetime | None] = mapped_column()
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship(back_populates="accounts")
    loan: Mapped["Loan | None"] = relationship(back_populates="account", uselist=False)

    __table_args__ = (
        CheckConstraint("plan_cents >= 0", name="ck_account_plan_cents"),
        CheckConstraint("goal_cents >= 0", name="ck_account_goal_cents"),
        CheckConstraint("balance_cents >= 0", name="ck_account_balance_cents"),
        CheckConstraint("funded_cents >= 0", name="ck_account_funded_cents"),
        CheckConstraint("spent_cents >= 0", name="ck_account_spent_cents"),
    )


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(EntryKind, nullable=False)
    from_account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id"))
    to_account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id"))
    amount_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    note_enc: Mapped[bytes | None] = mapped_column(LargeBinary)
    idempotency_key: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("amount_cents > 0", name="ck_entry_amount_positive"),
        CheckConstraint(
            "from_account_id IS NOT NULL OR to_account_id IS NOT NULL",
            name="ck_entry_has_account",
        ),
        UniqueConstraint("user_id", "idempotency_key", name="uq_entry_idempotency"),
        Index("ledger_user_time", "user_id", "created_at"),
    )


class Loan(Base):
    __tablename__ = "loans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    lender_enc: Mapped[bytes | None] = mapped_column(LargeBinary)
    borrowed_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    total_repay_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    owed_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    monthly_cents: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    due_day: Mapped[int | None] = mapped_column(SmallInteger)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    account: Mapped["Account"] = relationship(back_populates="loan")

    __table_args__ = (
        CheckConstraint("borrowed_cents > 0", name="ck_loan_borrowed_positive"),
        CheckConstraint("total_repay_cents >= borrowed_cents", name="ck_loan_repay_gte_borrowed"),
        CheckConstraint("owed_cents >= 0", name="ck_loan_owed_non_negative"),
        CheckConstraint("monthly_cents >= 0", name="ck_loan_monthly_non_negative"),
        CheckConstraint("due_day BETWEEN 1 AND 31", name="ck_loan_due_day"),
    )


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tier: Mapped[str] = mapped_column(Text, nullable=False)
    billing: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    trial_ends_at: Mapped[datetime | None] = mapped_column()
    current_period_end: Mapped[datetime | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="subscriptions")

    __table_args__ = (
        CheckConstraint("billing IN ('monthly','yearly')", name="ck_sub_billing"),
        CheckConstraint(
            "status IN ('trialing','active','grace','canceled','expired')",
            name="ck_sub_status",
        ),
    )


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    provider: Mapped[str] = mapped_column(Text, nullable=False)
    provider_ref: Mapped[str | None] = mapped_column(Text, unique=True)
    amount_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    raw: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("amount_cents > 0", name="ck_payment_amount_positive"),
        CheckConstraint("status IN ('pending','paid','failed','expired')", name="ck_payment_status"),
    )


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    actor_type: Mapped[str] = mapped_column(Text, nullable=False)
    actor_id: Mapped[str | None] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(Text, nullable=False)
    object_type: Mapped[str | None] = mapped_column(Text)
    object_id: Mapped[str | None] = mapped_column(String(36))
    ip: Mapped[str | None] = mapped_column(Text)
    at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())


class NotificationPref(Base):
    __tablename__ = "notification_prefs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    channel: Mapped[str] = mapped_column(Text, nullable=False)
    topic: Mapped[str] = mapped_column(Text, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    quiet_hours_start: Mapped[int | None] = mapped_column(SmallInteger)
    quiet_hours_end: Mapped[int | None] = mapped_column(SmallInteger)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "channel", "topic", name="uq_notif_pref"),
    )


class Consent(Base):
    __tablename__ = "consents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    granted_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    withdrawn_at: Mapped[datetime | None] = mapped_column()


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    text_enc: Mapped[bytes | None] = mapped_column(LargeBinary)
    section: Mapped[str | None] = mapped_column(Text)
    linked_account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id"))
    done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now())


class RoutineStep(Base):
    __tablename__ = "routine_steps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    label_enc: Mapped[bytes | None] = mapped_column(LargeBinary)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    done_this_month: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())


class OtpToken(Base):
    __tablename__ = "otp_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    identifier: Mapped[str] = mapped_column(Text, nullable=False)
    code_hash: Mapped[str] = mapped_column(Text, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    __table_args__ = (Index("idx_otp_identifier", "identifier"),)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    device_id: Mapped[str | None] = mapped_column(ForeignKey("devices.id"))
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
