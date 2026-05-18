import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.db.session import get_db
from app.domain.api_schemas import (
    ApprovalUpdateRequest,
    AuditLogEntry,
    AuditLogResponse,
    CandidateDetail,
    CandidateListResponse,
    CandidateRead,
    ExtractedFieldRead,
    FieldActionRequest,
    FieldEditRequest,
)
from app.repositories import candidate_repo, extraction_repo
from app.services import audit_service

router = APIRouter()


@router.get("/candidates", response_model=CandidateListResponse)
def list_candidates(
    page: int = Query(1, ge=1, description="Page number, 1-indexed."),
    limit: int = Query(20, ge=1, le=100, description="Results per page."),
    approval_status: str | None = Query(
        None,
        description="Filter by approval status: needs_review | approved | rejected",
    ),
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    return candidate_repo.list_candidates(
        db, org_id=org_id, page=page, limit=limit, approval_status=approval_status
    )


@router.get("/candidates/{candidate_id}", response_model=CandidateDetail)
def get_candidate(
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    detail = candidate_repo.get_detail(db, candidate_id, org_id=org_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    return detail


@router.patch("/candidates/{candidate_id}/approval", response_model=CandidateRead)
def update_approval(
    candidate_id: uuid.UUID,
    body: ApprovalUpdateRequest,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    candidate = candidate_repo.get(db, candidate_id, org_id=org_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    old_status = candidate.approval_status
    updated = candidate_repo.update_approval(db, candidate_id, body.approval_status)

    audit_service.log(
        db,
        entity_type="candidate",
        entity_id=candidate_id,
        action="approval_updated",
        actor_id=body.actor_id,
        old_value={"approval_status": old_status},
        new_value={"approval_status": body.approval_status},
        source="human",
    )
    db.commit()
    db.refresh(updated)
    return updated


@router.patch(
    "/candidates/{candidate_id}/fields/{field_id}",
    response_model=ExtractedFieldRead,
)
def edit_field(
    candidate_id: uuid.UUID,
    field_id: uuid.UUID,
    body: FieldEditRequest,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    # Validate candidate ownership before accessing field
    if candidate_repo.get(db, candidate_id, org_id=org_id) is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    field = extraction_repo.get_field(db, field_id, candidate_id=candidate_id)
    if field is None:
        raise HTTPException(status_code=404, detail="Field not found.")

    old_value = field.reviewed_value if field.edited else field.normalized_value

    updated = extraction_repo.update_field(db, field_id, body.reviewed_value, body.actor_id)

    audit_service.log(
        db,
        entity_type="field",
        entity_id=field_id,
        action="edited",
        actor_id=body.actor_id,
        old_value={"status": field.status, "value": old_value},
        new_value={"status": "edited", "value": body.reviewed_value},
        source="human",
    )
    db.commit()
    db.refresh(updated)

    return updated


@router.post(
    "/candidates/{candidate_id}/fields/{field_id}/confirm",
    response_model=ExtractedFieldRead,
)
def confirm_field(
    candidate_id: uuid.UUID,
    field_id: uuid.UUID,
    body: FieldActionRequest,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    """
    Recruiter confirms the current value is correct. Status → confirmed.
    The raw/normalized/reviewed values are preserved exactly as-is.
    Audit records what was confirmed (the effective value at confirmation time).
    """
    # Validate candidate ownership before accessing field
    if candidate_repo.get(db, candidate_id, org_id=org_id) is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    field = extraction_repo.get_field(db, field_id, candidate_id=candidate_id)
    if field is None:
        raise HTTPException(status_code=404, detail="Field not found.")

    old_status = field.status
    # Capture the effective value being confirmed so the audit entry is self-contained.
    if field.edited and field.reviewed_value is not None:
        confirmed_value = field.reviewed_value
    else:
        confirmed_value = field.normalized_value if field.normalized_value is not None else field.raw_value

    updated = extraction_repo.confirm_field(db, field_id)

    audit_service.log(
        db,
        entity_type="field",
        entity_id=field_id,
        action="confirmed",
        actor_id=body.actor_id,
        old_value={"status": old_status},
        new_value={"status": "confirmed", "confirmed_value": confirmed_value},
        source="human",
    )
    db.commit()
    db.refresh(updated)
    return updated


@router.post(
    "/candidates/{candidate_id}/fields/{field_id}/unresolve",
    response_model=ExtractedFieldRead,
)
def unresolve_field(
    candidate_id: uuid.UUID,
    field_id: uuid.UUID,
    body: FieldActionRequest,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    """
    Recruiter marks a field as unresolved — cannot be determined from available info.
    Status → unresolved. Values preserved. Audit records the transition.
    """
    # Validate candidate ownership before accessing field
    if candidate_repo.get(db, candidate_id, org_id=org_id) is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    field = extraction_repo.get_field(db, field_id, candidate_id=candidate_id)
    if field is None:
        raise HTTPException(status_code=404, detail="Field not found.")

    old_status = field.status
    updated = extraction_repo.unresolve_field(db, field_id)

    audit_service.log(
        db,
        entity_type="field",
        entity_id=field_id,
        action="unresolved",
        actor_id=body.actor_id,
        old_value={"status": old_status},
        new_value={"status": "unresolved"},
        source="human",
    )
    db.commit()
    db.refresh(updated)
    return updated


@router.get("/candidates/{candidate_id}/audit", response_model=AuditLogResponse)
def get_audit_log(
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    """
    Full audit trail for this candidate: the candidate entity, its extraction run,
    and all fields from the latest extraction run. Sorted newest → oldest.
    """
    if candidate_repo.get(db, candidate_id, org_id=org_id) is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    enriched = candidate_repo.get_audit_log(db, candidate_id, org_id=org_id)
    entries = [
        AuditLogEntry(
            id=entry.id,
            entity_type=entry.entity_type,
            entity_id=entry.entity_id,
            action=entry.action,
            actor_id=entry.actor_id,
            old_value=entry.old_value,
            new_value=entry.new_value,
            source=entry.source,
            created_at=entry.created_at,
            field_name=field_name,
        )
        for entry, field_name in enriched
    ]
    return AuditLogResponse(entries=entries, total=len(entries))
