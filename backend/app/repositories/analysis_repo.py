import uuid

from sqlalchemy.orm import Session

from app.db.models import AnalysisRun


def create(db: Session, **kwargs) -> AnalysisRun:
    run = AnalysisRun(**kwargs)
    db.add(run)
    db.flush()
    return run


def get(db: Session, analysis_id: uuid.UUID) -> AnalysisRun | None:
    return db.get(AnalysisRun, analysis_id)


def list_for_candidate(
    db: Session,
    candidate_id: uuid.UUID,
) -> list[AnalysisRun]:
    return (
        db.query(AnalysisRun)
        .filter(AnalysisRun.candidate_id == candidate_id)
        .order_by(AnalysisRun.created_at.desc())
        .all()
    )


def get_latest_for_candidate_job(
    db: Session,
    candidate_id: uuid.UUID,
    job_id: uuid.UUID,
) -> AnalysisRun | None:
    return (
        db.query(AnalysisRun)
        .filter(
            AnalysisRun.candidate_id == candidate_id,
            AnalysisRun.job_id == job_id,
        )
        .order_by(AnalysisRun.created_at.desc())
        .first()
    )


def get_latest_for_candidate(
    db: Session,
    candidate_id: uuid.UUID,
) -> AnalysisRun | None:
    return (
        db.query(AnalysisRun)
        .filter(AnalysisRun.candidate_id == candidate_id)
        .order_by(AnalysisRun.created_at.desc())
        .first()
    )
