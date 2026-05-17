from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.db.models.ats_connection import AtsConnection
    from app.db.models.audio_upload import AudioUpload
    from app.db.models.audit_log import AuditLog
    from app.db.models.candidate_record import CandidateRecord
    from app.db.models.export_job import ExportJob
    from app.db.models.recruiter import Recruiter
    from app.db.models.user import User


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")

    users: Mapped[list[User]] = relationship(back_populates="organization")
    recruiters: Mapped[list[Recruiter]] = relationship(back_populates="organization")
    audio_uploads: Mapped[list[AudioUpload]] = relationship(back_populates="organization")
    candidate_records: Mapped[list[CandidateRecord]] = relationship(back_populates="organization")
    export_jobs: Mapped[list[ExportJob]] = relationship(back_populates="organization")
    ats_connections: Mapped[list[AtsConnection]] = relationship(back_populates="organization")
    audit_logs: Mapped[list[AuditLog]] = relationship(back_populates="organization")
