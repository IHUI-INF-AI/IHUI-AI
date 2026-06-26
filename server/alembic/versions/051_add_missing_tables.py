"""Add 4 missing tables: t_reply_comment / t_watch / t_resource_product / t_resource_tag.

迁移自 edu client init_database.sql.
这 4 张表在历史项目中存在, 当前项目 001_init.sql 缺失, 需补建.

兼容: SQLite (开发) / PostgreSQL (生产).
- SQLite: 不支持 COMMENT, 不支持 ON UPDATE CURRENT_TIMESTAMP (用触发器或应用层维护)
- PostgreSQL: 支持 COMMENT, 支持 server_default

幂等: 使用 inspect 检查表是否存在, 已存在则跳过.

Revision ID: 051_add_missing_tables
Revises: 050_fix_zhs_agent_developer_fields
Create Date: 2026-06-26
"""
import logging

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision = "051_add_missing_tables"
down_revision = "050_fix_zhs_agent_developer_fields"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.051_add_missing_tables")


def upgrade() -> None:
    """补建 4 张缺失表 (若不存在)."""
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()
    dialect = bind.dialect.name

    # 1. t_reply_comment — 评论回复表 (二级回复关系)
    if "t_reply_comment" not in existing_tables:
        logger.info("051_add_missing_tables: 创建 t_reply_comment")
        op.create_table(
            "t_reply_comment",
            sa.Column(
                "id",
                sa.Integer().with_variant(sa.BigInteger(), "postgresql"),
                primary_key=True,
                autoincrement=True,
                comment="主键id",
            ),
            sa.Column("comment_id", sa.BigInteger(), nullable=False, comment="评论id"),
            sa.Column(
                "reply_comment_id",
                sa.BigInteger(),
                nullable=False,
                comment="回复评论id (父ID, 回复评论表时值跟评论id相等)",
            ),
            sa.Column("content", sa.String(4000), nullable=False, comment="回复内容"),
            sa.Column("member_id", sa.BigInteger(), nullable=False, comment="当前评论的用户ID"),
            sa.Column("to_member_id", sa.BigInteger(), nullable=False, comment="回复的评论的用户id"),
            sa.Column(
                "created_at",
                sa.DateTime(),
                server_default=sa.func.current_timestamp(),
                nullable=True,
                comment="创建时间",
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                server_default=sa.func.current_timestamp(),
                nullable=True,
                comment="最后修改时间",
            ),
            comment="回复表",
        )
        op.create_index("idx_reply_comment_comment", "t_reply_comment", ["comment_id"])
        op.create_index("idx_reply_comment_member", "t_reply_comment", ["member_id"])
    else:
        logger.info("051_add_missing_tables: t_reply_comment 已存在, 跳过")

    # 2. t_watch — 内容浏览统计表
    if "t_watch" not in existing_tables:
        logger.info("051_add_missing_tables: 创建 t_watch")
        op.create_table(
            "t_watch",
            sa.Column(
                "id",
                sa.Integer().with_variant(sa.BigInteger(), "postgresql"),
                primary_key=True,
                autoincrement=True,
                comment="主键id",
            ),
            sa.Column("topic_id", sa.BigInteger(), nullable=False, comment="主题ID (课程评论/知识评论ID等)"),
            sa.Column("topic_type", sa.String(50), nullable=False, comment="主题类型 (课程评论/知识评论等)"),
            sa.Column("member_id", sa.BigInteger(), nullable=False, comment="用户id"),
            sa.Column("ip_addr", sa.String(200), nullable=False, comment="ip地址"),
            sa.Column(
                "created_at",
                sa.DateTime(),
                server_default=sa.func.current_timestamp(),
                nullable=True,
                comment="创建时间",
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                server_default=sa.func.current_timestamp(),
                nullable=True,
                comment="最后修改时间",
            ),
            comment="浏览",
        )
        op.create_index("idx_watch_topic", "t_watch", ["topic_id", "topic_type"])
        op.create_index("idx_watch_member", "t_watch", ["member_id"])
    else:
        logger.info("051_add_missing_tables: t_watch 已存在, 跳过")

    # 3. t_resource_product — 资源产品表 (历史占位表)
    if "t_resource_product" not in existing_tables:
        logger.info("051_add_missing_tables: 创建 t_resource_product")
        op.create_table(
            "t_resource_product",
            sa.Column(
                "id",
                sa.Integer(),
                primary_key=True,
                autoincrement=True,
            ),
            sa.Column("name", sa.String(255), nullable=True),
            sa.Column("status", sa.String(255), nullable=True),
            sa.Column("image", sa.String(255), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True, comment="创建时间"),
            sa.Column("updated_at", sa.DateTime(), nullable=True, comment="最后修改时间"),
            comment="资源产品表 (历史占位表)",
        )
    else:
        logger.info("051_add_missing_tables: t_resource_product 已存在, 跳过")

    # 4. t_resource_tag — 资源标签表 (历史占位表)
    if "t_resource_tag" not in existing_tables:
        logger.info("051_add_missing_tables: 创建 t_resource_tag")
        op.create_table(
            "t_resource_tag",
            sa.Column(
                "id",
                sa.Integer(),
                primary_key=True,
                autoincrement=True,
            ),
            sa.Column("name", sa.String(255), nullable=True),
            sa.Column("status", sa.String(255), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True, comment="创建时间"),
            sa.Column("updated_at", sa.DateTime(), nullable=True, comment="最后修改时间"),
            comment="资源标签表 (历史占位表)",
        )
    else:
        logger.info("051_add_missing_tables: t_resource_tag 已存在, 跳过")

    logger.info("051_add_missing_tables: 迁移完成")


def downgrade() -> None:
    """删除 4 张补建的表."""
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    for table_name in ["t_resource_tag", "t_resource_product", "t_watch", "t_reply_comment"]:
        if table_name in existing_tables:
            # 先删索引 (如果存在)
            try:
                existing_indexes = [idx["name"] for idx in inspector.get_indexes(table_name)]
                for idx_name in existing_indexes:
                    op.drop_index(idx_name, table_name=table_name)
            except Exception as e:  # noqa: BLE001
                logger.warning("051_add_missing_tables: 删除 %s 索引时出错 (可忽略): %s", table_name, e)
            op.drop_table(table_name)
            logger.info("051_add_missing_tables: 已删除 %s", table_name)
