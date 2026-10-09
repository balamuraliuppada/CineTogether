from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    room_expiration_minutes: int = 120
    max_participants: int = 5

    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    database_url: str | None = None
    redis_url: str | None = None

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()
