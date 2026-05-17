"""add mode column to bot_sessions and meeting_sessions

Revision ID: 012
Revises: 011
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "bot_sessions",
        sa.Column("mode", sa.String(50), nullable=False, server_default="recruiting"),
    )
    op.add_column(
        "meeting_sessions",
        sa.Column("mode", sa.String(50), nullable=False, server_default="recruiting"),
    )


def downgrade() -> None:
    op.drop_column("bot_sessions", "mode")
    op.drop_column("meeting_sessions", "mode")
