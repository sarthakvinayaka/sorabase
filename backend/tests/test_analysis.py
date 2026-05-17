"""
Analysis service tests.

Unit tests cover build_candidate_profile.
Integration tests run against a real PostgreSQL database (same as test_persistence.py)
with the OpenAI call mocked.
"""

import uuid
from unittest.mock import patch

import pytest

from app.db.models import AnalysisRun, ExtractedField
from app.domain.analysis_schemas import (
    AnalysisLLMResponse,
    DimensionScore,
    RequirementAssessment,
)
from app.domain.extraction_schemas import (
    ExtractionLLMResponse,
    WorkAuthType,
    WorkAuthStatus,
    RemotePreference,
    EmploymentType,
)
from app.services.analysis_client import AnalysisError, AnalysisResult
from app.services.analysis_service import (
    CandidateNotFoundError,
    ExtractionNotReadyError,
    JobNotFoundError,
    build_candidate_profile,
    run_analysis,
)
from app.services.openai_client import ExtractionResult as ExtrResult


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

SAMPLE_TRANSCRIPT = (
    "Recruiter: Walk me through your background.\n"
    "Candidate: I'm Alex Chen, senior engineer at Acme, eight years in Python and Go. "
    "Looking for 160k base, remote preferred, two weeks notice, US citizen.\n"
) * 3


def _make_extraction_llm_response() -> ExtractionLLMResponse:
    text_fields = [
        "phone", "current_location", "preferred_location", "current_title",
        "domain_experience", "current_company", "education", "availability_date",
        "interview_availability", "client_fit_summary", "recruiter_recommendation",
        "concerns_or_red_flags", "work_authorization_text", "remote_preference_text",
        "years_experience_text", "compensation_text", "notice_period_text",
    ]
    list_fields = [
        "primary_skills", "secondary_skills", "previous_companies",
        "target_roles", "certifications", "industries_worked_in",
    ]
    field_data: dict = {}
    for f in text_fields:
        field_data[f] = {"value": f"val_{f}", "evidence_snippet": "q", "confidence": 0.8, "status": "extracted"}
    for f in list_fields:
        field_data[f] = {"value": ["Python", "Go"], "evidence_snippet": "q", "confidence": 0.8, "status": "extracted"}

    field_data["full_name"] = {"value": "Alex Chen", "evidence_snippet": "I'm Alex Chen", "confidence": 0.95, "status": "extracted"}
    field_data["email"] = {"value": "alex@example.com", "evidence_snippet": "alex@example.com", "confidence": 0.95, "status": "extracted"}
    field_data["work_authorization"] = {"value": WorkAuthType.US_CITIZEN, "evidence_snippet": "US citizen", "confidence": 0.95, "status": "extracted"}
    field_data["work_authorization_status"] = {"value": WorkAuthStatus.AUTHORIZED_NOW, "evidence_snippet": "US citizen", "confidence": 0.95, "status": "extracted"}
    field_data["willing_to_relocate"] = {"value": True, "evidence_snippet": "open to relocation", "confidence": 0.9, "status": "extracted"}
    field_data["remote_preference"] = {"value": RemotePreference.REMOTE, "evidence_snippet": "remote preferred", "confidence": 0.85, "status": "extracted"}
    field_data["employment_type_preference"] = {"value": EmploymentType.FULL_TIME, "evidence_snippet": "full-time", "confidence": 0.9, "status": "extracted"}
    field_data["years_experience_years"] = {"value": 8.0, "evidence_snippet": "eight years", "confidence": 0.95, "status": "extracted"}
    field_data["notice_period_days"] = {"value": 14, "evidence_snippet": "two weeks", "confidence": 0.9, "status": "extracted"}
    field_data["target_salary_min"] = {"value": 150000, "evidence_snippet": "around 160k", "confidence": 0.9, "status": "extracted"}
    field_data["target_salary_max"] = {"value": 180000, "evidence_snippet": "around 160k", "confidence": 0.9, "status": "extracted"}
    field_data["compensation_period"] = {"value": "annual", "evidence_snippet": "around 160k", "confidence": 0.9, "status": "extracted"}

    return ExtractionLLMResponse(
        **field_data,
        missing_fields=[],
        ambiguous_fields=[],
        suggested_follow_up_questions=["Availability?"],
        candidate_summary="Solid senior engineer with 8 years.",
    )


def _extraction_result() -> ExtrResult:
    return ExtrResult(
        response=_make_extraction_llm_response(),
        prompt_tokens=800,
        completion_tokens=400,
        model_used="gpt-4o-2024-08-06",
    )


def _make_analysis_llm_response() -> AnalysisLLMResponse:
    dim = DimensionScore(score=80, rationale="Candidate demonstrates strong skills.")
    req_met = RequirementAssessment(
        requirement="5+ years Python",
        met=True,
        candidate_evidence="8 years Python",
        confidence=0.95,
    )
    req_missed = RequirementAssessment(
        requirement="Kubernetes experience",
        met=False,
        candidate_evidence=None,
        confidence=0.9,
    )
    return AnalysisLLMResponse(
        overall_score=78,
        overall_tier="good_fit",
        skills_score=DimensionScore(score=82, rationale="Strong Python and Go skills."),
        experience_score=DimensionScore(score=85, rationale="8 years matches seniority."),
        domain_score=DimensionScore(score=70, rationale="Relevant domain experience."),
        logistics_score=DimensionScore(score=72, rationale="US citizen, remote, 2 wks notice."),
        hard_requirements=[req_met, req_missed],
        preferred_requirements=[],
        strengths=["Strong Python skills match JD requirements."],
        gaps=["Kubernetes not mentioned."],
        concerns=[],
        missing_info=["No Kubernetes experience mentioned."],
        rationale="Alex Chen is a strong candidate with 8 years of Python and Go experience.",
        suggested_follow_up_questions=["Do you have any Kubernetes exposure?"],
    )


def _analysis_result() -> AnalysisResult:
    return AnalysisResult(
        response=_make_analysis_llm_response(),
        prompt_tokens=1200,
        completion_tokens=600,
        model_used="gpt-4o-2024-08-06",
    )


# ---------------------------------------------------------------------------
# Unit: build_candidate_profile
# ---------------------------------------------------------------------------

class TestBuildCandidateProfile:
    def test_formats_basic_text_fields(self):
        fields = [
            ExtractedField(
                id=uuid.uuid4(),
                org_id=None,
                extraction_run_id=uuid.uuid4(),
                field_name="full_name",
                raw_value="Alex Chen",
                normalized_value="Alex Chen",
                reviewed_value=None,
                evidence_snippet=None,
                confidence=0.95,
                status="extracted",
                edited=False,
            ),
            ExtractedField(
                id=uuid.uuid4(),
                org_id=None,
                extraction_run_id=uuid.uuid4(),
                field_name="years_experience_years",
                raw_value=8.0,
                normalized_value=8.0,
                reviewed_value=None,
                evidence_snippet=None,
                confidence=0.95,
                status="extracted",
                edited=False,
            ),
        ]
        profile = build_candidate_profile(fields)
        assert "Alex Chen" in profile
        assert "8.0" in profile

    def test_uses_reviewed_value_when_edited(self):
        field = ExtractedField(
            id=uuid.uuid4(),
            org_id=None,
            extraction_run_id=uuid.uuid4(),
            field_name="full_name",
            raw_value="Alex",
            normalized_value="Alex",
            reviewed_value="Alexandra Chen",
            evidence_snippet=None,
            confidence=0.9,
            status="edited",
            edited=True,
        )
        profile = build_candidate_profile([field])
        assert "Alexandra Chen" in profile
        assert "Alex\n" not in profile

    def test_marks_missing_fields(self):
        field = ExtractedField(
            id=uuid.uuid4(),
            org_id=None,
            extraction_run_id=uuid.uuid4(),
            field_name="full_name",
            raw_value=None,
            normalized_value=None,
            reviewed_value=None,
            evidence_snippet=None,
            confidence=0.0,
            status="missing",
            edited=False,
        )
        profile = build_candidate_profile([field])
        assert "MISSING" in profile

    def test_formats_list_fields(self):
        field = ExtractedField(
            id=uuid.uuid4(),
            org_id=None,
            extraction_run_id=uuid.uuid4(),
            field_name="primary_skills",
            raw_value=["Python", "Go"],
            normalized_value=["Python", "Go"],
            reviewed_value=None,
            evidence_snippet=None,
            confidence=0.9,
            status="extracted",
            edited=False,
        )
        profile = build_candidate_profile([field])
        assert "Python, Go" in profile


# ---------------------------------------------------------------------------
# Integration: run_analysis
# ---------------------------------------------------------------------------

class TestRunAnalysis:
    @patch("app.services.analysis_service.analyze_candidate_fit")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_run_analysis_creates_completed_row(
        self, mock_extract, mock_analyze, client, db
    ):
        mock_extract.return_value = _extraction_result()
        mock_analyze.return_value = _analysis_result()

        # Create a job
        job_resp = client.post(
            "/api/jobs",
            json={"title": "Senior Python Engineer", "requirements": "5+ years Python. Kubernetes preferred."},
        )
        assert job_resp.status_code == 201
        job_id = job_resp.json()["id"]

        # Extract a candidate
        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = conv_resp.json()["id"]
        extract_resp = client.post(f"/api/conversations/{conv_id}/extract")
        assert extract_resp.status_code == 201
        candidate_id = extract_resp.json()["candidate_id"]

        # Trigger analysis
        run = run_analysis(db, uuid.UUID(candidate_id), uuid.UUID(job_id))
        assert run.status == "completed"
        assert run.overall_score == 78
        assert run.overall_tier == "good_fit"
        assert run.score_breakdown is not None
        assert "skills" in run.score_breakdown
        assert run.hard_requirements_met is not None
        assert len(run.hard_requirements_met) == 1  # only the met one
        assert run.hard_requirements_missed is not None
        assert len(run.hard_requirements_missed) == 1  # only the missed one
        assert run.strengths == ["Strong Python skills match JD requirements."]
        assert run.rationale is not None
        assert run.model_used == "gpt-4o-2024-08-06"

    @patch("app.services.analysis_service.analyze_candidate_fit")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_run_analysis_sets_failed_on_llm_error(
        self, mock_extract, mock_analyze, client, db
    ):
        mock_extract.return_value = _extraction_result()
        mock_analyze.side_effect = AnalysisError("LLM unavailable")

        job_resp = client.post("/api/jobs", json={"title": "Engineer"})
        job_id = job_resp.json()["id"]

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        extract_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        candidate_id = extract_resp.json()["candidate_id"]

        with pytest.raises(AnalysisError):
            run_analysis(db, uuid.UUID(candidate_id), uuid.UUID(job_id))

        # Row should be persisted with status=failed
        run = db.query(AnalysisRun).filter(AnalysisRun.candidate_id == uuid.UUID(candidate_id)).first()
        assert run is not None
        assert run.status == "failed"

    def test_run_analysis_raises_candidate_not_found(self, db):
        with pytest.raises(CandidateNotFoundError):
            run_analysis(db, uuid.uuid4(), uuid.uuid4())

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_run_analysis_raises_job_not_found(self, mock_extract, client, db):
        mock_extract.return_value = _extraction_result()
        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        extract_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        candidate_id = extract_resp.json()["candidate_id"]

        with pytest.raises(JobNotFoundError):
            run_analysis(db, uuid.UUID(candidate_id), uuid.uuid4())
