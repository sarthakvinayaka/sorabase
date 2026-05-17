"""
Tests for the General Mode extraction service pipeline.

OpenAI is mocked — these tests verify orchestration logic, persistence, and
error paths, not LLM output quality.
Requires a running PostgreSQL database (see conftest.py).
"""

import uuid
from unittest.mock import patch

import pytest

from app.constants import GENERAL_MODE_TAG
from app.db.models import Candidate, Conversation, ExtractionRun, ExtractedField
from app.domain.general_extraction_schemas import ApprovedColumn
from app.services.general_extraction_client import GeneralExtractionError, GeneralExtractionResult
from app.services.general_extraction_service import (
    ConversationNotFoundError,
    ConversationTooLargeError,
    TranscriptNotReadyError,
    run_general_extraction,
)


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

def _columns() -> list[ApprovedColumn]:
    return [
        ApprovedColumn(name="topic",        description="Main topic",          type="text",   required=True),
        ApprovedColumn(name="action_items", description="Follow-up tasks",     type="list",   required=False),
        ApprovedColumn(name="budget",       description="Budget amount",        type="number", required=False),
    ]


def _extraction_result(
    *,
    topic_conf:  float = 0.92,
    budget_conf: float = 0.0,
) -> GeneralExtractionResult:
    topic_status  = "extracted" if topic_conf  > 0 else "missing"
    budget_status = "extracted" if budget_conf > 0 else "missing"
    return GeneralExtractionResult(
        fields={
            "topic": {
                "value":            "Q2 planning",
                "confidence":       topic_conf,
                "status":           topic_status,
                "evidence_snippet": "let's plan Q2",
            },
            "action_items": {
                "value":            ["Review proposal", "Schedule follow-up"],
                "confidence":       0.88,
                "status":           "extracted",
                "evidence_snippet": "let's review the proposal",
            },
            "budget": {
                "value":            None if budget_conf == 0.0 else 50_000.0,
                "confidence":       budget_conf,
                "status":           budget_status,
                "evidence_snippet": None if budget_conf == 0.0 else "fifty thousand",
            },
        },
        extracted_summary="Meeting discussed Q2 planning with action items.",
        missing_fields=[] if budget_conf > 0 else ["budget"],
        ambiguous_fields=[],
        prompt_tokens=800,
        completion_tokens=400,
        model_used="gpt-4o-2024-08-06",
    )


@pytest.fixture()
def conversation(db) -> Conversation:
    c = Conversation(
        source_type="transcript",
        status="raw",
        raw_text="Alice: let's plan Q2.\nBob: good idea.",
        char_count=40,
        transcript_status="ready",
    )
    db.add(c)
    db.flush()
    return c


# ---------------------------------------------------------------------------
# Error paths
# ---------------------------------------------------------------------------

class TestRunGeneralExtractionErrors:
    def test_raises_when_conversation_not_found(self, db):
        with pytest.raises(ConversationNotFoundError):
            run_general_extraction(db, uuid.uuid4(), _columns())

    def test_raises_when_transcript_not_ready(self, db):
        c = Conversation(
            source_type="audio", status="raw", raw_text=None,
            char_count=None, transcript_status="pending",
        )
        db.add(c)
        db.flush()
        with pytest.raises(TranscriptNotReadyError):
            run_general_extraction(db, c.id, _columns())

    def test_raises_when_conversation_too_large(self, db):
        from app.config import settings
        c = Conversation(
            source_type="transcript", status="raw",
            raw_text="x", char_count=settings.max_transcript_chars + 1,
            transcript_status="ready",
        )
        db.add(c)
        db.flush()
        with pytest.raises(ConversationTooLargeError):
            run_general_extraction(db, c.id, _columns())

    @patch("app.services.general_extraction_service.extract_general")
    def test_marks_conversation_failed_on_llm_error(self, mock_extract, db, conversation):
        mock_extract.side_effect = GeneralExtractionError("OpenAI timeout")

        with pytest.raises(GeneralExtractionError):
            run_general_extraction(db, conversation.id, _columns())

        db.refresh(conversation)
        assert conversation.status == "failed"


# ---------------------------------------------------------------------------
# Happy path — return values
# ---------------------------------------------------------------------------

class TestRunGeneralExtractionHappyPath:
    @patch("app.services.general_extraction_service.extract_general")
    def test_returns_candidate_and_extraction_run(self, mock_extract, db, conversation):
        mock_extract.return_value = _extraction_result()
        candidate, run = run_general_extraction(db, conversation.id, _columns())

        assert isinstance(candidate, Candidate)
        assert isinstance(run, ExtractionRun)

    @patch("app.services.general_extraction_service.extract_general")
    def test_extraction_run_tagged_as_general_mode(self, mock_extract, db, conversation):
        mock_extract.return_value = _extraction_result()
        _, run = run_general_extraction(db, conversation.id, _columns())

        assert run.template_id == GENERAL_MODE_TAG
        assert run.status == "completed"

    @patch("app.services.general_extraction_service.extract_general")
    def test_template_id_overrides_general_tag(self, mock_extract, db, conversation):
        mock_extract.return_value = _extraction_result()
        tid = str(uuid.uuid4())
        _, run = run_general_extraction(
            db, conversation.id, _columns(), template_id=tid, template_version=3,
        )

        assert run.template_id == tid
        assert (run.raw_response or {}).get("template_version") == 3

    @patch("app.services.general_extraction_service.extract_general")
    def test_raw_response_stores_field_order(self, mock_extract, db, conversation):
        mock_extract.return_value = _extraction_result()
        _, run = run_general_extraction(db, conversation.id, _columns())

        raw = run.raw_response or {}
        assert "fields" in raw
        assert list(raw["fields"].keys()) == ["topic", "action_items", "budget"]


# ---------------------------------------------------------------------------
# Field persistence
# ---------------------------------------------------------------------------

class TestFieldPersistence:
    @patch("app.services.general_extraction_service.extract_general")
    def test_one_row_per_column(self, mock_extract, db, conversation):
        mock_extract.return_value = _extraction_result()
        _, run = run_general_extraction(db, conversation.id, _columns())

        fields = db.query(ExtractedField).filter_by(extraction_run_id=run.id).all()
        assert len(fields) == 3
        assert {f.field_name for f in fields} == {"topic", "action_items", "budget"}

    @patch("app.services.general_extraction_service.extract_general")
    def test_low_confidence_missing_field_still_stored(self, mock_extract, db, conversation):
        """A field the LLM couldn't find (confidence=0, status=missing) must still
        produce a row so the schema is complete."""
        mock_extract.return_value = _extraction_result(budget_conf=0.0)
        _, run = run_general_extraction(db, conversation.id, _columns())

        budget = (
            db.query(ExtractedField)
            .filter_by(extraction_run_id=run.id, field_name="budget")
            .first()
        )
        assert budget is not None
        assert budget.status == "missing"
        assert budget.confidence == 0.0
        assert budget.raw_value is None

    @patch("app.services.general_extraction_service.extract_general")
    def test_extracted_field_has_evidence(self, mock_extract, db, conversation):
        mock_extract.return_value = _extraction_result()
        _, run = run_general_extraction(db, conversation.id, _columns())

        topic = (
            db.query(ExtractedField)
            .filter_by(extraction_run_id=run.id, field_name="topic")
            .first()
        )
        assert topic is not None
        assert topic.evidence_snippet == "let's plan Q2"
        assert topic.confidence == pytest.approx(0.92)


# ---------------------------------------------------------------------------
# Confidence computation
# ---------------------------------------------------------------------------

class TestOverallConfidence:
    @patch("app.services.general_extraction_service.extract_general")
    def test_overall_confidence_excludes_missing_fields(self, mock_extract, db, conversation):
        """Missing fields (confidence=0, status=missing) must NOT pull down the average."""
        # topic=0.92, action_items=0.88, budget=missing(0.0) → avg of extracted = 0.9
        mock_extract.return_value = _extraction_result(topic_conf=0.92, budget_conf=0.0)
        _, run = run_general_extraction(db, conversation.id, _columns())

        assert run.overall_confidence is not None
        assert abs(run.overall_confidence - 0.9) < 0.01

    @patch("app.services.general_extraction_service.extract_general")
    def test_overall_confidence_zero_when_all_missing(self, mock_extract, db, conversation):
        result = GeneralExtractionResult(
            fields={
                col.name: {"value": None, "confidence": 0.0, "status": "missing", "evidence_snippet": None}
                for col in _columns()
            },
            extracted_summary="",
            missing_fields=[c.name for c in _columns()],
            ambiguous_fields=[],
            prompt_tokens=100,
            completion_tokens=50,
            model_used="gpt-4o-2024-08-06",
        )
        mock_extract.return_value = result
        _, run = run_general_extraction(db, conversation.id, _columns())

        assert run.overall_confidence == 0.0


# ---------------------------------------------------------------------------
# Post-extraction state
# ---------------------------------------------------------------------------

class TestPostExtractionState:
    @patch("app.services.general_extraction_service.extract_general")
    def test_conversation_status_set_to_extracted(self, mock_extract, db, conversation):
        mock_extract.return_value = _extraction_result()
        run_general_extraction(db, conversation.id, _columns())

        db.refresh(conversation)
        assert conversation.status == "extracted"

    @patch("app.services.general_extraction_service.extract_general")
    def test_candidate_latest_extraction_run_updated(self, mock_extract, db, conversation):
        mock_extract.return_value = _extraction_result()
        candidate, run = run_general_extraction(db, conversation.id, _columns())

        assert candidate.latest_extraction_run_id == run.id

    @patch("app.services.general_extraction_service.extract_general")
    def test_idempotent_candidate_creation(self, mock_extract, db, conversation):
        """Re-extracting the same conversation reuses the existing candidate."""
        mock_extract.return_value = _extraction_result()
        candidate1, _ = run_general_extraction(db, conversation.id, _columns())
        mock_extract.return_value = _extraction_result()
        candidate2, _ = run_general_extraction(db, conversation.id, _columns())

        assert candidate1.id == candidate2.id
