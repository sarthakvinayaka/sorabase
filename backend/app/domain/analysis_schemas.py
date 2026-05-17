"""
LLM-facing schemas for candidate-JD fit analysis.
Used exclusively as response_format for OpenAI Structured Outputs.
Never returned to API clients directly — api_schemas.AnalysisRunRead is the outbound shape.
"""

from typing import Literal

from pydantic import BaseModel, Field


class RequirementAssessment(BaseModel):
    """Assessment of a single JD requirement against the candidate profile."""

    requirement: str = Field(
        description="Verbatim or close paraphrase of the JD requirement being assessed."
    )
    met: bool = Field(
        description="True if the candidate profile satisfies this requirement."
    )
    candidate_evidence: str | None = Field(
        None,
        description=(
            "Short verbatim quote or paraphrase from the candidate profile or transcript "
            "that supports the assessment. Null only if the requirement is genuinely absent."
        ),
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in this assessment (0–1).",
    )


class DimensionScore(BaseModel):
    """Score and grounded rationale for one evaluation dimension."""

    score: int = Field(
        ge=0,
        le=100,
        description="Score for this dimension (0–100). 0–29=clearly not present, 30–49=below bar, 50–69=partially meets, 70–84=meets, 85–100=exceeds.",
    )
    rationale: str = Field(
        description=(
            "1–2 sentences grounded in specific candidate evidence. "
            "Must reference an actual field value or transcript quote."
        )
    )


class AnalysisLLMResponse(BaseModel):
    """
    Schema for OpenAI Structured Outputs — fit evaluation of one candidate against one JD.

    Scoring contract:
      overall_score = round(0.35 * skills_score + 0.20 * experience_score
                            + 0.15 * domain_score + 0.30 * logistics_score)

    Tier mapping:
      85–100 → strong_fit | 70–84 → good_fit | 50–69 → partial_fit
      30–49  → weak_fit   | 0–29  → no_fit
    """

    # Overall
    overall_score: int = Field(
        ge=0,
        le=100,
        description="Weighted composite score (0–100). Must equal round(0.35*skills + 0.20*exp + 0.15*domain + 0.30*logistics).",
    )
    overall_tier: Literal["strong_fit", "good_fit", "partial_fit", "weak_fit", "no_fit"]

    # Dimension scores
    skills_score: DimensionScore = Field(
        description="Technical skills alignment with JD requirements (weight 35%)."
    )
    experience_score: DimensionScore = Field(
        description="Years, seniority, and depth vs JD expectations (weight 20%)."
    )
    domain_score: DimensionScore = Field(
        description="Industry, domain, and company background relevance (weight 15%)."
    )
    logistics_score: DimensionScore = Field(
        description="Work auth, remote/location, salary, notice period, employment type (weight 30%)."
    )

    # Requirement assessments
    hard_requirements: list[RequirementAssessment] = Field(
        description=(
            "Hard (required) requirements parsed from the JD — phrases like 'required', "
            "'must have', 'minimum X years'. Each assessed as met or not met."
        )
    )
    preferred_requirements: list[RequirementAssessment] = Field(
        description=(
            "Preferred (nice-to-have) requirements — phrases like 'preferred', 'nice to have', "
            "'a plus', 'bonus'. Each assessed as met or not met."
        )
    )

    # Narrative fields
    strengths: list[str] = Field(
        description=(
            "3–5 concrete strengths specific to this JD. Each must reference a JD requirement "
            "and the candidate evidence that satisfies it."
        )
    )
    gaps: list[str] = Field(
        description=(
            "1–4 concrete gaps relative to JD requirements. "
            "'X required by JD but not mentioned in candidate profile' is a valid gap."
        )
    )
    concerns: list[str] = Field(
        description=(
            "0–3 risk factors (e.g. compensation misalignment, overqualified, location). "
            "Return empty list if none. Do not invent concerns."
        )
    )
    missing_info: list[str] = Field(
        description=(
            "Fields absent from the candidate profile that are relevant to this JD and "
            "would materially affect the score if known."
        )
    )
    rationale: str = Field(
        description=(
            "3–5 sentence recruiter-readable summary. Reference specific evidence. "
            "Balanced — neither promotional nor harsh. Written for a hiring decision."
        )
    )
    suggested_follow_up_questions: list[str] = Field(
        description=(
            "2–4 questions specific to gaps or ambiguities revealed by comparing this candidate "
            "to this JD. Role-specific, not generic."
        )
    )
