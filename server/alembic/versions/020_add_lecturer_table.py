"""add t_lecturer table (独立讲师实体)

Revision ID: 020_add_lecturer_table
Revises: 019_add_agent_developer_renewal_fields
Create Date: 2026-06-28

新增 1 张表: t_lecturer (独立讲师实体, 历史项目已有).
字段: id/user_id/title/introduction.
索引: idx_lecturer_user on (user_id).
"""
import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "020_add_lecturer_table"
down_revision = "019_add_agent_developer_renewal_fields"
branch_labels = None
depends_on = None


def _bigint_pk():
    """PostgreSQL BIGINT 主键, SQLite 用 INTEGER 走 rowid."""
    return sa.Integer().with_variant(sa.BigInteger(), "postgresql")


def upgrade() -> None:
    # 008_add_missing_tables 的 Base.metadata.create_all(checkfirst=True) 可能按
    # 当前 metadata 预建 t_lecturer 表 (live_ext_models 已注册 Lecturer), 导致本迁移
    # op.create_table 报 "already exists". 对已存在的表跳过建表与建索引, 兼容
    # SQLite 开发环境与全新 PostgreSQL 环境, 不影响已有生产环境.
    _pre = set(inspect(op.get_bind()).get_table_names())

    def _ct(name, *cols, **kw):
        if name not in _pre:
            op.create_table(name, *cols, **kw)

    def _ci(name, table, cols, **kw):
        if table not in _pre:
            op.create_index(name, table, cols, **kw)

    # t_lecturer
    _ct(
        "t_lecturer",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("user_id", sa.BigInteger, nullable=False, comment="用户id"),
        sa.Column("title", sa.String(100), nullable=False, server_default="", comment="头衔"),
        sa.Column("introduction", sa.String(2000), nullable=False, server_default="", comment="介绍"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_lecturer_user", "t_lecturer", ["user_id"])


def downgrade() -> None:
    op.drop_table("t_lecturer")
