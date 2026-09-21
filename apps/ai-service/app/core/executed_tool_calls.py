# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/executed_tool_calls.py
"""本轮已执行工具调用的记录与回灌(2026-09-20 第五十六批,对标 Codex
executed_tool_calls.rs / seen_ids.rs / request_metadata.rs)。

引擎单轮内使用本记录器:``record`` 在既有执行边界捕获"模型本轮尝试过哪些工具
调用",``bound_for_prompt`` 按 Codex 配额/最近优先语义产出回灌条目,``reset``
在新轮次清空(对齐 per-turn 生命周期)。回灌条目经 ``build_request_metadata``
(完全跟 Codex 源码:``internal_chat_message_metadata_passthrough.executed_tool_calls``)
注入后续 prompt,用于配额/去重/最近优先,抑制长轮次重复调用。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


# ===========================================================================
# seen_ids: 去重(对标 Codex seen_ids.rs::SeenIds::observe_call_id)
# ---------------------------------------------------------------------------
# Codex 用 8K-word 布隆过滤器且 bit 永不清除(碰撞可 withholding 证明,但不会让
# 已观察 ID 再次显得 fresh)。ihui 每轮记录器用精确 set,保证同 call_id 恰好
# 只记一次、零误判,满足"同 call_id 只记一次"的硬语义。
# ===========================================================================
class SeenIds:
    """追踪已见 call_id;``observe_call_id`` 仅在首次出现时返回 True。"""

    def __init__(self) -> None:
        self._seen: set[str] = set()

    def observe_call_id(self, call_id: str) -> bool:
        """``call_id`` 首次出现返回 True 并登记;重复出现返回 False(零副作用)。"""
        if call_id in self._seen:
            return False
        self._seen.add(call_id)
        return True

    def __contains__(self, call_id: str) -> bool:
        return call_id in self._seen

    def clear(self) -> None:
        self._seen.clear()


# 回灌条目形态:ihui 的 ``record`` 只采集 (call_id, name);Codex 的
# ``ExecutedToolCall`` 为 {name, arguments} 且 call_id 挂在 output item 上。
# 这里适配为 {"name": ..., "call_id": ...} 以保留引擎可回灌的绑定。
@dataclass
class _Entry:
    name: str
    call_id: str


class ExecutedToolCalls:
    """每轮已执行工具调用记录器(对标 Codex ``ExecutedToolCalls``)。"""

    def __init__(self) -> None:
        self._seen = SeenIds()
        self._entries: list[_Entry] = []

    # ------------------------------------------------------------------
    def record(self, call_id: str, name: str) -> bool:
        """记录一次已尝试的工具调用。幂等:同 call_id 重复 record 零副作用。

        返回 True 表示本次为首次记录;False 表示 call_id 已见过(忽略本次)。
        """
        if not self._seen.observe_call_id(call_id):
            return False
        self._entries.append(_Entry(name=name, call_id=call_id))
        return True

    # ------------------------------------------------------------------
    def bound_for_prompt(self, limit: int) -> list[dict[str, str]]:
        """产出受 ``limit`` 约束的回灌条目,最近优先截断。

        对标 Codex ``bound_executed_tool_calls_for_prompt_prioritizing_recent``:
        超出配额时保留最新调用,且保留条目之间的相对顺序。``limit<=0`` 或空集
        返回空列表。
        """
        if limit <= 0 or not self._entries:
            return []
        if limit >= len(self._entries):
            kept = self._entries
        else:
            kept = self._entries[-limit:]
        return [{"name": e.name, "call_id": e.call_id} for e in kept]

    # ------------------------------------------------------------------
    def entries(self) -> list[dict[str, str]]:
        """当前全部条目(按记录顺序),供测试与诊断。"""
        return [{"name": e.name, "call_id": e.call_id} for e in self._entries]

    # ------------------------------------------------------------------
    def reset(self) -> None:
        """开启新轮次:清空所有已记录调用(per-turn 生命周期)。"""
        self._seen.clear()
        self._entries.clear()


# ===========================================================================
# 回灌构造(完全跟 Codex 源码)
# ---------------------------------------------------------------------------
# Codex 不为 executed tool calls 发 developer 文本片段,而是把
# ``executed_tool_calls`` 挂到请求的 ``internal_chat_message_metadata_passthrough``
# 字段(协议层 ``InternalChatMessageMetadataPassthrough``)。该结构体除
# ``executed_tool_calls`` / ``tool_calls_complete`` 外其余字段均为
# ``Option`` 且 ``skip_serializing_if = "Option::is_none"``;ihui 简化记录器无
# cell_id / turn_id,故只输出这两个字段。我们严格跟源码,**不发明** developer
# 片段格式。
# ===========================================================================
def build_request_metadata(entries: list[dict[str, str]]) -> dict[str, Any] | None:
    """构造回灌用的 request-metadata dict;无条目返回 None。

    形态对齐 Codex ``InternalChatMessageMetadataPassthrough``:设置
    ``executed_tool_calls`` 列表并标记 ``tool_calls_complete = True``(简化记录器
    认为所有已记录尝试均完整)。空输入 → None。
    """
    if not entries:
        return None
    return {
        "executed_tool_calls": [
            {"name": e["name"], "call_id": e["call_id"]} for e in entries
        ],
        "tool_calls_complete": True,
    }


def build_executed_tool_calls_fragment(entries: list[dict[str, str]]) -> dict[str, Any] | None:
    """兼容别名。Codex 经 request metadata 回灌,而非文本片段。

    返回 request-metadata dict(见 ``build_request_metadata``)。空输入 → None。
    刻意不发明 developer 角色片段,因为 Codex 源码把 ``executed_tool_calls``
    挂到 request metadata,而非 developer 消息正文。
    """
    return build_request_metadata(entries)
