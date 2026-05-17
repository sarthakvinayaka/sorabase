"""
Dashboard aggregation tests.

Tests run against a real PostgreSQL database with seeded data.
No OpenAI calls — all metrics derived from persisted typed fields.
"""

import uuid
from datetime import datetime, timezone, timedelta

import pytest

from app.db.models import (
    AnalysisRun,
    Candidate,
    Conversation,
    ExtractedField,
    ExtractionRun,
)
from app.repositories import dashboard_repo


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_candidate(db, approval_status: str = "needs_review", days_ago: int = 0) -> Candidate:
    created = datetime.now(timezone.utc) - timedelta(days=days_ago)
    c = Candidate(approval_status=approval_status, created_at=created)
    db.add(c)
    db.flush()
    return c


def _make_extraction_run(
    db,
    candidate: Candidate,
    overall_confidence: float = 0.85,
) -> ExtractionRun:
    conv = Conversation(
        source_type="transcript",
        status="extracted",
        raw_text="x" * 100,
        char_count=100,
        candidate_id=candidate.id,
    )
    db.add(conv)
    db.flush()
    run = ExtractionRun(
        conversation_id=conv.id,
        candidate_id=candidate.id,
        missing_fields=[],
        ambiguous_fields=[],
        suggested_follow_up_questions=[],
        model_used="gpt-4o",
        overall_confidence=overall_confidence,
        status="completed",
    )
    db.add(run)
    db.flush()
    candidate.latest_extraction_run_id = run.id
    db.flush()
    return run


def _add_field(
    db,
    run: ExtractionRun,
    field_name: str,
    value,
    status: str = "extracted",
    confidence: float = 0.9,
) -> ExtractedField:
    f = ExtractedField(
        extraction_run_id=run.id,
        field_name=field_name,
        raw_value=value,
        normalized_value=value,
        reviewed_value=None,
        evidence_snippet=None,
        confidence=confidence,
        status=status,
        edited=False,
    )
    db.add(f)
    db.flush()
    return f


def _add_analysis(
    db,
    candidate: Candidate,
    run: ExtractionRun,
    score: int = 75,
    tier: str = "good_fit",
) -> AnalysisRun:
    a = AnalysisRun(
        extraction_run_id=run.id,
        candidate_id=candidate.id,
        job_id=None,
        status="completed",
        overall_score=score,
        overall_tier=tier,
    )
    db.add(a)
    db.flush()
    return a


# ---------------------------------------------------------------------------
# Tests: empty database
# ---------------------------------------------------------------------------

class TestDashboardEmpty:
    def test_empty_returns_zeroed_stats(self, db):
        stats = dashboard_repo.compute_stats(db)
        assert stats.candidates.total == 0
        assert stats.candidates.needs_review == 0
        assert stats.candidates.approved == 0
        assert stats.candidates.rejected == 0
        assert stats.candidates.extraction_completed == 0
        assert stats.fit_score_stats.analyzed_count == 0
        assert stats.fit_score_stats.avg_score == 0.0
        assert stats.extraction_completeness.avg_confidence == 0.0

    def test_generated_at_is_recent(self, db):
        stats = dashboard_repo.compute_stats(db)
        now = datetime.now(timezone.utc)
        diff = abs((now - stats.generated_at).total_seconds())
        assert diff < 5


# ---------------------------------------------------------------------------
# Tests: candidate counts
# ---------------------------------------------------------------------------

class TestCandidateCounts:
    def test_approval_status_counts(self, db):
        _make_candidate(db, "needs_review")
        _make_candidate(db, "needs_review")
        _make_candidate(db, "approved")
        _make_candidate(db, "rejected")

        stats = dashboard_repo.compute_stats(db)
        assert stats.candidates.total == 4
        assert stats.candidates.needs_review == 2
        assert stats.candidates.approved == 1
        assert stats.candidates.rejected == 1

    def test_extraction_completed_count(self, db):
        c1 = _make_candidate(db)
        c2 = _make_candidate(db)
        _make_candidate(db)  # no extraction run

        _make_extraction_run(db, c1)
        _make_extraction_run(db, c2)

        stats = dashboard_repo.compute_stats(db)
        assert stats.candidates.extraction_completed == 2

    def test_date_filter_from_date(self, db):
        old = _make_candidate(db, days_ago=10)
        recent = _make_candidate(db, days_ago=1)

        cutoff = datetime.now(timezone.utc) - timedelta(days=5)
        stats = dashboard_repo.compute_stats(db, from_date=cutoff)
        assert stats.candidates.total == 1

    def test_date_filter_to_date(self, db):
        old = _make_candidate(db, days_ago=10)
        recent = _make_candidate(db, days_ago=1)

        cutoff = datetime.now(timezone.utc) - timedelta(days=5)
        stats = dashboard_repo.compute_stats(db, to_date=cutoff)
        assert stats.candidates.total == 1


# ---------------------------------------------------------------------------
# Tests: experience distribution
# ---------------------------------------------------------------------------

class TestExperienceDistribution:
    def test_buckets_correctly(self, db):
        for years in [1, 4, 8, 12]:
            c = _make_candidate(db)
            run = _make_extraction_run(db, c)
            _add_field(db, run, "years_experience_years", years)

        stats = dashboard_repo.compute_stats(db)
        dist = {item.label: item.count for item in stats.experience_distribution}
        assert dist["0–2 years"] == 1
        assert dist["3–5 years"] == 1
        assert dist["6–10 years"] == 1
        assert dist["10+ years"] == 1
        assert dist["Unknown"] == 0

    def test_missing_field_goes_to_unknown(self, db):
        c = _make_candidate(db)
        run = _make_extraction_run(db, c)
        _add_field(db, run, "years_experience_years", None, status="missing")

        stats = dashboard_repo.compute_stats(db)
        dist = {item.label: item.count for item in stats.experience_distribution}
        assert dist["Unknown"] == 1

    def test_boundary_2_years_is_0_to_2(self, db):
        c = _make_candidate(db)
        run = _make_extraction_run(db, c)
        _add_field(db, run, "years_experience_years", 2)

        stats = dashboard_repo.compute_stats(db)
        dist = {item.label: item.count for item in stats.experience_distribution}
        assert dist["0–2 years"] == 1


# ---------------------------------------------------------------------------
# Tests: work auth / remote preference breakdowns
# ---------------------------------------------------------------------------

class TestEnumBreakdowns:
    def test_work_auth_status_breakdown(self, db):
        for status_val in ["authorized_now", "authorized_now", "requires_current_sponsorship"]:
            c = _make_candidate(db)
            run = _make_extraction_run(db, c)
            _add_field(db, run, "work_authorization_status", status_val)

        stats = dashboard_repo.compute_stats(db)
        breakdown = {item.label: item.count for item in stats.work_auth_status_breakdown}
        assert breakdown["authorized_now"] == 2
        assert breakdown["requires_current_sponsorship"] == 1

    def test_remote_preference_breakdown(self, db):
        for pref in ["remote", "hybrid", "remote"]:
            c = _make_candidate(db)
            run = _make_extraction_run(db, c)
            _add_field(db, run, "remote_preference", pref)

        stats = dashboard_repo.compute_stats(db)
        breakdown = {item.label: item.count for item in stats.remote_preference_breakdown}
        assert breakdown["remote"] == 2
        assert breakdown["hybrid"] == 1


# ---------------------------------------------------------------------------
# Tests: notice period distribution
# ---------------------------------------------------------------------------

class TestNoticePeriodDistribution:
    def test_notice_period_buckets(self, db):
        for days in [0, 10, 21, 45, 90]:
            c = _make_candidate(db)
            run = _make_extraction_run(db, c)
            _add_field(db, run, "notice_period_days", days)

        stats = dashboard_repo.compute_stats(db)
        dist = {item.label: item.count for item in stats.notice_period_distribution}
        assert dist["Immediate"] == 1
        assert dist["1–2 weeks"] == 1
        assert dist["2–4 weeks"] == 1
        assert dist["1–2 months"] == 1
        assert dist["2+ months"] == 1


# ---------------------------------------------------------------------------
# Tests: salary distribution
# ---------------------------------------------------------------------------

class TestSalaryDistribution:
    def test_salary_buckets(self, db):
        for sal in [60_000, 90_000, 115_000, 145_000, 175_000, 210_000]:
            c = _make_candidate(db)
            run = _make_extraction_run(db, c)
            _add_field(db, run, "target_salary_min", sal)

        stats = dashboard_repo.compute_stats(db)
        dist = {item.label: item.count for item in stats.salary_distribution}
        assert dist["<$80k"] == 1
        assert dist["$80–100k"] == 1
        assert dist["$100–130k"] == 1
        assert dist["$130–160k"] == 1
        assert dist["$160–200k"] == 1
        assert dist["$200k+"] == 1


# ---------------------------------------------------------------------------
# Tests: extraction completeness
# ---------------------------------------------------------------------------

class TestExtractionCompleteness:
    def test_avg_confidence(self, db):
        c1 = _make_candidate(db)
        _make_extraction_run(db, c1, overall_confidence=0.80)
        c2 = _make_candidate(db)
        _make_extraction_run(db, c2, overall_confidence=0.90)

        stats = dashboard_repo.compute_stats(db)
        assert abs(stats.extraction_completeness.avg_confidence - 0.85) < 0.01

    def test_missing_field_counts(self, db):
        c = _make_candidate(db)
        run = _make_extraction_run(db, c)
        _add_field(db, run, "full_name", "Alex", status="extracted")
        _add_field(db, run, "email", None, status="missing")
        _add_field(db, run, "phone", None, status="missing")

        stats = dashboard_repo.compute_stats(db)
        comp = stats.extraction_completeness
        assert comp.avg_missing_count == 2.0
        assert comp.avg_extracted_count == 1.0

    def test_top_missing_fields(self, db):
        # 3 candidates all missing certifications; 2 missing email
        for i in range(3):
            c = _make_candidate(db)
            run = _make_extraction_run(db, c)
            _add_field(db, run, "certifications", None, status="missing")

        for i in range(2):
            c = _make_candidate(db)
            run = _make_extraction_run(db, c)
            _add_field(db, run, "email", None, status="missing")

        stats = dashboard_repo.compute_stats(db)
        top = stats.extraction_completeness.top_missing_fields
        labels = [t.label for t in top]
        assert labels[0] == "certifications"
        assert labels[1] == "email"

    def test_reviewed_value_used_for_bucketing(self, db):
        c = _make_candidate(db)
        run = _make_extraction_run(db, c)
        f = ExtractedField(
            extraction_run_id=run.id,
            field_name="years_experience_years",
            raw_value=2,
            normalized_value=2,
            reviewed_value=12,  # recruiter corrected to 12 years
            evidence_snippet=None,
            confidence=0.9,
            status="edited",
            edited=True,
        )
        db.add(f)
        db.flush()

        stats = dashboard_repo.compute_stats(db)
        dist = {item.label: item.count for item in stats.experience_distribution}
        assert dist["10+ years"] == 1
        assert dist["0–2 years"] == 0


# ---------------------------------------------------------------------------
# Tests: fit score stats
# ---------------------------------------------------------------------------

class TestFitScoreStats:
    def test_tier_counts(self, db):
        for tier, score in [("strong_fit", 90), ("good_fit", 75), ("weak_fit", 35)]:
            c = _make_candidate(db)
            run = _make_extraction_run(db, c)
            _add_analysis(db, c, run, score=score, tier=tier)

        stats = dashboard_repo.compute_stats(db)
        by_tier = {item.label: item.count for item in stats.fit_score_stats.by_tier}
        assert by_tier["strong_fit"] == 1
        assert by_tier["good_fit"] == 1
        assert by_tier["weak_fit"] == 1
        assert by_tier["partial_fit"] == 0
        assert by_tier["no_fit"] == 0

    def test_avg_score(self, db):
        for score in [60, 80]:
            c = _make_candidate(db)
            run = _make_extraction_run(db, c)
            _add_analysis(db, c, run, score=score, tier="partial_fit")

        stats = dashboard_repo.compute_stats(db)
        assert stats.fit_score_stats.analyzed_count == 2
        assert abs(stats.fit_score_stats.avg_score - 70.0) < 0.1

    def test_only_latest_analysis_per_candidate_counted(self, db):
        c = _make_candidate(db)
        run = _make_extraction_run(db, c)
        _add_analysis(db, c, run, score=50, tier="partial_fit")
        _add_analysis(db, c, run, score=80, tier="good_fit")  # newer run

        stats = dashboard_repo.compute_stats(db)
        assert stats.fit_score_stats.analyzed_count == 1


# ---------------------------------------------------------------------------
# Tests: API endpoint
# ---------------------------------------------------------------------------

class TestDashboardEndpoint:
    def test_get_dashboard_returns_200(self, client):
        resp = client.get("/api/dashboard")
        assert resp.status_code == 200
        data = resp.json()
        assert "candidates" in data
        assert "experience_distribution" in data
        assert "fit_score_stats" in data
        assert "extraction_completeness" in data
        assert "generated_at" in data

    def test_get_dashboard_with_date_params(self, client):
        resp = client.get("/api/dashboard?from_date=2024-01-01T00:00:00Z")
        assert resp.status_code == 200

    def test_dashboard_candidates_shape(self, client):
        resp = client.get("/api/dashboard")
        data = resp.json()
        cands = data["candidates"]
        for key in ("total", "needs_review", "approved", "rejected", "extraction_completed"):
            assert key in cands

    def test_dashboard_fit_score_tiers_all_present(self, client):
        resp = client.get("/api/dashboard")
        data = resp.json()
        tiers = {item["label"] for item in data["fit_score_stats"]["by_tier"]}
        assert tiers == {"strong_fit", "good_fit", "partial_fit", "weak_fit", "no_fit"}
