"""Socket.IO 聊天入口限流 + 预算检查。

防滥用两道闸门:
1. 速率限制:per-user token bucket(默认 2/秒,桶容量 5),防高频刷 AI 调用。
2. 预算检查:查 PostgreSQL ai_budgets / ai_cost_records,防预算耗尽后仍调 AI。

两道闸门均 try/except 兜底,任何异常都降级为"允许调用",不阻塞主链路。
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Optional

import asyncpg

from ..core.config import settings

logger = logging.getLogger(__name__)


# =============================================================================
# 速率限制:per-user token bucket
# =============================================================================

# 默认参数:每用户每秒 2 条消息,桶容量 5(允许短时突发)
_RATE_PER_SEC: float = 2.0
_BUCKET_CAPACITY: float = 5.0

# user_id -> (tokens, last_refill_ts)
_buckets: dict[str, tuple[float, float]] = {}
_buckets_lock = asyncio.Lock()


async def acquire(user_id: str) -> bool:
    """尝试获取一个令牌(per-user token bucket)。

    Args:
        user_id: 用户 ID。

    Returns:
        True=允许通过,False=被限流。
        任何异常降级为 True(允许调用,不阻塞主链路)。
    """
    if not user_id:
        return True
    try:
        async with _buckets_lock:
            now = time.monotonic()
            tokens, last_refill = _buckets.get(
                user_id, (_BUCKET_CAPACITY, now)
            )
            # 按秒线性补充令牌(最多不超过桶容量)
            elapsed = now - last_refill
            tokens = min(
                _BUCKET_CAPACITY, tokens + elapsed * _RATE_PER_SEC
            )
            if tokens >= 1.0:
                tokens -= 1.0
                _buckets[user_id] = (tokens, now)
                return True
            _buckets[user_id] = (tokens, now)
            return False
    except Exception as e:
        logger.warning("[rate_limiter] acquire 异常,降级允许: %s", e)
        return True


# =============================================================================
# 预算检查:查 PostgreSQL ai_budgets / ai_cost_records
# =============================================================================

_pool: Optional[asyncpg.Pool] = None


async def _get_pool() -> asyncpg.Pool:
    """获取/复用 asyncpg 连接池(参考 llm_gateway._get_pool 模式)。"""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=1,
            max_size=3,
            command_timeout=5,
        )
    return _pool


async def check_budget(
    user_id: str,
    tenant_id: str | None = None,
    model: str | None = None,
) -> tuple[bool, str | None]:
    """检查用户/租户今日 AI token 预算是否充足。

    Args:
        user_id: 用户 ID(scope='user', scope_key=user_id)。
        tenant_id: 租户 ID(可选,scope='tenant', scope_key=tenant_id)。
        model: 模型名(可选,优先 model-specific 预算行,兜底 model IS NULL)。

    Returns:
        (allowed, reason):allowed=True 表示允许调用;
        allowed=False 时 reason 为拒绝原因(用于 chat_error message)。
        任何 DB 异常降级为 (True, None),不阻塞主链路。
    """
    if not user_id:
        return True, None
    try:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            # 1. 查用户预算上限(优先 model-specific,兜底 model IS NULL)
            daily_limit = await conn.fetchval(
                """SELECT daily_token_limit FROM ai_budgets
                    WHERE scope = 'user' AND scope_key = $1
                      AND (model = $2 OR model IS NULL)
                    ORDER BY model IS NOT NULL DESC
                    LIMIT 1""",
                user_id,
                model,
            )
            # 租户级预算(取较小值,更严格的上限生效)
            if tenant_id:
                tenant_limit = await conn.fetchval(
                    """SELECT daily_token_limit FROM ai_budgets
                        WHERE scope = 'tenant' AND scope_key = $1
                          AND (model = $2 OR model IS NULL)
                        ORDER BY model IS NOT NULL DESC
                        LIMIT 1""",
                    tenant_id,
                    model,
                )
                if tenant_limit is not None:
                    daily_limit = (
                        tenant_limit
                        if daily_limit is None
                        else min(daily_limit, tenant_limit)
                    )
            # 无任何预算配置 → 允许(无约束)
            if daily_limit is None:
                return True, None

            # 2. 查用户今日已用 token 总量(UTC 当天)
            today_start = datetime.now(timezone.utc).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            used = await conn.fetchval(
                """SELECT COALESCE(SUM(total_tokens), 0)
                     FROM ai_cost_records
                    WHERE user_id = $1::uuid
                      AND created_at >= $2""",
                user_id,
                today_start,
            )

            if used is not None and used >= daily_limit:
                return False, "日 token 预算已用尽"
            return True, None
    except Exception as e:
        logger.warning(
            "[rate_limiter] check_budget DB 异常,降级允许: %s", e
        )
        return True, None
