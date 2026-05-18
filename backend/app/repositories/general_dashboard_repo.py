"""
General Mode dashboard aggregation.

Scans all ExtractionRun rows with template_id="general", takes the latest
completed run per candidate, then aggregates field-level statistics.
"""

import re
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.constants import GENERAL_MODE_TAG
from app.db.models import Candidate, ExtractedField, ExtractionRun
from app.domain.api_schemas import CountItem
from app.domain.general_dashboard_schemas import (
    GeneralDashboardStats,
    GeneralFieldStats,
    GeneralSessionStats,
)

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def compute_general_stats(db: Session, org_id: uuid.UUID) -> GeneralDashboardStats:
    # ------------------------------------------------------------------ #
    # 1. Latest completed general extraction run per candidate             #
    # ------------------------------------------------------------------ #
    runs = db.scalars(
        select(ExtractionRun)
        .where(ExtractionRun.template_id == GENERAL_MODE_TAG)
        .where(ExtractionRun.status == "completed")
        .where(ExtractionRun.org_id == org_id)
        .order_by(ExtractionRun.created_at.desc())
    ).all()

    seen: set = set()
    latest_runs: list[ExtractionRun] = []
    for run in runs:
        if run.candidate_id not in seen:
            seen.add(run.candidate_id)
            latest_runs.append(run)

    run_ids   = [r.id for r in latest_runs]
    cand_ids  = [r.candidate_id for r in latest_runs]

    # ------------------------------------------------------------------ #
    # 2. Session-level stats                                               #
    # ------------------------------------------------------------------ #
    candidates = (
        db.scalars(select(Candidate).where(Candidate.id.in_(cand_ids))).all()
        if cand_ids else []
    )

    total       = len(candidates)
    needs_review = sum(1 for c in candidates if c.approval_status == "needs_review")
    approved    = sum(1 for c in candidates if c.approval_status == "approved")
    rejected    = sum(1 for c in candidates if c.approval_status == "rejected")

    conf_scores = [r.overall_confidence for r in latest_runs if r.overall_confidence is not None]
    session_avg_conf = round(sum(conf_scores) / len(conf_scores), 3) if conf_scores else 0.0

    # ------------------------------------------------------------------ #
    # 3. Confidence distribution (buckets)                                 #
    # ------------------------------------------------------------------ #
    conf_buckets: dict[str, int] = {"<50%": 0, "50–70%": 0, "70–90%": 0, "90%+": 0}
    for c in conf_scores:
        pct = c * 100
        if pct < 50:
            conf_buckets["<50%"] += 1
        elif pct < 70:
            conf_buckets["50–70%"] += 1
        elif pct < 90:
            conf_buckets["70–90%"] += 1
        else:
            conf_buckets["90%+"] += 1
    confidence_distribution = [
        CountItem(label=k, count=v)
        for k, v in conf_buckets.items()
        if v > 0
    ]

    # ------------------------------------------------------------------ #
    # 4. Load all extracted fields for the latest runs                     #
    # ------------------------------------------------------------------ #
    fields_by_name: dict[str, list[ExtractedField]] = defaultdict(list)
    if run_ids:
        all_fields = db.scalars(
            select(ExtractedField).where(ExtractedField.extraction_run_id.in_(run_ids))
        ).all()
        for f in all_fields:
            fields_by_name[f.field_name].append(f)

    # ------------------------------------------------------------------ #
    # 5. Per-field aggregation                                             #
    # ------------------------------------------------------------------ #
    missing_counter: Counter = Counter()
    field_stats_list: list[GeneralFieldStats] = []

    for field_name, fields in sorted(fields_by_name.items()):
        n_total     = len(fields)
        n_extracted = sum(1 for f in fields if f.status != "missing")
        n_missing   = n_total - n_extracted
        fill_rate   = round(n_extracted / n_total, 3) if n_total > 0 else 0.0

        if n_missing > 0:
            missing_counter[field_name] += n_missing

        f_confs = [f.confidence for f in fields if f.status != "missing"]
        avg_conf = round(sum(f_confs) / len(f_confs), 3) if f_confs else 0.0

        eff_values = [_eff(f) for f in fields if f.status != "missing"]
        inferred   = _infer_type(eff_values)

        value_counts: list[CountItem] = []
        numeric_avg: float | None = None
        numeric_min: float | None = None
        numeric_max: float | None = None

        if inferred == "boolean":
            ctr: Counter = Counter()
            for v in eff_values:
                ctr["Yes" if v is True else ("No" if v is False else "Unknown")] += 1
            value_counts = [CountItem(label=k, count=c) for k, c in ctr.most_common()]

        elif inferred == "number":
            nums = [float(v) for v in eff_values if isinstance(v, (int, float)) and not isinstance(v, bool)]
            if nums:
                numeric_avg = round(sum(nums) / len(nums), 2)
                numeric_min = min(nums)
                numeric_max = max(nums)

        elif inferred == "list":
            tag_ctr: Counter = Counter()
            for v in eff_values:
                if isinstance(v, list):
                    for item in v:
                        tag_ctr[str(item)] += 1
            value_counts = [CountItem(label=k, count=c) for k, c in tag_ctr.most_common(12)]

        elif inferred == "date":
            month_ctr: Counter = Counter()
            for v in eff_values:
                if isinstance(v, str) and len(v) >= 7:
                    month_ctr[v[:7]] += 1
            value_counts = [CountItem(label=k, count=c) for k, c in sorted(month_ctr.items())]

        elif inferred == "text":
            text_ctr: Counter = Counter()
            for v in eff_values:
                if v is not None:
                    text_ctr[str(v)] += 1
            # Only emit a distribution for enum-like fields (≤10 distinct values)
            if len(text_ctr) <= 10:
                value_counts = [CountItem(label=k, count=c) for k, c in text_ctr.most_common(10)]

        field_stats_list.append(
            GeneralFieldStats(
                field_name=field_name,
                inferred_type=inferred,
                total_sessions=n_total,
                extracted_count=n_extracted,
                fill_rate=fill_rate,
                avg_confidence=avg_conf,
                value_counts=value_counts,
                numeric_avg=numeric_avg,
                numeric_min=numeric_min,
                numeric_max=numeric_max,
            )
        )

    top_missing = [CountItem(label=k, count=v) for k, v in missing_counter.most_common(10)]

    fill_rates = [s.fill_rate for s in field_stats_list]
    avg_fill_rate = round(sum(fill_rates) / len(fill_rates), 3) if fill_rates else 0.0

    return GeneralDashboardStats(
        generated_at=datetime.now(timezone.utc),
        sessions=GeneralSessionStats(
            total=total,
            needs_review=needs_review,
            approved=approved,
            rejected=rejected,
            avg_confidence=session_avg_conf,
        ),
        avg_fill_rate=avg_fill_rate,
        top_missing_fields=top_missing,
        confidence_distribution=confidence_distribution,
        fields=field_stats_list,
    )


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _eff(field: ExtractedField):
    if field.edited and field.reviewed_value is not None:
        return field.reviewed_value
    if field.normalized_value is not None:
        return field.normalized_value
    return field.raw_value


def _infer_type(values: list) -> str:
    non_null = [v for v in values if v is not None]
    if not non_null:
        return "text"
    sample = non_null[0]
    if isinstance(sample, bool):
        return "boolean"
    if isinstance(sample, (int, float)):
        return "number"
    if isinstance(sample, list):
        return "list"
    if isinstance(sample, str) and _DATE_RE.match(sample):
        return "date"
    return "text"
