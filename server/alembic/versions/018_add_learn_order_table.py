"""add learn_order table (学习模块订单)

Revision ID: 018_add_learn_order_table
Revises: 017_add_ai_education_and_github_tables
Create Date: 2026-06-28

新增 1 张表: learn_order (学习模块订单).
字段: order_no/member_id/lesson_id/amount/status/pay_type/invoice_title/invoice_status.
"""
import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "018_add_learn_order_table"
down_revision = "017_add_ai_education_and_github_tables"
branch_labels = None
depends_on = None


def _bigint_pk():
    """PostgreSQL BIGINT 主键, SQLite 用 INTEGER 走 rowid."""
    return sa.Integer().with_variant(sa.BigInteger(), "postgresql")


def upgrade() -> None:
    # 008_add_missing_tables 的 Base.metadata.create_all(checkfirst=True) 会按
    # 当前 metadata 预建 learn 表 (learn_models 已注册 LearnOrder), 导致本迁移
    # op.create_table 报 "already exists". 对已存在的表跳过建表与建索引, 兼容
    # SQLite 开发环境与全新 PostgreSQL 环境, 不影响已有生产环境.
    _pre = set(inspect(op.get_bind()).get_table_names())

    def _ct(name, *cols, **kw):
        if name not in _pre:
            op.create_table(name, *cols, **kw)

    def _ci(name, table, cols, **kw):
        if table not in _pre:
            op.create_index(name, table, cols, **kw)

    # learn_order
    _ct(
        "learn_order",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("order_no", sa.String(64), nullable=False, comment="订单号"),
        sa.Column("member_id", sa.String(64), nullable=False, comment="用户id"),
        sa.Column("lesson_id", sa.BigInteger, nullable=True, comment="课程id"),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False, server_default="0", comment="金额"),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pending",
            comment="状态: pending/paid/cancelled/refunded",
        ),
        sa.Column("pay_type", sa.String(20), nullable=True, comment="支付方式: wechat/alipay"),
        sa.Column("invoice_title", sa.String(255), nullable=True, comment="发票抬头"),
        sa.Column(
            "invoice_status",
            sa.String(20),
            nullable=False,
            server_default="none",
            comment="发票状态: none/pending/issued",
        ),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("order_no", name="uq_learn_order_order_no"),
    )
    _ci("idx_learn_order_member", "learn_order", ["member_id"])
    _ci("idx_learn_order_status", "learn_order", ["status"])


def downgrade() -> None:
    op.drop_table("learn_order")
