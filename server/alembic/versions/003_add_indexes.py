"""add indexes to high-frequency query columns

- sys_user.dept_id, sys_user.status+del_flag, sys_user.phone
- sys_role.role_key, sys_role.status+del_flag

Revision ID: 003_add_indexes
Revises: 002_admin_job
Create Date: 2026-06-13
"""
from alembic import op

revision = "003_add_indexes"
down_revision = "002_admin_job"


def upgrade() -> None:
    """创建高频查询字段索引. 表不在当前 db 时静默忽略 (CI/sqlite 多库拆分场景)."""
    pairs = [
        ("idx_sys_user_dept", "sys_user", ["dept_id"]),
        ("idx_sys_user_status", "sys_user", ["status", "del_flag"]),
        ("idx_sys_user_phone", "sys_user", ["phone"]),
        ("idx_sys_role_key", "sys_role", ["role_key"]),
        ("idx_sys_role_status", "sys_role", ["status", "del_flag"]),
    ]
    for name, table, cols in pairs:
        try:
            op.create_index(name, table, cols)
        except Exception:
            pass


def downgrade() -> None:
    """删除索引."""
    for name, table in [
        ("idx_sys_user_dept", "sys_user"),
        ("idx_sys_user_status", "sys_user"),
        ("idx_sys_user_phone", "sys_user"),
        ("idx_sys_role_key", "sys_role"),
        ("idx_sys_role_status", "sys_role"),
    ]:
        try:
            op.drop_index(name, table_name=table)
        except Exception:
            pass
