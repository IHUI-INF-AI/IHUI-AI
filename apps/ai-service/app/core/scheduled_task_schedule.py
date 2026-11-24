# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""定时调度计划封闭集（ScheduledTaskSchedule，4 struct variant）—— 统一工程规范 R58。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + 元素数机器反推）：
::

    struct variant ScheduledTaskSchedule::Daily with 1 element
    struct variant ScheduledTaskSchedule::Hourly with 2 element
    struct variant ScheduledTaskSchedule::Weekly with 2 element
    struct variant ScheduledTaskSchedule::Weekdays with 1 element

四档逐字确证（元素数 1/2/2/1；长连体串 433 字节双证四档声明）。贴合本项目定时调度
领域，但注意：本模块固化的是**对照 codex 的调度频率封闭集**，与本仓平台用户侧
``user_automations`` / Windows IHUI-* 保活任务是不同域，不替换任何调度实现。

本仓边界：全仓 app 层 grep ``ScheduledTaskSchedule/Weekdays`` 零命中。

一轴超越：对照把四档散在调度 crate 的 serde 反序列化处，靠 enum 匹配隐式区分频率，
无「日/小时/周/工作日」显式归类，也无元素数一致性判据。本模块提供 ``schedule_frequency``
四分类 + ``expected_element_count`` 逐字元素数表 + ``validate_schedule`` 一致性守门。

诚实边界：四档 variant 名与元素数逐字确证；serde tag/rename 未确证（按 Rust variant 名
逐字登记）；各档携带字段语义（Hourly/Weekly 的第 2 元素是什么）未确证；``schedule_frequency``
四分类是本仓语义归类非对照原生判据；未接任何调度发射点。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ScheduledTaskSchedule",
    "ScheduledTaskScheduleError",
    "SCHEDULE_ELEMENTS",
    "SCHEDULE_FREQUENCY",
    "schedule_names",
    "expected_element_count",
    "ensure_scheduled_task_schedule",
    "schedule_frequency",
    "validate_schedule",
]

#: 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
SCHEDULE_ELEMENTS: Final[dict[str, int]] = {
    "Daily": 1,
    "Hourly": 2,
    "Weekly": 2,
    "Weekdays": 1,
}

#: 本仓语义归类：每日 / 每小时 / 每周 / 工作日。
SCHEDULE_FREQUENCY: Final[dict[str, str]] = {
    "Daily": "daily",
    "Hourly": "hourly",
    "Weekly": "weekly",
    "Weekdays": "weekdays",
}

_CLOSED_SET: Final[frozenset[str]] = frozenset(SCHEDULE_ELEMENTS)


class ScheduledTaskSchedule(StrEnum):
    """对照 ScheduledTaskSchedule 四档 variant（逐字登记，真相源）。"""

    DAILY = "Daily"
    HOURLY = "Hourly"
    WEEKLY = "Weekly"
    WEEKDAYS = "Weekdays"


class ScheduledTaskScheduleError(ValueError):
    """未登记的调度频率 variant（封闭集/元素数判据点名）。"""


def schedule_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(SCHEDULE_ELEMENTS)


def expected_element_count(name: str) -> int:
    """该调度频率 struct variant 的逐字元素数（未登记抛错）。"""
    if name not in _CLOSED_SET:
        raise ScheduledTaskScheduleError(
            f"未登记的调度频率 variant: {name!r} —— "
            "先在 app/core/scheduled_task_schedule.py 的 SCHEDULE_ELEMENTS 登记"
        )
    return SCHEDULE_ELEMENTS[name]


def ensure_scheduled_task_schedule(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ScheduledTaskScheduleError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ScheduledTaskScheduleError(
            f"未登记的调度频率: {value!r} —— "
            "先在 app/core/scheduled_task_schedule.py 的 ScheduledTaskSchedule 登记后再产出"
        )
    return value


def schedule_frequency(value: str) -> str:
    """归类：daily / hourly / weekly / weekdays（登记外抛错）。"""
    ensure_scheduled_task_schedule(value)
    return SCHEDULE_FREQUENCY[value]


def validate_schedule(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_scheduled_task_schedule(name)
    expected = expected_element_count(name)
    if element_count != expected:
        raise ScheduledTaskScheduleError(
            f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}"
        )
    return name
