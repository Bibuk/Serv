from slowapi import Limiter
from slowapi.util import get_remote_address
from app.config import settings


limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.redis_dsn,
    default_limits=["200/minute"],
    in_memory_fallback_enabled=True,
    swallow_errors=True,
)
