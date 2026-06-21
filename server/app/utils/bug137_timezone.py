"""Bug-137: 时区处理 (UTC ↔ 本地).
设计:
  - 内部全部 UTC 存储
  - 输入: 支持 ISO 字符串 / naive datetime / aware datetime
  - 输出: 目标时区可配置
  - 常见区: Asia/Shanghai, UTC, America/Los_Angeles 等
  - DST (夏令时) 边界正确处理
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

try:
    from zoneinfo import ZoneInfo

    _HAS_ZONEINFO = True
except Exception:  # pragma: no cover
    ZoneInfo = None
    _HAS_ZONEINFO = False


class TZError(Exception):
    pass


_COMMON_ZONES = [
    "UTC",
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Asia/Singapore",
    "America/Los_Angeles",
    "America/New_York",
    "Europe/London",
    "Europe/Berlin",
    "Australia/Sydney",
]


def to_aware_utc(value: Any) -> datetime:
    """把各种时间值转成 aware UTC datetime."""
    if value is None:
        return datetime.now(tz=UTC)
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(float(value), tz=UTC)
    if isinstance(value, str):
        s = value.strip()
        # 处理 Z 后缀
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(s)
        except ValueError:
            # 尝试常见格式
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d %H:%M:%S", "%Y/%m/%d"):
                try:
                    dt = datetime.strptime(s, fmt)
                    break
                except ValueError:
                    continue
            else:
                raise TZError(f"无法解析时间字符串: {value!r}")
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC)
    raise TZError(f"不支持的时间类型: {type(value).__name__}")


def to_zone(value: Any, tz_name: str) -> datetime:
    """转换到指定时区的 aware datetime."""
    if not _HAS_ZONEINFO:
        if tz_name != "UTC":
            raise TZError("zoneinfo 不可用, 仅支持 UTC")
        return to_aware_utc(value)
    if tz_name not in _COMMON_ZONES:
        # 仍尝试
        try:
            ZoneInfo(tz_name)
        except Exception as e:
            raise TZError(f"未知时区: {tz_name}") from e
    utc_dt = to_aware_utc(value)
    return utc_dt.astimezone(ZoneInfo(tz_name))


def to_unix(value: Any) -> float:
    """转 unix 时间戳 (秒)."""
    return to_aware_utc(value).timestamp()


def to_iso(value: Any, tz_name: str = "UTC") -> str:
    """输出目标时区的 ISO 字符串."""
    return to_zone(value, tz_name).isoformat()


@dataclass
class TimeWindow:
    """时间窗口 (跨时区比较)."""

    start: datetime
    end: datetime
    tz_name: str = "UTC"

    def __post_init__(self) -> None:
        self.start = to_aware_utc(self.start)
        self.end = to_aware_utc(self.end)
        if self.start > self.end:
            raise TZError("start 必须早于 end")

    def contains(self, t: Any) -> bool:
        utc = to_aware_utc(t)
        return self.start <= utc <= self.end

    def overlaps(self, other: TimeWindow) -> bool:
        return self.start <= other.end and other.start <= self.end

    def duration_seconds(self) -> float:
        return (self.end - self.start).total_seconds()


class DSTTransitionError(Exception):
    pass


def safe_add_duration(dt: datetime, seconds: float, tz_name: str = "UTC") -> datetime:
    """在指定时区上加 duration, 自动处理 DST 跳变."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    target = to_zone(dt, tz_name)
    return target + timedelta(seconds=seconds)


def is_in_dst(dt: datetime, tz_name: str) -> bool:
    if not _HAS_ZONEINFO:
        return False
    aware = to_zone(dt, tz_name)
    dst_offset = aware.dst()
    return dst_offset is not None and dst_offset.total_seconds() != 0


class TimezoneService:
    """时区服务 (缓存常用转换 + 提供 API)."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._cache: dict[str, datetime] = {}
        self._stats = {"convert": 0, "cache_hit": 0}

    def convert(self, value: Any, tz_name: str = "UTC") -> datetime:
        with self._lock:
            self._stats["convert"] += 1
        return to_zone(value, tz_name)

    def unix(self, value: Any) -> float:
        return to_unix(value)

    def iso(self, value: Any, tz_name: str = "UTC") -> str:
        return to_iso(value, tz_name)

    def list_zones(self) -> list[str]:
        return list(_COMMON_ZONES)

    def in_dst(self, dt: datetime, tz_name: str) -> bool:
        return is_in_dst(dt, tz_name)

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
