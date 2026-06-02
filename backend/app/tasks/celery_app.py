from celery import Celery
from celery.schedules import crontab
from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "job_aggregator",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.job_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone=settings.SCHEDULER_TIMEZONE,
    enable_utc=True,
    task_track_started=True,
    beat_schedule={
        "daily-job-fetch": {
            "task": "app.tasks.job_tasks.run_daily_job_pipeline",
            "schedule": crontab(
                hour=settings.DAILY_JOB_HOUR,
                minute=settings.DAILY_JOB_MINUTE,
            ),
        },
    },
)
