# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""线程状态封闭集（ThreadStatus，四档 wire）—— 统一工程规范 R56。

取证（codex.exe 26.1111.2228.0，strings 逐字）：
::

    ThreadStatusactiveFlagsinternally tagged enum ThreadStatusNotLoadedIdleSystemError
    ...ThreadStatusnotLoadedidlesystemErroractiveactiveFlagsrestrictedenabled
    activeFlagsstruct variant ThreadStatus::Active with 1 element

四档 wire 值逐字确证（internally tagged enum）：``notLoaded`` / ``idle`` /
``systemError`` / ``active``。``active`` 是 struct variant（带 1 元素 ``activeFlags``），
配套 active flag 值 ``restricted`` / ``enabled`` 逐字命中。

配套：``ThreadStatusChanged`` / ``ThreadStatusChangedNotification with 2 elements`` /
``ThreadReadState firstUnread`` / ``ThreadActiveFlag``（变更通知/已读态/活跃标志，另轴）。

本仓边界：全仓无 ``ThreadStatus`` 封闭集；``turn_metadata.py`` / ``thread_originator.py``
/ ``thread_parent_index.py`` 是 turn 元数据/来源/父子索引轴，``agent_operation_status.py``
是 agent 操作状态（七档 wire）轴。本模块补齐 **线程（会话对象）状态** 轴，互补不替换。

一轴超越：对照把四档散在 internally tagged enum + struct variant，``active`` 携带的
``activeFlags`` 与三档无载荷状态混在同一 enum，无「是否活跃 / 是否错误终态 / 活跃
标志校验」的显式判据。本模块提供 ``is_active/is_error/is_idle`` + ``ensure_active_flags``
（restricted/enabled 白名单）+ ``validate_thread_status``（状态 + flags 一致性：只有
active 可带 flags，其余档带 flags 抛错），可 diff 可单测。

诚实边界：四档 wire 值 + active 1 元素 + restricted/enabled 逐字确证；activeFlags 是否
恰为二值封闭集、serde tag 字段名、状态迁移序列未从二进制确证；本仓语义归类
（is_error = systemError）非对照原生判据。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ThreadStatus",
    "ThreadStatusError",
    "THREAD_STATUS_VALUES",
    "ACTIVE_FLAGS",
    "ensure_thread_status",
    "ensure_active_flags",
    "is_active",
    "is_error",
    "is_idle",
    "validate_thread_status",
]

#: 逐字 wire 值表（internally tagged enum，漂移由 pytest 钉死）。
THREAD_STATUS_VALUES: Final[tuple[str, ...]] = (
    "notLoaded",
    "idle",
    "systemError",
    "active",
)

#: activeFlags 逐字白名单（对照连体锚 restricted/enabled）。
ACTIVE_FLAGS: Final[frozenset[str]] = frozenset({"restricted", "enabled"})

_CLOSED_SET: Final[frozenset[str]] = frozenset(THREAD_STATUS_VALUES)


class ThreadStatus(StrEnum):
    """对照 ThreadStatus 四档 wire 值（逐字确证），真相源登记。"""

    NOT_LOADED = "notLoaded"
    IDLE = "idle"
    SYSTEM_ERROR = "systemError"
    ACTIVE = "active"


class ThreadStatusError(ValueError):
    """未登记的线程状态或非法 activeFlags（封闭集判据点名）。"""


def ensure_thread_status(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ThreadStatusError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ThreadStatusError(
            f"未登记的线程状态: {value!r} —— "
            "先在 app/core/thread_status.py 的 ThreadStatus 登记后再产出"
        )
    return value


def ensure_active_flags(flags: tuple[str, ...] | frozenset[str]) -> frozenset[str]:
    """activeFlags 白名单校验：未知 flag 抛错（fail-closed）。"""
    result = frozenset(flags)
    unknown = result - ACTIVE_FLAGS
    if unknown:
        raise ThreadStatusError(f"未登记的 activeFlags: {sorted(unknown)!r}")
    return result


def is_active(value: str) -> bool:
    """是否活跃态。"""
    return ensure_thread_status(value) == ThreadStatus.ACTIVE.value


def is_error(value: str) -> bool:
    """本仓语义归类：是否系统错误态。"""
    return ensure_thread_status(value) == ThreadStatus.SYSTEM_ERROR.value


def is_idle(value: str) -> bool:
    """是否空闲态。"""
    return ensure_thread_status(value) == ThreadStatus.IDLE.value


def validate_thread_status(
    value: str, *, active_flags: tuple[str, ...] | frozenset[str] = ()
) -> str:
    """状态 + 活跃标志一致性校验：只有 ``active`` 可带 flags，其余档带 flags 抛错。

    对照把 activeFlags 作为 Active struct variant 的载荷、其余三档无载荷，但无显式
    「非 active 不得带 flags」判据；本模块把它显式化，可 diff 可单测。
    """
    kind = ensure_thread_status(value)
    flags = ensure_active_flags(active_flags)
    if flags and kind != ThreadStatus.ACTIVE.value:
        raise ThreadStatusError(
            f"载荷不一致: activeFlags 只属于 active 档，收到 {kind!r}"
        )
    return kind
