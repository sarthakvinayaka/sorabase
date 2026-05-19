"""
Pydantic schemas for the Study Mode API.

Inbound: request bodies for extract, update-overview, update-flashcard, update-question.
Outbound: response shapes for all GET and mutation endpoints.

These schemas are the public API contract — they must stay in sync with the
TypeScript interfaces in frontend/lib/types.ts.
"""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Inbound request bodies
# ---------------------------------------------------------------------------

class StudyExtractRequest(BaseModel):
    conversation_id: uuid.UUID
    template_slug:   str        = "lecture_notes"
    title:           str | None = None
    course:          str | None = None
    lecture_date:    str | None = None   # "YYYY-MM-DD"


class StudyOverviewUpdateRequest(BaseModel):
    summary: str = Field(..., min_length=1)


class StudyFlashcardUpdateRequest(BaseModel):
    front: str | None = None
    back:  str | None = None


class StudyQuestionUpdateRequest(BaseModel):
    question:        str | None  = None
    answer_short:    str | None  = None
    answer_exam:     str | None  = None
    answer_detailed: str | None  = None
    options:         list[Any] | None = None   # list[MCQOption dict]
    difficulty:      Literal["easy", "medium", "hard"] | None = None
    is_hidden:       bool | None = None


# ---------------------------------------------------------------------------
# Outbound response shapes — model_config = from_attributes for ORM objects
# ---------------------------------------------------------------------------

class StudyExtractionCreatedResponse(BaseModel):
    lecture_id:    uuid.UUID
    extraction_id: uuid.UUID


class StudyLectureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:             uuid.UUID
    conversation_id: uuid.UUID
    title:          str | None
    course:         str | None
    lecture_date:   str | None
    template_slug:  str | None
    archive_status: str
    created_at:     datetime
    updated_at:     datetime


class StudyExtractionRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:         uuid.UUID
    lecture_id: uuid.UUID
    status:     str
    model_used: str | None
    created_at: datetime


class StudyConceptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    concept:          str
    explanation:      str
    confidence:       float
    evidence_snippet: str | None


class StudyDefinitionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    term:             str
    definition:       str
    confidence:       float
    evidence_snippet: str | None


class StudyFormulaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    notation:         str
    description:      str
    example:          str | None
    confidence:       float
    evidence_snippet: str | None


class StudyFlashcardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:               uuid.UUID
    front:            str
    back:             str
    concept_tag:      str | None
    confidence:       float
    evidence_snippet: str | None
    edited:           bool


class StudyQuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:               uuid.UUID
    question:         str
    question_type:    str
    difficulty:       str | None
    answer_short:     str | None
    answer_exam:      str
    answer_detailed:  str | None
    options:          Any | None       # list[MCQOption dict] | null
    confidence:       float
    source_coverage:  float | None
    evidence_snippet: str | None
    topic_tags:       list[str]
    edited:           bool
    is_hidden:        bool


class StudyLectureDetailResponse(BaseModel):
    lecture:             StudyLectureRead
    extraction:          StudyExtractionRunRead
    summary:             str | None
    topics:              list[str]
    learning_objectives: list[str]
    key_concepts:        list[StudyConceptRead]
    definitions:         list[StudyDefinitionRead]
    formulas:            list[StudyFormulaRead]
    flashcards:          list[StudyFlashcardRead]
    questions:           list[StudyQuestionRead]
    transcript:          str | None


class StudyArchiveResponse(BaseModel):
    lecture_id:     uuid.UUID
    archive_status: str


# ---------------------------------------------------------------------------
# Status polling response — used by GET /study/lectures/{id}/status
# ---------------------------------------------------------------------------

class StudyLectureStatusResponse(BaseModel):
    """
    Stable polling contract for the Study Mode processing page.

    status values (in order):
      pending              — job created, extraction not yet started
      running              — extraction service has picked up the job
      extracting_content   — Pass 1 in progress (summary, concepts, definitions)
      generating_questions — Pass 2 in progress (questions, flashcards)
      completed            — all outputs saved, ready for review
      failed               — unrecoverable error; see error_message

    Frontend guidance:
      - Poll every poll_interval_ms ms while is_ready is False and
        status is not "failed".
      - On is_ready=True, redirect to redirect_url.
      - On status="failed", show error_message to the user.
      - Future SSE/WebSocket upgrade: keep this response shape; push the
        same object as the event payload so clients need no changes.
    """
    lecture_id:       uuid.UUID
    status:           str
    current_stage:    str
    percent_complete: int | None   # 0–100; null when status is unknown
    error_message:    str | None   # safe display text; no internal stack traces
    is_ready:         bool         # True only when status == "completed"
    last_updated_at:  datetime
    redirect_url:     str | None   # populated when is_ready; points to review page
    poll_interval_ms: int | None   # recommended polling cadence; null when terminal


# ---------------------------------------------------------------------------
# Course aggregate responses
# ---------------------------------------------------------------------------

class CourseLectureItem(BaseModel):
    lecture_id:     uuid.UUID
    title:          str | None
    lecture_date:   str | None
    archive_status: str
    flashcard_count: int
    question_count:  int
    concept_count:   int
    topic_count:     int
    avg_confidence:  float | None
    created_at:      datetime


class CourseTopicFrequency(BaseModel):
    topic:         str
    lecture_count: int


class CourseRepeatedConcept(BaseModel):
    concept:        str
    explanation:    str
    frequency:      int
    avg_confidence: float


class StudyCourseDetailResponse(BaseModel):
    course_name:      str
    lecture_count:    int
    total_flashcards: int
    total_questions:  int
    total_concepts:   int
    avg_confidence:   float | None
    last_updated:     datetime | None
    lectures:         list[CourseLectureItem]
    topic_frequencies: list[CourseTopicFrequency]
    repeated_concepts: list[CourseRepeatedConcept]
    coverage_gaps:    list[str]
    suggested_review: list[dict]
    sample_questions: list[StudyQuestionRead]
