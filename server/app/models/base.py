"""Base model mixin."""

from datetime import datetime, timezone

from sqlalchemy import BigInteger, Column, DateTime, Integer


class TimestampMixin:
    """Mixin that adds created_at and updated_at columns."""

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class SoftDeleteMixin:
    """Mixin that adds deleted_at soft-delete column."""

    deleted_at = Column(DateTime, nullable=True, default=None)

    def set_deleted(self, when: datetime | None = None) -> None:
        """Mark this instance as deleted at the given timestamp (default: now)."""
        self.deleted_at = when or datetime.now(timezone.utc)

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


def id_column(comment: str = "ID"):
    """统一主键列工厂: PostgreSQL BigInteger 主键.

    解决问题: 单独写 `Column(BigInteger, primary_key=True, autoincrement=True)`
    在 SQLite 下不会自动分配 id (NOT NULL constraint failed).

    解决方案: 基类型 Integer (SQLite 走 rowid 自动分配),
    PostgreSQL 用 BigInteger 满足大数据量场景 (支持最大 2^63-1).

    用法:
        id = id_column()                  # 默认 comment "ID"
        id = id_column(comment="Order ID") # 自定义 comment

    注意: SQLite 下 Integer 主键会被识别为 rowid, 走 SQLite 内部序列自增.
    PostgreSQL 下走 BigInteger + BIGSERIAL.
    """
    return Column(
        Integer().with_variant(BigInteger(), "postgresql"),
        primary_key=True,
        autoincrement=True,
        comment=comment,
    )
