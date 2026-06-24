"""Add t_lecturer table for lecturer management.

迁移自 edu server t_lecturer 表 (H:\\edu client\\fix_lecturer_table.sql).
字段: name, job_title, mobile, description, image, user_id + 时间戳.

注意: 部分环境可能已通过 001_init.sql 初始化脚本创建了该表,
      此处使用 inspect 检查表是否存在, 避免重复创建报错.

Revision ID: 045_add_lecturer
Revises: 044_edu_cleanup
Create Date: 2026-06-24
"""
import logging

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision = "045_add_lecturer"
down_revision = "044_edu_cleanup"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.045_add_lecturer")


def upgrade() -> None:
    """创建 t_lecturer 讲师表 (若不存在)."""
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if "t_lecturer" in existing_tables:
        logger.info("045_add_lecturer: t_lecturer 表已存在, 跳过创建")
        # 检查索引是否存在, 不存在则补建
        existing_indexes = [idx["name"] for idx in inspector.get_indexes("t_lecturer")]
        if "idx_lecturer_user" not in existing_indexes:
            op.create_index("idx_lecturer_user", "t_lecturer", ["user_id"])
            logger.info("045_add_lecturer: 补建索引 idx_lecturer_user")
        return

    logger.info("045_add_lecturer: creating t_lecturer table")
    op.create_table(
        "t_lecturer",
        sa.Column(
            "id",
            sa.Integer().with_variant(sa.BigInteger(), "postgresql"),
            primary_key=True,
            autoincrement=True,
            comment="主键id",
        ),
        sa.Column("name", sa.String(100), nullable=True, comment="讲师姓名"),
        sa.Column("job_title", sa.String(255), nullable=True, comment="头衔"),
        sa.Column("mobile", sa.String(50), nullable=True, comment="联系电话"),
        sa.Column("description", sa.Text(), nullable=True, comment="介绍"),
        sa.Column("image", sa.String(500), nullable=True, comment="头像"),
        sa.Column("user_id", sa.BigInteger(), nullable=True, comment="用户ID"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=True,
            comment="创建时间",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=True,
            comment="更新时间",
        ),
        comment="讲师表 (迁移自 edu server t_lecturer)",
    )

    op.create_index("idx_lecturer_user", "t_lecturer", ["user_id"])
    logger.info("045_add_lecturer: t_lecturer table created")


def downgrade() -> None:
    """删除 t_lecturer 讲师表."""
    logger.info("045_add_lecturer: dropping t_lecturer table")
    bind = op.get_bind()
    inspector = inspect(bind)
    if "t_lecturer" in inspector.get_table_names():
        existing_indexes = [idx["name"] for idx in inspector.get_indexes("t_lecturer")]
        if "idx_lecturer_user" in existing_indexes:
            op.drop_index("idx_lecturer_user", table_name="t_lecturer")
        op.drop_table("t_lecturer")
