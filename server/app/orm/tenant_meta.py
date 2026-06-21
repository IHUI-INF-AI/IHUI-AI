"""多租户 metadata 辅助 (建议 124).

设计:
  - 把所有 TenantBase 子类的 Table 复制到指定 schema
  - 提供 create_all / drop_all / reflect 等便利方法
  - 与 app.db_per_tenant 配合: 引擎带 schema_translate_map, metadata 带 schema 即可

用法:
    from app.orm.tenant_meta import TenantMetadataBuilder
    from app.database import engine1

    builder = TenantMetadataBuilder()
    for tid in [1, 2, 3]:
        metadata = builder.for_tenant(tid)
        engine = get_tenant_engine(engine1, tid)
        metadata.create_all(engine)
"""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import MetaData, Table

from app.orm.tenant_base import (
    _tenant_models,
    _tenant_models_lock,
)


class TenantMetadataBuilder:
    """按租户构建 metadata."""

    def __init__(self, include_skipped: bool = False):
        self.include_skipped = include_skipped

    def for_tenant(self, tenant_id: int) -> MetaData:
        """返回指定 tenant_id 的 metadata 副本 (所有 TenantBase 子类的表)."""
        try:
            from app.core.tenant import get_tenant_schema_name

            schema = get_tenant_schema_name(tenant_id)
        except ValueError:
            schema = "public"

        new_meta = MetaData()
        with _tenant_models_lock:
            items = list(_tenant_models.items())

        for _tablename, cls in items:
            if not self.include_skipped and cls.should_skip_in_alembic():
                continue
            # 找原 Table 对象
            src_table: Table | None = None
            try:
                src_table = cls.__table__
            except AttributeError:
                continue
            if src_table is None:
                continue
            # 复制到新 schema
            try:
                src_table.to_metadata(new_meta, schema=schema)
            except Exception:
                continue
        return new_meta

    def for_all_tenants(self, tenant_ids: Iterable[int]) -> dict[int, MetaData]:
        """批量: 返回 {tenant_id: metadata}."""
        out: dict[int, MetaData] = {}
        for tid in tenant_ids:
            out[tid] = self.for_tenant(tid)
        return out

    def create_all_for_tenant(self, engine, tenant_id: int, checkfirst: bool = True) -> None:
        """在指定租户 engine 上 create_all."""
        metadata = self.for_tenant(tenant_id)
        metadata.create_all(engine, checkfirst=checkfirst)

    def drop_all_for_tenant(self, engine, tenant_id: int, checkfirst: bool = True) -> None:
        """在指定租户 engine 上 drop_all."""
        metadata = self.for_tenant(tenant_id)
        metadata.drop_all(engine, checkfirst=checkfirst)


# ---------------------------------------------------------------------------
# 便利: 取所有活跃 tenant
# ---------------------------------------------------------------------------


def list_active_tenant_ids(engine=None) -> list[int]:
    """从 admin_tenant 表读所有 active tenant_id.

    engine: SQLAlchemy engine (默认 engine1)
    失败时返回 [1] (默认 tenant).
    """
    if engine is None:
        try:
            from app.database import engine1

            engine = engine1
        except Exception:
            return [1]
    try:
        from sqlalchemy import text

        with engine.connect() as conn:
            rows = conn.execute(text("SELECT id FROM admin_tenant WHERE status = 1 ORDER BY id")).fetchall()
        return [r[0] for r in rows]
    except Exception:
        return [1]
