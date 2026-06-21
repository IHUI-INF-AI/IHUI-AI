"""ZHS Platform application package."""
import enum as _enum
import datetime as _datetime

if not hasattr(_enum, "StrEnum"):
    class _StrEnum(str, _enum.Enum):
        __str__ = str.__str__

    _enum.StrEnum = _StrEnum

if not hasattr(_datetime, "UTC"):
    _datetime.UTC = _datetime.timezone.utc
