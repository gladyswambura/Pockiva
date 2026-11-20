"""Initial schema — all Pockiva tables.

Revision ID: 0001
Revises:
Create Date: 2026-10-29
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def _is_sqlite() -> bool:
    return op.get_bind().dialect.name == "sqlite"


def upgrade() -> None:
    if not _is_sqlite():
        op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
        op.execute("CREATE TYPE account_kind AS ENUM ('wallet','savings','envelope')")
        op.execute(
            "CREATE TYPE entry_kind AS ENUM "
            "('deposit','allocate','release','spend','save','unsave','loan_received','loan_payment')"
        )

    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("phone_e164", sa.Text, unique=True),
        sa.Column("email", sa.Text),
        sa.Column("display_name", sa.Text),
        sa.Column("country", sa.String(2), nullable=False, server_default="KE"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="KES"),
        sa.Column("locale", sa.Text, nullable=False, server_default="en"),
        sa.Column("plan_tier", sa.Text, nullable=False, server_default="free"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime),
    )
    op.create_index("users_email_lower", "users", [sa.text("lower(email)")], unique=True)

    op.create_table(
        "devices",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("push_token", sa.Text),
        sa.Column("platform", sa.Text),
        sa.Column("last_seen", sa.DateTime),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "accounts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("group_code", sa.Text),
        sa.Column("name_enc", sa.LargeBinary),
        sa.Column("color", sa.Text),
        sa.Column("icon", sa.Text),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("plan_cents", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("goal_cents", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("balance_cents", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("funded_cents", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("spent_cents", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("lock_until", sa.Date),
        sa.Column("archived_at", sa.DateTime),
        sa.Column("version", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("plan_cents >= 0", name="ck_account_plan_cents"),
        sa.CheckConstraint("goal_cents >= 0", name="ck_account_goal_cents"),
        sa.CheckConstraint("balance_cents >= 0", name="ck_account_balance_cents"),
        sa.CheckConstraint("funded_cents >= 0", name="ck_account_funded_cents"),
        sa.CheckConstraint("spent_cents >= 0", name="ck_account_spent_cents"),
    )

    op.create_table(
        "ledger_entries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("from_account_id", sa.String(36), sa.ForeignKey("accounts.id")),
        sa.Column("to_account_id", sa.String(36), sa.ForeignKey("accounts.id")),
        sa.Column("amount_cents", sa.BigInteger, nullable=False),
        sa.Column("note_enc", sa.LargeBinary),
        sa.Column("idempotency_key", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("amount_cents > 0", name="ck_entry_amount_positive"),
        sa.CheckConstraint(
            "from_account_id IS NOT NULL OR to_account_id IS NOT NULL",
            name="ck_entry_has_account",
        ),
        sa.UniqueConstraint("user_id", "idempotency_key", name="uq_entry_idempotency"),
    )
    op.create_index("ledger_user_time", "ledger_entries", ["user_id", "created_at"])

    op.create_table(
        "loans",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("account_id", sa.String(36), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("lender_enc", sa.LargeBinary),
        sa.Column("borrowed_cents", sa.BigInteger, nullable=False),
        sa.Column("total_repay_cents", sa.BigInteger, nullable=False),
        sa.Column("owed_cents", sa.BigInteger, nullable=False),
        sa.Column("monthly_cents", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("due_day", sa.SmallInteger),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("borrowed_cents > 0", name="ck_loan_borrowed_positive"),
        sa.CheckConstraint("total_repay_cents >= borrowed_cents", name="ck_loan_repay_gte_borrowed"),
        sa.CheckConstraint("owed_cents >= 0", name="ck_loan_owed_non_negative"),
        sa.CheckConstraint("monthly_cents >= 0", name="ck_loan_monthly_non_negative"),
        sa.CheckConstraint("due_day BETWEEN 1 AND 31", name="ck_loan_due_day"),
    )

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tier", sa.Text, nullable=False),
        sa.Column("billing", sa.Text),
        sa.Column("status", sa.Text, nullable=False),
        sa.Column("trial_ends_at", sa.DateTime),
        sa.Column("current_period_end", sa.DateTime),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("billing IN ('monthly','yearly')", name="ck_sub_billing"),
        sa.CheckConstraint(
            "status IN ('trialing','active','grace','canceled','expired')",
            name="ck_sub_status",
        ),
    )

    op.create_table(
        "payments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("provider", sa.Text, nullable=False),
        sa.Column("provider_ref", sa.Text, unique=True),
        sa.Column("amount_cents", sa.BigInteger, nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("status", sa.Text, nullable=False),
        sa.Column("purpose", sa.Text, nullable=False),
        sa.Column("raw", sa.JSON),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("amount_cents > 0", name="ck_payment_amount_positive"),
        sa.CheckConstraint("status IN ('pending','paid','failed','expired')", name="ck_payment_status"),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("actor_type", sa.Text, nullable=False),
        sa.Column("actor_id", sa.String(36)),
        sa.Column("action", sa.Text, nullable=False),
        sa.Column("object_type", sa.Text),
        sa.Column("object_id", sa.String(36)),
        sa.Column("ip", sa.Text),
        sa.Column("at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "notification_prefs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel", sa.Text, nullable=False),
        sa.Column("topic", sa.Text, nullable=False),
        sa.Column("enabled", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("quiet_hours_start", sa.SmallInteger),
        sa.Column("quiet_hours_end", sa.SmallInteger),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "channel", "topic", name="uq_notif_pref"),
    )

    op.create_table(
        "consents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("purpose", sa.Text, nullable=False),
        sa.Column("granted_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("withdrawn_at", sa.DateTime),
    )

    op.create_table(
        "goals",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("text_enc", sa.LargeBinary),
        sa.Column("section", sa.Text),
        sa.Column("linked_account_id", sa.String(36), sa.ForeignKey("accounts.id")),
        sa.Column("done", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "routine_steps",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label_enc", sa.LargeBinary),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("done_this_month", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "otp_tokens",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("identifier", sa.Text, nullable=False),
        sa.Column("code_hash", sa.Text, nullable=False),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("used", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_otp_identifier", "otp_tokens", ["identifier"])

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.Text, nullable=False, unique=True),
        sa.Column("device_id", sa.String(36), sa.ForeignKey("devices.id")),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("revoked", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    for table in [
        "refresh_tokens", "otp_tokens", "routine_steps", "goals", "consents",
        "notification_prefs", "audit_log", "payments", "subscriptions",
        "loans", "ledger_entries", "accounts", "devices", "users",
    ]:
        op.drop_table(table)
    if not _is_sqlite():
        op.execute("DROP TYPE IF EXISTS entry_kind")
        op.execute("DROP TYPE IF EXISTS account_kind")
