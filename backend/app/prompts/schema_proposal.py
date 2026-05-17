"""
Prompt templates for General Mode schema proposal.

The goal is to analyze a conversation's transcript (and optional summary) and
suggest 5–15 extraction columns that a user would actually query or filter on.
"""

_TRANSCRIPT_WINDOW = 8_000  # chars sent to the model when transcript is longer


SCHEMA_PROPOSAL_SYSTEM_PROMPT = """\
You are a structured-data design assistant.

Your task is to read a conversation transcript (and optional summary) and propose \
5 to 15 useful extraction columns that would help a user structure and retrieve \
information from this type of conversation.

RULES — follow them exactly:
1. Propose BETWEEN 5 and 15 columns — no fewer, no more.
2. Each column name must be in snake_case (e.g. meeting_purpose, action_items, budget_discussed). \
   Only lowercase letters, digits, and underscores. No spaces or hyphens.
3. Each description must be 1–2 sentences explaining what the column captures \
   and why it is useful for querying or filtering.
4. Choose the most appropriate type:
   - text    → a single string value (names, titles, descriptions, quotes, summaries)
   - number  → a numeric value (amounts, counts, durations in minutes, scores, ratings)
   - boolean → a yes/no fact (did X happen, was Y agreed, is Z present)
   - list    → multiple values of the same kind (people, topics, items, tasks, tags)
   - date    → a date, time, or date-time value
5. Set required=true only if the information is very likely to be present in most \
   conversations of this type. Set required=false if it is conditional or optional.
6. Be specific to this conversation's actual domain and content — generic columns \
   like "notes" or "summary" are acceptable only if they directly add value here.
7. Prioritise columns a user would actually query, sort, or filter on later.
8. Do not duplicate columns. Each name must be unique.
9. The rationale must be 2–4 sentences explaining why these specific columns \
   were chosen for this conversation type.

Do not add any commentary outside the JSON schema. Return exactly the structure requested.\
"""


def build_schema_proposal_user_message(transcript: str, summary: str | None) -> str:
    """
    Build the user message for the schema proposal prompt.

    If a summary is available it is included first (higher signal density).
    The transcript is truncated at _TRANSCRIPT_WINDOW chars to avoid token overflow
    while still giving the model enough context to understand the domain.
    """
    parts: list[str] = [
        "Analyze the following conversation and propose useful extraction columns.\n",
    ]

    if summary and summary.strip():
        parts.append(f"SUMMARY:\n{summary.strip()}\n")

    truncated = transcript[:_TRANSCRIPT_WINDOW]
    parts.append(f"TRANSCRIPT:\n{truncated}")

    if len(transcript) > _TRANSCRIPT_WINDOW:
        parts.append(
            f"\n[Transcript truncated — {len(transcript):,} total chars, showing first {_TRANSCRIPT_WINDOW:,}]"
        )

    return "\n".join(parts)
