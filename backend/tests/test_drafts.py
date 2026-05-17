"""
Draft service tests.

Unit tests cover build_analysis_context formatting.
Integration tests verify:
  - generate_summary_draft creates a persisted CandidateDraft
  - generate_submittal_draft creates a persisted CandidateDraft linked to analysis_run
  - edit_draft updates content in place and sets edited=True
  - export includes summary_draft and submittal_draft text
  - DraftNotFoundError raised for wrong candidate_id
"""

import uuid
from unittest.mock import patch

import pytest

from app.db.models import AnalysisRun, CandidateDraft
from app.domain.analysis_schemas import (
    AnalysisLLMResponse,
    DimensionScore,
    RequirementAssessment,
)
from app.domain.extraction_schemas import (
    EmploymentType,
    ExtractionLLMResponse,
    RemotePreference,
    WorkAuthStatus,
    WorkAuthType,
)
from app.repositories import draft_repo
from app.services import draft_service
from app.services.analysis_client import AnalysisResult
from app.services.draft_service import (
    AnalysisRunNotReadyError,
    CandidateNotReadyError,
    DraftNotFoundError,
    _build_analysis_context,
    _format_tier,
)
from app.services.openai_client import ExtractionResult


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

SAMPLE_TRANSCRIPT = (
    "Recruiter: Walk me through your background.\n"
    "Candidate: I'm Alex Chen, senior engineer at Acme, eight years in Python and Go. "
    "Looking for 160k base, remote preferred, two-week notice, US citizen.\n"
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
    field_data["email"] = {"value": "alex@example.com", "evidence_snippet": "...", "confidence": 0.95, "status": "extracted"}
    field_data["work_authorization"] = {"value": WorkAuthType.US_CITIZEN, "evidence_snippet": "US citizen", "confidence": 0.95, "status": "extracted"}
    field_data["work_authorization_status"] = {"value": WorkAuthStatus.AUTHORIZED_NOW, "evidence_snippet": "US citizen", "confidence": 0.95, "status": "extracted"}
    field_data["willing_to_relocate"] = {"value": True, "evidence_snippet": "open", "confidence": 0.9, "status": "extracted"}
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


def _extraction_result() -> ExtractionResult:
    return ExtractionResult(
        response=_make_extraction_llm_response(),
        prompt_tokens=800,
        completion_tokens=400,
        model_used="gpt-4o-2024-08-06",
    )


def _make_analysis_llm_response() -> AnalysisLLMResponse:
    return AnalysisLLMResponse(
        overall_score=78,
        overall_tier="good_fit",
        skills_score=DimensionScore(score=82, rationale="Strong Python/Go."),
        experience_score=DimensionScore(score=85, rationale="8 years."),
        domain_score=DimensionScore(score=70, rationale="Relevant domain."),
        logistics_score=DimensionScore(score=72, rationale="US citizen, remote."),
        hard_requirements=[
            RequirementAssessment(requirement="5+ years Python", met=True, candidate_evidence="8 years", confidence=0.95),
            RequirementAssessment(requirement="Kubernetes", met=False, candidate_evidence=None, confidence=0.9),
        ],
        preferred_requirements=[],
        strengths=["Strong Python match."],
        gaps=["Kubernetes not mentioned."],
        concerns=[],
        missing_info=["Kubernetes experience unknown."],
        rationale="Alex is a strong fit with 8 years Python.",
        suggested_follow_up_questions=["Kubernetes exposure?"],
    )


def _analysis_result() -> AnalysisResult:
    return AnalysisResult(
        response=_make_analysis_llm_response(),
        prompt_tokens=1200,
        completion_tokens=600,
        model_used="gpt-4o-2024-08-06",
    )


GENERATED_SUMMARY = (
    "Alex Chen is a senior software engineer with eight years of experience specializing "
    "in Python and Go, currently employed at Acme Corp. Alex is targeting a remote, "
    "full-time position with a compensation expectation of $150,000–$180,000 annually "
    "and is available with two weeks' notice. As a US citizen, Alex requires no visa "
    "sponsorship. A strong technical profile with relevant domain experience and a "
    "willingness to relocate if needed."
)

GENERATED_SUBMITTAL = (
    "We are pleased to present Alex Chen for the Senior Python Engineer role.\n\n"
    "Alex brings eight years of hands-on experience with Python and Go, directly aligning "
    "with the five-plus years of Python experience required by this position.\n\n"
    "Key Qualifications:\n"
    "• 8 years Python and Go — satisfies the core technical requirement.\n"
    "• Remote-ready, US citizen — no sponsorship required.\n"
    "• Two-week notice period and $150k–$180k annual range.\n\n"
    "Gap Note: Kubernetes experience was not mentioned in the screening call and remains "
    "to be confirmed."
)


# ---------------------------------------------------------------------------
# Unit: _build_analysis_context
# ---------------------------------------------------------------------------

class TestBuildAnalysisContext:
    def test_includes_score_and_tier(self):
        run = AnalysisRun(
            overall_score=78,
            overall_tier="good_fit",
            score_breakdown={
                "skills": {"score": 82, "rationale": "Strong Python."},
                "experience": {"score": 85, "rationale": "8 years."},
                "domain": {"score": 70, "rationale": "Relevant."},
                "logistics": {"score": 72, "rationale": "US citizen."},
            },
            hard_requirements_met=[
                {"requirement": "5+ years Python", "met": True, "candidate_evidence": "8 years Python", "confidence": 0.95}
            ],
            hard_requirements_missed=[
                {"requirement": "Kubernetes", "met": False, "candidate_evidence": None, "confidence": 0.9}
            ],
            preferred_requirements_met=[],
            strengths=["Strong Python match."],
            gaps=["Kubernetes not mentioned."],
            concerns=[],
            rationale="Alex is a strong fit.",
        )
        ctx = _build_analysis_context(run)
        assert "78/100" in ctx
        assert "Good Fit" in ctx
        assert "5+ years Python" in ctx
        assert "Kubernetes" in ctx
        assert "Strong Python match." in ctx
        assert "Alex is a strong fit." in ctx

    def test_format_tier(self):
        assert _format_tier("strong_fit") == "Strong Fit"
        assert _format_tier("no_fit") == "No Fit"
        assert _format_tier(None) == "Unknown"


# ---------------------------------------------------------------------------
# Integration: generate_summary_draft
# ---------------------------------------------------------------------------

class TestGenerateSummaryDraft:
    @patch("app.services.draft_service.generate_summary_text")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_creates_candidate_summary_draft(self, mock_extract, mock_generate, client, db):
        mock_extract.return_value = _extraction_result()
        mock_generate.return_value = GENERATED_SUMMARY

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        cid = ext_resp.json()["candidate_id"]

        draft = draft_service.generate_summary_draft(db, uuid.UUID(cid))

        assert draft.draft_type == "candidate_summary"
        assert draft.content == GENERATED_SUMMARY
        assert draft.edited is False
        assert draft.candidate_id == uuid.UUID(cid)
        assert draft.analysis_run_id is None

        # Verify persisted to DB.
        reloaded = draft_repo.get(db, draft.id)
        assert reloaded is not None
        assert reloaded.content == GENERATED_SUMMARY

    @patch("app.services.draft_service.generate_summary_text")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_summary_prompt_receives_reviewed_value(self, mock_extract, mock_generate, client, db):
        """Reviewed (human-edited) field values appear in the profile sent to the LLM."""
        mock_extract.return_value = _extraction_result()
        mock_generate.return_value = GENERATED_SUMMARY

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        cid = ext_resp.json()["candidate_id"]

        # Edit the full_name field so reviewed_value differs from raw.
        detail = client.get(f"/api/candidates/{cid}").json()
        field = next(f for f in detail["fields"] if f["field_name"] == "full_name")
        client.patch(
            f"/api/candidates/{cid}/fields/{field['id']}",
            json={"reviewed_value": "Alexandra Chen"},
        )

        draft_service.generate_summary_draft(db, uuid.UUID(cid))

        # Check the profile string passed to the LLM contained the reviewed value.
        call_args = mock_generate.call_args
        profile_arg = call_args[0][0]  # first positional: candidate_profile
        assert "Alexandra Chen" in profile_arg
        assert "Alex Chen" not in profile_arg

    def test_raises_if_no_extraction(self, db):
        with pytest.raises(CandidateNotReadyError):
            draft_service.generate_summary_draft(db, uuid.uuid4())


# ---------------------------------------------------------------------------
# Integration: generate_submittal_draft
# ---------------------------------------------------------------------------

class TestGenerateSubmittalDraft:
    @patch("app.services.draft_service.generate_submittal_text")
    @patch("app.services.analysis_service.analyze_candidate_fit")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_creates_submittal_draft_linked_to_analysis(
        self, mock_extract, mock_analyze, mock_generate, client, db
    ):
        mock_extract.return_value = _extraction_result()
        mock_analyze.return_value = _analysis_result()
        mock_generate.return_value = GENERATED_SUBMITTAL

        job_resp = client.post(
            "/api/jobs",
            json={"title": "Senior Python Engineer", "requirements": "5+ years Python required."},
        )
        job_id = job_resp.json()["id"]

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        cid = ext_resp.json()["candidate_id"]

        analysis_resp = client.post(
            f"/api/candidates/{cid}/analyses",
            json={"job_id": job_id},
        )
        analysis_id = analysis_resp.json()["id"]

        draft = draft_service.generate_submittal_draft(
            db, uuid.UUID(cid), uuid.UUID(analysis_id)
        )

        assert draft.draft_type == "submittal"
        assert draft.content == GENERATED_SUBMITTAL
        assert draft.edited is False
        assert str(draft.analysis_run_id) == analysis_id

    @patch("app.services.draft_service.generate_submittal_text")
    @patch("app.services.analysis_service.analyze_candidate_fit")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_submittal_prompt_includes_analysis_context(
        self, mock_extract, mock_analyze, mock_generate, client, db
    ):
        """Analysis score/tier/strengths are passed to the LLM."""
        mock_extract.return_value = _extraction_result()
        mock_analyze.return_value = _analysis_result()
        mock_generate.return_value = GENERATED_SUBMITTAL

        job_resp = client.post("/api/jobs", json={"title": "Engineer"})
        job_id = job_resp.json()["id"]

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        cid = ext_resp.json()["candidate_id"]

        analysis_resp = client.post(f"/api/candidates/{cid}/analyses", json={"job_id": job_id})
        analysis_id = analysis_resp.json()["id"]

        draft_service.generate_submittal_draft(db, uuid.UUID(cid), uuid.UUID(analysis_id))

        call_args = mock_generate.call_args
        analysis_ctx_arg = call_args[1].get("analysis_context") or call_args[0][3]
        assert "78/100" in analysis_ctx_arg
        assert "Good Fit" in analysis_ctx_arg

    def test_raises_if_analysis_not_found(self, db):
        with pytest.raises((CandidateNotReadyError, AnalysisRunNotReadyError)):
            draft_service.generate_submittal_draft(db, uuid.uuid4(), uuid.uuid4())


# ---------------------------------------------------------------------------
# Integration: edit_draft
# ---------------------------------------------------------------------------

class TestEditDraft:
    @patch("app.services.draft_service.generate_summary_text")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_edit_updates_content_and_sets_edited(self, mock_extract, mock_generate, client, db):
        mock_extract.return_value = _extraction_result()
        mock_generate.return_value = GENERATED_SUMMARY

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        cid = ext_resp.json()["candidate_id"]

        draft = draft_service.generate_summary_draft(db, uuid.UUID(cid))
        assert draft.edited is False

        updated = draft_service.edit_draft(
            db, draft.id, uuid.UUID(cid), "Recruiter revised the summary."
        )

        assert updated.content == "Recruiter revised the summary."
        assert updated.edited is True

        # Reload from DB to confirm persistence.
        reloaded = draft_repo.get(db, draft.id)
        assert reloaded.content == "Recruiter revised the summary."
        assert reloaded.edited is True

    def test_edit_raises_for_wrong_candidate(self, db):
        with pytest.raises(DraftNotFoundError):
            draft_service.edit_draft(db, uuid.uuid4(), uuid.uuid4(), "bad edit")


# ---------------------------------------------------------------------------
# Integration: export includes draft content
# ---------------------------------------------------------------------------

class TestExportWithDrafts:
    @patch("app.services.draft_service.generate_summary_text")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_export_includes_summary_draft(self, mock_extract, mock_generate, client):
        mock_extract.return_value = _extraction_result()
        mock_generate.return_value = GENERATED_SUMMARY

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        cid = ext_resp.json()["candidate_id"]

        # Generate a summary draft.
        client.post(f"/api/candidates/{cid}/drafts/summary", json={"actor_id": "recruiter"})

        export_resp = client.get(f"/api/candidates/{cid}/export")
        assert export_resp.status_code == 200
        data = export_resp.json()
        assert data["summary_draft"] == GENERATED_SUMMARY
        assert data["submittal_draft"] is None

    @patch("app.services.draft_service.generate_submittal_text")
    @patch("app.services.analysis_service.analyze_candidate_fit")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_export_includes_submittal_draft(
        self, mock_extract, mock_analyze, mock_generate, client
    ):
        mock_extract.return_value = _extraction_result()
        mock_analyze.return_value = _analysis_result()
        mock_generate.return_value = GENERATED_SUBMITTAL

        job_resp = client.post("/api/jobs", json={"title": "Engineer"})
        job_id = job_resp.json()["id"]

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        cid = ext_resp.json()["candidate_id"]

        analysis_resp = client.post(f"/api/candidates/{cid}/analyses", json={"job_id": job_id})
        analysis_id = analysis_resp.json()["id"]

        client.post(
            f"/api/candidates/{cid}/drafts/submittal",
            json={"analysis_run_id": analysis_id},
        )

        export_resp = client.get(f"/api/candidates/{cid}/export")
        data = export_resp.json()
        assert data["submittal_draft"] == GENERATED_SUBMITTAL

    @patch("app.services.draft_service.generate_summary_text")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_export_uses_edited_content(self, mock_extract, mock_generate, client):
        """Export reflects the recruiter's edited version, not the AI-generated original."""
        mock_extract.return_value = _extraction_result()
        mock_generate.return_value = GENERATED_SUMMARY

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        cid = ext_resp.json()["candidate_id"]

        gen_resp = client.post(f"/api/candidates/{cid}/drafts/summary", json={})
        draft_id = gen_resp.json()["id"]

        # Recruiter edits the draft.
        client.patch(
            f"/api/candidates/{cid}/drafts/{draft_id}",
            json={"content": "Hand-written recruiter summary."},
        )

        export_resp = client.get(f"/api/candidates/{cid}/export")
        data = export_resp.json()
        assert data["summary_draft"] == "Hand-written recruiter summary."

    def test_export_no_drafts_fields_are_null(self, client):
        """Export works cleanly when no drafts have been generated."""
        from unittest.mock import patch as mpatch
        from app.domain.extraction_schemas import ExtractionLLMResponse
        from app.services.openai_client import ExtractionResult as ER

        with mpatch("app.services.extraction_service.extract_from_transcript") as m:
            m.return_value = _extraction_result()
            conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
            client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
            # Find the candidate just created.
            candidates = client.get("/api/candidates").json()["items"]
            cid = candidates[0]["id"]

        export_resp = client.get(f"/api/candidates/{cid}/export")
        data = export_resp.json()
        assert data["summary_draft"] is None
        assert data["submittal_draft"] is None
