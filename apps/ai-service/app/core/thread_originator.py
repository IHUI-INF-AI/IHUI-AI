# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/thread_originator.py
"""线程来源(originator)解析与存储线程归一 — 2026-09-19 第三十二批,对标 Codex
core/src/thread_manager.rs(originator_from_service_name / effective_originator_value /
stored_thread_to_initial_history / thread_store_*_error 映射,纯函数部分)。

移植范围:
- originator_from_service_name:service_name 对已知 originator 集合的 ASCII 大小写
  不敏感精确匹配,命中返回规范化字符串;
- effective_originator_value:五级优先链 metrics 命中 > persisted > inherited > env > default;
- stored_thread_to_initial_history:持久化线程缺 history 判 Fatal,否则归一为
  Resumed 初始历史(conversation_id/history/rollout_path 缺省回退);
- thread_store 错误映射两函数:ThreadNotFound/InvalidRequest/Unsupported 语义化,
  其余折叠 Fatal。

判定跳过:ThreadManager/ThreadHistoryBuilder/Store 抽象本体(会话生命周期与 IO,
依赖 Arc<dyb store> 与 async 运行时)。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

KNOWN_ORIGINATORS: tuple[str, ...] = (
    "codex_work_desktop",
    "codex_work_web",
    "codex_work_mobile",
    "codex_work_cca",
    "chatgpt_cca",
)


def originator_from_service_name(service_name: str | None) -> str | None:
    """metrics service_name 精确命中已知 originator(ASCII 大小写不敏感),返回规范形。"""
    if service_name is None:
        return None
    trimmed = service_name.strip()
    for originator in KNOWN_ORIGINATORS:
        if trimmed.casefold() == originator.casefold():
            return originator
    return None


def effective_originator_value(
    metrics_service_name: str | None,
    env_originator: str | None,
    persisted_originator: str | None,
    inherited_originator: str | None,
    default_originator: str,
) -> str:
    """Codex 五级优先链:metrics 命中 > persisted > inherited > env > default。"""
    return (
        originator_from_service_name(metrics_service_name)
        or persisted_originator
        or inherited_originator
        or env_originator
        or default_originator
    )


@dataclass
class ResumedHistory:
    """Codex ResumedHistory 等价。"""

    conversation_id: str
    items: list[dict[str, object]] = field(default_factory=list)
    rollout_path: str | None = None


def stored_thread_to_initial_history(
    stored_thread: dict[str, Any],
) -> ResumedHistory:
    """缺持久化 history 判 Fatal(ValueError);否则归一 Resumed(rollout_path 缺省回退)。"""
    thread_id = str(stored_thread.get("thread_id", ""))
    history = stored_thread.get("history")
    if history is None:
        raise ValueError(f"thread {thread_id} did not include persisted history")
    if not isinstance(history, dict):
        raise ValueError(f"thread {thread_id} has malformed persisted history")
    items = history.get("items")
    rollout_path = stored_thread.get("rollout_path") or history.get("rollout_path")
    return ResumedHistory(
        conversation_id=thread_id,
        items=list(items) if isinstance(items, list) else [],
        rollout_path=rollout_path if isinstance(rollout_path, str) else None,
    )


class ThreadStoreErrorKind:
    """thread store 错误类别(Codex ThreadStoreError 语义面)。"""

    THREAD_NOT_FOUND = "thread_not_found"
    INVALID_REQUEST = "invalid_request"
    UNSUPPORTED = "unsupported"
    OTHER = "other"


def map_thread_store_read_error(err: dict[str, object]) -> str:
    """读错误映射:NotFound→ThreadNotFound;InvalidRequest→InvalidRequest;其余→Fatal 文案。"""
    kind = str(err.get("kind", ThreadStoreErrorKind.OTHER))
    if kind == ThreadStoreErrorKind.THREAD_NOT_FOUND:
        return f"thread not found: {err.get('thread_id')}"
    if kind == ThreadStoreErrorKind.INVALID_REQUEST:
        return f"invalid request: {err.get('message')}"
    return f"failed to read thread by rollout path: {err}"


def map_thread_store_metadata_update_error(thread_id: str, err: dict[str, object]) -> str:
    """元数据更新错误映射:Unsupported 语义化操作名;其余同读错误折叠。"""
    kind = str(err.get("kind", ThreadStoreErrorKind.OTHER))
    if kind == ThreadStoreErrorKind.THREAD_NOT_FOUND:
        return f"thread not found: {thread_id}"
    if kind == ThreadStoreErrorKind.INVALID_REQUEST:
        return f"invalid request: {err.get('message')}"
    if kind == ThreadStoreErrorKind.UNSUPPORTED:
        return (
            f"thread metadata update is not supported by this store: {err.get('operation')}"
        )
    return f"failed to update thread metadata {thread_id}: {err}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
