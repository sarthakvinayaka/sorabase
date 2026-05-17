"""Recruiter summary + submittal narrative endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.candidate_narrative import NarrativeGenerationDTO, NarrativeHistoryResponse, NarrativeLatestResponse
from app.services.candidate_narrative_service import CandidateNarrativeService

router = APIRouter(tags=["candidate-narratives"])


def _http_error(exc: ValueError) -> HTTPException:
    detail = str(exc)
    status = 404 if detail == "Candidate not found" else 400
    return HTTPException(status_code=status, detail=detail)


@router.get("/candidates/{candidate_id}/narratives/latest", response_model=NarrativeLatestResponse)
def get_latest_narratives(
    db: Annotated[Session, Depends(get_db)],
    candidate_id: uuid.UUID,
    organization_id: Annotated[uuid.UUID, Query(description="Tenant scope for authorization.")],
) -> NarrativeLatestResponse:
    svc = CandidateNarrativeService(db)
    try:
        return svc.get_latest(candidate_id=candidate_id, organization_id=organization_id)
    except ValueError as exc:
        raise _http_error(exc) from exc


@router.get("/candidates/{candidate_id}/narratives/history", response_model=NarrativeHistoryResponse)
def get_narrative_history(
    db: Annotated[Session, Depends(get_db)],
    candidate_id: uuid.UUID,
    organization_id: Annotated[uuid.UUID, Query(description="Tenant scope for authorization.")],
) -> NarrativeHistoryResponse:
    svc = CandidateNarrativeService(db)
    try:
        return svc.get_history(candidate_id=candidate_id, organization_id=organization_id)
    except ValueError as exc:
        raise _http_error(exc) from exc


@router.post("/candidates/{candidate_id}/narratives/generate", response_model=NarrativeGenerationDTO)
def generate_narratives(
    db: Annotated[Session, Depends(get_db)],
    candidate_id: uuid.UUID,
    organization_id: Annotated[uuid.UUID, Query(description="Tenant scope for authorization.")],
    editor_user_id: Annotated[uuid.UUID, Query(description="User triggering regeneration.")],
) -> NarrativeGenerationDTO:
    svc = CandidateNarrativeService(db)
    try:
        out = svc.generate(
            candidate_id=candidate_id,
            organization_id=organization_id,
            editor_user_id=editor_user_id,
        )
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise _http_error(exc) from exc
    return out
