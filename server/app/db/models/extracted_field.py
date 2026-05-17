from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, Uuid, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import ExtractedFieldSource, ExtractedFieldStatus
from app.db.mixins import TimestampMixin
from app.db.postgresql_enums import pg_str_enum

if TYPE_CHECKING:
    from app.db.models.extraction_run import ExtractionRun
    from app.db.models.field_evidence import FieldEvidence
    from app.db.models.user import User


class ExtractedField(Base, TimestampMixin):
    __tablename__ = "extracted_fields"
    __table_args__ = (UniqueConstraint("extraction_run_id", "field_name", name="uq_extracted_fields_run_name"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    extraction_run_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("extraction_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    field_name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    field_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_extracted_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Numeric(6, 5), nullable=True)
    status: Mapped[ExtractedFieldStatus] = mapped_column(
        pg_str_enum(ExtractedFieldStatus, name="extracted_field_status"),
        nullable=False,
        server_default=ExtractedFieldStatus.PENDING.value,
    )
    source: Mapped[ExtractedFieldSource] = mapped_column(
        pg_str_enum(ExtractedFieldSource, name="extracted_field_source"),
        nullable=False,
        server_default=ExtractedFieldSource.MODEL.value,
    )
    edited_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    bullhorn_field_key: Mapped[str | None] = mapped_column(String(256), nullable=True, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    extraction_run: Mapped[ExtractionRun] = relationship(back_populates="extracted_fields")
    edited_by_user: Mapped[User | None] = relationship(back_populates="edited_fields")
    evidences: Mapped[list[FieldEvidence]] = relationship(
        "FieldEvidence",
        back_populates="extracted_field",
    )
