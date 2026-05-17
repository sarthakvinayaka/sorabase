"""audio upload metadata + transcript generation job placeholder

Revision ID: 20260515_000003
Revises: 20260514_000002
Create Date: 2026-05-15

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision = "20260515_000003"
down_revision = "20260514_000002"
branch_labels = None
depends_on = None

_job_status = postgresql.ENUM(
    "queued",
    "in_progress",
    "awaiting_asr",
    "completed",
    "failed",
    name="transcript_job_status",
    create_type=True,
)


def _column_exists(bind, table: str, column: str) -> bool:
    cols = inspect(bind).get_columns(table)
    return any(c["name"] == column for c in cols)


def _index_exists(bind, table: str, index_name: str) -> bool:
    return any(idx["name"] == index_name for idx in inspect(bind).get_indexes(table))


def upgrade() -> None:
    bind = op.get_bind()
    _job_status.create(bind, checkfirst=True)

    # 20260514_000002 uses Base.metadata.create_all(); current models may already include
    # these objects, so this revision must tolerate a DB that skipped the ALTERs below.
    if not _column_exists(bind, "audio_uploads", "job_reference"):
        op.add_column("audio_uploads", sa.Column("job_reference", sa.String(length=512), nullable=True))
    if not _column_exists(bind, "audio_uploads", "upload_notes"):
        op.add_column("audio_uploads", sa.Column("upload_notes", sa.Text(), nullable=True))

    if not inspect(bind).has_table("transcript_generation_jobs"):
        op.create_table(
            "transcript_generation_jobs",
            sa.Column("id", sa.Uuid(as_uuid=True), nullable=False),
            sa.Column("audio_upload_id", sa.Uuid(as_uuid=True), nullable=False),
            sa.Column(
                "status",
                postgresql.ENUM(
                    "queued",
                    "in_progress",
                    "awaiting_asr",
                    "completed",
                    "failed",
                    name="transcript_job_status",
                    create_type=False,
                ),
                server_default="queued",
                nullable=False,
            ),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["audio_upload_id"], ["audio_uploads.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _index_exists(bind, "transcript_generation_jobs", "ix_transcript_generation_jobs_audio_upload_id"):
        op.create_index(
            "ix_transcript_generation_jobs_audio_upload_id",
            "transcript_generation_jobs",
            ["audio_upload_id"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index("ix_transcript_generation_jobs_audio_upload_id", table_name="transcript_generation_jobs")
    op.drop_table("transcript_generation_jobs")
    op.drop_column("audio_uploads", "upload_notes")
    op.drop_column("audio_uploads", "job_reference")
    op.execute(sa.text("DROP TYPE IF EXISTS transcript_job_status CASCADE"))
