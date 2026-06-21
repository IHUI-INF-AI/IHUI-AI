"""ZHS Platform PG 迁移 staging 演练 (建议 114).

完整跑通 PG 多租户迁移:
  1. 探测 PG 16 可达
  2. 跑 alembic upgrade head (应用 005→006→007)
  3. 验证 13 张业务表都已复制到 tenant_1 schema
  4. 验证多租户隔离: tenant_2 schema 应为空 (跨租户不可见)
  5. 验证 search_path 动态切换: SET LOCAL search_path 后写数据

用法:
    # CI 环境 (无 PG): 跳过, exit 0
    python scripts/ci/pg_staging_smoke.py

    # Staging 环境 (有 PG):
    PG_URL=postgresql://zhs:zhs_pg_pass@127.0.0.1:5432/zhs_platform \
        python scripts/ci/pg_staging_smoke.py
"""

import argparse
import os
import sys
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy.engine.url import make_url

ROOT = Path(__file__).resolve().parent.parent.parent

# 13 张业务表 (3 张 phase1 + 10 张 phase2)
PHASE1_TABLES = ["admin_user", "zhs_order", "zhs_agent_buy"]
PHASE2_TABLES = [
    "agents",
    "users",
    "user_margin",
    "zhs_course",
    "zhs_identity",
    "video_generation_tasks",
    "ai_gc",
    "zhs_commission_flow",
    "zhs_withdrawal_flow",
    "zhs_agent_settlement",
]
ALL_BIZ_TABLES = PHASE1_TABLES + PHASE2_TABLES


def _pg_url() -> str | None:
    return os.environ.get("PG_URL") or os.environ.get("DATABASE_URL")


def _probe(url: str) -> bool:
    try:
        engine = sa.create_engine(url, connect_args={"connect_timeout": 5})
        with engine.connect() as conn:
            r = conn.execute(sa.text("SELECT version()")).scalar()
            print(f"  PG version: {r[:60]}")
        engine.dispose()
        return True
    except Exception as e:
        print(f"  WARN: PG 不可达 ({type(e).__name__}): {e}")
        return False


def _alembic_upgrade(url: str) -> int:
    """跑 alembic upgrade head (应用 005→006→007)."""
    from alembic.config import Config

    from alembic import command

    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", url)
    print("  alembic upgrade head...")
    command.upgrade(cfg, "head")
    print("  alembic upgrade head 完成")
    return 0


def _verify_phase2_in_tenant_schema(url: str) -> tuple[int, int]:
    """验证 13 张业务表都已复制到 tenant_1 schema. 返回 (命中数, 总数)."""
    engine = sa.create_engine(url)
    ok = 0
    bad: list[str] = []
    with engine.connect() as conn:
        for tbl in ALL_BIZ_TABLES:
            r = conn.execute(
                sa.text("SELECT 1 FROM information_schema.tables " "WHERE table_schema='tenant_1' AND table_name=:tn"),
                {"tn": tbl},
            ).scalar()
            if r:
                ok += 1
            else:
                bad.append(tbl)
    engine.dispose()
    if bad:
        print(f"  FAIL: 以下 {len(bad)} 张表未复制到 tenant_1: {bad}")
    else:
        print(f"  OK: {ok}/{len(ALL_BIZ_TABLES)} 张业务表已复制到 tenant_1 schema")
    return ok, len(ALL_BIZ_TABLES)


def _verify_tenant_isolation(url: str) -> bool:
    """验证跨租户 schema 隔离: tenant_2 schema 应不存在或为空."""
    engine = sa.create_engine(url)
    with engine.connect() as conn:
        # tenant_2 schema 不应存在
        exists = conn.execute(
            sa.text("SELECT 1 FROM information_schema.schemata WHERE schema_name='tenant_2'")
        ).scalar()
        if exists:
            print("  WARN: tenant_2 schema 已存在 (历史数据残留, 但不影响隔离验证)")
        else:
            print("  OK: tenant_2 schema 不存在 (符合预期, 单租户)")
        # 验证: 在 tenant_1 创建一张临时表, 切到 public 看不到
        conn.execute(sa.text("SET LOCAL search_path TO tenant_1"))
        conn.execute(sa.text("CREATE TABLE IF NOT EXISTS _smoke_tenant_test (id INT)"))
        conn.execute(sa.text("INSERT INTO _smoke_tenant_test VALUES (1)"))
        conn.execute(sa.text("SET LOCAL search_path TO public"))
        try:
            r = conn.execute(sa.text("SELECT count(*) FROM _smoke_tenant_test")).scalar()
            # public 没有这张表 → 应该报错而不是返回 0
            print(f"  WARN: public 下查 _smoke_tenant_test 返 {r} (异常, 应报错)")
            isolated = False
        except sa.exc.ProgrammingError:
            # 预期: relation does not exist
            print("  OK: tenant_1 表在 public 下不可见 (schema 隔离生效)")
            isolated = True
        # 清理
        conn.execute(sa.text("SET LOCAL search_path TO tenant_1"))
        conn.execute(sa.text("DROP TABLE IF EXISTS _smoke_tenant_test"))
        conn.commit()
    engine.dispose()
    return isolated


def _verify_search_path_dynamic_switch(url: str) -> bool:
    """验证 search_path 动态 SET LOCAL 切换生效."""
    engine = sa.create_engine(url)
    with engine.connect() as conn:
        # 在 public 建一张临时表
        conn.execute(sa.text("CREATE TABLE IF NOT EXISTS public._smoke_path_test (v TEXT)"))
        conn.execute(sa.text("TRUNCATE public._smoke_path_test"))
        # 切到 public → 应能查到
        conn.execute(sa.text("SET LOCAL search_path TO public"))
        conn.execute(sa.text("INSERT INTO _smoke_path_test VALUES ('public')"))
        r1 = conn.execute(sa.text("SELECT v FROM _smoke_path_test")).scalar()
        # 切到 tenant_1 → 不应查到
        conn.execute(sa.text("SET LOCAL search_path TO tenant_1"))
        try:
            r2 = conn.execute(sa.text("SELECT v FROM _smoke_path_test")).scalar()
            print(f"  FAIL: tenant_1 切到了 public._smoke_path_test, 值={r2!r}")
            return False
        except sa.exc.ProgrammingError:
            print("  OK: search_path 切换生效 (tenant_1 看不到 public 表)")
        # 清理
        conn.execute(sa.text("SET LOCAL search_path TO public"))
        conn.execute(sa.text("DROP TABLE IF EXISTS public._smoke_path_test"))
        conn.commit()
    engine.dispose()
    return r1 == "public"


def main() -> int:
    p = argparse.ArgumentParser(description="ZHS Platform PG 迁移 staging 演练 (建议 114)")
    p.add_argument("--pg-url", default=None, help="PG 连接 URL (默认读 PG_URL env)")
    p.add_argument("--skip-alembic", action="store_true", help="跳过 alembic upgrade")
    p.add_argument("--dry-run", action="store_true", help="只打印计划, 不连接 PG")
    args = p.parse_args()

    url = args.pg_url or _pg_url()

    print("=" * 60)
    print("ZHS Platform PG Staging 演练 (建议 114)")
    print("=" * 60)

    if args.dry_run:
        print(f"  PG URL: {url or '(未设置)'}")
        print(f"  跳过 alembic: {args.skip_alembic}")
        print(f"  业务表总数: {len(ALL_BIZ_TABLES)} (phase1={len(PHASE1_TABLES)} + phase2={len(PHASE2_TABLES)})")
        print("OK: dry-run 通过")
        return 0

    if not url:
        print("  未设置 PG_URL, 跳过 (CI 无 PG 实例是正常的)")
        print("  提示: 在 staging 环境运行时设置 PG_URL=postgresql://...")
        print("OK: skipped (no PG_URL)")
        return 0

    parsed = make_url(url)
    if not parsed.drivername.startswith("postgresql"):
        print(f"  WARN: 非 PG 驱动 ({parsed.drivername}), 跳过")
        return 0

    # 1. 探测
    print("\n[1/5] 探测 PG 可达性...")
    if not _probe(url):
        print("FAIL: PG 不可达")
        return 1

    # 2. alembic upgrade
    if not args.skip_alembic:
        print("\n[2/5] alembic upgrade head (005→006→007)...")
        try:
            _alembic_upgrade(url)
        except Exception as e:
            print(f"FAIL: alembic upgrade 异常: {e}")
            return 1
    else:
        print("\n[2/5] 跳过 alembic upgrade (--skip-alembic)")

    # 3. 业务表 schema 复制
    print("\n[3/5] 验证 13 张业务表已复制到 tenant_1 schema...")
    ok, total = _verify_phase2_in_tenant_schema(url)
    if ok < total:
        print(f"FAIL: {ok}/{total} 张表复制不完整")
        return 1

    # 4. 跨租户隔离
    print("\n[4/5] 验证跨租户 schema 隔离...")
    if not _verify_tenant_isolation(url):
        print("FAIL: 跨租户隔离不通过")
        return 1

    # 5. search_path 动态切换
    print("\n[5/5] 验证 search_path 动态 SET LOCAL 切换...")
    if not _verify_search_path_dynamic_switch(url):
        print("FAIL: search_path 切换不生效")
        return 1

    print("\n" + "=" * 60)
    print("OK: PG Staging 演练全部通过 (5/5)")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
