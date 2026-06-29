"""create admin_tenant table (建议 102 阶段 1).

多租户改造: public schema 下建 admin_tenant 元数据表 + seed default tenant=1.
该表跨租户共享 (admin / 内部管理使用), 不在 tenant_{tid} 内.

Revision ID: 005_create_tenant_metadata
Revises: 004_add_user_uuid
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "005_create_tenant_metadata"
down_revision = "004_add_user_uuid"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """建 public.admin_tenant 表 + seed default tenant=1."""

    # 1. 建表 (IF NOT EXISTS 兼容已存在)
    try:
        op.create_table(
            "admin_tenant",
            sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True,
                       comment="租户 ID (1, 2, 3 ...)"),
            sa.Column("code", sa.String(64), nullable=False, unique=True,
                       comment="租户 code (default / acme / globex)"),
            sa.Column("name", sa.String(128), nullable=False,
                       comment="租户显示名"),
            sa.Column("schema_name", sa.String(64), nullable=False, unique=True,
                       comment="PG schema 名 (tenant_1, tenant_2 ...)"),
            sa.Column("status", sa.SmallInteger, nullable=False, server_default="1",
                       comment="1=active, 0=disabled"),
            sa.Column("created_at", sa.TIMESTAMP, server_default=sa.func.current_timestamp()),
            sa.Column("updated_at", sa.TIMESTAMP, server_default=sa.func.current_timestamp(),
                       onupdate=sa.func.current_timestamp()),
            comment="租户元数据 (public schema, 跨租户共享)",
        )
    except Exception as e:
        if "already exists" not in str(e).lower():
            raise

    # 2. 索引
    try:
        op.create_index("idx_admin_tenant_status", "admin_tenant", ["status"])
    except Exception:
        pass

    # 3. Seed default tenant=1
    try:
        # PostgreSQL: ON CONFLICT DO NOTHING
        op.execute(
            sa.text(
                "INSERT INTO admin_tenant (id, code, name, schema_name, status) "
                "VALUES (1, 'default', 'Default Tenant', 'tenant_1', 1) "
                "ON CONFLICT (id) DO NOTHING"
            )
        )
    except Exception as e:
        if "duplicate" not in str(e).lower() and "unique" not in str(e).lower():
            # seed 重复是正常 (重跑迁移), 不抛
            pass


def downgrade() -> None:
    """删除 public.admin_tenant 表."""
    try:
        op.drop_index("idx_admin_tenant_status", table_name="admin_tenant")
    except Exception:
        pass
    try:
        op.drop_table("admin_tenant")
    except Exception:
        pass
