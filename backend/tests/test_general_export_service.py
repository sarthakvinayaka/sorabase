"""
Tests for general_export_service: build_general_export() and render_csv().

Uses a real database with DB objects constructed inline.
"""

import uuid
from datetime import datetime, timezone

import pytest

from app.config import settings
from app.constants import GENERAL_MODE_TAG
from app.db.models import Candidate, Conversation, ExtractionRun, ExtractedField
from app.domain.general_export_schemas import GeneralExport
from app.services.general_export_service import build_general_export, render_csv


# ---------------------------------------------------------------------------
# DB fixture helpers
# ---------------------------------------------------------------------------

def _make_conversation(db) -> Conversation:
    c = Conversation(
        source_type="transcript",
        status="extracted",
        raw_text="Alice: Let's plan Q2.\nBob: Budget is 50k.",
        char_count=45,
        transcript_status="ready",
    )
    db.add(c)
    db.flush()
    return c


def _make_candidate(db) -> Candidate:
    c = Candidate(org_id=uuid.UUID(settings.default_org_id))
    db.add(c)
    db.flush()
    return c


def _make_extraction_run(
    db,
    conversation_id: uuid.UUID,
    candidate_id: uuid.UUID,
    *,
    template_id: str = GENERAL_MODE_TAG,
    template_version: int | None = None,
    summary: str = "Meeting covered Q2 planning.",
) -> ExtractionRun:
    run = ExtractionRun(
        org_id=uuid.UUID(settings.default_org_id),
        conversation_id=conversation_id,
        candidate_id=candidate_id,
        template_id=template_id,
        missing_fields=["budget"],
        ambiguous_fields=[],
        suggested_follow_up_questions=[],
        candidate_summary=summary,
        overall_confidence=0.88,
        model_used="gpt-4o-2024-08-06",
        status="completed",
        raw_response={
            "fields": {
                "topic":        {"value": "Q2 planning", "confidence": 0.92, "status": "extracted", "evidence_snippet": "plan Q2"},
                "action_items": {"value": ["Review", "Schedule"], "confidence": 0.85, "status": "extracted", "evidence_snippet": "let's review"},
                "budget":       {"value": None, "confidence": 0.0, "status": "missing", "evidence_snippet": None},
                "approved":     {"value": True, "confidence": 0.9, "status": "extracted", "evidence_snippet": "approved"},
            },
            "summary": summary,
            "template_id": template_id,
            "template_version": template_version,
        },
    )
    db.add(run)
    db.flush()
    return run


def _make_field(
    db,
    extraction_run_id: uuid.UUID,
    *,
    name: str,
    raw_value=None,
    normalized_value=None,
    reviewed_value=None,
    confidence: float = 0.9,
    status: str = "extracted",
    edited: bool = False,
    evidence_snippet: str | None = None,
) -> ExtractedField:
    f = ExtractedField(
        org_id=uuid.UUID(settings.default_org_id),
        extraction_run_id=extraction_run_id,
        field_name=name,
        raw_value=raw_value,
        normalized_value=normalized_value,
        reviewed_value=reviewed_value,
        evidence_snippet=evidence_snippet,
        confidence=confidence,
        status=status,
        edited=edited,
    )
    db.add(f)
    db.flush()
    return f


@pytest.fixture()
def session_data(db):
    """Returns (Candidate, ExtractionRun) wired together with four fields."""
    conv = _make_conversation(db)
    cand = _make_candidate(db)

    run = _make_extraction_run(db, conv.id, cand.id)

    _make_field(db, run.id, name="topic",        raw_value="Q2 planning", normalized_value="Q2 planning",  confidence=0.92)
    _make_field(db, run.id, name="action_items", raw_value=["Review", "Schedule"], normalized_value=["Review", "Schedule"], confidence=0.85)
    _make_field(db, run.id, name="budget",       raw_value=None, normalized_value=None, confidence=0.0, status="missing")
    _make_field(db, run.id, name="approved",     raw_value=True, normalized_value=True, confidence=0.9)

    cand.latest_extraction_run_id = run.id
    conv.candidate_id = cand.id
    db.flush()

    return cand, run


# ---------------------------------------------------------------------------
# build_general_export
# ---------------------------------------------------------------------------

class TestBuildGeneralExport:
    def test_returns_none_for_unknown_candidate(self, db):
        assert build_general_export(db, uuid.uuid4()) is None

    def test_returns_export_payload(self, db, session_data):
        cand, _ = session_data
        export = build_general_export(db, cand.id)

        assert export is not None
        assert isinstance(export, GeneralExport)
        assert export.candidate_id == cand.id

    def test_column_order_matches_raw_response(self, db, session_data):
        """Column order must follow raw_response["fields"].keys(), not DB sort order."""
        cand, _ = session_data
        export = build_general_export(db, cand.id)

        assert export is not None
        assert list(export.fields.keys()) == ["topic", "action_items", "budget", "approved"]

    def test_effective_value_precedence_reviewed_over_normalized(self, db):
        """reviewed_value (human edit) takes precedence over normalized_value."""
        conv = _make_conversation(db)
        cand = _make_candidate(db)
        run  = _make_extraction_run(db, conv.id, cand.id)

        _make_field(
            db, run.id, name="topic",
            raw_value="original",
            normalized_value="normalised",
            reviewed_value="human edited",
            edited=True, confidence=0.92,
        )
        cand.latest_extraction_run_id = run.id
        conv.candidate_id = cand.id
        db.flush()

        export = build_general_export(db, cand.id)
        assert export is not None
        assert export.fields["topic"].value == "human edited"
        assert export.fields["topic"].source == "human_edited"

    def test_effective_value_falls_back_to_normalized(self, db):
        conv = _make_conversation(db)
        cand = _make_candidate(db)
        run  = _make_extraction_run(db, conv.id, cand.id)

        _make_field(
            db, run.id, name="topic",
            raw_value="original",
            normalized_value="normalised",
            reviewed_value=None,
            edited=False, confidence=0.92,
        )
        cand.latest_extraction_run_id = run.id
        conv.candidate_id = cand.id
        db.flush()

        export = build_general_export(db, cand.id)
        assert export is not None
        assert export.fields["topic"].value == "normalised"
        assert export.fields["topic"].source == "ai_extracted"

    def test_effective_value_falls_back_to_raw(self, db):
        conv = _make_conversation(db)
        cand = _make_candidate(db)
        run  = _make_extraction_run(db, conv.id, cand.id)

        _make_field(
            db, run.id, name="topic",
            raw_value="raw only",
            normalized_value=None,
            reviewed_value=None,
            edited=False, confidence=0.70,
        )
        cand.latest_extraction_run_id = run.id
        conv.candidate_id = cand.id
        db.flush()

        export = build_general_export(db, cand.id)
        assert export is not None
        assert export.fields["topic"].value == "raw only"

    def test_transcript_excluded_by_default(self, db, session_data):
        cand, _ = session_data
        export = build_general_export(db, cand.id, include_transcript=False)

        assert export is not None
        assert export.transcript is None

    def test_transcript_included_when_requested(self, db, session_data):
        cand, _ = session_data
        export = build_general_export(db, cand.id, include_transcript=True)

        assert export is not None
        assert export.transcript is not None
        assert "Alice" in export.transcript

    def test_template_id_none_for_untemplate_session(self, db, session_data):
        """Sessions not from a saved template should have template_id=None in export."""
        cand, _ = session_data
        export = build_general_export(db, cand.id)

        assert export is not None
        assert export.template_id is None

    def test_template_id_present_for_templated_session(self, db):
        conv = _make_conversation(db)
        cand = _make_candidate(db)
        tid  = str(uuid.uuid4())
        run  = _make_extraction_run(db, conv.id, cand.id, template_id=tid, template_version=2)

        _make_field(db, run.id, name="topic", raw_value="test", normalized_value="test", confidence=0.9)
        cand.latest_extraction_run_id = run.id
        conv.candidate_id = cand.id
        db.flush()

        export = build_general_export(db, cand.id)
        assert export is not None
        assert export.template_id == tid
        assert export.template_version == 2


# ---------------------------------------------------------------------------
# render_csv
# ---------------------------------------------------------------------------

class TestRenderCsv:
    def _simple_export(self) -> GeneralExport:
        from app.domain.general_export_schemas import GeneralExportField
        return GeneralExport(
            exported_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
            candidate_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            conversation_id=uuid.UUID("00000000-0000-0000-0000-000000000002"),
            summary="A test meeting.",
            missing_fields=["budget"],
            ambiguous_fields=[],
            template_id=None,
            template_version=None,
            fields={
                "topic":        GeneralExportField(value="Q2 planning", source="ai_extracted",  confidence=0.92, evidence_snippet=None, status="extracted"),
                "action_items": GeneralExportField(value=["Review", "Schedule"], source="ai_extracted", confidence=0.85, evidence_snippet=None, status="extracted"),
                "approved":     GeneralExportField(value=True,          source="human_edited",  confidence=0.9,  evidence_snippet=None, status="reviewed"),
                "budget":       GeneralExportField(value=None,          source="ai_extracted",  confidence=0.0,  evidence_snippet=None, status="missing"),
            },
        )

    def test_csv_has_header_and_data_row(self):
        csv_text = render_csv(self._simple_export())
        lines = [l for l in csv_text.splitlines() if l]
        assert len(lines) == 2

    def test_csv_header_contains_all_fields(self):
        csv_text = render_csv(self._simple_export())
        header = csv_text.splitlines()[0]
        for col in ["candidate_id", "exported_at", "summary", "missing_fields",
                    "topic", "action_items", "approved", "budget"]:
            assert col in header

    def test_list_value_flattened_to_semicolons(self):
        csv_text = render_csv(self._simple_export())
        assert "Review; Schedule" in csv_text

    def test_boolean_rendered_as_yes_no(self):
        csv_text = render_csv(self._simple_export())
        assert "Yes" in csv_text

    def test_none_value_rendered_as_empty_string(self):
        csv_text = render_csv(self._simple_export())
        # budget is None — should not appear as "None"
        assert "None" not in csv_text

    def test_transcript_column_added_when_present(self):
        from app.domain.general_export_schemas import GeneralExportField
        export = self._simple_export()
        export = export.model_copy(update={"transcript": "Alice: Hello.\nBob: Hi."})
        csv_text = render_csv(export)
        assert "transcript" in csv_text.splitlines()[0]
        assert "Alice: Hello" in csv_text

    def test_missing_fields_semicolon_joined(self):
        from app.domain.general_export_schemas import GeneralExportField
        export = self._simple_export()
        export = export.model_copy(update={"missing_fields": ["budget", "timeline"]})
        csv_text = render_csv(export)
        assert "budget; timeline" in csv_text
