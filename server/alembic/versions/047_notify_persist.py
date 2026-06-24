"""站内信持久化 (P1 封版, 替代内存 deque).

Domain: Notify Persist
Revision ID: 047_notify_persist
Revises: 046_g_pg_indexes
Create Date: 2026-06-24

背景: 之前站内信 (_notify_queue: deque) 在内存中, 进程重启 / 多 worker / 多 pod 全部不共享.
      现改为复用 message 表 (已存在, edu 业务也用它), user_id = 站内信接收方 UUID.

变更: 仅添加必要索引 (已有 message 表不需要重建 DDL), 索引补全:
      - idx_msg_user_unread: (user_id, is_read) 覆盖未读计数
      - idx_msg_user_created: (user_id, created_at DESC) 覆盖列表时间倒序

幂等: IF NOT EXISTS.
"""
import logging

from alembic import op


revision = "047_notify_persist"
down_revision = "046_g_pg_indexes"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.047_notify_persist")


def _safe_create_index(name: str, table: str, columns: list[str]) -> None:
    cols_sql = ", ".join(columns)
    op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({cols_sql})")


def _safe_drop_index(name: str) -> None:
    op.execute(f"DROP INDEX IF EXISTS {name}")


def upgrade() -> None:
    """补建 message 表索引以加速站内信查询 (未读计数 / 时间倒序)."""
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        logger.info("047_notify_persist: 非 PG, 跳过")
        return

    # 索引 1: 站内信未读计数 (供菜单红点)
    _safe_create_index("idx_msg_user_unread", "message", ["user_id", "is_read"])
    # 索引 2: 站内信列表按时间倒序 (供 notify 列表)
    _safe_create_index("idx_msg_user_created", "message", ["user_id", "created_at DESC"])
    # 索引 3: 按 type + user_id 过滤 (system_notice / private 分类)
    _safe_create_index("idx_msg_user_type", "message", ["user_id", "type"])

    # ANALYZE 让优化器用上新索引
    try:
        op.execute("ANALYZE message")
    except Exception as e:  # noqa: BLE001
        logger.warning("047_notify_persist: ANALYZE message 跳过: %s", e)

    logger.info("047_notify_persist: 站内信持久化索引补建完成")


def downgrade() -> None:
    """回滚 047 引入的索引 (不删 message 表本身)."""
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    _safe_drop_index("idx_msg_user_unread")
    _safe_drop_index("idx_msg_user_created")
    _safe_drop_index("idx_msg_user_type")
    logger.info("047_notify_persist: 索引已回滚")
