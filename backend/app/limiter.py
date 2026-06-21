from slowapi import Limiter
from slowapi.util import get_remote_address
from app.config import settings


# Single shared limiter — Redis-backed so limits hold across all workers.
# Fail-open: if Redis is unreachable, degrade to in-memory limiting rather than
# erroring; swallow_errors ensures a storage hiccup never turns into a 500.
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.redis_dsn,
    default_limits=["200/minute"],
    in_memory_fallback_enabled=True,
    swallow_errors=True,
)
