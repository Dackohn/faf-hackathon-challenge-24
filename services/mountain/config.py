from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore", env_ignore_empty=True)

    port: int = 3005
    broadcast_service_url: str = "http://localhost:3002"
    parrot_token: str = ""
    internal_secret: str = ""

    llm_base_url: str = "https://openrouter.ai/api/v1"
    llm_api_key: str = ""
    llm_model: str = "meta-llama/llama-3.1-8b-instruct"
    llm_temperature: float = 0.9
    llm_max_tokens: int = 1500


settings = Settings()
