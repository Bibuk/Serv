import asyncio
import logging
from datetime import datetime, timedelta, timezone
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _check_deadlines_async() -> None:
    from app.database import AsyncSessionLocal
    from app.models.task import Task, TaskStatus
    from app.models.subtask import Subtask, SubtaskStatus
    from app.models.notification import NotificationEntityType
    from app.models.user import User, UserRole
    from app.services.notification import create_notification
    from sqlalchemy import select, and_
    import uuid

    now = datetime.now(timezone.utc)
    warning_threshold = now + timedelta(hours=24)

    async with AsyncSessionLocal() as db:
        # Check tasks with deadlines within 24 hours
        task_result = await db.execute(
            select(Task).where(
                and_(
                    Task.deadline >= now,
                    Task.deadline <= warning_threshold,
                    Task.status.not_in([TaskStatus.done, TaskStatus.archived]),
                )
            )
        )
        tasks = task_result.scalars().all()

        for task in tasks:
            # Notify the creator (manager)
            await create_notification(
                db=db,
                user_id=task.created_by,
                title="Task deadline approaching",
                body=f"Task '{task.title}' is due in less than 24 hours (deadline: {task.deadline.strftime('%Y-%m-%d %H:%M UTC')}).",
                entity_type=NotificationEntityType.task,
                entity_id=task.id,
            )
            # Notify teamlead if assigned
            if task.team_id:
                team_result = await db.execute(
                    select(User).where(
                        and_(
                            User.team_id == task.team_id,
                            User.role == UserRole.teamlead,
                            User.is_active == True,
                        )
                    )
                )
                teamleads = team_result.scalars().all()
                for tl in teamleads:
                    await create_notification(
                        db=db,
                        user_id=tl.id,
                        title="Task deadline approaching",
                        body=f"Task '{task.title}' is due in less than 24 hours.",
                        entity_type=NotificationEntityType.task,
                        entity_id=task.id,
                    )

        # Check subtasks with deadlines within 24 hours
        subtask_result = await db.execute(
            select(Subtask).where(
                and_(
                    Subtask.deadline >= now,
                    Subtask.deadline <= warning_threshold,
                    Subtask.status.not_in([SubtaskStatus.done]),
                )
            )
        )
        subtasks = subtask_result.scalars().all()

        for subtask in subtasks:
            if subtask.assignee_id:
                await create_notification(
                    db=db,
                    user_id=subtask.assignee_id,
                    title="Subtask deadline approaching",
                    body=f"Subtask '{subtask.title}' is due in less than 24 hours (deadline: {subtask.deadline.strftime('%Y-%m-%d %H:%M UTC')}).",
                    entity_type=NotificationEntityType.subtask,
                    entity_id=subtask.id,
                )

        await db.commit()
        logger.info(f"Deadline check complete: {len(tasks)} tasks, {len(subtasks)} subtasks notified")


async def _auto_archive_tasks_async() -> None:
    from app.database import AsyncSessionLocal
    from app.models.task import Task, TaskStatus
    from sqlalchemy import select, and_

    now = datetime.now(timezone.utc)
    archive_threshold = now - timedelta(days=30)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Task).where(
                and_(
                    Task.status == TaskStatus.done,
                    Task.updated_at <= archive_threshold,
                )
            )
        )
        tasks = result.scalars().all()
        count = 0
        for task in tasks:
            task.status = TaskStatus.archived
            task.updated_at = now
            count += 1

        await db.commit()
        logger.info(f"Auto-archived {count} done tasks older than 30 days")


@celery_app.task(name="app.tasks.scheduled_tasks.check_deadlines")
def check_deadlines() -> None:
    """Check for tasks/subtasks with deadlines within 24 hours and send warnings."""
    logger.info("Running deadline check...")
    _run_async(_check_deadlines_async())


@celery_app.task(name="app.tasks.scheduled_tasks.auto_archive_tasks")
def auto_archive_tasks() -> None:
    """Archive done tasks older than 30 days."""
    logger.info("Running auto-archive tasks...")
    _run_async(_auto_archive_tasks_async())
