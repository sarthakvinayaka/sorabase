"""UI grouping for staffing extraction fields (aligned with `STAFFING_EXTRACTION_FIELD_KEYS`)."""

from __future__ import annotations

from typing import Final

# Keys must match `app.schemas.staffing_extraction.STAFFING_EXTRACTION_FIELD_KEYS`.
STAFFING_FIELD_GROUPS: Final[dict[str, tuple[str, ...]]] = {
    "identity": (
        "full_name",
        "email",
        "phone",
        "current_location",
        "preferred_location",
        "work_authorization",
        "visa_status",
    ),
    "profile": (
        "willing_to_relocate",
        "remote_preference",
        "current_title",
        "years_experience",
        "primary_skills",
        "secondary_skills",
        "domain_experience",
        "industries_worked_in",
        "current_company",
        "previous_companies",
        "education",
        "certifications",
    ),
    "job_fit": (
        "target_roles",
        "target_rate_or_salary",
        "employment_type_preference",
        "availability_date",
        "notice_period",
        "interview_availability",
        "client_fit_summary",
    ),
    "workflow": (
        "recruiter_recommendation",
        "concerns_or_red_flags",
    ),
}

FIELD_TO_GROUP: Final[dict[str, str]] = {
    field: group for group, names in STAFFING_FIELD_GROUPS.items() for field in names
}


def group_for_field(field_name: str) -> str:
    return FIELD_TO_GROUP.get(field_name, "profile")
