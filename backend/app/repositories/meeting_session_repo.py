"""CRUD helpers for MeetingSession rows."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.db.models import MeetingSession


def create(
    db: Session,
    *,
    source_event_id: uuid.UUID,
    conversation_id: uuid.UUID,
    meeting_id: str | None,
    host_email: str | None,
    mode: str = "recruiting",
    org_id: uuid.UUID | None = None,
) -> MeetingSession:
    session = MeetingSession(
        org_id=org_id,
        source_event_id=source_event_id,
        conversation_id=conversation_id,
        meeting_id=meeting_id,
        host_email=host_email,
        mode=mode,
        status="transcribing",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def set_status(
    db: Session,
    session: MeetingSession,
    status: str,
    *,
    error_message: str | None = None,
    candidate_id: uuid.UUID | None = None,
) -> None:
    session.status = status
    session.updated_at = datetime.now(timezone.utc)
    if error_message is not None:
        session.error_message = error_message
    if candidate_id is not None:
        session.candidate_id = candidate_id
    db.flush()


def list_recent(
    db: Session,
    *,
    limit: int = 20,
    status: str | None = None,
) -> list[MeetingSession]:
    q = db.query(MeetingSession)
    if status is not None:
        q = q.filter(MeetingSession.status == status)
    return q.order_by(desc(MeetingSession.created_at)).limit(limit).all()


def get(db: Session, session_id: uuid.UUID) -> MeetingSession | None:
    return db.get(MeetingSession, session_id)
