"""Rules-based recruiter summary + submittal draft (no LLM; only states approved structured data)."""

from __future__ import annotations

import re
from typing import Any

TRANSCRIPT_EXCERPT_MAX = 1600
GENERATOR_PROVIDER_ID = "mock-rules-v1"


def _fmt(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, bool):
        return "yes" if v else "no"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        return ", ".join(str(x).strip() for x in v if str(x).strip())
    return str(v).strip()


def _line(label: str, structured: dict[str, Any], key: str) -> str | None:
    if key not in structured:
        return None
    val = _fmt(structured.get(key))
    if not val:
        return None
    return f"- {label}: {val}"


def _section(title: str, lines: list[str]) -> str:
    body = [ln for ln in lines if ln]
    if not body:
        return ""
    return f"{title}\n" + "\n".join(body)


def _excerpt_transcript(full_text: str) -> tuple[str, bool]:
    t = (full_text or "").strip()
    if not t:
        return "", False
    excerpt = t[:TRANSCRIPT_EXCERPT_MAX]
    if len(t) > TRANSCRIPT_EXCERPT_MAX:
        excerpt = excerpt.rstrip() + "…"
    excerpt = re.sub(r"\s+", " ", excerpt)
    return excerpt, True


def generate_rules_narrative(
    *,
    payload: dict[str, Any],
    transcript_full_text: str,
) -> tuple[str, str, dict[str, Any]]:
    """
    Build concise recruiter-facing strings from approved export payload + transcript excerpt.

    Does not invent values: only labels/values present in `structured_fields` and a verbatim transcript excerpt.
    """
    structured: dict[str, Any] = dict(payload.get("structured_fields") or {})
    excerpt, had_excerpt = _excerpt_transcript(transcript_full_text)

    overview = [
        _line("Name", structured, "full_name"),
        _line("Current title", structured, "current_title"),
        _line("Location", structured, "current_location"),
        _line("Preferred location", structured, "preferred_location"),
        _line("Remote preference", structured, "remote_preference"),
        _line("Work authorization", structured, "work_authorization"),
        _line("Visa status", structured, "visa_status"),
    ]

    strengths = [
        _line("Years experience", structured, "years_experience"),
        _line("Primary skills", structured, "primary_skills"),
        _line("Secondary skills", structured, "secondary_skills"),
        _line("Domain experience", structured, "domain_experience"),
        _line("Industries", structured, "industries_worked_in"),
        _line("Current company", structured, "current_company"),
        _line("Previous companies", structured, "previous_companies"),
        _line("Education", structured, "education"),
        _line("Certifications", structured, "certifications"),
    ]

    fit = [
        _line("Target roles", structured, "target_roles"),
        _line("Client fit", structured, "client_fit_summary"),
        _line("Recruiter recommendation", structured, "recruiter_recommendation"),
    ]

    comp_avail = [
        _line("Target rate / salary", structured, "target_rate_or_salary"),
        _line("Employment preference", structured, "employment_type_preference"),
        _line("Availability", structured, "availability_date"),
        _line("Notice period", structured, "notice_period"),
        _line("Interview availability", structured, "interview_availability"),
    ]

    concerns_line = _line("Concerns or red flags", structured, "concerns_or_red_flags")

    contact = [_line("Email", structured, "email"), _line("Phone", structured, "phone")]

    sections_out: list[str] = []
    for title, lines in (
        ("CANDIDATE OVERVIEW", overview),
        ("CONTACT (VERIFIED STRUCTURED)", contact),
        ("STRENGTHS & EXPERIENCE", strengths),
        ("FIT & TARGETING", fit),
        ("COMPENSATION & AVAILABILITY", comp_avail),
    ):
        block = _section(title, [ln for ln in lines if ln])
        if block:
            sections_out.append(block)

    if concerns_line:
        sections_out.append(_section("OPEN ITEMS / RISKS (VERIFIED)", [concerns_line]))

    if had_excerpt and excerpt:
        sections_out.append(
            "TRANSCRIPT (VERBATIM EXCERPT)\n"
            f"- Excerpt ({len(excerpt)} chars shown; full transcript on file):\n"
            f"  {excerpt}\n"
            "- This excerpt is not interpreted here; use it only as conversational context.",
        )

    if not sections_out:
        sections_out.append(
            "INSUFFICIENT VERIFIED STRUCTURED DATA\n"
            "- No populated approved fields were available for narrative generation.\n"
            "- Approve structured extraction or regenerate after fields are completed.",
        )

    summary = "\n\n".join(sections_out).strip()

    display_name = _fmt(structured.get("full_name")) or "This candidate"
    opening = f"Submittal draft — {display_name}"

    paras: list[str] = [opening, ""]
    if _fmt(structured.get("target_roles")) or _fmt(structured.get("current_title")):
        role_bits = [x for x in (_fmt(structured.get("current_title")), _fmt(structured.get("target_roles"))) if x]
        paras.append("Role focus: " + " · ".join(role_bits) + ".")

    fit_bits = [x for x in (_fmt(structured.get("client_fit_summary")), _fmt(structured.get("recruiter_recommendation"))) if x]
    if fit_bits:
        paras.append("Fit notes (from verified profile): " + " ".join(fit_bits))

    sk = _fmt(structured.get("primary_skills"))
    if sk:
        paras.append(f"Core strengths (verified): {sk}.")

    comp = _fmt(structured.get("target_rate_or_salary"))
    av = " · ".join(
        x
        for x in (
            _fmt(structured.get("availability_date")),
            _fmt(structured.get("notice_period")),
            _fmt(structured.get("employment_type_preference")),
        )
        if x
    )
    if comp or av:
        paras.append("Compensation / availability (verified): " + " | ".join(x for x in (comp, av) if x) + ".")

    c_val = _fmt(structured.get("concerns_or_red_flags"))
    if c_val:
        paras.append("Open items to align on: " + c_val + ".")

    if had_excerpt and excerpt:
        paras.append(
            "Transcript: a verbatim excerpt is included in the internal recruiter summary only; "
            "do not quote it externally without candidate consent.",
        )

    paras.append(
        "—\n"
        "This text is auto-generated from approved structured fields (and optional transcript excerpt). "
        "It is not a substitute for the verified profile or compliance review.",
    )

    submittal = "\n\n".join(p for p in paras if p).strip()

    meta = {
        "generator": GENERATOR_PROVIDER_ID,
        "structured_field_count": len([k for k, v in structured.items() if _fmt(v)]),
        "transcript_chars_total": len((transcript_full_text or "").strip()),
        "transcript_excerpt_included": had_excerpt,
        "transcript_excerpt_chars": len(excerpt) if had_excerpt else 0,
    }
    return summary, submittal, meta
