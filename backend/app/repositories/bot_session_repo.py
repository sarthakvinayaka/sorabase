"""CRUD helpers for BotSession rows."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.db.models import BotSession


def create(
    db: Session,
    *,
    provider_bot_id: str,
    meeting_url: str,
    provider: str = "recall",
    meeting_label: str | None = None,
    job_reference: str | None = None,
    auto_run: bool = True,
    mode: str = "recruiting",
    org_id: uuid.UUID | None = None,
) -> BotSession:
    session = BotSession(
        org_id=org_id,
        provider=provider,
        provider_bot_id=provider_bot_id,
        meeting_url=meeting_url,
        meeting_label=meeting_label,
        job_reference=job_reference,
        auto_run=auto_run,
        mode=mode,
        status="joining",
        webhook_events=[],
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get(db: Session, bot_session_id: uuid.UUID) -> BotSession | None:
    return db.get(BotSession, bot_session_id)


def get_by_provider_bot_id(db: Session, provider_bot_id: str) -> BotSession | None:
    return (
        db.query(BotSession)
        .filter(BotSession.provider_bot_id == provider_bot_id)
        .first()
    )


def set_status(
    db: Session,
    session: BotSession,
    status: str,
    *,
    error_message: str | None = None,
    conversation_id: uuid.UUID | None = None,
    candidate_id: uuid.UUID | None = None,
    transcript_chars: int | None = None,
) -> None:
    session.status = status
    session.updated_at = datetime.now(timezone.utc)
    if error_message is not None:
        session.error_message = error_message
    if conversation_id is not None:
        session.conversation_id = conversation_id
    if candidate_id is not None:
        session.candidate_id = candidate_id
    if transcript_chars is not None:
        session.transcript_chars = transcript_chars
    db.flush()


def mark_workflow_triggered(db: Session, session: BotSession) -> None:
    """Idempotency guard — set once before background task fires."""
    session.workflow_triggered = True
    session.updated_at = datetime.now(timezone.utc)
    db.flush()


def append_webhook_event(
    db: Session,
    session: BotSession,
    event: dict,
) -> None:
    """Append to the append-only webhook_events audit log."""
    events: list = list(session.webhook_events or [])
    events.append(event)
    session.webhook_events = events
    session.updated_at = datetime.now(timezone.utc)
    db.flush()


def list_recent(
    db: Session,
    *,
    limit: int = 20,
    status: str | None = None,
) -> list[BotSession]:
    q = db.query(BotSession)
    if status is not None:
        q = q.filter(BotSession.status == status)
    return q.order_by(desc(BotSession.created_at)).limit(limit).all()
