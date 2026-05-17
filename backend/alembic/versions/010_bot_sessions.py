"""Add bot_sessions table for meeting-bot lifecycle tracking.

Revision ID: 010
Revises: 009
Create Date: 2026-05-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bot_sessions",
        sa.Column("id",               sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id",           sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("provider",         sa.String(50),  nullable=False, server_default="recall"),
        sa.Column("provider_bot_id",  sa.String(255), nullable=False),
        sa.Column("meeting_url",      sa.Text(),      nullable=False),
        sa.Column("meeting_label",    sa.String(255), nullable=True),
        sa.Column("job_reference",    sa.String(255), nullable=True),
        sa.Column("auto_run",         sa.Boolean(),   nullable=False, server_default="true"),
        sa.Column("workflow_triggered", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("status",           sa.String(50),  nullable=False, server_default="joining"),
        sa.Column("error_message",    sa.Text(),      nullable=True),
        sa.Column("conversation_id",  sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("conversations.id"), nullable=True),
        sa.Column("candidate_id",     sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("candidates.id"), nullable=True),
        sa.Column("transcript_chars", sa.Integer(), nullable=True),
        sa.Column("webhook_events",   sa.JSON(),    nullable=False, server_default="[]"),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at",       sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_bot_sessions_provider_bot_id", "bot_sessions", ["provider_bot_id"])
    op.create_index("ix_bot_sessions_status",     "bot_sessions", ["status"])
    op.create_index("ix_bot_sessions_created_at", "bot_sessions", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_bot_sessions_created_at", table_name="bot_sessions")
    op.drop_index("ix_bot_sessions_status",     table_name="bot_sessions")
    op.drop_constraint("uq_bot_sessions_provider_bot_id", "bot_sessions")
    op.drop_table("bot_sessions")
