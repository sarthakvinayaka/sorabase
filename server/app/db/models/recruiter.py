from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, Uuid, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.db.models.audio_upload import AudioUpload
    from app.db.models.candidate_record import CandidateRecord
    from app.db.models.organization import Organization
    from app.db.models.user import User


class Recruiter(Base, TimestampMixin):
    __tablename__ = "recruiters"
    __table_args__ = (UniqueConstraint("user_id", "organization_id", name="uq_recruiters_user_org"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    display_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped[User] = relationship(back_populates="recruiters")
    organization: Mapped[Organization] = relationship(back_populates="recruiters")
    audio_uploads: Mapped[list[AudioUpload]] = relationship(back_populates="uploaded_by_recruiter")
    candidate_records: Mapped[list[CandidateRecord]] = relationship(back_populates="created_by_recruiter")
