"""Backfill 进度查询 API (建议 145/148) - app/api/v1/monitor/backfill.py.

端点:
  GET    /monitor/backfill/status    - 当前状态快照 (JSON)
  GET    /monitor/backfill/progress  - SSE 实时进度流
  POST   /monitor/backfill/reset     - 重置状态 (清空历史)
  GET    /monitor/backfill/history   - 最近历史事件
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.backfill_broadcaster import get_broadcaster
from app.backfill_persister import SQLiteBackfillPersister
from app.security import require_login

logger = logging.getLogger(__name__)
router = APIRouter()


def _ensure_broadcaster_with_persister():
    """确保 broadcaster 注入了 persister (建议 148, 跨进程可恢复)."""
    persister_path = os.environ.get("BACKFILL_PERSISTER_PATH", "backfill_state.db")
    persister = SQLiteBackfillPersister(db_path=persister_path)
    return get_broadcaster(persister=persister)


# ---------------------------------------------------------------------------
# 状态快照
# ---------------------------------------------------------------------------


@router.get("/status", summary="Backfill 状态快照")
def backfill_status(_user: str = Depends(require_login)):
    bc = _ensure_broadcaster_with_persister()
    return {"ok": True, "data": bc.get_snapshot()}


# ---------------------------------------------------------------------------
# 历史
# ---------------------------------------------------------------------------


@router.get("/history", summary="Backfill 最近历史事件")
def backfill_history(limit: int = 50, _user: str = Depends(require_login)):
    bc = _ensure_broadcaster_with_persister()
    items = bc.get_history(limit=limit)
    return {"ok": True, "data": items, "count": len(items)}


# ---------------------------------------------------------------------------
# 重置
# ---------------------------------------------------------------------------


@router.post("/reset", summary="重置 backfill 状态")
def backfill_reset(_user: str = Depends(require_login)):
    bc = _ensure_broadcaster_with_persister()
    bc.reset()
    return {"ok": True, "data": bc.get_snapshot()}


# ---------------------------------------------------------------------------
# SSE 实时进度流
# ---------------------------------------------------------------------------


@router.get("/progress", summary="Backfill 实时进度 (SSE)")
def backfill_progress(request: Request):
    """Server-Sent Events: 实时推送 backfill 进度.

    数据格式 (每行一条 SSE 事件):
        event: started
        data: {"event_type": "started", "table": "users", "total": 10000, ...}

        event: tenant_progress
        data: {"event_type": "tenant_progress", "table": "users", "tenant_id": 1, "processed": 500, "total": 2000, ...}

        event: heartbeat
        data: {"event_type": "heartbeat", ...}
    """
    bc = _ensure_broadcaster_with_persister()
    q = bc.subscribe(maxsize=200)

    async def event_stream():
        try:
            # 推送当前快照作为 initial 事件, 方便客户端拿到 baseline
            snapshot = bc.get_snapshot()
            yield f"event: snapshot\ndata: {json.dumps(snapshot, ensure_ascii=False)}\n\n"
            # 推送历史最近 5 条, 让客户端拿到上下文
            for ev in bc.get_history(limit=5):
                yield ev.to_sse()
            last_heartbeat = time.time()
            while True:
                # 客户端断开检测
                if await request.is_disconnected():
                    break
                try:
                    # 阻塞取, 1s 超时
                    event = await asyncio.get_running_loop().run_in_executor(None, lambda: q.get(timeout=0.5))
                    yield event.to_sse()
                except Exception:
                    # 超时: 推送 heartbeat (5s 一次, 防止代理断开)
                    now = time.time()
                    if now - last_heartbeat > 5.0:
                        bc.publish_heartbeat()
                        last_heartbeat = now
                    continue
        finally:
            bc.unsubscribe(q)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
