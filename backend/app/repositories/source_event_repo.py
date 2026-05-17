import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import SourceEvent


def get(db: Session, source_event_id: uuid.UUID) -> SourceEvent | None:
    return db.get(SourceEvent, source_event_id)


def list_for_conversation(db: Session, conversation_id: uuid.UUID) -> list[SourceEvent]:
    return list(
        db.scalars(
            select(SourceEvent)
            .where(SourceEvent.conversation_id == conversation_id)
            .order_by(SourceEvent.created_at.desc())
        ).all()
    )


def get_by_external_id(
    db: Session, source_type: str, external_id: str
) -> SourceEvent | None:
    """Look up an existing event by (source_type, external_id) for deduplication."""
    return db.scalars(
        select(SourceEvent)
        .where(SourceEvent.source_type == source_type)
        .where(SourceEvent.external_id == external_id)
        .order_by(SourceEvent.created_at.desc())
        .limit(1)
    ).first()
