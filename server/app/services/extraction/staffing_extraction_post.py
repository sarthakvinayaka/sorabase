"""Deterministic post-processing after LLM or mock extraction (quote grounding, confidence caps)."""

from __future__ import annotations

from app.schemas.staffing_extraction import (
    STAFFING_EXTRACTION_FIELD_KEYS,
    StaffingExtractionOutput,
    StaffingFieldBlock,
)


def _quote_verified(transcript_text: str, quote: str | None) -> bool:
    if not quote or not quote.strip():
        return False
    return quote in transcript_text


def _blend_confidence(*, model_confidence: float, verified: bool, has_evidence: bool) -> float:
    """Combine model score with cheap structural signals (model score is not fully trusted)."""
    base = max(0.0, min(1.0, float(model_confidence)))
    if not verified:
        return round(min(base, 0.34), 5)
    if not has_evidence:
        return round(min(base, 0.45), 5)
    return round(min(base, 0.92), 5)


def apply_staffing_extraction_post_processing(
    output: StaffingExtractionOutput,
    *,
    transcript_text: str,
) -> StaffingExtractionOutput:
    """
    Enforce transcript grounding: non-null values must cite a verbatim substring of ``transcript_text``.
    Adjust confidence using evidence/quote checks; extend _blend_confidence for richer scoring later.
    """
    updates: dict[str, StaffingFieldBlock] = {}
    nulled_for_quote: set[str] = set()

    for key in STAFFING_EXTRACTION_FIELD_KEYS:
        block = getattr(output.fields, key)
        quote = block.evidence.quote if block.evidence else None
        verified = _quote_verified(transcript_text, quote)
        has_evidence = block.evidence is not None and bool(quote and quote.strip())

        if block.value is not None and not verified:
            note = block.ambiguity_note
            auto = "Automated check: no verbatim transcript quote matched this value; cleared."
            updates[key] = StaffingFieldBlock(
                value=None,
                confidence=0.0,
                evidence=None,
                ambiguity_note=f"{note}\n{auto}" if note else auto,
            )
            nulled_for_quote.add(key)
            continue

        if block.value is None:
            updates[key] = block
            continue

        new_conf = _blend_confidence(
            model_confidence=float(block.confidence),
            verified=verified,
            has_evidence=has_evidence,
        )
        updates[key] = StaffingFieldBlock(
            value=block.value,
            confidence=new_conf,
            evidence=block.evidence,
            ambiguity_note=block.ambiguity_note,
        )

    new_fields = output.fields.model_copy(update=updates)
    missing = sorted(set(output.missing_fields) | nulled_for_quote)
    ambiguous = [k for k in output.ambiguous_fields if k not in nulled_for_quote]

    return StaffingExtractionOutput(
        schema_version=output.schema_version,
        fields=new_fields,
        missing_fields=missing,
        ambiguous_fields=ambiguous,
        suggested_follow_up_questions=list(output.suggested_follow_up_questions),
        extraction_notes=output.extraction_notes,
    )
