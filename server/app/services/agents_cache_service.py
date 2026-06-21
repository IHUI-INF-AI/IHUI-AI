"""智能体 API 缓存服务.

迁移自 coze_zhs_py/services/agents_cache_service.py.
基于 Redis 的智能体列表缓存.
"""

import hashlib
import json
from typing import Any

from loguru import logger

from app.utils.redis_client import get_redis


class AgentsCacheService:
    """智能体 API 缓存服务."""

    CACHE_PREFIX = "agents:list"
    DEFAULT_TTL = 300  # 5 分钟

    def __init__(self):
        self._redis = None

    def _get_redis(self):
        if self._redis is None:
            try:
                self._redis = get_redis()
            except Exception as e:
                logger.warning(f"Redis 不可用: {e}")
                return None
        return self._redis

    @staticmethod
    def _make_key(params: dict[str, Any]) -> str:
        raw = json.dumps(params, sort_keys=True, ensure_ascii=False)
        h = hashlib.md5(raw.encode("utf-8")).hexdigest()
        return f"{AgentsCacheService.CACHE_PREFIX}:{h}"

    async def get_cached_list(self, params: dict[str, Any]) -> list[dict[str, Any]] | None:
        key = self._make_key(params)
        r = self._get_redis()
        if r is None:
            return None
        try:
            data = r.get(key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.warning(f"读取智能体缓存失败: {e}")
        return None

    async def set_cached_list(self, params: dict[str, Any], data: list[dict[str, Any]], ttl: int = DEFAULT_TTL) -> bool:
        key = self._make_key(params)
        r = self._get_redis()
        if r is None:
            return False
        try:
            r.setex(key, ttl, json.dumps(data, ensure_ascii=False, default=str))
            return True
        except Exception as e:
            logger.warning(f"写入智能体缓存失败: {e}")
            return False

    async def invalidate(self, pattern: str = "agents:list:*") -> int:
        r = self._get_redis()
        if r is None:
            return 0
        try:
            keys = r.keys(pattern)
            if keys:
                return r.delete(*keys)
        except Exception as e:
            logger.warning(f"清除智能体缓存失败: {e}")
        return 0


_cache_instance: AgentsCacheService | None = None


def get_agents_cache_service() -> AgentsCacheService:
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = AgentsCacheService()
    return _cache_instance
