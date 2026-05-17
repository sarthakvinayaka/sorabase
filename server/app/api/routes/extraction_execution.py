"""HTTP routes for extraction execution (transcript → DB rows)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.extraction_pipeline import ExtractionTriggerResponse
from app.services.extraction.errors import (
    ExtractionConfigurationError,
    ExtractionExecutionError,
    ExtractionProviderRuntimeError,
)
from app.services.extraction.factory import get_staffing_extraction_provider
from app.services.extraction_execution_service import ExtractionExecutionService

router = APIRouter(tags=["extraction"])


@router.post("/audio/uploads/{upload_id}/extract", response_model=ExtractionTriggerResponse)
def run_extraction_for_upload(
    db: Annotated[Session, Depends(get_db)],
    upload_id: uuid.UUID,
    organization_id: Annotated[uuid.UUID, Query(description="Tenant scope for authorization.")],
) -> ExtractionTriggerResponse:
    try:
        provider = get_staffing_extraction_provider()
    except ExtractionConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    svc = ExtractionExecutionService(db, provider=provider)
    try:
        result = svc.run_extraction_for_upload(
            upload_id=upload_id,
            organization_id=organization_id,
            actor_user_id=None,
        )
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ExtractionExecutionError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ExtractionProviderRuntimeError as exc:
        db.commit()
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception:
        db.rollback()
        raise
    else:
        db.commit()
    return result
