"""
Prompt templates for Study Mode extraction.

Two-pass strategy:
  Pass 1 — Content: extract summary, topics, learning objectives,
    key concepts, definitions, and formulas from the lecture transcript.
  Pass 2 — Q&A: generate study questions (multiple types) and flashcards,
    informed by the concepts extracted in Pass 1.

Template slugs (must match StudyLecture.template_slug in the DB):
  lecture_notes  (default)  — broad; all field types; balanced Q&A
  stem                      — emphasises formulas, proofs, numerical examples
  business                  — case studies, frameworks, decisions, metrics
  law                       — statutes, cases, principles, arguments
  language                  — vocabulary, grammar, phrases, usage
  exam_prep                 — maximal Q&A, exam hints, MCQ with distractors
"""

from app.domain.study_llm_schemas import StudyConceptItem, StudyDefinitionItem

# ---------------------------------------------------------------------------
# Pass 1 — Content extraction
# ---------------------------------------------------------------------------

_CONTENT_BASE_SYSTEM = """\
You are a precise academic content extraction assistant working for a study tool.

Your task is to read a lecture transcript and extract structured study content from it.

EXTRACTION RULES — follow exactly:

1. Only extract information that is explicitly stated or directly implied in the transcript.
   Never hallucinate, infer beyond what is present, or add background knowledge.
2. evidence_snippet MUST be a verbatim quote from the transcript — the shortest span that
   supports or introduces the extracted item.  Do not paraphrase.  Use null if no clear quote.
3. confidence reflects how strongly and clearly the item is covered (0.0–1.0):
   - 0.90–1.00: explicitly defined or stated with full coverage
   - 0.70–0.89: clearly present but with some interpretation needed
   - 0.50–0.69: mentioned but briefly or with some ambiguity
   - 0.00–0.49: barely mentioned; use sparingly — omit if too weak
4. Be selective with concepts — extract 5–20 high-value items.
   Skip trivial mentions and prefer items that are central to the lecture.
5. summary must be self-contained and explain the lecture to a student who was absent.
6. topics lists what was taught, in the order it appeared.
7. learning_objectives describe student outcomes using action verbs.
8. formulas: include only formulas explicitly introduced in the lecture.
   If none, return an empty list — do not fabricate formulas.
9. definitions: include only terms that are explicitly defined or where the lecture
   introduces a technical meaning.
"""

_TEMPLATE_ADDENDA: dict[str, str] = {
    "lecture_notes": "",  # no extra instruction — base prompt is appropriate

    "stem": """\

TEMPLATE: STEM LECTURE
- Emphasise mathematical formulas, equations, proofs, and numerical examples.
- For every formula, capture its full notation and describe the meaning of each symbol.
- Include a worked example in the formula's 'example' field if the lecture provides one.
- Learning objectives should reflect quantitative or derivation skills (e.g. 'Derive...', 'Calculate...').
- If the lecture has no formulas, return an empty formulas list — do not fabricate.
""",

    "business": """\

TEMPLATE: BUSINESS / CASE STUDY
- Focus on strategic frameworks, business models, case study outcomes, financial metrics.
- Concepts should cover frameworks (e.g. Porter's Five Forces), key decisions, and outcomes.
- Definitions should cover business jargon and terminology introduced in the lecture.
- Do NOT extract formulas unless the lecture explicitly uses quantitative models.
- Learning objectives should reflect analytical and evaluative skills.
""",

    "law": """\

TEMPLATE: LAW / POLICY
- Extract cases, statutes, legal principles, doctrines, and policy arguments.
- Concepts should include holdings, rules, and tests introduced in the lecture.
- Definitions should cover legal terms of art and jurisdiction-specific vocabulary.
- evidence_snippet is especially important here — verbatim quotes ground legal analysis.
- Learning objectives should reflect application and analysis skills (e.g. 'Apply the rule in...').
""",

    "language": """\

TEMPLATE: LANGUAGE LEARNING
- Extract vocabulary items, grammar rules, idiomatic phrases, and usage notes.
- Each vocabulary term → definition pair should appear as both a concept and a definition.
- For grammar rules, explain the rule in the 'explanation' field with a short example.
- formulas list should be empty unless the lecture covers phonetic notation.
- learning_objectives should reflect communicative or productive skills.
""",

    "exam_prep": """\

TEMPLATE: EXAM PREPARATION
- Extract every concept, definition, and formula that could appear on an exam.
- Be more inclusive than usual — err on the side of capturing too much.
- Tag each concept with a confidence score reflecting its likely exam importance.
- learning_objectives should be phrased as exam outcomes.
- Flag any topic where the transcript is thin — this informs question difficulty.
""",
}


def build_content_system_prompt(template_slug: str) -> str:
    """Return the full system prompt for Pass 1, template-adjusted."""
    addendum = _TEMPLATE_ADDENDA.get(template_slug, _TEMPLATE_ADDENDA["lecture_notes"])
    return _CONTENT_BASE_SYSTEM + addendum


def build_content_user_message(transcript: str, template_slug: str) -> str:
    template_label = {
        "lecture_notes": "General Lecture",
        "stem": "STEM Lecture",
        "business": "Business / Case Study",
        "law": "Law / Policy",
        "language": "Language Learning",
        "exam_prep": "Exam Preparation",
    }.get(template_slug, "General Lecture")

    return (
        f"Extract structured study content from the following lecture transcript.\n"
        f"Template: {template_label}\n\n"
        f"TRANSCRIPT:\n{transcript}"
    )


def build_content_user_message_chunk(
    transcript_chunk: str,
    chunk_index: int,
    total_chunks: int,
    template_slug: str,
) -> str:
    """User message for a single chunk when the transcript has been split."""
    template_label = {
        "lecture_notes": "General Lecture",
        "stem": "STEM Lecture",
        "business": "Business / Case Study",
        "law": "Law / Policy",
        "language": "Language Learning",
        "exam_prep": "Exam Preparation",
    }.get(template_slug, "General Lecture")

    return (
        f"Extract structured study content from chunk {chunk_index + 1} of {total_chunks} "
        f"of a lecture transcript.\n"
        f"Template: {template_label}\n\n"
        f"NOTE: This is one portion of a longer lecture.  Extract only what is present "
        f"in this chunk.  The results from all chunks will be merged.\n\n"
        f"TRANSCRIPT CHUNK:\n{transcript_chunk}"
    )


# ---------------------------------------------------------------------------
# Pass 2 — Q&A generation
# ---------------------------------------------------------------------------

_QA_BASE_SYSTEM = """\
You are an expert study-material author generating high-quality assessment content.

Your task is to create study questions and flashcards from a lecture transcript and
a list of key concepts already extracted from it.

GENERATION RULES:

1. All questions and flashcards MUST be grounded in the transcript.
   Never introduce content that is not in the lecture.
2. evidence_snippet must be a verbatim quote from the transcript.
3. Distribute difficulty: aim for roughly 30% easy, 50% medium, 20% hard.
4. question_type distribution (adjust based on template):
   - important: conceptual understanding questions (no MCQ options)
   - short_answer: one-sentence factual questions
   - mcq: multiple choice with exactly 4 options (A–D), one correct answer, and three
     plausible distractors based on common student misconceptions
   - essay: open-ended questions requiring a multi-paragraph response
   - exam: structured exam-style questions, potentially multi-part
5. For MCQ questions:
   - The question must be answerable from the transcript alone.
   - Distractors should be plausible but clearly wrong given the lecture content.
   - Set is_correct=true on exactly one option.
6. answer_exam must be provided for ALL questions — it is the primary answer shown to students.
7. Flashcards should be atomic: each card tests exactly one fact, term, or concept.
   Front side: a prompt or question.  Back side: a concise, self-contained answer.
8. topic_tags must match the exact topic strings from the topics list provided.
9. source_coverage: estimate what fraction of the lecture is about this question's topic.
"""

_QA_TEMPLATE_ADDENDA: dict[str, str] = {
    "lecture_notes": "",

    "stem": """\

TEMPLATE: STEM
- Include questions that require calculation or formula application.
- Flashcards should cover formula notation, symbol meanings, and units.
- At least 30% of questions should involve quantitative reasoning.
- For MCQ, use numerical distractors (e.g., off-by-one errors, wrong units).
""",

    "business": """\

TEMPLATE: BUSINESS
- Questions should test analytical application of frameworks to scenarios.
- Include questions that ask students to evaluate or recommend a course of action.
- Flashcards should cover framework steps, key metrics, and case study outcomes.
- Essay questions should ask students to apply a framework to a hypothetical.
""",

    "law": """\

TEMPLATE: LAW
- Questions should test application of rules to hypothetical facts (IRAC format).
- Include questions about case holdings, statutory interpretation, and policy rationale.
- Flashcards should cover the full name and holding of cases and statutory provisions.
- For MCQ, use fact patterns with subtly different outcomes.
""",

    "language": """\

TEMPLATE: LANGUAGE LEARNING
- Flashcards should be term → translation or prompt → completion format.
- Include questions about grammar rule application and usage context.
- Avoid metalinguistic questions — focus on practical language use.
- Short_answer questions should test recall of vocabulary or grammar forms.
""",

    "exam_prep": """\

TEMPLATE: EXAM PREPARATION
- Maximise question quantity — generate 15–20 questions and 25–30 flashcards.
- Include a higher proportion of MCQ and exam-type questions.
- MCQ distractors should target predictable exam misconceptions.
- Add exam hints in the answer_detailed field where relevant.
- Mark high-exam-likelihood questions with source_coverage >= 0.6.
""",
}


def build_qa_system_prompt(template_slug: str) -> str:
    addendum = _QA_TEMPLATE_ADDENDA.get(template_slug, _QA_TEMPLATE_ADDENDA["lecture_notes"])
    return _QA_BASE_SYSTEM + addendum


def build_qa_user_message(
    transcript: str,
    topics: list[str],
    concepts: list[StudyConceptItem],
    definitions: list[StudyDefinitionItem],
    template_slug: str,
) -> str:
    """
    Build the user message for Pass 2.

    Includes the (possibly truncated) transcript, extracted topics,
    and a compact concept + definition list to ground Q&A generation.
    """
    template_label = {
        "lecture_notes": "General Lecture",
        "stem": "STEM Lecture",
        "business": "Business / Case Study",
        "law": "Law / Policy",
        "language": "Language Learning",
        "exam_prep": "Exam Preparation",
    }.get(template_slug, "General Lecture")

    # Compact context block — key info without bloating the prompt
    topics_str = "\n".join(f"  - {t}" for t in topics) if topics else "  (none extracted)"

    concept_lines = [
        f"  - {c.concept}: {c.explanation[:120]}{'...' if len(c.explanation) > 120 else ''}"
        for c in concepts[:25]  # cap to avoid token explosion
    ]
    concepts_str = "\n".join(concept_lines) if concept_lines else "  (none extracted)"

    def_lines = [
        f"  - {d.term}: {d.definition[:100]}{'...' if len(d.definition) > 100 else ''}"
        for d in definitions[:20]
    ]
    defs_str = "\n".join(def_lines) if def_lines else "  (none extracted)"

    return (
        f"Generate study questions and flashcards for the following lecture.\n"
        f"Template: {template_label}\n\n"
        f"EXTRACTED TOPICS:\n{topics_str}\n\n"
        f"KEY CONCEPTS (use these to ground your questions):\n{concepts_str}\n\n"
        f"KEY DEFINITIONS:\n{defs_str}\n\n"
        f"LECTURE TRANSCRIPT:\n{transcript}"
    )
