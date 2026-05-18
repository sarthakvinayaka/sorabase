import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.db.session import get_db
from app.domain.api_schemas import AnalysisRunRead, AnalysisTriggerRequest, ScoreOverrideRequest
from app.repositories import analysis_repo, candidate_repo
from app.services import analysis_service
from app.services.analysis_client import AnalysisError
from app.services.analysis_service import (
    CandidateNotFoundError,
    ExtractionNotReadyError,
    JobNotFoundError,
)

router = APIRouter()


@router.post(
    "/candidates/{candidate_id}/analyses",
    response_model=AnalysisRunRead,
    status_code=201,
)
def trigger_analysis(
    candidate_id: uuid.UUID,
    body: AnalysisTriggerRequest,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    if candidate_repo.get(db, candidate_id, org_id=org_id) is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    try:
        run = analysis_service.run_analysis(
            db,
            candidate_id=candidate_id,
            job_id=body.job_id,
            actor_id=body.actor_id,
        )
    except CandidateNotFoundError:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    except JobNotFoundError:
        raise HTTPException(status_code=404, detail="Job not found.")
    except ExtractionNotReadyError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except AnalysisError as exc:
        raise HTTPException(status_code=502, detail=f"Analysis LLM error: {exc}")

    return AnalysisRunRead.model_validate(run)


@router.get(
    "/candidates/{candidate_id}/analyses",
    response_model=list[AnalysisRunRead],
)
def list_analyses(
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    if candidate_repo.get(db, candidate_id, org_id=org_id) is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    runs = analysis_repo.list_for_candidate(db, candidate_id)
    return [AnalysisRunRead.model_validate(r) for r in runs]


@router.get(
    "/candidates/{candidate_id}/analyses/{analysis_id}",
    response_model=AnalysisRunRead,
)
def get_analysis(
    candidate_id: uuid.UUID,
    analysis_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    if candidate_repo.get(db, candidate_id, org_id=org_id) is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    run = analysis_repo.get(db, analysis_id)
    if run is None or run.candidate_id != candidate_id:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return AnalysisRunRead.model_validate(run)


@router.patch(
    "/candidates/{candidate_id}/analyses/{analysis_id}/override",
    response_model=AnalysisRunRead,
)
def override_score(
    candidate_id: uuid.UUID,
    analysis_id: uuid.UUID,
    body: ScoreOverrideRequest,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    if candidate_repo.get(db, candidate_id, org_id=org_id) is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    run = analysis_repo.get(db, analysis_id)
    if run is None or run.candidate_id != candidate_id:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    if run.status != "completed":
        raise HTTPException(status_code=422, detail="Cannot override score on an incomplete analysis.")

    run.recruiter_override_score  = body.override_score
    run.recruiter_override_reason = body.override_reason
    run.score_status              = "overridden"
    db.commit()
    db.refresh(run)
    return AnalysisRunRead.model_validate(run)
