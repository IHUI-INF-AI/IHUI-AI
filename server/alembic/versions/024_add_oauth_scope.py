"""add OAuth scope columns (OAuthApp.scopes + OAuthSession.scope)

Revision ID: 024_add_oauth_scope
Revises: 023_add_oauth_pkce_and_redirect_whitelist
Create Date: 2026-06-28

Round 23 扩展 OAuth 权限范围:
1. oauth_apps 新增 scopes JSON 列 (应用允许的权限范围数组, 如 ["read:profile","write:orders"])
2. oauth_sessions 新增 scope Text 列 (实际授权的权限范围, 空格分隔字符串, OAuth2 标准)

幂等设计: 每列用 _has_column 检查, 可重复执行不报错.
"""
import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "024_add_oauth_scope"
down_revision = "023_add_oauth_pkce_and_redirect_whitelist"
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

    # 1. oauth_apps 新增 scopes JSON 列
    if _has_table(bind, "oauth_apps") and not _has_column(bind, "oauth_apps", "scopes"):
        op.add_column(
            "oauth_apps",
            sa.Column(
                "scopes",
                sa.JSON(),
                nullable=True,
                comment="应用允许的权限范围 (JSON 数组)",
            ),
        )

    # 2. oauth_sessions 新增 scope Text 列
    if _has_table(bind, "oauth_sessions") and not _has_column(
        bind, "oauth_sessions", "scope"
    ):
        op.add_column(
            "oauth_sessions",
            sa.Column(
                "scope",
                sa.Text(),
                nullable=True,
                comment="授权的 scope (空格分隔字符串)",
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _has_column(bind, "oauth_sessions", "scope"):
        op.drop_column("oauth_sessions", "scope")
    if _has_column(bind, "oauth_apps", "scopes"):
        op.drop_column("oauth_apps", "scopes")
