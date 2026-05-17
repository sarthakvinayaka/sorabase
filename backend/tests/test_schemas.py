"""Unit tests for Pydantic schema validation — no DB, no OpenAI required."""

import pytest
from pydantic import ValidationError

from app.domain.api_schemas import ConversationCreate
from app.domain.extraction_schemas import (
    CompensationPeriodFieldExtraction,
    ExtractionLLMResponse,
    IntFieldExtraction,
    RemotePreference,
    TextFieldExtraction,
    WorkAuthStatus,
    WorkAuthType,
    EXTRACTION_FIELD_NAMES,
)


def _make_text_field(status="extracted", value="test", confidence=0.9) -> dict:
    return {
        "value": value,
        "evidence_snippet": "He said: test",
        "confidence": confidence,
        "status": status,
    }


def _full_llm_response(**overrides) -> dict:
    text_fields = [
        "full_name", "email", "phone", "current_location", "preferred_location",
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

    payload: dict = {}

    for f in text_fields:
        payload[f] = _make_text_field()

    for f in list_fields:
        payload[f] = {
            "value": ["item_a", "item_b"],
            "evidence_snippet": "snippet",
            "confidence": 0.85,
            "status": "extracted",
        }

    payload["work_authorization"] = {
        "value": "US Citizen", "evidence_snippet": "US citizen", "confidence": 0.95, "status": "extracted",
    }
    payload["work_authorization_status"] = {
        "value": "authorized_now", "evidence_snippet": "US citizen", "confidence": 0.95, "status": "extracted",
    }
    payload["willing_to_relocate"] = {
        "value": True, "evidence_snippet": "yes happy to relocate", "confidence": 0.9, "status": "extracted",
    }
    payload["remote_preference"] = {
        "value": "hybrid", "evidence_snippet": "prefer hybrid", "confidence": 0.85, "status": "extracted",
    }
    payload["employment_type_preference"] = {
        "value": "Contract", "evidence_snippet": "contract only", "confidence": 0.9, "status": "extracted",
    }
    payload["years_experience_years"] = {
        "value": 8.0, "evidence_snippet": "8 years of experience", "confidence": 0.95, "status": "extracted",
    }
    payload["notice_period_days"] = {
        "value": 14, "evidence_snippet": "two weeks notice", "confidence": 0.9, "status": "extracted",
    }
    payload["target_salary_min"] = {
        "value": 150000, "evidence_snippet": "150 to 180k", "confidence": 0.9, "status": "extracted",
    }
    payload["target_salary_max"] = {
        "value": 180000, "evidence_snippet": "150 to 180k", "confidence": 0.9, "status": "extracted",
    }
    payload["compensation_period"] = {
        "value": "annual", "evidence_snippet": "150 to 180k", "confidence": 0.9, "status": "extracted",
    }

    payload.update({
        "missing_fields": [],
        "ambiguous_fields": [],
        "suggested_follow_up_questions": ["What is your notice period?"],
        "candidate_summary": "Strong senior engineer.",
    })
    payload.update(overrides)
    return payload


class TestFieldCount:
    def test_extraction_field_names_has_35_entries(self):
        assert len(EXTRACTION_FIELD_NAMES) == 35

    def test_no_duplicate_field_names(self):
        assert len(EXTRACTION_FIELD_NAMES) == len(set(EXTRACTION_FIELD_NAMES))

    def test_old_fields_removed(self):
        removed = {"years_experience", "target_rate_or_salary", "notice_period", "visa_status"}
        assert not removed.intersection(EXTRACTION_FIELD_NAMES)

    def test_new_fields_present(self):
        new_fields = {
            "years_experience_years", "years_experience_text",
            "target_salary_min", "target_salary_max", "compensation_period", "compensation_text",
            "notice_period_days", "notice_period_text",
            "work_authorization_status", "work_authorization_text",
            "remote_preference_text",
        }
        for f in new_fields:
            assert f in EXTRACTION_FIELD_NAMES, f"{f!r} missing from EXTRACTION_FIELD_NAMES"


class TestEnumValues:
    def test_remote_preference_lowercase(self):
        assert RemotePreference.REMOTE.value == "remote"
        assert RemotePreference.HYBRID.value == "hybrid"
        assert RemotePreference.ONSITE.value == "onsite"
        assert RemotePreference.FLEXIBLE.value == "flexible"
        assert RemotePreference.UNKNOWN.value == "unknown"

    def test_work_auth_status_values(self):
        assert WorkAuthStatus.AUTHORIZED_NOW.value == "authorized_now"
        assert WorkAuthStatus.REQUIRES_FUTURE_SPONSORSHIP.value == "requires_future_sponsorship"
        assert WorkAuthStatus.REQUIRES_CURRENT_SPONSORSHIP.value == "requires_current_sponsorship"
        assert WorkAuthStatus.UNKNOWN.value == "unknown"

    def test_work_auth_type_preserves_display_strings(self):
        assert WorkAuthType.US_CITIZEN.value == "US Citizen"
        assert WorkAuthType.H1B.value == "H-1B"
        assert WorkAuthType.OPT.value == "OPT"


class TestTextFieldExtraction:
    def test_valid_extracted_field(self):
        f = TextFieldExtraction(**_make_text_field())
        assert f.status == "extracted"
        assert f.confidence == 0.9

    def test_missing_field_null_value(self):
        f = TextFieldExtraction(value=None, evidence_snippet=None, confidence=0.0, status="missing")
        assert f.value is None
        assert f.status == "missing"

    def test_confidence_below_zero_raises(self):
        with pytest.raises(ValidationError):
            TextFieldExtraction(**_make_text_field(confidence=-0.1))

    def test_confidence_above_one_raises(self):
        with pytest.raises(ValidationError):
            TextFieldExtraction(**_make_text_field(confidence=1.1))

    def test_invalid_status_raises(self):
        with pytest.raises(ValidationError):
            TextFieldExtraction(**_make_text_field(status="unknown"))

    def test_valid_statuses(self):
        for s in ("extracted", "missing", "ambiguous"):
            f = TextFieldExtraction(**_make_text_field(status=s))
            assert f.status == s


class TestCompensationPeriodFieldExtraction:
    def test_annual(self):
        f = CompensationPeriodFieldExtraction(value="annual", confidence=0.9, status="extracted")
        assert f.value == "annual"

    def test_hourly(self):
        f = CompensationPeriodFieldExtraction(value="hourly", confidence=0.85, status="extracted")
        assert f.value == "hourly"

    def test_none_when_missing(self):
        f = CompensationPeriodFieldExtraction(value=None, confidence=0.0, status="missing")
        assert f.value is None

    def test_invalid_period_raises(self):
        with pytest.raises(ValidationError):
            CompensationPeriodFieldExtraction(value="weekly", confidence=0.9, status="extracted")


class TestIntFieldExtraction:
    def test_valid_int(self):
        f = IntFieldExtraction(value=14, evidence_snippet="two weeks", confidence=0.9, status="extracted")
        assert f.value == 14

    def test_zero_is_valid(self):
        f = IntFieldExtraction(value=0, evidence_snippet="immediate", confidence=0.9, status="extracted")
        assert f.value == 0

    def test_none_when_missing(self):
        f = IntFieldExtraction(value=None, confidence=0.0, status="missing")
        assert f.value is None


class TestExtractionLLMResponse:
    def test_valid_full_response(self):
        payload = _full_llm_response()
        resp = ExtractionLLMResponse(**payload)
        assert resp.candidate_summary == "Strong senior engineer."
        assert isinstance(resp.missing_fields, list)

    def test_missing_candidate_summary_raises(self):
        payload = _full_llm_response()
        del payload["candidate_summary"]
        with pytest.raises(ValidationError):
            ExtractionLLMResponse(**payload)

    def test_missing_field_name_raises(self):
        payload = _full_llm_response()
        del payload["full_name"]
        with pytest.raises(ValidationError):
            ExtractionLLMResponse(**payload)

    def test_typed_fields_round_trip(self):
        payload = _full_llm_response()
        resp = ExtractionLLMResponse(**payload)
        assert resp.years_experience_years.value == 8.0
        assert resp.willing_to_relocate.value is True
        assert resp.notice_period_days.value == 14
        assert resp.target_salary_min.value == 150000
        assert resp.target_salary_max.value == 180000
        assert resp.compensation_period.value == "annual"
        assert resp.work_authorization.value == WorkAuthType.US_CITIZEN
        assert resp.work_authorization_status.value == WorkAuthStatus.AUTHORIZED_NOW
        assert resp.remote_preference.value == RemotePreference.HYBRID
        assert resp.primary_skills.value == ["item_a", "item_b"]

    def test_all_typed_fields_can_be_missing(self):
        payload = _full_llm_response()
        payload["years_experience_years"] = {"value": None, "evidence_snippet": None, "confidence": 0.0, "status": "missing"}
        payload["willing_to_relocate"] = {"value": None, "evidence_snippet": None, "confidence": 0.0, "status": "missing"}
        payload["notice_period_days"] = {"value": None, "evidence_snippet": None, "confidence": 0.0, "status": "missing"}
        payload["target_salary_min"] = {"value": None, "evidence_snippet": None, "confidence": 0.0, "status": "missing"}
        payload["target_salary_max"] = {"value": None, "evidence_snippet": None, "confidence": 0.0, "status": "missing"}
        payload["compensation_period"] = {"value": None, "evidence_snippet": None, "confidence": 0.0, "status": "missing"}
        resp = ExtractionLLMResponse(**payload)
        assert resp.years_experience_years.value is None
        assert resp.willing_to_relocate.value is None
        assert resp.target_salary_min.value is None

    def test_invalid_remote_preference_value_raises(self):
        payload = _full_llm_response()
        payload["remote_preference"] = {"value": "On-site", "evidence_snippet": "x", "confidence": 0.9, "status": "extracted"}
        with pytest.raises(ValidationError):
            ExtractionLLMResponse(**payload)

    def test_invalid_work_auth_status_raises(self):
        payload = _full_llm_response()
        payload["work_authorization_status"] = {"value": "maybe_authorized", "evidence_snippet": "x", "confidence": 0.9, "status": "extracted"}
        with pytest.raises(ValidationError):
            ExtractionLLMResponse(**payload)


class TestConversationCreate:
    def test_valid_transcript(self):
        t = ConversationCreate(raw_text="x" * 200)
        assert len(t.raw_text) == 200

    def test_too_short_raises(self):
        with pytest.raises(ValidationError):
            ConversationCreate(raw_text="short")

    def test_optional_fields_default_none(self):
        t = ConversationCreate(raw_text="x" * 200)
        assert t.recruiter_id is None
        assert t.job_reference is None
