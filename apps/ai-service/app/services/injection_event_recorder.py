# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""注入拦截事件记录器(全活动时间线回放 · P1-4 数据底座)。

记录一次 agent 会话中发生的 prompt 注入 / 危险工具入参拦截事件,供时间线回放
聚合端点(GET /api/timeline)统一拉取并可视化。

设计(对齐 routers/context_compaction.py 的进程内压缩历史存储):
- 进程内线程安全 dict[session_id -> list[event]]
- 单会话上限 MAX_PER_SESSION,防无界增长(保留最近 N 条)
- 不引入 Redis / DB 依赖,冷启动为空(跨重启不持久)
- 与成本账本 / 步骤录制同源的线程锁保护策略
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from typing import Any

logger = logging.getLogger(__name__)

# 每会话最多保留的注入事件数(进程内,防无界增长)
MAX_PER_SESSION = 200
# 单次查询上限
MAX_QUERY_LIMIT = 200


_lock = threading.Lock()
_history: dict[str, list[dict[str, Any]]] = {}
# user_id -> set(session_id) 的轻量归属索引(可选,用于会话未登记时的弱校验)
_owned: dict[str, set[str]] = {}


def record_injection_event(
    session_id: str,
    *,
    source: str = "",
    risk_level: str = "low",
    hit_types: list[str] | None = None,
    action: str = "pass",
    blocked: bool = False,
    snippet: str = "",
    user_id: str = "",
) -> dict[str, Any]:
    """记录一次注入拦截事件(进程内)。

    Args:
        session_id: 会话 id(必填)
        source: 内容来源 web|mcp|message|file
        risk_level: low|med|high
        hit_types: 命中的注入类型列表(instruction_overwrite 等)
        action: flag|sanitize|refuse|pass
        blocked: 是否被拦截(refuse / 危险入参阻断)
        snippet: 命中上下文片段(截断展示)
        user_id: 归属用户(可选)

    Returns:
        记录下来的事件 dict(含 event_id / at 等)。
    """
    rec: dict[str, Any] = {
        "event_id": f"inj-{int(time.time() * 1000):x}-{uuid.uuid4().hex[:6]}",
        "session_id": session_id,
        "source": source or "",
        "risk_level": risk_level or "low",
        "hit_types": list(hit_types or []),
        "action": action or "pass",
        "blocked": bool(blocked),
        "snippet": (snippet or "")[:200],
        "user_id": user_id or "",
        "at": time.time(),
    }
    with _lock:
        _history.setdefault(session_id, []).append(rec)
        if len(_history[session_id]) > MAX_PER_SESSION:
            _history[session_id] = _history[session_id][-MAX_PER_SESSION:]
        if user_id:
            _owned.setdefault(user_id, set()).add(session_id)
    return rec


def list_injection_events(session_id: str, limit: int = MAX_QUERY_LIMIT) -> list[dict[str, Any]]:
    """列出某会话的注入拦截事件(时间升序,截断到 limit)。"""
    with _lock:
        records = list(_history.get(session_id, []))
    return records[: max(1, min(int(limit), MAX_QUERY_LIMIT))]


def reset_injection_events() -> None:
    """清空全部注入事件记录(测试用)。"""
    with _lock:
        _history.clear()
        _owned.clear()


__all__ = [
    "record_injection_event",
    "list_injection_events",
    "reset_injection_events",
    "_history",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
