from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import ExportJobFormat, ExportJobStatus
from app.db.mixins import TimestampMixin
from app.db.postgresql_enums import pg_str_enum

if TYPE_CHECKING:
    from app.db.models.candidate_record import CandidateRecord
    from app.db.models.organization import Organization
    from app.db.models.user import User


class ExportJob(Base, TimestampMixin):
    __tablename__ = "export_jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requested_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    candidate_record_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("candidate_records.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    export_format: Mapped[ExportJobFormat] = mapped_column(
        pg_str_enum(ExportJobFormat, name="export_job_format"),
        nullable=False,
        server_default=ExportJobFormat.JSON.value,
    )
    status: Mapped[ExportJobStatus] = mapped_column(
        pg_str_enum(ExportJobStatus, name="export_job_status"),
        nullable=False,
        server_default=ExportJobStatus.QUEUED.value,
    )
    output_storage_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")

    organization: Mapped[Organization] = relationship(back_populates="export_jobs")
    requested_by_user: Mapped[User | None] = relationship(back_populates="export_jobs")
    candidate_record: Mapped[CandidateRecord | None] = relationship(back_populates="export_jobs")
