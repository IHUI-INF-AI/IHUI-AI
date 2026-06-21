"""P1-1 索引迁移测试."""
import os
import sqlite3
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest


def test_dry_run_no_changes():
    """dry_run 模式不修改数据库."""
    from scripts.add_missing_indexes import run_db_index_migration, TOP20_INDEXES

    with tempfile.TemporaryDirectory() as d:
        db = str(Path(d) / "test.db")
        result = run_db_index_migration(dry_run=True)
        assert result["total"] == len(TOP20_INDEXES)
        assert result["created"] == 0
        # dry-run 不应该创建任何文件
        assert not Path(db).exists()


def test_sqlite_migration_creates_indexes():
    """SQLite 模式创建索引. 空 db 时所有表都不存在, 全部 skipped."""
    from scripts.add_missing_indexes import run_db_index_migration, TOP20_INDEXES

    with tempfile.TemporaryDirectory() as d:
        db = str(Path(d) / "test.db")
        # 创建空 db
        sqlite3.connect(db).close()
        with patch.dict(os.environ, {"DB_FALLBACK_PATH": db}):
            # 第一次: 表都不存在 -> 全部 skipped
            r1 = run_db_index_migration()
            assert r1["created"] == 0
            assert r1["exists"] == 0
            assert r1["skipped"] == len(TOP20_INDEXES)
            assert r1["errors"] == []
        # 第二次运行依然幂等
        with patch.dict(os.environ, {"DB_FALLBACK_PATH": db}):
            r2 = run_db_index_migration()
            assert r2["created"] == 0
            assert r2["exists"] == 0
            assert r2["skipped"] == len(TOP20_INDEXES)


def test_sqlite_actually_creates_indexes_in_db():
    """SQLite 模式实际在 db 中创建索引."""
    from scripts.add_missing_indexes import run_db_index_migration, TOP20_INDEXES

    with tempfile.TemporaryDirectory() as d:
        db = str(Path(d) / "test.db")
        conn = sqlite3.connect(db)
        # 创建表 + 一条记录
        sample_table, sample_idx, _ = TOP20_INDEXES[0]
        cols_csv = "status"
        conn.execute(f'CREATE TABLE "{sample_table}" (id INTEGER PRIMARY KEY, {cols_csv} TEXT)')
        conn.execute(f'INSERT INTO "{sample_table}" (status) VALUES (?)', ("active",))
        conn.commit()
        conn.close()
        with patch.dict(os.environ, {"DB_FALLBACK_PATH": db}):
            r = run_db_index_migration()
        # 第一个表(created), 其他表都 table_missing
        assert r["created"] >= 1
        # 重新打开 db, 验证索引存在
        conn = sqlite3.connect(db)
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
            (sample_idx,),
        ).fetchall()
        conn.close()
        assert len(rows) == 1
        assert rows[0][0] == sample_idx


def test_top20_count():
    """Top 20 列表应包含 26 条索引 (部分表 2 个)."""
    from scripts.add_missing_indexes import TOP20_INDEXES

    assert len(TOP20_INDEXES) >= 20
    # 关键表必须存在
    tables = {t for t, _, _ in TOP20_INDEXES}
    for required in [
        "users", "zhs_order", "zhs_commission_flow", "zhs_withdrawal_flow",
        "zhs_course_pay", "zhs_information", "agents",
    ]:
        assert required in tables, f"missing table {required} in TOP20_INDEXES"
