# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""账号保活中心 REST API。

**落点说明(2026-10-26 迁)**:本文件原在 ``app/services/keepalive/router.py``,与实现同包。
迁到 ``app/routers/`` 不是为了好看 —— ``scripts/check-api-routes.mjs`` 的注册面只枚举
``app/routers/**`` 与 ``app/api/**``,放在 services 里那 6 条端点对该门是**不可见**的
(只落"未判定(前缀假设命中)"桶,不判红也不记绿)。注册面看不见 = 以后谁改了挂载或删了
一条端点,没有任何尺子会响。形态与 ``app/routers/checkin.py`` 完全同构(routers 层 → services 层)。

前缀 ``/api/keepalive``(router 自带完整前缀,main.py 挂载时不再加 ``prefix``)。

端点:
- GET  /status                自检面:启用理由 / 调度是否真活着 / 上轮摘要
- GET  /overview              健康度总览(按来源分组 + 临期 + 需人处理的账号)
- GET  /accounts              逐账号明细(可按 source / health 过滤)
- GET  /events                流水(可只取失败)
- GET  /stats?days=7          近 N 天各来源成功率
- POST /run                   手动触发一轮(可指定单账号 —— 前端"立即重试")
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.jwt_auth import require_request_user_id
from app.core.logging import get_logger
from app.services.keepalive import store
from app.services.keepalive.center import keepalive_center, resolve_config
from app.services.keepalive.models import (
    HEALTH_CRITICAL,
    HEALTH_HEALTHY,
    HEALTH_UNKNOWN,
    HEALTH_WARNING,
    KIND_UNSUPPORTED,
    StateSnapshot,
)
from app.services.keepalive.policy import health_of, is_expiring

logger = get_logger(__name__)

router = APIRouter(prefix="/api/keepalive", tags=["keepalive"])

# 手动触发的后台任务必须被强引用持有到完成 —— 事件循环只握弱引用,丢弃返回值
# 等于"接口回了已触发,任务被 GC 半路收走"(同 cookie_refresh_daemon 2026-10-25 的
# 那条收口;两处都是同一个坑,不是各写一遍的巧合)。
_background_tasks: set[asyncio.Task[Any]] = set()

_EVENTS_LIMIT_DEFAULT = 50
_EVENTS_LIMIT_MAX = 500


def _ok(data: Any, message: str = "ok") -> dict[str, Any]:
    return {"code": 0, "message": message, "data": data}


def _snapshot_from_row(row: Any) -> StateSnapshot:
    return StateSnapshot(
        consecutive_failures=int(row["consecutive_failures"] or 0),
        last_ok_at=row["last_ok_at"],
        last_fail_at=row["last_fail_at"],
        expires_at=row["expires_at"],
        warned_at=row["warned_at"],
        alerted_at=row["alerted_at"],
        next_retry_at=row["next_retry_at"],
    )


def _serialize_state(row: Any, now: datetime) -> dict[str, Any]:
    cfg = resolve_config()
    snapshot = _snapshot_from_row(row)
    health = health_of(snapshot, now, cfg.policy)
    return {
        "ref": row["account_ref"],
        "source": row["source"],
        "account_id": int(row["account_id"]),
        "platform": row["platform"] or "",
        "display": row["display_name"] or "",
        "health": health,
        "consecutive_failures": snapshot.consecutive_failures,
        "last_ok_at": _iso(snapshot.last_ok_at),
        "last_fail_at": _iso(snapshot.last_fail_at),
        "next_retry_at": _iso(snapshot.next_retry_at),
        "expires_at": _iso(snapshot.expires_at),
        "expiring_soon": is_expiring(snapshot.expires_at, now, cfg.policy.expire_warn_days),
        "last_error": row["last_error"],
        "last_error_kind": row["last_error_kind"],
        "alerted_at": _iso(snapshot.alerted_at),
        "updated_at": _iso(row["updated_at"]),
    }


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


@router.get("/status")
async def get_status(
    _uid: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """自检面。**这是"到底开没开"的唯一权威答案**(不靠读配置猜)。"""
    return _ok(keepalive_center.status())


@router.get("/overview")
async def get_overview(
    uid: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """健康度总览:分档计数 + 需人处理清单。

    「需人处理」= critical/warning 且**重试不会自愈**的那些(过期/环境),
    与"暂时网络抖动"区分开 —— 后者会自己回来,不该占用人注意力。
    """
    now = datetime.now(UTC)
    cfg = resolve_config()
    rows = await store.list_state_rows(uid)

    counts = {HEALTH_HEALTHY: 0, HEALTH_WARNING: 0, HEALTH_CRITICAL: 0, HEALTH_UNKNOWN: 0}
    by_source: dict[str, dict[str, int]] = {}
    needs_attention: list[dict[str, Any]] = []
    expiring: list[dict[str, Any]] = []

    for row in rows:
        item = _serialize_state(row, now)
        counts[item["health"]] = counts.get(item["health"], 0) + 1
        bucket = by_source.setdefault(
            item["source"],
            {HEALTH_HEALTHY: 0, HEALTH_WARNING: 0, HEALTH_CRITICAL: 0, HEALTH_UNKNOWN: 0},
        )
        bucket[item["health"]] = bucket.get(item["health"], 0) + 1
        if item["health"] in (HEALTH_CRITICAL, HEALTH_WARNING):
            needs_attention.append(item)
        if item["expiring_soon"]:
            expiring.append(item)

    stats = await store.stats_since(owner=uid, days=7)
    return _ok(
        {
            "generated_at": now.isoformat(),
            "total": len(rows),
            "counts": counts,
            "by_source": by_source,
            "needs_attention": needs_attention,
            "expiring_soon": sorted(
                expiring, key=lambda x: x["expires_at"] or ""
            ),
            "success_rate_7d": _with_rate(stats),
            "config": cfg.as_dict(),
        }
    )


def _with_rate(stats: dict[str, dict[str, int]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for source, item in stats.items():
        total = item.get("ok", 0) + item.get("failed", 0)
        out[source] = {
            "ok": item.get("ok", 0),
            "failed": item.get("failed", 0),
            "total": total,
            "rate": round(item.get("ok", 0) / total, 4) if total else None,
        }
    return out


@router.get("/accounts")
async def list_accounts(
    source: str | None = Query(None, description="按来源过滤"),
    health: str | None = Query(None, description="按健康度过滤"),
    uid: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    now = datetime.now(UTC)
    rows = await store.list_state_rows(uid)
    items = [_serialize_state(r, now) for r in rows]
    if source:
        items = [i for i in items if i["source"] == source]
    if health:
        items = [i for i in items if i["health"] == health]
    return _ok({"total": len(items), "items": items})


@router.get("/events")
async def list_events(
    ref: str | None = Query(None, description="只看某账号"),
    limit: int = Query(_EVENTS_LIMIT_DEFAULT, ge=1, le=_EVENTS_LIMIT_MAX),
    only_failures: bool = Query(False),
    uid: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    rows = await store.list_events(
        owner=uid, ref=ref, limit=limit, only_failures=only_failures
    )
    items = [
        {
            "id": int(r["id"]),
            "ref": r["account_ref"],
            "source": r["source"],
            "ok": bool(r["ok"]),
            "kind": r["kind"],
            "message": r["message"] or "",
            "duration_ms": int(r["duration_ms"] or 0),
            "attempt": int(r["attempt"] or 1),
            "created_at": _iso(r["created_at"]),
            "unsupported": r["kind"] == KIND_UNSUPPORTED,
        }
        for r in rows
    ]
    return _ok({"total": len(items), "items": items})


@router.get("/stats")
async def get_stats(
    days: int = Query(7, ge=1, le=90),
    uid: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    stats = await store.stats_since(owner=uid, days=days)
    return _ok({"days": days, "by_source": _with_rate(stats)})


@router.post("/run")
async def trigger_run(
    ref: str | None = Query(None, description="只跑指定账号(如 publish_cookie:12)"),
    force: bool = Query(True, description="无视退避立即重测"),
    uid: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """手动触发。后台执行并立即返回 —— 但任务被强引用持有,不会半路消失。"""
    if ref and ":" not in ref:
        raise HTTPException(status_code=400, detail="ref 格式应为 <source>:<id>")

    async def _job() -> None:
        try:
            summary = await keepalive_center.run_round(
                owner=uid, force=force, only_ref=ref
            )
            logger.info(
                "[keepalive] 手动触发完成 total=%s ok=%s failed=%s",
                summary.total,
                summary.ok,
                summary.failed,
            )
        except Exception:
            logger.exception("[keepalive] 手动触发失败")

    task = asyncio.create_task(_job())
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return _ok({"triggered": True, "ref": ref}, "保活任务已触发,后台执行中")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
