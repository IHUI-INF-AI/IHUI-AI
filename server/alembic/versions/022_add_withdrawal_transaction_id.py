"""add transaction_id to zhs_agent_withdrawal_detail

Revision ID: 022_add_withdrawal_transaction_id
Revises: 021_add_order_item_payment_tables
Create Date: 2026-06-28

为 zhs_agent_withdrawal_detail 表新增 transaction_id 列,
用于记录第三方支付平台的交易流水号.

背景: Round 22 扩展 AgentWithdrawalDetail 模型, 配合提现处理
端点写入第三方支付回调返回的交易流水号.
"""
import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "022_add_withdrawal_transaction_id"
down_revision = "021_add_order_item_payment_tables"
branch_labels = None
depends_on = None


def _has_column(bind, table, column):
    try:
        insp = inspect(bind)
        if table not in insp.get_table_names():
            return False
        return column in {c["name"] for c in insp.get_columns(table)}
    except Exception:
        return False


def upgrade() -> None:
    bind = op.get_bind()
    table = "zhs_agent_withdrawal_detail"

    if not _has_column(bind, table, "transaction_id"):
        op.add_column(
            table,
            sa.Column(
                "transaction_id",
                sa.String(64),
                nullable=True,
                comment="第三方支付平台交易流水号",
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    table = "zhs_agent_withdrawal_detail"

    if _has_column(bind, table, "transaction_id"):
        op.drop_column(table, "transaction_id")
