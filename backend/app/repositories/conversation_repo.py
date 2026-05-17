import uuid
from sqlalchemy import desc
from sqlalchemy.orm import Session
from app.db.models import Conversation
from app.domain.api_schemas import ConversationCreate
from app.config import settings


def create(db: Session, body: ConversationCreate) -> Conversation:
    conversation = Conversation(
        org_id=uuid.UUID(settings.default_org_id),
        source_type=body.source_type,
        status="raw",
        raw_text=body.raw_text,
        char_count=len(body.raw_text),
        recruiter_id=body.recruiter_id,
        job_reference=body.job_reference,
        job_id=body.job_id,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def get(db: Session, conversation_id: uuid.UUID) -> Conversation | None:
    return db.get(Conversation, conversation_id)


def set_status(db: Session, conversation: Conversation, status: str) -> None:
    conversation.status = status
    db.flush()


def list_by_source_type(
    db: Session,
    source_type: str,
    transcript_status: str | None = "ready",
    limit: int = 30,
) -> list[Conversation]:
    q = db.query(Conversation).filter(Conversation.source_type == source_type)
    if transcript_status is not None:
        q = q.filter(Conversation.transcript_status == transcript_status)
    return q.order_by(desc(Conversation.created_at)).limit(limit).all()
