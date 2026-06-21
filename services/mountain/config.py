from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore", env_ignore_empty=True)

    port: int = 3005
    broadcast_service_url: str = "http://localhost:3002"
    parrot_token: str = ""
    internal_secret: str = ""


settings = Settings()
