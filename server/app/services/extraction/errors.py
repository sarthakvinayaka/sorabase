"""Raised when extraction orchestration cannot complete."""


class ExtractionConfigurationError(Exception):
    """Missing API key or invalid extraction provider configuration."""


class ExtractionExecutionError(Exception):
    """Business rule violation (e.g. missing transcript)."""


class ExtractionProviderRuntimeError(Exception):
    """Provider raised while producing structured output."""
