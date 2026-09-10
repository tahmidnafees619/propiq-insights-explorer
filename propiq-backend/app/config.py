"""Application settings, loaded from the environment with sane defaults."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    """Runtime configuration.

    Every value can be overridden by an environment variable of the same name
    or by an entry in `.env`. Relative filesystem paths are resolved against
    the backend package root, so the server behaves identically no matter
    which directory it is launched from.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # --- Application -----------------------------------------------------
    APP_NAME: str = "PropIQ Backend"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # --- Storage ---------------------------------------------------------
    DATABASE_URL: str = "sqlite:///./data/propiq.db"
    MODEL_PATH: str = "./models/model.pkl"
    SCALER_PATH: str = "./models/scaler.pkl"
    FEATURES_PATH: str = "./models/feature_columns.pkl"
    METRICS_PATH: str = "./models/metrics.json"

    # --- HTTP ------------------------------------------------------------
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    API_PREFIX: str = "/api"

    # --- Behaviour -------------------------------------------------------
    # When the properties table is empty the API serves a curated demo
    # dataset instead of empty arrays, so the dashboard is never blank during
    # a walkthrough. Set to False to return real (possibly empty) data only.
    ENABLE_DEMO_FALLBACK: bool = True

    @field_validator("LOG_LEVEL")
    @classmethod
    def _validate_log_level(cls, value: str) -> str:
        allowed = {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"}
        upper = value.upper()
        if upper not in allowed:
            raise ValueError(f"LOG_LEVEL must be one of {sorted(allowed)}, got {value!r}")
        return upper

    # --- Derived values --------------------------------------------------
    @property
    def base_dir(self) -> Path:
        return BASE_DIR

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    def _resolve(self, value: str) -> Path:
        path = Path(value)
        return path if path.is_absolute() else BASE_DIR / path

    @property
    def resolved_database_url(self) -> str:
        if self.DATABASE_URL.startswith("sqlite:///"):
            relative = self.DATABASE_URL.removeprefix("sqlite:///")
            return f"sqlite:///{self._resolve(relative)}"
        return self.DATABASE_URL

    @property
    def resolved_model_path(self) -> Path:
        return self._resolve(self.MODEL_PATH)

    @property
    def resolved_scaler_path(self) -> Path:
        return self._resolve(self.SCALER_PATH)

    @property
    def resolved_features_path(self) -> Path:
        return self._resolve(self.FEATURES_PATH)

    @property
    def resolved_metrics_path(self) -> Path:
        return self._resolve(self.METRICS_PATH)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide settings singleton."""
    return Settings()


settings = get_settings()
