"""P1-1 索引迁移脚本: 为 Top 20 高频查询字段补齐索引.

执行方式:
  1. python -m scripts.add_missing_indexes              # 应用到默认 DB
  2. python -m scripts.add_missing_indexes --dry-run   # 只检查不执行
  3. 启动时自动执行 (main.py 调用 run_db_index_migration)
"""
from __future__ import annotations

import logging
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

logger = logging.getLogger(__name__)

# Top 20 高优先级缺失索引 (按 INDEX_AUDIT 报告)
# 格式: (表名, 索引名, 字段列表)
TOP20_INDEXES = [
    # 1. users 核心用户表 - status, parent_id (推荐关系)
    ("users", "ix_users_status", ["status"]),
    ("users", "ix_users_parent_id", ["parent_id"]),
    # 2. zhs_order 订单 - user_id, status
    ("zhs_order", "ix_zhs_order_user_id", ["user_id"]),
    ("zhs_order", "ix_zhs_order_status", ["status"]),
    # 3. video_generation_tasks - status
    ("video_generation_tasks", "ix_video_gen_tasks_status", ["status"]),
    # 4. zhs_agent_examine - status
    ("zhs_agent_examine", "ix_zhs_agent_examine_status", ["status"]),
    # 5. zhs_commission_flow - user_id, status
    ("zhs_commission_flow", "ix_zhs_commission_flow_user_id", ["user_id"]),
    ("zhs_commission_flow", "ix_zhs_commission_flow_status", ["status"]),
    # 6. zhs_withdrawal_flow - user_id, status
    ("zhs_withdrawal_flow", "ix_zhs_withdrawal_flow_user_id", ["user_id"]),
    ("zhs_withdrawal_flow", "ix_zhs_withdrawal_flow_status", ["status"]),
    # 7. zhs_course_pay - status
    ("zhs_course_pay", "ix_zhs_course_pay_status", ["status"]),
    # 8. zhs_course_video - status
    ("zhs_course_video", "ix_zhs_course_video_status", ["status"]),
    # 9. zhs_information - status
    ("zhs_information", "ix_zhs_information_status", ["status"]),
    # 10. zhs_official_information - status
    ("zhs_official_information", "ix_zhs_official_information_status", ["status"]),
    # 11. zhs_popular_courses - status
    ("zhs_popular_courses", "ix_zhs_popular_courses_status", ["status"]),
    # 12. zhs_product - status
    ("zhs_product", "ix_zhs_product_status", ["status"]),
    # 13. zhs_user_video_comment - parent_id, status
    ("zhs_user_video_comment", "ix_zhs_user_video_comment_parent_id", ["parent_id"]),
    ("zhs_user_video_comment", "ix_zhs_user_video_comment_status", ["status"]),
    # 14. zhs_organization - parent_id, status
    ("zhs_organization", "ix_zhs_organization_parent_id", ["parent_id"]),
    ("zhs_organization", "ix_zhs_organization_status", ["status"]),
    # 15. zhs_agent_withdrawal_detail - status
    ("zhs_agent_withdrawal_detail", "ix_zhs_agent_withdrawal_detail_status", ["status"]),
    # 16. zhs_agent_buy - status
    ("zhs_agent_buy", "ix_zhs_agent_buy_status", ["status"]),
    # 17. zhs_identity - status
    ("zhs_identity", "ix_zhs_identity_status", ["status"]),
    # 18. agents - user_id
    ("agents", "ix_agents_user_id", ["user_id"]),
    # 19. vip_level - status
    ("vip_level", "ix_vip_level_status", ["status"]),
    # 20. user_vip - status
    ("user_vip", "ix_user_vip_status", ["status"]),
]


@contextmanager
def _connect_sqlite(db_path: str):
    conn = sqlite3.connect(db_path, timeout=10.0)
    try:
        yield conn
    finally:
        conn.close()


def _connect_pg(db_url: str):
    """连接 PostgreSQL. 返回 (conn, dialect)."""
    if db_url.startswith("postgresql") or db_url.startswith("postgres"):
        try:
            import psycopg2
        except ImportError:
            raise RuntimeError("psycopg2 未安装, 无法迁移 PostgreSQL")
        conn = psycopg2.connect(db_url)
        return conn, "postgres"
    else:
        raise ValueError(f"不支持的 db_url (仅支持 PostgreSQL): {db_url}")


def _ensure_index_sqlite(db_path: str, table: str, index_name: str, columns: list[str]) -> str:
    """SQLite: CREATE INDEX IF NOT EXISTS. 返回 'created' / 'exists' / 'table_missing'."""
    cols_csv = ", ".join(columns)
    with _connect_sqlite(db_path) as conn:
        # 先检查表是否存在
        tbl = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        ).fetchone()
        if not tbl:
            return "table_missing"
        # 检查索引是否已存在
        cur = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
            (index_name,),
        )
        if cur.fetchone():
            return "exists"
        conn.execute(f'CREATE INDEX IF NOT EXISTS "{index_name}" ON "{table}" ({cols_csv})')
        conn.commit()
        return "created"


def _ensure_index_pg(conn, dialect: str, table: str, index_name: str, columns: list[str]) -> str:
    """PostgreSQL: CREATE INDEX IF NOT EXISTS. 返回 'created' / 'exists' / 'table_missing'."""
    cols_csv = ", ".join(f'"{c}"' for c in columns)
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT to_regclass(%s)", (f'public."{table}"',)
        )
        if not cur.fetchone()[0]:
            return "table_missing"
        cur.execute(
            "SELECT 1 FROM pg_indexes WHERE indexname=%s",
            (index_name,),
        )
        if cur.fetchone():
            return "exists"
        cur.execute(f'CREATE INDEX IF NOT EXISTS "{index_name}" ON "{table}" ({cols_csv})')
        conn.commit()
        return "created"
    except Exception as e:
        msg = str(e).lower()
        if "duplicate" in msg or "exists" in msg or "already" in msg:
            return "exists"
        raise


def run_db_index_migration(dry_run: bool = False) -> dict:
    """执行 Top 20 索引迁移.

    Returns: {"created": int, "exists": int, "skipped": int, "errors": list}
    """
    db_url = os.environ.get("DATABASE_URL", "")
    db_path = os.environ.get("DB_FALLBACK_PATH", "") or str(Path.cwd() / ".zhs_db_fallback.sqlite")

    created = 0
    exists = 0
    skipped = 0
    errors = []
    use_sqlite = (not db_url) or db_url.startswith("sqlite")

    for table, index_name, columns in TOP20_INDEXES:
        try:
            if dry_run:
                logger.info(f"[DRY-RUN] would create {index_name} on {table}({', '.join(columns)})")
                continue
            if use_sqlite:
                r = _ensure_index_sqlite(db_path, table, index_name, columns)
            else:
                conn, dialect = _connect_pg(db_url)
                try:
                    r = _ensure_index_pg(conn, dialect, table, index_name, columns)
                finally:
                    conn.close()
            if r == "created":
                created += 1
                logger.info(f"✓ created {index_name} on {table}({', '.join(columns)})")
            elif r == "exists":
                exists += 1
            elif r == "table_missing":
                skipped += 1
                logger.debug(f"⊘ skipped {index_name} on {table} (table not yet created)")
        except Exception as e:
            errors.append((table, index_name, str(e)))
            logger.warning(f"✗ failed to create {index_name} on {table}: {e}")

    return {
        "created": created,
        "exists": exists,
        "skipped": skipped,
        "errors": errors,
        "total": len(TOP20_INDEXES),
    }


if __name__ == "__main__":
    import sys
    dry = "--dry-run" in sys.argv
    result = run_db_index_migration(dry_run=dry)
    print(f"\n=== 索引迁移完成 ===")
    print(f"目标: {result['total']} 条")
    print(f"新建: {result['created']}")
    print(f"已存在: {result['exists']}")
    print(f"跳过(表不存在): {result.get('skipped', 0)}")
    print(f"失败: {len(result['errors'])}")
    if result["errors"]:
        for t, n, e in result["errors"]:
            print(f"  - {t}.{n}: {e}")
