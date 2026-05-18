import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.db.models import Job
from app.domain.schemas import JobCreate, JobUpdate


def create(db: Session, body: JobCreate, org_id: uuid.UUID) -> Job:
    job = Job(
        org_id=org_id,
        title=body.title,
        description=body.description,
        requirements=body.requirements,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get(db: Session, job_id: uuid.UUID, org_id: uuid.UUID | None = None) -> Job | None:
    job = db.get(Job, job_id)
    if job is None:
        return None
    if org_id is not None and job.org_id != org_id:
        return None
    return job


def list_all(db: Session, org_id: uuid.UUID) -> list[Job]:
    return db.query(Job).filter(Job.org_id == org_id).order_by(Job.created_at.desc()).all()


def update(db: Session, job: Job, body: JobUpdate) -> Job:
    if body.title is not None:
        job.title = body.title
    if body.description is not None:
        job.description = body.description
    if body.requirements is not None:
        job.requirements = body.requirements
    if body.status is not None:
        job.status = body.status
    job.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return job
