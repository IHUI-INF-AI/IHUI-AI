"""发布完成通知。

设计:
- 通过 Socket.IO 推送到 web 端(复用 app.sio.sio 单例)
- 同时写入 publish_notifications 表(由 api 服务的通知系统读取)
- 通知格式: { type: 'publish_complete', task_id, status, summary }

降级策略:
- Socket.IO 不可用 → 仅写 DB
- DB 不可用 → 仅推 Socket.IO
- 两者都失败 → 仅记日志(不阻塞主流程)
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


async def _get_db_conn() -> Optional[asyncpg.Connection]:
    """获取 DB 连接,失败返回 None(降级)。"""
    dsn = getattr(settings, "database_url", None)
    if not dsn:
        return None
    try:
        return await asyncpg.connect(dsn=dsn)
    except Exception as e:
        logger.warning("[publish.notifications] db connect failed: %s: %s", type(e).__name__, e)
        return None


async def _ensure_table(conn: asyncpg.Connection) -> None:
    """确保 publish_notifications 表存在(idempotent)。"""
    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS publish_notifications (
            id BIGSERIAL PRIMARY KEY,
            task_id VARCHAR(64) NOT NULL,
            user_id VARCHAR(64),
            status VARCHAR(32) NOT NULL,
            summary TEXT,
            payload JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    await conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_publish_notifications_task_id ON publish_notifications(task_id)"
    )
    await conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_publish_notifications_user_id ON publish_notifications(user_id)"
    )


async def _write_to_db(
    task_id: str,
    user_id: Optional[str],
    status: str,
    summary: str,
    payload: dict[str, Any],
) -> bool:
    """写入通知表,返回是否成功。"""
    conn = await _get_db_conn()
    if conn is None:
        return False
    try:
        await _ensure_table(conn)
        await conn.execute(
            """
            INSERT INTO publish_notifications (task_id, user_id, status, summary, payload)
            VALUES ($1, $2, $3, $4, $5::jsonb)
            """,
            task_id,
            user_id,
            status,
            summary,
            json.dumps(payload, ensure_ascii=False),
        )
        return True
    except Exception as e:
        logger.warning(
            "[publish.notifications] db write failed: %s: %s", type(e).__name__, e
        )
        return False
    finally:
        await conn.close()


async def _push_sio(room: str, event: str, data: dict[str, Any]) -> bool:
    """通过 Socket.IO 推送通知,返回是否成功。"""
    try:
        from app.sio import sio
        await sio.emit(event, data, room=room)
        return True
    except Exception as e:
        logger.warning(
            "[publish.notifications] sio emit failed: %s: %s", type(e).__name__, e
        )
        return False


async def notify_publish_complete(
    task_id: str,
    user_id: Optional[str],
    status: str,  # 'success' | 'partial' | 'failed' | 'cancelled'
    summary: str,
    payload: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """发布完成统一通知入口。

    Returns:
        { sio: bool, db: bool } - 各通道是否成功
    """
    data = {
        "type": "publish_complete",
        "task_id": task_id,
        "user_id": user_id,
        "status": status,
        "summary": summary,
        "payload": payload or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Socket.IO 推送到 user room(前端按 user_id 订阅)
    room = f"user:{user_id}" if user_id else "publish:broadcast"
    sio_ok = await _push_sio(room, "publish_complete", data)

    # 写入 DB 通知表(供前端轮询/SSE 兜底)
    db_ok = await _write_to_db(task_id, user_id, status, summary, data)

    logger.info(
        "[publish.notifications] task=%s status=%s sio=%s db=%s",
        task_id,
        status,
        sio_ok,
        db_ok,
    )
    return {"sio": sio_ok, "db": db_ok}


async def notify_progress(
    task_id: str,
    user_id: Optional[str],
    platform: str,
    status: str,
    message: str = "",
) -> bool:
    """单平台进度通知(实时推送,不写 DB)。"""
    data = {
        "type": "publish_progress",
        "task_id": task_id,
        "platform": platform,
        "status": status,  # 'start' | 'success' | 'failed'
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    room = f"user:{user_id}" if user_id else "publish:broadcast"
    return await _push_sio(room, "publish_progress", data)
