"""
Tests for the extraction service pipeline.

OpenAI is mocked — these tests verify orchestration logic, not LLM quality.
Requires a running PostgreSQL database (see conftest.py).
"""

import uuid
from unittest.mock import patch

import pytest

from app.db.models import Candidate, ExtractionRun, ExtractedField, Conversation
from app.domain.extraction_schemas import (
    ExtractionLLMResponse,
    TextFieldExtraction,
    WorkAuthType,
    WorkAuthStatus,
    RemotePreference,
    EmploymentType,
)
from app.services.extraction_service import (
    ConversationNotFoundError,
    ConversationTooLargeError,
    run_extraction,
)
from app.services.openai_client import ExtractionError, ExtractionResult


def _make_llm_response() -> ExtractionLLMResponse:
    text_fields = [
        "phone", "current_location", "preferred_location",
        "current_title", "domain_experience", "current_company", "education",
        "availability_date", "interview_availability",
        "client_fit_summary", "recruiter_recommendation", "concerns_or_red_flags",
        "work_authorization_text", "remote_preference_text",
        "years_experience_text", "compensation_text", "notice_period_text",
    ]
    list_fields = [
        "primary_skills", "secondary_skills", "previous_companies",
        "target_roles", "certifications", "industries_worked_in",
    ]

    field_data: dict = {}

    for f in text_fields:
        field_data[f] = {"value": f"value_{f}", "evidence_snippet": "snippet", "confidence": 0.85, "status": "extracted"}

    for f in list_fields:
        field_data[f] = {"value": ["item_a", "item_b"], "evidence_snippet": "snippet", "confidence": 0.85, "status": "extracted"}

    field_data["full_name"] = {"value": "Jane Doe", "evidence_snippet": "I'm Jane Doe", "confidence": 0.95, "status": "extracted"}
    field_data["email"] = {"value": None, "evidence_snippet": None, "confidence": 0.0, "status": "missing"}
    field_data["work_authorization"] = {"value": WorkAuthType.US_CITIZEN, "evidence_snippet": "I'm a US citizen", "confidence": 0.95, "status": "extracted"}
    field_data["work_authorization_status"] = {"value": WorkAuthStatus.AUTHORIZED_NOW, "evidence_snippet": "I'm a US citizen", "confidence": 0.95, "status": "extracted"}
    field_data["willing_to_relocate"] = {"value": True, "evidence_snippet": "yes", "confidence": 0.9, "status": "extracted"}
    field_data["remote_preference"] = {"value": RemotePreference.HYBRID, "evidence_snippet": "prefer hybrid", "confidence": 0.85, "status": "extracted"}
    field_data["employment_type_preference"] = {"value": EmploymentType.CONTRACT, "evidence_snippet": "contract", "confidence": 0.9, "status": "extracted"}
    field_data["years_experience_years"] = {"value": 8.0, "evidence_snippet": "8 years", "confidence": 0.95, "status": "extracted"}
    field_data["notice_period_days"] = {"value": 14, "evidence_snippet": "two weeks", "confidence": 0.9, "status": "extracted"}
    field_data["target_salary_min"] = {"value": 150000, "evidence_snippet": "150 to 180k", "confidence": 0.9, "status": "extracted"}
    field_data["target_salary_max"] = {"value": 180000, "evidence_snippet": "150 to 180k", "confidence": 0.9, "status": "extracted"}
    field_data["compensation_period"] = {"value": "annual", "evidence_snippet": "150 to 180k", "confidence": 0.9, "status": "extracted"}

    return ExtractionLLMResponse(
        **field_data,
        missing_fields=["email"],
        ambiguous_fields=[],
        suggested_follow_up_questions=["What is your email?"],
        candidate_summary="Jane is a senior engineer.",
    )


def _make_extraction_result(response: ExtractionLLMResponse) -> ExtractionResult:
    return ExtractionResult(
        response=response,
        prompt_tokens=1000,
        completion_tokens=500,
        model_used="gpt-4o-2024-08-06",
    )


@pytest.fixture()
def conversation(db) -> Conversation:
    c = Conversation(
        source_type="transcript",
        status="raw",
        raw_text="Recruiter: Tell me about yourself.\nCandidate: I'm Jane Doe, senior engineer.",
        char_count=70,
        recruiter_id="recruiter_test",
    )
    db.add(c)
    db.flush()
    return c


class TestRunExtraction:
    def test_conversation_not_found_raises(self, db):
        with pytest.raises(ConversationNotFoundError):
            run_extraction(db, uuid.uuid4())

    def test_conversation_too_large_raises(self, db):
        c = Conversation(
            source_type="transcript",
            status="raw",
            raw_text="x" * 51_000,
            char_count=51_000,
        )
        db.add(c)
        db.flush()
        with pytest.raises(ConversationTooLargeError):
            run_extraction(db, c.id)

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_creates_candidate_and_extraction_run(self, mock_extract, db, conversation):
        mock_response = _make_llm_response()
        mock_extract.return_value = _make_extraction_result(mock_response)

        candidate, extraction_run = run_extraction(db, conversation.id)

        assert extraction_run.conversation_id == conversation.id
        assert extraction_run.status == "completed"
        assert extraction_run.candidate_id == candidate.id
        assert candidate.latest_extraction_run_id == extraction_run.id

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_creates_35_extracted_fields(self, mock_extract, db, conversation):
        mock_response = _make_llm_response()
        mock_extract.return_value = _make_extraction_result(mock_response)

        _, extraction_run = run_extraction(db, conversation.id)

        fields = db.query(ExtractedField).filter_by(extraction_run_id=extraction_run.id).all()
        assert len(fields) == 35

        full_name_field = next(f for f in fields if f.field_name == "full_name")
        assert full_name_field.raw_value == "Jane Doe"
        assert full_name_field.status == "extracted"

        email_field = next(f for f in fields if f.field_name == "email")
        assert email_field.raw_value is None
        assert email_field.status == "missing"

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_typed_fields_stored_correctly(self, mock_extract, db, conversation):
        mock_response = _make_llm_response()
        mock_extract.return_value = _make_extraction_result(mock_response)

        _, extraction_run = run_extraction(db, conversation.id)
        fields = {
            f.field_name: f
            for f in db.query(ExtractedField).filter_by(extraction_run_id=extraction_run.id).all()
        }

        # Renamed numeric fields
        assert fields["years_experience_years"].raw_value == 8.0
        assert fields["notice_period_days"].raw_value == 14

        # Split salary fields
        assert fields["target_salary_min"].raw_value == 150000
        assert fields["target_salary_max"].raw_value == 180000
        assert fields["compensation_period"].raw_value == "annual"

        # New canonical status enum
        assert fields["work_authorization_status"].raw_value == "authorized_now"

        # Lowercase remote preference
        assert fields["remote_preference"].raw_value == "hybrid"

        # List field unchanged
        assert fields["primary_skills"].raw_value == ["item_a", "item_b"]

        # Old fields are gone
        assert "years_experience" not in fields
        assert "target_rate_or_salary" not in fields
        assert "notice_period" not in fields
        assert "visa_status" not in fields

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_salary_bounds_normalized(self, mock_extract, db, conversation):
        """normalize_salary_bound removes zero/negative values."""
        response = _make_llm_response()
        response.target_salary_min = response.target_salary_min.__class__(
            value=0, evidence_snippet=None, confidence=0.0, status="missing"
        )
        mock_extract.return_value = _make_extraction_result(response)

        _, extraction_run = run_extraction(db, conversation.id)
        fields = {
            f.field_name: f
            for f in db.query(ExtractedField).filter_by(extraction_run_id=extraction_run.id).all()
        }
        assert fields["target_salary_min"].normalized_value is None

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_normalizes_email_field(self, mock_extract, db, conversation):
        response = _make_llm_response()
        response.email = TextFieldExtraction(
            value="JANE@CORP.COM",
            evidence_snippet="contact me at JANE@CORP.COM",
            confidence=0.9,
            status="extracted",
        )
        response.missing_fields = []
        mock_extract.return_value = _make_extraction_result(response)

        _, extraction_run = run_extraction(db, conversation.id)
        email_field = (
            db.query(ExtractedField)
            .filter_by(extraction_run_id=extraction_run.id, field_name="email")
            .first()
        )
        assert email_field.normalized_value == "jane@corp.com"

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_normalizes_years_experience(self, mock_extract, db, conversation):
        response = _make_llm_response()
        response.years_experience_years = response.years_experience_years.__class__(
            value=8.567, evidence_snippet="about 8 and a half years", confidence=0.9, status="extracted"
        )
        mock_extract.return_value = _make_extraction_result(response)

        _, extraction_run = run_extraction(db, conversation.id)
        field = (
            db.query(ExtractedField)
            .filter_by(extraction_run_id=extraction_run.id, field_name="years_experience_years")
            .first()
        )
        assert field.normalized_value == 8.6

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_second_run_reuses_candidate(self, mock_extract, db, conversation):
        mock_response = _make_llm_response()
        mock_extract.return_value = _make_extraction_result(mock_response)

        candidate1, _ = run_extraction(db, conversation.id)
        mock_extract.return_value = _make_extraction_result(mock_response)
        candidate2, _ = run_extraction(db, conversation.id)

        assert candidate1.id == candidate2.id

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_openai_error_propagates(self, mock_extract, db, conversation):
        mock_extract.side_effect = ExtractionError("API timeout")
        with pytest.raises(ExtractionError):
            run_extraction(db, conversation.id)

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_conversation_status_set_to_extracted(self, mock_extract, db, conversation):
        mock_response = _make_llm_response()
        mock_extract.return_value = _make_extraction_result(mock_response)

        run_extraction(db, conversation.id)

        db.refresh(conversation)
        assert conversation.status == "extracted"
