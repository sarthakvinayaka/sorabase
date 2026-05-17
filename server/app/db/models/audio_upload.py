from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Float, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import AudioUploadStatus
from app.db.mixins import TimestampMixin
from app.db.postgresql_enums import pg_str_enum

if TYPE_CHECKING:
    from app.db.models.candidate_record import CandidateRecord
    from app.db.models.organization import Organization
    from app.db.models.recruiter import Recruiter
    from app.db.models.transcript import Transcript


class AudioUpload(Base, TimestampMixin):
    __tablename__ = "audio_uploads"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    uploaded_by_recruiter_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("recruiters.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    storage_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(512), nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    byte_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    job_reference: Mapped[str | None] = mapped_column(String(512), nullable=True)
    upload_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[AudioUploadStatus] = mapped_column(
        pg_str_enum(AudioUploadStatus, name="audio_upload_status"),
        nullable=False,
        server_default=AudioUploadStatus.PENDING.value,
    )

    organization: Mapped[Organization] = relationship(back_populates="audio_uploads")
    uploaded_by_recruiter: Mapped[Recruiter | None] = relationship(back_populates="audio_uploads")
    transcripts: Mapped[list[Transcript]] = relationship(back_populates="audio_upload")
    transcript_jobs: Mapped[list["TranscriptGenerationJob"]] = relationship(
        "TranscriptGenerationJob",
        back_populates="audio_upload",
    )
    candidate_records: Mapped[list[CandidateRecord]] = relationship(back_populates="audio_upload")
