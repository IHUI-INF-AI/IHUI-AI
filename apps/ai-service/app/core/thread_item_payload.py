# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""线程条目载荷清单封闭集（ThreadItemPayload，16 struct variant） —— 统一工程规范 R59（协议面封闭集轴型）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element`` 机器反推，
见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R59-*.md``）：逐字 variant 名与元素数表由
机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族名在本仓 app/core 零命中（或仅为异层别名，
见下），是干净的协议面空白——与 R56-R58 的语义 enum 不同，本轴登记的是**RPC 方法/事件载荷名清单**。

一轴超越：16 个 thread item 载荷逐字表（元素数 1~13 差异化）+ 六类条目域（message/tool/context/review/hook/agent）归类 + 可执行反查。本仓 turn_item 判定散在 stream_events.py，本模块是协议载荷名封闭集。

诚实边界：16 载荷名与元素数逐字确证；条目域六分类是本仓语义归类非对照原生判据；各载荷字段语义未确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ThreadItemPayload",
    "ThreadItemPayloadError",
    "THREAD_ITEM_ELEMENTS",
    "THREAD_ITEM_DOMAIN",
    "thread_item_names",
    "expected_thread_item_element_count",
    "ensure_thread_item_payload",
    "thread_item_domain",
    "thread_item_domain_members",
    "is_thread_item",
    "validate_thread_item",

]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
THREAD_ITEM_ELEMENTS: Final[dict[str, int]] = {
    "AgentMessage": 7,
    "CollabAgentToolCall": 9,
    "CommandExecution": 12,
    "ContextCompaction": 1,
    "DynamicToolCall": 8,
    "EnteredReviewMode": 2,
    "ExitedReviewMode": 2,
    "FileChange": 3,
    "FunctionCallOutput": 4,
    "HookPrompt": 2,
    "ImageView": 2,
    "McpToolCall": 13,
    "Plan": 2,
    "Reasoning": 3,
    "SubAgentActivity": 6,
    "UserMessage": 3,

}

# 本仓语义归类（非对照原生判据）：每个方法/载荷归入一个协议面域。
THREAD_ITEM_DOMAIN: Final[dict[str, str]] = {
    "AgentMessage": "message",
    "CollabAgentToolCall": "tool",
    "CommandExecution": "tool",
    "ContextCompaction": "context",
    "DynamicToolCall": "tool",
    "EnteredReviewMode": "review",
    "ExitedReviewMode": "review",
    "FileChange": "tool",
    "FunctionCallOutput": "tool",
    "HookPrompt": "hook",
    "ImageView": "message",
    "McpToolCall": "tool",
    "Plan": "context",
    "Reasoning": "context",
    "SubAgentActivity": "agent",
    "UserMessage": "message",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(THREAD_ITEM_ELEMENTS)


class ThreadItemPayload(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    AGENT_MESSAGE = "AgentMessage"
    COLLAB_AGENT_TOOL_CALL = "CollabAgentToolCall"
    COMMAND_EXECUTION = "CommandExecution"
    CONTEXT_COMPACTION = "ContextCompaction"
    DYNAMIC_TOOL_CALL = "DynamicToolCall"
    ENTERED_REVIEW_MODE = "EnteredReviewMode"
    EXITED_REVIEW_MODE = "ExitedReviewMode"
    FILE_CHANGE = "FileChange"
    FUNCTION_CALL_OUTPUT = "FunctionCallOutput"
    HOOK_PROMPT = "HookPrompt"
    IMAGE_VIEW = "ImageView"
    MCP_TOOL_CALL = "McpToolCall"
    PLAN = "Plan"
    REASONING = "Reasoning"
    SUB_AGENT_ACTIVITY = "SubAgentActivity"
    USER_MESSAGE = "UserMessage"



class ThreadItemPayloadError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def thread_item_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(THREAD_ITEM_ELEMENTS)


def expected_thread_item_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise ThreadItemPayloadError(
            f"未登记的协议面 variant: {name!r} —— 先在 app/core/thread_item_payload.py 的 THREAD_ITEM_ELEMENTS 登记"
        )
    return THREAD_ITEM_ELEMENTS[name]


def ensure_thread_item_payload(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ThreadItemPayloadError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ThreadItemPayloadError(
            f"未登记的协议面 variant: {value!r} —— 先在 app/core/thread_item_payload.py 的 ThreadItemPayload 登记后再产出"
        )
    return value


def thread_item_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_thread_item_payload(value)
    return THREAD_ITEM_DOMAIN[value]


def thread_item_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(THREAD_ITEM_DOMAIN.values()):
        raise ThreadItemPayloadError(
            f"未登记的协议面域: {domain!r} —— 合法域: {sorted(set(THREAD_ITEM_DOMAIN.values()))!r}"
        )
    return tuple(nm for nm, dom in THREAD_ITEM_DOMAIN.items() if dom == domain)


def is_thread_item(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_thread_item(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_thread_item_payload(name)
    expected = expected_thread_item_element_count(name)
    if element_count != expected:
        raise ThreadItemPayloadError(
            f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}"
        )
    return name
