"""Add meeting_sessions table for auto-triggered Zoom workflow lifecycle tracking.

Revision ID: 009
Revises: 008
Create Date: 2026-05-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "meeting_sessions",
        sa.Column("id",              postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id",          postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_event_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("source_events.id"), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("conversations.id"), nullable=True),
        sa.Column("candidate_id",    postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("candidates.id"),    nullable=True),
        sa.Column("meeting_id",   sa.String(255), nullable=True),
        sa.Column("host_email",   sa.String(255), nullable=True),
        sa.Column("status",       sa.String(50),  nullable=False, server_default="transcribing"),
        sa.Column("error_message", sa.Text,       nullable=True),
        sa.Column("created_at",   sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at",   sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )
    op.create_index("ix_meeting_sessions_status",     "meeting_sessions", ["status"])
    op.create_index("ix_meeting_sessions_created_at", "meeting_sessions", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_meeting_sessions_created_at", table_name="meeting_sessions")
    op.drop_index("ix_meeting_sessions_status",     table_name="meeting_sessions")
    op.drop_table("meeting_sessions")
