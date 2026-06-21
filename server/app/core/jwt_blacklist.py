"""JWT 黑名单 - 修复 Bug-26.

用 Redis 维护已吊销 token (按 jti 或 token 摘要), decode 时检查.

设计要点:
  - 失败 fail-open: Redis 抖动不应阻塞业务
  - 过期自动清理: key TTL = token 剩余有效期
  - 可降级: Redis 不可用时本地内存 Set 兜底 (单实例)
"""

from __future__ import annotations

import hashlib
import logging
import time

logger = logging.getLogger(__name__)

_KEY_PREFIX = "auth:jwt:revoked:"
# 进程级内存兜底 (单实例开发/测试用)
_FALLBACK_STORE: dict[str, float] = {}


def _token_fingerprint(token: str) -> str:
    """token 摘要 (避免把完整 JWT 写进 Redis, 减少泄露面)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _get_redis():
    try:
        from app.utils.redis_util import get_redis

        return get_redis()
    except Exception:
        return None


def revoke_token(token: str, ttl_seconds: int | None = None) -> bool:
    """吊销一个 token.

    Args:
        token: 完整 JWT 字符串
        ttl_seconds: 黑名单保留秒数. None 时从 token 的 exp 字段自动算, 最小 60s.

    Returns:
        True 写入成功, False 兜底模式也未生效.
    """
    if not token:
        return False
    fp = _token_fingerprint(token)

    # 解析 exp 拿剩余时间
    if ttl_seconds is None:
        try:
            from app.security import decode_access_token

            payload = decode_access_token(token) or {}
            exp = int(payload.get("exp", 0))
            now = int(time.time())
            ttl_seconds = max(60, exp - now) if exp > now else 60
        except Exception:
            ttl_seconds = 300  # 兜底 5min

    key = _KEY_PREFIX + fp
    r = _get_redis()
    if r is not None:
        try:
            r.setex(key, int(ttl_seconds), "1")
            return True
        except Exception as e:
            logger.warning(f"revoke_token redis failed, fallback to memory: {e}")

    # 内存兜底
    _FALLBACK_STORE[fp] = time.time() + float(ttl_seconds)
    # 顺手清理过期项, 避免内存膨胀
    now = time.time()
    for k in list(_FALLBACK_STORE.keys()):
        if _FALLBACK_STORE[k] < now:
            _FALLBACK_STORE.pop(k, None)
    return True


def is_jwt_revoked(token: str) -> bool:
    """检查 token 是否在黑名单. Redis 不可用时回退内存 Set."""
    if not token:
        return False
    fp = _token_fingerprint(token)
    key = _KEY_PREFIX + fp
    r = _get_redis()
    if r is not None:
        try:
            return bool(r.exists(key))
        except Exception as e:
            logger.debug(f"is_jwt_revoked redis failed, fallback to memory: {e}")
    # 内存兜底
    expire_at = _FALLBACK_STORE.get(fp)
    if expire_at is None:
        return False
    if expire_at < time.time():
        _FALLBACK_STORE.pop(fp, None)
        return False
    return True
