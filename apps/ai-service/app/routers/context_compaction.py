# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""上下文压缩感知(P0-6)只读路由 —— 让用户感知并回看会话被 LLM 语义压缩的历史。

对标 Claude Code 对"上下文被压缩"的可感知诉求,提供:
- record_compaction():进程内压缩事件记录入口(P0-1 compact_with_llm 语义压缩发生时回写)。
  注意:compact_with_llm.py 本身不做持久化(只返回 info),本模块用线程安全的进程内
  dict 记录每次压缩的关键信息(触发时间 / 压缩前→压缩后 token / 节省比例 / 摘要片段 /
  压缩次数),不引入额外依赖(无 Redis / DB)。
- GET /api/context-compaction?session_id=... → 该会话的压缩历史(时间倒序) + 总次数。

挂载方式(main.py,不修改别人已挂载的 router):
    from app.routers import context_compaction as context_compaction_router
    app.include_router(context_compaction_router.router, prefix="/api", tags=["context-compaction"])

安全:复用 JWT 身份 + 会话归属校验(与 checkpoint_rewind 一致);会话未在运行中登记时
仅校验登录态(宽松)。

数据语义与 compact_with_llm / context_compaction.compress_messages_if_needed 的 info
字段对齐:original_tokens / compressed_tokens / removed_count / trigger / llm_summary。
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from ..core.jwt_auth import get_current_user_id_sync
from ..routers import agent_runtime

router = APIRouter(prefix="/context-compaction", tags=["context-compaction"])
logger = logging.getLogger(__name__)

# 每会话最多保留的压缩记录数(进程内,防无界增长)
MAX_PER_SESSION = 200
# 单次查询上限
MAX_QUERY_LIMIT = 200


# =============================================================================
# 进程内压缩历史存储(线程安全 dict)
# =============================================================================

_lock = threading.Lock()
_history: dict[str, list[dict[str, Any]]] = {}
# user_id -> set(session_id) 的轻量归属索引(可选,用于未在 agent_runtime 登记时的弱校验)
_owned: dict[str, set[str]] = {}


def record_compaction(
    session_id: str,
    *,
    original_tokens: int,
    compressed_tokens: int,
    summary: str = "",
    trigger: str = "llm",
    user_id: str = "",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """记录一次上下文压缩事件(P0-1 LLM 语义压缩回写入口)。

    幂等可调用;进程重启后为空的冷启动(如需跨重启持久化可换 Redis,当前按任务范围
    进程内即可查询)。
    """
    saved_tokens = max(0, original_tokens - compressed_tokens)
    saved_ratio = (
        round(saved_tokens / original_tokens, 4) if original_tokens > 0 else 0.0
    )
    rec: dict[str, Any] = {
        "compaction_id": f"cm-{int(time.time() * 1000):x}-{uuid.uuid4().hex[:6]}",
        "session_id": session_id,
        "original_tokens": int(original_tokens),
        "compressed_tokens": int(compressed_tokens),
        "saved_tokens": int(saved_tokens),
        "saved_ratio": saved_ratio,
        "summary": summary or "",
        "trigger": trigger,
        "user_id": user_id,
        "compacted_at": time.time(),
    }
    if metadata:
        rec["metadata"] = metadata
    with _lock:
        _history.setdefault(session_id, []).append(rec)
        if len(_history[session_id]) > MAX_PER_SESSION:
            # 保留最近 MAX_PER_SESSION 条
            _history[session_id] = _history[session_id][-MAX_PER_SESSION:]
        if user_id:
            _owned.setdefault(user_id, set()).add(session_id)
    return rec


def _authorize_session(request: Request, session_id: str) -> tuple[str, bool]:
    """校验登录态 + 会话归属(与 checkpoint_rewind 语义一致,管理员豁免)。"""
    user_id = get_current_user_id_sync(request)
    role_id = getattr(request.state, "role_id", 0) or 0
    is_admin = int(role_id) >= 1
    session = agent_runtime._find_session(session_id)
    if session is not None:
        owner = getattr(session, "user_id", "") or ""
        if owner and owner != user_id and not is_admin:
            raise HTTPException(status_code=403, detail="无权访问他人会话")
    else:
        # 会话未登记时:若我们记录过归属且非本人,拒绝(宽松但防越权)
        with _lock:
            recorder_owner = _owned.get(session_id)
        if recorder_owner and user_id not in recorder_owner and not is_admin:
            raise HTTPException(status_code=403, detail="无权访问他人会话")
    return user_id, is_admin


# =============================================================================
# 只读端点
# =============================================================================


@router.get("", response_model=dict[str, Any])
async def list_compaction_history(
    request: Request,
    session_id: str = Query(..., min_length=1, max_length=128, description="会话 id"),
    limit: int = Query(50, ge=1, le=MAX_QUERY_LIMIT, description="返回条数(最新在前)"),
) -> dict[str, Any]:
    """返回指定会话的上下文压缩历史(时间倒序)与总次数。"""
    _authorize_session(request, session_id)
    with _lock:
        records = list(_history.get(session_id, []))
    total = len(records)
    # 时间倒序(最新在前)
    records = list(reversed(records))[:limit]
    return {
        "session_id": session_id,
        "total": total,
        "compactions": records,
    }


__all__ = ["router", "record_compaction", "_history"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
