"""Token 缓存服务 -- Redis 优先, DB 兜底, 异常隔离.

P15-C2 重建: 之前文件 corruption 仅留 stub, 补全 Redis 缓存层:
  - get_balance_cached: Redis 命中直接返回, 未命中查 DB 写回缓存
  - invalidate_balance_cache: 删除缓存 key
  - update_token_with_cache: 写新余额到缓存
所有 Redis 异常均隔离, 不影响主流程.
"""

import json
from typing import Any

from loguru import logger

from app.database import get_session

CACHE_TTL = 300  # 5 分钟
_KEY_PREFIX = "zhs:token:balance:"


def _key(user_uuid: str) -> str:
    return f"{_KEY_PREFIX}{user_uuid}"


# Module-level redis client (lazy) -- 测试用 patch.object(tc, "redis_client") 替换
redis_client = None


def _get_redis():
    """惰性获取 redis client, 失败时返回 None (走 DB 路径)."""
    global redis_client
    if redis_client is not None:
        return redis_client
    try:
        from app.utils.redis_util import get_redis

        redis_client = get_redis()
    except Exception as e:
        logger.error(f"Redis init failed: {e}")
        redis_client = None
    return redis_client


def get_balance_cached(user_uuid: str) -> dict[str, Any]:
    """查询余额: Redis 命中直接返回, 未命中查 DB 后写回缓存.

    异常隔离: Redis 读 / 写失败均不抛出, 降级到 DB.
    """
    if not user_uuid:
        return {"user_uuid": "", "token_balance": 0}

    # 1) Redis 优先
    try:
        rc = _get_redis()
        if rc is not None:
            cached = rc.get(_key(user_uuid))
            if cached:
                return json.loads(cached)
    except Exception as e:
        logger.error(f"Redis read error for {user_uuid}: {e}")

    # 2) DB 兜底
    balance = 0
    try:
        with get_session() as db:
            from app.models.user_models import UserMargin

            margin = db.query(UserMargin).filter(UserMargin.user_uuid == user_uuid).first()
            if margin:
                balance = int(margin.token_quantity or 0)
    except Exception as e:
        logger.error(f"DB query balance error for {user_uuid}: {e}")

    payload = {"user_uuid": user_uuid, "token_balance": balance}

    # 3) 写回缓存 (异常隔离)
    try:
        rc = _get_redis()
        if rc is not None:
            rc.setex(_key(user_uuid), CACHE_TTL, json.dumps(payload))
    except Exception as e:
        logger.error(f"Redis write error for {user_uuid}: {e}")

    return payload


def invalidate_balance_cache(user_uuid: str) -> None:
    """删除余额缓存. 异常隔离 (不抛出)."""
    if not user_uuid:
        return
    try:
        rc = _get_redis()
        if rc is not None:
            rc.delete(_key(user_uuid))
    except Exception as e:
        logger.error(f"Redis delete error for {user_uuid}: {e}")


def update_token_with_cache(user_uuid: str, token_balance: int) -> None:
    """更新余额到缓存 (TTL 5 分钟). 异常隔离."""
    if not user_uuid:
        return
    payload = {"user_uuid": user_uuid, "token_balance": int(token_balance)}
    try:
        rc = _get_redis()
        if rc is not None:
            rc.setex(_key(user_uuid), CACHE_TTL, json.dumps(payload))
    except Exception as e:
        logger.error(f"Redis setex error for {user_uuid}: {e}")
