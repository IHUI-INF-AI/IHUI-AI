"""补建 zhs_ai_model_info_unify 表 (LLM 统一配置).

Revision ID: 010_add_ai_model_unify
Revises: 009_migrate_phase3_misc_tables
Create Date: 2026-06-18

原因:
  alembic 008/009 漏建此表, 迁移自 coze_zhs_py 的 LLM 路由 (ws.py / models-unify)
  查询 zhs_ai_model_info_unify 时一直返回空, 需手工 CREATE TABLE.
  本迁移让生产部署从 PG 直接 alembic upgrade head 时, 也能复现该表的 schema.

字段 (来自 app/api/v1/llm/ws.py 的 SQL 引用):
  id, code, type, name, model_code, img, url, access_key,
  task_generation, task_query, quest_type, variables, manufacturer,
  is_gratis, is_del, sort,
  open_desc, model_desc, grass_roots,
  is_new, is_top, is_hot,
  created_at, updated_at

策略:
  CREATE TABLE IF NOT EXISTS (幂等, 可重复执行)
  在 PG / SQLite 双方言上可运行
"""
import logging

from sqlalchemy import inspect, text

from alembic import op

revision = "010_add_ai_model_unify"
down_revision = "009_migrate_phase3_misc_tables"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.010")

TABLE_NAME = "zhs_ai_model_info_unify"


def upgrade() -> None:
    """建表 (幂等)."""
    bind = op.get_bind()
    try:
        op.execute("COMMIT")
    except Exception:  # noqa: BLE001
        pass

    engine = bind.engine if hasattr(bind, "engine") else bind
    try:
        existing = set(inspect(engine).get_table_names())
    except Exception:  # noqa: BLE001
        existing = set()

    if TABLE_NAME in existing:
        logger.info(f"010_add_ai_model_unify: {TABLE_NAME} 已存在, 跳过")
        return

    create_sql = f"""
    CREATE TABLE {TABLE_NAME} (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(100),
        type VARCHAR(50),
        name VARCHAR(200),
        model_code VARCHAR(200),
        img VARCHAR(500),
        url VARCHAR(500),
        access_key VARCHAR(500),
        task_generation TEXT,
        task_query TEXT,
        quest_type VARCHAR(50),
        variables TEXT,
        manufacturer VARCHAR(100),
        is_gratis INTEGER DEFAULT 1,
        is_del INTEGER DEFAULT 0,
        is_new INTEGER DEFAULT 0,
        is_top INTEGER DEFAULT 0,
        is_hot INTEGER DEFAULT 0,
        sort INTEGER DEFAULT 0,
        open_desc TEXT,
        model_desc TEXT,
        grass_roots TEXT,
        created_at DATETIME,
        updated_at DATETIME
    )
    """
    with engine.begin() as conn:
        conn.execute(text(create_sql))
    # 索引
    with engine.begin() as conn:
        for idx_sql in [
            f"CREATE INDEX IF NOT EXISTS idx_{TABLE_NAME}_code ON {TABLE_NAME} (code)",
            f"CREATE INDEX IF NOT EXISTS idx_{TABLE_NAME}_is_del ON {TABLE_NAME} (is_del)",
            f"CREATE INDEX IF NOT EXISTS idx_{TABLE_NAME}_quest_type ON {TABLE_NAME} (quest_type)",
        ]:
            try:
                conn.execute(text(idx_sql))
            except Exception as e:  # noqa: BLE001
                logger.warning(f"  index 跳过: {e}")
    logger.info(f"010_add_ai_model_unify: 已创建 {TABLE_NAME} 表 + 3 索引")


def downgrade() -> None:
    """删表 (生产慎用)."""
    bind = op.get_bind()
    engine = bind.engine if hasattr(bind, "engine") else bind
    with engine.begin() as conn:
        conn.execute(text(f"DROP TABLE IF EXISTS {TABLE_NAME}"))
    logger.info(f"010_add_ai_model_unify: 已删除 {TABLE_NAME}")
