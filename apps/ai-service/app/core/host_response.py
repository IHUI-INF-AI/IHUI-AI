# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""IPC host 响应封闭集（HostResponse，4 struct variant）—— 统一工程规范 R57。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字）：
::

    struct variant HostResponse::SessionReady with 1 element
    struct variant HostResponse::SessionClosed with 1 element
    struct variant HostResponse::ExecutionStarted with 1 element
    struct variant HostResponse::WaitCompleted with 1 element
    internally tagged enum HostResponse

四档逐字确证（`struct variant ... with N element` 声明 + 852 字节长连体串
``struct variant HostResponse::SessionReady ... WaitCompleted`` 双证）。

本仓边界：全仓 app 层 grep ``HostResponse/SessionReady/SessionClosed`` 零命中。本仓
``host_executable_gate.py`` 管 execpolicy 里的 host_executable 声明校验，**不是** IPC host→client
响应帧封闭集。互补不替换。

一轴超越：对照把四档散在 serde 反序列化处，无「会话生命周期阶段」显式归类与元素数判据。
本模块提供 ``response_phase`` 归类（ready/closed/started/wait）、``is_terminal_response``、
``expected_element_count`` 逐字表 + ``validate_host_response`` 一致性守门，可 diff 可单测。

诚实边界：四档 variant 名与元素数逐字确证；serde tag rename / 各档运行时触发条件未确证；
``response_phase`` 归类与 ``is_terminal_response``（SessionClosed 视为终态）是本仓语义归类
非对照原生判据。同取证块的 ``HostToClient`` 六档是另一轴（本轮另立模块）。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "HostResponse",
    "HostResponseError",
    "HOST_RESPONSE_ELEMENTS",
    "RESPONSE_PHASE",
    "TERMINAL_RESPONSES",
    "host_response_names",
    "expected_element_count",
    "ensure_host_response",
    "response_phase",
    "is_terminal_response",
    "validate_host_response",
]

#: 逐字 variant 名 → struct 元素数。
HOST_RESPONSE_ELEMENTS: Final[dict[str, int]] = {
    "SessionReady": 1,
    "SessionClosed": 1,
    "ExecutionStarted": 1,
    "WaitCompleted": 1,
}

#: 本仓语义归类：会话生命周期阶段。
RESPONSE_PHASE: Final[dict[str, str]] = {
    "SessionReady": "ready",
    "SessionClosed": "closed",
    "ExecutionStarted": "started",
    "WaitCompleted": "wait",
}

#: 终态响应（本仓语义：会话已关闭）。
TERMINAL_RESPONSES: Final[frozenset[str]] = frozenset({"SessionClosed"})

_CLOSED_SET: Final[frozenset[str]] = frozenset(HOST_RESPONSE_ELEMENTS)


class HostResponse(StrEnum):
    """对照 HostResponse 四档 variant（逐字登记，真相源）。"""

    SESSION_READY = "SessionReady"
    SESSION_CLOSED = "SessionClosed"
    EXECUTION_STARTED = "ExecutionStarted"
    WAIT_COMPLETED = "WaitCompleted"


class HostResponseError(ValueError):
    """未登记的 host 响应 variant（封闭集/元素数判据点名）。"""


def host_response_names() -> list[str]:
    """返回逐字 variant 名列表副本。"""
    return list(HOST_RESPONSE_ELEMENTS)


def expected_element_count(name: str) -> int:
    """该响应 struct variant 的逐字元素数（未登记抛错）。"""
    if name not in _CLOSED_SET:
        raise HostResponseError(
            f"未登记的 host 响应 variant: {name!r} —— "
            "先在 app/core/host_response.py 的 HOST_RESPONSE_ELEMENTS 登记"
        )
    return HOST_RESPONSE_ELEMENTS[name]


def ensure_host_response(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`HostResponseError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise HostResponseError(
            f"未登记的 host 响应: {value!r} —— "
            "先在 app/core/host_response.py 的 HostResponse 登记后再产出"
        )
    return value


def response_phase(value: str) -> str:
    """归类：ready / closed / started / wait（登记外抛错）。"""
    ensure_host_response(value)
    return RESPONSE_PHASE[value]


def is_terminal_response(value: str) -> bool:
    """是否终态响应（SessionClosed）。"""
    return ensure_host_response(value) in TERMINAL_RESPONSES


def validate_host_response(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表。"""
    ensure_host_response(name)
    expected = expected_element_count(name)
    if element_count != expected:
        raise HostResponseError(
            f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}"
        )
    return name
