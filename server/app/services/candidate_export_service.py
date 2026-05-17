"""Approved-candidate exports: latest complete extraction run, APPROVED fields only."""

from __future__ import annotations

import csv
import json
import uuid
from datetime import datetime, timezone
from io import StringIO
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.enums import (
    CandidateApprovalStatus,
    ExportJobFormat,
    ExportJobStatus,
    ExtractionRunStatus,
    ExtractedFieldStatus,
)
from app.db.models.candidate_record import CandidateRecord
from app.db.models.export_job import ExportJob
from app.db.models.extraction_run import ExtractionRun
from app.db.models.extracted_field import ExtractedField
from app.db.models.recruiter import Recruiter
from app.db.models.user import User
from app.schemas.staffing_extraction import STAFFING_EXTRACTION_FIELD_KEYS

EXPORT_SCHEMA_VERSION = 1

_ALLOWED_APPROVAL = frozenset(
    {
        CandidateApprovalStatus.APPROVED,
        CandidateApprovalStatus.PARTIALLY_APPROVED,
    },
)


def _latest_complete_run(session: Session, candidate_id: uuid.UUID) -> ExtractionRun | None:
    stmt = (
        select(ExtractionRun)
        .where(
            ExtractionRun.candidate_record_id == candidate_id,
            ExtractionRun.status == ExtractionRunStatus.COMPLETE,
        )
        .options(selectinload(ExtractionRun.extracted_fields))
        .order_by(ExtractionRun.run_index.desc())
        .limit(1)
    )
    return session.scalars(stmt).first()


def _parse_field_value(raw: str | None) -> str | int | float | bool | list[Any] | dict[str, Any] | None:
    if raw is None or raw == "":
        return None
    try:
        out = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return raw
    return out


def _dt_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc).isoformat()
    return dt.isoformat()


def _candidate_for_export(session: Session, candidate_id: uuid.UUID, organization_id: uuid.UUID) -> CandidateRecord:
    stmt = (
        select(CandidateRecord)
        .where(CandidateRecord.id == candidate_id, CandidateRecord.organization_id == organization_id)
        .options(
            selectinload(CandidateRecord.created_by_recruiter).selectinload(Recruiter.user),
        )
    )
    cand = session.scalars(stmt).first()
    if cand is None:
        msg = "Candidate not found"
        raise ValueError(msg)
    return cand


def build_approved_export_payload(
    session: Session,
    *,
    candidate_id: uuid.UUID,
    organization_id: uuid.UUID,
) -> dict[str, Any]:
    """Assemble deterministic JSON-serializable document (approved fields on latest complete run only)."""
    cand = _candidate_for_export(session, candidate_id, organization_id)
    if cand.approval_status not in _ALLOWED_APPROVAL:
        msg = "Export is only available for approved candidate records"
        raise ValueError(msg)

    run = _latest_complete_run(session, candidate_id)
    if run is None:
        msg = "No completed extraction run exists for this candidate"
        raise ValueError(msg)

    approved_by_name: dict[str, ExtractedField] = {}
    for ef in run.extracted_fields or []:
        if ef.status != ExtractedFieldStatus.APPROVED:
            continue
        if ef.field_name in STAFFING_EXTRACTION_FIELD_KEYS:
            approved_by_name[ef.field_name] = ef

    structured: dict[str, Any] = {}
    for key in STAFFING_EXTRACTION_FIELD_KEYS:
        if key not in approved_by_name:
            continue
        structured[key] = _parse_field_value(approved_by_name[key].field_value)

    rec = cand.created_by_recruiter
    user = rec.user if rec else None

    candidate_block: dict[str, Any] = {
        "approval_status": cand.approval_status.value,
        "audio_upload_id": str(cand.audio_upload_id),
        "confidence_overall": float(cand.confidence_overall) if cand.confidence_overall is not None else None,
        "created_at": _dt_iso(cand.created_at),
        "extraction_status": cand.extraction_status.value,
        "id": str(cand.id),
        "internal_title": cand.internal_title,
        "notes": cand.notes,
        "organization_id": str(cand.organization_id),
        "processing_stage": cand.processing_stage.value,
        "updated_at": _dt_iso(cand.updated_at),
    }

    recruiter_block: dict[str, Any] = {
        "display_title": rec.display_title if rec else None,
        "email": user.email if user else None,
        "full_name": user.full_name if user else None,
        "recruiter_id": str(rec.id) if rec else None,
        "user_id": str(user.id) if user else None,
    }

    extraction_block: dict[str, Any] = {
        "completed_at": _dt_iso(run.completed_at),
        "id": str(run.id),
        "provider_model": run.provider_model,
        "run_index": run.run_index,
    }

    exported_at = datetime.now(timezone.utc).isoformat()

    return {
        "candidate": candidate_block,
        "extraction_run": extraction_block,
        "exported_at": exported_at,
        "export_schema_version": EXPORT_SCHEMA_VERSION,
        "recruiter": recruiter_block,
        "structured_fields": structured,
    }


def export_payload_to_json_bytes(payload: dict[str, Any]) -> bytes:
    text = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return text.encode("utf-8")


def build_approved_export_csv_from_payload(payload: dict[str, Any]) -> str:
    cand = payload["candidate"]
    rec = payload["recruiter"]
    ex = payload["extraction_run"]
    structured: dict[str, Any] = payload["structured_fields"]

    meta_headers = [
        "exported_at",
        "export_schema_version",
        "candidate_id",
        "organization_id",
        "approval_status",
        "processing_stage",
        "extraction_status",
        "created_at",
        "updated_at",
        "audio_upload_id",
        "confidence_overall",
        "internal_title",
        "candidate_notes",
        "extraction_run_id",
        "extraction_run_index",
        "extraction_completed_at",
        "provider_model",
        "recruiter_id",
        "recruiter_user_id",
        "recruiter_email",
        "recruiter_full_name",
        "recruiter_display_title",
    ]
    field_headers = list(STAFFING_EXTRACTION_FIELD_KEYS)
    headers = meta_headers + field_headers

    def cell(v: Any) -> str:
        if v is None:
            return ""
        if isinstance(v, (dict, list)):
            return json.dumps(v, ensure_ascii=False, separators=(",", ":"))
        return str(v)

    meta_row = [
        payload["exported_at"],
        str(payload["export_schema_version"]),
        cand["id"],
        cand["organization_id"],
        cand["approval_status"],
        cand["processing_stage"],
        cand["extraction_status"],
        cand["created_at"] or "",
        cand["updated_at"] or "",
        cand["audio_upload_id"],
        "" if cand["confidence_overall"] is None else str(cand["confidence_overall"]),
        cand["internal_title"] or "",
        cand["notes"] or "",
        ex["id"],
        str(ex["run_index"]),
        ex["completed_at"] or "",
        ex["provider_model"] or "",
        rec["recruiter_id"] or "",
        rec["user_id"] or "",
        rec["email"] or "",
        rec["full_name"] or "",
        rec["display_title"] or "",
    ]
    field_row = [cell(structured.get(k)) for k in field_headers]

    buf = StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
    writer.writerow(headers)
    writer.writerow(meta_row + field_row)
    return buf.getvalue()


def build_approved_export_csv(
    session: Session,
    *,
    candidate_id: uuid.UUID,
    organization_id: uuid.UUID,
) -> str:
    payload = build_approved_export_payload(session, candidate_id=candidate_id, organization_id=organization_id)
    return build_approved_export_csv_from_payload(payload)


def record_export_job(
    session: Session,
    *,
    organization_id: uuid.UUID,
    candidate_id: uuid.UUID,
    requested_by_user_id: uuid.UUID | None,
    export_format: ExportJobFormat,
    meta: dict[str, Any],
) -> ExportJob:
    if requested_by_user_id is not None and session.get(User, requested_by_user_id) is None:
        msg = "requested_by_user_id must reference an existing user"
        raise ValueError(msg)

    job = ExportJob(
        organization_id=organization_id,
        requested_by_user_id=requested_by_user_id,
        candidate_record_id=candidate_id,
        export_format=export_format,
        status=ExportJobStatus.COMPLETE,
        completed_at=datetime.now(timezone.utc),
        meta=meta,
    )
    session.add(job)
    return job
