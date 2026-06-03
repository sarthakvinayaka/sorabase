"""add capture_sessions and transcript_chunks tables

Revision ID: 014
Revises: 013
Create Date: 2026-06-03

Two tables support the desktop live-capture path:
  capture_sessions   — one row per desktop recording session
  transcript_chunks  — one Deepgram utterance per row, ordered by seq

On /complete the backend joins chunks into a Conversation with
source_type="desktop_live_capture" and status="ready", which triggers
the existing extraction workflow unchanged.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "capture_sessions",
        sa.Column("id",     postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("mode",   sa.String(50),  nullable=False, server_default="general"),
        sa.Column("label",  sa.String(255), nullable=True),
        sa.Column("status", sa.String(50),  nullable=False, server_default="active"),
        sa.Column("source", sa.String(50),  nullable=False, server_default="desktop_live"),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversations.id"),
            nullable=True,
        ),
        sa.Column("error_message", sa.Text,    nullable=True),
        sa.Column("chunk_count",   sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_capture_sessions_org_id", "capture_sessions", ["org_id"])
    op.create_index("ix_capture_sessions_status",  "capture_sessions", ["status"])

    op.create_table(
        "transcript_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "capture_session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("capture_sessions.id"),
            nullable=False,
        ),
        sa.Column("seq",        sa.Integer,     nullable=False),
        sa.Column("text",       sa.Text,        nullable=False),
        sa.Column("speaker",    sa.String(100), nullable=True),
        sa.Column("confidence", sa.Float,       nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_transcript_chunks_session_seq",
        "transcript_chunks",
        ["capture_session_id", "seq"],
    )


def downgrade() -> None:
    op.drop_index("ix_transcript_chunks_session_seq", table_name="transcript_chunks")
    op.drop_table("transcript_chunks")
    op.drop_index("ix_capture_sessions_status",  table_name="capture_sessions")
    op.drop_index("ix_capture_sessions_org_id",  table_name="capture_sessions")
    op.drop_table("capture_sessions")
