"""
Backwards-compatibility re-export. Import directly from extraction_schemas or
api_schemas in new code; this shim keeps existing imports working unchanged.
"""
from app.domain.extraction_schemas import *  # noqa: F401, F403
from app.domain.api_schemas import *  # noqa: F401, F403
