import redis.asyncio as aioredis
from app.config import settings

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.REDIS_URL,
            password=settings.REDIS_PASSWORD or None,
            decode_responses=True,
        )
    return _redis


async def blacklist_jti(jti: str, ttl_seconds: int) -> None:
    """Mark a refresh token jti as revoked. Silently skips if Redis is unavailable."""
    try:
        r = get_redis()
        await r.setex(f"rt_blacklist:{jti}", ttl_seconds, "1")
    except Exception:
        pass


async def is_jti_blacklisted(jti: str) -> bool:
    """Returns False if Redis is unavailable (fail-open)."""
    try:
        r = get_redis()
        return await r.exists(f"rt_blacklist:{jti}") == 1
    except Exception:
        return False
