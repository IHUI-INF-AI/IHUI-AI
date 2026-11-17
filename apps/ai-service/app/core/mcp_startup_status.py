# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP 服务器启动状态封闭集（McpStartupStatus，五档）—— 统一工程规范 R56。

取证（codex.exe 26.1111.2228.0，strings 逐字）：
::

    stateinternally tagged enum McpStartupStatusMcpStartupStatusStartingReady
    Cancelledcompleteddeclined
    reasonstruct variant McpStartupStatus::Failed with 2 elements

五档逐字确证（internally tagged enum）：``Starting`` / ``Ready`` / ``Cancelled`` /
``completed`` / ``declined``。另有 ``McpStartupStatus::Failed`` struct variant（带
2 元素，``reason`` 字段）——这是**第六档失败态**，但 wire 的 tagged 值未在上述连体
锚中逐字给出，本模块作为 ``FAILED`` 登记并标注「变体确证、wire tag 推定」。

配套：``McpServerStatus with 12 elements`` / ``McpAuthStatusMcpServerStatus`` /
``McpServerStatusUpdatedNotification failure_reason``（服务器运行态/认证态，另一轴）。

本仓边界：全仓 grep ``McpStartup`` / ``startup_status`` 零命中；``startup_prewarm.py``
的 ``ready/timed_out/cancelled/unavailable`` 是**启动预热预算**轴（CLI 冷启动），
与 MCP 服务器启动握手状态不同轴。本模块补齐 MCP 启动状态封闭集，不替换预热模块。

一轴超越：对照把状态散在 internally tagged enum 反序列化处，无「终态判定 / 成功
判定 / 失败归类」的显式判据。本模块提供 ``is_terminal`` / ``is_ready`` / ``is_failure``
三纯函数 + ``ensure_mcp_startup_status`` 守门 + ``mcp_startup_status_values`` 可机检。

诚实边界：五档 tagged 值 + Failed 变体逐字确证；``Failed`` 的 wire tag 字符串、
``reason`` 两元素的字段语义未从二进制确证（推定）；状态间的合法迁移序列未确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "McpStartupStatus",
    "McpStartupStatusError",
    "MCP_STARTUP_STATUS_VALUES",
    "TERMINAL_STARTUP_STATUSES",
    "FAILURE_STARTUP_STATUSES",
    "ensure_mcp_startup_status",
    "mcp_startup_status_values",
    "is_terminal",
    "is_ready",
    "is_failure",
]

#: 逐字 wire/tag 值表（五个 internally tagged + Failed 变体；漂移由 pytest 钉死）。
MCP_STARTUP_STATUS_VALUES: Final[tuple[str, ...]] = (
    "Starting",
    "Ready",
    "Cancelled",
    "completed",
    "declined",
    "Failed",
)

#: 终态（不再推进）：Cancelled / completed / declined / Failed。
TERMINAL_STARTUP_STATUSES: Final[frozenset[str]] = frozenset(
    {"Cancelled", "completed", "declined", "Failed"}
)

#: 失败/拒绝归类（Cancelled / declined / Failed）。
FAILURE_STARTUP_STATUSES: Final[frozenset[str]] = frozenset(
    {"Cancelled", "declined", "Failed"}
)

_CLOSED_SET: Final[frozenset[str]] = frozenset(MCP_STARTUP_STATUS_VALUES)


class McpStartupStatus(StrEnum):
    """对照 McpStartupStatus 六态（五 tagged 逐字 + Failed 变体），真相源登记。"""

    STARTING = "Starting"
    READY = "Ready"
    CANCELLED = "Cancelled"
    COMPLETED = "completed"
    DECLINED = "declined"
    #: struct variant（带 2 元素 ``reason``）；wire tag 字符串未确证，用变体名登记。
    FAILED = "Failed"


class McpStartupStatusError(ValueError):
    """未登记的 MCP 启动状态（封闭集判据点名）。"""


def ensure_mcp_startup_status(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`McpStartupStatusError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise McpStartupStatusError(
            f"未登记的 MCP 启动状态: {value!r} —— "
            "先在 app/core/mcp_startup_status.py 的 McpStartupStatus 登记后再产出"
        )
    return value


def mcp_startup_status_values() -> tuple[str, ...]:
    """返回逐字封闭集值表（副本，供守门/UI 枚举，防外部改动）。"""
    return tuple(MCP_STARTUP_STATUS_VALUES)


def is_terminal(value: str) -> bool:
    """是否终态（登记外抛错）。"""
    return ensure_mcp_startup_status(value) in TERMINAL_STARTUP_STATUSES


def is_ready(value: str) -> bool:
    """是否就绪（仅 ``Ready``）。"""
    return ensure_mcp_startup_status(value) == McpStartupStatus.READY.value


def is_failure(value: str) -> bool:
    """是否失败/拒绝归类。"""
    return ensure_mcp_startup_status(value) in FAILURE_STARTUP_STATUSES
