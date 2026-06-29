"""统一的 Redis 客户端(兼容已有 token_cache_service 调用).

提供 redis_client 单例对象,封装常用方法.
"""

import logging

import redis

from app.utils.redis_util import get_redis

logger = logging.getLogger(__name__)


class RedisClient:
    """简单 Redis 客户端包装."""

    def __init__(self):
        self._client: redis.Redis | None = None

    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            self._client = get_redis()
        return self._client

    def get(self, key: str) -> str | None:
        try:
            return self.client.get(key)  # type: ignore[return-value]
        except Exception as e:
            logger.warning(f"Redis get failed: {e}")
            return None

    def setex(self, key: str, ttl: int, value: str) -> None:
        try:
            self.client.setex(key, ttl, value)
        except Exception as e:
            logger.warning(f"Redis setex failed: {e}")

    def set(self, key: str, value: str, ex: int | None = None) -> None:
        try:
            if ex:
                self.client.setex(key, ex, value)
            else:
                self.client.set(key, value)
        except Exception as e:
            logger.warning(f"Redis set failed: {e}")

    def delete(self, *keys: str) -> None:
        try:
            if keys:
                self.client.delete(*keys)
        except Exception as e:
            logger.warning(f"Redis delete failed: {e}")

    def ping(self) -> bool:
        try:
            return bool(self.client.ping())
        except Exception:
            return False


redis_client = RedisClient()
