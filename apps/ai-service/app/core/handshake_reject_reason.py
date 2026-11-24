# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""IPC 握手拒绝原因封闭集（HandshakeRejectReason，3 struct variant）—— 统一工程规范 R57。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字）：
::

    struct variant HandshakeRejectReason::InvalidHello with 1 element
    struct variant HandshakeRejectReason::NoCompatibleVersion with 1 element
    struct variant HandshakeRejectReason::MissingRequiredCapability with 1 element
    internally tagged enum HandshakeRejectReason

三档逐字确证（`struct variant ... with N element` 声明 + 长连体串 852 字节双证）：
``InvalidHello``(1) / ``NoCompatibleVersion``(1) / ``MissingRequiredCapability``(1)。
配套同一取证块还有 ``HostToClient::HandshakeRejected``（拒绝帧，另一轴）、
``HostResponse`` 四档（响应帧，另一轴）。

本仓边界：全仓 app 层 grep ``HandshakeRejectReason/NoCompatibleVersion/MissingRequiredCapability``
零命中——本仓 IPC 握手路径仅判布尔/超时，无「拒绝原因三档封闭集」。本模块只固化
**拒绝原因 variant 名 + 元素数 + 归类判据**，不替换任何既有模块、不接在飞发射点。

一轴超越：对照把三档散在 serde 反序列化处、靠 enum 匹配隐式区分，无「这是格式错/能力缺/
版本错」的显式归类，也无元素数一致性判据。本模块提供 ``reject_reason_family`` 三分类、
``expected_element_count`` 逐字元素数表 + ``validate_reject_reason`` 一致性守门（未知名/元素数
漂移均抛错点名），可 diff 可单测。

诚实边界：三档 variant 名与元素数逐字确证；**serde tag 字段名/大小写 rename 未从二进制确证**
（此处按 Rust variant 名逐字登记，同 R56 mcp_startup_status 先例）；三档的运行时触发条件
（谁产出 InvalidHello）未确证；``reject_reason_family`` 三分类是本仓语义归类非对照原生判据。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "HandshakeRejectReason",
    "HandshakeRejectReasonError",
    "HANDSHAKE_REJECT_ELEMENTS",
    "REJECT_FAMILY",
    "reject_reason_names",
    "expected_element_count",
    "ensure_handshake_reject_reason",
    "reject_reason_family",
    "validate_reject_reason",
]

#: 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
HANDSHAKE_REJECT_ELEMENTS: Final[dict[str, int]] = {
    "InvalidHello": 1,
    "NoCompatibleVersion": 1,
    "MissingRequiredCapability": 1,
}

#: 本仓语义归类：格式错 / 版本不兼容 / 必需能力缺失。
REJECT_FAMILY: Final[dict[str, str]] = {
    "InvalidHello": "hello_malformed",
    "NoCompatibleVersion": "version",
    "MissingRequiredCapability": "capability",
}

_CLOSED_SET: Final[frozenset[str]] = frozenset(HANDSHAKE_REJECT_ELEMENTS)


class HandshakeRejectReason(StrEnum):
    """对照 HandshakeRejectReason 三档 variant（逐字登记，真相源）。"""

    INVALID_HELLO = "InvalidHello"
    NO_COMPATIBLE_VERSION = "NoCompatibleVersion"
    MISSING_REQUIRED_CAPABILITY = "MissingRequiredCapability"


class HandshakeRejectReasonError(ValueError):
    """未登记的握手拒绝原因 variant（封闭集/元素数判据点名）。"""


def reject_reason_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(HANDSHAKE_REJECT_ELEMENTS)


def expected_element_count(name: str) -> int:
    """该拒绝原因 struct variant 的逐字元素数（未登记抛错）。"""
    if name not in _CLOSED_SET:
        raise HandshakeRejectReasonError(
            f"未登记的握手拒绝原因 variant: {name!r} —— "
            "先在 app/core/handshake_reject_reason.py 的 HANDSHAKE_REJECT_ELEMENTS 登记"
        )
    return HANDSHAKE_REJECT_ELEMENTS[name]


def ensure_handshake_reject_reason(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`HandshakeRejectReasonError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise HandshakeRejectReasonError(
            f"未登记的握手拒绝原因: {value!r} —— "
            "先在 app/core/handshake_reject_reason.py 的 HandshakeRejectReason 登记后再产出"
        )
    return value


def reject_reason_family(value: str) -> str:
    """归类：hello_malformed / version / capability（登记外抛错，不静默）。"""
    ensure_handshake_reject_reason(value)
    return REJECT_FAMILY[value]


def validate_reject_reason(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_handshake_reject_reason(name)
    expected = expected_element_count(name)
    if element_count != expected:
        raise HandshakeRejectReasonError(
            f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}"
        )
    return name
