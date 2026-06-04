from pydantic_settings import BaseSettings
from pydantic import model_validator
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_ENV: str = "production"
    APP_NAME: str = "JobRadar"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Admin credentials
    ADMIN_USERNAME: str
    ADMIN_PASSWORD: str
    admin_password_hash: str = ""

    @model_validator(mode="after")
    def _hash_admin_password(self) -> "Settings":
        from passlib.context import CryptContext
        ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        self.admin_password_hash = ctx.hash(self.ADMIN_PASSWORD)
        return self

    # Database
    DATABASE_URL: str = "sqlite:////app/data/jobs.db"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Scheduler
    SCHEDULER_TIMEZONE: str = "Asia/Dhaka"
    DAILY_JOB_HOUR: int = 10
    DAILY_JOB_MINUTE: int = 0
    JOB_FETCH_WINDOW_HOURS: int = 25
    JOB_RETENTION_DAYS: int = 4

    # Storage
    CV_UPLOAD_DIR: str = "/app/data/cv_files"

    # CORS - comma-separated list of allowed frontend origins
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
