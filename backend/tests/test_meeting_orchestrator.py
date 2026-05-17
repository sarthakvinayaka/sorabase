"""
Tests for meeting_orchestrator.run_post_transcript().

Verifies mode-specific branching without touching the DB or running real
extraction — extraction_service.run_extraction is patched throughout.
"""

import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.services.meeting_orchestrator import OrchestrationResult, run_post_transcript


@pytest.fixture()
def mock_db():
    return MagicMock()


@pytest.fixture()
def conversation_id():
    return uuid.uuid4()


@pytest.fixture()
def candidate_id():
    return uuid.uuid4()


# ---------------------------------------------------------------------------
# General mode — always stops at ready, no extraction
# ---------------------------------------------------------------------------

def test_general_mode_returns_ready_for_schema_review(mock_db, conversation_id):
    result = run_post_transcript(mock_db, conversation_id, mode="general")

    assert result.mode == "general"
    assert result.action == "ready_for_schema_review"
    assert result.candidate_id is None
    assert result.error is None


def test_general_mode_never_calls_extraction(mock_db, conversation_id):
    with patch("app.services.meeting_orchestrator.extraction_service") as mock_svc:
        run_post_transcript(mock_db, conversation_id, mode="general")
        mock_svc.run_extraction.assert_not_called()


# ---------------------------------------------------------------------------
# Recruiting mode + auto_run=True — runs extraction
# ---------------------------------------------------------------------------

def test_recruiting_mode_auto_run_true_runs_extraction(mock_db, conversation_id, candidate_id):
    mock_candidate = MagicMock()
    mock_candidate.id = candidate_id

    with patch(
        "app.services.meeting_orchestrator.extraction_service.run_extraction",
        return_value=(mock_candidate, MagicMock()),
    ):
        result = run_post_transcript(mock_db, conversation_id, mode="recruiting", auto_run=True)

    assert result.mode == "recruiting"
    assert result.action == "extraction_complete"
    assert result.candidate_id == candidate_id
    assert result.error is None


# ---------------------------------------------------------------------------
# Recruiting mode + auto_run=False — skips extraction
# ---------------------------------------------------------------------------

def test_recruiting_mode_auto_run_false_skips_extraction(mock_db, conversation_id):
    with patch("app.services.meeting_orchestrator.extraction_service") as mock_svc:
        result = run_post_transcript(mock_db, conversation_id, mode="recruiting", auto_run=False)
        mock_svc.run_extraction.assert_not_called()

    assert result.mode == "recruiting"
    assert result.action == "skipped"
    assert result.candidate_id is None


# ---------------------------------------------------------------------------
# Recruiting mode extraction failure — returns failed result
# ---------------------------------------------------------------------------

def test_recruiting_mode_extraction_failure_returns_error(mock_db, conversation_id):
    with patch(
        "app.services.meeting_orchestrator.extraction_service.run_extraction",
        side_effect=RuntimeError("LLM timeout"),
    ):
        result = run_post_transcript(mock_db, conversation_id, mode="recruiting", auto_run=True)

    assert result.action == "failed"
    assert result.error is not None
    assert "LLM timeout" in result.error
    assert result.candidate_id is None
