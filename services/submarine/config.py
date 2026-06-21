from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Service configuration, read from environment variables (matched case-insensitively)."""

    model_config = SettingsConfigDict(extra="ignore", env_ignore_empty=True)

    port: int = 3006

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/submarine"

    broadcast_service_url: str = "http://localhost:3002"
    internal_secret: str = ""

    # Optional LLM, used only to enrich a dive with a flavour "briefing".
    # If no key is set (or the call fails) the service falls back to static text,
    # so booking never depends on the model being reachable.
    llm_base_url: str = "https://openrouter.ai/api/v1"
    llm_api_key: str = ""
    llm_model: str = "meta-llama/llama-3.1-8b-instruct"
    llm_temperature: float = 0.8
    llm_max_tokens: int = 220


settings = Settings()
