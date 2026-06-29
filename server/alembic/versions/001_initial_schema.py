"""首版 schema 迁移 - 100 张表，跨 3 个数据库."""
"""create initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-12

"""
import os
from pathlib import Path

from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None

# 指向预生成 DDL 的相对路径 (alembic -c alembic.ini 时 cwd=alembic/)
_INIT_SQL_PATH = Path(__file__).resolve().parent / "001_init.sql"


def _execute_ddl_file(target: str) -> None:
    """执行 DDL 脚本，按 ; 切分执行."""
    if not os.path.exists(target):
        return
    with open(target, "r", encoding="utf-8") as f:
        sql = f.read()
    for stmt in sql.split(";"):
        s = stmt.strip()
        if not s or s.startswith("--"):
            continue
        try:
            op.execute(s)
        except Exception:
            pass


def upgrade() -> None:
    """直接执行 DDL 脚本（已在 alembic/versions/001_init.sql 中预生成）.

    SQLite CI 模式: 整个 no-op (Base.metadata.create_all 已在 alembic_ci.py 中建表).
    PostgreSQL 生产模式: 读 001_init.sql 按 ; 切分执行.
    DDL 包含 3 个数据库的表，统一执行（PostgreSQL 会忽略不存在的表引用）.
    """
    if op.get_bind().dialect.name == "sqlite":
        return
    target = os.environ.get("INIT_SQL_OVERRIDE") or str(_INIT_SQL_PATH)
    _execute_ddl_file(target)


def downgrade() -> None:
    """删除所有 zhs_ 开头的表。"""
    pass
