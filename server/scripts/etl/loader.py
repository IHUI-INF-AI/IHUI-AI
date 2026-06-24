"""ETL 装载器 - 写入 G 盘 PostgreSQL."""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import inspect, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.engine import Engine

from app.database import ENGINES
from scripts.etl.config import MigrationTask

logger = logging.getLogger(__name__)


def _engine_for_table(table_name: str) -> Engine:
    """根据 G 盘表名选 engine (按 schema/库 路由)."""
    # zhs_center_project (engine2)
    center_tables = {
        "users", "user_margin", "user_auth_info", "user_third_party_accounts",
        "user_sk_info", "oauth_apps", "oauth_sessions", "oauth_users",
        "oauth_private_keys", "sys_user_post",
    }
    # zhs_educational_training (engine3)
    course_tables = {
        "zhs_course", "zhs_course_video", "zhs_course_audit", "zhs_course_pay",
        "zhs_course_pay_log", "zhs_course_platform_log", "zhs_education_platform",
        "zhs_educational_course", "zhs_category_dictionary", "zhs_identity",
        "zhs_organization", "zhs_user_comment_log", "zhs_user_video_comment",
        "zhs_user_video_log", "zhs_user_platform", "zhs_course_temp",
        "zhs_course_video_temp",
    }
    if table_name in center_tables:
        return ENGINES["center"]
    if table_name in course_tables:
        return ENGINES["course"]
    return ENGINES["ai"]


def _validate_columns(task: MigrationTask, row: dict[str, Any], engine: Engine) -> dict[str, Any]:
    """过滤掉 G 盘目标表不存在的字段 (容错)."""
    insp = inspect(engine)
    try:
        valid_cols = {c["name"] for c in insp.get_columns(task.target_table)}
    except Exception:
        return row
    if not valid_cols:
        return row
    return {k: v for k, v in row.items() if k in valid_cols}


def load_batch(
    task: MigrationTask,
    rows: list[dict[str, Any]],
) -> int:
    """批量装载到 G 盘 (upsert on conflict).

    返回实际写入行数.
    """
    if not rows:
        return 0
    engine = _engine_for_table(task.target_table)
    # 字段白名单过滤
    rows = [_validate_columns(task, r, engine) for r in rows]
    # 取首行做字段参考
    cols = list(rows[0].keys())
    table = task.target_table

    placeholders = ", ".join(f":{c}" for c in cols)
    update_cols = ", ".join(f"{c}=EXCLUDED.{c}" for c in cols if c != "id")
    sql = text(
        f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({placeholders}) "
        f"ON CONFLICT (id) DO UPDATE SET {update_cols}"
    )

    with engine.begin() as conn:
        result = conn.execute(sql, rows)
    return result.rowcount or len(rows)
