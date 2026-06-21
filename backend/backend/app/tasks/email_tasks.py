import asyncio
import logging
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine in a sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _fetch_user_email(user_id: str) -> tuple[str | None, str | None]:
    """Fetch user email and full_name from DB."""
    from app.database import AsyncSessionLocal
    from app.models.user import User
    from sqlalchemy import select
    import uuid

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User.email, User.full_name, User.notify_email).where(
                User.id == uuid.UUID(user_id)
            )
        )
        row = result.first()
        if row and row.notify_email:
            return row.email, row.full_name
        return None, None


async def _send_mail(to_email: str, to_name: str, subject: str, body: str) -> None:
    from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
    from app.config import settings

    conf = ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        MAIL_FROM=settings.MAIL_FROM,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_STARTTLS=settings.MAIL_STARTTLS,
        MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
    )

    html_body = f"""
    <html>
      <body>
        <p>Hello {to_name},</p>
        <p>{body}</p>
        <hr/>
        <p><small>2LTP Task Portal — you are receiving this because email notifications are enabled on your account.</small></p>
      </body>
    </html>
    """

    message = MessageSchema(
        subject=subject,
        recipients=[to_email],
        body=html_body,
        subtype=MessageType.html,
    )

    fm = FastMail(conf)
    await fm.send_message(message)


@celery_app.task(
    name="app.tasks.email_tasks.send_email_notification",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_email_notification(self, user_id: str, subject: str, body: str) -> None:
    """Send email notification to a user."""
    try:
        email, full_name = _run_async(_fetch_user_email(user_id))
        if not email:
            logger.info(f"Skipping email for user {user_id}: email notifications disabled or user not found")
            return
        _run_async(_send_mail(email, full_name or "User", subject, body))
        logger.info(f"Email sent to {email} ({subject})")
    except Exception as exc:
        logger.error(f"Failed to send email to user {user_id}: {exc}")
        raise self.retry(exc=exc)
