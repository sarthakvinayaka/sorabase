from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import AuditActorType
from app.db.mixins import TimestampMixin
from app.db.postgresql_enums import pg_str_enum

if TYPE_CHECKING:
    from app.db.models.organization import Organization
    from app.db.models.user import User


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_type: Mapped[AuditActorType] = mapped_column(
        pg_str_enum(AuditActorType, name="audit_actor_type"),
        nullable=False,
        server_default=AuditActorType.SYSTEM.value,
    )
    action: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True, index=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, server_default="{}")
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)

    organization: Mapped[Organization | None] = relationship(back_populates="audit_logs")
    actor_user: Mapped[User | None] = relationship(back_populates="audit_logs")
