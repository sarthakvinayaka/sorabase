"""Tests for staffing extraction post-processing."""

from app.schemas.staffing_extraction import (
    STAFFING_EXTRACTION_FIELD_KEYS,
    StaffingExtractionFields,
    StaffingExtractionOutput,
    StaffingFieldBlock,
    TranscriptEvidence,
)
from app.services.extraction.staffing_extraction_post import apply_staffing_extraction_post_processing


def _minimal_block(null: bool = True) -> StaffingFieldBlock:
    if null:
        return StaffingFieldBlock(value=None, confidence=0.0, evidence=None, ambiguity_note=None)
    return StaffingFieldBlock(value=None, confidence=0.0, evidence=None, ambiguity_note=None)


def _all_null_fields() -> dict[str, StaffingFieldBlock]:
    return {k: _minimal_block() for k in STAFFING_EXTRACTION_FIELD_KEYS}


def test_post_process_clears_value_when_quote_not_in_transcript() -> None:
    fields = StaffingExtractionFields(**_all_null_fields())
    fields = fields.model_copy(
        update={
            "email": StaffingFieldBlock(
                value="x@y.com",
                confidence=0.99,
                evidence=TranscriptEvidence(quote="not in transcript", segment_index=None, start_ms=None, end_ms=None),
                ambiguity_note=None,
            ),
        },
    )
    output = StaffingExtractionOutput(
        fields=fields,
        missing_fields=["full_name"],
        ambiguous_fields=[],
        suggested_follow_up_questions=[],
        extraction_notes=None,
    )
    t = "Hello we discussed compensation only."
    fixed = apply_staffing_extraction_post_processing(output, transcript_text=t)
    assert fixed.fields.email.value is None
    assert "email" in fixed.missing_fields


def test_post_process_preserves_verified_quote_and_caps_confidence() -> None:
    t = "My email is jane@example.com for follow-ups."
    fields = StaffingExtractionFields(**_all_null_fields())
    fields = fields.model_copy(
        update={
            "email": StaffingFieldBlock(
                value="jane@example.com",
                confidence=0.99,
                evidence=TranscriptEvidence(quote="jane@example.com", segment_index=None, start_ms=None, end_ms=None),
                ambiguity_note=None,
            ),
        },
    )
    output = StaffingExtractionOutput(
        fields=fields,
        missing_fields=[k for k in STAFFING_EXTRACTION_FIELD_KEYS if k != "email"],
        ambiguous_fields=[],
        suggested_follow_up_questions=[],
        extraction_notes=None,
    )
    fixed = apply_staffing_extraction_post_processing(output, transcript_text=t)
    assert fixed.fields.email.value == "jane@example.com"
    assert fixed.fields.email.confidence <= 0.92
