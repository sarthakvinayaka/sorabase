"""
Deterministic post-processing applied to every LLM-extracted value.

The LLM returns typed values directly (list[str], int, float, bool, enum
string). This module handles format normalization and range enforcement for
fields where the LLM output needs a deterministic cleanup step.
"""

import re
from typing import Any


def normalize_email(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.strip().lower()
    if re.fullmatch(r"[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}", cleaned):
        return cleaned
    return None


def normalize_phone(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    if len(digits) == 11 and digits[0] == "1":
        return f"+1 ({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
    return value  # Return unchanged — recruiter will validate during review.


def normalize_years_experience(value: float | int | None) -> float | None:
    """Clamp to non-negative and round to one decimal place."""
    if value is None:
        return None
    return round(max(0.0, float(value)), 1)


def normalize_notice_period_days(value: int | None) -> int | None:
    """Clamp to non-negative integer days."""
    if value is None:
        return None
    return max(0, int(value))


def normalize_salary_bound(value: int | None) -> int | None:
    """Reject non-positive salary values as noise."""
    if value is None:
        return None
    v = int(value)
    return v if v > 0 else None


_FIELD_NORMALIZERS: dict[str, Any] = {
    "email": normalize_email,
    "phone": normalize_phone,
    "years_experience_years": normalize_years_experience,
    "notice_period_days": normalize_notice_period_days,
    "target_salary_min": normalize_salary_bound,
    "target_salary_max": normalize_salary_bound,
}


def normalize_field(field_name: str, raw_value: Any) -> Any:
    """
    Apply deterministic normalization to a single extracted value.

    Typed values (list, int, float, bool) pass through unless a specific
    normalizer is registered. String values are stripped; email and phone
    get format normalization.
    """
    if raw_value is None:
        return None

    normalizer = _FIELD_NORMALIZERS.get(field_name)
    if normalizer:
        return normalizer(raw_value)

    if isinstance(raw_value, str):
        return raw_value.strip() or None

    # Typed values (list, int, float, bool) pass through.
    return raw_value
