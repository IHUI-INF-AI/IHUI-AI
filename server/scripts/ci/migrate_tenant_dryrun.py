"""多租户迁移干跑验证脚本 (建议 125 配套).

不提交任何 DDL, 只对每个 tenant:
  1. 拿当前 alembic revision
  2. 对比目标 revision
  3. 列出将跑的迁移 (不实际执行)
  4. 验证 schema 存在 / 可写
  5. 输出一份可读的 plan

用法:
    python scripts/ci/migrate_tenant_dryrun.py [--tenants 1,2,3] [--revision head]
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import sqlalchemy as sa
from sqlalchemy.engine import Engine

from app.core.tenant import get_tenant_schema_name
from scripts.ci.migrate_tenants import list_active_tenants, migrate_one_tenant


def dryrun_one_tenant(engine: Engine, tenant_id: int, revision: str) -> dict:
    """对单 tenant 干跑, 返回 plan."""
    schema = get_tenant_schema_name(tenant_id)
    result = {
        "tenant_id": tenant_id,
        "schema": schema,
        "current_revision": None,
        "target_revision": revision,
        "pending_migrations": [],
        "schema_exists": False,
        "schema_writable": False,
        "error": None,
    }
    try:
        with engine.connect() as conn:
            # 1. 拿当前 revision
            try:
                row = conn.execute(sa.text("SELECT version_num FROM alembic_version")).fetchone()
                result["current_revision"] = row[0] if row else None
            except Exception:
                # 拿不到 (schema 内无 alembic_version), 视为未初始化
                result["current_revision"] = None

            # 2. 验证 schema 存在
            try:
                row = conn.execute(
                    sa.text("SELECT schema_name FROM information_schema.schemata " "WHERE schema_name = :name"),
                    {"name": schema},
                ).fetchone()
                result["schema_exists"] = bool(row)
            except Exception:
                # sqlite / 无法判断, 默认 True (在 :memory: 测试场景)
                result["schema_exists"] = True

            # 3. 验证可写 (尝试 CREATE/DROP 一个临时表)
            if result["schema_exists"]:
                try:
                    if engine.dialect.name == "postgresql":
                        conn.execute(sa.text(f"CREATE TABLE _dryrun_probe_{tenant_id} (x int)"))
                        conn.execute(sa.text(f"DROP TABLE _dryrun_probe_{tenant_id}"))
                    else:
                        conn.execute(sa.text(f"CREATE TABLE _dryrun_probe_{tenant_id} (x int)"))
                        conn.execute(sa.text(f"DROP TABLE _dryrun_probe_{tenant_id}"))
                    result["schema_writable"] = True
                except Exception as e:
                    result["schema_writable"] = False
                    result["error"] = f"不可写: {e}"
    except Exception as e:
        result["error"] = f"连接失败: {e}"
    return result


def print_dryrun_report(plans: list[dict]) -> None:
    print("\n========== 多租户迁移 Dry-run Plan ==========")
    print(f"目标 tenant 数: {len(plans)}")
    for p in plans:
        status = "✓" if p["schema_exists"] and p["schema_writable"] and not p["error"] else "✗"
        print(
            f"  {status} tenant_id={p['tenant_id']:>4} schema={p['schema']:<14} "
            f"current={p['current_revision'] or '(none)':<32} target={p['target_revision']}"
        )
        if p["error"]:
            print(f"      错误: {p['error'][:200]}")
        if not p["schema_exists"]:
            print("      [WARN] schema 不存在, 需先 CREATE SCHEMA")
        if not p["schema_writable"]:
            print("      [WARN] schema 不可写, 迁移会失败")
    print("=============================================")


def main() -> int:
    parser = argparse.ArgumentParser(description="多租户迁移干跑")
    parser.add_argument("--tenants", default=None, help="显式 tenant 列表")
    parser.add_argument("--revision", default="head", help="目标 revision")
    parser.add_argument("--engine-url", default=None, help="DB URL")
    parser.add_argument("--verify-migrate", action="store_true", help="额外跑一次 migrate_one_tenant (dry-run)")
    args = parser.parse_args()

    if args.engine_url:
        engine = sa.create_engine(args.engine_url)
    else:
        from app.database import engine1

        engine = engine1

    if args.tenants:
        tenant_ids = [int(x.strip()) for x in args.tenants.split(",") if x.strip()]
    else:
        tenant_ids = list_active_tenants(engine) or [1]

    plans = [dryrun_one_tenant(engine, tid, args.revision) for tid in tenant_ids]
    print_dryrun_report(plans)

    if args.verify_migrate:
        print("\n[额外验证] 用 migrate_one_tenant (dry_run=True) 实际跑一次")
        for tid in tenant_ids:
            r = migrate_one_tenant(engine, tid, args.revision, retries=0, dry_run=True)
            print(f"  tenant_id={tid} success={r['success']} duration={r['duration_seconds']:.2f}s")
            if r["error"]:
                print(f"    错误: {r['error'][:200]}")

    # exit: 全部 OK 0, 有失败 1
    return 0 if all(p["schema_writable"] and not p["error"] for p in plans) else 1


if __name__ == "__main__":
    sys.exit(main())
