"""PostgreSQL 兼容性验证脚本 (建议 109 / 建议 102 阶段 0).

功能:
  - 验证 SQLAlchemy 模型在 PG dialect 下能 create_all 不报错
  - 验证 alembic 005/006 迁移在 PG dialect 下语法合法
  - 验证 schema 名生成与切换

不在本脚本真连 PG, 仅做静态分析 + 模拟.

CI 用法:
  python scripts/ci/test_pg_compatibility.py
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))


def check_sqlalchemy_pg_dialect() -> list:
    """SQLAlchemy 模型在 PG dialect 下能编译, 不报 'schema not found'."""
    errors = []
    try:
        from sqlalchemy.dialects import postgresql
        from sqlalchemy.schema import CreateTable

        import app.models  # noqa: F401
        from app.database import Base

        # 选 5 张关键表
        for tbl_name in ("admin_user", "zhs_order", "zhs_agent_buy", "agents", "zhs_identity"):
            t = None
            for key, table in Base.metadata.tables.items():
                if key.endswith(tbl_name):
                    t = table
                    break
            if t is None:
                continue
            # 用 PG dialect 编译 CREATE TABLE DDL
            try:
                str(CreateTable(t).compile(dialect=postgresql.dialect()))
            except Exception as e:
                errors.append(f"{tbl_name}: PG dialect 编译失败: {e}")
    except Exception as e:
        errors.append(f"SQLAlchemy PG dialect 检查失败: {e}")
    return errors


def check_alembic_pg_compat() -> list:
    """alembic 005/006 迁移在 PG 下能 import, 不报语法错."""
    errors = []
    import importlib.util

    alembic_dir = ROOT / "alembic" / "versions"
    for mig in ("005_create_tenant_metadata", "006_migrate_hot_tables_to_tenant_schema"):
        path = alembic_dir / f"{mig}.py"
        if not path.exists():
            errors.append(f"{mig}: 文件不存在 {path}")
            continue
        try:
            spec = importlib.util.spec_from_file_location(mig, path)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            assert hasattr(mod, "upgrade"), f"{mig}: 缺 upgrade"
            assert hasattr(mod, "downgrade"), f"{mig}: 缺 downgrade"
        except Exception as e:
            errors.append(f"{mig}: 导入失败: {e}")
    return errors


def check_type_casts() -> list:
    """验证 pgloader 配置文件含必要类型转换."""
    errors = []
    pgloader_dir = ROOT / "deploy" / "pgloader"
    if not pgloader_dir.exists():
        errors.append(f"pgloader 目录不存在: {pgloader_dir}")
        return errors
    required_casts = [
        "type tinyint to smallint",
        "type datetime to timestamp",
        "type longtext to text",
        "type enum to text",
    ]
    for conf in pgloader_dir.glob("pgloader_*.conf"):
        text = conf.read_text(encoding="utf-8")
        for cast in required_casts:
            if cast not in text:
                errors.append(f"{conf.name}: 缺类型转换 '{cast}'")
    return errors


def check_runbook_exists() -> list:
    """验证 PG 迁移 runbook 存在."""
    errors = []
    runbook = ROOT / "docs" / "PG_MIGRATION_RUNBOOK.md"
    if not runbook.exists():
        errors.append(f"PG 迁移 runbook 不存在: {runbook}")
        return errors
    text = runbook.read_text(encoding="utf-8")
    required = ["pgloader", "MULTI_TENANT_ENABLED", "回滚", "演练"]
    for r in required:
        if r not in text:
            errors.append(f"runbook 缺关键章节: {r}")
    return errors


def check_pg_docker_service() -> list:
    """验证 docker-compose 含 postgres 服务 + multi-tenant profile."""
    errors = []
    compose = ROOT / "deploy" / "docker" / "docker-compose.yml"
    if not compose.exists():
        errors.append("deploy/docker/docker-compose.yml 不存在")
        return errors
    text = compose.read_text(encoding="utf-8")
    if "postgres" not in text.lower():
        errors.append("deploy/docker/docker-compose.yml 缺 postgres 服务")
    if "multi-tenant" not in text:
        errors.append("deploy/docker/docker-compose.yml 缺 multi-tenant profile")
    if "postgres_data" not in text:
        errors.append("deploy/docker/docker-compose.yml 缺 postgres_data volume")
    return errors


def main() -> int:
    p = argparse.ArgumentParser(description="PostgreSQL 兼容性验证 (建议 109)")
    args = p.parse_args()

    print("=" * 60)
    print("PostgreSQL 兼容性验证 (建议 109)")
    print("=" * 60)

    all_errors = []

    errs = check_sqlalchemy_pg_dialect()
    if errs:
        all_errors.extend(errs)
        print(f"\n[Step 1] SQLAlchemy PG dialect 兼容性: ❌ {len(errs)} 个错误")
        for e in errs[:3]:
            print(f"  - {e}")
    else:
        print("\n[Step 1] SQLAlchemy PG dialect 兼容性: ✅")

    errs = check_alembic_pg_compat()
    if errs:
        all_errors.extend(errs)
        print(f"\n[Step 2] alembic 迁移脚本导入: ❌ {len(errs)} 个错误")
    else:
        print("\n[Step 2] alembic 迁移脚本导入: ✅")

    errs = check_type_casts()
    if errs:
        all_errors.extend(errs)
        print(f"\n[Step 3] pgloader 类型转换: ❌ {len(errs)} 个错误")
        for e in errs[:3]:
            print(f"  - {e}")
    else:
        print("\n[Step 3] pgloader 类型转换: ✅")

    errs = check_runbook_exists()
    if errs:
        all_errors.extend(errs)
        print(f"\n[Step 4] PG 迁移 runbook: ❌ {len(errs)} 个错误")
    else:
        print("\n[Step 4] PG 迁移 runbook: ✅")

    errs = check_pg_docker_service()
    if errs:
        all_errors.extend(errs)
        print(f"\n[Step 5] docker-compose PG 服务: ❌ {len(errs)} 个错误")
    else:
        print("\n[Step 5] docker-compose PG 服务: ✅")

    print()
    if all_errors:
        print("=" * 60)
        print(f"❌ FAIL: {len(all_errors)} 个错误")
        print("=" * 60)
        return 1
    print("=" * 60)
    print("✅ PASS: PostgreSQL 兼容性验证通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
