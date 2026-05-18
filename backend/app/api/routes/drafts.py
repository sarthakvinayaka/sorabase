import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.db.session import get_db
from app.domain.api_schemas import (
    CandidateDraftRead,
    DraftEditRequest,
    SubmittalGenerateRequest,
    SummaryGenerateRequest,
)
from app.repositories import candidate_repo, draft_repo
from app.services import draft_service
from app.services.draft_service import (
    AnalysisRunNotReadyError,
    CandidateNotReadyError,
    DraftNotFoundError,
)
from app.services.drafts_client import DraftGenerationError

router = APIRouter()


@router.post(
    "/candidates/{candidate_id}/drafts/summary",
    response_model=CandidateDraftRead,
    status_code=201,
)
def generate_summary(
    candidate_id: uuid.UUID,
    body: SummaryGenerateRequest,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    if candidate_repo.get(db, candidate_id, org_id=org_id) is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    try:
        draft = draft_service.generate_summary_draft(db, candidate_id, actor_id=body.actor_id)
    except CandidateNotReadyError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except DraftGenerationError as exc:
        raise HTTPException(status_code=502, detail=f"Draft generation failed: {exc}")

    return CandidateDraftRead.model_validate(draft)


@router.post(
    "/candidates/{candidate_id}/drafts/submittal",
    response_model=CandidateDraftRead,
    status_code=201,
)
def generate_submittal(
    candidate_id: uuid.UUID,
    body: SubmittalGenerateRequest,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    if candidate_repo.get(db, candidate_id, org_id=org_id) is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    try:
        draft = draft_service.generate_submittal_draft(
            db,
            candidate_id=candidate_id,
            analysis_run_id=body.analysis_run_id,
            actor_id=body.actor_id,
        )
    except CandidateNotReadyError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except AnalysisRunNotReadyError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except DraftGenerationError as exc:
        raise HTTPException(status_code=502, detail=f"Draft generation failed: {exc}")

    return CandidateDraftRead.model_validate(draft)


@router.get(
    "/candidates/{candidate_id}/drafts",
    response_model=list[CandidateDraftRead],
)
def list_drafts(
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    if candidate_repo.get(db, candidate_id, org_id=org_id) is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    drafts = draft_repo.list_for_candidate(db, candidate_id)
    return [CandidateDraftRead.model_validate(d) for d in drafts]


@router.patch(
    "/candidates/{candidate_id}/drafts/{draft_id}",
    response_model=CandidateDraftRead,
)
def edit_draft(
    candidate_id: uuid.UUID,
    draft_id: uuid.UUID,
    body: DraftEditRequest,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    if candidate_repo.get(db, candidate_id, org_id=org_id) is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    try:
        draft = draft_service.edit_draft(
            db,
            draft_id=draft_id,
            candidate_id=candidate_id,
            content=body.content,
            actor_id=body.actor_id,
        )
    except DraftNotFoundError:
        raise HTTPException(status_code=404, detail="Draft not found.")

    return CandidateDraftRead.model_validate(draft)
