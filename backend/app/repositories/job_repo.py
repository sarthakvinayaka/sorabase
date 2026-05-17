import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.db.models import Job
from app.domain.schemas import JobCreate, JobUpdate
from app.config import settings


def create(db: Session, body: JobCreate) -> Job:
    job = Job(
        org_id=uuid.UUID(settings.default_org_id),
        title=body.title,
        description=body.description,
        requirements=body.requirements,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get(db: Session, job_id: uuid.UUID) -> Job | None:
    return db.get(Job, job_id)


def list_all(db: Session) -> list[Job]:
    return db.query(Job).order_by(Job.created_at.desc()).all()


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
