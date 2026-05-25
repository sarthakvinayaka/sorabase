"""
Repository for the Recruiting Mode fixed-schema data table.

Returns candidate rows with extracted fields pre-flattened per EXTRACTION_FIELD_NAMES,
so the frontend can render an ATS-style table without N+1 requests.

Recruiting runs are identified by ExtractionRun.template_id IS NULL
(general-mode runs use template_id = GENERAL_MODE_TAG = "general").
"""

from __future__ import annotations

import uuid
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Candidate, Conversation, ExtractedField, ExtractionRun
from app.domain.extraction_schemas import EXTRACTION_FIELD_NAMES
from app.domain.general_data_schemas import FieldCell, RecordRow, RecordsTableResponse

SCHEMA_ID = "recruiting"
SCHEMA_NAME = "Recruiting"


def _eff(field: ExtractedField):
    """Effective value: reviewed > normalized > raw."""
    if field.edited and field.reviewed_value is not None:
        return field.reviewed_value
    if field.normalized_value is not None:
        return field.normalized_value
    return field.raw_value


def get_recruiting_records(
    db: Session,
    org_id: uuid.UUID,
    page: int = 1,
    limit: int = 50,
    search: str | None = None,
    approval_status: str | None = None,
) -> RecordsTableResponse:
    # ── 1. All completed recruiting runs (template_id IS NULL) ────────────────
    runs = db.scalars(
        select(ExtractionRun)
        .where(ExtractionRun.org_id == org_id)
        .where(ExtractionRun.template_id.is_(None))
        .where(ExtractionRun.status == "completed")
        .order_by(ExtractionRun.created_at.desc())
    ).all()

    # ── 2. Latest run per candidate ───────────────────────────────────────────
    seen: set[uuid.UUID] = set()
    latest_runs: list[ExtractionRun] = []
    for run in runs:
        if run.candidate_id not in seen:
            seen.add(run.candidate_id)
            latest_runs.append(run)

    if not latest_runs:
        return RecordsTableResponse(
            schema_id=SCHEMA_ID,
            name=SCHEMA_NAME,
            field_names=EXTRACTION_FIELD_NAMES,
            records=[],
            total=0,
            page=page,
            limit=limit,
        )

    all_run_ids = [r.id for r in latest_runs]
    cand_ids = [r.candidate_id for r in latest_runs]

    # ── 3. Candidate approval status lookup ───────────────────────────────────
    candidates: dict[uuid.UUID, Candidate] = {
        c.id: c
        for c in db.scalars(select(Candidate).where(Candidate.id.in_(cand_ids))).all()
    }

    # ── 4. approval_status filter ─────────────────────────────────────────────
    if approval_status:
        latest_runs = [
            r for r in latest_runs
            if (c := candidates.get(r.candidate_id)) and c.approval_status == approval_status
        ]
        if not latest_runs:
            return RecordsTableResponse(
                schema_id=SCHEMA_ID,
                name=SCHEMA_NAME,
                field_names=EXTRACTION_FIELD_NAMES,
                records=[],
                total=0,
                page=page,
                limit=limit,
            )
        all_run_ids = [r.id for r in latest_runs]

    # ── 5. Search: filter by full_name field ──────────────────────────────────
    if search:
        name_fields = db.scalars(
            select(ExtractedField)
            .where(ExtractedField.extraction_run_id.in_(all_run_ids))
            .where(ExtractedField.field_name == "full_name")
        ).all()
        name_map: dict[uuid.UUID, str] = {}
        for f in name_fields:
            val = _eff(f)
            if isinstance(val, str):
                name_map[f.extraction_run_id] = val

        q = search.lower()
        latest_runs = [
            r for r in latest_runs
            if q in (name_map.get(r.id) or "").lower()
        ]
        if not latest_runs:
            return RecordsTableResponse(
                schema_id=SCHEMA_ID,
                name=SCHEMA_NAME,
                field_names=EXTRACTION_FIELD_NAMES,
                records=[],
                total=0,
                page=page,
                limit=limit,
            )
        all_run_ids = [r.id for r in latest_runs]

    total = len(latest_runs)

    # ── 6. Paginate ───────────────────────────────────────────────────────────
    offset = (page - 1) * limit
    page_runs = latest_runs[offset : offset + limit]

    if not page_runs:
        return RecordsTableResponse(
            schema_id=SCHEMA_ID,
            name=SCHEMA_NAME,
            field_names=EXTRACTION_FIELD_NAMES,
            records=[],
            total=total,
            page=page,
            limit=limit,
        )

    page_run_ids = [r.id for r in page_runs]

    # ── 7. Load extracted fields for this page ────────────────────────────────
    page_fields = db.scalars(
        select(ExtractedField).where(ExtractedField.extraction_run_id.in_(page_run_ids))
    ).all()

    run_field_map: dict[uuid.UUID, dict[str, ExtractedField]] = defaultdict(dict)
    for f in page_fields:
        run_field_map[f.extraction_run_id][f.field_name] = f

    # ── 8. Conversation lookup ────────────────────────────────────────────────
    conv_ids = [r.conversation_id for r in page_runs]
    convs: dict[uuid.UUID, Conversation] = {
        c.id: c
        for c in db.scalars(select(Conversation).where(Conversation.id.in_(conv_ids))).all()
    }

    # ── 9. Build rows ─────────────────────────────────────────────────────────
    rows: list[RecordRow] = []
    for run in page_runs:
        fields_map = run_field_map.get(run.id, {})
        n = len(fields_map)
        extracted = sum(1 for f in fields_map.values() if f.status != "missing")
        fill_rate = round(extracted / n, 3) if n > 0 else 0.0

        cand = candidates.get(run.candidate_id)
        conv = convs.get(run.conversation_id)

        cells = {
            fname: FieldCell(
                value=_eff(field),
                confidence=field.confidence,
                status=field.status,
                evidence_snippet=field.evidence_snippet,
                edited=field.edited,
            )
            for fname, field in fields_map.items()
        }

        rows.append(
            RecordRow(
                record_id=str(run.candidate_id),
                run_id=str(run.id),
                created_at=run.created_at,
                approval_status=cand.approval_status if cand else "needs_review",
                confidence=run.overall_confidence or 0.0,
                fill_rate=fill_rate,
                missing_fields=run.missing_fields or [],
                summary=run.candidate_summary,
                source_type=conv.source_type if conv else None,
                fields=cells,
            )
        )

    return RecordsTableResponse(
        schema_id=SCHEMA_ID,
        name=SCHEMA_NAME,
        field_names=EXTRACTION_FIELD_NAMES,
        records=rows,
        total=total,
        page=page,
        limit=limit,
    )
