from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/2ltp"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_RECYCLE: int = 1800

    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_PASSWORD: Optional[str] = None

    @property
    def redis_dsn(self) -> str:
        """REDIS_URL with the password injected, for clients that take a single
        connection string (Celery broker/backend, slowapi storage). If the
        password is already embedded in REDIS_URL, it is left untouched."""
        if self.REDIS_PASSWORD:
            scheme, sep, rest = self.REDIS_URL.partition("://")
            if sep and "@" not in rest:
                return f"{scheme}://:{self.REDIS_PASSWORD}@{rest}"
        return self.REDIS_URL

    JWT_SECRET_KEY: str = Field(..., min_length=32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 525600
    REFRESH_TOKEN_EXPIRE_DAYS: int = 3650

    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    MAIL_USERNAME: str = "no-reply@example.com"
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "no-reply@example.com"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.example.com"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False

    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_SIZE_MB: int = 50

    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    SECURE_COOKIES: bool = False

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def docs_url(self) -> Optional[str]:
        return None if self.is_production else "/docs"

    @property
    def redoc_url(self) -> Optional[str]:
        return None if self.is_production else "/redoc"

    @property
    def openapi_url(self) -> Optional[str]:
        return None if self.is_production else "/openapi.json"


settings = Settings()
