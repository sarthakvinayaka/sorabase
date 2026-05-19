"""add study mode tables

Revision ID: 013
Revises: 012
Create Date: 2026-05-19

Creates seven Study Mode tables. All data is isolated by org_id on the
study_lectures table; child tables (concepts, definitions, formulas,
flashcards, questions) inherit isolation through their lecture_id FK.
study_extraction_runs carries its own org_id for direct job-status lookups
without a join.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "study_lectures",
        sa.Column("id",              postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id",          postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("conversations.id"), nullable=False),
        sa.Column("title",           sa.String(500),  nullable=True),
        sa.Column("course",          sa.String(255),  nullable=True),
        sa.Column("lecture_date",    sa.String(20),   nullable=True),
        sa.Column("template_slug",   sa.String(100),  nullable=False, server_default="lecture_notes"),
        sa.Column("archive_status",  sa.String(50),   nullable=False, server_default="needs_review"),
        sa.Column("summary",         sa.Text,         nullable=True),
        sa.Column("topics",              postgresql.JSON, nullable=False, server_default="[]"),
        sa.Column("learning_objectives", postgresql.JSON, nullable=False, server_default="[]"),
        sa.Column("transcript",      sa.Text,         nullable=True),
        sa.Column("created_at",      sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at",      sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_study_lectures_org_id", "study_lectures", ["org_id"])
    op.create_index("ix_study_lectures_course",  "study_lectures", ["course"])

    op.create_table(
        "study_extraction_runs",
        sa.Column("id",         postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id",     postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lecture_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("study_lectures.id"), nullable=False),
        sa.Column("status",           sa.String(50),  nullable=False, server_default="pending"),
        sa.Column("model_used",       sa.String(100), nullable=True),
        sa.Column("error_message",    sa.Text,        nullable=True),
        sa.Column("prompt_tokens",    sa.Integer,     nullable=True),
        sa.Column("completion_tokens",sa.Integer,     nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_study_extraction_runs_org_id",     "study_extraction_runs", ["org_id"])
    op.create_index("ix_study_extraction_runs_lecture_id", "study_extraction_runs", ["lecture_id"])

    op.create_table(
        "study_concepts",
        sa.Column("id",               postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lecture_id",       postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("study_lectures.id"), nullable=False),
        sa.Column("concept",          sa.String(500), nullable=False),
        sa.Column("explanation",      sa.Text,        nullable=False),
        sa.Column("confidence",       sa.Float,       nullable=False, server_default="0.0"),
        sa.Column("evidence_snippet", sa.Text,        nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_study_concepts_lecture_id", "study_concepts", ["lecture_id"])

    op.create_table(
        "study_definitions",
        sa.Column("id",               postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lecture_id",       postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("study_lectures.id"), nullable=False),
        sa.Column("term",             sa.String(500), nullable=False),
        sa.Column("definition",       sa.Text,        nullable=False),
        sa.Column("confidence",       sa.Float,       nullable=False, server_default="0.0"),
        sa.Column("evidence_snippet", sa.Text,        nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_study_definitions_lecture_id", "study_definitions", ["lecture_id"])

    op.create_table(
        "study_formulas",
        sa.Column("id",               postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lecture_id",       postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("study_lectures.id"), nullable=False),
        sa.Column("notation",         sa.Text,  nullable=False),
        sa.Column("description",      sa.Text,  nullable=False),
        sa.Column("example",          sa.Text,  nullable=True),
        sa.Column("confidence",       sa.Float, nullable=False, server_default="0.0"),
        sa.Column("evidence_snippet", sa.Text,  nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_study_formulas_lecture_id", "study_formulas", ["lecture_id"])

    op.create_table(
        "study_flashcards",
        sa.Column("id",               postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lecture_id",       postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("study_lectures.id"), nullable=False),
        sa.Column("front",            sa.Text,        nullable=False),
        sa.Column("back",             sa.Text,        nullable=False),
        sa.Column("concept_tag",      sa.String(255), nullable=True),
        sa.Column("confidence",       sa.Float,       nullable=False, server_default="0.0"),
        sa.Column("evidence_snippet", sa.Text,        nullable=True),
        sa.Column("edited",           sa.Boolean,     nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_study_flashcards_lecture_id", "study_flashcards", ["lecture_id"])

    op.create_table(
        "study_questions",
        sa.Column("id",               postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lecture_id",       postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("study_lectures.id"), nullable=False),
        sa.Column("question",         sa.Text,       nullable=False),
        sa.Column("question_type",    sa.String(50), nullable=False, server_default="important"),
        sa.Column("difficulty",       sa.String(50), nullable=True),
        sa.Column("answer_short",     sa.Text,       nullable=True),
        sa.Column("answer_exam",      sa.Text,       nullable=False),
        sa.Column("answer_detailed",  sa.Text,       nullable=True),
        sa.Column("options",          postgresql.JSON, nullable=True),
        sa.Column("confidence",       sa.Float,      nullable=False, server_default="0.0"),
        sa.Column("source_coverage",  sa.Float,      nullable=True),
        sa.Column("evidence_snippet", sa.Text,       nullable=True),
        sa.Column("topic_tags",       postgresql.JSON, nullable=False, server_default="[]"),
        sa.Column("edited",           sa.Boolean,    nullable=False, server_default="false"),
        sa.Column("is_hidden",        sa.Boolean,    nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_study_questions_lecture_id", "study_questions", ["lecture_id"])


def downgrade() -> None:
    op.drop_index("ix_study_questions_lecture_id",        table_name="study_questions")
    op.drop_table("study_questions")
    op.drop_index("ix_study_flashcards_lecture_id",       table_name="study_flashcards")
    op.drop_table("study_flashcards")
    op.drop_index("ix_study_formulas_lecture_id",         table_name="study_formulas")
    op.drop_table("study_formulas")
    op.drop_index("ix_study_definitions_lecture_id",      table_name="study_definitions")
    op.drop_table("study_definitions")
    op.drop_index("ix_study_concepts_lecture_id",         table_name="study_concepts")
    op.drop_table("study_concepts")
    op.drop_index("ix_study_extraction_runs_lecture_id",  table_name="study_extraction_runs")
    op.drop_index("ix_study_extraction_runs_org_id",      table_name="study_extraction_runs")
    op.drop_table("study_extraction_runs")
    op.drop_index("ix_study_lectures_course",             table_name="study_lectures")
    op.drop_index("ix_study_lectures_org_id",             table_name="study_lectures")
    op.drop_table("study_lectures")
