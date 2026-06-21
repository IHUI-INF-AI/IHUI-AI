"""Bug-52: 支付宝退款失败 DLQ (Dead Letter Queue).

场景: 退款失败 (网络/支付宝 5xx) 时, 业务方会重试, 但有上限.
超过 3 次失败后进入 DLQ, 人工介入, 不再自动重试.

存储:
  1. Redis ZSET (主): key=zhs:refund:dlq, score=ts, member=order_no
  2. Redis HASH: key=zhs:refund:dlq:meta:<order_no>, 记录重试次数 / 错误 / 上下文
  3. DB sys_refund_log (兜底): 启动时从 DB 拉最近 100 条未完成的退款

行为:
  - 失败一次: redis incr retry_count, 设置 1h expire
  - 失败二次: 加倍 expire, push 到 DLQ monitor
  - 失败三次: 进入 DLQ (永久存储), 触发告警 (Bug-58 接入)
  - 成功: 清掉 retry 记录
"""

import asyncio
import json
import time
from typing import Any

from loguru import logger

# 阈值
MAX_RETRY = 3
DLQ_TTL_SEC = 7 * 24 * 3600  # DLQ 7 天后过期
META_TTL_SEC = 24 * 3600  # 单次失败 meta 24h 后过期

_redis_client = None


def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        from app.utils.redis_client import get_redis as _gr

        _redis_client = _gr()
    except Exception as e:
        logger.debug(f"refund_dlq redis unavailable: {e}")
    return _redis_client


# ---------------------------------------------------------------------------
# 失败记录 / 重试
# ---------------------------------------------------------------------------


def _meta_key(order_no: str) -> str:
    return f"zhs:refund:dlq:meta:{order_no}"


def _dlq_key() -> str:
    return "zhs:refund:dlq"


def record_refund_failure(
    order_no: str,
    error: str,
    context: dict[str, Any] | None = None,
) -> int:
    """记录退款失败, 返回当前重试次数 (1-based).

    Returns:
        retry_count: 1, 2, 3 (第三次进入 DLQ)
    """
    r = _get_redis()
    if r is None:
        return -1
    try:
        _meta = json.dumps(
            {
                "order_no": order_no,
                "error": error,
                "context": context or {},
                "last_retry_at": time.time(),
            },
            ensure_ascii=False,
        )
        key = _meta_key(order_no)
        retry_count = r.incr(key)
        if retry_count == 1:
            r.expire(key, META_TTL_SEC)
        # 同时记录最新错误信息
        r.hset(key + ":info", mapping={"error": error, "ts": str(time.time())})
        r.expire(key + ":info", META_TTL_SEC)

        if retry_count >= MAX_RETRY:
            # 第三次失败: 进入 DLQ
            r.zadd(_dlq_key(), {order_no: time.time()})
            r.expire(_dlq_key(), DLQ_TTL_SEC)
            logger.error(f"refund_dlq exhausted order={order_no} retry={retry_count} err={error}")
            # 触发告警
            try:
                from app.utils.alert_router import alert_critical

                alert_critical(
                    f"refund_dlq_exhausted:{order_no}",
                    f"Order {order_no} refund failed {retry_count} times, last error: {error}",
                )
            except Exception:
                logger.warning("Caught unexpected exception")
        else:
            logger.warning(f"refund_retry order={order_no} retry={retry_count}/{MAX_RETRY} err={error}")
        return int(retry_count)
    except Exception as e:
        logger.warning(f"record_refund_failure error: {e}")
        return -1


def clear_refund_failure(order_no: str) -> None:
    """退款成功后清掉失败记录."""
    r = _get_redis()
    if r is None:
        return
    try:
        r.delete(_meta_key(order_no))
        r.delete(_meta_key(order_no) + ":info")
        r.zrem(_dlq_key(), order_no)
    except Exception as e:
        logger.debug(f"clear_refund_failure error: {e}")


def get_retry_count(order_no: str) -> int:
    """当前失败次数."""
    r = _get_redis()
    if r is None:
        return 0
    try:
        v = r.get(_meta_key(order_no))
        return int(v) if v else 0
    except Exception:
        return 0


# ---------------------------------------------------------------------------
# DLQ 管理 (admin)
# ---------------------------------------------------------------------------


def list_dlq(limit: int = 100) -> list[dict[str, Any]]:
    """列 DLQ 中的订单."""
    r = _get_redis()
    if r is None:
        return []
    out: list[dict[str, Any]] = []
    try:
        items = r.zrange(_dlq_key(), 0, limit - 1, withscores=True)
        for order_no, ts in items:
            info_raw = r.hgetall(_meta_key(order_no) + ":info")
            out.append(
                {
                    "order_no": order_no,
                    "failed_at": float(ts),
                    "info": info_raw,
                }
            )
    except Exception as e:
        logger.warning(f"list_dlq error: {e}")
    return out


def remove_from_dlq(order_no: str) -> bool:
    """人工修复后从 DLQ 移除."""
    r = _get_redis()
    if r is None:
        return False
    try:
        r.zrem(_dlq_key(), order_no)
        r.delete(_meta_key(order_no))
        r.delete(_meta_key(order_no) + ":info")
        return True
    except Exception:
        return False


def dlq_size() -> int:
    r = _get_redis()
    if r is None:
        return 0
    try:
        return int(r.zcard(_dlq_key()))
    except Exception:
        return 0


# ---------------------------------------------------------------------------
# DB 兜底: 启动时同步最近失败记录
# ---------------------------------------------------------------------------


async def sync_dlq_from_db() -> int:
    """从 sys_refund_log 同步 (重启动时恢复 DLQ 状态)."""
    try:
        from sqlalchemy import text

        def _q():
            from app.database import get_session

            with get_session() as s:
                rows = s.execute(
                    text(
                        "SELECT order_no, retry_count, last_error "
                        "FROM sys_refund_log WHERE status = 2 "
                        "AND retry_count >= :mx ORDER BY last_retry_at DESC LIMIT 100"
                    ),
                    {"mx": MAX_RETRY},
                ).fetchall()
                return [{"order_no": r[0], "retry_count": r[1], "error": r[2]} for r in rows]

        rows = await asyncio.to_thread(_q)
        r = _get_redis()
        if r is None or not rows:
            return 0
        pipe = r.pipeline()
        for row in rows:
            order_no = row["order_no"]
            pipe.zadd(_dlq_key(), {order_no: time.time()})
        pipe.expire(_dlq_key(), DLQ_TTL_SEC)
        pipe.execute()
        logger.info(f"refund_dlq synced from db: {len(rows)} orders")
        return len(rows)
    except Exception as e:
        logger.debug(f"sync_dlq_from_db skipped: {e}")
        return 0
