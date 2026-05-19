"""
Pydantic models used exclusively with OpenAI Structured Outputs in Study Mode.

Two-pass extraction strategy:
  Pass 1 — StudyContentLLMResponse: summary, topics, learning objectives,
    key concepts, definitions, formulas.  Runs against the full transcript
    (or merged chunks for long transcripts).
  Pass 2 — StudyQALLMResponse: questions (multiple types) and flashcards.
    Runs against a truncated transcript enriched with the Pass-1 concept
    list so Q&A is grounded in what was actually covered.

These models are NEVER returned to API clients.  They are internal to the
extraction pipeline.  See study_schemas.py for the public API shapes.
"""

from typing import Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Pass 1 — Content
# ---------------------------------------------------------------------------

class StudyConceptItem(BaseModel):
    concept: str = Field(
        description="Name of the key concept (noun phrase, max 8 words)."
    )
    explanation: str = Field(
        description="Clear, standalone explanation (2–4 sentences)."
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="How strongly the concept is covered in the transcript (0–1).",
    )
    evidence_snippet: str | None = Field(
        default=None,
        description=(
            "Shortest verbatim quote from the transcript that introduces or "
            "defines this concept.  Null if no clear quote exists."
        ),
    )


class StudyDefinitionItem(BaseModel):
    term: str = Field(description="The term or vocabulary item being defined.")
    definition: str = Field(
        description="Precise definition as stated or clearly implied by the transcript."
    )
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_snippet: str | None = None


class StudyFormulaItem(BaseModel):
    notation: str = Field(
        description=(
            "The formula or equation in plain text or LaTeX-style notation "
            "(e.g. 'F = ma', 'E = mc^2', 'PV = nRT')."
        )
    )
    description: str = Field(
        description="What the formula represents or how it is used."
    )
    example: str | None = Field(
        default=None,
        description=(
            "A concrete worked example if the transcript provides one.  "
            "Null otherwise."
        ),
    )
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_snippet: str | None = None


class StudyContentLLMResponse(BaseModel):
    """Structured output model for the content-extraction pass (Pass 1)."""

    summary: str = Field(
        description=(
            "3–6 sentence summary of the lecture's core content.  "
            "Write it as if explaining to a student who missed the class."
        )
    )
    topics: list[str] = Field(
        description=(
            "Top-level topics covered, in order of appearance.  "
            "Each entry is a short noun phrase (max 6 words).  "
            "Return at most 10 items."
        )
    )
    learning_objectives: list[str] = Field(
        description=(
            "What a student should be able to do or understand after this lecture.  "
            "Each item starts with an action verb (e.g. 'Explain...', 'Apply...', "
            "'Derive...').  Return 3–8 items."
        )
    )
    concepts: list[StudyConceptItem] = Field(
        description=(
            "Key concepts worth studying.  Be selective — aim for 5–20 "
            "high-value items.  Skip trivial mentions."
        )
    )
    definitions: list[StudyDefinitionItem] = Field(
        description=(
            "Technical terms, jargon, or vocabulary items that are defined "
            "explicitly or implicitly in the lecture.  Empty list if none."
        )
    )
    formulas: list[StudyFormulaItem] = Field(
        description=(
            "Mathematical formulas, equations, or quantitative relationships "
            "introduced in the lecture.  Empty list if the lecture is non-quantitative."
        )
    )


# ---------------------------------------------------------------------------
# Pass 2 — Questions & Flashcards
# ---------------------------------------------------------------------------

class MCQOption(BaseModel):
    label: Literal["A", "B", "C", "D"]
    text: str = Field(description="Text of this answer option.")
    is_correct: bool = Field(description="True for exactly one option per question.")


class StudyQuestionItem(BaseModel):
    question: str = Field(description="The question text.")
    question_type: Literal["important", "essay", "mcq", "short_answer", "exam"] = Field(
        description=(
            "important: a key conceptual question without MCQ options; "
            "essay: requires a multi-paragraph response; "
            "mcq: multiple choice with options A–D; "
            "short_answer: one-sentence factual answer; "
            "exam: exam-style question requiring structured multi-part answer."
        )
    )
    difficulty: Literal["easy", "medium", "hard"]
    answer_short: str | None = Field(
        default=None,
        description=(
            "One-sentence answer.  Required for short_answer and important types; "
            "null for essay and mcq."
        ),
    )
    answer_exam: str = Field(
        description=(
            "Full exam-quality answer (2–5 sentences).  Required for all question types."
        )
    )
    answer_detailed: str | None = Field(
        default=None,
        description=(
            "Extended explanation with broader context, examples, or derivation.  "
            "Include for essay and exam types; optional for others."
        ),
    )
    options: list[MCQOption] | None = Field(
        default=None,
        description=(
            "Exactly 4 options (A, B, C, D) for mcq questions.  "
            "Null for all other types.  Include one correct and three plausible distractors."
        ),
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="How well the transcript supports this question (0–1).",
    )
    source_coverage: float = Field(
        ge=0.0, le=1.0,
        description=(
            "Estimated fraction of the lecture that relates to this question's topic.  "
            "Higher = more central to the lecture."
        ),
    )
    evidence_snippet: str | None = Field(
        default=None,
        description="Verbatim quote from the transcript most relevant to this question.",
    )
    topic_tags: list[str] = Field(
        default_factory=list,
        description=(
            "Topics from the extracted topics list that this question covers.  "
            "Use the exact topic strings returned in Pass 1."
        ),
    )


class StudyFlashcardItem(BaseModel):
    front: str = Field(
        description=(
            "The prompt side: a question, a term to define, or a cue (max 2 sentences)."
        )
    )
    back: str = Field(
        description=(
            "The answer side: definition, explanation, or response (max 3 sentences).  "
            "Should be self-contained without needing the front."
        )
    )
    concept_tag: str | None = Field(
        default=None,
        description="The concept or topic this card reinforces, matching a concept name from Pass 1.",
    )
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="How clearly the transcript supports this card (0–1).",
    )
    evidence_snippet: str | None = None


class StudyQALLMResponse(BaseModel):
    """Structured output model for the Q&A generation pass (Pass 2)."""

    questions: list[StudyQuestionItem] = Field(
        description=(
            "Study questions covering a range of difficulties and types.  "
            "Aim for 8–20 questions that collectively span the lecture's topics."
        )
    )
    flashcards: list[StudyFlashcardItem] = Field(
        description=(
            "Flashcard pairs for active recall.  "
            "Aim for 10–30 cards.  "
            "Cover concepts, definitions, formulas, and key facts.  "
            "Each card should be atomic — test exactly one thing."
        )
    )
