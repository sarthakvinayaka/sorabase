"""
Builds the GeneralExport payload and renders it as CSV.
"""

from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.constants import GENERAL_MODE_TAG
from app.db.models import ExtractionRun
from app.domain.general_export_schemas import GeneralExport, GeneralExportField
from app.repositories import candidate_repo


def build_general_export(
    db: Session,
    candidate_id: uuid.UUID,
    include_transcript: bool = False,
) -> GeneralExport | None:
    detail = candidate_repo.get_detail(db, candidate_id)
    if detail is None:
        return None

    # Fetch the raw ExtractionRun to access raw_response (not present in
    # ExtractionRunRead, which is a slim API projection).
    extraction_run: ExtractionRun | None = db.get(ExtractionRun, detail.extraction.id)
    raw_resp: dict = (extraction_run.raw_response or {}) if extraction_run else {}

    # Preserve original column order if stored in raw_response
    field_order: list[str] = list((raw_resp.get("fields") or {}).keys()) or [
        f.field_name for f in detail.fields
    ]

    export_fields: dict[str, GeneralExportField] = {}
    field_lookup = {f.field_name: f for f in detail.fields}
    for name in field_order:
        f = field_lookup.get(name)
        if f is None:
            continue
        if f.edited and f.reviewed_value is not None:
            effective = f.reviewed_value
        elif f.normalized_value is not None:
            effective = f.normalized_value
        else:
            effective = f.raw_value

        export_fields[name] = GeneralExportField(
            value=effective,
            source="human_edited" if f.edited else "ai_extracted",
            confidence=f.confidence,
            evidence_snippet=f.evidence_snippet,
            status=f.status,
        )

    transcript: str | None = None
    if include_transcript and detail.conversation:
        transcript = detail.conversation.raw_text

    template_id      = None
    template_version = None
    if raw_resp.get("template_id") not in (None, GENERAL_MODE_TAG):
        template_id = raw_resp.get("template_id")
    template_version = raw_resp.get("template_version")

    return GeneralExport(
        exported_at=datetime.now(timezone.utc),
        candidate_id=detail.candidate.id,
        conversation_id=detail.conversation.id,
        summary=detail.extraction.candidate_summary,
        missing_fields=detail.extraction.missing_fields or [],
        ambiguous_fields=detail.extraction.ambiguous_fields or [],
        template_id=template_id,
        template_version=template_version,
        fields=export_fields,
        transcript=transcript,
    )


def render_csv(export: GeneralExport) -> str:
    """Return a UTF-8 CSV string for a single extraction session."""
    buf = io.StringIO()

    field_names = list(export.fields.keys())
    base_headers = ["candidate_id", "exported_at", "summary", "missing_fields"]
    all_headers  = base_headers + field_names
    if export.transcript is not None:
        all_headers.append("transcript")

    writer = csv.DictWriter(buf, fieldnames=all_headers, extrasaction="ignore")
    writer.writeheader()

    row: dict[str, object] = {
        "candidate_id": str(export.candidate_id),
        "exported_at":  export.exported_at.isoformat(),
        "summary":      export.summary or "",
        "missing_fields": "; ".join(export.missing_fields),
    }
    for name, fld in export.fields.items():
        val = fld.value
        if isinstance(val, list):
            val = "; ".join(str(v) for v in val)
        elif isinstance(val, bool):
            val = "Yes" if val else "No"
        elif val is None:
            val = ""
        row[name] = val

    if export.transcript is not None:
        row["transcript"] = export.transcript

    writer.writerow(row)
    return buf.getvalue()
