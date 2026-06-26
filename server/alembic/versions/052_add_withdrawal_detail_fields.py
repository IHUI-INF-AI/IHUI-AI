"""add withdrawal detail fields

Revision ID: 052_add_withdrawal_detail_fields
Revises: 051_add_missing_tables
Create Date: 2026-06-26

为 zhs_agent_withdrawal_detail 补 5 个字段:
  - review_remark     审核备注
  - process_remark    处理备注
  - transaction_id    微信付款交易号
  - failure_reason    失败原因
  - deleted_at        软删除时间

历史项目这些字段以 JSON 形式存入 wechat_msg 列, 现拆为独立列提升查询效率.
迁移幂等: 使用 inspect 检查字段是否存在, 跳过已存在字段; COMMENT 仅 PostgreSQL 执行.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "052_add_withdrawal_detail_fields"
down_revision = "051_add_missing_tables"
branch_labels = None
depends_on = None

TABLE = "zhs_agent_withdrawal_detail"

# (字段名, 类型, 注释)
NEW_COLUMNS = [
    ("review_remark", sa.String(length=500), "审核备注 (review 阶段)"),
    ("process_remark", sa.String(length=500), "处理备注 (process 阶段)"),
    ("transaction_id", sa.String(length=64), "微信付款交易号 (process 阶段回填)"),
    ("failure_reason", sa.String(length=500), "失败原因 (process 失败时回填)"),
    ("deleted_at", sa.DateTime(), "软删除时间 (NULL=未删除)"),
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()
    if TABLE not in existing_tables:
        # 表不存在则跳过 (由 AUTO_CREATE_SCHEMA 或 051 迁移负责建表)
        return

    existing_columns = [col["name"] for col in inspector.get_columns(TABLE)]
    dialect = bind.dialect.name

    for col_name, col_type, col_comment in NEW_COLUMNS:
        if col_name in existing_columns:
            continue
        op.add_column(
            TABLE,
            sa.Column(col_name, col_type, nullable=True, comment=col_comment),
        )
        # PostgreSQL 补 COMMENT (add_column 的 comment 参数在部分方言不生效, 显式补)
        if dialect != "sqlite":
            try:
                col_type_sql = "VARCHAR(500)" if "String" in str(col_type) and col_name != "transaction_id" else (
                    "VARCHAR(64)" if col_name == "transaction_id" else "DATETIME"
                )
                op.execute(
                    f'COMMENT ON COLUMN {TABLE}.{col_name} IS \'{col_comment}\''
                )
            except Exception as e:
                # COMMENT 失败不阻断迁移 (不同 PostgreSQL 版本语法差异)
                print(f"[052] COMMENT on {TABLE}.{col_name} skipped: {e}")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()
    if TABLE not in existing_tables:
        return

    existing_columns = [col["name"] for col in inspector.get_columns(TABLE)]
    for col_name, _, _ in reversed(NEW_COLUMNS):
        if col_name in existing_columns:
            op.drop_column(TABLE, col_name)
