# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""轨迹事件载荷清单封闭集（RawTraceEventPayload，28 struct variant） —— 统一工程规范 R59（协议面封闭集轴型）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element`` 机器反推，
见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R59-*.md``）：逐字 variant 名与元素数表由
机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族名在本仓 app/core 零命中（或仅为异层别名，
见下），是干净的协议面空白——与 R56-R58 的语义 enum 不同，本轴登记的是**RPC 方法/事件载荷名清单**。

一轴超越：28 个 trace 事件载荷逐字表（元素数 1~7 差异化，非恒定 2）+ 七类事件域（turn/inference/tool/compaction/thread/code_cell/other）归类 + 可执行反查。元素数差异化使 validate 守门真正具备区分力。

诚实边界：28 载荷名与元素数逐字确证；事件域七分类是本仓语义归类非对照原生判据；各载荷字段语义与触发时序未确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "TraceEventPayload",
    "TraceEventPayloadError",
    "TRACE_EVENT_ELEMENTS",
    "TRACE_EVENT_DOMAIN",
    "trace_event_names",
    "expected_trace_element_count",
    "ensure_trace_event_payload",
    "trace_event_domain",
    "trace_event_domain_members",
    "is_trace_event",
    "validate_trace_event",

]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
TRACE_EVENT_ELEMENTS: Final[dict[str, int]] = {
    "AgentResultObserved": 6,
    "CodeCellEnded": 3,
    "CodeCellInitialResponse": 3,
    "CodeCellStarted": 3,
    "CodexTurnEnded": 2,
    "CodexTurnStarted": 2,
    "CompactionInstalled": 2,
    "CompactionRequestCompleted": 3,
    "CompactionRequestFailed": 3,
    "CompactionRequestStarted": 7,
    "HistoryItemAccepted": 2,
    "InferenceCancelled": 4,
    "InferenceCompleted": 4,
    "InferenceFailed": 4,
    "InferenceStarted": 6,
    "McpToolCallCorrelationAssigned": 2,
    "Other": 4,
    "ProtocolEventObserved": 2,
    "RolloutEnded": 1,
    "RolloutStarted": 2,
    "StdinTargetResolved": 2,
    "ThreadEnded": 2,
    "ThreadResumed": 1,
    "ThreadStarted": 3,
    "ToolCallEnded": 3,
    "ToolCallRuntimeEnded": 3,
    "ToolCallRuntimeStarted": 3,
    "ToolCallStarted": 7,

}

# 本仓语义归类（非对照原生判据）：每个方法/载荷归入一个协议面域。
TRACE_EVENT_DOMAIN: Final[dict[str, str]] = {
    "AgentResultObserved": "inference",
    "CodeCellEnded": "code_cell",
    "CodeCellInitialResponse": "code_cell",
    "CodeCellStarted": "code_cell",
    "CodexTurnEnded": "turn",
    "CodexTurnStarted": "turn",
    "CompactionInstalled": "compaction",
    "CompactionRequestCompleted": "compaction",
    "CompactionRequestFailed": "compaction",
    "CompactionRequestStarted": "compaction",
    "HistoryItemAccepted": "turn",
    "InferenceCancelled": "inference",
    "InferenceCompleted": "inference",
    "InferenceFailed": "inference",
    "InferenceStarted": "inference",
    "McpToolCallCorrelationAssigned": "tool",
    "Other": "other",
    "ProtocolEventObserved": "turn",
    "RolloutEnded": "thread",
    "RolloutStarted": "thread",
    "StdinTargetResolved": "turn",
    "ThreadEnded": "thread",
    "ThreadResumed": "thread",
    "ThreadStarted": "thread",
    "ToolCallEnded": "tool",
    "ToolCallRuntimeEnded": "tool",
    "ToolCallRuntimeStarted": "tool",
    "ToolCallStarted": "tool",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(TRACE_EVENT_ELEMENTS)


class TraceEventPayload(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    AGENT_RESULT_OBSERVED = "AgentResultObserved"
    CODE_CELL_ENDED = "CodeCellEnded"
    CODE_CELL_INITIAL_RESPONSE = "CodeCellInitialResponse"
    CODE_CELL_STARTED = "CodeCellStarted"
    CODEX_TURN_ENDED = "CodexTurnEnded"
    CODEX_TURN_STARTED = "CodexTurnStarted"
    COMPACTION_INSTALLED = "CompactionInstalled"
    COMPACTION_REQUEST_COMPLETED = "CompactionRequestCompleted"
    COMPACTION_REQUEST_FAILED = "CompactionRequestFailed"
    COMPACTION_REQUEST_STARTED = "CompactionRequestStarted"
    HISTORY_ITEM_ACCEPTED = "HistoryItemAccepted"
    INFERENCE_CANCELLED = "InferenceCancelled"
    INFERENCE_COMPLETED = "InferenceCompleted"
    INFERENCE_FAILED = "InferenceFailed"
    INFERENCE_STARTED = "InferenceStarted"
    MCP_TOOL_CALL_CORRELATION_ASSIGNED = "McpToolCallCorrelationAssigned"
    OTHER = "Other"
    PROTOCOL_EVENT_OBSERVED = "ProtocolEventObserved"
    ROLLOUT_ENDED = "RolloutEnded"
    ROLLOUT_STARTED = "RolloutStarted"
    STDIN_TARGET_RESOLVED = "StdinTargetResolved"
    THREAD_ENDED = "ThreadEnded"
    THREAD_RESUMED = "ThreadResumed"
    THREAD_STARTED = "ThreadStarted"
    TOOL_CALL_ENDED = "ToolCallEnded"
    TOOL_CALL_RUNTIME_ENDED = "ToolCallRuntimeEnded"
    TOOL_CALL_RUNTIME_STARTED = "ToolCallRuntimeStarted"
    TOOL_CALL_STARTED = "ToolCallStarted"



class TraceEventPayloadError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def trace_event_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(TRACE_EVENT_ELEMENTS)


def expected_trace_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise TraceEventPayloadError(
            f"未登记的协议面 variant: {name!r} —— 先在 app/core/trace_event_payload.py 的 TRACE_EVENT_ELEMENTS 登记"
        )
    return TRACE_EVENT_ELEMENTS[name]


def ensure_trace_event_payload(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`TraceEventPayloadError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise TraceEventPayloadError(
            f"未登记的协议面 variant: {value!r} —— 先在 app/core/trace_event_payload.py 的 TraceEventPayload 登记后再产出"
        )
    return value


def trace_event_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_trace_event_payload(value)
    return TRACE_EVENT_DOMAIN[value]


def trace_event_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(TRACE_EVENT_DOMAIN.values()):
        raise TraceEventPayloadError(
            f"未登记的协议面域: {domain!r} —— 合法域: {sorted(set(TRACE_EVENT_DOMAIN.values()))!r}"
        )
    return tuple(nm for nm, dom in TRACE_EVENT_DOMAIN.items() if dom == domain)


def is_trace_event(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_trace_event(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_trace_event_payload(name)
    expected = expected_trace_element_count(name)
    if element_count != expected:
        raise TraceEventPayloadError(
            f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}"
        )
    return name
