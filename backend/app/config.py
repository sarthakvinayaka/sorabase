from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    openai_api_key: str
    openai_model: str = "gpt-4o-2024-08-06"
    max_transcript_chars: int = 50_000
    default_org_id: str = "00000000-0000-0000-0000-000000000001"
    audio_upload_dir: str = "./uploads/audio"
    max_audio_bytes: int = 25_000_000   # 25 MB — Whisper API hard limit
    whisper_model: str = "whisper-1"
    zoom_webhook_secret_token: str = ""  # set ZOOM_WEBHOOK_SECRET_TOKEN in .env
    recall_api_key: str = ""             # set RECALL_API_KEY in .env
    recall_webhook_secret: str = ""      # set RECALL_WEBHOOK_SECRET in .env
    # Public base URL of this server — used to build the Recall webhook callback URL.
    # Example: https://abc123.ngrok.io  (no trailing slash)
    app_base_url: str = "http://localhost:8000"


settings = Settings()
