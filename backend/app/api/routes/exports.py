import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.db.session import get_db
from app.repositories import candidate_repo
from app.services import audit_service, export_service

router = APIRouter()


@router.get("/candidates/{candidate_id}/export")
def export_candidate(
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    # Validate ownership first
    if candidate_repo.get(db, candidate_id, org_id=org_id) is None:
        raise HTTPException(
            status_code=404,
            detail="Candidate not found or no extraction available.",
        )

    export = export_service.build_export(db, candidate_id)
    if export is None:
        raise HTTPException(
            status_code=404,
            detail="Candidate not found or no extraction available.",
        )

    audit_service.log(
        db,
        entity_type="candidate",
        entity_id=candidate_id,
        action="exported",
        actor_id="recruiter",
        source="human",
    )
    db.commit()

    return JSONResponse(
        content=export.model_dump(mode="json"),
        headers={
            "Content-Disposition": f'attachment; filename="candidate_{candidate_id}.json"'
        },
    )
