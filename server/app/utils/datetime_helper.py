"""统一的 UTC 时间获取 (替代已弃用的 datetime.utcnow()).

Python 3.12 起 datetime.utcnow() 已弃用, 改用 timezone-aware 的 now() 后去除 tzinfo 以保持与 SQLAlchemy/PostgreSQL/SQLite 的 naive datetime 兼容.
"""

from datetime import UTC, datetime


def utcnow() -> datetime:
    """返回 naive UTC datetime (与原有 datetime.utcnow() 行为一致, 避免破坏 DB schema)."""
    return datetime.now(UTC).replace(tzinfo=None)
