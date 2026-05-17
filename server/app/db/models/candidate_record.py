from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import (
    CandidateApprovalStatus,
    CandidateAtsSyncStatus,
    CandidateExtractionStatus,
    CandidateProcessingStage,
)
from app.db.mixins import TimestampMixin
from app.db.postgresql_enums import pg_str_enum

if TYPE_CHECKING:
    from app.db.models.audio_upload import AudioUpload
    from app.db.models.candidate_narrative_generation import CandidateNarrativeGeneration
    from app.db.models.extraction_run import ExtractionRun
    from app.db.models.export_job import ExportJob
    from app.db.models.organization import Organization
    from app.db.models.recruiter import Recruiter
    from app.db.models.transcript import Transcript


class CandidateRecord(Base, TimestampMixin):
    __tablename__ = "candidate_records"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_recruiter_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("recruiters.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    audio_upload_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("audio_uploads.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    primary_transcript_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("transcripts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    internal_title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    approval_status: Mapped[CandidateApprovalStatus] = mapped_column(
        pg_str_enum(CandidateApprovalStatus, name="candidate_approval_status"),
        nullable=False,
        server_default=CandidateApprovalStatus.NOT_STARTED.value,
    )
    extraction_status: Mapped[CandidateExtractionStatus] = mapped_column(
        pg_str_enum(CandidateExtractionStatus, name="candidate_extraction_status"),
        nullable=False,
        server_default=CandidateExtractionStatus.NONE.value,
    )
    ats_sync_status: Mapped[CandidateAtsSyncStatus] = mapped_column(
        pg_str_enum(CandidateAtsSyncStatus, name="candidate_ats_sync_status"),
        nullable=False,
        server_default=CandidateAtsSyncStatus.NONE.value,
    )
    confidence_overall: Mapped[float | None] = mapped_column(Numeric(6, 5), nullable=True)
    processing_stage: Mapped[CandidateProcessingStage] = mapped_column(
        pg_str_enum(CandidateProcessingStage, name="candidate_processing_stage"),
        nullable=False,
        server_default=CandidateProcessingStage.UPLOADED.value,
    )

    organization: Mapped[Organization] = relationship(back_populates="candidate_records")
    created_by_recruiter: Mapped[Recruiter | None] = relationship(back_populates="candidate_records")
    audio_upload: Mapped[AudioUpload] = relationship(back_populates="candidate_records")
    primary_transcript: Mapped[Transcript | None] = relationship(back_populates="candidate_records_primary")
    extraction_runs: Mapped[list[ExtractionRun]] = relationship(
        "ExtractionRun",
        back_populates="candidate_record",
        order_by="ExtractionRun.run_index",
    )
    export_jobs: Mapped[list[ExportJob]] = relationship(back_populates="candidate_record")
    narrative_generations: Mapped[list["CandidateNarrativeGeneration"]] = relationship(
        "CandidateNarrativeGeneration",
        back_populates="candidate_record",
        order_by="CandidateNarrativeGeneration.version",
    )
    ats_sync_logs: Mapped[list["AtsSyncLog"]] = relationship(
        "AtsSyncLog",
        back_populates="candidate_record",
    )
