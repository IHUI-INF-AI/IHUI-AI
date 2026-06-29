"""添加管理后台 3 张表 (admin_product, admin_faq, admin_activity)

Revision ID: 011_admin_tables
Revises: 010
Create Date: 2026-06-18
"""
from alembic import op
import sqlalchemy as sa


revision = "011_admin_tables"
down_revision = "010_add_ai_model_unify"
branch_labels = None
depends_on = None


def _auto_inc(column: str) -> str:
    """SQLite/PostgreSQL 自增主键语法统一."""
    dialect = op.get_bind().dialect.name
    if dialect == "sqlite":
        return f"INTEGER PRIMARY KEY AUTOINCREMENT"
    return f"BIGSERIAL PRIMARY KEY"


def upgrade() -> None:
    """创建 admin_product / admin_faq / admin_activity 3 张表."""
    # admin_product
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS admin_product (
            id {_auto_inc("id")},
            name VARCHAR(200) NOT NULL,
            image VARCHAR(500) DEFAULT '',
            type VARCHAR(32) DEFAULT 'general',
            price INTEGER DEFAULT 0,
            stock INTEGER DEFAULT 0,
            sales INTEGER DEFAULT 0,
            status VARCHAR(16) DEFAULT 'active',
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            deleted_at TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_admin_product_status ON admin_product (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_admin_product_deleted_at ON admin_product (deleted_at)")

    # admin_faq
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS admin_faq (
            id {_auto_inc("id")},
            question VARCHAR(500) NOT NULL,
            answer TEXT DEFAULT '',
            category VARCHAR(64) DEFAULT 'general',
            is_top BOOLEAN DEFAULT FALSE,
            status VARCHAR(16) DEFAULT 'active',
            views INTEGER DEFAULT 0,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            deleted_at TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_admin_faq_category ON admin_faq (category)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_admin_faq_deleted_at ON admin_faq (deleted_at)")

    # admin_activity
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS admin_activity (
            id {_auto_inc("id")},
            user_id VARCHAR(64) DEFAULT '',
            user_name VARCHAR(64) DEFAULT '',
            type VARCHAR(32) DEFAULT 'other',
            status VARCHAR(16) DEFAULT 'success',
            ip VARCHAR(64) DEFAULT '',
            device VARCHAR(200) DEFAULT '',
            description VARCHAR(500) DEFAULT '',
            created_at TIMESTAMP,
            updated_at TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_admin_activity_type ON admin_activity (type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_admin_activity_user_id ON admin_activity (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_admin_activity_created_at ON admin_activity (created_at)")


def downgrade() -> None:
    """删除 3 张表."""
    op.execute("DROP TABLE IF EXISTS admin_activity")
    op.execute("DROP TABLE IF EXISTS admin_faq")
    op.execute("DROP TABLE IF EXISTS admin_product")
