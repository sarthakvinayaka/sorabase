"""
Study Mode API routes.

Isolation guarantee
───────────────────
Every endpoint injects org_id via the get_current_org_id dependency, which
validates the HMAC-signed X-User-Id header set by the Next.js proxy. The org_id
is then passed to every repository call. Repositories return None on an ownership
mismatch; the route translates None → HTTP 404 so callers cannot distinguish
"resource does not exist" from "resource belongs to a different user."

Two-layer ownership check for child records (flashcards, questions):
  1. Verify the lecture belongs to the caller (get_lecture checks org_id).
  2. Verify the child record belongs to that lecture (get_flashcard / get_question
     checks lecture_id FK, not org_id — the parent check is sufficient because a
     caller cannot forge a lecture_id they do not own).
"""

import logging
import uuid
from collections import Counter

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.db.session import get_db
from app.repositories import conversation_repo, study_repo
from app.services.study_extraction_service import run_study_extraction
from app.domain.study_schemas import (
    CourseLectureItem,
    CourseRepeatedConcept,
    CourseTopicFrequency,
    StudyArchiveResponse,
    StudyConceptRead,
    StudyCourseDetailResponse,
    StudyDefinitionRead,
    StudyExtractionCreatedResponse,
    StudyExtractionRunRead,
    StudyFlashcardRead,
    StudyFlashcardUpdateRequest,
    StudyFormulaRead,
    StudyLectureDetailResponse,
    StudyLectureRead,
    StudyLectureStatusResponse,
    StudyOverviewUpdateRequest,
    StudyExtractRequest,
    StudyQuestionRead,
    StudyQuestionUpdateRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Extraction — creates a lecture + queues an extraction run
# ---------------------------------------------------------------------------

@router.post("/study/extract", response_model=StudyExtractionCreatedResponse, status_code=201)
def extract_study_lecture(
    body:             StudyExtractRequest,
    background_tasks: BackgroundTasks,
    db:               Session   = Depends(get_db),
    org_id:           uuid.UUID = Depends(get_current_org_id),
):
    """
    Create a StudyLecture + pending StudyExtractionRun, then kick off the
    extraction pipeline as a BackgroundTask.

    Ownership check: the conversation must belong to the calling user before we
    accept it as the source for a new lecture.
    """
    conversation = conversation_repo.get(db, body.conversation_id, org_id=org_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    if not conversation.raw_text:
        raise HTTPException(
            status_code=422,
            detail="Conversation transcript is not ready yet. Wait for transcription to complete.",
        )

    lecture = study_repo.create_lecture(
        db,
        org_id=org_id,
        conversation_id=body.conversation_id,
        title=body.title,
        course=body.course,
        lecture_date=body.lecture_date,
        template_slug=body.template_slug,
    )
    run = study_repo.create_extraction_run(db, org_id=org_id, lecture_id=lecture.id)

    # Capture IDs before the session closes at end of request.
    lecture_id = lecture.id
    run_id = run.id

    # The extraction service creates its own DB session so it is safe to run
    # after this request's session closes.
    background_tasks.add_task(
        run_study_extraction,
        lecture_id=lecture_id,
        run_id=run_id,
        org_id=org_id,
    )

    logger.info(
        "study: queued extraction background task lecture=%s run=%s", lecture_id, run_id
    )
    return StudyExtractionCreatedResponse(lecture_id=lecture_id, extraction_id=run_id)


# ---------------------------------------------------------------------------
# Lecture detail
# ---------------------------------------------------------------------------

@router.get("/study/lectures/{lecture_id}", response_model=StudyLectureDetailResponse)
def get_study_lecture(
    lecture_id: uuid.UUID,
    db:         Session   = Depends(get_db),
    org_id:     uuid.UUID = Depends(get_current_org_id),
):
    lecture = study_repo.get_lecture(db, lecture_id, org_id)
    if lecture is None:
        raise HTTPException(status_code=404, detail="Lecture not found.")

    run = study_repo.get_latest_extraction_run(db, lecture_id, org_id)
    if run is None:
        raise HTTPException(status_code=404, detail="No extraction run found.")

    return StudyLectureDetailResponse(
        lecture=StudyLectureRead.model_validate(lecture),
        extraction=StudyExtractionRunRead.model_validate(run),
        summary=lecture.summary,
        topics=lecture.topics or [],
        learning_objectives=lecture.learning_objectives or [],
        key_concepts=[StudyConceptRead.model_validate(c) for c in lecture.concepts],
        definitions=[StudyDefinitionRead.model_validate(d) for d in lecture.definitions],
        formulas=[StudyFormulaRead.model_validate(f) for f in lecture.formulas],
        flashcards=[StudyFlashcardRead.model_validate(fc) for fc in lecture.flashcards],
        questions=[StudyQuestionRead.model_validate(q) for q in lecture.questions],
        transcript=lecture.transcript,
    )


# ---------------------------------------------------------------------------
# Lecture status polling
# ---------------------------------------------------------------------------

# Map extraction run status → percent-complete estimate shown to the user.
_STATUS_PERCENT: dict[str, int] = {
    "pending":              5,
    "running":             10,
    "extracting_content":  35,
    "generating_questions": 70,
    "completed":          100,
    "failed":               0,
}


@router.get("/study/lectures/{lecture_id}/status", response_model=StudyLectureStatusResponse)
def get_study_lecture_status(
    lecture_id: uuid.UUID,
    db:         Session   = Depends(get_db),
    org_id:     uuid.UUID = Depends(get_current_org_id),
):
    """
    Polling endpoint for the Study Mode processing page.

    Returns the current status of the most recent extraction run for this lecture.
    The frontend should poll every poll_interval_ms milliseconds until
    is_ready=True (redirect to redirect_url) or status="failed".

    Auth: same ownership check as all other lecture endpoints — returns 404
    on ownership mismatch so callers cannot probe another user's lecture IDs.

    Future SSE/WebSocket upgrade: this response shape is the event payload
    contract.  Clients that switch to a push model need no response-parsing changes.
    """
    lecture = study_repo.get_lecture(db, lecture_id, org_id)
    if lecture is None:
        raise HTTPException(status_code=404, detail="Lecture not found.")

    run = study_repo.get_latest_extraction_run(db, lecture_id, org_id)
    if run is None:
        raise HTTPException(status_code=404, detail="No extraction run found.")

    status = run.status
    is_terminal = status in ("completed", "failed")
    is_ready = status == "completed"
    percent = _STATUS_PERCENT.get(status, None)

    # Only expose the error message string — no internal tracebacks.
    safe_error: str | None = None
    if status == "failed" and run.error_message:
        msg = run.error_message
        # Strip anything after the first newline to avoid leaking stack frames.
        safe_error = msg.split("\n")[0][:300]

    redirect_url: str | None = None
    if is_ready:
        redirect_url = f"/study/records/{lecture_id}"

    return StudyLectureStatusResponse(
        lecture_id=lecture_id,
        status=status,
        current_stage=status,
        percent_complete=percent,
        error_message=safe_error,
        is_ready=is_ready,
        last_updated_at=run.updated_at,
        redirect_url=redirect_url,
        poll_interval_ms=None if is_terminal else 3000,
    )


# ---------------------------------------------------------------------------
# Overview / summary update
# ---------------------------------------------------------------------------

@router.patch("/study/lectures/{lecture_id}/overview")
def update_study_overview(
    lecture_id: uuid.UUID,
    body:       StudyOverviewUpdateRequest,
    db:         Session   = Depends(get_db),
    org_id:     uuid.UUID = Depends(get_current_org_id),
):
    lecture = study_repo.get_lecture(db, lecture_id, org_id)
    if lecture is None:
        raise HTTPException(status_code=404, detail="Lecture not found.")

    study_repo.update_overview(db, lecture, summary=body.summary)
    return {"updated": True}


# ---------------------------------------------------------------------------
# Flashcard update
# ---------------------------------------------------------------------------

@router.patch(
    "/study/lectures/{lecture_id}/flashcards/{flashcard_id}",
    response_model=StudyFlashcardRead,
)
def update_study_flashcard(
    lecture_id:   uuid.UUID,
    flashcard_id: uuid.UUID,
    body:         StudyFlashcardUpdateRequest,
    db:           Session   = Depends(get_db),
    org_id:       uuid.UUID = Depends(get_current_org_id),
):
    # Layer 1: verify lecture belongs to caller
    lecture = study_repo.get_lecture(db, lecture_id, org_id)
    if lecture is None:
        raise HTTPException(status_code=404, detail="Lecture not found.")

    # Layer 2: verify flashcard belongs to that lecture
    fc = study_repo.get_flashcard(db, flashcard_id, lecture_id)
    if fc is None:
        raise HTTPException(status_code=404, detail="Flashcard not found.")

    study_repo.update_flashcard(db, fc, front=body.front, back=body.back)
    return StudyFlashcardRead.model_validate(fc)


# ---------------------------------------------------------------------------
# Question update
# ---------------------------------------------------------------------------

@router.patch(
    "/study/lectures/{lecture_id}/questions/{question_id}",
    response_model=StudyQuestionRead,
)
def update_study_question(
    lecture_id:  uuid.UUID,
    question_id: uuid.UUID,
    body:        StudyQuestionUpdateRequest,
    db:          Session   = Depends(get_db),
    org_id:      uuid.UUID = Depends(get_current_org_id),
):
    # Layer 1: verify lecture belongs to caller
    lecture = study_repo.get_lecture(db, lecture_id, org_id)
    if lecture is None:
        raise HTTPException(status_code=404, detail="Lecture not found.")

    # Layer 2: verify question belongs to that lecture
    q = study_repo.get_question(db, question_id, lecture_id)
    if q is None:
        raise HTTPException(status_code=404, detail="Question not found.")

    study_repo.update_question(
        db, q,
        question=body.question,
        answer_short=body.answer_short,
        answer_exam=body.answer_exam,
        answer_detailed=body.answer_detailed,
        options=body.options,
        difficulty=body.difficulty,
        is_hidden=body.is_hidden,
    )
    return StudyQuestionRead.model_validate(q)


# ---------------------------------------------------------------------------
# Archive lecture
# ---------------------------------------------------------------------------

@router.post("/study/lectures/{lecture_id}/archive", response_model=StudyArchiveResponse)
def archive_study_lecture(
    lecture_id: uuid.UUID,
    db:         Session   = Depends(get_db),
    org_id:     uuid.UUID = Depends(get_current_org_id),
):
    lecture = study_repo.get_lecture(db, lecture_id, org_id)
    if lecture is None:
        raise HTTPException(status_code=404, detail="Lecture not found.")

    study_repo.archive_lecture(db, lecture)
    return StudyArchiveResponse(lecture_id=lecture.id, archive_status=lecture.archive_status)


# ---------------------------------------------------------------------------
# Course aggregate
# ---------------------------------------------------------------------------

@router.get("/study/courses/{course_name}", response_model=StudyCourseDetailResponse)
def get_study_course(
    course_name: str,
    db:          Session   = Depends(get_db),
    org_id:      uuid.UUID = Depends(get_current_org_id),
):
    """
    Return an aggregate view of a course scoped to the calling user.

    The org_id filter inside get_course_lectures is the isolation boundary:
    two users can have courses with the same name without seeing each other's
    data. Returning 404 when lectures is empty means users cannot probe whether
    another user has a course with a given name.
    """
    lectures = study_repo.get_course_lectures(db, course_name, org_id)
    if not lectures:
        raise HTTPException(status_code=404, detail="Course not found.")

    # ── Aggregate counts ──────────────────────────────────────────────────────
    total_flashcards = sum(len(lec.flashcards) for lec in lectures)
    total_questions  = sum(len(lec.questions)  for lec in lectures)
    total_concepts   = sum(len(lec.concepts)   for lec in lectures)

    all_confidences = [c.confidence for lec in lectures for c in lec.concepts]
    avg_confidence  = sum(all_confidences) / len(all_confidences) if all_confidences else None

    last_updated = max((lec.updated_at for lec in lectures), default=None)

    # ── Per-lecture summary items ─────────────────────────────────────────────
    lecture_items: list[CourseLectureItem] = []
    for lec in lectures:
        lec_conf = [c.confidence for c in lec.concepts]
        lecture_items.append(CourseLectureItem(
            lecture_id=lec.id,
            title=lec.title,
            lecture_date=lec.lecture_date,
            archive_status=lec.archive_status,
            flashcard_count=len(lec.flashcards),
            question_count=len(lec.questions),
            concept_count=len(lec.concepts),
            topic_count=len(lec.topics or []),
            avg_confidence=sum(lec_conf) / len(lec_conf) if lec_conf else None,
            created_at=lec.created_at,
        ))

    # ── Topic frequencies ─────────────────────────────────────────────────────
    topic_counter: Counter[str] = Counter()
    for lec in lectures:
        for topic in (lec.topics or []):
            topic_counter[topic] += 1
    topic_frequencies = [
        CourseTopicFrequency(topic=t, lecture_count=c)
        for t, c in topic_counter.most_common(20)
    ]

    # ── Concepts repeated across lectures ─────────────────────────────────────
    concept_map: dict[str, list] = {}
    for lec in lectures:
        for c in lec.concepts:
            key = c.concept.lower().strip()
            concept_map.setdefault(key, []).append(c)

    repeated_concepts = [
        CourseRepeatedConcept(
            concept=items[0].concept,
            explanation=items[0].explanation,
            frequency=len(items),
            avg_confidence=sum(i.confidence for i in items) / len(items),
        )
        for _, items in sorted(concept_map.items(), key=lambda x: -len(x[1]))
        if len(items) > 1
    ][:10]

    # ── Sample questions (non-hidden, up to 5) ────────────────────────────────
    sample_questions = [
        StudyQuestionRead.model_validate(q)
        for lec in lectures
        for q in lec.questions
        if not q.is_hidden
    ][:5]

    return StudyCourseDetailResponse(
        course_name=course_name,
        lecture_count=len(lectures),
        total_flashcards=total_flashcards,
        total_questions=total_questions,
        total_concepts=total_concepts,
        avg_confidence=avg_confidence,
        last_updated=last_updated,
        lectures=lecture_items,
        topic_frequencies=topic_frequencies,
        repeated_concepts=repeated_concepts,
        coverage_gaps=[],      # Future: LLM-based gap analysis
        suggested_review=[],   # Future: SR-based review recommendations
        sample_questions=sample_questions,
    )
