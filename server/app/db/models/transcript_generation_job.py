from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import TranscriptJobStatus
from app.db.mixins import TimestampMixin
from app.db.postgresql_enums import pg_str_enum

if TYPE_CHECKING:
    from app.db.models.audio_upload import AudioUpload


class TranscriptGenerationJob(Base, TimestampMixin):
    """Placeholder job row until a real ASR worker updates transcript rows."""

    __tablename__ = "transcript_generation_jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    audio_upload_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("audio_uploads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[TranscriptJobStatus] = mapped_column(
        pg_str_enum(TranscriptJobStatus, name="transcript_job_status"),
        nullable=False,
        server_default=TranscriptJobStatus.QUEUED.value,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")

    audio_upload: Mapped["AudioUpload"] = relationship(back_populates="transcript_jobs")
