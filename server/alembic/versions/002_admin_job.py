"""添加 sys_job / sys_job_log (定时任务调度表, 013 迁移重命名为 admin_job)

Revision ID: 002_admin_job
Revises: 001
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa


revision = "002_admin_job"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """创建 sys_job + sys_job_log 定时任务表.

    SQLite CI 模式: 用 INTEGER PRIMARY KEY AUTOINCREMENT.
    PostgreSQL 生产模式: 用 BIGSERIAL (PG 自增语法).
    """
    dialect = op.get_bind().dialect.name
    if dialect == "sqlite":
        auto_inc = "INTEGER PRIMARY KEY AUTOINCREMENT"
        pk_clause = ""
    else:
        # PostgreSQL 生产模式: 用 BIGSERIAL (PG 自增语法)
        auto_inc = "BIGSERIAL"
        pk_clause = ",\n            PRIMARY KEY (job_id)"

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS sys_job (
            job_id {auto_inc},
            job_name VARCHAR(64) NOT NULL,
            job_group VARCHAR(64) DEFAULT 'DEFAULT',
            invoke_target VARCHAR(500) NOT NULL,
            cron_expression VARCHAR(255) DEFAULT '',
            misfire_policy VARCHAR(20) DEFAULT '3',
            concurrent VARCHAR(1) DEFAULT '1',
            status VARCHAR(1) DEFAULT '0',
            create_by VARCHAR(64) DEFAULT '',
            create_time TIMESTAMP,
            update_by VARCHAR(64) DEFAULT '',
            update_time TIMESTAMP,
            remark VARCHAR(500),
            created_at TIMESTAMP,
            updated_at TIMESTAMP{pk_clause}
        )
    """)
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS sys_job_log (
            job_log_id {auto_inc.replace("job_id", "job_log_id") if "job_id" in auto_inc else auto_inc},
            job_name VARCHAR(64) NOT NULL,
            job_group VARCHAR(64) DEFAULT 'DEFAULT',
            invoke_target VARCHAR(500) NOT NULL,
            status VARCHAR(1) DEFAULT '0',
            error_message VARCHAR(2000) DEFAULT '',
            exception_info VARCHAR(2000) DEFAULT '',
            start_time TIMESTAMP,
            stop_time TIMESTAMP,
            create_time TIMESTAMP,
            created_at TIMESTAMP,
            updated_at TIMESTAMP{pk_clause.replace("job_id", "job_log_id")}
        )
    """)


def downgrade() -> None:
    """删除 sys_job_log 和 sys_job."""
    op.execute("DROP TABLE IF EXISTS sys_job_log")
    op.execute("DROP TABLE IF EXISTS sys_job")
