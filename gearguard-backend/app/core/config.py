"""
app/core/config.py — All configuration from environment variables only.
Never hardcode secrets. Copy .env.example -> .env and fill in real values.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    DATABASE_NAME: str = "gearguard"

    # Auth
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24
    COOKIE_NAME: str = "gg_token"
    COOKIE_SECURE: bool = False          # True in production (HTTPS)
    COOKIE_SAME_SITE: str = "lax"

    # CORS
    CORS_ORIGIN: str = "http://localhost:3000"

    # Server
    PORT: int = 3001
    ENV: str = "development"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
