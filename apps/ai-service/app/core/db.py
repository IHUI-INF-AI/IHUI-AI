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

# P2 修复(2026-08-06):委托共享连接池。
# db_pool.py 的 get_shared_pool()(max_size=30)已是全局唯一池,本模块原先自建
# 独立池(max_size=10)会造成双池并存,高并发下各自打满 PostgreSQL max_connections。
# 此处直接委托共享池,消除双池;函数签名与导出保持不变,调用方行为不变。
from app.core.db_pool import close_shared_pool, get_shared_pool


async def get_db_pool() -> asyncpg.Pool:
    """获取全局共享连接池(惰性创建,委托 db_pool.get_shared_pool)。"""
    # P2 修复(2026-08-06):返回共享池实例,不再创建独立 _pool。
    return await get_shared_pool()


async def get_db_conn() -> asyncpg.Connection:
    """从全局池获取一个连接(调用方负责 close/release)。"""
    pool = await get_db_pool()
    return await pool.acquire()


async def close_db_pool() -> None:
    """关闭共享连接池(应用 shutdown 时调用,幂等)。"""
    # P2 修复(2026-08-06):委托 close_shared_pool,确保关闭的是共享池。
    await close_shared_pool()
