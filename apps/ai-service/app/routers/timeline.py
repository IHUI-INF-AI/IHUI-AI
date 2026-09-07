# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:全活动时间线回放(P1-4)路由 — GET /api/timeline 一次拉全会话活动。

"""全活动时间线回放(P1-4)只读路由。

- GET /api/timeline?session_id=...  → 该会话的全部活动统一事件流(step / compaction /
  checkpoint / cost / injection),时间升序,供前端时间线组件一次拉取并回放。

安全:复用 JWT 鉴权 + 会话归属校验(与 checkpoint_rewind / context-compaction 一致)。
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from ..core.jwt_auth import get_current_user_id_sync
from ..routers import agent_runtime
from ..services.agent_timeline import MAX_EVENTS, aggregate_timeline

router = APIRouter(prefix="/timeline", tags=["timeline"])
logger = logging.getLogger(__name__)


def _authorize_session(request: Request, session_id: str) -> None:
    """校验会话归属:session 存在且属他人时拒绝(管理员除外)。"""
    user_id = get_current_user_id_sync(request)
    role_id = getattr(request.state, "role_id", 0) or 0
    is_admin = int(role_id) >= 1
    session = agent_runtime._find_session(session_id)
    if session is not None:
        owner = getattr(session, "user_id", "") or ""
        if owner and owner != user_id and not is_admin:
            raise HTTPException(status_code=403, detail="无权访问他人会话")


@router.get("", response_model=dict[str, Any])
async def get_timeline(
    request: Request,
    session_id: str = Query(..., min_length=1, max_length=128, description="会话 id"),
    limit: int = Query(MAX_EVENTS, ge=1, le=MAX_EVENTS, description="返回事件上限"),
) -> dict[str, Any]:
    """返回指定会话的全部活动统一时间线(步骤/压缩/检查点/成本/注入拦截)。"""
    _authorize_session(request, session_id)
    data: dict[str, Any] = await aggregate_timeline(session_id, limit=limit)
    return {"code": 0, "message": "ok", "data": data}


__all__ = ["router", "get_timeline"]
