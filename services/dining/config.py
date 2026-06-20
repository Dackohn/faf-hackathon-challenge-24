from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Service configuration, read from environment variables (matched case-insensitively)."""

    model_config = SettingsConfigDict(extra="ignore", env_ignore_empty=True)

    port: int = 3004

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/dining"

    broadcast_service_url: str = "http://localhost:3002"
    internal_secret: str = ""


settings = Settings()
