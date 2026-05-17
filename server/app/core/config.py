from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://pilot:pilot@127.0.0.1:5432/pilot"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://[::1]:3000"
    file_storage_root: str = ".data/storage"
    max_upload_bytes: int = 52_428_800  # 50 MiB
    allowed_audio_content_types: str = (
        "audio/wav,audio/x-wav,audio/mpeg,audio/mp3,audio/mp4,audio/webm,audio/m4a,audio/x-m4a"
    )
    transcription_provider: str = "mock"
    extraction_provider: str = "mock"
    # When true, POST /v1/recruiters/{id}/demo-from-transcript creates a tiny placeholder WAV + manual transcript (no real ASR).
    allow_transcript_only_demo: bool = False
    # OpenAI (used when EXTRACTION_PROVIDER=openai)
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    openai_extraction_model: str = "gpt-4o-mini"

    @property
    def allowed_audio_content_types_list(self) -> set[str]:
        return {x.strip().lower() for x in self.allowed_audio_content_types.split(",") if x.strip()}

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
