"""add missing columns to zhs_agent_need_task

Revision ID: 054_add_agent_need_task_columns
Revises: 053_add_admin_del_flag_and_developer_fields
Create Date: 2026-06-26

修复 zhs_agent_need_task 表 schema 漂移:
  模型 app/api/v1/agent_need_task/agent_need_task.py 扩展了 13 列,
  但表只有 agent_rule_models.py 原始定义的 11 列,
  导致 GET /api/v1/agent-need-task/list 抛 OperationalError → 500.

  缺失列:
    user_name, agent_name, title, description, type, priority, budget,
    developer_id, developer_name, accept_time, complete_time, deliverable, remark

迁移幂等: 用 inspect 检查列是否存在, 跳过已存在列.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "054_add_agent_need_task_columns"
down_revision = "053_add_admin_del_flag_and_developer_fields"
branch_labels = None
depends_on = None

TABLE = "zhs_agent_need_task"

NEW_COLUMNS = [
    ("user_name", sa.String(length=100), "发布者用户名"),
    ("agent_name", sa.String(length=200), "关联 Agent 名称"),
    ("title", sa.String(length=200), "需求标题"),
    ("description", sa.Text(), "需求描述"),
    ("type", sa.String(length=20), "需求类型 (develop/optimize/fix/custom)"),
    ("priority", sa.Integer(), "优先级 (1低 2中 3高)"),
    ("budget", sa.Integer(), "预算(分)"),
    ("developer_id", sa.String(length=64), "认领开发者 ID"),
    ("developer_name", sa.String(length=100), "认领开发者用户名"),
    ("accept_time", sa.DateTime(), "认领时间"),
    ("complete_time", sa.DateTime(), "完成时间"),
    ("deliverable", sa.Text(), "交付物"),
    ("remark", sa.Text(), "备注"),
]


def _add_column_if_missing(table: str, col_name: str, col_type, col_comment: str) -> bool:
    bind = op.get_bind()
    inspector = inspect(bind)
    if table not in inspector.get_table_names():
        return False
    existing_cols = [c["name"] for c in inspector.get_columns(table)]
    if col_name in existing_cols:
        return False
    op.add_column(
        table,
        sa.Column(col_name, col_type, nullable=True, comment=col_comment),
    )
    return True


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    for col_name, col_type, col_comment in NEW_COLUMNS:
        added = _add_column_if_missing(TABLE, col_name, col_type, col_comment)
        if added and dialect != "sqlite":
            try:
                op.execute(
                    f"COMMENT ON COLUMN {TABLE}.{col_name} IS '{col_comment}'"
                )
            except Exception as e:
                print(f"[054] COMMENT on {TABLE}.{col_name} skipped: {e}")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if TABLE not in inspector.get_table_names():
        return
    existing_cols = [c["name"] for c in inspector.get_columns(TABLE)]
    for col_name, _, _ in reversed(NEW_COLUMNS):
        if col_name in existing_cols:
            op.drop_column(TABLE, col_name)
