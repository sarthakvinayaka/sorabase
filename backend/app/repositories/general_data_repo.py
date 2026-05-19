"""
Repository for the General Mode schema-first data explorer.

Two public functions:
  list_schemas       — all distinct schemas with summary stats
  get_schema_records — paginated records table for one schema
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.constants import GENERAL_MODE_TAG
from app.db.models import Candidate, Conversation, ExtractedField, ExtractionRun, SchemaTemplate
from app.domain.general_data_schemas import (
    FieldCell,
    RecordRow,
    RecordsTableResponse,
    SchemaInfo,
    SchemasListResponse,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _eff(field: ExtractedField):
    """Effective value: reviewed > normalized > raw."""
    if field.edited and field.reviewed_value is not None:
        return field.reviewed_value
    if field.normalized_value is not None:
        return field.normalized_value
    return field.raw_value


def _schema_name(db: Session, schema_id: str) -> str:
    if schema_id == GENERAL_MODE_TAG:
        return "General (Ad-hoc)"
    try:
        t = db.get(SchemaTemplate, uuid.UUID(schema_id))
        return t.name if t else schema_id
    except Exception:
        return schema_id


def _latest_per_candidate(runs: list[ExtractionRun]) -> list[ExtractionRun]:
    seen: set[uuid.UUID] = set()
    out: list[ExtractionRun] = []
    for run in runs:
        if run.candidate_id not in seen:
            seen.add(run.candidate_id)
            out.append(run)
    return out


# ---------------------------------------------------------------------------
# list_schemas
# ---------------------------------------------------------------------------

def list_schemas(db: Session, org_id: uuid.UUID) -> SchemasListResponse:
    runs = db.scalars(
        select(ExtractionRun)
        .where(ExtractionRun.org_id == org_id)
        .where(ExtractionRun.status == "completed")
        .order_by(ExtractionRun.created_at.desc())
    ).all()

    # Group by template_id → latest run per candidate
    by_template: dict[str, dict[uuid.UUID, ExtractionRun]] = defaultdict(dict)
    for run in runs:
        tid = run.template_id or GENERAL_MODE_TAG
        if run.candidate_id not in by_template[tid]:
            by_template[tid][run.candidate_id] = run

    if not by_template:
        return SchemasListResponse(schemas=[], generated_at=datetime.now(timezone.utc))

    # Bulk-load template names
    named_ids = [
        tid for tid in by_template
        if tid != GENERAL_MODE_TAG and len(tid) == 36
    ]
    template_map: dict[str, str] = {}
    if named_ids:
        try:
            uuids = [uuid.UUID(tid) for tid in named_ids]
            for t in db.scalars(select(SchemaTemplate).where(SchemaTemplate.id.in_(uuids))).all():
                template_map[str(t.id)] = t.name
        except Exception:
            pass

    schemas: list[SchemaInfo] = []

    for tid, cand_map in by_template.items():
        latest_runs = list(cand_map.values())
        run_ids = [r.id for r in latest_runs]

        all_fields = (
            db.scalars(
                select(ExtractedField).where(ExtractedField.extraction_run_id.in_(run_ids))
            ).all()
            if run_ids else []
        )

        field_names = sorted({f.field_name for f in all_fields})

        conf_scores = [r.overall_confidence for r in latest_runs if r.overall_confidence is not None]
        avg_conf = round(sum(conf_scores) / len(conf_scores), 3) if conf_scores else 0.0

        run_field_map: dict[uuid.UUID, list[ExtractedField]] = defaultdict(list)
        for f in all_fields:
            run_field_map[f.extraction_run_id].append(f)

        fill_rates = []
        for run in latest_runs:
            fields = run_field_map.get(run.id, [])
            if fields:
                extracted = sum(1 for f in fields if f.status != "missing")
                fill_rates.append(extracted / len(fields))
        avg_fill = round(sum(fill_rates) / len(fill_rates), 3) if fill_rates else 0.0

        last_updated = max(
            (r.created_at for r in latest_runs),
            default=datetime.now(timezone.utc),
        )

        name = template_map.get(tid, "General (Ad-hoc)") if tid != GENERAL_MODE_TAG else "General (Ad-hoc)"

        schemas.append(
            SchemaInfo(
                schema_id=tid,
                name=name,
                record_count=len(latest_runs),
                avg_confidence=avg_conf,
                avg_fill_rate=avg_fill,
                last_updated=last_updated,
                field_names=field_names,
            )
        )

    schemas.sort(key=lambda s: s.last_updated, reverse=True)
    return SchemasListResponse(schemas=schemas, generated_at=datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# get_schema_records
# ---------------------------------------------------------------------------

def get_schema_records(
    db: Session,
    org_id: uuid.UUID,
    schema_id: str,
    page: int = 1,
    limit: int = 100,
) -> RecordsTableResponse:
    runs = db.scalars(
        select(ExtractionRun)
        .where(ExtractionRun.org_id == org_id)
        .where(ExtractionRun.template_id == schema_id)
        .where(ExtractionRun.status == "completed")
        .order_by(ExtractionRun.created_at.desc())
    ).all()

    latest_runs = _latest_per_candidate(list(runs))
    total = len(latest_runs)

    # Canonical field names from the full schema (not just this page)
    all_run_ids = [r.id for r in latest_runs]
    all_field_names: list[str] = (
        sorted({
            row
            for row in db.scalars(
                select(ExtractedField.field_name)
                .where(ExtractedField.extraction_run_id.in_(all_run_ids))
                .distinct()
            ).all()
        })
        if all_run_ids else []
    )

    # Paginate
    offset = (page - 1) * limit
    page_runs = latest_runs[offset : offset + limit]
    name = _schema_name(db, schema_id)

    if not page_runs:
        return RecordsTableResponse(
            schema_id=schema_id,
            name=name,
            field_names=all_field_names,
            records=[],
            total=total,
            page=page,
            limit=limit,
        )

    page_run_ids = [r.id for r in page_runs]

    # Fields for this page
    page_fields = db.scalars(
        select(ExtractedField).where(ExtractedField.extraction_run_id.in_(page_run_ids))
    ).all()

    run_field_map: dict[uuid.UUID, dict[str, ExtractedField]] = defaultdict(dict)
    for f in page_fields:
        run_field_map[f.extraction_run_id][f.field_name] = f

    # Candidate approval statuses
    cand_ids = [r.candidate_id for r in page_runs]
    candidates = {
        c.id: c
        for c in db.scalars(select(Candidate).where(Candidate.id.in_(cand_ids))).all()
    }

    # Conversation source types
    conv_ids = [r.conversation_id for r in page_runs]
    convs = {
        c.id: c
        for c in db.scalars(select(Conversation).where(Conversation.id.in_(conv_ids))).all()
    }

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
        schema_id=schema_id,
        name=name,
        field_names=all_field_names,
        records=rows,
        total=total,
        page=page,
        limit=limit,
    )
