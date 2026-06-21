from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "2ltp",
    broker=settings.redis_dsn,
    backend=settings.redis_dsn,
    include=[
        "app.tasks.email_tasks",
        "app.tasks.scheduled_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "check-deadlines-hourly": {
            "task": "app.tasks.scheduled_tasks.check_deadlines",
            "schedule": crontab(minute=0),
        },
        "auto-archive-tasks-daily": {
            "task": "app.tasks.scheduled_tasks.auto_archive_tasks",
            "schedule": crontab(hour=3, minute=0),
        },
    },
)
