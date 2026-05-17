"""HTTP handlers for approved candidate record exports (JSON / CSV)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.db.enums import ExportJobFormat
from app.services.candidate_export_service import (
    build_approved_export_csv_from_payload,
    build_approved_export_payload,
    export_payload_to_json_bytes,
    record_export_job,
)

router = APIRouter(tags=["candidate-export"])


def _http_error(exc: ValueError) -> HTTPException:
    detail = str(exc)
    status = 404 if detail == "Candidate not found" else 400
    return HTTPException(status_code=status, detail=detail)


@router.get("/candidates/{candidate_id}/export/preview")
def preview_approved_candidate_export(
    db: Annotated[Session, Depends(get_db)],
    candidate_id: uuid.UUID,
    organization_id: Annotated[uuid.UUID, Query(description="Tenant scope for authorization.")],
) -> Response:
    """Return the same JSON document as `export.json` without `Content-Disposition` (read-only; no export job row)."""
    try:
        payload = build_approved_export_payload(
            db,
            candidate_id=candidate_id,
            organization_id=organization_id,
        )
    except ValueError as exc:
        raise _http_error(exc) from exc
    body = export_payload_to_json_bytes(payload)
    return Response(
        content=body,
        media_type="application/json; charset=utf-8",
        headers={"Cache-Control": "no-store"},
    )


@router.get("/candidates/{candidate_id}/export.json")
def download_approved_candidate_export_json(
    db: Annotated[Session, Depends(get_db)],
    candidate_id: uuid.UUID,
    organization_id: Annotated[uuid.UUID, Query(description="Tenant scope for authorization.")],
    requested_by_user_id: Annotated[
        uuid.UUID | None,
        Query(description="Optional user id for export_jobs.requested_by_user_id audit."),
    ] = None,
) -> Response:
    try:
        payload = build_approved_export_payload(
            db,
            candidate_id=candidate_id,
            organization_id=organization_id,
        )
        body = export_payload_to_json_bytes(payload)
        record_export_job(
            db,
            organization_id=organization_id,
            candidate_id=candidate_id,
            requested_by_user_id=requested_by_user_id,
            export_format=ExportJobFormat.JSON,
            meta={
                "bytes": len(body),
                "export_schema_version": payload["export_schema_version"],
                "field_count": len(payload["structured_fields"]),
                "structured_field_keys": sorted(payload["structured_fields"].keys()),
                "inline_download": True,
            },
        )
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise _http_error(exc) from exc

    filename = f"candidate-{candidate_id}.json"
    return Response(
        content=body,
        media_type="application/json; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/candidates/{candidate_id}/export.csv")
def download_approved_candidate_export_csv(
    db: Annotated[Session, Depends(get_db)],
    candidate_id: uuid.UUID,
    organization_id: Annotated[uuid.UUID, Query(description="Tenant scope for authorization.")],
    requested_by_user_id: Annotated[
        uuid.UUID | None,
        Query(description="Optional user id for export_jobs.requested_by_user_id audit."),
    ] = None,
) -> Response:
    try:
        payload = build_approved_export_payload(
            db,
            candidate_id=candidate_id,
            organization_id=organization_id,
        )
        csv_text = build_approved_export_csv_from_payload(payload)
        body = ("\ufeff" + csv_text).encode("utf-8")
        record_export_job(
            db,
            organization_id=organization_id,
            candidate_id=candidate_id,
            requested_by_user_id=requested_by_user_id,
            export_format=ExportJobFormat.CSV,
            meta={
                "bytes": len(body),
                "export_schema_version": payload["export_schema_version"],
                "field_count": len(payload["structured_fields"]),
                "structured_field_keys": sorted(payload["structured_fields"].keys()),
                "inline_download": True,
            },
        )
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise _http_error(exc) from exc

    filename = f"candidate-{candidate_id}.csv"
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )
