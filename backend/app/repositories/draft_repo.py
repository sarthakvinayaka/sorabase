import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.models import CandidateDraft


def create(db: Session, **kwargs) -> CandidateDraft:
    draft = CandidateDraft(**kwargs)
    db.add(draft)
    db.flush()
    return draft


def get(db: Session, draft_id: uuid.UUID) -> CandidateDraft | None:
    return db.get(CandidateDraft, draft_id)


def list_for_candidate(
    db: Session,
    candidate_id: uuid.UUID,
) -> list[CandidateDraft]:
    return (
        db.query(CandidateDraft)
        .filter(CandidateDraft.candidate_id == candidate_id)
        .order_by(CandidateDraft.created_at.desc())
        .all()
    )


def get_latest_by_type(
    db: Session,
    candidate_id: uuid.UUID,
    draft_type: str,
) -> CandidateDraft | None:
    return (
        db.query(CandidateDraft)
        .filter(
            CandidateDraft.candidate_id == candidate_id,
            CandidateDraft.draft_type == draft_type,
        )
        .order_by(CandidateDraft.created_at.desc())
        .first()
    )


def get_latest_submittal_for_analysis(
    db: Session,
    analysis_run_id: uuid.UUID,
) -> CandidateDraft | None:
    return (
        db.query(CandidateDraft)
        .filter(
            CandidateDraft.analysis_run_id == analysis_run_id,
            CandidateDraft.draft_type == "submittal",
        )
        .order_by(CandidateDraft.created_at.desc())
        .first()
    )


def update_content(
    db: Session,
    draft: CandidateDraft,
    content: str,
) -> CandidateDraft:
    draft.content = content
    draft.edited = True
    draft.updated_at = datetime.now(timezone.utc)
    db.flush()
    return draft
