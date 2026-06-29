"""ZHS Platform application package."""
import datetime as _datetime
import enum as _enum

if not hasattr(_enum, "StrEnum"):
    # Python < 3.11 兼容: 用 str + Enum 模拟 StrEnum
    class _StrEnum(str, _enum.Enum):
        __str__ = str.__str__

    _enum.StrEnum = _StrEnum

if not hasattr(_datetime, "UTC"):
    # Python < 3.11 兼容: datetime.UTC (3.11+) → timezone.utc
    _datetime.UTC = _datetime.timezone.utc
