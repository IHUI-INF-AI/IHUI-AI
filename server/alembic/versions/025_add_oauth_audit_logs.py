"""add oauth_audit_logs table (Round 27-C 审计日志)

Revision ID: 025_add_oauth_audit_logs
Revises: 024_add_oauth_scope
Create Date: 2026-06-28

Round 27-C 新增 OAuth 审计日志表:
记录所有 OAuth 敏感操作 (app_create / app_delete / app_reset_secret /
authorize_grant / authorize_deny / token_issue / token_refresh / protected_access),
供管理员审计追溯.

幂等设计: 用 _has_table 检查, 可重复执行不报错.
"""
import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "025_add_oauth_audit_logs"
down_revision = "024_add_oauth_scope"
branch_labels = None
depends_on = None


def _has_table(bind, table):
    """幂等检查: 表是否存在."""
    try:
        insp = inspect(bind)
        return table in insp.get_table_names()
    except Exception:
        return False


def _has_column(bind, table, column):
    """幂等检查: 列是否已存在."""
    try:
        insp = inspect(bind)
        if table not in insp.get_table_names():
            return False
        return column in {c["name"] for c in insp.get_columns(table)}
    except Exception:
        return False


def upgrade() -> None:
    bind = op.get_bind()

    # 1. 创建 oauth_audit_logs 表 (若不存在)
    if not _has_table(bind, "oauth_audit_logs"):
        op.create_table(
            "oauth_audit_logs",
            sa.Column(
                "id",
                sa.Integer().with_variant(sa.BigInteger(), "postgresql"),
                primary_key=True,
                autoincrement=True,
                comment="ID",
            ),
            sa.Column("event", sa.String(50), nullable=False, comment="事件类型"),
            sa.Column(
                "client_id",
                sa.String(100),
                nullable=True,
                comment="OAuth 应用 client_id",
            ),
            sa.Column(
                "user_uuid", sa.String(64), nullable=True, comment="操作者 user_uuid"
            ),
            sa.Column("ip", sa.String(64), nullable=True, comment="操作来源 IP"),
            sa.Column(
                "status",
                sa.String(20),
                nullable=False,
                server_default="success",
                comment="结果状态",
            ),
            sa.Column("detail", sa.Text(), nullable=True, comment="详细说明 / 失败原因"),
            sa.Column(
                "request_summary",
                sa.JSON(),
                nullable=True,
                comment="请求参数摘要 (脱敏)",
            ),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=True,
                comment="创建时间",
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                nullable=True,
                comment="更新时间",
            ),
        )
        # 索引: 按 event 查询 (admin 审计页面常用筛选条件)
        op.create_index(
            "ix_oauth_audit_logs_event",
            "oauth_audit_logs",
            ["event"],
        )
        # 索引: 按 client_id 查询 (追溯某应用的所有操作)
        op.create_index(
            "ix_oauth_audit_logs_client_id",
            "oauth_audit_logs",
            ["client_id"],
        )
        # 索引: 按 user_uuid 查询 (追溯某用户的所有授权操作)
        op.create_index(
            "ix_oauth_audit_logs_user_uuid",
            "oauth_audit_logs",
            ["user_uuid"],
        )
        # 索引: 按 created_at 倒序查询 (admin 列表默认按时间倒序)
        op.create_index(
            "ix_oauth_audit_logs_created_at",
            "oauth_audit_logs",
            ["created_at"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _has_table(bind, "oauth_audit_logs"):
        op.drop_table("oauth_audit_logs")
