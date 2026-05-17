"""staffing screening initial schema

Revision ID: 20260514_000002
Revises: 20260513_000001
Create Date: 2026-05-14

"""

from alembic import op
import sqlalchemy as sa

from app.db import models  # noqa: F401 - register models with Base.metadata
from app.db.base import Base

revision = "20260514_000002"
down_revision = "20260513_000001"
branch_labels = None
depends_on = None

_PG_ENUM_NAMES = (
    "audio_upload_status",
    "transcript_status",
    "candidate_approval_status",
    "candidate_extraction_status",
    "candidate_ats_sync_status",
    "extraction_run_status",
    "extracted_field_status",
    "extracted_field_source",
    "export_job_format",
    "export_job_status",
    "ats_provider",
    "ats_connection_status",
    "ats_sync_log_status",
    "audit_actor_type",
)


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
    for name in _PG_ENUM_NAMES:
        op.execute(sa.text(f'DROP TYPE IF EXISTS "{name}" CASCADE'))
