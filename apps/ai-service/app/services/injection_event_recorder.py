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

from app.core.bounded_ttl_store import BoundedTtlDict

# 每会话最多保留的注入事件数(进程内,防无界增长)
MAX_PER_SESSION = 200
# 单次查询上限
MAX_QUERY_LIMIT = 200
# 2026-11-01 安全强化:外层会话键上限 + 滑动寿命(与 context_compaction 同一条判据、同一份实现)。
# 这一族条目存的是**被拦下来的攻击者提示片段**,原先只有"每会话 ≤200 条"的内限,
# 外层键无上限且永不清理 ⇒ 单账号刷会话即可线性吃满内存,同时把注入样本无限期留在进程里。
MAX_SESSION_KEYS = 2000
SESSION_TTL_SECONDS = 6 * 3600.0


_lock = threading.Lock()
_history: BoundedTtlDict = BoundedTtlDict(
    max_keys=MAX_SESSION_KEYS, ttl_seconds=SESSION_TTL_SECONDS
)


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
        existing = _history.get(session_id) or []
        _history.set(session_id, [*existing, rec][-MAX_PER_SESSION:])
        # 归属索引原样删除(2026-11-01):它的键是 user_id、而没有任何一处按 user_id 读过它,
        # 兄弟模块 context_compaction 的读侧键是 session_id ⇒ 这份索引既不参与判据也无上限,
        # 属于"写了没人读的第二份真相源"(§0.6)。记录本身已带 user_id 字段,需要时按记录判。
    return rec


def list_injection_events(session_id: str, limit: int = MAX_QUERY_LIMIT) -> list[dict[str, Any]]:
    """列出某会话的注入拦截事件(时间升序,截断到 limit)。"""
    with _lock:
        records = list(_history.get(session_id) or [])
    return records[: max(1, min(int(limit), MAX_QUERY_LIMIT))]


def reset_injection_events() -> None:
    """清空全部注入事件记录(测试用)。"""
    with _lock:
        _history.clear()


__all__ = [
    "record_injection_event",
    "list_injection_events",
    "reset_injection_events",
    "_history",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
