import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.db.session import get_db
from app.domain.schemas import JobCreate, JobRead, JobUpdate
from app.repositories import job_repo

router = APIRouter()


@router.post("/jobs", response_model=JobRead, status_code=201)
def create_job(
    body: JobCreate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    return job_repo.create(db, body, org_id=org_id)


@router.get("/jobs", response_model=list[JobRead])
def list_jobs(
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    return job_repo.list_all(db, org_id=org_id)


@router.get("/jobs/{job_id}", response_model=JobRead)
def get_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    job = job_repo.get(db, job_id, org_id=org_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


@router.patch("/jobs/{job_id}", response_model=JobRead)
def update_job(
    job_id: uuid.UUID,
    body: JobUpdate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    job = job_repo.get(db, job_id, org_id=org_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job_repo.update(db, job, body)
