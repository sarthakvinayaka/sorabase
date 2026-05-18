"""
Dashboard aggregation repository.

All metrics are computed at read time from persisted typed fields.
Effective value precedence: reviewed_value (if edited) → normalized_value → raw_value.
"""

import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.models import AnalysisRun, Candidate, ExtractedField, ExtractionRun
from app.domain.api_schemas import (
    CountItem,
    DashboardCandidates,
    DashboardStats,
    ExtractionCompleteness,
    FitScoreStats,
)


_BUCKET_FIELDS = [
    "years_experience_years",
    "work_authorization_status",
    "work_authorization",
    "remote_preference",
    "notice_period_days",
    "target_salary_min",
]

_TIERS = ["strong_fit", "good_fit", "partial_fit", "weak_fit", "no_fit"]


def _eff(field: ExtractedField):
    """Return the effective display value for a field."""
    if field.edited and field.reviewed_value is not None:
        return field.reviewed_value
    if field.normalized_value is not None:
        return field.normalized_value
    return field.raw_value


def compute_stats(
    db: Session,
    org_id: "uuid.UUID",
    from_date: datetime | None = None,
    to_date: datetime | None = None,
) -> DashboardStats:
    # ------------------------------------------------------------------ #
    # 1. Candidate counts                                                  #
    # ------------------------------------------------------------------ #
    cand_q = select(Candidate).where(Candidate.org_id == org_id)
    if from_date:
        cand_q = cand_q.where(Candidate.created_at >= from_date)
    if to_date:
        cand_q = cand_q.where(Candidate.created_at <= to_date)
    candidates = db.scalars(cand_q).all()

    total = len(candidates)
    needs_review = sum(1 for c in candidates if c.approval_status == "needs_review")
    approved = sum(1 for c in candidates if c.approval_status == "approved")
    rejected = sum(1 for c in candidates if c.approval_status == "rejected")

    candidate_ids = [c.id for c in candidates]

    # ------------------------------------------------------------------ #
    # 2. Latest completed extraction run per candidate                     #
    # ------------------------------------------------------------------ #
    extraction_run_map: dict = {}  # candidate_id -> ExtractionRun
    latest_run_ids: list = []

    if candidate_ids:
        runs = db.scalars(
            select(ExtractionRun)
            .where(ExtractionRun.candidate_id.in_(candidate_ids))
            .where(ExtractionRun.status == "completed")
            .order_by(ExtractionRun.created_at.desc())
        ).all()
        seen: set = set()
        for run in runs:
            if run.candidate_id not in seen:
                seen.add(run.candidate_id)
                extraction_run_map[run.candidate_id] = run
                latest_run_ids.append(run.id)

    extraction_completed = len(latest_run_ids)

    confidences = [
        r.overall_confidence
        for r in extraction_run_map.values()
        if r.overall_confidence is not None
    ]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    # ------------------------------------------------------------------ #
    # 3. Extracted fields for bucketing + completeness                    #
    # ------------------------------------------------------------------ #
    fields_by_name: dict[str, list[ExtractedField]] = defaultdict(list)
    missing_counter: Counter = Counter()
    extracted_counts: list[int] = []
    missing_counts: list[int] = []

    if latest_run_ids:
        # Bucket fields (only the names we need)
        bucket_fields = db.scalars(
            select(ExtractedField)
            .where(ExtractedField.extraction_run_id.in_(latest_run_ids))
            .where(ExtractedField.field_name.in_(_BUCKET_FIELDS))
        ).all()
        for f in bucket_fields:
            fields_by_name[f.field_name].append(f)

        # All fields for completeness stats
        all_fields = db.scalars(
            select(ExtractedField)
            .where(ExtractedField.extraction_run_id.in_(latest_run_ids))
        ).all()

        run_field_map: dict = defaultdict(list)
        for f in all_fields:
            run_field_map[f.extraction_run_id].append(f)

        for run_id, fields in run_field_map.items():
            n_missing = sum(1 for f in fields if f.status == "missing")
            n_extracted = len(fields) - n_missing
            extracted_counts.append(n_extracted)
            missing_counts.append(n_missing)
            for f in fields:
                if f.status == "missing":
                    missing_counter[f.field_name] += 1

    avg_extracted = sum(extracted_counts) / len(extracted_counts) if extracted_counts else 0.0
    avg_missing = sum(missing_counts) / len(missing_counts) if missing_counts else 0.0
    top_missing = [
        CountItem(label=name, count=cnt)
        for name, cnt in missing_counter.most_common(10)
    ]

    # ------------------------------------------------------------------ #
    # 4. Distributions                                                     #
    # ------------------------------------------------------------------ #
    experience_distribution = _bucket_experience(fields_by_name["years_experience_years"])
    work_auth_status_breakdown = _count_enum(fields_by_name["work_authorization_status"])
    work_auth_type_breakdown = _count_enum(fields_by_name["work_authorization"])
    remote_preference_breakdown = _count_enum(fields_by_name["remote_preference"])
    notice_period_distribution = _bucket_notice_period(fields_by_name["notice_period_days"])
    salary_distribution = _bucket_salary(fields_by_name["target_salary_min"])

    # ------------------------------------------------------------------ #
    # 5. Fit score stats (latest analysis per candidate)                   #
    # ------------------------------------------------------------------ #
    analyzed_count = 0
    avg_score = 0.0
    tier_counter: Counter = Counter()

    if candidate_ids:
        analyses = db.scalars(
            select(AnalysisRun)
            .where(AnalysisRun.candidate_id.in_(candidate_ids))
            .where(AnalysisRun.status == "completed")
            .order_by(AnalysisRun.created_at.desc())
        ).all()
        seen_cands: set = set()
        latest_analyses = []
        for a in analyses:
            if a.candidate_id not in seen_cands:
                seen_cands.add(a.candidate_id)
                latest_analyses.append(a)

        analyzed_count = len(latest_analyses)
        scores = [a.overall_score for a in latest_analyses if a.overall_score is not None]
        avg_score = sum(scores) / len(scores) if scores else 0.0
        for a in latest_analyses:
            if a.overall_tier:
                tier_counter[a.overall_tier] += 1

    by_tier = [CountItem(label=t, count=tier_counter.get(t, 0)) for t in _TIERS]

    return DashboardStats(
        generated_at=datetime.now(timezone.utc),
        candidates=DashboardCandidates(
            total=total,
            needs_review=needs_review,
            approved=approved,
            rejected=rejected,
            extraction_completed=extraction_completed,
        ),
        experience_distribution=experience_distribution,
        work_auth_status_breakdown=work_auth_status_breakdown,
        work_auth_type_breakdown=work_auth_type_breakdown,
        remote_preference_breakdown=remote_preference_breakdown,
        notice_period_distribution=notice_period_distribution,
        salary_distribution=salary_distribution,
        extraction_completeness=ExtractionCompleteness(
            avg_confidence=round(avg_confidence, 3),
            avg_extracted_count=round(avg_extracted, 1),
            avg_missing_count=round(avg_missing, 1),
            top_missing_fields=top_missing,
        ),
        fit_score_stats=FitScoreStats(
            analyzed_count=analyzed_count,
            avg_score=round(avg_score, 1),
            by_tier=by_tier,
        ),
    )


# ------------------------------------------------------------------ #
# Bucketing helpers                                                    #
# ------------------------------------------------------------------ #

def _bucket_experience(fields: list[ExtractedField]) -> list[CountItem]:
    buckets: dict[str, int] = {
        "0–2 years": 0,
        "3–5 years": 0,
        "6–10 years": 0,
        "10+ years": 0,
        "Unknown": 0,
    }
    for f in fields:
        val = _eff(f)
        if val is None or f.status == "missing":
            buckets["Unknown"] += 1
        elif isinstance(val, (int, float)):
            yrs = float(val)
            if yrs <= 2:
                buckets["0–2 years"] += 1
            elif yrs <= 5:
                buckets["3–5 years"] += 1
            elif yrs <= 10:
                buckets["6–10 years"] += 1
            else:
                buckets["10+ years"] += 1
        else:
            buckets["Unknown"] += 1
    return [CountItem(label=k, count=v) for k, v in buckets.items()]


def _count_enum(fields: list[ExtractedField]) -> list[CountItem]:
    counter: Counter = Counter()
    for f in fields:
        val = _eff(f)
        if val is None or f.status == "missing":
            counter["unknown"] += 1
        else:
            counter[str(val)] += 1
    return [CountItem(label=k, count=v) for k, v in sorted(counter.items(), key=lambda x: -x[1])]


def _bucket_notice_period(fields: list[ExtractedField]) -> list[CountItem]:
    buckets: dict[str, int] = {
        "Immediate": 0,
        "1–2 weeks": 0,
        "2–4 weeks": 0,
        "1–2 months": 0,
        "2+ months": 0,
        "Unknown": 0,
    }
    for f in fields:
        val = _eff(f)
        if val is None or f.status == "missing":
            buckets["Unknown"] += 1
        elif isinstance(val, (int, float)):
            days = float(val)
            if days == 0:
                buckets["Immediate"] += 1
            elif days <= 14:
                buckets["1–2 weeks"] += 1
            elif days <= 30:
                buckets["2–4 weeks"] += 1
            elif days <= 60:
                buckets["1–2 months"] += 1
            else:
                buckets["2+ months"] += 1
        else:
            buckets["Unknown"] += 1
    return [CountItem(label=k, count=v) for k, v in buckets.items()]


def _bucket_salary(fields: list[ExtractedField]) -> list[CountItem]:
    buckets: dict[str, int] = {
        "<$80k": 0,
        "$80–100k": 0,
        "$100–130k": 0,
        "$130–160k": 0,
        "$160–200k": 0,
        "$200k+": 0,
        "Unknown": 0,
    }
    for f in fields:
        val = _eff(f)
        if val is None or f.status == "missing":
            buckets["Unknown"] += 1
        elif isinstance(val, (int, float)):
            sal = float(val)
            if sal < 80_000:
                buckets["<$80k"] += 1
            elif sal < 100_000:
                buckets["$80–100k"] += 1
            elif sal < 130_000:
                buckets["$100–130k"] += 1
            elif sal < 160_000:
                buckets["$130–160k"] += 1
            elif sal < 200_000:
                buckets["$160–200k"] += 1
            else:
                buckets["$200k+"] += 1
        else:
            buckets["Unknown"] += 1
    return [CountItem(label=k, count=v) for k, v in buckets.items()]
