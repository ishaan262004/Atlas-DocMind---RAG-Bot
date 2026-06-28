"""Tiny Redis cache wrapper.

Every operation is best-effort: if Redis is unreachable the calls become
no-ops and the app falls back to querying the database directly.
"""
import json
import logging
from config import settings

logger = logging.getLogger(__name__)

_client = None
_init_done = False


def _get():
    global _client, _init_done
    if _init_done:
        return _client
    _init_done = True
    if not settings.REDIS_URL:
        return None
    try:
        import redis

        c = redis.Redis.from_url(
            settings.REDIS_URL,
            socket_connect_timeout=1,
            socket_timeout=1,
            decode_responses=True,
        )
        c.ping()
        _client = c
        logger.info("✅ Redis cache connected")
    except Exception as e:
        logger.warning(f"Redis unavailable — caching disabled: {e}")
        _client = None
    return _client


def cache_get(key: str):
    c = _get()
    if not c:
        return None
    try:
        v = c.get(key)
        return json.loads(v) if v else None
    except Exception:
        return None


def cache_set(key: str, value, ttl: int = None):
    c = _get()
    if not c:
        return
    try:
        c.set(key, json.dumps(value, default=str), ex=ttl or settings.CACHE_TTL)
    except Exception:
        pass


def cache_status() -> str:
    """'connected' if Redis is reachable, else 'disabled'."""
    return "connected" if _get() else "disabled"


def cache_del(*keys: str):
    c = _get()
    if not c or not keys:
        return
    try:
        c.delete(*[k for k in keys if k])
    except Exception:
        pass
