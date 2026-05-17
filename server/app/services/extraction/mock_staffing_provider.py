"""
Heuristic transcript parsing for local/dev — simulates grounded extraction without an LLM.

Replace with `StaffingExtractionProvider` backed by structured-output LLM calls that:
load `prompts/staffing/extraction.md`, attach `StaffingExtractionOutput` JSON schema, and validate responses.
"""

from __future__ import annotations

import re
from typing import Any

from app.schemas.staffing_extraction import (
    STAFFING_EXTRACTION_FIELD_KEYS,
    StaffingExtractionFields,
    StaffingExtractionOutput,
    StaffingFieldBlock,
    TranscriptEvidence,
)


def _null() -> StaffingFieldBlock:
    return StaffingFieldBlock(value=None, confidence=0.0, evidence=None, ambiguity_note=None)


def _block(
    *,
    value: Any,
    confidence: float,
    quote: str | None,
    segments: list[tuple[int, int, int, str, str]] | None,
    ambiguity_note: str | None = None,
) -> StaffingFieldBlock:
    ev: TranscriptEvidence | None = None
    if quote and quote.strip():
        ev = _evidence(quote.strip(), segments)
    return StaffingFieldBlock(value=value, confidence=confidence, evidence=ev, ambiguity_note=ambiguity_note)


def _evidence(quote: str, segments: list[tuple[int, int, int, str, str]] | None) -> TranscriptEvidence:
    if not segments:
        return TranscriptEvidence(quote=quote, segment_index=None, start_ms=None, end_ms=None)
    for seq, sm, em, _sp, st in segments:
        if quote in st:
            return TranscriptEvidence(quote=quote, segment_index=seq, start_ms=sm, end_ms=em)
    return TranscriptEvidence(quote=quote, segment_index=None, start_ms=None, end_ms=None)


_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE = re.compile(r"\b(?:\+?1[-.\s]?)?(?:\(\s*\d{3}\s*\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b")
_YEARS = re.compile(r"\b(\d{1,2})\+?\s*years?\b", re.I)
_MONEY = re.compile(r"\$?\d{2,3}(?:,\d{3})*(?:\.\d+)?(?:k|K)?|\b\d{3}\s*base\b", re.I)


class MockStaffingExtractionProvider:
    """Returns `StaffingExtractionOutput` using regex + keyword heuristics over transcript text."""

    @property
    def provider_id(self) -> str:
        return "mock-staffing-extraction"

    def extract_staffing_profile(
        self,
        *,
        transcript_text: str,
        segments: list[tuple[int, int, int, str, str]] | None = None,
    ) -> StaffingExtractionOutput:
        text = transcript_text.strip()
        low = text.lower()

        fields: dict[str, StaffingFieldBlock] = {k: _null() for k in STAFFING_EXTRACTION_FIELD_KEYS}

        m_email = _EMAIL.search(text)
        if m_email:
            q = m_email.group(0)
            fields["email"] = _block(value=q, confidence=0.95, quote=q, segments=segments)

        m_phone = _PHONE.search(text)
        if m_phone:
            q = m_phone.group(0)
            fields["phone"] = _block(value=q, confidence=0.75, quote=q, segments=segments)

        if "us citizen" in low:
            idx = low.find("us citizen")
            quote = text[idx : idx + len("US citizen")]
            fields["work_authorization"] = _block(
                value="US citizen",
                confidence=0.9,
                quote=quote,
                segments=segments,
            )

        if "hybrid" in low:
            start = low.find("hybrid")
            quote = text[start : start + 80]
            fields["remote_preference"] = _block(
                value="hybrid",
                confidence=0.65,
                quote=quote.strip(),
                segments=segments,
                ambiguity_note="Transcript mentions hybrid; confirm exact onsite cadence with the candidate.",
            )

        if "remote" in low and fields["remote_preference"].value is None:
            start = low.find("remote")
            quote = text[start : min(len(text), start + 120)]
            fields["remote_preference"] = _block(
                value="remote",
                confidence=0.55,
                quote=quote.strip(),
                segments=segments,
                ambiguity_note="Remote mentioned; clarify full-time remote vs hybrid.",
            )

        m_years = _YEARS.search(text)
        if m_years:
            q = m_years.group(0)
            try:
                y = int(m_years.group(1))
            except ValueError:
                y = None
            if y is not None:
                fields["years_experience"] = _block(
                    value=y,
                    confidence=0.55,
                    quote=q,
                    segments=segments,
                    ambiguity_note="Years inferred from phrasing; confirm total relevant experience.",
                )

        m_money = list(_MONEY.finditer(text))
        if m_money:
            q = m_money[0].group(0)
            amb = None
            if len(m_money) > 1:
                q2 = m_money[1].group(0)
                amb = f"Multiple comp signals ({q!r} vs {q2!r}); confirm which is current ask."
            fields["target_rate_or_salary"] = _block(
                value=q.replace("$", "").strip(),
                confidence=0.45 if amb else 0.6,
                quote=q,
                segments=segments,
                ambiguity_note=amb
                or (
                    "Compensation snippet found; confirm currency, base vs total, and client-facing range."
                    if len(m_money) == 1
                    else None
                ),
            )

        if "rn" in low or "nurse" in low:
            snippet = next(
                (line for line in text.splitlines() if "nurse" in line.lower() or "rn" in line.lower()),
                text[:200],
            )
            fields["current_title"] = _block(
                value="Registered Nurse" if "rn" in low else "Nurse",
                confidence=0.5,
                quote=snippet[:400],
                segments=segments,
                ambiguity_note="Role inferred from keywords; confirm official title and specialty.",
            )

        if "sap" in low:
            line = next((ln for ln in text.splitlines() if "sap" in ln.lower()), "")
            skills = [s.strip() for s in re.split(r"[,;/]", line) if s.strip() and len(s.strip()) < 80]
            if not skills:
                skills = ["SAP"]
            fields["primary_skills"] = _block(
                value=skills[:12],
                confidence=0.55,
                quote=line[:500] or text[:300],
                segments=segments,
                ambiguity_note="Skills parsed from a single line; validate depth and versions.",
            )

        if "infusion" in low or "outpatient" in low:
            dom = "Infusion / outpatient" if "infusion" in low else "Outpatient"
            quote = next((ln for ln in text.splitlines() if "infusion" in ln.lower() or "outpatient" in ln.lower()), text[:240])
            fields["domain_experience"] = _block(value=dom, confidence=0.5, quote=quote[:500], segments=segments)

        if "compact" in low and "license" in low:
            quote = next((ln for ln in text.splitlines() if "compact" in ln.lower()), text[:200])
            fields["certifications"] = _block(
                value=["Compact nursing license"],
                confidence=0.65,
                quote=quote[:500],
                segments=segments,
            )

        if "two weeks" in low and "notice" in low:
            quote = next((ln for ln in text.splitlines() if "notice" in ln.lower()), "two weeks notice")
            fields["notice_period"] = _block(value="two weeks", confidence=0.7, quote=quote[:500], segments=segments)

        if "chicago" in low or "illinois" in low:
            loc = []
            if "chicago" in low:
                loc.append("Chicago, IL")
            if "illinois" in low and "chicago" not in low:
                loc.append("Illinois")
            fields["current_location"] = _block(
                value=", ".join(loc) if loc else None,
                confidence=0.55,
                quote=next((ln for ln in text.splitlines() if "chicago" in ln.lower() or "illinois" in ln.lower()), text[:200])[
                    :500
                ],
                segments=segments,
            )

        if "phoenix" in low:
            fields["preferred_location"] = _block(
                value="Phoenix, AZ area",
                confidence=0.5,
                quote=next((ln for ln in text.splitlines() if "phoenix" in ln.lower()), text[:200])[:500],
                segments=segments,
            )

        if "13-week" in low or "13 week" in low:
            fields["employment_type_preference"] = _block(
                value="Contract (travel)",
                confidence=0.45,
                quote=next((ln for ln in text.splitlines() if "13" in ln), text[:200])[:500],
                segments=segments,
                ambiguity_note="Assignment length referenced; confirm W2 vs 1099 and agency relationship.",
            )

        # Narrative fields: only populate when we can lean on obvious positive/negative cues (still quote-backed).
        if "no flags" in low:
            q = next((ln for ln in text.splitlines() if "no flags" in ln.lower()), "no flags")
            fields["concerns_or_red_flags"] = _block(
                value="Candidate stated no facility discipline flags in transcript; verify with references and compliance.",
                confidence=0.4,
                quote=q[:500],
                segments=segments,
                ambiguity_note="Self-reported only — not a substitute for compliance checks.",
            )

        structured = StaffingExtractionFields(**fields)

        missing = [k for k in STAFFING_EXTRACTION_FIELD_KEYS if getattr(structured, k).value is None]

        ambiguous = [
            k
            for k in STAFFING_EXTRACTION_FIELD_KEYS
            if getattr(structured, k).ambiguity_note or (0.35 <= getattr(structured, k).confidence < 0.65 and getattr(structured, k).value is not None)
        ]

        questions: list[str] = []
        if "full_name" in missing:
            questions.append("What name should we use on the client-facing submittal (legal vs preferred)?")
        if "email" in missing:
            questions.append("What is the best email for scheduling and written follow-ups?")
        if "work_authorization" in missing:
            questions.append("Can you confirm work authorization and any sponsorship needs for this requisition?")
        if "target_rate_or_salary" in missing:
            questions.append("What is your current compensation and target range (base vs all-in) for this search?")
        if "availability_date" in missing or "notice_period" in missing:
            questions.append("What is your earliest realistic start date, including notice and any planned time off?")
        if "interview_availability" in missing:
            questions.append("What interview windows work over the next two weeks (time zone and format)?")
        if "client_fit_summary" in missing:
            questions.append("In two sentences, what type of team or tech environment are you optimizing for in this move?")
        questions = questions[:12]

        notes = (
            "Mock extraction: heuristic only. Replace with LLM + `StaffingExtractionOutput` validation for production. "
            "Do not use mock confidence scores for automated client decisions."
        )

        return StaffingExtractionOutput(
            fields=structured,
            missing_fields=missing,
            ambiguous_fields=ambiguous,
            suggested_follow_up_questions=questions,
            extraction_notes=notes,
        )
