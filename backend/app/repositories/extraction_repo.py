import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import ExtractedField, ExtractionRun


def get_field(
    db: Session,
    field_id: uuid.UUID,
    *,
    candidate_id: uuid.UUID | None = None,
) -> ExtractedField | None:
    """
    Fetch an ExtractedField by id.

    If candidate_id is provided, verifies the field's extraction run belongs
    to that candidate. Returns None (→ 404) if the field doesn't exist or the
    ownership check fails.
    """
    field = db.get(ExtractedField, field_id)
    if field is None:
        return None
    if candidate_id is not None:
        run: ExtractionRun | None = db.get(ExtractionRun, field.extraction_run_id)
        if run is None or run.candidate_id != candidate_id:
            return None
    return field


def update_field(
    db: Session,
    field_id: uuid.UUID,
    reviewed_value: Any,
    actor_id: str = "recruiter",
) -> ExtractedField | None:
    field = db.get(ExtractedField, field_id)
    if field is None:
        return None

    field.reviewed_value = reviewed_value
    field.edited = True
    field.status = "edited"
    field.updated_at = datetime.now(timezone.utc)
    db.flush()
    return field


def confirm_field(db: Session, field_id: uuid.UUID) -> ExtractedField | None:
    """Transition a field to 'confirmed'. Leaves raw/normalized/reviewed values untouched."""
    field = db.get(ExtractedField, field_id)
    if field is None:
        return None
    field.status = "confirmed"
    field.updated_at = datetime.now(timezone.utc)
    db.flush()
    return field


def unresolve_field(db: Session, field_id: uuid.UUID) -> ExtractedField | None:
    """Transition a field to 'unresolved' — recruiter cannot resolve it at this time."""
    field = db.get(ExtractedField, field_id)
    if field is None:
        return None
    field.status = "unresolved"
    field.updated_at = datetime.now(timezone.utc)
    db.flush()
    return field


def get_run(db: Session, extraction_run_id: uuid.UUID) -> ExtractionRun | None:
    return db.get(ExtractionRun, extraction_run_id)
