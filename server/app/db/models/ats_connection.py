from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import AtsConnectionStatus, AtsProvider
from app.db.mixins import TimestampMixin
from app.db.postgresql_enums import pg_str_enum

if TYPE_CHECKING:
    from app.db.models.organization import Organization


class AtsConnection(Base, TimestampMixin):
    __tablename__ = "ats_connections"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider: Mapped[AtsProvider] = mapped_column(
        pg_str_enum(AtsProvider, name="ats_provider"),
        nullable=False,
        server_default=AtsProvider.BULLHORN.value,
    )
    status: Mapped[AtsConnectionStatus] = mapped_column(
        pg_str_enum(AtsConnectionStatus, name="ats_connection_status"),
        nullable=False,
        server_default=AtsConnectionStatus.DISCONNECTED.value,
    )
    vault_secret_ref: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    organization: Mapped[Organization] = relationship(back_populates="ats_connections")
    sync_logs: Mapped[list["AtsSyncLog"]] = relationship(
        "AtsSyncLog",
        back_populates="ats_connection",
    )
