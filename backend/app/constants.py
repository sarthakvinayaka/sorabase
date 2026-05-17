"""
Application-wide constants.

Centralising magic strings here prevents typos and makes grep-based audits trivial.
"""

# ---------------------------------------------------------------------------
# Extraction mode markers
# ---------------------------------------------------------------------------

# Stored in ExtractionRun.template_id to distinguish General Mode runs from
# Recruiting Mode runs (which leave template_id NULL).
GENERAL_MODE_TAG: str = "general"

# Stored in BotSession.mode / MeetingSession.mode to control post-transcript
# dispatch: "general" stops at ready; "recruiting" triggers full extraction.
MODE_GENERAL:    str = "general"
MODE_RECRUITING: str = "recruiting"
