# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""线程时间线条目封闭集（ThreadTimelineEntry，4 struct variant） —— 统一工程规范 R60（协议面封闭集·中等清单族扫尾）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R60-*.md``）：逐字 variant 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：4 个时间线条目逐字表（元素数 2/3/7）+ 三类条目域（item/realtime/turn）+ 可执行反查。``TurnCompleted`` 元素数 7 是族内最多，差异化元素数让守门有强区分力。

诚实边界：4 variant 名与元素数逐字确证；条目域三分类是本仓语义归类非对照原生判据；各条目字段时序未从 disasm 确证。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ThreadTimelineEntry", "ThreadTimelineEntryError", "THREAD_TIMELINE_ELEMENTS", "THREAD_TIMELINE_DOMAIN", "thread_timeline_names", "expected_timeline_element_count",
    "ensure_thread_timeline_entry", "thread_timeline_domain", "thread_timeline_domain_members", "is_thread_timeline", "validate_thread_timeline",
]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
THREAD_TIMELINE_ELEMENTS: Final[dict[str, int]] = {
    "Item": 3,
    "Realtime": 2,
    "TurnCompleted": 7,
    "TurnStarted": 3,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
THREAD_TIMELINE_DOMAIN: Final[dict[str, str]] = {
    "Item": "item",
    "Realtime": "realtime",
    "TurnCompleted": "turn",
    "TurnStarted": "turn",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(THREAD_TIMELINE_ELEMENTS)


class ThreadTimelineEntry(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    ITEM = "Item"
    REALTIME = "Realtime"
    TURN_COMPLETED = "TurnCompleted"
    TURN_STARTED = "TurnStarted"



class ThreadTimelineEntryError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def thread_timeline_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(THREAD_TIMELINE_ELEMENTS)


def expected_timeline_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise ThreadTimelineEntryError(f"未登记的 variant: {name!r} —— 先在 app/core/thread_timeline_entry.py 的 THREAD_TIMELINE_ELEMENTS 登记")
    return THREAD_TIMELINE_ELEMENTS[name]


def ensure_thread_timeline_entry(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ThreadTimelineEntryError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ThreadTimelineEntryError(f"未登记的 variant: {value!r} —— 先在 app/core/thread_timeline_entry.py 的 ThreadTimelineEntry 登记后再产出")
    return value


def thread_timeline_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_thread_timeline_entry(value)
    return THREAD_TIMELINE_DOMAIN[value]


def thread_timeline_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(THREAD_TIMELINE_DOMAIN.values()):
        raise ThreadTimelineEntryError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(THREAD_TIMELINE_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in THREAD_TIMELINE_DOMAIN.items() if dom == domain)


def is_thread_timeline(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_thread_timeline(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_thread_timeline_entry(name)
    expected = expected_timeline_element_count(name)
    if element_count != expected:
        raise ThreadTimelineEntryError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
