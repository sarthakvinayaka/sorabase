"""
Staffing extraction output: transcript-grounded structured profile.

Used as the contract for LLM JSON output and for mock extraction. Separate from
DB row shapes (`extracted_fields` / `field_evidence`) — map into those in a persistence layer later.
"""

from __future__ import annotations

import json
from typing import Annotated, Any, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Stable snake_case keys — keep aligned with `ExtractedField.field_name` when persisting.
STAFFING_EXTRACTION_FIELD_KEYS: tuple[str, ...] = (
    "full_name",
    "email",
    "phone",
    "current_location",
    "preferred_location",
    "work_authorization",
    "visa_status",
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
    "target_roles",
    "target_rate_or_salary",
    "employment_type_preference",
    "availability_date",
    "notice_period",
    "interview_availability",
    "client_fit_summary",
    "recruiter_recommendation",
    "concerns_or_red_flags",
)


StaffingScalar = str | int | float | bool | list[str] | None


class TranscriptEvidence(BaseModel):
    """Grounding for a single field — quote must be a verbatim substring of the transcript when value is non-null."""

    model_config = ConfigDict(extra="forbid")

    quote: str | None = Field(
        default=None,
        description="Verbatim excerpt from the transcript supporting the value; null if value is null.",
        max_length=4000,
    )
    segment_index: int | None = Field(
        default=None,
        description="0-based transcript segment index when segmentation is available.",
        ge=0,
    )
    start_ms: int | None = Field(default=None, description="Audio offset start for the cited span.", ge=0)
    end_ms: int | None = Field(default=None, description="Audio offset end for the cited span.", ge=0)


class StaffingFieldBlock(BaseModel):
    """One staffing field with confidence, evidence, and optional ambiguity note."""

    model_config = ConfigDict(extra="forbid")

    value: StaffingScalar = Field(
        description="Structured value or null if not stated. Never invent — use null when unknown.",
    )
    confidence: Annotated[float, Field(ge=0.0, le=1.0, description="0–1; use low values unless quote clearly supports value.")]
    evidence: TranscriptEvidence | None = Field(
        default=None,
        description="Required when confidence >= 0.5 and value is non-null; otherwise may be null.",
    )
    ambiguity_note: str | None = Field(
        default=None,
        max_length=2000,
        description="Recruiter-facing note when wording is vague or conflicting (see ambiguous_fields).",
    )


class StaffingExtractionFields(BaseModel):
    """All staffing fields — each must appear exactly once in JSON output."""

    model_config = ConfigDict(extra="forbid")

    full_name: StaffingFieldBlock
    email: StaffingFieldBlock
    phone: StaffingFieldBlock
    current_location: StaffingFieldBlock
    preferred_location: StaffingFieldBlock
    work_authorization: StaffingFieldBlock
    visa_status: StaffingFieldBlock
    willing_to_relocate: StaffingFieldBlock
    remote_preference: StaffingFieldBlock
    current_title: StaffingFieldBlock
    years_experience: StaffingFieldBlock
    primary_skills: StaffingFieldBlock
    secondary_skills: StaffingFieldBlock
    domain_experience: StaffingFieldBlock
    industries_worked_in: StaffingFieldBlock
    current_company: StaffingFieldBlock
    previous_companies: StaffingFieldBlock
    education: StaffingFieldBlock
    certifications: StaffingFieldBlock
    target_roles: StaffingFieldBlock
    target_rate_or_salary: StaffingFieldBlock
    employment_type_preference: StaffingFieldBlock
    availability_date: StaffingFieldBlock
    notice_period: StaffingFieldBlock
    interview_availability: StaffingFieldBlock
    client_fit_summary: StaffingFieldBlock
    recruiter_recommendation: StaffingFieldBlock
    concerns_or_red_flags: StaffingFieldBlock


class StaffingExtractionOutput(BaseModel):
    """Root object returned by extraction (LLM or mock)."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["staffing_extraction.v1"] = "staffing_extraction.v1"
    fields: StaffingExtractionFields
    missing_fields: list[str] = Field(
        default_factory=list,
        description="Field keys where value is null and the transcript does not support an inference.",
    )
    ambiguous_fields: list[str] = Field(
        default_factory=list,
        description="Field keys where the transcript partially supports a value or wording is unclear.",
    )
    suggested_follow_up_questions: list[str] = Field(
        default_factory=list,
        description="Short, professional questions the recruiter can ask to fill gaps (no assumptions).",
    )
    extraction_notes: str | None = Field(
        default=None,
        max_length=4000,
        description="Optional brief recruiter-facing summary of extraction quality (no new factual claims).",
    )

    @field_validator("missing_fields", "ambiguous_fields")
    @classmethod
    def _known_keys_only(cls, v: list[str]) -> list[str]:
        bad = [x for x in v if x not in STAFFING_EXTRACTION_FIELD_KEYS]
        if bad:
            msg = f"Unknown field keys: {bad}"
            raise ValueError(msg)
        return v

    @model_validator(mode="after")
    def _lists_align_with_nulls(self) -> Self:
        for key in self.missing_fields:
            block = getattr(self.fields, key)
            if block.value is not None:
                msg = f"missing_fields contains {key!r} but value is not null"
                raise ValueError(msg)
        return self


def staffing_extraction_json_schema() -> dict[str, Any]:
    """JSON Schema for tool-calling / offline validation (OpenAI structured output, etc.)."""
    return StaffingExtractionOutput.model_json_schema()


def dump_staffing_extraction_schema_json() -> str:
    return json.dumps(staffing_extraction_json_schema(), indent=2, sort_keys=True)
