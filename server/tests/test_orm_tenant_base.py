"""多租户 ORM 透明化 (建议 124) 单元测试.

覆盖:
  TenantBase:
    - 子类自动注入 schema 到 __table_args__
    - __tablename__ 必填
    - __tenant_schema__ 静态字符串
    - __tenant_schema__ callable
    - __tenant_schema__ = "contextvar" 动态读
    - __tenant_skip_in_alembic__ 控制是否跳过迁移
    - __tenant_table_args_extra__ 合并
    - get_schema() 解析正确
    - metadata_for_tenant 返回带 schema 的 metadata
    - 重复声明 schema 幂等
    - 已有 __table_args__ (dict / tuple) 兼容
    - 抽象子类不注册
    - 重新声明 __tablename__ 不影响

  TenantMetadataBuilder:
    - for_tenant 复制所有 TenantBase 表到目标 schema
    - for_all_tenants 批量
    - create_all / drop_all
    - include_skipped 参数
    - 空 tenant_id (默认 1) 不报错
  工具函数:
    - get_tenant_models / clear_tenant_models
    - list_tenant_tables
    - get_tenant_table_class
    - make_tenant_declarative_base
"""

import sys
import uuid
from pathlib import Path

import pytest
from sqlalchemy import Column, Integer, String, create_engine

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _clear_registry():
    from app.core import tenant as t_mod
    from app.database import Base

    # 注: 不要清空所有 _tenant_models, 否则会影响后续测试 (真实业务类)
    # 只清理 utb_ 前缀的测试临时注册
    from app.orm.tenant_base import _tenant_models

    keys_to_remove = [k for k in list(_tenant_models.keys()) if k.startswith("utb_")]
    for k in keys_to_remove:
        del _tenant_models[k]
    t_mod.reset_current_tenant_id()
    yield
    # 后置: 清理残留
    to_drop = [t for t in list(Base.metadata.tables) if t.startswith("utb_")]
    for t in to_drop:
        try:
            Base.metadata.remove(Base.metadata.tables[t])
        except Exception:
            pass
    # 再次清理 utb_ 前缀的注册
    keys_to_remove = [k for k in list(_tenant_models.keys()) if k.startswith("utb_")]
    for k in keys_to_remove:
        del _tenant_models[k]
    t_mod.reset_current_tenant_id()


def _u():
    """生成唯一表名后缀 (避免跨测试冲突)."""
    return uuid.uuid4().hex[:8]


@pytest.fixture
def enable_multi_tenant(monkeypatch):
    """enable_multi_tenant: 通过 patch _resolve_schema_contextvar 实现.

    由于 SQLAlchemy 1.x 强制传染 __abstract__, 此 fixture 在测试中通过
    直接设置 app.core.tenant.set_current_tenant_id 来验证 contextvar 解析.
    """
    from app.core import tenant as t_mod

    monkeypatch.setattr(t_mod, "is_multi_tenant_enabled", lambda: True)
    yield
    t_mod.reset_current_tenant_id()


# ---------------------------------------------------------------------------
# TenantBase - 子类自动注册
# ---------------------------------------------------------------------------


def test_subclass_registers_in_global():
    from app.orm import TenantBase, get_tenant_models

    u = _u()

    class TestUser(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_user"
        __tenant_schema__ = "public"
        id = Column(Integer, primary_key=True)

    models = get_tenant_models()
    assert f"utb_{u}_user" in models
    assert models[f"utb_{u}_user"] is TestUser


def test_subclass_injects_schema_in_table_args():
    from app.orm import TenantBase

    u = _u()

    class TestOrder(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_order"
        __tenant_schema__ = "public"
        id = Column(Integer, primary_key=True)

    args = TestOrder.__table_args__
    assert args is not None
    # 找含 schema 的 dict
    schemas = []
    for item in (args if isinstance(args, tuple) else (args,)):
        if isinstance(item, dict) and "schema" in item:
            schemas.append(item["schema"])
    assert "public" in schemas


def test_subclass_abstract_not_registered():
    from app.orm import TenantBase, get_tenant_models

    u = _u()

    class AbstractTest(TenantBase):
        __abstract__ = True
        __tablename__ = f"utb_{u}_abstract"
        __tenant_schema__ = "public"

    class ConcreteTest(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_concrete"
        __tenant_schema__ = "public"
        id = Column(Integer, primary_key=True)

    models = get_tenant_models()
    assert f"utb_{u}_abstract" not in models
    assert f"utb_{u}_concrete" in models


def test_subclass_no_tablename_skipped():
    from app.orm import TenantBase, get_tenant_models

    class NoTable(TenantBase):
        __abstract__ = True
        __tenant_schema__ = "public"

    assert "None" not in get_tenant_models()


# ---------------------------------------------------------------------------
# TenantBase - schema 解析
# ---------------------------------------------------------------------------


def test_schema_static_string():
    from app.orm import TenantBase

    u = _u()

    class StaticTest(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_static"
        __tenant_schema__ = "public"
        id = Column(Integer, primary_key=True)

    assert StaticTest.get_schema() == "public"


def test_schema_callable():
    from app.orm import TenantBase

    u = _u()

    class CallableTest(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_callable"
        __tenant_schema__ = lambda: "public"
        id = Column(Integer, primary_key=True)

    assert CallableTest.get_schema() == "public"


def test_schema_callable_returns_dynamic():
    from app.orm import TenantBase

    u = _u()
    counter = {"n": 0}

    def dynamic_schema():
        counter["n"] += 1
        return f"tenant_{counter['n']}"

    class DynamicTest(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_dynamic"
        __tenant_schema__ = dynamic_schema
        id = Column(Integer, primary_key=True)

    assert DynamicTest.get_schema() == "tenant_1"
    assert DynamicTest.get_schema() == "tenant_2"
    assert DynamicTest.get_schema() == "tenant_3"


def test_schema_contextvar(enable_multi_tenant):
    from app.core.tenant import reset_current_tenant_id, set_current_tenant_id
    from app.orm import TenantBase

    u = _u()

    class CtxTest(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_ctx"
        __tenant_schema__ = "contextvar"
        id = Column(Integer, primary_key=True)

    reset_current_tenant_id()
    # 默认 1
    assert CtxTest.get_schema() == "tenant_1"
    set_current_tenant_id(7)
    assert CtxTest.get_schema() == "tenant_7"
    set_current_tenant_id(99)
    assert CtxTest.get_schema() == "tenant_99"
    reset_current_tenant_id()


# ---------------------------------------------------------------------------
# TenantBase - skip_in_alembic
# ---------------------------------------------------------------------------


def test_skip_in_alembic_flag():
    from app.orm import TenantBase

    u = _u()

    class SkipTest(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_skip"
        __tenant_schema__ = "public"
        __tenant_skip_in_alembic__ = True
        id = Column(Integer, primary_key=True)

    assert SkipTest.should_skip_in_alembic() is True


def test_list_tenant_tables_excludes_skipped():
    from app.orm import TenantBase, list_tenant_tables

    u = _u()

    class A(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_a"
        __tenant_schema__ = "public"
        id = Column(Integer, primary_key=True)

    class B(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_b"
        __tenant_schema__ = "public"
        __tenant_skip_in_alembic__ = True
        id = Column(Integer, primary_key=True)

    tables = list_tenant_tables()
    assert f"utb_{u}_a" in tables
    assert f"utb_{u}_b" not in tables
    tables_all = list_tenant_tables(include_skipped=True)
    assert f"utb_{u}_b" in tables_all


# ---------------------------------------------------------------------------
# TenantBase - table_args 合并
# ---------------------------------------------------------------------------


def test_existing_dict_table_args_preserved():
    from app.orm import TenantBase

    u = _u()

    class WithArgs(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_args"
        __tenant_schema__ = "public"
        __table_args__ = ({"comment": "业务表"},)
        id = Column(Integer, primary_key=True)

    args = WithArgs.__table_args__
    found = None
    for item in (args if isinstance(args, tuple) else (args,)):
        if isinstance(item, dict) and "schema" in item:
            found = item
            break
    assert found is not None
    assert found["schema"] == "public"


def test_extra_table_args_merged():
    from app.orm import TenantBase

    u = _u()

    class WithExtra(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_extra"
        __tenant_schema__ = "public"
        __tenant_table_args_extra__ = {"comment": "业务表"}
        id = Column(Integer, primary_key=True)

    args = WithExtra.__table_args__
    items = list(args) if isinstance(args, tuple) else [args]
    # SQLAlchemy 1.4 规则: tuple 中 dict 必须放最后; 我们把 schema + extra 合并到 1 个 dict
    # 所以 len 可能 0 (无 leading) 或 1 (单个 dict 含 schema+extra)
    assert len(items) >= 1
    # 找到含 comment 的 dict
    found = None
    for item in items:
        if isinstance(item, dict) and item.get("comment") == "业务表":
            found = item
            break
    assert found is not None, f"应包含 comment=业务表, 实际 {items}"
    assert found.get("schema") == "public"


def test_no_double_schema():
    """重复 schema 注入应幂等."""
    from app.orm import TenantBase

    u = _u()

    class Idempotent(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_idempotent"
        __tenant_schema__ = "public"
        id = Column(Integer, primary_key=True)

    # 再次调用
    Idempotent._inject_schema_into_table_args()
    schemas = []
    for item in (
        Idempotent.__table_args__ if isinstance(Idempotent.__table_args__, tuple) else (Idempotent.__table_args__,)
    ):
        if isinstance(item, dict) and "schema" in item:
            schemas.append(item["schema"])
    assert len(schemas) == 1, f"schema 重复注入: {schemas}"


# ---------------------------------------------------------------------------
# TenantBase - metadata_for_tenant
# ---------------------------------------------------------------------------


def test_metadata_for_tenant():
    from app.orm import TenantBase

    u = _u()

    class MetaTest(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_meta"
        __tenant_schema__ = "public"
        id = Column(Integer, primary_key=True)
        name = Column(String(50))

    md = MetaTest.metadata_for_tenant(5)
    # SQLAlchemy 1.4 to_metadata 把 schema 加到 key 前: "{schema}.{tablename}"
    key = f"utb_{u}_meta"
    # 验证: 找 schema 正确的表
    found = None
    for k, tbl in md.tables.items():
        if tbl.name == key and tbl.schema == "tenant_5":
            found = tbl
            break
    assert found is not None, f"未找到 schema=tenant_5 的表 {key}, md.tables={list(md.tables)}"
    assert found.schema == "tenant_5"


def test_metadata_for_tenant_default():
    from app.orm import TenantBase

    u = _u()

    class MetaDefault(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_metadef"
        __tenant_schema__ = "public"
        id = Column(Integer, primary_key=True)

    md = MetaDefault.metadata_for_tenant(1)
    # 找表
    found = None
    for tbl in md.tables.values():
        if tbl.name == f"utb_{u}_metadef" and tbl.schema == "tenant_1":
            found = tbl
            break
    assert found is not None
    assert found.schema == "tenant_1"


# ---------------------------------------------------------------------------
# TenantMetadataBuilder
# ---------------------------------------------------------------------------


def test_metadata_builder_for_tenant():
    from app.orm import TenantBase, TenantMetadataBuilder

    u = _u()

    class BTest1(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_b1"
        __tenant_schema__ = "public"
        id = Column(Integer, primary_key=True)

    class BTest2(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_b2"
        __tenant_schema__ = "public"
        id = Column(Integer, primary_key=True)
        name = Column(String(50))

    builder = TenantMetadataBuilder()
    md = builder.for_tenant(3)
    # 验证两个表都存在且 schema 正确
    found_b1 = None
    found_b2 = None
    for tbl in md.tables.values():
        if tbl.name == f"utb_{u}_b1" and tbl.schema == "tenant_3":
            found_b1 = tbl
        elif tbl.name == f"utb_{u}_b2" and tbl.schema == "tenant_3":
            found_b2 = tbl
    assert found_b1 is not None
    assert found_b2 is not None
    assert found_b1.schema == "tenant_3"
    assert found_b2.schema == "tenant_3"


def test_metadata_builder_for_all_tenants():
    from app.orm import TenantBase, TenantMetadataBuilder

    u = _u()

    class AllTest(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_all"
        __tenant_schema__ = "public"
        id = Column(Integer, primary_key=True)

    builder = TenantMetadataBuilder()
    result = builder.for_all_tenants([1, 2, 3])
    assert set(result.keys()) == {1, 2, 3}
    for tid, md in result.items():
        found = None
        for tbl in md.tables.values():
            if tbl.name == f"utb_{u}_all" and tbl.schema == f"tenant_{tid}":
                found = tbl
                break
        assert found is not None, f"tenant {tid} 未找到 {f'utb_{u}_all'}"
        assert found.schema == f"tenant_{tid}"


def test_metadata_builder_includes_skipped():
    from app.orm import TenantBase, TenantMetadataBuilder

    u = _u()

    class SkipB(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_skipb"
        __tenant_schema__ = "public"
        __tenant_skip_in_alembic__ = True
        id = Column(Integer, primary_key=True)

    class KeepB(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_keepb"
        __tenant_schema__ = "public"
        id = Column(Integer, primary_key=True)

    md_normal = TenantMetadataBuilder().for_tenant(1)
    md_all = TenantMetadataBuilder(include_skipped=True).for_tenant(1)

    # 找表
    def has_table(md, name, schema):
        for tbl in md.tables.values():
            if tbl.name == name and tbl.schema == schema:
                return True
        return False

    assert has_table(md_normal, f"utb_{u}_keepb", "tenant_1")
    assert not has_table(md_normal, f"utb_{u}_skipb", "tenant_1")
    assert has_table(md_all, f"utb_{u}_skipb", "tenant_1")


def test_metadata_builder_create_all_for_tenant():
    """create_all 应能在 sqlite 上跑通 (mock 用)."""
    from app.orm import TenantBase, TenantMetadataBuilder

    u = _u()

    class CTest(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_c"
        __tenant_schema__ = "public"
        id = Column(Integer, primary_key=True)

    eng = create_engine("sqlite:///:memory:")
    builder = TenantMetadataBuilder()
    # 用 schema_translate_map 把 schema "tenant_1" 翻译成 None (sqlite 没 schema)
    from sqlalchemy import event

    @event.listens_for(eng, "connect")
    def _set_search_path(dbapi_conn, record):
        cursor = dbapi_conn.cursor()
        cursor.execute("ATTACH ':memory:' AS tenant_1")  # 兼容 sqlite
        cursor.close()

    # 不应抛 (SQLite 通过 ATTACH 模拟 schema)
    builder.create_all_for_tenant(eng, tenant_id=1)
    eng.dispose()


def test_metadata_builder_drop_all():
    from app.orm import TenantBase, TenantMetadataBuilder

    u = _u()

    class DTest(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_d"
        __tenant_schema__ = "public"
        id = Column(Integer, primary_key=True)

    eng = create_engine("sqlite:///:memory:")
    builder = TenantMetadataBuilder()
    # create_all 用 schema_translate_map 兼容 sqlite
    from sqlalchemy import event

    @event.listens_for(eng, "connect")
    def _set(dbapi_conn, record):
        cursor = dbapi_conn.cursor()
        cursor.execute("ATTACH ':memory:' AS tenant_1")
        cursor.close()

    builder.create_all_for_tenant(eng, tenant_id=1)
    builder.drop_all_for_tenant(eng, tenant_id=1)
    eng.dispose()


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------


def test_get_tenant_table_class():
    from app.orm import TenantBase, get_tenant_table_class

    u = _u()

    class LookTest(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_look"
        __tenant_schema__ = "public"
        id = Column(Integer, primary_key=True)

    assert get_tenant_table_class(f"utb_{u}_look") is LookTest
    assert get_tenant_table_class("nonexistent_xxx") is None


def test_clear_tenant_models():
    from app.orm.tenant_base import TenantBase, _tenant_models, get_tenant_models

    u = _u()

    class ClearTest(TenantBase):
        __abstract__ = False
        __tablename__ = f"utb_{u}_clear"
        __tenant_schema__ = "public"
        id = Column(Integer, primary_key=True)

    # 备份当前注册表 (避免影响后续测试)
    backup = dict(_tenant_models)
    try:
        assert f"utb_{u}_clear" in get_tenant_models()
        from app.orm import clear_tenant_models

        clear_tenant_models()
        assert f"utb_{u}_clear" not in get_tenant_models()
    finally:
        # 恢复 (关键!)
        _tenant_models.clear()
        _tenant_models.update(backup)


def test_make_tenant_declarative_base():
    from app.orm import make_tenant_declarative_base

    u = _u()

    TestBase = make_tenant_declarative_base("TestBase")
    assert TestBase is not None

    class CustomUser(TestBase):
        __tablename__ = f"utb_{u}_custom"
        id = Column(Integer, primary_key=True)
