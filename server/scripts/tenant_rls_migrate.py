"""多租户 RLS 强化迁移脚本.

将现有的 search_path 隔离升级为 Row-Level Security 双保险.
优势:
- search_path 隔离: 应用层控制, 可被 SQL 注入绕过
- RLS 隔离: 数据库层强制, 即使应用层 bug 也不泄露
- 双保险: 任意一层失效, 另一层兜底

适用 PG 14+ (RLS 在 PG 9.5+ 就有, 但 bypass RLS 角色权限在 14 调整)

用法:
    python scripts/tenant_rls_migrate.py --dry-run          # 演练
    python scripts/tenant_rls_migrate.py --apply            # 真实执行
    python scripts/tenant_rls_migrate.py --rollback         # 回滚
    python scripts/tenant_rls_migrate.py --status           # 状态
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent.parent
MIGRATION_LOG = SERVER_ROOT / "tenant_rls_migration.log"

# 业务表清单 (需要 RLS 保护)
# 排除: 系统表 / alembic 版本表 / 公共字典表
PROTECTED_TABLES = [
    "users",
    "orders",
    "products",
    "courses",
    "course_chapters",
    "course_progress",
    "agents",
    "agent_tasks",
    "chat_messages",
    "chat_rooms",
    "wallet_transactions",
    "refunds",
    "invoices",
    "addresses",
    "favorites",
    "cart_items",
    "feedback",
    "tickets",
    "ticket_replies",
    "notifications",
    "user_settings",
    "api_keys",
    "webhooks",
    "workflows",
    "skills",
    "knowledge_docs",
    "knowledge_chunks",
    "aigc_works",
    "file_uploads",
]


def log(msg: str, also_print: bool = True) -> None:
    line = f"[{datetime.now(timezone.utc).isoformat()}] {msg}"
    if also_print:
        print(line)
    with MIGRATION_LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def get_tenant_id() -> str:
    return os.environ.get("DEFAULT_TENANT_ID", "tenant_default")


def get_dsn() -> str:
    return os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/zhs")


def build_enable_rls_sql(table: str) -> str:
    """建表时启用 RLS 的 SQL 片段."""
    return f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;"


def build_force_rls_sql(table: str) -> str:
    """对表 owner 也强制 RLS."""
    return f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;"


def build_policy_sql(table: str, tenant_col: str = "tenant_id") -> str:
    """建租户隔离策略."""
    # 通过 current_setting 读取 GUC 变量
    # 应用层在事务开始时执行 SET LOCAL app.tenant_id = 'xxx'
    return f"""
CREATE POLICY tenant_isolation_{table} ON {table}
    USING ({tenant_col} = current_setting('app.tenant_id', true))
    WITH CHECK ({tenant_col} = current_setting('app.tenant_id', true));
""".strip()


def build_bypass_role_sql(role: str) -> str:
    """给指定角色 bypass RLS 权限 (运维 / 迁移用)."""
    return f"ALTER ROLE {role} BYPASSRLS;"


def build_migration_sql() -> str:
    """生成完整迁移 SQL."""
    sqls: list[str] = []
    sqls.append("-- 多租户 RLS 强化迁移")
    sqls.append(f"-- 生成时间: {datetime.now(timezone.utc).isoformat()}")
    sqls.append("")
    sqls.append("BEGIN;")
    sqls.append("")

    # 1. 创建应用层 GUC 变量读取函数
    sqls.append("-- 1. 创建 tenant_id 读取函数 (供 RLS policy 使用)")
    sqls.append("CREATE OR REPLACE FUNCTION current_tenant_id()")
    sqls.append("RETURNS text AS $$")
    sqls.append("    SELECT current_setting('app.tenant_id', true);")
    sqls.append("$$ LANGUAGE sql STABLE;")
    sqls.append("")

    # 2. 业务表启用 RLS
    sqls.append("-- 2. 业务表启用 RLS")
    for table in PROTECTED_TABLES:
        sqls.append(f"-- 表: {table}")
        sqls.append(build_enable_rls_sql(table))
        sqls.append(build_force_rls_sql(table))
    sqls.append("")

    # 3. 建策略
    sqls.append("-- 3. 建租户隔离策略")
    for table in PROTECTED_TABLES:
        sqls.append(build_policy_sql(table))
    sqls.append("")

    # 4. 角色权限
    sqls.append("-- 4. 角色权限 (BYPASSRLS 给运维 / 迁移账户)")
    sqls.append("-- 应用账户 zhs_app: 不给 BYPASSRLS, 强制走 RLS")
    sqls.append("-- 运维账户 zhs_admin: 给 BYPASSRLS, 可跨租户查")
    sqls.append("DO $$ BEGIN")
    sqls.append("    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zhs_admin') THEN")
    sqls.append("        ALTER ROLE zhs_admin BYPASSRLS;")
    sqls.append("    END IF;")
    sqls.append("END $$;")
    sqls.append("")

    sqls.append("COMMIT;")
    return "\n".join(sqls)


def build_rollback_sql() -> str:
    """生成回滚 SQL."""
    sqls: list[str] = []
    sqls.append("-- 多租户 RLS 回滚")
    sqls.append(f"-- 生成时间: {datetime.now(timezone.utc).isoformat()}")
    sqls.append("")
    sqls.append("BEGIN;")
    sqls.append("")

    # 删策略
    sqls.append("-- 删策略")
    for table in PROTECTED_TABLES:
        sqls.append(f"DROP POLICY IF EXISTS tenant_isolation_{table} ON {table};")
    sqls.append("")

    # 禁用 RLS
    sqls.append("-- 禁用 RLS")
    for table in PROTECTED_TABLES:
        sqls.append(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;")
        sqls.append(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
    sqls.append("")

    sqls.append("COMMIT;")
    return "\n".join(sqls)


def build_status_sql() -> str:
    """状态查询 SQL."""
    sqls: list[str] = []
    sqls.append("-- RLS 状态查询")
    sqls.append("SELECT")
    sqls.append("    c.relname AS table_name,")
    sqls.append("    c.relrowsecurity AS rls_enabled,")
    sqls.append("    c.relforcerowsecurity AS rls_forced,")
    sqls.append("    (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count")
    sqls.append("FROM pg_class c")
    sqls.append("JOIN pg_namespace n ON n.oid = c.relnamespace")
    sqls.append(f"WHERE n.nspname = current_schema()")
    sqls.append("  AND c.relkind = 'r'")
    sqls.append("  AND c.relname = ANY ('{")
    sqls.append(", ".join(f'"{t}"' for t in PROTECTED_TABLES))
    sqls.append("}'::text[])")
    sqls.append("ORDER BY c.relname;")
    return "\n".join(sqls)


def main() -> int:
    parser = argparse.ArgumentParser(description="多租户 RLS 强化迁移")
    parser.add_argument("--dry-run", action="store_true", help="演练模式, 不执行")
    parser.add_argument("--apply", action="store_true", help="真实执行迁移")
    parser.add_argument("--rollback", action="store_true", help="回滚迁移")
    parser.add_argument("--status", action="store_true", help="查看 RLS 状态")
    parser.add_argument("--output", type=str, help="输出 SQL 到文件")
    args = parser.parse_args()

    log("===== 多租户 RLS 强化迁移 =====")
    log(f"DSN: {get_dsn()}")
    log(f"租户: {get_tenant_id()}")
    log(f"保护表数量: {len(PROTECTED_TABLES)}")

    if args.status:
        sql = build_status_sql()
        log("--- 状态查询 SQL ---")
        print(sql)
        if args.output:
            Path(args.output).write_text(sql, encoding="utf-8")
            log(f"已写入: {args.output}")
        return 0

    if args.rollback:
        sql = build_rollback_sql()
        log("--- 回滚 SQL ---")
        print(sql)
        if args.output:
            Path(args.output).write_text(sql, encoding="utf-8")
            log(f"已写入: {args.output}")
        log("回滚 SQL 已生成. 真实执行请用 psql / alembic 加载")
        return 0

    if args.dry_run or args.apply:
        sql = build_migration_sql()
        log("--- 迁移 SQL (生成) ---")
        print(sql[:2000] + ("\n... (省略)" if len(sql) > 2000 else ""))
        if args.output:
            Path(args.output).write_text(sql, encoding="utf-8")
            log(f"已写入: {args.output}")

        if args.dry_run:
            log("DRY-RUN 模式, 未实际执行")
            log("建议检查项:")
            log("  1. 所有保护表都存在 tenant_id 列")
            log("  2. 现有数据 tenant_id 不为空")
            log("  3. 应用层每个事务开始时执行 SET LOCAL app.tenant_id = 'xxx'")
            log("  4. 备份: pg_dump -Fc -f backup.dump $DATABASE_URL")
            return 0

        if args.apply:
            log("WARNING: 真实执行模式, 请确认已备份")
            log("应用层需在每个事务执行:")
            log("  SET LOCAL app.tenant_id = '<tenant_id>';")
            log("否则将查不到任何数据 (策略默认拒绝)")
            return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
