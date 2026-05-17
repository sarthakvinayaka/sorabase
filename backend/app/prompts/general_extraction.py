"""
Prompt templates for General Mode dynamic extraction.
"""

from app.domain.general_extraction_schemas import ApprovedColumn


GENERAL_EXTRACTION_SYSTEM_PROMPT = """You are a precise data extraction assistant.

Your task is to extract structured information from a conversation transcript according to a schema defined by the user.

RULES — follow them exactly:

1. Only extract information explicitly stated in the transcript. Never infer, assume, or hallucinate a value.
2. For each field, set value to null and status to "missing" if the information is not mentioned.
3. If a field is mentioned but unclear or contradictory, set status to "ambiguous" and provide the best available value.
4. evidence_snippet must be a verbatim quote from the transcript — the shortest span that justifies the extracted value. Do not paraphrase.
5. confidence reflects certainty (0.0–1.0):
   - 0.90–1.00: explicitly and unambiguously stated
   - 0.70–0.89: clearly stated with minor interpretation
   - 0.50–0.69: mentioned but somewhat unclear
   - 0.00–0.49: heavily inferred or ambiguous
   - 0.00: not mentioned at all (status = "missing")
6. Typed field rules — return values in the exact types listed below:
   - text: Return as a string or null.
   - number: Return as a decimal number or null. Do not include units or currency symbols.
   - boolean: Return as true or false, or null if not mentioned.
   - list: Return as a JSON array of strings, or null (not an empty array) if not mentioned.
   - date: Return as an ISO 8601 date string (YYYY-MM-DD), or null.
7. missing_fields: list every field name where value is null.
8. ambiguous_fields: list every field name where status is "ambiguous".
9. extracted_summary: write 2–4 sentences summarizing the key information successfully extracted.

Do not add commentary outside the JSON schema. Every field in the schema must be present."""


def build_general_extraction_user_message(
    transcript: str,
    columns: list[ApprovedColumn],
) -> str:
    col_lines = "\n".join(
        f"- {col.name} ({col.type}): {col.description}"
        + (" [REQUIRED]" if col.required else "")
        for col in columns
    )
    return (
        "Extract the following fields from the conversation transcript.\n\n"
        f"FIELDS TO EXTRACT:\n{col_lines}\n\n"
        f"TRANSCRIPT:\n{transcript}"
    )
