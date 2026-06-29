"""add PKCE + redirect_uris columns for OAuth

Revision ID: 023_add_oauth_pkce_and_redirect_whitelist
Revises: 022_add_withdrawal_transaction_id
Create Date: 2026-06-28

Round 22 扩展 OAuth 安全:
1. oauth_apps 新增 redirect_uris JSON 列 (多回调地址白名单, 取代单 redirect_uri 前缀校验)
2. oauth_sessions 新增 code_challenge + code_challenge_method 列 (支持 PKCE S256)

幂等设计: 每列用 _has_column 检查, 可重复执行不报错.
"""
import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision = "023_add_oauth_pkce_and_redirect_whitelist"
down_revision = "022_add_withdrawal_transaction_id"
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

    # 1. oauth_apps 新增 redirect_uris JSON 列
    if _has_table(bind, "oauth_apps") and not _has_column(
        bind, "oauth_apps", "redirect_uris"
    ):
        op.add_column(
            "oauth_apps",
            sa.Column(
                "redirect_uris",
                sa.JSON(),
                nullable=True,
                comment="回调地址白名单 (JSON 数组)",
            ),
        )

    # 2. oauth_sessions 新增 code_challenge 列
    if _has_table(bind, "oauth_sessions") and not _has_column(
        bind, "oauth_sessions", "code_challenge"
    ):
        op.add_column(
            "oauth_sessions",
            sa.Column(
                "code_challenge",
                sa.String(256),
                nullable=True,
                comment="PKCE code_challenge",
            ),
        )

    # 3. oauth_sessions 新增 code_challenge_method 列
    if _has_table(bind, "oauth_sessions") and not _has_column(
        bind, "oauth_sessions", "code_challenge_method"
    ):
        op.add_column(
            "oauth_sessions",
            sa.Column(
                "code_challenge_method",
                sa.String(10),
                nullable=True,
                comment="PKCE method: S256",
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _has_column(bind, "oauth_sessions", "code_challenge_method"):
        op.drop_column("oauth_sessions", "code_challenge_method")
    if _has_column(bind, "oauth_sessions", "code_challenge"):
        op.drop_column("oauth_sessions", "code_challenge")
    if _has_column(bind, "oauth_apps", "redirect_uris"):
        op.drop_column("oauth_apps", "redirect_uris")
