"""
Export endpoints for General Mode extraction sessions.

GET  /api/candidates/{id}/general-export          — JSON payload (download)
GET  /api/candidates/{id}/general-export/csv      — CSV (download)
GET  /api/candidates/{id}/general-export/payload  — JSON payload (inline, for clipboard / API access)
POST /api/candidates/{id}/general-export/webhook  — deliver payload to a URL
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.domain.general_export_schemas import (
    WebhookDeliveryRequest,
    WebhookDeliveryResult,
)
from app.services import audit_service
from app.services.general_export_service import build_general_export, render_csv
from app.services import webhook_delivery_service

router = APIRouter()


def _get_export_or_404(db: Session, candidate_id: uuid.UUID, include_transcript: bool = False):
    export = build_general_export(db, candidate_id, include_transcript=include_transcript)
    if export is None:
        raise HTTPException(
            status_code=404,
            detail="Session not found or no extraction available.",
        )
    return export


def _log_export(db: Session, candidate_id: uuid.UUID, format: str) -> None:
    audit_service.log(
        db,
        entity_type="candidate",
        entity_id=candidate_id,
        action="exported",
        actor_id="recruiter",
        new_value={"format": format, "mode": "general"},
        source="human",
    )
    db.commit()


# ---------------------------------------------------------------------------
# JSON download
# ---------------------------------------------------------------------------

@router.get("/candidates/{candidate_id}/general-export")
def export_general_json(
    candidate_id: uuid.UUID,
    include_transcript: bool = Query(False),
    db: Session = Depends(get_db),
):
    export = _get_export_or_404(db, candidate_id, include_transcript=include_transcript)
    _log_export(db, candidate_id, "json")
    return JSONResponse(
        content=export.model_dump(mode="json"),
        headers={
            "Content-Disposition": f'attachment; filename="general_session_{candidate_id}.json"',
        },
    )


# ---------------------------------------------------------------------------
# JSON payload — inline (for copy-to-clipboard / API clients)
# ---------------------------------------------------------------------------

@router.get("/candidates/{candidate_id}/general-export/payload")
def export_general_payload(
    candidate_id: uuid.UUID,
    include_transcript: bool = Query(False),
    db: Session = Depends(get_db),
):
    export = _get_export_or_404(db, candidate_id, include_transcript=include_transcript)
    return export.model_dump(mode="json")


# ---------------------------------------------------------------------------
# CSV download
# ---------------------------------------------------------------------------

@router.get("/candidates/{candidate_id}/general-export/csv")
def export_general_csv(
    candidate_id: uuid.UUID,
    include_transcript: bool = Query(False),
    db: Session = Depends(get_db),
):
    export = _get_export_or_404(db, candidate_id, include_transcript=include_transcript)
    _log_export(db, candidate_id, "csv")
    csv_text = render_csv(export)
    return PlainTextResponse(
        content=csv_text,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="general_session_{candidate_id}.csv"',
        },
    )


# ---------------------------------------------------------------------------
# Webhook delivery
# ---------------------------------------------------------------------------

@router.post(
    "/candidates/{candidate_id}/general-export/webhook",
    response_model=WebhookDeliveryResult,
)
def send_general_webhook(
    candidate_id: uuid.UUID,
    body: WebhookDeliveryRequest,
    db: Session = Depends(get_db),
):
    export = _get_export_or_404(db, candidate_id, include_transcript=body.include_transcript)

    if not body.include_summary:
        export = export.model_copy(update={"summary": None})

    result = webhook_delivery_service.deliver(
        url=body.url,
        payload=export.model_dump(mode="json"),
        event="general.extraction.exported",
    )

    if result.status == "delivered":
        audit_service.log(
            db,
            entity_type="candidate",
            entity_id=candidate_id,
            action="exported",
            actor_id="recruiter",
            new_value={"format": "webhook", "url": body.url, "http_status": result.http_status},
            source="human",
        )
        db.commit()

    return result
