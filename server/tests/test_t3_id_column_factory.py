"""T3 测试: 跨表 BigInteger 主键统一改造 (id_column 工厂).

覆盖:
1. id_column() 工厂返回 Integer 基类型 + BigInteger variant
2. 跨方言 DDL 生成验证 (PostgreSQL BIGINT, SQLite INTEGER)
3. payment_models 4 张表的 id 字段统一用 id_column 工厂
4. SQLite 下 db.add+flush 能自动分配 id (回归测试, 防止 S7 修复回退)
5. app_content_models 关键表用 id_column (后续扩展点)
"""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.schema import CreateTable

from app.database import Base
from app.models.base import id_column
from app.models.payment_models import (
    CommissionFlow,
    IdentityProportion,
    OperateTokenFlow,
    Order,
    WithdrawalFlow,
)


def test_id_column_factory_returns_integer_base_type():
    """id_column 基类型应是 Integer, 走 SQLite rowid 自动分配."""
    col = id_column()
    assert col.type.__class__.__name__ == "Integer"
    assert col.primary_key is True
    assert col.autoincrement is True


def test_id_column_factory_has_pg_variant():
    """id_column 变体: PostgreSQL 下变 BigInteger."""
    col = id_column()
    variant_map = col.type._variant_mapping
    assert "postgresql" in variant_map
    assert variant_map["postgresql"].__class__.__name__ == "BigInteger"


def test_id_column_custom_comment():
    """id_column 接受自定义 comment."""
    col = id_column(comment="Custom comment")
    assert col.comment == "Custom comment"


def test_id_column_postgresql_ddl_bigint():
    """PostgreSQL DDL 应生成 BIGINT/BIGSERIAL (用 Order 现成表)."""
    engine = create_engine("postgresql://u:p@localhost/x", strategy="mock", executor=lambda *a, **kw: None)
    ddl = str(CreateTable(Order.__table__).compile(engine))
    assert "BIGINT" in ddl.upper(), f"PostgreSQL DDL 应含 BIGINT, 实际: {ddl[:300]}"


def test_id_column_sqlite_ddl_integer():
    """SQLite DDL 应生成 INTEGER (用 Order 现成表)."""
    engine = create_engine("sqlite:///:memory:")
    ddl = str(CreateTable(Order.__table__).compile(engine))
    assert "INTEGER" in ddl.upper(), f"SQLite DDL 应含 INTEGER, 实际: {ddl[:300]}"


@pytest.mark.parametrize(
    "model_class",
    [Order, CommissionFlow, WithdrawalFlow, OperateTokenFlow],
)
def test_payment_models_use_id_column_factory(model_class):
    """payment_models 所有主键统一用 id_column 工厂."""
    col = model_class.__table__.columns["id"]
    # 基类型必须是 Integer (不是直接 BigInteger)
    assert col.type.__class__.__name__ == "Integer", (
        f"{model_class.__name__}.id 基类型应是 Integer, 当前是 {col.type.__class__.__name__}"
    )
    # 必须有 postgresql 变体 → BigInteger
    variant_map = col.type._variant_mapping
    assert "postgresql" in variant_map, f"{model_class.__name__}.id 缺 postgresql 变体"
    # 主键 + 自增
    assert col.primary_key is True
    assert col.autoincrement is True


@pytest.mark.parametrize(
    "model_class",
    [Order, CommissionFlow, WithdrawalFlow, OperateTokenFlow],
)
def test_payment_models_assign_id_after_flush_sqlite(model_class, tmp_path):
    """回归测试: 防止 S7 修复回退. SQLite 下 add+flush 必须能分配 id.

    注意: payment_models 4 张表中 3 张 (Order/CommissionFlow/WithdrawalFlow) 用了
    schema="public" (多租户阶段 2 占位), SQLite 不支持 schema 概念.
    ORM 的 mapper 绑定的是原始表, 复制到 local_metadata 的副本不会被使用, 因此必须
    临时 strip 原表 schema, 测试结束后再 restore.
    """
    saved_schema = {}
    target_tables = [Order.__table__, CommissionFlow.__table__, WithdrawalFlow.__table__, OperateTokenFlow.__table__]
    for tbl in target_tables:
        if tbl.schema is not None:
            saved_schema[tbl.name] = tbl.schema
            tbl.schema = None
    try:
        db_path = tmp_path / f"test_t3_{model_class.__name__}.db"
        engine = create_engine(f"sqlite:///{db_path}")
        try:
            from sqlalchemy.orm import sessionmaker
            # 仅创建目标 4 张表, 避免 Base.metadata 中其他带 schema="public" 的表干扰
            Base.metadata.create_all(engine, tables=target_tables, checkfirst=True)
            SessionLocal = sessionmaker(bind=engine)
            db = SessionLocal()
            try:
                if model_class is Order:
                    obj = Order(user_id="u-t3", out_trade_no="T3001", amount=100, status=0, payment_status=0)
                elif model_class is CommissionFlow:
                    obj = CommissionFlow(user_id="u-t3", amount=10, status=1)
                elif model_class is WithdrawalFlow:
                    obj = WithdrawalFlow(user_id="u-t3", amount=100, status=0)
                elif model_class is OperateTokenFlow:
                    # OperateTokenFlow 已合并为 ZhsOperateTokenFlow, user_id 为 Integer,
                    # 此处用 user_uuid (String) 携带测试标识.
                    obj = OperateTokenFlow(user_uuid="u-t3", token_quantity=50, type=1)
                else:
                    pytest.skip(f"unsupported {model_class.__name__}")
                db.add(obj)
                assert obj.id is None
                db.flush()
                assert obj.id is not None, f"{model_class.__name__}.id 未分配 (S7 修复回退!)"
                assert obj.id > 0
            finally:
                db.close()
        finally:
            engine.dispose()
    finally:
        # 恢复原表 schema
        for tbl in target_tables:
            if tbl.name in saved_schema:
                tbl.schema = saved_schema[tbl.name]


def test_identity_proportion_uses_string_pk():
    """IdentityProportion 用 String(64) UUID 主键, 不在 id_column 改造范围.

    注意: 它已是字符串主键, SQLite/PostgreSQL 都可正常工作.
    """
    col = IdentityProportion.__table__.columns["id"]
    assert col.type.__class__.__name__ in ("String", "VARCHAR", "CHAR")
    assert col.primary_key is True
    # 验证不是 autoincrement (UUID 主键不需要)
    assert col.autoincrement is not True


# ----------------------------------------------------------------------------
# 辅助函数
# ----------------------------------------------------------------------------


def _strip_schema_for_sqlite(metadata):
    saved = {}
    for table in metadata.tables.values():
        if table.schema is not None:
            saved[table.name] = table.schema
            table.schema = None
    return saved


def _restore_schema(metadata, saved):
    for table in metadata.tables.values():
        if table.name in saved:
            table.schema = saved[table.name]


# 给测试文件加 parametrize 装饰
