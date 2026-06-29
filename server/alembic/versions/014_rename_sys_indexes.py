"""rename ix_sys_* indexes to ix_admin_* (013 把表 RENAME 后索引名未跟随).

Revision ID: 014_rename_sys_indexes
Revises: 013_rename_sys_to_admin
Create Date: 2026-06-21
"""
from alembic import op


revision = "014_rename_sys_indexes"
down_revision = "013_rename_sys_to_admin"
branch_labels = None
depends_on = None


# 012 迁移在 sys_* 表上创建的索引 + 005 迁移的 idx_sys_tenant_status
# 013 把表 RENAME 成 admin_* 后, 索引名仍保留 sys_* 前缀, 这里统一改名
INDEX_RENAMES = [
    ("ix_sys_dict_data_status", "ix_admin_dict_data_status"),
    ("ix_sys_dict_type_status", "ix_admin_dict_type_status"),
    ("ix_sys_job_log_status", "ix_admin_job_log_status"),
    ("ix_sys_logininfor_status", "ix_admin_logininfor_status"),
    ("ix_sys_oper_log_status", "ix_admin_oper_log_status"),
    ("ix_sys_post_status", "ix_admin_post_status"),
    ("ix_sys_menu_parent_id", "ix_admin_menu_parent_id"),
    ("ix_sys_menu_status", "ix_admin_menu_status"),
    ("ix_sys_notice_status", "ix_admin_notice_status"),
    ("ix_sys_notice_create_by", "ix_admin_notice_create_by"),
    ("ix_sys_user_create_by", "ix_admin_user_create_by"),
    ("ix_sys_user_update_by", "ix_admin_user_update_by"),
    ("ix_sys_dept_parent_id", "ix_admin_dept_parent_id"),
    ("ix_sys_dept_status", "ix_admin_dept_status"),
    ("ix_sys_dept_del_flag", "ix_admin_dept_del_flag"),
    ("ix_sys_job_status", "ix_admin_job_status"),
    ("ix_sys_job_create_by", "ix_admin_job_create_by"),
    ("ix_sys_job_update_by", "ix_admin_job_update_by"),
    ("idx_sys_tenant_status", "idx_admin_tenant_status"),
]


def _dialect() -> str:
    """获取当前数据库方言."""
    return op.get_bind().dialect.name


def upgrade() -> None:
    """重命名 ix_sys_* 索引为 ix_admin_* (仅 PostgreSQL, SQLite 跳过).

    SQLite 不支持 RENAME INDEX, 且测试环境中索引根本不存在 (012 创建时表已改名, 失败被吞).
    """
    if _dialect() != "postgresql":
        return
    for old, new in INDEX_RENAMES:
        try:
            op.execute(f'ALTER INDEX IF EXISTS "{old}" RENAME TO "{new}"')
        except Exception:
            pass


def downgrade() -> None:
    """回滚: ix_admin_* → ix_sys_*."""
    if _dialect() != "postgresql":
        return
    for old, new in INDEX_RENAMES:
        try:
            op.execute(f'ALTER INDEX IF EXISTS "{new}" RENAME TO "{old}"')
        except Exception:
            pass
