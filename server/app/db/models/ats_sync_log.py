from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import AtsSyncLogStatus
from app.db.mixins import TimestampMixin
from app.db.postgresql_enums import pg_str_enum

if TYPE_CHECKING:
    from app.db.models.ats_connection import AtsConnection
    from app.db.models.candidate_record import CandidateRecord
    from app.db.models.extraction_run import ExtractionRun


class AtsSyncLog(Base, TimestampMixin):
    """Immutable-ish sync attempt log (use created_at as event time; updated_at for corrections only)."""

    __tablename__ = "ats_sync_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ats_connection_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("ats_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    candidate_record_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("candidate_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    extraction_run_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("extraction_runs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[AtsSyncLogStatus] = mapped_column(
        pg_str_enum(AtsSyncLogStatus, name="ats_sync_log_status"),
        nullable=False,
        server_default=AtsSyncLogStatus.STARTED.value,
    )
    request_summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    response_summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    external_entity_ref: Mapped[str | None] = mapped_column(String(512), nullable=True)

    ats_connection: Mapped[AtsConnection] = relationship(back_populates="sync_logs")
    candidate_record: Mapped[CandidateRecord] = relationship(back_populates="ats_sync_logs")
    extraction_run: Mapped[ExtractionRun | None] = relationship(back_populates="ats_sync_logs")
