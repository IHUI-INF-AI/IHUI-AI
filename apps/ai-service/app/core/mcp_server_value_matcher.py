# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP 服务器值匹配模式封闭集（McpServerValueMatcher，3 struct variant）—— R58。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + 元素数机器反推）：
::

    struct variant McpServerValueMatcher::Exact with 1 element
    struct variant McpServerValueMatcher::Prefix with 1 element
    struct variant McpServerValueMatcher::Regex with 1 element

三档逐字确证（元素数均 1）。本仓边界：全仓 app 层 ``McpServerValueMatcher`` 零命中。
本仓有 MCP 工具/启动状态模块，但无「MCP 服务器配置值该怎么匹配」的模式封闭集，
本模块不替换。

一轴超越：对照把三档散在 MCP 配置匹配处靠 enum 匹配隐式区分「精确/前缀/正则」，无显式
归类、无元素数一致性判据。本模块提供 ``matcher_mode`` 三分类 + ``expected_element_count``
逐字元素数表 + ``validate_matcher`` 一致性守门；另提供 ``match_value`` 表驱动三模式匹配
纯函数（精确串等/前缀/正则），可 diff 可单测——这是比 R56/R57 多走一步的**可执行判据**。

诚实边界：三档 variant 名与元素数逐字确证；serde tag/rename 未确证（按 Rust variant 名
逐字登记）；``Regex`` 的正则方言、大小写敏感性未从二进制确证（本仓按 Python re 实现，
语义推定）；``matcher_mode`` 三分类是本仓语义归类非对照原生判据；未接 MCP 发射点。
"""

from __future__ import annotations

import re
from enum import StrEnum
from typing import Final

__all__ = [
    "McpServerValueMatcher",
    "McpServerValueMatcherError",
    "MCP_VALUE_MATCHER_ELEMENTS",
    "MATCHER_MODE",
    "matcher_names",
    "expected_element_count",
    "ensure_mcp_server_value_matcher",
    "matcher_mode",
    "match_value",
    "validate_matcher",
]

#: 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
MCP_VALUE_MATCHER_ELEMENTS: Final[dict[str, int]] = {
    "Exact": 1,
    "Prefix": 1,
    "Regex": 1,
}

#: 本仓语义归类：精确 / 前缀 / 正则。
MATCHER_MODE: Final[dict[str, str]] = {
    "Exact": "exact",
    "Prefix": "prefix",
    "Regex": "regex",
}

_CLOSED_SET: Final[frozenset[str]] = frozenset(MCP_VALUE_MATCHER_ELEMENTS)


class McpServerValueMatcher(StrEnum):
    """对照 McpServerValueMatcher 三档 variant（逐字登记，真相源）。"""

    EXACT = "Exact"
    PREFIX = "Prefix"
    REGEX = "Regex"


class McpServerValueMatcherError(ValueError):
    """未登记的值匹配模式 variant（封闭集/元素数判据点名）。"""


def matcher_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(MCP_VALUE_MATCHER_ELEMENTS)


def expected_element_count(name: str) -> int:
    """该匹配模式 struct variant 的逐字元素数（未登记抛错）。"""
    if name not in _CLOSED_SET:
        raise McpServerValueMatcherError(
            f"未登记的值匹配模式 variant: {name!r} —— "
            "先在 app/core/mcp_server_value_matcher.py 的 MCP_VALUE_MATCHER_ELEMENTS 登记"
        )
    return MCP_VALUE_MATCHER_ELEMENTS[name]


def ensure_mcp_server_value_matcher(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`McpServerValueMatcherError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise McpServerValueMatcherError(
            f"未登记的值匹配模式: {value!r} —— "
            "先在 app/core/mcp_server_value_matcher.py 的 McpServerValueMatcher 登记后再产出"
        )
    return value


def matcher_mode(value: str) -> str:
    """归类：exact / prefix / regex（登记外抛错）。"""
    ensure_mcp_server_value_matcher(value)
    return MATCHER_MODE[value]


def match_value(mode: str, value: str, candidate: str) -> bool:
    """表驱动三模式匹配：精确串等 / 前缀 / 正则全匹配（模式登记外抛错）。"""
    ensure_mcp_server_value_matcher(mode)
    if mode == "Exact":
        return value == candidate
    if mode == "Prefix":
        return candidate.startswith(value)
    return re.fullmatch(value, candidate) is not None


def validate_matcher(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_mcp_server_value_matcher(name)
    expected = expected_element_count(name)
    if element_count != expected:
        raise McpServerValueMatcherError(
            f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}"
        )
    return name
