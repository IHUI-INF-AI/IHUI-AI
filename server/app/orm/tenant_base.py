"""多租户 ORM 模型基类 (建议 124).

设计目标:
  - 业务模型继承 TenantBase, 只需声明 __tenant_schema__ 即可
  - 运行时 SQLAlchemy schema_translate_map (来自 app.db_per_tenant) 自动翻译
  - 提供 schema 解析回调 (支持 ContextVar / 静态 / callable)
  - 提供 _tenant_models 注册表 (供迁移 / metadata 复制用)
  - 兼容 SQLAlchemy 1.x 风格 Base + 2.0 DeclarativeBase

用法:
    from app.orm.tenant_base import TenantBase

    class User(TenantBase):
        __abstract__ = False  # SQLAlchemy 1.x 必须显式声明
        __tablename__ = "users"
        __tenant_schema__ = "public"  # 业务方无需再写 {"schema": "public"}
        ...

    class HotConfig(TenantBase):
        __abstract__ = False
        __tablename__ = "hot_config"
        __tenant_schema__ = "public"
        __tenant_skip_in_alembic__ = True  # 公共表, 不参与 per-tenant 迁移

注: SQLAlchemy 1.x 的 DeclarativeMeta 会把 abstract 传染给所有继承类,
    所以具体业务子类必须显式 __abstract__ = False. 这是 SQLAlchemy 1.x
    declarative 的标准做法, 与 TenantBase 无关.
"""

from __future__ import annotations

import threading
from typing import Any, ClassVar

from sqlalchemy import MetaData
from sqlalchemy.ext.declarative import declarative_base

from app.core.tenant import get_current_tenant_id

# 复用项目现有 Base
from app.database import Base

# ---------------------------------------------------------------------------
# 全局: 所有继承 TenantBase 的模型注册表
# ---------------------------------------------------------------------------

_tenant_models: dict[str, type] = {}  # tablename -> class
_tenant_models_lock = threading.RLock()


def get_tenant_models() -> dict[str, type]:
    """返回所有 TenantBase 子类: {tablename: class}."""
    with _tenant_models_lock:
        return dict(_tenant_models)


def clear_tenant_models() -> None:
    """清空注册表 (测试用)."""
    with _tenant_models_lock:
        _tenant_models.clear()


# ---------------------------------------------------------------------------
# schema 解析
# ---------------------------------------------------------------------------


def _resolve_schema_static(value: str | None) -> str | None:
    return value


def _resolve_schema_callable(value) -> str | None:
    try:
        v = value()
        if v is None:
            return None
        return str(v)
    except Exception:
        return None


def _resolve_schema_contextvar(_: Any = None) -> str | None:
    """从 ContextVar 读 tid, 推导出 schema.

    未设置 ContextVar 时默认 tenant_id=1 (公共租户, schema=tenant_1).
    """
    tid = get_current_tenant_id()
    if tid is None:
        tid = 1  # 默认公共租户
    try:
        from app.core.tenant import get_tenant_schema_name

        return get_tenant_schema_name(tid)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# TenantBase 抽象基类
# ---------------------------------------------------------------------------


class TenantBase(Base):
    """多租户 ORM 模型抽象基类.

    子类必须显式声明:
      - __abstract__ = False (SQLAlchemy 1.x 必须)
      - __tablename__ (必需)
      - __tenant_schema__ (必需)  # str | callable | "contextvar"

    可选设置:
      - __tenant_skip_in_alembic__ (bool, 默认 False)
          True = 公共表, 不参与 per-tenant alembic 迁移
      - __tenant_table_args_extra__ (dict)
          额外 table_args, 自动与 __table_args__ 合并
    """

    __abstract__ = True

    # 类属性
    __tenant_schema__: ClassVar[str | Any] = "public"
    __tenant_skip_in_alembic__: ClassVar[bool] = False
    __tenant_table_args_extra__: ClassVar[dict] = {}

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        # 显式 abstract 子类直接跳过
        if getattr(cls, "__abstract__", False):
            return
        # 无 __tablename__ 子类跳过
        tablename = getattr(cls, "__tablename__", None)
        if not tablename:
            return
        # 注册到全局
        with _tenant_models_lock:
            _tenant_models[tablename] = cls
        # 自动注入 schema 到 __table_args__ (仅静态 schema)
        cls._inject_schema_into_table_args()

    @classmethod
    def _resolve_schema_static_only(cls) -> str | None:
        """仅当 __tenant_schema__ 是静态字符串时返回, callable/contextvar 返回 None."""
        schema_decl = getattr(cls, "__tenant_schema__", None)
        if schema_decl is None or callable(schema_decl) or schema_decl == "contextvar":
            return None
        return schema_decl

    @classmethod
    def _resolve_schema(cls) -> str | None:
        """解析 schema: 静态字符串 / callable / 特殊 sentinel "contextvar"."""
        schema_decl = getattr(cls, "__tenant_schema__", None)
        if schema_decl is None:
            return None
        if schema_decl == "contextvar":
            return _resolve_schema_contextvar()
        if callable(schema_decl):
            return _resolve_schema_callable(schema_decl)
        return _resolve_schema_static(schema_decl)

    @classmethod
    def _inject_schema_into_table_args(cls) -> None:
        """把 __tenant_schema__ 静态值注入 __table_args__ (幂等, 不会重复).

        注意: callable / contextvar 不注入 (它们在运行时通过 schema_translate_map 解析).

        SQLAlchemy 1.4 的 __table_args__ 规则:
          - 裸 dict 形式: 整体当 kwargs
          - tuple 形式: 只有最后一个 dict 当 kwargs, 其余当 args
          - 因此我们的 schema 合并到 dict 中, 不能再加 extra dict 到 tuple
        """
        schema = cls._resolve_schema_static_only()
        if schema is None:
            return

        # 已有 __table_args__ 处理 (并去重)
        existing = getattr(cls, "__table_args__", None)
        if existing is None:
            existing = ()
        elif isinstance(existing, dict) or not isinstance(existing, tuple):
            existing = (existing,)

        # 收集: 最后一个 dict (可能含 schema, comment 等) + 前面 non-dict items
        leading = []  # non-dict items
        trailing_dict = {}  # 合并后的 dict (含 schema)
        has_trailing_dict = False

        for item in existing:
            if isinstance(item, dict):
                # 把非 schema 键合并到 trailing_dict
                for k, v in item.items():
                    if k != "schema":
                        trailing_dict[k] = v
                has_trailing_dict = True
            else:
                # 在 leading 中的 dict 必须不是最后一个 (按 SQLAlchemy 1.4 规则会丢失)
                # 保险起见: 如果之前已有 trailing_dict, 把它移到 leading
                if has_trailing_dict:
                    leading.append(trailing_dict)
                    trailing_dict = {}
                    has_trailing_dict = False
                leading.append(item)

        # 设置 schema
        trailing_dict["schema"] = schema
        # 合并 __tenant_table_args_extra__ (到 trailing_dict)
        extra = getattr(cls, "__tenant_table_args_extra__", None)
        if extra:
            for k, v in extra.items():
                if k != "schema":
                    trailing_dict[k] = v

        # 重新组装: leading + trailing_dict
        new_args = (*tuple(leading), trailing_dict) if (leading or trailing_dict) else ()
        cls.__table_args__ = new_args

    # ---------- 公开 API ----------
    @classmethod
    def get_schema(cls) -> str | None:
        """取当前 schema (含 ContextVar 动态解析)."""
        return cls._resolve_schema()

    @classmethod
    def should_skip_in_alembic(cls) -> bool:
        """是否在 per-tenant alembic 迁移中跳过 (公共表)."""
        return bool(getattr(cls, "__tenant_skip_in_alembic__", False))

    @classmethod
    def metadata_for_tenant(cls, tid: int) -> MetaData:
        """返回带 schema 标签的 metadata 副本 (只含 TenantBase 子类表).

        用法:
            md = TenantBase.metadata_for_tenant(5)
            md.create_all(engine_with_schema_translate_map)
        """
        try:
            from app.core.tenant import get_tenant_schema_name

            schema = get_tenant_schema_name(tid)
        except (ValueError, Exception):
            schema = "public"
        new_meta = MetaData()
        with _tenant_models_lock:
            items = list(_tenant_models.items())
        for _tablename, model_cls in items:
            try:
                src_table = model_cls.__table__
            except AttributeError:
                continue
            if src_table is None:
                continue
            try:
                src_table.to_metadata(new_meta, schema=schema)
            except Exception:
                continue
        return new_meta


# ---------------------------------------------------------------------------
# 工厂: 按 Base 复制 (给业务用)
# ---------------------------------------------------------------------------


def make_tenant_declarative_base(name: str = "TenantBase"):
    """创建一个独立的 TenantBase (用于测试 / 子项目隔离).

    用法:
        TestBase = make_tenant_declarative_base("TestBase")
        class User(TestBase):
            __abstract__ = False
            __tablename__ = "users"
            __tenant_schema__ = "public"
    """
    Base_ = declarative_base(name=name)
    return Base_


# ---------------------------------------------------------------------------
# 批量操作: 列出所有 TenantBase 子类
# ---------------------------------------------------------------------------


def list_tenant_tables(include_skipped: bool = False) -> list[str]:
    """列出所有租户表 (默认排除 skip_in_alembic 的公共表)."""
    with _tenant_models_lock:
        items = []
        for tablename, cls in _tenant_models.items():
            if not include_skipped and cls.should_skip_in_alembic():
                continue
            items.append(tablename)
    return sorted(items)


def get_tenant_table_class(tablename: str) -> type | None:
    """按 tablename 拿 TenantBase 子类."""
    with _tenant_models_lock:
        return _tenant_models.get(tablename)
