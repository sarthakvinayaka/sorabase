"""
LLM-facing schemas: structured output models used exclusively with OpenAI
Structured Outputs. Never returned to API clients directly.
"""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


EXTRACTION_FIELD_NAMES: list[str] = [
    # Identity / contact
    "full_name", "email", "phone", "current_location", "preferred_location",
    # Authorization / visa
    "work_authorization", "work_authorization_status", "work_authorization_text",
    "willing_to_relocate",
    # Work style
    "remote_preference", "remote_preference_text",
    # Experience
    "current_title", "years_experience_years", "years_experience_text",
    "primary_skills", "secondary_skills", "domain_experience",
    "industries_worked_in", "current_company", "previous_companies",
    "education", "certifications",
    # Preferences / logistics
    "target_roles",
    "target_salary_min", "target_salary_max", "compensation_period", "compensation_text",
    "employment_type_preference", "availability_date",
    "notice_period_days", "notice_period_text",
    "interview_availability",
    # Recruiter notes
    "client_fit_summary", "recruiter_recommendation", "concerns_or_red_flags",
]


# ---------------------------------------------------------------------------
# Constrained enums — kept tight so the LLM can't invent values
# ---------------------------------------------------------------------------

class WorkAuthType(str, Enum):
    US_CITIZEN = "US Citizen"
    GREEN_CARD = "Green Card"
    H1B = "H-1B"
    OPT = "OPT"
    OPT_STEM = "OPT STEM"
    CPT = "CPT"
    TN_VISA = "TN Visa"
    L1 = "L-1"
    E3 = "E-3"
    O1 = "O-1"
    REQUIRES_SPONSORSHIP = "Requires Sponsorship"


class WorkAuthStatus(str, Enum):
    """Canonical work eligibility — separate from the visa document type."""
    AUTHORIZED_NOW = "authorized_now"
    REQUIRES_FUTURE_SPONSORSHIP = "requires_future_sponsorship"
    REQUIRES_CURRENT_SPONSORSHIP = "requires_current_sponsorship"
    UNKNOWN = "unknown"


class RemotePreference(str, Enum):
    REMOTE = "remote"
    HYBRID = "hybrid"
    ONSITE = "onsite"
    FLEXIBLE = "flexible"
    UNKNOWN = "unknown"


class EmploymentType(str, Enum):
    FULL_TIME = "Full-time"
    PART_TIME = "Part-time"
    CONTRACT = "Contract"
    CONTRACT_TO_HIRE = "Contract-to-hire"


# ---------------------------------------------------------------------------
# Typed field extraction models — one per value type
# ---------------------------------------------------------------------------

class BaseFieldExtraction(BaseModel):
    evidence_snippet: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    status: Literal["extracted", "missing", "ambiguous"]


class TextFieldExtraction(BaseFieldExtraction):
    value: str | None = None


class FloatFieldExtraction(BaseFieldExtraction):
    value: float | None = None


class BoolFieldExtraction(BaseFieldExtraction):
    value: bool | None = None


class ListFieldExtraction(BaseFieldExtraction):
    value: list[str] | None = None


class IntFieldExtraction(BaseFieldExtraction):
    value: int | None = None


class WorkAuthFieldExtraction(BaseFieldExtraction):
    value: WorkAuthType | None = None


class WorkAuthStatusFieldExtraction(BaseFieldExtraction):
    value: WorkAuthStatus | None = None


class RemotePrefFieldExtraction(BaseFieldExtraction):
    value: RemotePreference | None = None


class EmploymentTypeFieldExtraction(BaseFieldExtraction):
    value: EmploymentType | None = None


class CompensationPeriodFieldExtraction(BaseFieldExtraction):
    value: Literal["annual", "hourly"] | None = None


# ---------------------------------------------------------------------------
# Top-level LLM response — the schema passed to response_format
# ---------------------------------------------------------------------------

class ExtractionLLMResponse(BaseModel):
    """
    Schema for OpenAI Structured Outputs. Each field uses a concrete typed
    extraction model so the LLM is constrained to return the correct value type.
    """
    # Identity / contact
    full_name: TextFieldExtraction
    email: TextFieldExtraction
    phone: TextFieldExtraction
    current_location: TextFieldExtraction
    preferred_location: TextFieldExtraction

    # Authorization / visa
    work_authorization: WorkAuthFieldExtraction
    work_authorization_status: WorkAuthStatusFieldExtraction
    work_authorization_text: TextFieldExtraction
    willing_to_relocate: BoolFieldExtraction

    # Work style
    remote_preference: RemotePrefFieldExtraction
    remote_preference_text: TextFieldExtraction

    # Experience
    current_title: TextFieldExtraction
    years_experience_years: FloatFieldExtraction
    years_experience_text: TextFieldExtraction
    primary_skills: ListFieldExtraction
    secondary_skills: ListFieldExtraction
    domain_experience: TextFieldExtraction
    industries_worked_in: ListFieldExtraction
    current_company: TextFieldExtraction
    previous_companies: ListFieldExtraction
    education: TextFieldExtraction
    certifications: ListFieldExtraction

    # Preferences / logistics
    target_roles: ListFieldExtraction
    target_salary_min: IntFieldExtraction
    target_salary_max: IntFieldExtraction
    compensation_period: CompensationPeriodFieldExtraction
    compensation_text: TextFieldExtraction
    employment_type_preference: EmploymentTypeFieldExtraction
    availability_date: TextFieldExtraction
    notice_period_days: IntFieldExtraction
    notice_period_text: TextFieldExtraction
    interview_availability: TextFieldExtraction

    # Recruiter notes
    client_fit_summary: TextFieldExtraction
    recruiter_recommendation: TextFieldExtraction
    concerns_or_red_flags: TextFieldExtraction

    missing_fields: list[str]
    ambiguous_fields: list[str]
    suggested_follow_up_questions: list[str]
    candidate_summary: str
