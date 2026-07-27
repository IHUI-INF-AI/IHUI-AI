"""asyncpg 连接池(全局单例)。

替代散落在 routers/services 中的 `asyncpg.connect(dsn=...)` 直连模式,
通过 min_size/max_size 限流防止高并发连接耗尽。

调用方用法:
    from app.core.db import get_db_conn
    conn = await get_db_conn()
    try:
        ...
    finally:
        await conn.close()  # 从池 acquire 的连接 close 等价于释放,pool 下次 acquire 自动重建
"""
from __future__ import annotations

import asyncpg

from app.core.config import settings

_pool: asyncpg.Pool | None = None


async def get_db_pool() -> asyncpg.Pool:
    """获取(惰性创建)全局连接池。"""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=2,
            max_size=10,
            command_timeout=30.0,
        )
    return _pool


async def get_db_conn() -> asyncpg.Connection:
    """从全局池获取一个连接(调用方负责 close/release)。"""
    pool = await get_db_pool()
    return await pool.acquire()


async def close_db_pool() -> None:
    """关闭全局池(应用 shutdown 时调用)。"""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
