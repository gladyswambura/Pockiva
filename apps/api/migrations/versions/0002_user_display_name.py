"""Add user display name.

Revision ID: 0002
Revises: 0001
"""

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        cols = [r[0] for r in bind.execute(sa.text("SELECT column_name FROM information_schema.columns WHERE table_name='users'"))]
        if "display_name" not in cols:
            op.add_column("users", sa.Column("display_name", sa.Text(), nullable=True))


def downgrade() -> None:
    if op.get_bind().dialect.name != "sqlite":
        op.drop_column("users", "display_name")
