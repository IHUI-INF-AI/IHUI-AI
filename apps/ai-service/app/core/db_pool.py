# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""共享 asyncpg 连接池模块(2026-07-28 立)。

修复:14 个独立 asyncpg pool(最多 75 连接)打满 PostgreSQL max_connections 问题。
方案:所有 service 复用此共享 pool,总连接数从 95 降到 30。

特性:
- 懒初始化:首次调用 get_shared_pool() 时创建
- 按事件循环隔离(2026-09-12 修复):池以 loop 为 key,同一 loop 内复用同一个池;
  临时 loop(asyncio.run / run_in_threadpool)不再复用主 loop 的池而报 "Event loop is closed"
- 进程退出时由 main.py shutdown 调 close_shared_pool() 关闭所有已知池
- 临时 loop 由 close_current_loop_pool() / close_pool_for_loop() 在 loop 关闭前回收
- 幂等关闭:多次调用安全(无池时 no-op)

约束:
- 不引入新依赖(仅复用 asyncpg)
- 不修改 API 契约或 schema
- 各 service 保留自己的 _get_pool / close_pool 函数签名(向后兼容)
"""

from __future__ import annotations

import asyncio
import logging
import threading
import weakref

import asyncpg

from .config import settings

logger = logging.getLogger(__name__)

# 事件循环 -> 共享连接池(2026-09-12 修复:池按 loop 隔离)。
# 原先用单一进程级 _pool,它在"首次创建它的 loop"上绑定;而自愈路径
# (_run_async / run_in_threadpool) 每轮都用 asyncio.run 新建临时 loop,
# 复用该池即命中 "Event loop is closed"。改为按 loop 建池:同一 loop 内
# 反复调用仍拿到同一个池(连接数不增长),临时 loop 也各自拿到可用池。
_pools: weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, asyncpg.Pool] = (
    weakref.WeakKeyDictionary()
)
# 每 loop 一把懒初始化锁,防止同一 loop 内并发 create_pool 导致连接泄漏。
# 注意:asyncio.Lock 在首次 acquire 时绑定 loop,不能跨 loop 复用,故同样按 loop 存放。
_pool_locks: weakref.WeakKeyDictionary[
    asyncio.AbstractEventLoop, asyncio.Lock
] = weakref.WeakKeyDictionary()
# 保护 _pool_locks 的读写(临时 loop 可能来自不同线程)。
_locks_guard = threading.Lock()


def _get_pool_lock(loop: asyncio.AbstractEventLoop) -> asyncio.Lock:
    """取指定 loop 专属的懒初始化锁(不存在则创建)。"""
    with _locks_guard:
        lock = _pool_locks.get(loop)
        if lock is None:
            lock = asyncio.Lock()
            _pool_locks[loop] = lock
        return lock


def _prune_closed_loops() -> None:
    """best-effort 回收"loop 已关闭但池未显式关闭"的残留池,防连接泄漏。

    正常路径(_run_async 的 try/finally)已显式关闭;此处仅兜底那些直接
    用 asyncio.run 而未接入清理的调用方。terminate() 是同步的,故可在任意
    loop 上安全调用(失败仅告警)。
    """
    for loop, pool in list(_pools.items()):
        if not loop.is_closed():
            continue
        _pools.pop(loop, None)
        _pool_locks.pop(loop, None)
        try:
            pool.terminate()
            logger.info("[db_pool] 回收已关闭 loop 的残留池(id=%#x)", id(loop))
        except Exception as e:
            logger.warning("[db_pool] 回收已关闭 loop 的残留池失败(忽略): %s", e)


async def get_shared_pool() -> asyncpg.Pool:
    """获取当前事件循环的共享 asyncpg 连接池(懒初始化,min_size=2 / max_size=30)。

    池按事件循环隔离:同一 loop 内多次调用返回同一个池实例(避免连接数增长);
    不同 loop(含 asyncio.run 起的临时 loop)各自持有独立池,避免跨 loop 复用
    触发 "Event loop is closed"。

    Returns:
        当前 loop 的共享 asyncpg.Pool 实例。
    """
    loop = asyncio.get_running_loop()
    pool = _pools.get(loop)
    if pool is None:
        _prune_closed_loops()
        async with _get_pool_lock(loop):
            pool = _pools.get(loop)  # double-check after acquiring lock
            if pool is None:
                # P2-9(2026-08-06):database_url 未配置(fail-closed)直接抛错,
                # 不再静默连本地默认库(原默认含弱密码 postgres:postgres,生产覆盖遗漏即隐患)。
                if not settings.database_url:
                    raise RuntimeError(
                        "DATABASE_URL 未配置:ai-service 需要数据库连接,请在 .env 设置"
                    )
                pool = await asyncpg.create_pool(
                    dsn=settings.database_url,
                    min_size=2,
                    max_size=30,
                    command_timeout=10,
                )
                _pools[loop] = pool
                logger.info(
                    "[db_pool] shared asyncpg pool created for loop id=%#x (min=2, max=30)",
                    id(loop),
                )
    return pool


async def close_pool_for_loop(loop: asyncio.AbstractEventLoop) -> None:
    """关闭指定事件循环持有的共享池(幂等:无池则 no-op)。

    供临时 loop 在关闭前回收连接(asyncio.run 结束后不会再执行协程,
    所以必须在协程内部 / loop 关闭前调用)。
    异常仅 warning,不抛出。
    """
    pool = _pools.pop(loop, None)
    _pool_locks.pop(loop, None)
    if pool is None:
        return
    try:
        await pool.close()
        logger.info("[db_pool] pool for loop id=%#x closed", id(loop))
    except Exception as e:
        logger.warning("[db_pool] close_pool_for_loop 异常(忽略): %s", e)
        try:
            pool.terminate()
        except Exception:
            pass


async def close_current_loop_pool() -> None:
    """关闭"当前运行中的事件循环"持有的共享池(临时 loop 的 try/finally 清理入口)。

    无运行中的 loop 时 no-op(不会创建 loop)。
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    await close_pool_for_loop(loop)


async def close_shared_pool() -> None:
    """关闭所有已知事件循环的共享池(main.py shutdown 调用)。

    幂等:多次调用安全(无池时 no-op)。
    任何异常仅 warning,不抛出(防止 shutdown 阶段阻塞其他清理)。
    """
    for loop in list(_pools.keys()):
        await close_pool_for_loop(loop)
    _pool_locks.clear()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
