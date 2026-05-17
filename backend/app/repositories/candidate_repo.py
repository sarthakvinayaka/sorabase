import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import AuditLog, Candidate, Conversation, ExtractionRun, ExtractedField
from app.domain.api_schemas import (
    CandidateDetail,
    CandidateListItem,
    CandidateListResponse,
    CandidateRead,
    ConversationRead,
    ExtractionRunRead,
    ExtractedFieldRead,
)


def get(db: Session, candidate_id: uuid.UUID) -> Candidate | None:
    return db.get(Candidate, candidate_id)


def get_or_create_for_conversation(
    db: Session, conversation_id: uuid.UUID
) -> Candidate:
    """
    Find an existing candidate linked to this conversation, or create a new one.
    Idempotent: repeated calls for the same conversation return the same candidate.
    """
    existing = (
        db.query(Candidate)
        .join(Conversation, Conversation.candidate_id == Candidate.id)
        .filter(Conversation.id == conversation_id)
        .first()
    )
    if existing:
        return existing

    candidate = Candidate(org_id=uuid.UUID(settings.default_org_id))
    db.add(candidate)
    db.flush()
    return candidate


def get_detail(db: Session, candidate_id: uuid.UUID) -> CandidateDetail | None:
    candidate = db.get(Candidate, candidate_id)
    if candidate is None:
        return None

    extraction_run_id = candidate.latest_extraction_run_id
    if extraction_run_id is None:
        return None

    extraction_run: ExtractionRun | None = db.get(ExtractionRun, extraction_run_id)
    if extraction_run is None:
        return None

    fields = (
        db.query(ExtractedField)
        .filter(ExtractedField.extraction_run_id == extraction_run_id)
        .order_by(ExtractedField.field_name)
        .all()
    )

    conversation: Conversation | None = db.get(Conversation, extraction_run.conversation_id)

    return CandidateDetail(
        candidate=CandidateRead.model_validate(candidate),
        extraction=ExtractionRunRead.model_validate(extraction_run),
        fields=[ExtractedFieldRead.model_validate(f) for f in fields],
        conversation=ConversationRead.model_validate(conversation),
    )


def list_candidates(
    db: Session,
    *,
    page: int = 1,
    limit: int = 20,
    approval_status: str | None = None,
) -> CandidateListResponse:
    query = db.query(Candidate).order_by(Candidate.created_at.desc())

    if approval_status:
        query = query.filter(Candidate.approval_status == approval_status)

    total = query.count()
    offset = (page - 1) * limit
    candidates = query.offset(offset).limit(limit).all()

    items: list[CandidateListItem] = []
    for candidate in candidates:
        full_name: str | None = None
        summary: str | None = None
        extraction_status: str | None = None
        job_reference: str | None = None

        if candidate.latest_extraction_run_id:
            run: ExtractionRun | None = db.get(ExtractionRun, candidate.latest_extraction_run_id)
            if run:
                summary = run.candidate_summary
                extraction_status = run.status
                conv: Conversation | None = db.get(Conversation, run.conversation_id)
                if conv:
                    job_reference = conv.job_reference

                name_field: ExtractedField | None = (
                    db.query(ExtractedField)
                    .filter_by(
                        extraction_run_id=candidate.latest_extraction_run_id,
                        field_name="full_name",
                    )
                    .first()
                )
                if name_field:
                    effective: Any = (
                        name_field.reviewed_value
                        if name_field.edited and name_field.reviewed_value is not None
                        else name_field.normalized_value or name_field.raw_value
                    )
                    full_name = str(effective) if effective is not None else None

        items.append(
            CandidateListItem(
                id=candidate.id,
                approval_status=candidate.approval_status,
                full_name=full_name,
                candidate_summary=summary,
                job_reference=job_reference,
                extraction_status=extraction_status,
                created_at=candidate.created_at,
                updated_at=candidate.updated_at,
            )
        )

    return CandidateListResponse(items=items, total=total, page=page, limit=limit)


def get_audit_log(
    db: Session,
    candidate_id: uuid.UUID,
) -> list[tuple["AuditLog", str | None]]:
    """
    Return all audit entries relevant to this candidate, newest first.
    Covers: the candidate entity, its latest extraction run, and all fields
    from that run. Each entry is paired with the field_name (or None) so the
    caller can render human-readable labels without an extra query.
    """
    candidate = db.get(Candidate, candidate_id)
    if candidate is None:
        return []

    entity_ids: list[uuid.UUID] = [candidate_id]
    field_name_map: dict[uuid.UUID, str] = {}

    if candidate.latest_extraction_run_id:
        entity_ids.append(candidate.latest_extraction_run_id)
        fields = (
            db.query(ExtractedField)
            .filter(ExtractedField.extraction_run_id == candidate.latest_extraction_run_id)
            .all()
        )
        for f in fields:
            entity_ids.append(f.id)
            field_name_map[f.id] = f.field_name

    entries = (
        db.query(AuditLog)
        .filter(AuditLog.entity_id.in_(entity_ids))
        .order_by(AuditLog.created_at.desc())
        .all()
    )
    return [(entry, field_name_map.get(entry.entity_id)) for entry in entries]


def update_approval(
    db: Session,
    candidate_id: uuid.UUID,
    approval_status: str,
) -> Candidate | None:
    candidate = db.get(Candidate, candidate_id)
    if candidate is None:
        return None
    candidate.approval_status = approval_status
    candidate.updated_at = datetime.now(timezone.utc)
    db.flush()
    return candidate
