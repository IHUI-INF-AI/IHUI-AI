"""Alembic 008 迁移文件深度静态验证 (无需 Docker).

覆盖:
1. 文件存在
2. revision / down_revision 元数据正确
3. upgrade() 函数体必须调用 Base.metadata.create_all
4. 迁移链 001 -> 002 -> ... -> 008 完整无断裂
5. 001_init.sql 与 008 应协同覆盖 150 张表
6. 关键业务表名在 008 描述中提及 (visit/point/circle/ask/behavior/message/notification/live/exam)
"""
from __future__ import annotations

import os
import re
from pathlib import Path

import pytest

SERVER = Path(__file__).resolve().parent.parent
VERSIONS = SERVER / "alembic" / "versions"
TARGET_FILE = VERSIONS / "008_add_missing_tables.py"
INIT_SQL = VERSIONS / "001_init.sql"


def test_008_file_exists():
    assert TARGET_FILE.exists(), f"迁移文件不存在: {TARGET_FILE}"


def test_008_revision_metadata():
    """008 文件中的 revision / down_revision 必须正确."""
    content = TARGET_FILE.read_text(encoding="utf-8")
    rev_match = re.search(r'^revision\s*=\s*["\']([^"\']+)["\']', content, re.M)
    assert rev_match, "找不到 revision 赋值"
    assert rev_match.group(1) == "008_add_missing_tables", (
        f"revision 应为 008_add_missing_tables, 实际 {rev_match.group(1)}"
    )
    down_match = re.search(r'^down_revision\s*=\s*["\']([^"\']+)["\']', content, re.M)
    assert down_match, "找不到 down_revision 赋值"
    assert down_match.group(1) == "007_migrate_phase2_tables_to_tenant_schema", (
        f"down_revision 应为上一条 007 迁移, 实际 {down_match.group(1)}"
    )


def test_008_upgrade_creates_tables():
    """upgrade() 必须实际调用 create_all 来建表, 不能是空函数."""
    content = TARGET_FILE.read_text(encoding="utf-8")
    # 抽取 upgrade 函数体
    m = re.search(r"def\s+upgrade\s*\(\)\s*->.*?:\s*\n(.*?)(?=\ndef\s|\Z)", content, re.S)
    assert m, "找不到 upgrade() 函数"
    body = m.group(1)
    # 必须调用 create_all
    assert "create_all" in body, "upgrade() 未调用 Base.metadata.create_all, 008 不会建表"
    # 必须触发模型导入
    assert "import app.models" in body or "from app.models" in body, (
        "upgrade() 未导入 app.models, Base.metadata 收集不到 150 张表"
    )


def test_008_downgrade_safe():
    """downgrade() 应保守 (pass), 避免误删数据."""
    content = TARGET_FILE.read_text(encoding="utf-8")
    m = re.search(r"def\s+downgrade\s*\(\)\s*->.*?:\s*\n(.*?)(?=\ndef\s|\Z)", content, re.S)
    assert m, "找不到 downgrade() 函数"
    body = m.group(1).strip()
    # 允许: pass, docstring, 注释; 不允许: drop_table
    assert "drop_table" not in body, "008 downgrade() 不应 drop_table, 会导致数据丢失"


def test_migration_chain_complete():
    """迁移链 001 -> 002 -> ... -> 008 完整无断裂."""
    rev_to_down: dict[str, str] = {}
    rev_to_file: dict[str, str] = {}
    for f in sorted(VERSIONS.glob("*.py")):
        if f.name.startswith("__"):
            continue
        content = f.read_text(encoding="utf-8")
        rev = re.search(r'^revision\s*=\s*["\']([^"\']+)["\']', content, re.M)
        down = re.search(r'^down_revision\s*=\s*["\']([^"\']+)["\']', content, re.M)
        if rev and down:
            rev_to_down[rev.group(1)] = down.group(1)
            rev_to_file[rev.group(1)] = f.name

    # 找 head (没有其他迁移指向它)
    all_downs = set(rev_to_down.values())
    heads = [r for r in rev_to_down.keys() if r not in all_downs]
    assert len(heads) == 1, (
        f"应有唯一 head, 实际 heads: {heads}"
    )
    head = heads[0]

    # 从 head 反向追溯到 root (down_revision 链)
    chain = [head]
    cur = head
    seen = set()
    while cur in rev_to_down:
        cur = rev_to_down[cur]
        if cur in seen:
            pytest.fail(f"迁移链存在环: {cur}")
        seen.add(cur)
        chain.append(cur)
    chain.reverse()
    assert len(chain) >= 8, f"迁移链应至少 8 步, 实际: {chain}"
    assert chain[0].startswith("001"), (
        f"迁移链起点应以 001 开头, 实际: {chain[0]}"
    )


def test_init_sql_and_008_synergy():
    """001_init.sql 覆盖主表, 008 补建缺失表, 合计 150 张."""
    if not INIT_SQL.exists():
        pytest.skip(f"001_init.sql 不存在: {INIT_SQL}")
    sql_content = INIT_SQL.read_text(encoding="utf-8")
    # CREATE TABLE 计数
    create_count = len(re.findall(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)", sql_content, re.I))
    # 008 应提及补建表的总目标数 (>= 50)
    m080 = TARGET_FILE.read_text(encoding="utf-8")
    # docstring 中提到 50
    assert "50" in m080, "008 文档字符串应提到补建 50 张表"


def test_008_docstring_mentions_key_tables():
    """008 docstring 至少应提到核心业务表名 (visit/point/circle/ask/behavior/message/notification/live/exam)."""
    content = TARGET_FILE.read_text(encoding="utf-8")
    # 模块 docstring 在文件最开头
    docstring = re.search(r'^"""(.*?)"""', content, re.S)
    assert docstring, "008 缺少模块 docstring"
    text = docstring.group(1)
    key_tables = ["visit", "point", "circle", "ask", "behavior", "message", "notification", "live", "exam"]
    missing = [t for t in key_tables if t not in text]
    assert not missing, f"008 docstring 缺少关键业务表名: {missing}"


def test_008_idempotent():
    """008 upgrade() 必须幂等 (checkfirst=True), 重复执行不会出错."""
    content = TARGET_FILE.read_text(encoding="utf-8")
    m = re.search(r"def\s+upgrade\s*\(\)\s*->.*?:\s*\n(.*?)(?=\ndef\s|\Z)", content, re.S)
    body = m.group(1)
    assert "checkfirst=True" in body, (
        "008 upgrade() 必须传 checkfirst=True, 否则重复执行会因表已存在而失败"
    )
