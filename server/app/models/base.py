"""Base model mixin."""
from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, Column, DateTime, Integer
from sqlalchemy.orm import Mapped

from app.utils.datetime_helper import utcnow


class TimestampMixin:
    """Mixin that adds created_at and updated_at columns."""

    created_at: Mapped[datetime] = Column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = Column(DateTime, default=utcnow, onupdate=utcnow)


class SoftDeleteMixin:
    """Mixin that adds deleted_at soft-delete column.

    2026-06-25 P1 加固: 软删除标准模式.
    使用方式:
        class MyModel(SoftDeleteMixin, Base):
            __tablename__ = "my_model"
            ...

        # 查询未删除
        db.query(MyModel).filter(not MyModel.is_deleted)

        # 标记删除
        record.soft_delete()  # 设置 deleted_at

        # 恢复
        record.restore()
    """

    deleted_at: Mapped[datetime | None] = Column(DateTime, nullable=True, default=None)

    def set_deleted(self, when: datetime | None = None) -> None:
        """Mark this instance as deleted at the given timestamp (default: now)."""
        self.deleted_at = when or utcnow()

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def soft_delete(self) -> None:
        """业务软删除: 设 deleted_at = now."""
        self.deleted_at = utcnow()

    def restore(self) -> None:
        """恢复: 清空 deleted_at."""
        self.deleted_at = None


class DelFlagMixin:
    """Mixin that adds del_flag soft-delete column (Ruoyi/admin style).

    与 SoftDeleteMixin 区别: 用字符串字段 (del_flag='0' 存在, del_flag='2' 删除).
    适用于 admin_* 表 (ruoyi/admin-panel 风格).

    使用方式:
        class SysConfig(DelFlagMixin, Base):
            __tablename__ = "admin_config"
            ...

        # 查询未删除
        db.query(SysConfig).filter(SysConfig.del_flag == "0")

        # 软删除
        record.soft_delete()  # 设 del_flag='2'

        # 恢复
        record.restore()  # 设 del_flag='0'

    注意: del_flag 字段在多数 admin_* 表已存在 (SysUser, SysRole, SysDept).
    对缺失的表 (SysMenu, SysDictType 等), 需在本 mixin 之外单独添加字段.
    """

    # 注: 不在 mixin 中直接定义 del_flag Column, 避免与已存在的字段冲突.
    # 各 model 类根据需要单独添加 del_flag = Column(String(1), default="0", ...)

    @property
    def is_deleted(self) -> bool:
        return getattr(self, "del_flag", None) == "2"

    def soft_delete(self) -> None:
        """业务软删除: 设 del_flag='2'."""
        if hasattr(self, "del_flag"):
            self.del_flag = "2"

    def restore(self) -> None:
        """恢复: 设 del_flag='0'."""
        if hasattr(self, "del_flag"):
            self.del_flag = "0"


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


def soft_delete_filter(model: Any, column_name: str = "del_flag", not_deleted_value: str = "0") -> Any:
    """通用软删除过滤助手.

    支持两种模式:
    1) DelFlagMixin 模式: column_name="del_flag", not_deleted_value="0"
       -> 返回 model.del_flag == "0" 表达式
    2) SoftDeleteMixin 模式: column_name="deleted_at", not_deleted_value=None
       -> 返回 model.deleted_at.is_(None) 表达式

    用法:
        from app.models.base import soft_delete_filter
        from app.models.admin_models import SysConfig

        q = db.query(SysConfig).filter(soft_delete_filter(SysConfig))
        q = db.query(Message).filter(soft_delete_filter(Message, "deleted_at", None))

    2026-06-25 P1 加固: 统一软删除过滤入口, 减少重复代码.
    """
    col = getattr(model, column_name, None)
    if col is None:
        # 字段不存在, 返回永真条件 (兼容旧代码, 不抛错)
        return True
    if not_deleted_value is None:
        return col.is_(None)
    return col == not_deleted_value
