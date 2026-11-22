# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""响应条目线格式清单封闭集（ResponseItem，14 struct variant） —— 统一工程规范 R59（协议面封闭集轴型）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element`` 机器反推，
见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R59-*.md``）：逐字 variant 名与元素数表由
机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族名在本仓 app/core 零命中（或仅为异层别名，
见下），是干净的协议面空白——与 R56-R58 的语义 enum 不同，本轴登记的是**RPC 方法/事件载荷名清单**。

一轴超越：14 个 response item 线格式载荷逐字表（元素数 1~9 差异化）+ 五类响应域（message/function/tool/config/compaction）归类 + 可执行反查。刻意命名 ``response_item_wire`` 避开本仓 ResponseItem=dict 消息别名。

诚实边界：14 载荷名与元素数逐字确证；响应域五分类是本仓语义归类非对照原生判据；本模块是协议载荷名清单，不替换本仓 ResponseItem dict 别名。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ResponseItemWire",
    "ResponseItemWireError",
    "RESPONSE_ITEM_ELEMENTS",
    "RESPONSE_ITEM_DOMAIN",
    "response_item_names",
    "expected_response_item_element_count",
    "ensure_response_item_wire",
    "response_item_domain",
    "response_item_domain_members",
    "is_response_item_wire",
    "validate_response_item",

]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
RESPONSE_ITEM_ELEMENTS: Final[dict[str, int]] = {
    "AdditionalTools": 3,
    "AgentMessage": 5,
    "Compaction": 3,
    "ConfigurationUpdate": 1,
    "CustomToolCall": 8,
    "CustomToolCallOutput": 5,
    "FunctionCall": 9,
    "FunctionCallOutput": 6,
    "ImageGenerationCall": 6,
    "LocalShellCall": 6,
    "Message": 7,
    "Reasoning": 5,
    "ToolSearchCall": 7,
    "ToolSearchOutput": 6,

}

# 本仓语义归类（非对照原生判据）：每个方法/载荷归入一个协议面域。
RESPONSE_ITEM_DOMAIN: Final[dict[str, str]] = {
    "AdditionalTools": "config",
    "AgentMessage": "message",
    "Compaction": "compaction",
    "ConfigurationUpdate": "config",
    "CustomToolCall": "function",
    "CustomToolCallOutput": "function",
    "FunctionCall": "function",
    "FunctionCallOutput": "function",
    "ImageGenerationCall": "tool",
    "LocalShellCall": "tool",
    "Message": "message",
    "Reasoning": "message",
    "ToolSearchCall": "tool",
    "ToolSearchOutput": "tool",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(RESPONSE_ITEM_ELEMENTS)


class ResponseItemWire(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    ADDITIONAL_TOOLS = "AdditionalTools"
    AGENT_MESSAGE = "AgentMessage"
    COMPACTION = "Compaction"
    CONFIGURATION_UPDATE = "ConfigurationUpdate"
    CUSTOM_TOOL_CALL = "CustomToolCall"
    CUSTOM_TOOL_CALL_OUTPUT = "CustomToolCallOutput"
    FUNCTION_CALL = "FunctionCall"
    FUNCTION_CALL_OUTPUT = "FunctionCallOutput"
    IMAGE_GENERATION_CALL = "ImageGenerationCall"
    LOCAL_SHELL_CALL = "LocalShellCall"
    MESSAGE = "Message"
    REASONING = "Reasoning"
    TOOL_SEARCH_CALL = "ToolSearchCall"
    TOOL_SEARCH_OUTPUT = "ToolSearchOutput"



class ResponseItemWireError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def response_item_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(RESPONSE_ITEM_ELEMENTS)


def expected_response_item_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise ResponseItemWireError(
            f"未登记的协议面 variant: {name!r} —— 先在 app/core/response_item_wire.py 的 RESPONSE_ITEM_ELEMENTS 登记"
        )
    return RESPONSE_ITEM_ELEMENTS[name]


def ensure_response_item_wire(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ResponseItemWireError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ResponseItemWireError(
            f"未登记的协议面 variant: {value!r} —— 先在 app/core/response_item_wire.py 的 ResponseItemWire 登记后再产出"
        )
    return value


def response_item_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_response_item_wire(value)
    return RESPONSE_ITEM_DOMAIN[value]


def response_item_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(RESPONSE_ITEM_DOMAIN.values()):
        raise ResponseItemWireError(
            f"未登记的协议面域: {domain!r} —— 合法域: {sorted(set(RESPONSE_ITEM_DOMAIN.values()))!r}"
        )
    return tuple(nm for nm, dom in RESPONSE_ITEM_DOMAIN.items() if dom == domain)


def is_response_item_wire(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_response_item(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_response_item_wire(name)
    expected = expected_response_item_element_count(name)
    if element_count != expected:
        raise ResponseItemWireError(
            f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}"
        )
    return name
