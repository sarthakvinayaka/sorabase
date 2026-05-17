"""
Persistence integration tests.

Each test exercises a complete write → re-read cycle through the API layer,
verifying that the exact bytes written to the DB are retrievable by a
subsequent GET — the same path the frontend takes on a page refresh.

All tests run against a real PostgreSQL database inside the test transaction
(rolled back after each test for isolation). OpenAI is mocked.
"""

import uuid
from unittest.mock import patch

import pytest

from app.db.models import AuditLog
from app.domain.extraction_schemas import (
    ExtractionLLMResponse,
    WorkAuthType,
    WorkAuthStatus,
    RemotePreference,
    EmploymentType,
)
from app.services.openai_client import ExtractionResult


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

SAMPLE_TRANSCRIPT = (
    "Recruiter: Hi, can you walk me through your background?\n"
    "Candidate: Sure. I'm Alex Chen, senior software engineer at Acme Corp. "
    "I have eight years of experience working mainly in Python and Go. "
    "My email is alex@example.com. I'm looking for around 160k base, open to remote. "
    "My notice period is two weeks.\n"
    "Recruiter: Great, are you authorized to work in the US?\n"
    "Candidate: Yes, I'm a US citizen.\n"
) * 3


def _make_llm_response() -> ExtractionLLMResponse:
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
        field_data[f] = {"value": f"val_{f}", "evidence_snippet": f"quote for {f}", "confidence": 0.8, "status": "extracted"}
    for f in list_fields:
        field_data[f] = {"value": ["item_a", "item_b"], "evidence_snippet": "list quote", "confidence": 0.8, "status": "extracted"}

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


# ---------------------------------------------------------------------------
# Transcript persistence
# ---------------------------------------------------------------------------

class TestTranscriptPersistence:
    def test_create_and_reload_by_id(self, client):
        """Transcript is retrievable by ID with all fields intact."""
        resp = client.post(
            "/api/conversations",
            json={"raw_text": SAMPLE_TRANSCRIPT, "job_reference": "JOB-PERSIST-01"},
        )
        assert resp.status_code == 201
        cid = resp.json()["id"]

        # Reload — simulates a page refresh fetching the stored record.
        get = client.get(f"/api/conversations/{cid}")
        assert get.status_code == 200
        data = get.json()

        assert data["id"] == cid
        assert data["raw_text"] == SAMPLE_TRANSCRIPT
        assert data["char_count"] == len(SAMPLE_TRANSCRIPT)
        assert data["job_reference"] == "JOB-PERSIST-01"
        assert data["source_type"] == "transcript"
        assert data["status"] == "raw"

    def test_transcript_status_lifecycle(self, client):
        """Conversation status transitions raw → extracted after a successful extraction."""
        resp = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT})
        cid = resp.json()["id"]
        assert client.get(f"/api/conversations/{cid}").json()["status"] == "raw"

        with patch("app.services.extraction_service.extract_from_transcript") as mock:
            mock.return_value = _extraction_result()
            client.post(f"/api/conversations/{cid}/extract")

        assert client.get(f"/api/conversations/{cid}").json()["status"] == "extracted"

    def test_unknown_id_returns_404(self, client):
        resp = client.get(f"/api/conversations/{uuid.uuid4()}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Extraction result persistence
# ---------------------------------------------------------------------------

class TestExtractionPersistence:
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_all_35_fields_persisted(self, mock_extract, client):
        """All 35 extracted fields are stored and returned by the detail endpoint."""
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        ext = client.post(f"/api/conversations/{conv_id}/extract").json()
        cid = ext["candidate_id"]

        data = client.get(f"/api/candidates/{cid}").json()
        assert len(data["fields"]) == 35

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_extraction_typed_values_round_trip(self, mock_extract, client):
        """Canonical typed values survive the write → read cycle unchanged."""
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        cid = client.post(f"/api/conversations/{conv_id}/extract").json()["candidate_id"]

        fields = {
            f["field_name"]: f
            for f in client.get(f"/api/candidates/{cid}").json()["fields"]
        }

        assert fields["years_experience_years"]["raw_value"] == 8.0
        assert fields["notice_period_days"]["raw_value"] == 14
        assert fields["target_salary_min"]["raw_value"] == 150000
        assert fields["target_salary_max"]["raw_value"] == 180000
        assert fields["compensation_period"]["raw_value"] == "annual"
        assert fields["work_authorization"]["raw_value"] == "US Citizen"
        assert fields["work_authorization_status"]["raw_value"] == "authorized_now"
        assert fields["remote_preference"]["raw_value"] == "remote"
        assert fields["willing_to_relocate"]["raw_value"] is True
        assert fields["full_name"]["raw_value"] == "Alex Chen"
        assert fields["primary_skills"]["raw_value"] == ["item_a", "item_b"]

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_evidence_snippets_persisted(self, mock_extract, client):
        """Evidence snippets are stored per field and returned by the detail endpoint."""
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        cid = client.post(f"/api/conversations/{conv_id}/extract").json()["candidate_id"]

        fields = {
            f["field_name"]: f
            for f in client.get(f"/api/candidates/{cid}").json()["fields"]
        }

        # Every extracted field must carry an evidence snippet.
        extracted = [f for f in fields.values() if f["status"] == "extracted"]
        assert len(extracted) > 0
        for f in extracted:
            assert f["evidence_snippet"] is not None, f'{f["field_name"]} missing evidence'

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_extraction_run_metadata_persisted(self, mock_extract, client):
        """ExtractionRun metadata (model, summary, confidence) is persisted."""
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        cid = client.post(f"/api/conversations/{conv_id}/extract").json()["candidate_id"]

        extraction = client.get(f"/api/candidates/{cid}").json()["extraction"]
        assert extraction["status"] == "completed"
        assert extraction["model_used"] == "gpt-4o-2024-08-06"
        assert extraction["candidate_summary"] == "Solid senior engineer with 8 years of experience."
        assert extraction["overall_confidence"] is not None

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_audit_log_written_on_extraction(self, mock_extract, client, db):
        """An audit log entry is created when extraction completes."""
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        ext = client.post(f"/api/conversations/{conv_id}/extract").json()

        entry = (
            db.query(AuditLog)
            .filter_by(entity_type="extraction_run", action="extracted")
            .filter(AuditLog.entity_id == uuid.UUID(ext["extraction_id"]))
            .first()
        )
        assert entry is not None
        assert entry.actor_id == "system"
        assert entry.source == "system"


# ---------------------------------------------------------------------------
# Field edit persistence
# ---------------------------------------------------------------------------

class TestFieldEditPersistence:
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_reviewed_value_persists_on_reload(self, mock_extract, client):
        """
        Editing a field stores reviewed_value in the DB; a subsequent GET
        (simulating a page refresh) returns the edited value.
        """
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        cid = client.post(f"/api/conversations/{conv_id}/extract").json()["candidate_id"]

        fields = client.get(f"/api/candidates/{cid}").json()["fields"]
        name_field = next(f for f in fields if f["field_name"] == "full_name")
        field_id = name_field["id"]

        patch_resp = client.patch(
            f"/api/candidates/{cid}/fields/{field_id}",
            json={"reviewed_value": "Alexandra Chen", "actor_id": "recruiter_1"},
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["reviewed_value"] == "Alexandra Chen"
        assert patch_resp.json()["edited"] is True
        assert patch_resp.json()["status"] == "edited"

        # Reload — same as the frontend fetching after a page refresh.
        reloaded = client.get(f"/api/candidates/{cid}").json()["fields"]
        reloaded_name = next(f for f in reloaded if f["field_name"] == "full_name")
        assert reloaded_name["reviewed_value"] == "Alexandra Chen"
        assert reloaded_name["edited"] is True

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_multiple_edits_are_independent(self, mock_extract, client):
        """Editing two fields persists both independently."""
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        cid = client.post(f"/api/conversations/{conv_id}/extract").json()["candidate_id"]

        fields_by_name = {
            f["field_name"]: f
            for f in client.get(f"/api/candidates/{cid}").json()["fields"]
        }

        # Edit full_name.
        client.patch(
            f"/api/candidates/{cid}/fields/{fields_by_name['full_name']['id']}",
            json={"reviewed_value": "Alex C.", "actor_id": "r"},
        )
        # Edit notice_period_days.
        client.patch(
            f"/api/candidates/{cid}/fields/{fields_by_name['notice_period_days']['id']}",
            json={"reviewed_value": 30, "actor_id": "r"},
        )

        reloaded = {
            f["field_name"]: f
            for f in client.get(f"/api/candidates/{cid}").json()["fields"]
        }
        assert reloaded["full_name"]["reviewed_value"] == "Alex C."
        assert reloaded["notice_period_days"]["reviewed_value"] == 30
        # Un-edited field is not affected.
        assert reloaded["email"]["edited"] is False

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_edit_with_wrong_candidate_id_rejected(self, mock_extract, client):
        """Patching a field using a mismatched candidate_id returns 404."""
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        cid = client.post(f"/api/conversations/{conv_id}/extract").json()["candidate_id"]

        fields = client.get(f"/api/candidates/{cid}").json()["fields"]
        field_id = fields[0]["id"]

        # Valid field_id but wrong candidate_id — must be rejected.
        resp = client.patch(
            f"/api/candidates/{uuid.uuid4()}/fields/{field_id}",
            json={"reviewed_value": "injected", "actor_id": "attacker"},
        )
        assert resp.status_code == 404

        # Verify the field was NOT modified.
        actual = {f["field_name"]: f for f in client.get(f"/api/candidates/{cid}").json()["fields"]}
        assert not actual[fields[0]["field_name"]]["edited"]

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_audit_log_written_on_field_edit(self, mock_extract, client, db):
        """An audit log entry with old and new values is created on field edit."""
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        cid = client.post(f"/api/conversations/{conv_id}/extract").json()["candidate_id"]

        fields = client.get(f"/api/candidates/{cid}").json()["fields"]
        name_field = next(f for f in fields if f["field_name"] == "full_name")

        client.patch(
            f"/api/candidates/{cid}/fields/{name_field['id']}",
            json={"reviewed_value": "Alexandra Chen", "actor_id": "recruiter_test"},
        )

        entry = (
            db.query(AuditLog)
            .filter_by(entity_type="field", action="edited", actor_id="recruiter_test")
            .filter(AuditLog.entity_id == uuid.UUID(name_field["id"]))
            .first()
        )
        assert entry is not None
        # new_value is now a structured dict: {status, value}
        assert entry.new_value["value"] == "Alexandra Chen"
        assert entry.new_value["status"] == "edited"
        assert entry.source == "human"

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_audit_log_written_on_approval_change(self, mock_extract, client, db):
        """An audit log entry is created when approval status changes."""
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        cid = client.post(f"/api/conversations/{conv_id}/extract").json()["candidate_id"]

        client.patch(
            f"/api/candidates/{cid}/approval",
            json={"approval_status": "approved", "actor_id": "manager_1"},
        )

        entry = (
            db.query(AuditLog)
            .filter_by(entity_type="candidate", action="approval_updated", actor_id="manager_1")
            .filter(AuditLog.entity_id == uuid.UUID(cid))
            .first()
        )
        assert entry is not None
        assert entry.old_value == {"approval_status": "needs_review"}
        assert entry.new_value == {"approval_status": "approved"}


# ---------------------------------------------------------------------------
# Export persistence
# ---------------------------------------------------------------------------

class TestExportPersistence:
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_export_returns_reviewed_value_for_edited_fields(self, mock_extract, client):
        """Export uses reviewed_value for fields that have been edited."""
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        cid = client.post(f"/api/conversations/{conv_id}/extract").json()["candidate_id"]

        fields = client.get(f"/api/candidates/{cid}").json()["fields"]
        name_field = next(f for f in fields if f["field_name"] == "full_name")

        client.patch(
            f"/api/candidates/{cid}/fields/{name_field['id']}",
            json={"reviewed_value": "Alexandra Chen", "actor_id": "r"},
        )

        export = client.get(f"/api/candidates/{cid}/export").json()
        assert export["fields"]["full_name"]["value"] == "Alexandra Chen"
        assert export["fields"]["full_name"]["source"] == "human_edited"

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_export_returns_ai_value_for_unedited_fields(self, mock_extract, client):
        """Export uses normalized/raw value for fields that have not been edited."""
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        cid = client.post(f"/api/conversations/{conv_id}/extract").json()["candidate_id"]

        export = client.get(f"/api/candidates/{cid}/export").json()
        assert export["fields"]["years_experience_years"]["value"] == 8.0
        assert export["fields"]["years_experience_years"]["source"] == "ai_extracted"
        assert export["fields"]["notice_period_days"]["value"] == 14
        assert export["fields"]["target_salary_min"]["value"] == 150000

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_export_reviewed_value_takes_precedence_over_raw(self, mock_extract, client):
        """When both reviewed_value and raw_value exist, export uses reviewed_value."""
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        cid = client.post(f"/api/conversations/{conv_id}/extract").json()["candidate_id"]

        fields = {
            f["field_name"]: f
            for f in client.get(f"/api/candidates/{cid}").json()["fields"]
        }
        notice_id = fields["notice_period_days"]["id"]
        assert fields["notice_period_days"]["raw_value"] == 14

        # Override with a different reviewed value.
        client.patch(
            f"/api/candidates/{cid}/fields/{notice_id}",
            json={"reviewed_value": 30, "actor_id": "r"},
        )

        export = client.get(f"/api/candidates/{cid}/export").json()
        assert export["fields"]["notice_period_days"]["value"] == 30
        assert export["fields"]["notice_period_days"]["source"] == "human_edited"

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_export_audit_log_written(self, mock_extract, client, db):
        """An audit log entry is created when a candidate is exported."""
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        cid = client.post(f"/api/conversations/{conv_id}/extract").json()["candidate_id"]

        client.get(f"/api/candidates/{cid}/export")

        entry = (
            db.query(AuditLog)
            .filter_by(entity_type="candidate", action="exported")
            .filter(AuditLog.entity_id == uuid.UUID(cid))
            .first()
        )
        assert entry is not None


# ---------------------------------------------------------------------------
# Candidate record persistence
# ---------------------------------------------------------------------------

class TestCandidateRecordPersistence:
    @patch("app.services.extraction_service.extract_from_transcript")
    def test_candidate_record_retrievable_after_extraction(self, mock_extract, client):
        """A candidate record is created and retrievable immediately after extraction."""
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        cid = client.post(f"/api/conversations/{conv_id}/extract").json()["candidate_id"]

        resp = client.get(f"/api/candidates/{cid}")
        assert resp.status_code == 200
        candidate = resp.json()["candidate"]
        assert candidate["id"] == cid
        assert candidate["approval_status"] == "needs_review"

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_full_name_in_list_view(self, mock_extract, client):
        """Candidate's full_name is denormalized into the list endpoint."""
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        cid = client.post(f"/api/conversations/{conv_id}/extract").json()["candidate_id"]

        list_resp = client.get("/api/candidates")
        items = list_resp.json()["items"]
        match = next((i for i in items if i["id"] == cid), None)
        assert match is not None
        assert match["full_name"] == "Alex Chen"

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_approval_status_persists(self, mock_extract, client):
        """Approval status change is retrievable on reload."""
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        cid = client.post(f"/api/conversations/{conv_id}/extract").json()["candidate_id"]

        client.patch(f"/api/candidates/{cid}/approval", json={"approval_status": "approved"})

        reloaded = client.get(f"/api/candidates/{cid}").json()
        assert reloaded["candidate"]["approval_status"] == "approved"

    @patch("app.services.extraction_service.extract_from_transcript")
    def test_second_extraction_reuses_candidate(self, mock_extract, client):
        """Re-extracting the same conversation yields the same candidate_id."""
        mock_extract.return_value = _extraction_result()

        conv_id = client.post("/api/conversations", json={"raw_text": SAMPLE_TRANSCRIPT}).json()["id"]
        cid1 = client.post(f"/api/conversations/{conv_id}/extract").json()["candidate_id"]

        mock_extract.return_value = _extraction_result()
        cid2 = client.post(f"/api/conversations/{conv_id}/extract").json()["candidate_id"]

        assert cid1 == cid2
