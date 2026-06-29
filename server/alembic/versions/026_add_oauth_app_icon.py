"""add OAuthApp.icon column

Revision ID: 026_add_oauth_app_icon
Revises: 025_add_oauth_audit_logs
Create Date: 2026-06-28

Round 29-A 扩展 OAuth 应用图标:
1. oauth_apps 新增 icon VARCHAR(512) 列 (应用图标 URL, 可空)

幂等设计: 列用 _has_column 检查, 可重复执行不报错.
"""
import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "026_add_oauth_app_icon"
down_revision = "025_add_oauth_audit_logs"
branch_labels = None
depends_on = None


def _has_column(bind, table, column):
    """幂等检查: 列是否已存在."""
    try:
        insp = inspect(bind)
        if table not in insp.get_table_names():
            return False
        return column in {c["name"] for c in insp.get_columns(table)}
    except Exception:
        return False


def _has_table(bind, table):
    """幂等检查: 表是否存在."""
    try:
        insp = inspect(bind)
        return table in insp.get_table_names()
    except Exception:
        return False


def upgrade() -> None:
    bind = op.get_bind()

    # 1. oauth_apps 新增 icon VARCHAR(512) 列
    if _has_table(bind, "oauth_apps") and not _has_column(bind, "oauth_apps", "icon"):
        op.add_column(
            "oauth_apps",
            sa.Column(
                "icon",
                sa.String(length=512),
                nullable=True,
                comment="应用图标 URL",
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _has_column(bind, "oauth_apps", "icon"):
        op.drop_column("oauth_apps", "icon")
