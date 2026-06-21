"""Legacy settings wrapper for migrated client/backend services.

This module exists solely to expose the Pydantic settings that
client/backend/api/config.py originally defined, but namespaced to
avoid collision with the canonical `app.config.settings`.
"""
from __future__ import annotations

import os
import secrets
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class LegacySettings(BaseSettings):
    """Re-exports the legacy client/backend settings fields.

    All fields are read from environment variables (or the legacy
    `.env` file at the project root). If unset, fall back to the
    canonical server settings where possible.
    """

    # Legacy env var prefix to avoid collision with server settings
    model_config = SettingsConfigDict(
        env_prefix="LEGACY_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    CORS_ORIGINS: list[str] = [
        "http://localhost:8888",
        "http://localhost:5173",
        "http://127.0.0.1:8888",
    ]
    MAX_FILE_SIZE: int = 50 * 1024 * 1024

    # Use LOCAL_UPLOADS_DIR from server settings if available, otherwise use default
    _uploads_base: str = os.environ.get("LOCAL_UPLOADS_DIR", "./local_uploads")

    UPLOAD_DIR: str = ""
    OUTPUT_DIR: str = ""

    API_KEY_HEADER: str = "X-API-Key"
    API_KEYS: list[str] = []
    REQUIRE_API_KEY: bool = False

    SECRET_KEY: str = secrets.token_urlsafe(32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    DB_TYPE: str = "sqlite"
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "postgres"
    DB_PASSWORD: str = ""
    DB_NAME: str = "officialsite"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Set upload/output dirs after init to avoid Pydantic overriding them
        if not self.UPLOAD_DIR:
            self.UPLOAD_DIR = str(Path(self._uploads_base) / "pdf_uploads")
        if not self.OUTPUT_DIR:
            self.OUTPUT_DIR = str(Path(self._uploads_base) / "pdf_outputs")

    @property
    def DATABASE_URL(self) -> str:
        if self.DB_TYPE == "postgres":
            return (
                f"postgresql+psycopg://{self.DB_USER}:{self.DB_PASSWORD}@"
                f"{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            )
        return "sqlite:///./pdf_service.db"

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        if self.DB_TYPE == "postgres":
            return (
                f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@"
                f"{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            )
        return "sqlite+aiosqlite:///./pdf_service.db"


# Singleton (lazy) so test code can override env vars before first read.
_settings: LegacySettings | None = None


def get_legacy_settings() -> LegacySettings:
    global _settings
    if _settings is None:
        _settings = LegacySettings()
    return _settings


# Backwards-compatible alias matching `from api.config import settings` in legacy code.
settings = get_legacy_settings()


def generate_api_key() -> str:
    return secrets.token_urlsafe(32)
