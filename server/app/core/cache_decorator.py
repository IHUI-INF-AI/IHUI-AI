"""Redis 缓存装饰器 - 为函数/方法结果提供自动缓存.

特性:
- sync/async 双版本
- 自动 JSON 序列化/反序列化
- 支持 key 前缀 + 参数 hash
- TTL 过期
- 缓存击穿保护 (单飞模式, 防止雪崩)
- 缓存穿透保护 (空值缓存)
- 统计命中/未命中 (Prometheus)
"""
from __future__ import annotations

import functools
import hashlib
import json
import logging
import time
from collections.abc import Callable
from typing import Any

logger = logging.getLogger(__name__)

# 单飞锁: 防止同一 key 并发击穿
_SINGLEFLIGHT: dict[str, float] = {}
_NULL_CACHE_VALUE = "__NULL__"

# 统计 (简单的全局计数器, 可被 Prometheus 抓取)
_STATS = {"hits": 0, "misses": 0, "errors": 0, "nulls": 0}


def _make_key(prefix: str, fn: Callable, args: tuple, kwargs: dict) -> str:
    """生成稳定 cache key."""
    raw = f"{prefix}:{fn.__module__}.{fn.__qualname__}:{args}:{sorted(kwargs.items())}"
    return f"cache:{prefix}:{hashlib.md5(raw.encode()).hexdigest()}"


def _serialize(value: Any) -> str:
    if value is None:
        return _NULL_CACHE_VALUE
    try:
        return json.dumps(value, ensure_ascii=False, default=str)
    except Exception:
        return json.dumps(str(value), ensure_ascii=False)


def _deserialize(raw: str) -> Any:
    if raw == _NULL_CACHE_VALUE:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def _get_redis():
    try:
        from app.utils.redis_util import get_redis

        return get_redis()
    except Exception:
        return None


def cached(
    prefix: str = "fn",
    ttl: int = 300,
    cache_null: bool = True,
    null_ttl: int = 30,
):
    """同步函数缓存装饰器.

    Args:
        prefix: key 前缀
        ttl: 过期秒数
        cache_null: 是否缓存 None (防穿透)
        null_ttl: 空值 TTL (通常更短)
    """

    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            r = _get_redis()
            if r is None:
                return fn(*args, **kwargs)

            key = _make_key(prefix, fn, args, kwargs)
            try:
                raw = r.get(key)
                if raw is not None:
                    _STATS["hits"] += 1
                    return _deserialize(raw)
            except Exception as e:
                _STATS["errors"] += 1
                logger.debug(f"cache get fail key={key}: {e}")
                return fn(*args, **kwargs)

            _STATS["misses"] += 1
            # 单飞: 防止击穿 (简单时间窗锁)
            now = time.time()
            lock_key = f"{key}:lock"
            if _SINGLEFLIGHT.get(lock_key, 0) > now:
                # 已在执行, 直接重算
                return fn(*args, **kwargs)
            _SINGLEFLIGHT[lock_key] = now + 1.0

            try:
                value = fn(*args, **kwargs)
            except Exception:
                _SINGLEFLIGHT.pop(lock_key, None)
                raise

            _SINGLEFLIGHT.pop(lock_key, None)
            try:
                if value is None and cache_null:
                    r.setex(key, null_ttl, _NULL_CACHE_VALUE)
                    _STATS["nulls"] += 1
                else:
                    r.setex(key, ttl, _serialize(value))
            except Exception as e:
                _STATS["errors"] += 1
                logger.debug(f"cache set fail key={key}: {e}")
            return value

        wrapper.__cache_stats__ = _STATS  # type: ignore[attr-defined]  # 暴露给 Prometheus
        return wrapper

    return decorator


def async_cached(
    prefix: str = "fn",
    ttl: int = 300,
    cache_null: bool = True,
    null_ttl: int = 30,
):
    """异步函数缓存装饰器."""

    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            r = _get_redis()
            if r is None:
                return await fn(*args, **kwargs)

            key = _make_key(prefix, fn, args, kwargs)
            try:
                raw = r.get(key)
                if raw is not None:
                    _STATS["hits"] += 1
                    return _deserialize(raw)
            except Exception:
                _STATS["errors"] += 1
                return await fn(*args, **kwargs)

            _STATS["misses"] += 1
            value = await fn(*args, **kwargs)
            try:
                if value is None and cache_null:
                    r.setex(key, null_ttl, _NULL_CACHE_VALUE)
                    _STATS["nulls"] += 1
                else:
                    r.setex(key, ttl, _serialize(value))
            except Exception:
                _STATS["errors"] += 1
            return value

        return wrapper

    return decorator


def invalidate(prefix: str, pattern_keys: list[str] | None = None):
    """失效缓存 (按 key 或 pattern).

    Args:
        prefix: 之前 cached 装饰器使用的前缀
        pattern_keys: 具体的 key 列表, 模糊匹配 prefix*

    Examples:
        # 失效所有 prefix=user:* 的缓存
        invalidate("user")
    """
    r = _get_redis()
    if r is None:
        return 0
    pattern = f"cache:{prefix}:*"
    count = 0
    try:
        for key in r.scan_iter(match=pattern, count=100):
            r.delete(key)
            count += 1
    except Exception as e:
        logger.debug(f"invalidate fail pattern={pattern}: {e}")
    return count


def get_stats() -> dict:
    """返回缓存命中/未命中统计 (给 Prometheus 抓取)."""
    total = _STATS["hits"] + _STATS["misses"]
    hit_rate = (_STATS["hits"] / total) if total > 0 else 0.0
    return {
        **_STATS,
        "total": total,
        "hit_rate": round(hit_rate, 4),
    }


__all__ = ["async_cached", "cached", "get_stats", "invalidate"]
