"""Initial schema — all five tables.

Revision ID: 001
Revises:
Create Date: 2026-05-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "transcripts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("raw_text", sa.Text, nullable=False),
        sa.Column("char_count", sa.Integer, nullable=False),
        sa.Column("recruiter_id", sa.String(255), nullable=True),
        sa.Column("job_reference", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "candidate_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "transcript_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("transcripts.id"),
            nullable=False,
            unique=True,
        ),
        # Not a FK — avoids circular dependency with extractions.
        sa.Column("latest_extraction_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approval_status", sa.String(50), nullable=False, server_default="needs_review"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "extractions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "transcript_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("transcripts.id"),
            nullable=False,
        ),
        sa.Column(
            "candidate_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("candidate_records.id"),
            nullable=False,
        ),
        sa.Column("missing_fields", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("ambiguous_fields", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column(
            "suggested_follow_up_questions",
            postgresql.JSONB,
            nullable=False,
            server_default="[]",
        ),
        sa.Column("candidate_summary", sa.Text, nullable=True),
        sa.Column("overall_confidence", sa.Float, nullable=True),
        sa.Column("model_used", sa.String(100), nullable=False),
        sa.Column("prompt_tokens", sa.Integer, nullable=True),
        sa.Column("completion_tokens", sa.Integer, nullable=True),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("raw_response", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "extracted_fields",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "extraction_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("extractions.id"),
            nullable=False,
        ),
        sa.Column("field_name", sa.String(100), nullable=False),
        sa.Column("raw_value", postgresql.JSONB, nullable=True),
        sa.Column("normalized_value", postgresql.JSONB, nullable=True),
        sa.Column("reviewed_value", postgresql.JSONB, nullable=True),
        sa.Column("evidence_snippet", sa.Text, nullable=True),
        sa.Column("confidence", sa.Float, nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("edited", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_index("ix_extracted_fields_extraction_id", "extracted_fields", ["extraction_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("actor_id", sa.String(255), nullable=False),
        sa.Column("old_value", postgresql.JSONB, nullable=True),
        sa.Column("new_value", postgresql.JSONB, nullable=True),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_index("ix_audit_logs_entity_id", "audit_logs", ["entity_id"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_index("ix_extracted_fields_extraction_id", "extracted_fields")
    op.drop_table("extracted_fields")
    op.drop_table("extractions")
    op.drop_table("candidate_records")
    op.drop_table("transcripts")
