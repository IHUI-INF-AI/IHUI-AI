# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""IPC host→client 消息封闭集（HostToClient，6 struct variant）—— 统一工程规范 R57。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字）：
::

    struct variant HostToClient::HandshakeRejected with 1 element
    struct variant HostToClient::InitialResponse with 2 element
    struct variant HostToClient::Response with 2 element
    struct variant HostToClient::CellClosed with 2 element
    struct variant HostToClient::CancelDelegateRequest with 1 element
    struct variant HostToClient::DelegateRequest with 3 element

六档逐字确证（`struct variant ... with N element` 声明 + 852 字节长连体串
``struct variant HostToClient::HandshakeRejected ... InitialResponse ... Response ...
CellClosed ... CancelDelegateRequest ... DelegateRequest`` 双证）。
配套 ``DelegateRequest::Notify/InvokeTool``（子变体，另一轴）。

本仓边界：全仓 app 层 grep ``HostToClient/CellClosed/DelegateRequest`` 零命中。本仓
``a2a_task_state.py`` 是 A2A 任务状态轴、``collab_lifecycle_event.py`` 是协同会话轴——
都不固化 host→client 这一层 IPC 消息帧的六档封闭集。互补不替换。

一轴超越：对照把六档散在 serde 反序列化处，无「握手拒绝/响应/单元格关闭/委派」显式归类，
也无元素数一致性判据。本模块提供 ``message_family`` 四分类（handshake/response/cell/delegate）、
``expected_element_count`` 逐字表 + ``validate_host_to_client`` 一致性守门，可 diff 可单测。

诚实边界：六档 variant 名与元素数逐字确证；serde tag rename / 各档运行时触发条件未确证；
``message_family`` 四分类是本仓语义归类非对照原生判据。``InitialResponse``/``Response``
同为 response 族但元素数均为 2，靠 variant 名区分（不是靠元素数）。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "HostToClient",
    "HostToClientError",
    "HOST_TO_CLIENT_ELEMENTS",
    "MESSAGE_FAMILY",
    "host_to_client_names",
    "expected_element_count",
    "ensure_host_to_client",
    "message_family",
    "is_delegate_message",
    "validate_host_to_client",
]

#: 逐字 variant 名 → struct 元素数。
HOST_TO_CLIENT_ELEMENTS: Final[dict[str, int]] = {
    "HandshakeRejected": 1,
    "InitialResponse": 2,
    "Response": 2,
    "CellClosed": 2,
    "CancelDelegateRequest": 1,
    "DelegateRequest": 3,
}

#: 本仓语义归类：IPC 消息族。
MESSAGE_FAMILY: Final[dict[str, str]] = {
    "HandshakeRejected": "handshake",
    "InitialResponse": "response",
    "Response": "response",
    "CellClosed": "cell",
    "CancelDelegateRequest": "delegate",
    "DelegateRequest": "delegate",
}

_CLOSED_SET: Final[frozenset[str]] = frozenset(HOST_TO_CLIENT_ELEMENTS)


class HostToClient(StrEnum):
    """对照 HostToClient 六档 variant（逐字登记，真相源）。"""

    HANDSHAKE_REJECTED = "HandshakeRejected"
    INITIAL_RESPONSE = "InitialResponse"
    RESPONSE = "Response"
    CELL_CLOSED = "CellClosed"
    CANCEL_DELEGATE_REQUEST = "CancelDelegateRequest"
    DELEGATE_REQUEST = "DelegateRequest"


class HostToClientError(ValueError):
    """未登记的 host→client 消息 variant（封闭集/元素数判据点名）。"""


def host_to_client_names() -> list[str]:
    """返回逐字 variant 名列表副本。"""
    return list(HOST_TO_CLIENT_ELEMENTS)


def expected_element_count(name: str) -> int:
    """该消息 struct variant 的逐字元素数（未登记抛错）。"""
    if name not in _CLOSED_SET:
        raise HostToClientError(
            f"未登记的 host→client 消息 variant: {name!r} —— "
            "先在 app/core/host_to_client.py 的 HOST_TO_CLIENT_ELEMENTS 登记"
        )
    return HOST_TO_CLIENT_ELEMENTS[name]


def ensure_host_to_client(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`HostToClientError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise HostToClientError(
            f"未登记的 host→client 消息: {value!r} —— "
            "先在 app/core/host_to_client.py 的 HostToClient 登记后再产出"
        )
    return value


def message_family(value: str) -> str:
    """归类：handshake / response / cell / delegate（登记外抛错）。"""
    ensure_host_to_client(value)
    return MESSAGE_FAMILY[value]


def is_delegate_message(value: str) -> bool:
    """是否委派族消息。"""
    return message_family(value) == "delegate"


def validate_host_to_client(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表。"""
    ensure_host_to_client(name)
    expected = expected_element_count(name)
    if element_count != expected:
        raise HostToClientError(
            f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}"
        )
    return name
