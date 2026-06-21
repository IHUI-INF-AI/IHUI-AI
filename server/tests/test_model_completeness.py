"""全 model 运行时验证测试 (任务 74 收官).

覆盖:
  - import app.models 不会触发任何 NameError/TypeError
  - 全部 model 能在 SQLite 上 Base.metadata.create_all 成功
  - 全部列类型都能在 SQL 编译阶段成功 (如 SA Enum 等需要值)
"""


import pytest
import sqlalchemy as sa


@pytest.fixture(autouse=True)
def _sqlite_env(monkeypatch):
    monkeypatch.setenv("DB1_URL", "sqlite:///:memory:")
    monkeypatch.setenv("DB2_URL", "sqlite:///:memory:")
    monkeypatch.setenv("DB3_URL", "sqlite:///:memory:")


def test_app_models_import_no_errors():
    """import app.models 不抛任何异常 (包括 NameError / 重复定义)."""
    import app.models  # noqa: F401


def test_all_tables_create_all_succeeds():
    """全部 62+ 张表都能在 SQLite 上 create_all 成功 (无 SQL 类型错误).

    模型声明了 PostgreSQL 的 "public" schema, SQLite 不支持 schema,
    用 schema_translate_map 把 public 映射到默认 schema (None).
    """
    from app.database import Base

    # 用一个干净的 SQLite 引擎, 通过 schema_translate_map 去掉 public 前缀
    engine = sa.create_engine("sqlite:///:memory:")
    conn = engine.connect()
    # 把 public schema 映射到 None (SQLite 默认 schema)
    conn = conn.execution_options(schema_translate_map={"public": None})
    Base.metadata.drop_all(bind=conn, checkfirst=True)
    Base.metadata.create_all(bind=conn, checkfirst=True)
    insp = sa.inspect(engine)
    tables = insp.get_table_names()
    assert len(tables) >= 30, f"应至少 30 张表, 实际 {len(tables)}"
    conn.close()
    engine.dispose()


def test_all_column_types_compile():
    """每张表的每列都能编译为 SQL 字符串 (检测类型未定义错误)."""
    from sqlalchemy.dialects import sqlite as sa_sqlite

    from app.database import Base

    engine = sa.create_engine("sqlite:///:memory:")
    errors = []
    for tbl_name, tbl in Base.metadata.tables.items():
        for col in tbl.columns:
            try:
                list(col.type.compile(sa_sqlite.dialect()))
            except Exception as e:
                errors.append(f"{tbl_name}.{col.name}: {type(col.type).__name__} -> {e}")
    assert not errors, "列类型 SQL 编译失败:\n" + "\n".join(errors[:20])
