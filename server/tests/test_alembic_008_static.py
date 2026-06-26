"""Alembic 迁移链深度静态验证 (无需 Docker).

覆盖:
1. 001_init.sql 存在
2. alembic/versions/ 下所有 .py 迁移的 revision / down_revision 元数据正确
3. 迁移链 016 -> 017 -> ... -> 047 完整无断裂
4. head 必须为 047_notify_persist
5. 每条迁移都通过 python -m py_compile 语法验证
6. 迁移链长度 >= 30
"""
from __future__ import annotations

import py_compile
import re
from pathlib import Path

import pytest

# server/tests/test_alembic_008_static.py -> ../../ (server 根)
SERVER = Path(__file__).resolve().parent.parent
VERSIONS = SERVER / "alembic" / "versions"
INIT_SQL = VERSIONS / "001_init.sql"

# 当前 head (2026-06-26 实际状态, 经 _verify_alembic_chain.py 验证)
EXPECTED_HEAD = "054_add_agent_need_task_columns"
MIN_CHAIN_LENGTH = 30


def test_001_init_sql_exists():
    """基础初始化 SQL 必须存在."""
    assert INIT_SQL.exists(), f"001_init.sql 不存在: {INIT_SQL}"


def test_all_migrations_syntax_valid():
    """alembic/versions/ 下所有 .py 迁移文件必须能 py_compile 通过."""
    py_files = [f for f in sorted(VERSIONS.glob("*.py")) if not f.name.startswith("__")]
    assert py_files, f"alembic/versions/ 下没有任何 .py 迁移文件"
    for f in py_files:
        try:
            py_compile.compile(str(f), doraise=True)
        except py_compile.PyCompileError as e:
            pytest.fail(f"迁移文件语法错误 {f.name}: {e}")


def test_all_migrations_have_revision_metadata():
    """每条迁移必须包含 revision 和 down_revision 赋值 (down_revision 可为 None)."""
    py_files = [f for f in sorted(VERSIONS.glob("*.py")) if not f.name.startswith("__")]
    bad: list[str] = []
    for f in py_files:
        c = f.read_text(encoding="utf-8")
        if not re.search(r'^revision\s*=\s*["\'].+["\']', c, re.M):
            bad.append(f"{f.name}: 缺少 revision")
        # down_revision 允许为 None (root) 或字符串
        if not re.search(r'^down_revision\s*=\s*(None|["\'].+["\'])', c, re.M):
            bad.append(f"{f.name}: 缺少 down_revision")
    assert not bad, "迁移元数据缺失:\n" + "\n".join(bad)


def test_migration_chain_complete():
    """迁移链必须完整无断裂, head 必须是 054_add_agent_need_task_columns."""
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

    all_downs = set(rev_to_down.values())
    heads = [r for r in rev_to_down.keys() if r not in all_downs]
    assert EXPECTED_HEAD in heads, (
        f"当前 head 必须是 {EXPECTED_HEAD}, 实际 heads: {heads}"
    )

    # 从 head 反向追溯到 root
    chain = [EXPECTED_HEAD]
    cur = EXPECTED_HEAD
    seen = set()
    while cur in rev_to_down:
        cur = rev_to_down[cur]
        if cur in seen:
            pytest.fail(f"迁移链存在环: {cur}")
        seen.add(cur)
        chain.append(cur)
    chain.reverse()
    assert len(chain) >= MIN_CHAIN_LENGTH, (
        f"迁移链应至少 {MIN_CHAIN_LENGTH} 步, 实际: {len(chain)} ({chain[0]} -> {chain[-1]})"
    )


def test_no_orphan_down_revisions():
    """每条 down_revision 必须指向一个真实存在的 revision (无悬空引用, None 允许)."""
    rev_to_down: dict[str, str] = {}
    for f in sorted(VERSIONS.glob("*.py")):
        if f.name.startswith("__"):
            continue
        content = f.read_text(encoding="utf-8")
        rev = re.search(r'^revision\s*=\s*["\']([^"\']+)["\']', content, re.M)
        down = re.search(r'^down_revision\s*=\s*(?:None|["\']([^"\']*)["\'])', content, re.M)
        if rev and down is not None:
            rev_to_down[rev.group(1)] = down.group(1) or ""  # None -> ""
    orphans = [
        (rev, down) for rev, down in rev_to_down.items()
        if down and down not in rev_to_down
    ]
    assert not orphans, (
        f"悬空 down_revision (指向不存在的 revision):\n"
        + "\n".join(f"  {rev} -> {down}" for rev, down in orphans)
    )


def test_init_sql_has_create_tables():
    """001_init.sql 必须包含至少 10 个 CREATE TABLE 语句."""
    if not INIT_SQL.exists():
        pytest.skip(f"001_init.sql 不存在: {INIT_SQL}")
    sql_content = INIT_SQL.read_text(encoding="utf-8")
    create_count = len(re.findall(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)", sql_content, re.I))
    assert create_count >= 10, (
        f"001_init.sql 应至少 10 个 CREATE TABLE, 实际 {create_count}"
    )
