"""Add suspended_at to users.

Revision ID: 0003
Revises: 0002
"""

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        cols = [r[1] for r in bind.execute(sa.text("PRAGMA table_info(users)"))]
    else:
        cols = [r[0] for r in bind.execute(sa.text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='users'"
        ))]
    if "suspended_at" not in cols:
        op.add_column("users", sa.Column("suspended_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        return  # SQLite doesn't support DROP COLUMN in older versions
    op.drop_column("users", "suspended_at")
