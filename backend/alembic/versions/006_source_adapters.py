"""Source adapter foundation — SourceEvent, MediaReference, transcript_status.

No existing data is removed. All current Conversation rows receive
transcript_status='ready' by default (they already have raw_text).

Revision ID: 006
Revises: 005
Create Date: 2026-05-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. transcript_status on conversations
    #    DEFAULT 'ready' so all existing transcript rows stay valid.
    # ------------------------------------------------------------------
    op.add_column(
        "conversations",
        sa.Column(
            "transcript_status",
            sa.String(50),
            nullable=False,
            server_default="ready",
        ),
    )

    # ------------------------------------------------------------------
    # 2. source_events — raw ingest record per sourcing event
    # ------------------------------------------------------------------
    op.create_table(
        "source_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_type", sa.String(50), nullable=False),
        sa.Column("external_id", sa.String(255), nullable=True),
        sa.Column("raw_payload", postgresql.JSONB, nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="received"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversations.id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_source_events_conversation_id", "source_events", ["conversation_id"])
    op.create_index(
        "ix_source_events_external_id",
        "source_events",
        ["source_type", "external_id"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # 3. media_references — audio/video file pointer + transcription state
    # ------------------------------------------------------------------
    op.create_table(
        "media_references",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversations.id"),
            nullable=False,
        ),
        sa.Column(
            "source_event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("source_events.id"),
            nullable=True,
        ),
        sa.Column("ref_type", sa.String(50), nullable=False),
        sa.Column("storage_url", sa.Text, nullable=True),
        sa.Column("storage_key", sa.String(500), nullable=True),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("duration_seconds", sa.Integer, nullable=True),
        sa.Column("size_bytes", sa.Integer, nullable=True),
        sa.Column(
            "transcription_status",
            sa.String(50),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("transcript_text", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_media_references_conversation_id", "media_references", ["conversation_id"]
    )


def downgrade() -> None:
    op.drop_table("media_references")
    op.drop_index("ix_source_events_external_id", table_name="source_events")
    op.drop_index("ix_source_events_conversation_id", table_name="source_events")
    op.drop_table("source_events")
    op.drop_column("conversations", "transcript_status")
