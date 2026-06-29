"""add order_item / order_payment tables (订单明细)

Revision ID: 021_add_order_item_payment_tables
Revises: 020_add_lecturer_table
Create Date: 2026-06-28

新增 2 张表:
- t_order_item (订单商品): order_id/item_id/title/image/original_price/price/quantity/payment_amount
- t_order_payment (订单支付): order_id/status/channel/amount

历史依据: server/deploy/legacy-archive/sql/init_database.sql (第 3218/3241 行).
"""
import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "021_add_order_item_payment_tables"
down_revision = "020_add_lecturer_table"
branch_labels = None
depends_on = None


def _bigint_pk():
    """PostgreSQL BIGINT 主键, SQLite 用 INTEGER 走 rowid."""
    return sa.Integer().with_variant(sa.BigInteger(), "postgresql")


def upgrade() -> None:
    # Base.metadata.create_all(checkfirst=True) 可能已预建本迁移涉及的表
    # (order_models 已注册 OrderItem/OrderPayment), 导致 op.create_table 报
    # "already exists". 对已存在的表跳过建表与建索引, 兼容 SQLite 开发环境与
    # 全新 PostgreSQL 环境, 不影响已有生产环境.
    _pre = set(inspect(op.get_bind()).get_table_names())

    def _ct(name, *cols, **kw):
        if name not in _pre:
            op.create_table(name, *cols, **kw)

    def _ci(name, table, cols, **kw):
        if table not in _pre:
            op.create_index(name, table, cols, **kw)

    # t_order_item
    _ct(
        "t_order_item",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("order_id", sa.BigInteger, nullable=False, comment="订单id"),
        sa.Column("item_id", sa.String(100), nullable=False, comment="商品id"),
        sa.Column("title", sa.String(500), nullable=False, comment="标题"),
        sa.Column("image", sa.String(2000), nullable=False, comment="图片"),
        sa.Column("original_price", sa.Numeric(14, 2), nullable=False, comment="原价"),
        sa.Column("price", sa.Numeric(14, 2), nullable=False, comment="价格"),
        sa.Column("quantity", sa.Integer, nullable=False, comment="数量"),
        sa.Column("payment_amount", sa.Numeric(14, 2), nullable=False, comment="付款金额"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_order_item_order", "t_order_item", ["order_id"])

    # t_order_payment
    _ct(
        "t_order_payment",
        sa.Column("id", _bigint_pk(), primary_key=True, autoincrement=True, comment="主键id"),
        sa.Column("order_id", sa.BigInteger, nullable=False, comment="订单id"),
        sa.Column("status", sa.String(100), nullable=False, comment="状态"),
        sa.Column("channel", sa.String(100), nullable=False, comment="渠道"),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False, comment="金额"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    _ci("idx_order_payment_order", "t_order_payment", ["order_id"])


def downgrade() -> None:
    op.drop_table("t_order_payment")
    op.drop_table("t_order_item")
