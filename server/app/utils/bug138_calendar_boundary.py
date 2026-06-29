"""Bug-138: 跨年/跨天/跨月边界.
设计:
  - 给出任意时间点, 返回自然天/月/年的边界
  - 闰年正确处理 (2000, 2024, 2100 区分)
  - 月份天数: 大小月 + 闰年 2 月
  - 周开始可配置 (周一/周日)
  - 季度边界
  - ISO 周编号
"""

from __future__ import annotations

import calendar
import threading
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from enum import StrEnum
from typing import Any


class WeekStart(StrEnum):
    MONDAY = "MONDAY"
    SUNDAY = "SUNDAY"


def to_date(v: Any) -> date:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        return datetime.fromisoformat(v.replace("Z", "+00:00")).date()
    raise TypeError(f"不支持: {type(v).__name__}")


def is_leap_year(year: int) -> bool:
    return calendar.isleap(year)


def days_in_month(year: int, month: int) -> int:
    if month < 1 or month > 12:
        raise ValueError("month 必须在 1-12")
    return calendar.monthrange(year, month)[1]


def days_in_year(year: int) -> int:
    return 366 if is_leap_year(year) else 365


@dataclass
class DayBoundary:
    start: datetime
    end: datetime
    date: date
    weekday: int  # 0=Mon

    @property
    def duration(self) -> timedelta:
        return self.end - self.start


@dataclass
class MonthBoundary:
    year: int
    month: int
    start: datetime
    end: datetime
    days: int


@dataclass
class YearBoundary:
    year: int
    start: datetime
    end: datetime
    days: int
    is_leap: bool


def natural_day(v: Any, tz_offset_hours: float = 0.0) -> DayBoundary:
    d = to_date(v)
    start = datetime(d.year, d.month, d.day, tzinfo=UTC) - timedelta(hours=tz_offset_hours)
    end = start + timedelta(days=1)
    return DayBoundary(start=start, end=end, date=d, weekday=d.weekday())


def natural_month(v: Any) -> MonthBoundary:
    d = to_date(v)
    start = datetime(d.year, d.month, 1, tzinfo=UTC)
    nm_year = d.year + (1 if d.month == 12 else 0)
    nm_month = 1 if d.month == 12 else d.month + 1
    end = datetime(nm_year, nm_month, 1, tzinfo=UTC)
    return MonthBoundary(year=d.year, month=d.month, start=start, end=end, days=days_in_month(d.year, d.month))


def natural_year(v: Any) -> YearBoundary:
    d = to_date(v)
    start = datetime(d.year, 1, 1, tzinfo=UTC)
    end = datetime(d.year + 1, 1, 1, tzinfo=UTC)
    return YearBoundary(year=d.year, start=start, end=end, days=days_in_year(d.year), is_leap=is_leap_year(d.year))


def natural_week(v: Any, week_start: WeekStart = WeekStart.MONDAY) -> tuple[datetime, datetime, int]:
    """返回 (start, end, iso_week)."""
    d = to_date(v)
    wd = d.weekday()  # 0=Mon
    start_d = d - timedelta(days=wd) if week_start == WeekStart.MONDAY else d - timedelta(days=(wd + 1) % 7)
    end_d = start_d + timedelta(days=7)
    start = datetime(start_d.year, start_d.month, start_d.day, tzinfo=UTC)
    end = datetime(end_d.year, end_d.month, end_d.day, tzinfo=UTC)
    _iso_year, iso_week, _ = d.isocalendar()
    return start, end, iso_week


def natural_quarter(v: Any) -> tuple[int, int, datetime, datetime]:
    """返回 (year, quarter, start, end)."""
    d = to_date(v)
    q = (d.month - 1) // 3 + 1
    start_month = (q - 1) * 3 + 1
    end_month = start_month + 3
    ey = d.year + (1 if end_month > 12 else 0)
    em = 1 if end_month > 12 else end_month
    start = datetime(d.year, start_month, 1, tzinfo=UTC)
    end = datetime(ey, em, 1, tzinfo=UTC)
    return d.year, q, start, end


def is_cross_year(start: Any, end: Any) -> bool:
    return to_date(start).year != to_date(end).year


def is_cross_month(start: Any, end: Any) -> bool:
    a, b = to_date(start), to_date(end)
    return a.year != b.year or a.month != b.month


def is_cross_day(start: Any, end: Any) -> bool:
    return to_date(start) != to_date(end)


class CalendarService:
    def __init__(self, week_start: WeekStart = WeekStart.MONDAY) -> None:
        self.week_start = week_start
        self._lock = threading.RLock()
        self._stats = {"day": 0, "month": 0, "year": 0, "week": 0, "quarter": 0}

    def day(self, v: Any) -> DayBoundary:
        with self._lock:
            self._stats["day"] += 1
        return natural_day(v)

    def month(self, v: Any) -> MonthBoundary:
        with self._lock:
            self._stats["month"] += 1
        return natural_month(v)

    def year(self, v: Any) -> YearBoundary:
        with self._lock:
            self._stats["year"] += 1
        return natural_year(v)

    def week(self, v: Any) -> tuple[datetime, datetime, int]:
        with self._lock:
            self._stats["week"] += 1
        return natural_week(v, self.week_start)

    def quarter(self, v: Any) -> tuple[int, int, datetime, datetime]:
        with self._lock:
            self._stats["quarter"] += 1
        return natural_quarter(v)

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
