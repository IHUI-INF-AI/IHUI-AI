"""健康检查端点.

K8s probes:
  - /health/live   Liveness  - 进程是否在跑 (轻量, 不依赖 DB)
  - /health/ready  Readiness - 是否可以接受流量 (检查 DB + Redis)
  - /health        综合健康 (兼容旧版)
  - /health/history 健康检查历史 (最近 100 条, 内存 + SQLite 持久化)
"""

import asyncio
import logging
import threading
import time
from collections import deque
from typing import Any

from fastapi import APIRouter, Query
from sqlalchemy import text

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])

_START_TIME = time.time()
_MAX_HISTORY = 100
_MAX_HISTORY_AGE_DAYS = 7
_HISTORY: deque = deque(maxlen=_MAX_HISTORY)
_HISTORY_TABLE_READY = False
_HISTORY_TABLE_LOCK = threading.Lock()


def _ensure_history_table() -> None:
    """确保 SQLite/PostgreSQL 表存在, 并清理 > 7 天的历史."""
    global _HISTORY_TABLE_READY
    if _HISTORY_TABLE_READY:
        return
    with _HISTORY_TABLE_LOCK:
        if _HISTORY_TABLE_READY:
            return
        try:
            from app.database import engine1
            with engine1.begin() as conn:
                dialect = conn.dialect.name
                if dialect == "postgresql":
                    conn.execute(text(
                        "CREATE TABLE IF NOT EXISTS zhs_health_history ("
                        "id BIGSERIAL PRIMARY KEY, "
                        "ts BIGINT NOT NULL, "
                        "latency_ms REAL NOT NULL, "
                        "status VARCHAR(16) NOT NULL, "
                        "db_ok BOOLEAN NOT NULL, "
                        "redis_ok BOOLEAN NOT NULL)"
                    ))
                else:
                    conn.execute(text(
                        "CREATE TABLE IF NOT EXISTS zhs_health_history ("
                        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                        "ts BIGINT NOT NULL, "
                        "latency_ms REAL NOT NULL, "
                        "status VARCHAR(16) NOT NULL, "
                        "db_ok BOOLEAN NOT NULL, "
                        "redis_ok BOOLEAN NOT NULL)"
                    ))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_health_history_ts ON zhs_health_history (ts DESC)"))
                # 清理 > 7 天的数据
                cutoff_ms = int((time.time() - _MAX_HISTORY_AGE_DAYS * 86400) * 1000)
                conn.execute(text("DELETE FROM zhs_health_history WHERE ts < :cutoff"), {"cutoff": cutoff_ms})
                # 加载最近 100 条到内存
                rows = conn.execute(text(
                    "SELECT ts, latency_ms, status, db_ok, redis_ok "
                    "FROM zhs_health_history ORDER BY ts DESC LIMIT :n"
                ), {"n": _MAX_HISTORY}).fetchall()
                _HISTORY.clear()
                for r in reversed(rows):
                    _HISTORY.append({
                        "ts": int(r[0]),
                        "latency_ms": round(float(r[1]), 1),
                        "status": r[2],
                        "db_ok": bool(r[3]),
                        "redis_ok": bool(r[4]),
                    })
            _HISTORY_TABLE_READY = True
        except Exception:
            # 表创建失败时降级到纯内存模式, 不影响 health 端点工作
            pass


def _record_history(latency_ms: float, status: str, db_ok: bool, redis_ok: bool) -> None:
    """记录一条健康检查历史 (内存 + SQLite 持久化)."""
    ts = int(time.time() * 1000)
    item = {
        "ts": ts,
        "latency_ms": round(latency_ms, 1),
        "status": status,
        "db_ok": db_ok,
        "redis_ok": redis_ok,
    }
    _HISTORY.append(item)
    # 异步持久化 (失败不抛, 不影响 health 响应)
    try:
        from app.database import engine1
        with engine1.begin() as conn:
            conn.execute(
                text("INSERT INTO zhs_health_history (ts, latency_ms, status, db_ok, redis_ok) VALUES (:ts, :l, :s, :d, :r)"),
                {"ts": ts, "l": item["latency_ms"], "s": status, "d": db_ok, "r": redis_ok},
            )
    except Exception as e:
        logger.debug("持久化健康检查历史失败: %s", e)


def _check_db_sync(engine, timeout: float = 2.0) -> tuple[bool, str]:
    """同步检查 DB (在 thread 中跑)."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, "ok"
    except Exception as e:
        return False, str(e)[:120]


async def _check_db(timeout: float = 2.0) -> dict[str, Any]:
    """异步检查所有 3 个 DB 引擎 (并发执行, 总耗时 = max 单个超时)."""
    try:
        from app.database import engine1, engine2, engine3
    except Exception as e:
        return {"ok": False, "error": f"db import: {e}"}

    async def _check_one(idx: int, eng) -> tuple[str, dict]:
        try:
            ok, msg = await asyncio.wait_for(
                asyncio.to_thread(_check_db_sync, eng),
                timeout=timeout,
            )
            return f"engine{idx}", {"ok": ok, "msg": msg}
        except TimeoutError:
            return f"engine{idx}", {"ok": False, "msg": f"timeout>{timeout}s"}
        except Exception as e:
            return f"engine{idx}", {"ok": False, "msg": str(e)[:120]}

    # 并发检查 3 个引擎, 总耗时不超过 timeout (而不是 3*timeout)
    pairs = await asyncio.gather(*[_check_one(i, e) for i, e in enumerate([engine1, engine2, engine3], 1)])
    results = dict(pairs)
    results["ok"] = all(r["ok"] for r in results.values())
    return results


async def _check_redis(timeout: float = 1.0) -> dict[str, Any]:
    """异步检查 Redis."""
    try:
        from app.utils.redis_client import get_redis

        r = get_redis()
        if r is None:
            return {"ok": True, "msg": "no redis (using fallback)"}
        ok = await asyncio.wait_for(asyncio.to_thread(r.ping), timeout=timeout)
        return {"ok": bool(ok), "msg": "ok" if ok else "ping failed"}
    except TimeoutError:
        return {"ok": False, "msg": f"timeout>{timeout}s"}
    except Exception as e:
        return {"ok": False, "msg": str(e)[:120]}


@router.get("/health/live", summary="Liveness probe (K8s)")
async def health_live():
    """进程是否在跑 - 不查 DB/Redis, 永远 200 (除非进程死了)."""
    return {
        "status": "alive",
        "uptime_s": round(time.time() - _START_TIME, 1),
    }


@router.get("/health/ready", summary="Readiness probe (K8s)")
async def health_ready():
    """是否可以接受流量 - 检查所有依赖.

    返回 200 表示 ready, 503 表示 not ready (K8s 会停止发流量过来).
    """
    from fastapi.responses import JSONResponse

    db_check, redis_check = await asyncio.gather(_check_db(), _check_redis())
    ready = db_check.get("ok", False) and redis_check.get("ok", False)
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ready" if ready else "not_ready",
            "db": db_check,
            "redis": redis_check,
            "uptime_s": round(time.time() - _START_TIME, 1),
        },
    )


@router.get("/health", summary="综合健康检查")
async def health():
    """综合健康 - 包含 liveness + readiness 信息 (兼容旧版)."""
    t0 = time.time()
    db_check, redis_check = await asyncio.gather(_check_db(), _check_redis())
    overall_ok = db_check.get("ok", False) and redis_check.get("ok", False)
    status = "ok" if overall_ok else "degraded"
    latency_ms = (time.time() - t0) * 1000
    await asyncio.to_thread(_record_history, latency_ms, status, db_check.get("ok", False), redis_check.get("ok", False))
    return {
        "status": status,
        "uptime_s": round(time.time() - _START_TIME, 1),
        "db": db_check,
        "redis": redis_check,
    }


@router.get("/health/history", summary="健康检查历史 (持久化, 最近 7 天, 默认 100 条)")
def health_history(limit: int = Query(50, ge=1, le=10000)):
    """返回最近 N 条健康检查记录 (新 → 旧), 用于前端趋势图跨页面共享数据.

    持久化到 zhs_health_history 表, 保留 7 天, 后端重启不丢失.
    DB 不可用时降级到内存 deque.
    """
    items: list[dict] = []
    try:
        from app.database import engine1
        with engine1.connect() as conn:
            rows = conn.execute(text(
                "SELECT ts, latency_ms, status, db_ok, redis_ok "
                "FROM zhs_health_history ORDER BY ts DESC LIMIT :n"
            ), {"n": limit}).fetchall()
            for r in rows:
                items.append({
                    "ts": int(r[0]),
                    "latency_ms": round(float(r[1]), 1),
                    "status": r[2],
                    "db_ok": bool(r[3]),
                    "redis_ok": bool(r[4]),
                })
    except Exception:
        # DB 失败时降级到内存
        items = list(_HISTORY)[-limit:][::-1]
    total = len(items)
    return {
        "total": total,
        "limit": limit,
        "returned": total,
        "items": items,
    }


@router.get("/metrics/rate-limit", summary="限流 Prometheus 指标")
async def metrics_rate_limit():
    """返回限流相关 Prometheus 指标 (Plain text 格式).

    可被 Prometheus 抓取, 也可用 curl 直接查看.
    """
    from prometheus_client import CONTENT_TYPE_LATEST, generate_latest


    data = generate_latest()
    from fastapi.responses import Response

    return Response(content=data, media_type=CONTENT_TYPE_LATEST)
