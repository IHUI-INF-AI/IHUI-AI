"""共享 asyncpg 连接池模块(2026-07-28 立)。

修复:14 个独立 asyncpg pool(最多 75 连接)打满 PostgreSQL max_connections 问题。
方案:所有 service 复用此共享 pool,总连接数从 95 降到 30。

特性:
- 懒初始化:首次调用 get_shared_pool() 时创建
- 进程退出时由 main.py shutdown 调 close_shared_pool() 关闭
- 幂等关闭:多次调用安全(_pool=None 时 no-op)

约束:
- 不引入新依赖(仅复用 asyncpg)
- 不修改 API 契约或 schema
- 各 service 保留自己的 _get_pool / close_pool 函数签名(向后兼容)
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

import asyncpg

from .config import settings

logger = logging.getLogger(__name__)

# 全局共享连接池(所有 service 复用,替代 14 个独立 _pool)
_pool: Optional[asyncpg.Pool] = None
# 懒初始化锁(防止并发 create_pool 导致连接泄漏,2026-08-01 P0 修复)
_pool_lock = asyncio.Lock()


async def get_shared_pool() -> asyncpg.Pool:
    """获取共享 asyncpg 连接池(懒初始化,min_size=2 / max_size=30)。

    所有 service 通过此函数获取同一个 pool 实例,避免每个 service 各自创建独立 pool
    导致 PostgreSQL max_connections 被打满。

    Returns:
        共享 asyncpg.Pool 实例。
    """
    global _pool
    if _pool is None:
        async with _pool_lock:
            if _pool is None:  # double-check after acquiring lock
                _pool = await asyncpg.create_pool(
                    dsn=settings.database_url,
                    min_size=2,
                    max_size=30,
                    command_timeout=10,
                )
                logger.info("[db_pool] shared asyncpg pool created (min=2, max=30)")
    return _pool


async def close_shared_pool() -> None:
    """关闭共享 asyncpg 连接池(main.py shutdown 调用)。

    幂等:多次调用安全(_pool=None 时 no-op)。
    任何异常仅 warning,不抛出(防止 shutdown 阶段阻塞其他清理)。
    """
    global _pool
    if _pool is not None:
        try:
            await _pool.close()
            logger.info("[db_pool] shared asyncpg pool closed")
        except Exception as e:
            logger.warning("[db_pool] close_shared_pool 异常(忽略): %s", e)
        _pool = None
