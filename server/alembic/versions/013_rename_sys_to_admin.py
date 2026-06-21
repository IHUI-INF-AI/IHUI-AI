"""将 sys_* 表重命名为 admin_* (统一命名空间, 远离 RuoYi/Java 命名).

Revision ID: 013_rename_sys_to_admin
Revises: 012_add_missing_indexes
Create Date: 2026-06-21
"""
from alembic import op
from sqlalchemy import inspect


revision = "013_rename_sys_to_admin"
down_revision = "012_add_missing_indexes"
branch_labels = None
depends_on = None


# 18 张表: sys_models.py 16 张 + identity_models.sys_user_post 1 张 + 005.sys_tenant 1 张
TABLES = [
    "sys_user",
    "sys_role",
    "sys_menu",
    "sys_dept",
    "sys_dict_type",
    "sys_dict_data",
    "sys_config",
    "sys_logininfor",
    "sys_oper_log",
    "sys_user_role",
    "sys_role_menu",
    "sys_role_dept",
    "sys_user_post",
    "sys_notice",
    "sys_post",
    "sys_job",
    "sys_job_log",
    "sys_tenant",
]


def _existing_tables() -> set:
    """获取当前数据库中已存在的表名集合."""
    bind = op.get_bind()
    inspector = inspect(bind)
    return set(inspector.get_table_names())


def upgrade() -> None:
    """18 张 sys_* 表 RENAME 为 admin_*, 索引自动跟随.

    若 admin_* 已存在 (如 008 create_all 已建), 则删除冗余的 sys_* 表.
    """
    existing = _existing_tables()
    for old in TABLES:
        new = old.replace("sys_", "admin_", 1)
        if old not in existing:
            continue
        if new in existing:
            # 目标表已存在 (008 create_all 已建), 删除冗余的源表
            op.execute(f'DROP TABLE IF EXISTS "{old}"')
        else:
            op.execute(f'ALTER TABLE "{old}" RENAME TO "{new}"')


def downgrade() -> None:
    """回滚: admin_* → sys_*."""
    existing = _existing_tables()
    for old in reversed(TABLES):
        new = old.replace("sys_", "admin_", 1)
        if new not in existing:
            continue
        if old in existing:
            op.execute(f'DROP TABLE IF EXISTS "{new}"')
        else:
            op.execute(f'ALTER TABLE "{new}" RENAME TO "{old}"')
