from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV_PATH = Path(__file__).resolve().parents[4] / ".env"


class Settings(BaseSettings):
    APP_NAME: str = "SiliconSense by SpideyTech API"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"

    DATABASE_URL: str = (
        "postgresql+psycopg://siliconsense:siliconsense_dev_pw@localhost:5432/siliconsense_dev"
    )
    TEST_DATABASE_URL: str = (
        "postgresql+psycopg://siliconsense:siliconsense_dev_pw@localhost:5432/siliconsense_test"
    )
    REDIS_URL: str = "redis://localhost:6379/0"

    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(
        env_file=(str(ROOT_ENV_PATH), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
