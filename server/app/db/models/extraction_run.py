from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import ExtractionRunStatus
from app.db.mixins import TimestampMixin
from app.db.postgresql_enums import pg_str_enum

if TYPE_CHECKING:
    from app.db.models.candidate_record import CandidateRecord


class ExtractionRun(Base, TimestampMixin):
    __tablename__ = "extraction_runs"
    __table_args__ = (UniqueConstraint("candidate_record_id", "run_index", name="uq_extraction_runs_candidate_version"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_record_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("candidate_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    run_index: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[ExtractionRunStatus] = mapped_column(
        pg_str_enum(ExtractionRunStatus, name="extraction_run_status"),
        nullable=False,
        server_default=ExtractionRunStatus.QUEUED.value,
    )
    provider_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_job_ref: Mapped[str | None] = mapped_column(String(512), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")

    candidate_record: Mapped[CandidateRecord] = relationship(back_populates="extraction_runs")
    extracted_fields: Mapped[list[ExtractedField]] = relationship(
        "ExtractedField",
        back_populates="extraction_run",
    )
    ats_sync_logs: Mapped[list["AtsSyncLog"]] = relationship(
        "AtsSyncLog",
        back_populates="extraction_run",
    )
