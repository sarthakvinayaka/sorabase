"""Node architecture — introduce Conversation, Candidate, Job, ExtractionRun, AnalysisRun.

Migrates existing data from the v1 tables (transcripts, candidate_records, extractions)
into the new node-aligned tables, preserving all primary key UUIDs so existing
bookmarks and references continue to resolve.

Revision ID: 002
Revises: 001
Create Date: 2026-05-14

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001"


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 1. New lookup tables
    # -------------------------------------------------------------------------
    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("requirements", sa.Text, nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # -------------------------------------------------------------------------
    # 2. candidates — person identity, decoupled from any single conversation
    # -------------------------------------------------------------------------
    op.create_table(
        "candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=True),
        # Denormalized pointer — no FK to avoid circular dep with extraction_runs.
        sa.Column("latest_extraction_run_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approval_status", sa.String(50), nullable=False, server_default="needs_review"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Migrate candidate_records → candidates (preserve IDs).
    op.execute(f"""
        INSERT INTO candidates (id, org_id, latest_extraction_run_id, approval_status, created_at, updated_at)
        SELECT
            id,
            '{DEFAULT_ORG_ID}'::uuid,
            latest_extraction_id,
            approval_status,
            created_at,
            updated_at
        FROM candidate_records
    """)

    # -------------------------------------------------------------------------
    # 3. conversations — source node, replaces transcripts
    # -------------------------------------------------------------------------
    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_type", sa.String(50), nullable=False, server_default="transcript"),
        sa.Column("status", sa.String(50), nullable=False, server_default="raw"),
        sa.Column("raw_text", sa.Text, nullable=True),
        sa.Column("char_count", sa.Integer, nullable=True),
        sa.Column("recruiter_id", sa.String(255), nullable=True),
        sa.Column("job_reference", sa.String(255), nullable=True),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("jobs.id"),
            nullable=True,
        ),
        sa.Column(
            "candidate_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("candidates.id"),
            nullable=True,
        ),
        sa.Column("source_metadata", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Migrate transcripts → conversations (preserve IDs).
    # candidate_id is linked via the candidate_records.transcript_id join.
    op.execute(f"""
        INSERT INTO conversations (
            id, org_id, source_type, status,
            raw_text, char_count, recruiter_id, job_reference,
            candidate_id, created_at
        )
        SELECT
            t.id,
            '{DEFAULT_ORG_ID}'::uuid,
            'transcript',
            'extracted',
            t.raw_text,
            t.char_count,
            t.recruiter_id,
            t.job_reference,
            cr.id,
            t.created_at
        FROM transcripts t
        LEFT JOIN candidate_records cr ON cr.transcript_id = t.id
    """)

    # -------------------------------------------------------------------------
    # 4. extraction_runs — extraction node, replaces extractions
    # -------------------------------------------------------------------------
    op.create_table(
        "extraction_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversations.id"),
            nullable=False,
        ),
        sa.Column(
            "candidate_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("candidates.id"),
            nullable=False,
        ),
        sa.Column("template_id", sa.String(100), nullable=True),
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

    # Migrate extractions → extraction_runs (preserve IDs).
    op.execute(f"""
        INSERT INTO extraction_runs (
            id, org_id, conversation_id, candidate_id, template_id,
            missing_fields, ambiguous_fields, suggested_follow_up_questions,
            candidate_summary, overall_confidence, model_used,
            prompt_tokens, completion_tokens, status, raw_response, created_at
        )
        SELECT
            id,
            '{DEFAULT_ORG_ID}'::uuid,
            transcript_id,
            candidate_id,
            NULL,
            missing_fields,
            ambiguous_fields,
            suggested_follow_up_questions,
            candidate_summary,
            overall_confidence,
            model_used,
            prompt_tokens,
            completion_tokens,
            status,
            raw_response,
            created_at
        FROM extractions
    """)

    # -------------------------------------------------------------------------
    # 5. extracted_fields — rename FK column, add org_id
    # -------------------------------------------------------------------------
    # Drop old index and FK, add new column, copy data, then add new FK + index.
    op.drop_index("ix_extracted_fields_extraction_id", table_name="extracted_fields")
    op.drop_constraint(
        "extracted_fields_extraction_id_fkey",
        table_name="extracted_fields",
        type_="foreignkey",
    )
    op.add_column(
        "extracted_fields",
        sa.Column("extraction_run_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "extracted_fields",
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.execute(f"""
        UPDATE extracted_fields
        SET extraction_run_id = extraction_id,
            org_id = '{DEFAULT_ORG_ID}'::uuid
    """)

    op.alter_column("extracted_fields", "extraction_run_id", nullable=False)
    op.create_foreign_key(
        "extracted_fields_extraction_run_id_fkey",
        "extracted_fields",
        "extraction_runs",
        ["extraction_run_id"],
        ["id"],
    )
    op.create_index(
        "ix_extracted_fields_extraction_run_id",
        "extracted_fields",
        ["extraction_run_id"],
    )
    op.drop_column("extracted_fields", "extraction_id")

    # -------------------------------------------------------------------------
    # 6. audit_logs — add org_id
    # -------------------------------------------------------------------------
    op.add_column(
        "audit_logs",
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute(f"""
        UPDATE audit_logs SET org_id = '{DEFAULT_ORG_ID}'::uuid
    """)

    # -------------------------------------------------------------------------
    # 7. analysis_runs stub
    # -------------------------------------------------------------------------
    op.create_table(
        "analysis_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "extraction_run_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("extraction_runs.id"),
            nullable=True,
        ),
        sa.Column(
            "candidate_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("candidates.id"),
            nullable=True,
        ),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("jobs.id"),
            nullable=True,
        ),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("results", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # -------------------------------------------------------------------------
    # 8. Drop obsolete v1 tables (data already migrated above)
    # -------------------------------------------------------------------------
    op.drop_table("extractions")
    op.drop_table("candidate_records")
    op.drop_table("transcripts")


def downgrade() -> None:
    # Restore v1 tables — data migration is not reversed (would need separate script).
    op.drop_table("analysis_runs")
    op.drop_table("audit_logs")

    # Restore extracted_fields to old schema.
    op.drop_index("ix_extracted_fields_extraction_run_id", table_name="extracted_fields")
    op.drop_constraint(
        "extracted_fields_extraction_run_id_fkey",
        table_name="extracted_fields",
        type_="foreignkey",
    )
    op.drop_column("extracted_fields", "org_id")
    op.drop_column("extracted_fields", "extraction_run_id")

    op.drop_table("extraction_runs")
    op.drop_table("conversations")
    op.drop_table("candidates")
    op.drop_table("jobs")

    # Recreate v1 tables (empty — data not restored).
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
        sa.Column("transcript_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("transcripts.id"), nullable=False, unique=True),
        sa.Column("latest_extraction_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approval_status", sa.String(50), nullable=False, server_default="needs_review"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "extractions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("transcript_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("transcripts.id"), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("candidate_records.id"), nullable=False),
        sa.Column("missing_fields", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("ambiguous_fields", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("suggested_follow_up_questions", postgresql.JSONB,
                  nullable=False, server_default="[]"),
        sa.Column("candidate_summary", sa.Text, nullable=True),
        sa.Column("overall_confidence", sa.Float, nullable=True),
        sa.Column("model_used", sa.String(100), nullable=False),
        sa.Column("prompt_tokens", sa.Integer, nullable=True),
        sa.Column("completion_tokens", sa.Integer, nullable=True),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("raw_response", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.add_column(
        "extracted_fields",
        sa.Column("extraction_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("extractions.id"), nullable=True),
    )
    op.create_index("ix_extracted_fields_extraction_id", "extracted_fields", ["extraction_id"])
    op.create_index("ix_audit_logs_entity_id", "audit_logs", ["entity_id"])
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
