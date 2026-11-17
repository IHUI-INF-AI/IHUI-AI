# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具调用摘要清单封闭集（ToolCallSummary，4 struct variant） —— 统一工程规范 R60（协议面封闭集·中等清单族扫尾）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R60-*.md``）：逐字 variant 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：4 个工具调用摘要逐字表（元素数 1/2/3）+ 三类摘要域（agent/generic/terminal）+ 可执行反查。本仓 tool_call_trace.py 是调用轨迹记录，本轴是摘要归类，语义不同层。

诚实边界：4 variant 名与元素数逐字确证；摘要域三分类是本仓语义归类非对照原生判据；``Terminal``/``Generic`` 的摘要生成逻辑未确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ToolCallSummary", "ToolCallSummaryError", "TOOL_CALL_SUMMARY_ELEMENTS", "TOOL_CALL_SUMMARY_DOMAIN", "tool_call_summary_names", "expected_summary_element_count",
    "ensure_tool_call_summary", "tool_call_summary_domain", "tool_call_summary_domain_members", "is_tool_call_summary", "validate_tool_call_summary",
]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
TOOL_CALL_SUMMARY_ELEMENTS: Final[dict[str, int]] = {
    "Agent": 3,
    "Generic": 3,
    "Terminal": 1,
    "WaitAgent": 2,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
TOOL_CALL_SUMMARY_DOMAIN: Final[dict[str, str]] = {
    "Agent": "agent",
    "Generic": "generic",
    "Terminal": "terminal",
    "WaitAgent": "agent",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(TOOL_CALL_SUMMARY_ELEMENTS)


class ToolCallSummary(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    AGENT = "Agent"
    GENERIC = "Generic"
    TERMINAL = "Terminal"
    WAIT_AGENT = "WaitAgent"



class ToolCallSummaryError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def tool_call_summary_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(TOOL_CALL_SUMMARY_ELEMENTS)


def expected_summary_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise ToolCallSummaryError(f"未登记的 variant: {name!r} —— 先在 app/core/tool_call_summary.py 的 TOOL_CALL_SUMMARY_ELEMENTS 登记")
    return TOOL_CALL_SUMMARY_ELEMENTS[name]


def ensure_tool_call_summary(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ToolCallSummaryError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ToolCallSummaryError(f"未登记的 variant: {value!r} —— 先在 app/core/tool_call_summary.py 的 ToolCallSummary 登记后再产出")
    return value


def tool_call_summary_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_tool_call_summary(value)
    return TOOL_CALL_SUMMARY_DOMAIN[value]


def tool_call_summary_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(TOOL_CALL_SUMMARY_DOMAIN.values()):
        raise ToolCallSummaryError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(TOOL_CALL_SUMMARY_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in TOOL_CALL_SUMMARY_DOMAIN.items() if dom == domain)


def is_tool_call_summary(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_tool_call_summary(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_tool_call_summary(name)
    expected = expected_summary_element_count(name)
    if element_count != expected:
        raise ToolCallSummaryError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
