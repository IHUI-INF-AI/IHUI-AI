# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Codex 错误码信息变体封闭集（CodexErrorInfo，5 struct variant）—— 统一工程规范 R58。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + 元素数机器反推）：
::

    struct variant CodexErrorInfo::ActiveTurnNotSteerable with 1 element
    struct variant CodexErrorInfo::HttpConnectionFailed with 1 element
    struct variant CodexErrorInfo::ResponseStreamConnectionFailed with 1 element
    struct variant CodexErrorInfo::ResponseStreamDisconnected with 1 element
    struct variant CodexErrorInfo::ResponseTooManyFailedAttempts with 1 element

五档逐字确证（``struct variant ... with N element`` 声明反推，全集 5 档元素数均 1）。
与 ``active_turn_not_steerable`` 错误串呼应（R51/R52 turn 可操纵性轴）——本模块固化其
**错误码 info 变体身份**，不复述 steer 判据。

本仓边界：全仓 app 层 grep ``ActiveTurnNotSteerable/ResponseStreamConnectionFailed/
ResponseTooManyFailedAttempts`` 零命中。本仓 ``turn_error_code.py`` 是 turn 级错误码
（session_budget/stream/content_filter…），与本轴是**不同层**：那是 turn 终态原因，
这是 codex 服务端错误 info payload 变体。本模块不替换、不接在飞发射点。

一轴超越：对照把五档散在 serde 反序列化处，靠 enum 匹配隐式区分，无「连接失败/流断开/
重试耗尽/不可操纵」的显式归类，也无元素数一致性判据。本模块提供 ``error_info_family``
四分类 + ``expected_element_count`` 逐字元素数表 + ``validate_error_info`` 一致性守门，
可 diff 可单测。

诚实边界：五档 variant 名与元素数逐字确证；**serde tag 字段名/大小写 rename 未从二进制
确证**（按 Rust variant 名逐字登记，同 R56/R57 先例）；各档运行时触发条件（谁产出
ResponseTooManyFailedAttempts）未确证；``error_info_family`` 四分类是本仓语义归类非对照
原生判据。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "CodexErrorInfo",
    "CodexErrorInfoError",
    "CODEX_ERROR_INFO_ELEMENTS",
    "ERROR_INFO_FAMILY",
    "error_info_names",
    "expected_element_count",
    "ensure_codex_error_info",
    "error_info_family",
    "validate_error_info",
]

#: 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
CODEX_ERROR_INFO_ELEMENTS: Final[dict[str, int]] = {
    "ActiveTurnNotSteerable": 1,
    "HttpConnectionFailed": 1,
    "ResponseStreamConnectionFailed": 1,
    "ResponseStreamDisconnected": 1,
    "ResponseTooManyFailedAttempts": 1,
}

#: 本仓语义归类：不可操纵 / HTTP 连接 / 流连接 / 流中断 / 重试耗尽。
ERROR_INFO_FAMILY: Final[dict[str, str]] = {
    "ActiveTurnNotSteerable": "not_steerable",
    "HttpConnectionFailed": "http_connection",
    "ResponseStreamConnectionFailed": "stream_connection",
    "ResponseStreamDisconnected": "stream_disconnect",
    "ResponseTooManyFailedAttempts": "retry_exhausted",
}

_CLOSED_SET: Final[frozenset[str]] = frozenset(CODEX_ERROR_INFO_ELEMENTS)


class CodexErrorInfo(StrEnum):
    """对照 CodexErrorInfo 五档 variant（逐字登记，真相源）。"""

    ACTIVE_TURN_NOT_STEERABLE = "ActiveTurnNotSteerable"
    HTTP_CONNECTION_FAILED = "HttpConnectionFailed"
    RESPONSE_STREAM_CONNECTION_FAILED = "ResponseStreamConnectionFailed"
    RESPONSE_STREAM_DISCONNECTED = "ResponseStreamDisconnected"
    RESPONSE_TOO_MANY_FAILED_ATTEMPTS = "ResponseTooManyFailedAttempts"


class CodexErrorInfoError(ValueError):
    """未登记的 codex 错误码 info variant（封闭集/元素数判据点名）。"""


def error_info_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(CODEX_ERROR_INFO_ELEMENTS)


def expected_element_count(name: str) -> int:
    """该错误码 info struct variant 的逐字元素数（未登记抛错）。"""
    if name not in _CLOSED_SET:
        raise CodexErrorInfoError(
            f"未登记的 codex 错误码 info variant: {name!r} —— "
            "先在 app/core/codex_error_info.py 的 CODEX_ERROR_INFO_ELEMENTS 登记"
        )
    return CODEX_ERROR_INFO_ELEMENTS[name]


def ensure_codex_error_info(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`CodexErrorInfoError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise CodexErrorInfoError(
            f"未登记的 codex 错误码 info: {value!r} —— "
            "先在 app/core/codex_error_info.py 的 CodexErrorInfo 登记后再产出"
        )
    return value


def error_info_family(value: str) -> str:
    """归类：不可操纵 / HTTP 连接 / 流连接 / 流中断 / 重试耗尽（登记外抛错）。"""
    ensure_codex_error_info(value)
    return ERROR_INFO_FAMILY[value]


def validate_error_info(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_codex_error_info(name)
    expected = expected_element_count(name)
    if element_count != expected:
        raise CodexErrorInfoError(
            f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}"
        )
    return name
