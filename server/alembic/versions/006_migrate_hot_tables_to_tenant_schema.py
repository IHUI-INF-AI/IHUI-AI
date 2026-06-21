"""阶段 2 业务表 schema 改造 (建议 108).

3 张最热表: admin_user / zhs_order / zhs_agent_buy.
- 单租户模式: 行为不变, 表仍在默认 schema
- 多租户模式 (PG): 把表从 public 复制到 tenant_1 schema
  - CREATE TABLE tenant_1.xxx (LIKE public.xxx INCLUDING ALL)
  - INSERT INTO tenant_1.xxx SELECT * FROM public.xxx
  - 在 public 保留原表作为回退 (阶段 5 灰度完成后再 DROP)

Revision ID: 006_migrate_hot_tables_to_tenant_schema
Revises: 005_create_tenant_metadata
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "006_migrate_hot_tables_to_tenant_schema"
down_revision = "005_create_tenant_metadata"
branch_labels = None
depends_on = None


# 3 张最热表 (按访问频率 + 数据量排序)
HOT_TABLES = [
    "admin_user",
    "zhs_order",
    "zhs_agent_buy",
]


def upgrade() -> None:
    """PG 多租户模式: 把 3 张表复制到 tenant_1 schema.

    SQLite 模式: 行为不变 (兼容性优先).
    """
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect != "postgresql":
        # SQLite 跳过
        return

    # 1. 创建 tenant_1 schema (若不存在)
    op.execute(sa.text("CREATE SCHEMA IF NOT EXISTS tenant_1"))

    # 2. 把 3 张表复制到 tenant_1 schema
    for table in HOT_TABLES:
        # 检查 public 下表是否存在
        exists = bind.execute(sa.text(
            f"SELECT 1 FROM information_schema.tables "
            f"WHERE table_schema='public' AND table_name=:tn"
        ), {"tn": table}).scalar()
        if not exists:
            continue
        # 目标 schema 下表是否已存在 (重跑迁移容错)
        target_exists = bind.execute(sa.text(
            f"SELECT 1 FROM information_schema.tables "
            f"WHERE table_schema='tenant_1' AND table_name=:tn"
        ), {"tn": table}).scalar()
        if target_exists:
            continue
        # CREATE TABLE LIKE (PG 14+ 支持) - 复制表结构
        op.execute(sa.text(f'CREATE TABLE tenant_1."{table}" (LIKE public."{table}" INCLUDING ALL)'))
        # INSERT 数据
        op.execute(sa.text(f'INSERT INTO tenant_1."{table}" SELECT * FROM public."{table}"'))


def downgrade() -> None:
    """PG: 删 tenant_1 schema 下的 3 张表 (数据从 public 还在)."""
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect != "postgresql":
        return

    for table in HOT_TABLES:
        op.execute(sa.text(f'DROP TABLE IF EXISTS tenant_1."{table}"'))
