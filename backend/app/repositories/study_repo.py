"""
Study Mode repository.

Ownership model
───────────────
- Every StudyLecture row carries org_id (the caller's deterministic UUID).
- All child tables (concepts, definitions, formulas, flashcards, questions)
  inherit isolation through their lecture_id FK: to touch a child record the
  caller must first prove ownership of the parent lecture.
- StudyExtractionRun carries its own org_id so background workers and polling
  endpoints can look up a run without joining through the lecture.

Every public function that accepts a lecture_id or child-record ID MUST receive
org_id and verify ownership before returning data. Returning None on a mismatch
causes the route layer to emit 404 — the caller learns nothing about whether the
resource exists at all.
"""

import uuid
from collections import Counter

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.db.models import (
    StudyConcept,
    StudyDefinition,
    StudyExtractionRun,
    StudyFlashcard,
    StudyFormula,
    StudyLecture,
    StudyQuestion,
)
from app.domain.study_llm_schemas import (
    StudyConceptItem,
    StudyDefinitionItem,
    StudyFlashcardItem,
    StudyFormulaItem,
    StudyQuestionItem,
)


# ── Lecture ───────────────────────────────────────────────────────────────────

def create_lecture(
    db: Session,
    *,
    org_id: uuid.UUID,
    conversation_id: uuid.UUID,
    title: str | None,
    course: str | None,
    lecture_date: str | None,
    template_slug: str,
) -> StudyLecture:
    lecture = StudyLecture(
        org_id=org_id,
        conversation_id=conversation_id,
        title=title,
        course=course or None,
        lecture_date=lecture_date or None,
        template_slug=template_slug,
    )
    db.add(lecture)
    db.commit()
    db.refresh(lecture)
    return lecture


def get_lecture(
    db: Session, lecture_id: uuid.UUID, org_id: uuid.UUID
) -> StudyLecture | None:
    """Return the lecture only if it belongs to org_id."""
    lecture = db.get(StudyLecture, lecture_id)
    if lecture is None or lecture.org_id != org_id:
        return None
    return lecture


def list_lectures(
    db: Session, org_id: uuid.UUID, *, limit: int = 50
) -> list[StudyLecture]:
    return (
        db.query(StudyLecture)
        .filter(StudyLecture.org_id == org_id)
        .order_by(desc(StudyLecture.created_at))
        .limit(limit)
        .all()
    )


def update_overview(db: Session, lecture: StudyLecture, *, summary: str) -> None:
    lecture.summary = summary
    db.commit()


def set_lecture_content(
    db: Session,
    lecture: StudyLecture,
    *,
    summary: str,
    topics: list[str],
    learning_objectives: list[str],
    transcript: str,
) -> None:
    """Persist Pass-1 extracted content fields onto the lecture row."""
    lecture.summary = summary
    lecture.topics = topics
    lecture.learning_objectives = learning_objectives
    lecture.transcript = transcript
    db.commit()


def bulk_create_concepts(
    db: Session,
    lecture_id: uuid.UUID,
    items: list[StudyConceptItem],
) -> None:
    if not items:
        return
    db.bulk_save_objects([
        StudyConcept(
            lecture_id=lecture_id,
            concept=item.concept,
            explanation=item.explanation,
            confidence=item.confidence,
            evidence_snippet=item.evidence_snippet,
        )
        for item in items
    ])
    db.commit()


def bulk_create_definitions(
    db: Session,
    lecture_id: uuid.UUID,
    items: list[StudyDefinitionItem],
) -> None:
    if not items:
        return
    db.bulk_save_objects([
        StudyDefinition(
            lecture_id=lecture_id,
            term=item.term,
            definition=item.definition,
            confidence=item.confidence,
            evidence_snippet=item.evidence_snippet,
        )
        for item in items
    ])
    db.commit()


def bulk_create_formulas(
    db: Session,
    lecture_id: uuid.UUID,
    items: list[StudyFormulaItem],
) -> None:
    if not items:
        return
    db.bulk_save_objects([
        StudyFormula(
            lecture_id=lecture_id,
            notation=item.notation,
            description=item.description,
            example=item.example,
            confidence=item.confidence,
            evidence_snippet=item.evidence_snippet,
        )
        for item in items
    ])
    db.commit()


def bulk_create_flashcards(
    db: Session,
    lecture_id: uuid.UUID,
    items: list[StudyFlashcardItem],
) -> None:
    if not items:
        return
    db.bulk_save_objects([
        StudyFlashcard(
            lecture_id=lecture_id,
            front=item.front,
            back=item.back,
            concept_tag=item.concept_tag,
            confidence=item.confidence,
            evidence_snippet=item.evidence_snippet,
        )
        for item in items
    ])
    db.commit()


def bulk_create_questions(
    db: Session,
    lecture_id: uuid.UUID,
    items: list[StudyQuestionItem],
) -> None:
    if not items:
        return
    db.bulk_save_objects([
        StudyQuestion(
            lecture_id=lecture_id,
            question=item.question,
            question_type=item.question_type,
            difficulty=item.difficulty,
            answer_short=item.answer_short,
            answer_exam=item.answer_exam,
            answer_detailed=item.answer_detailed,
            # options is a list[MCQOption] — store as list[dict] in JSON column
            options=[o.model_dump() for o in item.options] if item.options else None,
            confidence=item.confidence,
            source_coverage=item.source_coverage,
            evidence_snippet=item.evidence_snippet,
            topic_tags=item.topic_tags,
        )
        for item in items
    ])
    db.commit()


def archive_lecture(db: Session, lecture: StudyLecture) -> None:
    lecture.archive_status = "archived"
    db.commit()
    db.refresh(lecture)


# ── Extraction run ────────────────────────────────────────────────────────────

def create_extraction_run(
    db: Session, *, org_id: uuid.UUID, lecture_id: uuid.UUID
) -> StudyExtractionRun:
    run = StudyExtractionRun(org_id=org_id, lecture_id=lecture_id)
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def get_extraction_run(
    db: Session, run_id: uuid.UUID, org_id: uuid.UUID
) -> StudyExtractionRun | None:
    run = db.get(StudyExtractionRun, run_id)
    if run is None or run.org_id != org_id:
        return None
    return run


def get_latest_extraction_run(
    db: Session, lecture_id: uuid.UUID, org_id: uuid.UUID
) -> StudyExtractionRun | None:
    """Return the most recent run for a lecture, verifying org ownership first."""
    if get_lecture(db, lecture_id, org_id) is None:
        return None
    return (
        db.query(StudyExtractionRun)
        .filter(StudyExtractionRun.lecture_id == lecture_id)
        .order_by(desc(StudyExtractionRun.created_at))
        .first()
    )


def update_extraction_run(
    db: Session,
    run: StudyExtractionRun,
    *,
    status: str,
    model_used: str | None = None,
    error_message: str | None = None,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
) -> None:
    run.status = status
    if model_used is not None:
        run.model_used = model_used
    if error_message is not None:
        run.error_message = error_message
    if prompt_tokens is not None:
        run.prompt_tokens = prompt_tokens
    if completion_tokens is not None:
        run.completion_tokens = completion_tokens
    db.commit()


# ── Flashcard ─────────────────────────────────────────────────────────────────

def get_flashcard(
    db: Session, flashcard_id: uuid.UUID, lecture_id: uuid.UUID
) -> StudyFlashcard | None:
    """Return flashcard only if it belongs to the given lecture."""
    fc = db.get(StudyFlashcard, flashcard_id)
    if fc is None or fc.lecture_id != lecture_id:
        return None
    return fc


def update_flashcard(
    db: Session,
    fc: StudyFlashcard,
    *,
    front: str | None = None,
    back: str | None = None,
) -> None:
    if front is not None:
        fc.front = front
    if back is not None:
        fc.back = back
    fc.edited = True
    db.commit()
    db.refresh(fc)


# ── Question ──────────────────────────────────────────────────────────────────

def get_question(
    db: Session, question_id: uuid.UUID, lecture_id: uuid.UUID
) -> StudyQuestion | None:
    """Return question only if it belongs to the given lecture."""
    q = db.get(StudyQuestion, question_id)
    if q is None or q.lecture_id != lecture_id:
        return None
    return q


def update_question(
    db: Session,
    q: StudyQuestion,
    *,
    question: str | None = None,
    answer_short: str | None = None,
    answer_exam: str | None = None,
    answer_detailed: str | None = None,
    options: list[dict] | None = None,
    difficulty: str | None = None,
    is_hidden: bool | None = None,
) -> None:
    if question is not None:
        q.question = question
    if answer_short is not None:
        q.answer_short = answer_short
    if answer_exam is not None:
        q.answer_exam = answer_exam
    if answer_detailed is not None:
        q.answer_detailed = answer_detailed
    if options is not None:
        q.options = options
    if difficulty is not None:
        q.difficulty = difficulty
    if is_hidden is not None:
        q.is_hidden = is_hidden
    q.edited = True
    db.commit()
    db.refresh(q)


# ── Course aggregate ──────────────────────────────────────────────────────────

def list_courses(db: Session, org_id: uuid.UUID) -> list[str]:
    rows = (
        db.query(StudyLecture.course)
        .filter(
            StudyLecture.org_id == org_id,
            StudyLecture.course.isnot(None),
        )
        .distinct()
        .order_by(StudyLecture.course)
        .all()
    )
    return [r.course for r in rows]


def get_course_lectures(
    db: Session, course_name: str, org_id: uuid.UUID
) -> list[StudyLecture]:
    """
    Return all lectures for a course scoped to org_id.
    The org_id filter in the WHERE clause is the isolation guarantee —
    callers cannot enumerate another user's courses by guessing names.
    """
    return (
        db.query(StudyLecture)
        .filter(
            StudyLecture.org_id == org_id,
            StudyLecture.course == course_name,
        )
        .order_by(
            StudyLecture.lecture_date.desc().nullslast(),
            desc(StudyLecture.created_at),
        )
        .all()
    )
