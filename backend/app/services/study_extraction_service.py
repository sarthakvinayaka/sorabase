"""
Study Mode extraction service.

Orchestrates end-to-end processing of a lecture:
  1. Load conversation + validate transcript exists
  2. Update run status → running
  3. Chunk transcript if > MAX_CONTENT_CHARS
  4. Pass 1 (extracting_content): summary, topics, objectives, concepts,
     definitions, formulas — with per-chunk extraction + merge for long lectures
  5. Persist Pass-1 output to lecture + child tables
  6. Pass 2 (generating_questions): questions + flashcards, grounded by Pass-1 concepts
  7. Persist Pass-2 output
  8. Update run status → completed
  On any unhandled exception: update run status → failed, record error_message.

Invoked as a FastAPI BackgroundTask from POST /study/extract.  Runs with its
own DB session (created inside the task) so it outlives the HTTP request.

Chunking strategy:
  Transcripts over MAX_CONTENT_CHARS are split at paragraph / sentence
  boundaries into segments of at most MAX_CONTENT_CHARS each.  Each segment
  is processed independently with Pass 1.  The results are merged:
    - summary:             first chunk's summary (or first N words of each chunk
                           joined if very long)
    - topics / objectives: union, order-preserved, deduped
    - concepts:            concatenated, deduped by normalised concept name
    - definitions:         concatenated, deduped by normalised term
    - formulas:            concatenated, deduped by normalised notation
  Pass 2 always runs on a single truncated transcript (MAX_QA_CHARS) enriched
  with the merged Pass-1 concept list.
"""

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

import openai
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import SessionLocal
from app.domain.study_llm_schemas import (
    StudyConceptItem,
    StudyContentLLMResponse,
    StudyDefinitionItem,
    StudyFormulaItem,
    StudyQALLMResponse,
)
from app.prompts.study_extraction import (
    build_content_system_prompt,
    build_content_user_message,
    build_content_user_message_chunk,
    build_qa_system_prompt,
    build_qa_user_message,
)
from app.repositories import study_repo

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tuning constants
# ---------------------------------------------------------------------------

# Maximum transcript characters sent to a single content-extraction call.
# ~30 K chars ≈ 7.5 K tokens; well within gpt-4o's window leaving room for
# the structured-output schema and response.
MAX_CONTENT_CHARS: int = 30_000

# Minimum segment size before we consider a split (avoids tiny orphan chunks).
MIN_CHUNK_CHARS: int = 8_000

# Maximum transcript characters for the Q&A pass.  We truncate here because
# the Q&A prompt already includes concept context, and a shorter transcript
# produces better-focused questions.
MAX_QA_CHARS: int = 40_000

# OpenAI call timeout (seconds).  Long enough for a structured-output call
# against a 30 K-token context; short enough to fail fast on hangs.
_CALL_TIMEOUT: int = 90

# Number of automatic retries on transient OpenAI errors before giving up.
_MAX_RETRIES: int = 2


# ---------------------------------------------------------------------------
# Public error types
# ---------------------------------------------------------------------------

class StudyExtractionError(Exception):
    """Raised on unrecoverable extraction failure."""


class TranscriptNotAvailableError(StudyExtractionError):
    """Raised when the conversation has no transcript text."""


# ---------------------------------------------------------------------------
# Internal result containers
# ---------------------------------------------------------------------------

@dataclass
class _MergedContent:
    """Holds the merged result of one or more content-extraction calls."""
    summary: str = ""
    topics: list[str] = field(default_factory=list)
    learning_objectives: list[str] = field(default_factory=list)
    concepts: list[StudyConceptItem] = field(default_factory=list)
    definitions: list[StudyDefinitionItem] = field(default_factory=list)
    formulas: list[StudyFormulaItem] = field(default_factory=list)
    total_prompt_tokens: int = 0
    total_completion_tokens: int = 0
    model_used: str = ""


# ---------------------------------------------------------------------------
# Entry point — called from BackgroundTask
# ---------------------------------------------------------------------------

def run_study_extraction(
    lecture_id: uuid.UUID,
    run_id: uuid.UUID,
    org_id: uuid.UUID,
) -> None:
    """
    Top-level entry point.  Creates its own DB session so it can run safely
    inside a FastAPI BackgroundTask after the request session has closed.
    """
    db = SessionLocal()
    try:
        _extract(db, lecture_id=lecture_id, run_id=run_id, org_id=org_id)
    except Exception:
        # _extract already marks the run as failed and commits.  Re-raise so
        # FastAPI logs the traceback for observability.
        raise
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Internal orchestrator
# ---------------------------------------------------------------------------

def _extract(
    db: Session,
    *,
    lecture_id: uuid.UUID,
    run_id: uuid.UUID,
    org_id: uuid.UUID,
) -> None:
    """
    Full extraction pipeline for one lecture.  All DB mutations go through
    study_repo so ownership checks are in one place.
    """
    # ── Load records ─────────────────────────────────────────────────────────
    lecture = study_repo.get_lecture(db, lecture_id, org_id)
    if lecture is None:
        logger.error("study_extraction: lecture %s not found for org %s", lecture_id, org_id)
        return

    run = study_repo.get_extraction_run(db, run_id, org_id)
    if run is None:
        logger.error("study_extraction: run %s not found for org %s", run_id, org_id)
        return

    # ── Resolve transcript ────────────────────────────────────────────────────
    # The conversation is created before the lecture, so raw_text should be ready.
    # Guard against race conditions (audio upload still in progress).
    conversation = db.get(
        __import__("app.db.models", fromlist=["Conversation"]).Conversation,
        lecture.conversation_id,
    )
    if conversation is None or not conversation.raw_text:
        _fail(db, run, "Transcript not available — conversation has no raw_text.")
        return

    transcript: str = conversation.raw_text.strip()
    if not transcript:
        _fail(db, run, "Transcript is empty.")
        return

    template_slug: str = lecture.template_slug or "lecture_notes"

    # ── Mark running ─────────────────────────────────────────────────────────
    study_repo.update_extraction_run(db, run, status="running")
    logger.info(
        "study_extraction: started lecture=%s run=%s chars=%d template=%s",
        lecture_id, run_id, len(transcript), template_slug,
    )

    # ── Pass 1: Content extraction ────────────────────────────────────────────
    try:
        study_repo.update_extraction_run(db, run, status="extracting_content")
        merged = _run_content_pass(transcript, template_slug)
    except StudyExtractionError as exc:
        _fail(db, run, str(exc))
        return
    except Exception as exc:
        _fail(db, run, f"Unexpected error in content pass: {exc}")
        logger.exception("study_extraction: content pass failed for lecture %s", lecture_id)
        return

    # ── Persist Pass-1 output ─────────────────────────────────────────────────
    try:
        study_repo.set_lecture_content(
            db, lecture,
            summary=merged.summary,
            topics=merged.topics,
            learning_objectives=merged.learning_objectives,
            transcript=transcript,
        )
        study_repo.bulk_create_concepts(db, lecture_id, merged.concepts)
        study_repo.bulk_create_definitions(db, lecture_id, merged.definitions)
        study_repo.bulk_create_formulas(db, lecture_id, merged.formulas)
    except Exception as exc:
        _fail(db, run, f"Failed to persist content extraction output: {exc}")
        logger.exception("study_extraction: persistence failed for lecture %s", lecture_id)
        return

    logger.info(
        "study_extraction: content done lecture=%s concepts=%d defs=%d formulas=%d",
        lecture_id, len(merged.concepts), len(merged.definitions), len(merged.formulas),
    )

    # ── Pass 2: Q&A generation ────────────────────────────────────────────────
    try:
        study_repo.update_extraction_run(db, run, status="generating_questions")
        qa_result, qa_tokens = _run_qa_pass(
            transcript,
            topics=merged.topics,
            concepts=merged.concepts,
            definitions=merged.definitions,
            template_slug=template_slug,
        )
    except StudyExtractionError as exc:
        # Q&A failure is non-fatal — we already have the content.
        # Mark completed-partial instead of failed so the user can see results.
        logger.warning(
            "study_extraction: Q&A pass failed for lecture %s — saving partial: %s",
            lecture_id, exc,
        )
        study_repo.update_extraction_run(
            db, run,
            status="completed",
            model_used=merged.model_used or settings.openai_model,
            prompt_tokens=merged.total_prompt_tokens,
            completion_tokens=merged.total_completion_tokens,
            error_message=f"Q&A generation failed (content saved): {exc}",
        )
        return
    except Exception as exc:
        logger.warning(
            "study_extraction: Q&A pass unexpected error for lecture %s: %s",
            lecture_id, exc,
        )
        study_repo.update_extraction_run(
            db, run,
            status="completed",
            model_used=merged.model_used or settings.openai_model,
            prompt_tokens=merged.total_prompt_tokens,
            completion_tokens=merged.total_completion_tokens,
            error_message=f"Q&A generation failed (content saved): {exc}",
        )
        return

    # ── Persist Pass-2 output ─────────────────────────────────────────────────
    try:
        study_repo.bulk_create_flashcards(db, lecture_id, qa_result.flashcards)
        study_repo.bulk_create_questions(db, lecture_id, qa_result.questions)
    except Exception as exc:
        logger.exception("study_extraction: Q&A persistence failed for lecture %s", lecture_id)
        study_repo.update_extraction_run(
            db, run,
            status="completed",
            model_used=merged.model_used or settings.openai_model,
            prompt_tokens=merged.total_prompt_tokens + qa_tokens[0],
            completion_tokens=merged.total_completion_tokens + qa_tokens[1],
            error_message=f"Q&A persistence failed (content saved): {exc}",
        )
        return

    # ── Mark completed ────────────────────────────────────────────────────────
    total_prompt = merged.total_prompt_tokens + qa_tokens[0]
    total_completion = merged.total_completion_tokens + qa_tokens[1]
    study_repo.update_extraction_run(
        db, run,
        status="completed",
        model_used=merged.model_used or settings.openai_model,
        prompt_tokens=total_prompt,
        completion_tokens=total_completion,
    )

    logger.info(
        "study_extraction: completed lecture=%s questions=%d flashcards=%d "
        "tokens=(%d prompt / %d completion)",
        lecture_id,
        len(qa_result.questions),
        len(qa_result.flashcards),
        total_prompt,
        total_completion,
    )


# ---------------------------------------------------------------------------
# Pass 1: Content extraction (with chunking + merge)
# ---------------------------------------------------------------------------

def _run_content_pass(transcript: str, template_slug: str) -> _MergedContent:
    """
    Run the content-extraction pass, chunking the transcript if it is too long.
    Returns a merged _MergedContent object.
    """
    chunks = _chunk_transcript(transcript, MAX_CONTENT_CHARS)

    if len(chunks) == 1:
        result, pt, ct, model = _call_content_api(chunks[0], template_slug, chunk_index=None)
        return _MergedContent(
            summary=result.summary,
            topics=result.topics,
            learning_objectives=result.learning_objectives,
            concepts=result.concepts,
            definitions=result.definitions,
            formulas=result.formulas,
            total_prompt_tokens=pt,
            total_completion_tokens=ct,
            model_used=model,
        )

    # Multi-chunk: extract per chunk then merge
    logger.info("study_extraction: transcript %d chars → %d chunks", len(transcript), len(chunks))
    per_chunk: list[StudyContentLLMResponse] = []
    total_pt = total_ct = 0
    model_used = ""

    for i, chunk in enumerate(chunks):
        result, pt, ct, model = _call_content_api(
            chunk, template_slug, chunk_index=i, total_chunks=len(chunks)
        )
        per_chunk.append(result)
        total_pt += pt
        total_ct += ct
        model_used = model

    return _merge_content_chunks(per_chunk, total_pt, total_ct, model_used)


def _call_content_api(
    transcript: str,
    template_slug: str,
    *,
    chunk_index: int | None,
    total_chunks: int = 1,
) -> tuple[StudyContentLLMResponse, int, int, str]:
    """
    Single OpenAI Structured Outputs call for content extraction.
    Returns (response, prompt_tokens, completion_tokens, model_used).
    Raises StudyExtractionError on unrecoverable failure.
    """
    system_prompt = build_content_system_prompt(template_slug)

    if chunk_index is None:
        user_message = build_content_user_message(transcript, template_slug)
    else:
        user_message = build_content_user_message_chunk(
            transcript, chunk_index, total_chunks, template_slug
        )

    client = openai.OpenAI(api_key=settings.openai_api_key)
    last_exc: Exception | None = None

    for attempt in range(_MAX_RETRIES + 1):
        try:
            completion = client.beta.chat.completions.parse(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_message},
                ],
                response_format=StudyContentLLMResponse,
                max_tokens=4096,
                timeout=_CALL_TIMEOUT,
            )
            break  # success
        except openai.RateLimitError as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES:
                import time; time.sleep(5 * (attempt + 1))
                continue
            raise StudyExtractionError("OpenAI rate limit exceeded.") from exc
        except openai.APITimeoutError as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES:
                continue
            raise StudyExtractionError("OpenAI request timed out.") from exc
        except openai.AuthenticationError as exc:
            raise StudyExtractionError("Invalid OpenAI API key.") from exc
        except openai.APIError as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES:
                continue
            raise StudyExtractionError(f"OpenAI API error: {exc}") from exc
    else:
        raise StudyExtractionError(f"OpenAI call failed after retries: {last_exc}")

    msg = completion.choices[0].message
    if msg.refusal:
        raise StudyExtractionError(f"Model refused content extraction: {msg.refusal}")
    if msg.parsed is None:
        raise StudyExtractionError("Model response could not be parsed into StudyContentLLMResponse.")

    usage = completion.usage
    return (
        msg.parsed,
        usage.prompt_tokens if usage else 0,
        usage.completion_tokens if usage else 0,
        completion.model,
    )


def _merge_content_chunks(
    chunks: list[StudyContentLLMResponse],
    total_pt: int,
    total_ct: int,
    model_used: str,
) -> _MergedContent:
    """
    Merge multiple per-chunk Pass-1 results into a single _MergedContent.

    Merge strategy:
      summary:             concatenate chunk summaries separated by a space,
                           prefixed with a [Part N] label so the reader knows
                           it spans multiple sections.
      topics / objectives: union in order of first appearance, case-insensitive dedup.
      concepts:            union; dedup by normalised concept name (keep highest confidence).
      definitions:         union; dedup by normalised term (keep highest confidence).
      formulas:            union; dedup by normalised notation (keep highest confidence).
    """
    # Summary: join chunk summaries into a flowing multi-section summary
    if len(chunks) == 1:
        merged_summary = chunks[0].summary
    else:
        parts = [f"[Part {i+1}] {c.summary}" for i, c in enumerate(chunks)]
        merged_summary = "  ".join(parts)

    # Topics / objectives: order-preserved dedup
    def _dedup_ordered(lists: list[list[str]]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for lst in lists:
            for item in lst:
                key = item.strip().lower()
                if key not in seen:
                    seen.add(key)
                    out.append(item)
        return out

    merged_topics = _dedup_ordered([c.topics for c in chunks])
    merged_objectives = _dedup_ordered([c.learning_objectives for c in chunks])

    # Concepts: dedup by normalised name, keep highest confidence
    concept_map: dict[str, StudyConceptItem] = {}
    for chunk in chunks:
        for item in chunk.concepts:
            key = item.concept.strip().lower()
            if key not in concept_map or item.confidence > concept_map[key].confidence:
                concept_map[key] = item
    merged_concepts = list(concept_map.values())

    # Definitions: dedup by normalised term
    def_map: dict[str, StudyDefinitionItem] = {}
    for chunk in chunks:
        for item in chunk.definitions:
            key = item.term.strip().lower()
            if key not in def_map or item.confidence > def_map[key].confidence:
                def_map[key] = item
    merged_defs = list(def_map.values())

    # Formulas: dedup by normalised notation
    formula_map: dict[str, StudyFormulaItem] = {}
    for chunk in chunks:
        for item in chunk.formulas:
            key = item.notation.strip().lower()
            if key not in formula_map or item.confidence > formula_map[key].confidence:
                formula_map[key] = item
    merged_formulas = list(formula_map.values())

    return _MergedContent(
        summary=merged_summary,
        topics=merged_topics[:15],           # cap to avoid runaway lists
        learning_objectives=merged_objectives[:10],
        concepts=merged_concepts[:30],
        definitions=merged_defs[:40],
        formulas=merged_formulas[:20],
        total_prompt_tokens=total_pt,
        total_completion_tokens=total_ct,
        model_used=model_used,
    )


# ---------------------------------------------------------------------------
# Pass 2: Q&A generation
# ---------------------------------------------------------------------------

def _run_qa_pass(
    transcript: str,
    *,
    topics: list[str],
    concepts: list[StudyConceptItem],
    definitions: list[StudyDefinitionItem],
    template_slug: str,
) -> tuple[StudyQALLMResponse, tuple[int, int]]:
    """
    Run the Q&A generation pass.
    Returns (StudyQALLMResponse, (prompt_tokens, completion_tokens)).
    Raises StudyExtractionError on unrecoverable failure.
    """
    truncated_transcript = transcript[:MAX_QA_CHARS]
    system_prompt = build_qa_system_prompt(template_slug)
    user_message = build_qa_user_message(
        truncated_transcript, topics, concepts, definitions, template_slug
    )

    client = openai.OpenAI(api_key=settings.openai_api_key)
    last_exc: Exception | None = None

    for attempt in range(_MAX_RETRIES + 1):
        try:
            completion = client.beta.chat.completions.parse(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_message},
                ],
                response_format=StudyQALLMResponse,
                max_tokens=6144,   # Q&A output can be larger than content output
                timeout=_CALL_TIMEOUT,
            )
            break
        except openai.RateLimitError as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES:
                import time; time.sleep(5 * (attempt + 1))
                continue
            raise StudyExtractionError("OpenAI rate limit exceeded (Q&A pass).") from exc
        except openai.APITimeoutError as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES:
                continue
            raise StudyExtractionError("OpenAI request timed out (Q&A pass).") from exc
        except openai.AuthenticationError as exc:
            raise StudyExtractionError("Invalid OpenAI API key.") from exc
        except openai.APIError as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES:
                continue
            raise StudyExtractionError(f"OpenAI API error (Q&A pass): {exc}") from exc
    else:
        raise StudyExtractionError(f"OpenAI Q&A call failed after retries: {last_exc}")

    msg = completion.choices[0].message
    if msg.refusal:
        raise StudyExtractionError(f"Model refused Q&A generation: {msg.refusal}")
    if msg.parsed is None:
        raise StudyExtractionError("Model response could not be parsed into StudyQALLMResponse.")

    usage = completion.usage
    pt = usage.prompt_tokens if usage else 0
    ct = usage.completion_tokens if usage else 0
    return msg.parsed, (pt, ct)


# ---------------------------------------------------------------------------
# Chunking helper
# ---------------------------------------------------------------------------

def _chunk_transcript(text: str, max_chars: int) -> list[str]:
    """
    Split a long transcript into chunks of at most max_chars characters.

    Breaks at paragraph boundaries (\\n\\n), then newlines, then sentence-
    ending punctuation, then spaces — always at or before the max_chars limit.
    Chunks smaller than MIN_CHUNK_CHARS are merged into the next one to avoid
    tiny orphan segments.
    """
    if len(text) <= max_chars:
        return [text]

    chunks: list[str] = []
    remaining = text

    while len(remaining) > max_chars:
        segment = remaining[:max_chars]

        # Try successively coarser break points
        cut = -1
        for separator in ["\n\n", "\n", ". ", "? ", "! ", " "]:
            idx = segment.rfind(separator)
            if idx >= MIN_CHUNK_CHARS:
                cut = idx + len(separator)
                break

        if cut == -1:
            # No suitable break found — hard-cut at max_chars
            cut = max_chars

        chunks.append(remaining[:cut])
        remaining = remaining[cut:]

    if remaining.strip():
        chunks.append(remaining)

    return chunks


# ---------------------------------------------------------------------------
# Failure helper
# ---------------------------------------------------------------------------

def _fail(db: Session, run, message: str) -> None:
    """Mark the extraction run as failed and commit."""
    try:
        study_repo.update_extraction_run(db, run, status="failed", error_message=message)
        logger.error("study_extraction: failed run=%s — %s", run.id, message)
    except Exception:
        logger.exception("study_extraction: could not persist failure status for run %s", run.id)
