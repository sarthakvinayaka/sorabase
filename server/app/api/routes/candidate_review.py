"""Recruiter review console API."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.candidate_review import (
    AuditTimelineResponse,
    ReviewActionResponse,
    ReviewBundleResponse,
    ReviewFieldsPatchRequest,
    ReviewPatchResponse,
    ReviewRejectRequest,
)
from app.services.candidate_review_service import CandidateReviewService

router = APIRouter(tags=["candidate-review"])


@router.get("/candidates/{candidate_id}/review", response_model=ReviewBundleResponse)
def get_review_bundle(
    db: Annotated[Session, Depends(get_db)],
    candidate_id: uuid.UUID,
    organization_id: Annotated[uuid.UUID, Query(description="Tenant scope for authorization.")],
) -> ReviewBundleResponse:
    svc = CandidateReviewService(db)
    try:
        return svc.get_bundle(candidate_id=candidate_id, organization_id=organization_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/candidates/{candidate_id}/audit-timeline", response_model=AuditTimelineResponse)
def get_candidate_audit_timeline(
    db: Annotated[Session, Depends(get_db)],
    candidate_id: uuid.UUID,
    organization_id: Annotated[uuid.UUID, Query(description="Tenant scope for authorization.")],
) -> AuditTimelineResponse:
    svc = CandidateReviewService(db)
    try:
        return svc.get_audit_timeline(candidate_id=candidate_id, organization_id=organization_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/candidates/{candidate_id}/review/fields", response_model=ReviewPatchResponse)
def patch_review_fields(
    db: Annotated[Session, Depends(get_db)],
    candidate_id: uuid.UUID,
    body: ReviewFieldsPatchRequest,
    organization_id: Annotated[uuid.UUID, Query(description="Tenant scope for authorization.")],
    editor_user_id: Annotated[uuid.UUID, Query(description="User performing edits (must exist in users table).")],
) -> ReviewPatchResponse:
    svc = CandidateReviewService(db)
    try:
        n = svc.save_field_updates(
            candidate_id=candidate_id,
            organization_id=organization_id,
            editor_user_id=editor_user_id,
            updates=body.updates,
        )
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ReviewPatchResponse(updated=n)


@router.post("/candidates/{candidate_id}/review/approve", response_model=ReviewActionResponse)
def approve_candidate_review(
    db: Annotated[Session, Depends(get_db)],
    candidate_id: uuid.UUID,
    organization_id: Annotated[uuid.UUID, Query(description="Tenant scope for authorization.")],
    editor_user_id: Annotated[uuid.UUID, Query(description="Approver user id.")],
) -> ReviewActionResponse:
    svc = CandidateReviewService(db)
    try:
        out = svc.approve(candidate_id=candidate_id, organization_id=organization_id, editor_user_id=editor_user_id)
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return out


@router.post("/candidates/{candidate_id}/review/reject", response_model=ReviewActionResponse)
def reject_candidate_review(
    db: Annotated[Session, Depends(get_db)],
    candidate_id: uuid.UUID,
    organization_id: Annotated[uuid.UUID, Query(description="Tenant scope for authorization.")],
    editor_user_id: Annotated[uuid.UUID, Query(description="User rejecting the record.")],
    body: ReviewRejectRequest | None = None,
) -> ReviewActionResponse:
    svc = CandidateReviewService(db)
    try:
        out = svc.reject(
            candidate_id=candidate_id,
            organization_id=organization_id,
            editor_user_id=editor_user_id,
            reason=body.reason if body else None,
        )
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return out
