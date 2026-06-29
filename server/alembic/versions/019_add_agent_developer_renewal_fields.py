"""add agent_developer renewal fields (type/count/expiration_date)

Revision ID: 019_add_agent_developer_renewal_fields
Revises: 018_add_learn_order_table
Create Date: 2026-06-28

为 zhs_agent_developer 表新增 3 列, 持久化续费参数:
- type: 收费类型 (monthly/yearly/permanent)
- count: 续费数量 (月/年)
- expiration_date: 开发者到期时间

背景: Round 19 /developer/create 接收续费参数但无法持久化, Round 21 扩展模型.
"""
import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "019_add_agent_developer_renewal_fields"
down_revision = "018_add_learn_order_table"
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
    table = "zhs_agent_developer"

    if not _has_column(bind, table, "type"):
        op.add_column(
            table,
            sa.Column("type", sa.String(20), nullable=True, comment="收费类型: monthly/yearly/permanent"),
        )
    if not _has_column(bind, table, "count"):
        op.add_column(
            table,
            sa.Column("count", sa.Integer, nullable=True, comment="续费数量(月/年)"),
        )
    if not _has_column(bind, table, "expiration_date"):
        op.add_column(
            table,
            sa.Column("expiration_date", sa.DateTime, nullable=True, comment="开发者到期时间"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    table = "zhs_agent_developer"

    if _has_column(bind, table, "expiration_date"):
        op.drop_column(table, "expiration_date")
    if _has_column(bind, table, "count"):
        op.drop_column(table, "count")
    if _has_column(bind, table, "type"):
        op.drop_column(table, "type")
