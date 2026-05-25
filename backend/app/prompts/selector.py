"""
Central prompt selector — returns the correct system prompt for a given extraction mode.

Having a single function here makes mode → prompt mapping testable without
spinning up OpenAI or touching the database.
"""

from typing import Literal

from app.prompts.extraction import EXTRACTION_SYSTEM_PROMPT
from app.prompts.general_extraction import GENERAL_EXTRACTION_SYSTEM_PROMPT


def get_extraction_system_prompt(mode: Literal["recruiter", "general"]) -> str:
    """Return the system prompt string for the given extraction mode."""
    if mode == "general":
        return GENERAL_EXTRACTION_SYSTEM_PROMPT
    return EXTRACTION_SYSTEM_PROMPT
