"""
API endpoint integration tests.

All tests hit the canonical routes:
  POST   /api/conversations
  GET    /api/conversations/{id}
  POST   /api/conversations/{id}/extract
  GET    /api/candidates
  GET    /api/candidates/{id}
  PATCH  /api/candidates/{id}/approval
  PATCH  /api/candidates/{id}/fields/{field_id}
  GET    /api/candidates/{id}/export

Requires PostgreSQL (see conftest.py). OpenAI is mocked.
"""

import uuid
from unittest.mock import patch

import pytest

from app.domain.extraction_schemas import (
    ExtractionLLMResponse,
    WorkAuthType,
    WorkAuthStatus,
    RemotePreference,
    EmploymentType,
)
from app.services.openai_client import ExtractionResult


# ---------------------------------------------------------------------------
# Shared test fixtures
# ---------------------------------------------------------------------------

def _make_llm_response() -> ExtractionLLMResponse:
    text_fields = [
        "phone", "current_location", "preferred_location",
        "current_title", "domain_experience", "current_company", "education",
        "availability_date", "interview_availability", "client_fit_summary",
        "recruiter_recommendation", "concerns_or_red_flags",
        "work_authorization_text", "remote_preference_text",
        "years_experience_text", "compensation_text", "notice_period_text",
    ]
    list_fields = [
        "primary_skills", "secondary_skills", "previous_companies",
        "target_roles", "certifications", "industries_worked_in",
    ]

    field_data: dict = {}
    for f in text_fields:
        field_data[f] = {"value": f"val_{f}", "evidence_snippet": "quote", "confidence": 0.8, "status": "extracted"}
    for f in list_fields:
        field_data[f] = {"value": ["item_a", "item_b"], "evidence_snippet": "quote", "confidence": 0.8, "status": "extracted"}

    field_data["full_name"] = {"value": "Alex Chen", "evidence_snippet": "I'm Alex Chen", "confidence": 0.95, "status": "extracted"}
    field_data["email"] = {"value": "alex@example.com", "evidence_snippet": "alex@example.com", "confidence": 0.95, "status": "extracted"}
    field_data["work_authorization"] = {"value": WorkAuthType.US_CITIZEN, "evidence_snippet": "I'm a US citizen", "confidence": 0.95, "status": "extracted"}
    field_data["work_authorization_status"] = {"value": WorkAuthStatus.AUTHORIZED_NOW, "evidence_snippet": "I'm a US citizen", "confidence": 0.95, "status": "extracted"}
    field_data["willing_to_relocate"] = {"value": True, "evidence_snippet": "open to relocation", "confidence": 0.9, "status": "extracted"}
    field_data["remote_preference"] = {"value": RemotePreference.REMOTE, "evidence_snippet": "open to remote", "confidence": 0.85, "status": "extracted"}
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
        suggested_follow_up_questions=["What is your availability?"],
        candidate_summary="Solid senior engineer with 8 years of experience.",
    )


def _extraction_result() -> ExtractionResult:
    return ExtractionResult(
        response=_make_llm_response(),
        prompt_tokens=800,
        completion_tokens=400,
        model_used="gpt-4o-2024-08-06",
    )


SAMPLE_TRANSCRIPT = (
    "Recruiter: Hi, can you walk me through your background?\n"
    "Candidate: Sure. I'm Alex Chen, senior software engineer at Acme Corp. "
    "I have eight years of experience working mainly in Python and Go. "
    "My email is alex@example.com. I'm looking for around 160k base, open to remote. "
    "My notice period is two weeks.\n"
    "Recruiter: Great, are you authorized to work in the US?\n"
    "Candidate: Yes, I'm a US citizen.\n"
) * 3


# ---------------------------------------------------------------------------
# Conversation endpoints
# ---------------------------------------------------------------------------

class TestConversationEndpoints:
    def test_create_conversation_success(self, client):
        resp = client.post(
            "/api/conversations",
            json={"raw_text": SAMPLE_TRANSCRIPT, "job_reference": "JOB-001"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert data["char_count"] == len(SAMPLE_TRANSCRIPT)
        assert data["job_reference"] == "JOB-001"
        assert data["source_type"] == "transcript"

    def test_create_conversation_too_short(self, client):
        resp = client.post("/api/conversations", json={"raw_text": "too short"})
        assert resp.status_code == 422  # Pydantic min_length

    def test_get_conversation(self, client):
        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        assert create_resp.status_code == 201
        cid = create_resp.json()["id"]

        get_resp = client.get(f"/api/conversations/{cid}")
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == cid

    def test_get_conversation_not_found(self, client):
        resp = client.get(f"/api/conversations/{uuid.uuid4()}")
        assert resp.status_code == 404

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_extract_conversation(self, mock_extract, client):
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]

        resp = client.post(f"/api/conversations/{conv_id}/extract")
        assert resp.status_code == 201
        data = resp.json()
        assert "candidate_id" in data
        assert "extraction_id" in data

    def test_extract_conversation_not_found(self, client):
        resp = client.post(f"/api/conversations/{uuid.uuid4()}/extract")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Candidate list endpoint
# ---------------------------------------------------------------------------

class TestCandidateListEndpoint:
    def test_list_candidates_empty(self, client):
        resp = client.get("/api/candidates")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["items"], list)
        assert "total" in data
        assert data["page"] == 1
        assert data["limit"] == 20

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_list_candidates_returns_item_after_extraction(self, mock_extract, client):
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        client.post(f"/api/conversations/{conv_id}/extract")

        resp = client.get("/api/candidates")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        item = data["items"][0]
        assert "id" in item
        assert "approval_status" in item
        assert item["approval_status"] == "needs_review"
        assert item["full_name"] == "Alex Chen"

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_list_candidates_filter_by_approval_status(self, mock_extract, client):
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        # Approve the candidate.
        client.patch(
            f"/api/candidates/{cid}/approval",
            json={"approval_status": "approved"},
        )

        approved_resp = client.get("/api/candidates?approval_status=approved")
        needs_review_resp = client.get("/api/candidates?approval_status=needs_review")

        approved_ids = [i["id"] for i in approved_resp.json()["items"]]
        needs_review_ids = [i["id"] for i in needs_review_resp.json()["items"]]

        assert cid in approved_ids
        assert cid not in needs_review_ids

    def test_list_candidates_pagination_params(self, client):
        resp = client.get("/api/candidates?page=1&limit=5")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert data["page"] == 1
        assert data["limit"] == 5


# ---------------------------------------------------------------------------
# Candidate detail endpoint
# ---------------------------------------------------------------------------

class TestCandidateDetailEndpoint:
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_get_candidate_detail(self, mock_extract, client):
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        resp = client.get(f"/api/candidates/{cid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["candidate"]["id"] == cid
        assert len(data["fields"]) == 35
        assert data["extraction"]["status"] == "completed"
        assert data["extraction"]["candidate_summary"] is not None

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_get_candidate_detail_typed_fields(self, mock_extract, client):
        """Verify canonical typed values are stored and returned correctly."""
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        resp = client.get(f"/api/candidates/{cid}")
        fields_by_name = {f["field_name"]: f for f in resp.json()["fields"]}

        # Numeric fields
        assert fields_by_name["years_experience_years"]["raw_value"] == 8.0
        assert fields_by_name["notice_period_days"]["raw_value"] == 14
        assert fields_by_name["target_salary_min"]["raw_value"] == 150000
        assert fields_by_name["target_salary_max"]["raw_value"] == 180000
        assert fields_by_name["compensation_period"]["raw_value"] == "annual"

        # Enum fields
        assert fields_by_name["work_authorization"]["raw_value"] == "US Citizen"
        assert fields_by_name["work_authorization_status"]["raw_value"] == "authorized_now"
        assert fields_by_name["remote_preference"]["raw_value"] == "remote"

        # Boolean field
        assert fields_by_name["willing_to_relocate"]["raw_value"] is True

        # Source-text companions
        assert "years_experience_text" in fields_by_name
        assert "notice_period_text" in fields_by_name
        assert "compensation_text" in fields_by_name
        assert "work_authorization_text" in fields_by_name
        assert "remote_preference_text" in fields_by_name

    def test_get_candidate_not_found(self, client):
        resp = client.get(f"/api/candidates/{uuid.uuid4()}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Approval endpoint
# ---------------------------------------------------------------------------

class TestApprovalEndpoint:
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_approve_candidate(self, mock_extract, client):
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        resp = client.patch(
            f"/api/candidates/{cid}/approval",
            json={"approval_status": "approved", "actor_id": "recruiter_test"},
        )
        assert resp.status_code == 200
        assert resp.json()["approval_status"] == "approved"

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_reject_candidate(self, mock_extract, client):
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        resp = client.patch(
            f"/api/candidates/{cid}/approval",
            json={"approval_status": "rejected"},
        )
        assert resp.status_code == 200
        assert resp.json()["approval_status"] == "rejected"

    def test_approval_candidate_not_found(self, client):
        resp = client.patch(
            f"/api/candidates/{uuid.uuid4()}/approval",
            json={"approval_status": "approved"},
        )
        assert resp.status_code == 404

    def test_approval_invalid_status_rejected(self, client):
        resp = client.patch(
            f"/api/candidates/{uuid.uuid4()}/approval",
            json={"approval_status": "maybe"},
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Field edit endpoint
# ---------------------------------------------------------------------------

class TestFieldEditEndpoint:
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_edit_field(self, mock_extract, client):
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        detail = client.get(f"/api/candidates/{cid}").json()
        field_id = detail["fields"][0]["id"]

        patch_resp = client.patch(
            f"/api/candidates/{cid}/fields/{field_id}",
            json={"reviewed_value": "Corrected Value", "actor_id": "recruiter_test"},
        )
        assert patch_resp.status_code == 200
        result = patch_resp.json()
        assert result["reviewed_value"] == "Corrected Value"
        assert result["edited"] is True
        assert result["status"] == "edited"

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_edit_numeric_field(self, mock_extract, client):
        """Numeric reviewed_value round-trips correctly."""
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        detail = client.get(f"/api/candidates/{cid}").json()
        fields_by_name = {f["field_name"]: f for f in detail["fields"]}
        field_id = fields_by_name["notice_period_days"]["id"]

        patch_resp = client.patch(
            f"/api/candidates/{cid}/fields/{field_id}",
            json={"reviewed_value": 30, "actor_id": "recruiter_test"},
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["reviewed_value"] == 30

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_edit_field_wrong_candidate_id_rejected(self, mock_extract, client):
        """Field edit with a mismatched candidate_id returns 404."""
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        detail = client.get(f"/api/candidates/{cid}").json()
        field_id = detail["fields"][0]["id"]

        # Use a random UUID as the candidate_id — ownership check must reject it.
        resp = client.patch(
            f"/api/candidates/{uuid.uuid4()}/fields/{field_id}",
            json={"reviewed_value": "should be rejected"},
        )
        assert resp.status_code == 404

    def test_edit_field_not_found(self, client):
        resp = client.patch(
            f"/api/candidates/{uuid.uuid4()}/fields/{uuid.uuid4()}",
            json={"reviewed_value": "x"},
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Field confirm endpoint
# ---------------------------------------------------------------------------

class TestFieldConfirmEndpoint:
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_confirm_field(self, mock_extract, client):
        """Confirming a field sets status=confirmed, preserves AI values."""
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        detail = client.get(f"/api/candidates/{cid}").json()
        fields_by_name = {f["field_name"]: f for f in detail["fields"]}
        target = fields_by_name["full_name"]
        field_id = target["id"]
        original_raw = target["raw_value"]

        resp = client.post(
            f"/api/candidates/{cid}/fields/{field_id}/confirm",
            json={"actor_id": "recruiter_test"},
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["status"] == "confirmed"
        assert result["edited"] is False          # confirm doesn't count as an edit
        assert result["raw_value"] == original_raw  # AI value untouched

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_confirm_field_wrong_candidate_rejected(self, mock_extract, client):
        """Confirm with mismatched candidate_id returns 404."""
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        detail = client.get(f"/api/candidates/{cid}").json()
        field_id = detail["fields"][0]["id"]

        resp = client.post(
            f"/api/candidates/{uuid.uuid4()}/fields/{field_id}/confirm",
            json={"actor_id": "recruiter"},
        )
        assert resp.status_code == 404

    def test_confirm_field_not_found(self, client):
        resp = client.post(
            f"/api/candidates/{uuid.uuid4()}/fields/{uuid.uuid4()}/confirm",
            json={"actor_id": "recruiter"},
        )
        assert resp.status_code == 404

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_confirm_after_edit_preserves_reviewed_value(self, mock_extract, client):
        """Confirm on an already-edited field keeps reviewed_value intact."""
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        detail = client.get(f"/api/candidates/{cid}").json()
        field_id = detail["fields"][0]["id"]

        # First edit
        client.patch(
            f"/api/candidates/{cid}/fields/{field_id}",
            json={"reviewed_value": "Manually Corrected"},
        )
        # Then confirm
        resp = client.post(
            f"/api/candidates/{cid}/fields/{field_id}/confirm",
            json={"actor_id": "recruiter"},
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["status"] == "confirmed"
        assert result["reviewed_value"] == "Manually Corrected"


# ---------------------------------------------------------------------------
# Field unresolve endpoint
# ---------------------------------------------------------------------------

class TestFieldUnresolveEndpoint:
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_unresolve_field(self, mock_extract, client):
        """Unresolving a field sets status=unresolved."""
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        detail = client.get(f"/api/candidates/{cid}").json()
        field_id = detail["fields"][0]["id"]

        resp = client.post(
            f"/api/candidates/{cid}/fields/{field_id}/unresolve",
            json={"actor_id": "recruiter_test"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "unresolved"

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_unresolve_wrong_candidate_rejected(self, mock_extract, client):
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        detail = client.get(f"/api/candidates/{cid}").json()
        field_id = detail["fields"][0]["id"]

        resp = client.post(
            f"/api/candidates/{uuid.uuid4()}/fields/{field_id}/unresolve",
            json={"actor_id": "recruiter"},
        )
        assert resp.status_code == 404

    def test_unresolve_field_not_found(self, client):
        resp = client.post(
            f"/api/candidates/{uuid.uuid4()}/fields/{uuid.uuid4()}/unresolve",
            json={"actor_id": "recruiter"},
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Audit log endpoint
# ---------------------------------------------------------------------------

class TestAuditLogEndpoint:
    def test_audit_log_candidate_not_found(self, client):
        resp = client.get(f"/api/candidates/{uuid.uuid4()}/audit")
        assert resp.status_code == 404

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_audit_log_after_extraction(self, mock_extract, client):
        """Audit log contains the extraction event written by the pipeline."""
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        resp = client.get(f"/api/candidates/{cid}/audit")
        assert resp.status_code == 200
        data = resp.json()
        assert "entries" in data
        assert "total" in data
        actions = [e["action"] for e in data["entries"]]
        assert "extracted" in actions

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_audit_log_records_field_edit(self, mock_extract, client):
        """Edit action appears in audit with before/after values."""
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        detail = client.get(f"/api/candidates/{cid}").json()
        fields_by_name = {f["field_name"]: f for f in detail["fields"]}
        field_id = fields_by_name["full_name"]["id"]

        client.patch(
            f"/api/candidates/{cid}/fields/{field_id}",
            json={"reviewed_value": "Updated Name", "actor_id": "test_recruiter"},
        )

        resp = client.get(f"/api/candidates/{cid}/audit")
        data = resp.json()
        edit_entries = [e for e in data["entries"] if e["action"] == "edited"]
        assert len(edit_entries) >= 1
        entry = edit_entries[0]
        assert entry["field_name"] == "full_name"
        assert entry["actor_id"] == "test_recruiter"
        assert entry["new_value"]["value"] == "Updated Name"

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_audit_log_records_confirm(self, mock_extract, client):
        """Confirm action appears in audit with confirmed_value."""
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        detail = client.get(f"/api/candidates/{cid}").json()
        fields_by_name = {f["field_name"]: f for f in detail["fields"]}
        field_id = fields_by_name["full_name"]["id"]

        client.post(
            f"/api/candidates/{cid}/fields/{field_id}/confirm",
            json={"actor_id": "recruiter"},
        )

        resp = client.get(f"/api/candidates/{cid}/audit")
        data = resp.json()
        confirm_entries = [e for e in data["entries"] if e["action"] == "confirmed"]
        assert len(confirm_entries) >= 1
        entry = confirm_entries[0]
        assert entry["field_name"] == "full_name"
        assert entry["new_value"]["status"] == "confirmed"
        assert "confirmed_value" in entry["new_value"]

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_audit_log_records_unresolve(self, mock_extract, client):
        """Unresolve action appears in audit."""
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        detail = client.get(f"/api/candidates/{cid}").json()
        field_id = detail["fields"][0]["id"]

        client.post(
            f"/api/candidates/{cid}/fields/{field_id}/unresolve",
            json={"actor_id": "recruiter"},
        )

        resp = client.get(f"/api/candidates/{cid}/audit")
        data = resp.json()
        unresolved_entries = [e for e in data["entries"] if e["action"] == "unresolved"]
        assert len(unresolved_entries) >= 1

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_audit_log_records_approval_change(self, mock_extract, client):
        """Approval update appears in audit with old and new status."""
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        client.patch(
            f"/api/candidates/{cid}/approval",
            json={"approval_status": "approved", "actor_id": "recruiter_test"},
        )

        resp = client.get(f"/api/candidates/{cid}/audit")
        data = resp.json()
        approval_entries = [e for e in data["entries"] if e["action"] == "approval_updated"]
        assert len(approval_entries) >= 1
        entry = approval_entries[0]
        assert entry["old_value"]["approval_status"] == "needs_review"
        assert entry["new_value"]["approval_status"] == "approved"


# ---------------------------------------------------------------------------
# Export endpoint
# ---------------------------------------------------------------------------

class TestExportEndpoint:
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_export_returns_valid_json(self, mock_extract, client):
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        resp = client.get(f"/api/candidates/{cid}/export")
        assert resp.status_code == 200
        data = resp.json()
        assert data["candidate_id"] == cid
        assert "fields" in data
        assert "candidate_summary" in data
        assert all(
            "value" in v and "source" in v
            for v in data["fields"].values()
        )

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_export_typed_field_values(self, mock_extract, client):
        """Export delivers canonical typed values, not blobs."""
        mock_extract.return_value = _extraction_result()

        create_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        conv_id = create_resp.json()["id"]
        ext_resp = client.post(f"/api/conversations/{conv_id}/extract")
        cid = ext_resp.json()["candidate_id"]

        data = client.get(f"/api/candidates/{cid}/export").json()
        fields = data["fields"]

        assert fields["years_experience_years"]["value"] == 8.0
        assert fields["notice_period_days"]["value"] == 14
        assert fields["target_salary_min"]["value"] == 150000
        assert fields["target_salary_max"]["value"] == 180000
        assert fields["work_authorization_status"]["value"] == "authorized_now"
        assert fields["remote_preference"]["value"] == "remote"
        assert fields["willing_to_relocate"]["value"] is True

    def test_export_candidate_not_found(self, client):
        resp = client.get(f"/api/candidates/{uuid.uuid4()}/export")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Analysis endpoints
# ---------------------------------------------------------------------------

def _make_analysis_llm_response():
    from app.domain.analysis_schemas import AnalysisLLMResponse, DimensionScore, RequirementAssessment
    return AnalysisLLMResponse(
        overall_score=78,
        overall_tier="good_fit",
        skills_score=DimensionScore(score=82, rationale="Strong Python and Go skills."),
        experience_score=DimensionScore(score=85, rationale="8 years matches seniority."),
        domain_score=DimensionScore(score=70, rationale="Relevant domain experience."),
        logistics_score=DimensionScore(score=72, rationale="US citizen, remote, 2-week notice."),
        hard_requirements=[
            RequirementAssessment(requirement="5+ years Python", met=True,
                                  candidate_evidence="8 years Python", confidence=0.95),
            RequirementAssessment(requirement="Kubernetes experience", met=False,
                                  candidate_evidence=None, confidence=0.9),
        ],
        preferred_requirements=[],
        strengths=["Strong Python/Go skills match JD."],
        gaps=["Kubernetes not mentioned."],
        concerns=[],
        missing_info=["Kubernetes experience unknown."],
        rationale="Alex Chen is a strong match with 8 years of Python and Go.",
        suggested_follow_up_questions=["Kubernetes exposure?"],
    )


def _analysis_result_fixture():
    from app.services.analysis_client import AnalysisResult
    return AnalysisResult(
        response=_make_analysis_llm_response(),
        prompt_tokens=1200,
        completion_tokens=600,
        model_used="gpt-4o-2024-08-06",
    )


class TestAnalysisEndpoints:
    @patch("app.services.analysis_service.analyze_candidate_fit")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_trigger_analysis_creates_run(self, mock_extract, mock_analyze, client):
        """POST /candidates/{id}/analyses creates a completed AnalysisRun."""
        mock_extract.return_value = _extraction_result()
        mock_analyze.return_value = _analysis_result_fixture()

        job_resp = client.post(
            "/api/jobs",
            json={"title": "Senior Python Engineer", "requirements": "5+ years Python required."},
        )
        assert job_resp.status_code == 201
        job_id = job_resp.json()["id"]

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        assert ext_resp.status_code == 201
        cid = ext_resp.json()["candidate_id"]

        resp = client.post(
            f"/api/candidates/{cid}/analyses",
            json={"job_id": job_id},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "completed"
        assert data["overall_score"] == 78
        assert data["overall_tier"] == "good_fit"
        assert data["score_breakdown"] is not None
        assert "skills" in data["score_breakdown"]
        assert data["hard_requirements_met"] is not None
        assert len(data["hard_requirements_met"]) == 1
        assert data["hard_requirements_missed"] is not None
        assert len(data["hard_requirements_missed"]) == 1
        assert data["rationale"] is not None
        assert data["model_used"] == "gpt-4o-2024-08-06"

    def test_trigger_analysis_candidate_not_found(self, client):
        resp = client.post(
            f"/api/candidates/{uuid.uuid4()}/analyses",
            json={"job_id": str(uuid.uuid4())},
        )
        assert resp.status_code == 404
        assert "Candidate" in resp.json()["detail"]

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_trigger_analysis_job_not_found(self, mock_extract, client):
        mock_extract.return_value = _extraction_result()

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        cid = ext_resp.json()["candidate_id"]

        resp = client.post(
            f"/api/candidates/{cid}/analyses",
            json={"job_id": str(uuid.uuid4())},
        )
        assert resp.status_code == 404
        assert "Job" in resp.json()["detail"]

    @patch("app.services.analysis_service.analyze_candidate_fit")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_list_analyses_returns_runs(self, mock_extract, mock_analyze, client):
        """GET /candidates/{id}/analyses returns all runs newest-first."""
        mock_extract.return_value = _extraction_result()
        mock_analyze.return_value = _analysis_result_fixture()

        job_resp = client.post("/api/jobs", json={"title": "Engineer"})
        job_id = job_resp.json()["id"]

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        cid = ext_resp.json()["candidate_id"]

        client.post(f"/api/candidates/{cid}/analyses", json={"job_id": job_id})
        client.post(f"/api/candidates/{cid}/analyses", json={"job_id": job_id})

        resp = client.get(f"/api/candidates/{cid}/analyses")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 2

    @patch("app.services.analysis_service.analyze_candidate_fit")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_get_analysis_by_id(self, mock_extract, mock_analyze, client):
        mock_extract.return_value = _extraction_result()
        mock_analyze.return_value = _analysis_result_fixture()

        job_resp = client.post("/api/jobs", json={"title": "Engineer"})
        job_id = job_resp.json()["id"]

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        cid = ext_resp.json()["candidate_id"]

        create_resp = client.post(f"/api/candidates/{cid}/analyses", json={"job_id": job_id})
        analysis_id = create_resp.json()["id"]

        resp = client.get(f"/api/candidates/{cid}/analyses/{analysis_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == analysis_id

    def test_get_analysis_not_found(self, client):
        resp = client.get(f"/api/candidates/{uuid.uuid4()}/analyses/{uuid.uuid4()}")
        assert resp.status_code == 404

    @patch("app.services.analysis_service.analyze_candidate_fit")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_list_analyses_empty_before_trigger(self, mock_extract, _mock_analyze, client):
        mock_extract.return_value = _extraction_result()

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        cid = ext_resp.json()["candidate_id"]

        resp = client.get(f"/api/candidates/{cid}/analyses")
        assert resp.status_code == 200
        assert resp.json() == []


# ---------------------------------------------------------------------------
# Draft endpoints
# ---------------------------------------------------------------------------

MOCK_SUMMARY = (
    "Alex Chen is a senior software engineer with eight years of experience in Python and Go, "
    "currently at Acme Corp. Targeting remote, full-time roles at $150k–$180k annually with "
    "two weeks notice. US citizen, no sponsorship required."
)

MOCK_SUBMITTAL = (
    "We are pleased to present Alex Chen for this role.\n\n"
    "Key Qualifications:\n"
    "• 8 years Python — satisfies the core requirement.\n"
    "• US citizen, remote-ready.\n\n"
    "Gap: Kubernetes experience to be confirmed."
)


class TestDraftEndpoints:
    @patch("app.services.draft_service.generate_summary_text")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_generate_summary_creates_draft(self, mock_extract, mock_gen, client):
        mock_extract.return_value = _extraction_result()
        mock_gen.return_value = MOCK_SUMMARY

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        cid = ext_resp.json()["candidate_id"]

        resp = client.post(f"/api/candidates/{cid}/drafts/summary", json={})
        assert resp.status_code == 201
        data = resp.json()
        assert data["draft_type"] == "candidate_summary"
        assert data["content"] == MOCK_SUMMARY
        assert data["edited"] is False
        assert data["candidate_id"] == cid
        assert data["analysis_run_id"] is None

    @patch("app.services.draft_service.generate_submittal_text")
    @patch("app.services.analysis_service.analyze_candidate_fit")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_generate_submittal_creates_draft(self, mock_extract, mock_analyze, mock_gen, client):
        mock_extract.return_value = _extraction_result()
        mock_analyze.return_value = _analysis_result_fixture()
        mock_gen.return_value = MOCK_SUBMITTAL

        job_resp = client.post("/api/jobs", json={"title": "Engineer"})
        job_id = job_resp.json()["id"]

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        cid = ext_resp.json()["candidate_id"]

        analysis_resp = client.post(f"/api/candidates/{cid}/analyses", json={"job_id": job_id})
        analysis_id = analysis_resp.json()["id"]

        resp = client.post(
            f"/api/candidates/{cid}/drafts/submittal",
            json={"analysis_run_id": analysis_id},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["draft_type"] == "submittal"
        assert data["content"] == MOCK_SUBMITTAL
        assert data["analysis_run_id"] == analysis_id

    @patch("app.services.draft_service.generate_summary_text")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_list_drafts_returns_all(self, mock_extract, mock_gen, client):
        mock_extract.return_value = _extraction_result()
        mock_gen.return_value = MOCK_SUMMARY

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        cid = ext_resp.json()["candidate_id"]

        client.post(f"/api/candidates/{cid}/drafts/summary", json={})
        client.post(f"/api/candidates/{cid}/drafts/summary", json={})

        resp = client.get(f"/api/candidates/{cid}/drafts")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 2
        assert all(d["draft_type"] == "candidate_summary" for d in data)

    @patch("app.services.draft_service.generate_summary_text")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_edit_draft_updates_content(self, mock_extract, mock_gen, client):
        mock_extract.return_value = _extraction_result()
        mock_gen.return_value = MOCK_SUMMARY

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        cid = ext_resp.json()["candidate_id"]

        gen_resp = client.post(f"/api/candidates/{cid}/drafts/summary", json={})
        draft_id = gen_resp.json()["id"]

        resp = client.patch(
            f"/api/candidates/{cid}/drafts/{draft_id}",
            json={"content": "Hand-written recruiter text."},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["content"] == "Hand-written recruiter text."
        assert data["edited"] is True

    @patch("app.services.draft_service.generate_summary_text")
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_edit_draft_wrong_candidate_returns_404(self, mock_extract, mock_gen, client):
        mock_extract.return_value = _extraction_result()
        mock_gen.return_value = MOCK_SUMMARY

        conv_resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        ext_resp = client.post(f"/api/conversations/{conv_resp.json()['id']}/extract")
        cid = ext_resp.json()["candidate_id"]

        gen_resp = client.post(f"/api/candidates/{cid}/drafts/summary", json={})
        draft_id = gen_resp.json()["id"]

        resp = client.patch(
            f"/api/candidates/{uuid.uuid4()}/drafts/{draft_id}",
            json={"content": "Should be rejected."},
        )
        assert resp.status_code == 404

    def test_edit_nonexistent_draft_returns_404(self, client):
        resp = client.patch(
            f"/api/candidates/{uuid.uuid4()}/drafts/{uuid.uuid4()}",
            json={"content": "x"},
        )
        assert resp.status_code == 404

    def test_generate_summary_candidate_not_found(self, client):
        resp = client.post(
            f"/api/candidates/{uuid.uuid4()}/drafts/summary",
            json={},
        )
        assert resp.status_code == 422

    def test_generate_submittal_invalid_analysis(self, client):
        resp = client.post(
            f"/api/candidates/{uuid.uuid4()}/drafts/submittal",
            json={"analysis_run_id": str(uuid.uuid4())},
        )
        assert resp.status_code == 422
