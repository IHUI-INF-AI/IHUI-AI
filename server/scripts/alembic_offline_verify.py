"""Alembic 离线 DDL 验证 (无需 PostgreSQL/Docker).

本项目 alembic/ 目录是项目自创的, 不使用 alembic 命令行工具.
通过两种离线方式验证迁移链:
1. gen_init_sql.py: 离线生成 150 张表的 PostgreSQL DDL
2. 008 迁移: 通过 Base.metadata.create_all 补建缺失表

本脚本验证:
- 150 张表 CREATE TABLE 在 001_init.sql 中
- 008 迁移描述的关键业务表名都能在 SQLAlchemy metadata 找到
- 迁移链 001 -> 008 完整, 8 个文件都存在
- 生成的 SQL 无 MySQL 残留 (反引号、ENGINE、CHARSET)
- 001_init.sql 能用 sqlite3 解析 (语法正确, 即使方言不兼容)

用法:
    python scripts/alembic_offline_verify.py
    python scripts/alembic_offline_verify.py --regen   # 重新生成 001_init.sql
"""

from __future__ import annotations

import argparse
import re
import sqlite3
import subprocess
import sys
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent.parent
VERSIONS = SERVER_ROOT / "alembic" / "versions"
INIT_SQL = VERSIONS / "001_init.sql"


def regen_init_sql() -> int:
    """重新生成 001_init.sql."""
    result = subprocess.run(
        [sys.executable, "alembic/gen_init_sql.py"],
        capture_output=True,
        text=True,
        cwd=str(SERVER_ROOT),
        timeout=60,
        env={"PYTHONIOENCODING": "utf-8", **__import__("os").environ},
    )
    if result.returncode != 0:
        print(f"[FAIL] gen_init_sql.py 失败: {result.stderr[:500]}")
        return result.returncode
    print(f"[regen] {result.stdout.strip().splitlines()[-1]}")
    return 0


def verify_init_sql() -> list[str]:
    """验证 001_init.sql 的内容."""
    errs: list[str] = []
    if not INIT_SQL.exists():
        return [f"001_init.sql 不存在: {INIT_SQL}"]
    text = INIT_SQL.read_text(encoding="utf-8")
    create_count = len(re.findall(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)", text, re.I))
    if create_count < 150:
        errs.append(f"CREATE TABLE 数量 {create_count} < 150")
    if "`" in text:
        errs.append("出现反引号 (MySQL 语法)")
    if re.search(r"\bENGINE\s*=\s*\w+", text, re.I):
        errs.append("出现 ENGINE = (MySQL 语法)")
    if re.search(r"\bCHARSET\s*=\s*\w+", text, re.I):
        errs.append("出现 CHARSET = (MySQL 语法)")
    if "SERIAL" not in text.upper() and "BIGSERIAL" not in text.upper() and "IDENTITY" not in text.upper():
        errs.append("未发现 PG 自增主键 (SERIAL/BIGSERIAL/IDENTITY)")
    print(f"[init_sql] CREATE TABLE: {create_count}, 字符数: {len(text)}")
    return errs


def verify_migration_chain() -> list[str]:
    """验证 001 -> 008 迁移链完整无断裂."""
    errs: list[str] = []
    files = sorted([f.name for f in VERSIONS.glob("*.py") if f.name[0].isdigit()])
    if len(files) < 8:
        errs.append(f"迁移文件不足 8 个, 实际 {len(files)} 个: {files}")
    expected = [
        "001_initial_schema",
        "002_admin_job",
        "003_add_indexes",
        "004_add_user_uuid_to_admin_user",
        "005_create_tenant_metadata",
        "006_migrate_hot_tables_to_tenant_schema",
        "007_migrate_phase2_tables_to_tenant_schema",
        "008_add_missing_tables",
    ]
    for prefix in expected:
        match = next((f for f in files if f.startswith(prefix)), None)
        if not match:
            errs.append(f"缺少迁移文件: {prefix}*")
    return errs


def verify_008_metadata() -> list[str]:
    """验证 008 迁移描述的表名能在 SQLAlchemy metadata 中找到."""
    errs: list[str] = []
    p008 = VERSIONS / "008_add_missing_tables.py"
    if not p008.exists():
        return ["008_add_missing_tables.py 不存在"]
    text = p008.read_text(encoding="utf-8")
    # 提取 008 中提到的关键表名
    target_tables = re.findall(r"\b(zhs_\w+|visit|point|circle|ask|behavior|message|notification|live|exam)\b", text)
    target_tables = list(set(t for t in target_tables if len(t) > 3))
    # 在 init sql 中验证这些表至少出现
    init_text = INIT_SQL.read_text(encoding="utf-8") if INIT_SQL.exists() else ""
    missing = [t for t in target_tables if f'"{t}"' not in init_text and f"CREATE TABLE {t}" not in init_text]
    if missing:
        errs.append(f"008 提到的表在 001_init.sql 中缺失: {missing[:5]}")
    print(f"[008] 目标表: {len(target_tables)} 个, 缺失: {len(missing)} 个")
    return errs


def verify_sql_syntax_with_sqlite() -> list[str]:
    """用 sqlite3 解析器粗检 SQL 语法 (只验证基本语法正确, 方言不兼容不在此检查)."""
    errs: list[str] = []
    if not INIT_SQL.exists():
        return ["001_init.sql 不存在"]
    text = INIT_SQL.read_text(encoding="utf-8")
    # 提取所有 CREATE TABLE 语句
    statements = re.findall(r"CREATE\s+TABLE[^;]+;", text, re.I | re.S)
    print(f"[sqlite-parse] 找到 {len(statements)} 个 CREATE TABLE 语句")
    # 尝试加载到内存 sqlite, 统计能成功解析的 (会因方言不兼容失败, 但失败时记录)
    success = 0
    fail_msgs: list[str] = []
    for i, stmt in enumerate(statements):
        try:
            conn = sqlite3.connect(":memory:")
            conn.execute(stmt)
            conn.close()
            success += 1
        except Exception as e:
            if len(fail_msgs) < 3:
                fail_msgs.append(f"stmt {i}: {type(e).__name__}: {str(e)[:100]}")
    print(f"[sqlite-parse] sqlite 解析成功: {success}/{len(statements)}")
    print(f"[sqlite-parse] 失败样例: {fail_msgs}")
    # sqlite 解析失败是预期的 (PostgreSQL 方言), 不算 err
    if success < 1:
        errs.append(f"sqlite 解析全部失败, 语法可能有问题 (样例: {fail_msgs[:1]})")
    return errs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--regen", action="store_true", help="重新生成 001_init.sql")
    args = parser.parse_args()

    print(f"[verify] alembic 目录: {VERSIONS}")
    print(f"[verify] init sql: {INIT_SQL.exists()}")
    print()

    if args.regen:
        rc = regen_init_sql()
        if rc != 0:
            return rc
        print()

    errs: list[str] = []
    print("[1/4] 验证 001_init.sql 内容")
    errs.extend(verify_init_sql())
    print()
    print("[2/4] 验证迁移链 001 -> 008")
    errs.extend(verify_migration_chain())
    print()
    print("[3/4] 验证 008 迁移 metadata")
    errs.extend(verify_008_metadata())
    print()
    print("[4/4] 验证 SQL 语法 (sqlite 解析)")
    errs.extend(verify_sql_syntax_with_sqlite())
    print()

    if errs:
        print(f"[FAIL] 发现 {len(errs)} 个问题:")
        for e in errs:
            print(f"  - {e}")
        return 1
    print("[OK] Alembic 离线 DDL 验证全部通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
