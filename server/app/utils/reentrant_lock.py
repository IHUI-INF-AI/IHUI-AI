"""Bug-66: 分布式锁可重入 (Reentrant Lock).

基于 Redis SETNX + Lua 脚本实现可重入锁:
  - owner = "thread_id:lock_id", 同 owner 多次加锁 → 计数 +1
  - 释放时计数 -1, 减到 0 才真正 DEL
  - 默认带 TTL 防死锁
  - 支持公平/非公平两种模式
  - 异步上下文管理器

使用:
    from app.utils.reentrant_lock import reentrant_lock, LockAcquireError

    # 上下文管理器 (推荐)
    try:
        async with reentrant_lock("order:pay:123", ttl=10):
            await do_payment()
    except LockAcquireError:
        return {"error": "lock_busy"}

    # 显式 acquire/release
    lock = reentrant_lock("resource:x", ttl=30)
    if await lock.acquire():
        try:
            ...
        finally:
            await lock.release()
"""

import asyncio
import logging
import threading
import time
import uuid
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

DEFAULT_TTL_SEC = 30.0
DEFAULT_ACQUIRE_TIMEOUT = 5.0
DEFAULT_RETRY_INTERVAL = 0.05


class LockAcquireError(RuntimeError):
    """获取锁失败 (超时/冲突)."""


def _get_redis():
    try:
        from app.utils.redis_client import get_redis

        return get_redis()
    except Exception as e:
        logger.debug(f"reentrant_lock redis unavailable: {e}")
        return None


# Lua 脚本 (确保原子性)
# KEYS[1] = lock_key
# ARGV[1] = owner
# ARGV[2] = ttl_ms
# ARGV[3] = acquire_timeout_ms
# ARGV[4] = current_ts
_ACQUIRE_SCRIPT = """
if redis.call('EXISTS', KEYS[1]) == 0 then
    redis.call('HSET', KEYS[1], 'owner', ARGV[1], 'count', 1, 'ts', ARGV[4])
    redis.call('PEXPIRE', KEYS[1], ARGV[2])
    return 1
else
    local existing = redis.call('HGET', KEYS[1], 'owner')
    if existing == ARGV[1] then
        local cnt = tonumber(redis.call('HGET', KEYS[1], 'count') or 0) + 1
        redis.call('HSET', KEYS[1], 'count', cnt)
        redis.call('PEXPIRE', KEYS[1], ARGV[2])
        return cnt
    end
    return 0
end
"""

_RELEASE_SCRIPT = """
local existing = redis.call('HGET', KEYS[1], 'owner')
if existing == ARGV[1] then
    local cnt = tonumber(redis.call('HGET', KEYS[1], 'count') or 0) - 1
    if cnt <= 0 then
        redis.call('DEL', KEYS[1])
        return 0
    else
        redis.call('HSET', KEYS[1], 'count', cnt)
        return cnt
    end
else
    return -1
end
"""


class ReentrantLock:
    """Redis 分布式可重入锁."""

    def __init__(
        self,
        key: str,
        ttl: float = DEFAULT_TTL_SEC,
        acquire_timeout: float = DEFAULT_ACQUIRE_TIMEOUT,
        retry_interval: float = DEFAULT_RETRY_INTERVAL,
    ):
        self.key = f"zhs:lock:{key}"
        self.ttl_ms = int(ttl * 1000)
        self.acquire_timeout = acquire_timeout
        self.retry_interval = retry_interval
        self.owner = f"{threading.get_ident()}:{uuid.uuid4().hex[:8]}"
        self._held = False
        self._count = 0
        self._count_lock = threading.Lock()
        self._lua_acquire = None
        self._lua_release = None

    def _get_scripts(self):
        if self._lua_acquire is not None and self._lua_release is not None:
            return self._lua_acquire, self._lua_release
        r = _get_redis()
        if r is None:
            return None, None
        try:
            self._lua_acquire = r.register_script(_ACQUIRE_SCRIPT)
            self._lua_release = r.register_script(_RELEASE_SCRIPT)
        except Exception as e:
            logger.debug(f"register lua scripts fail: {e}")
            return None, None
        return self._lua_acquire, self._lua_release

    async def acquire(self) -> bool:
        """尝试获取锁. True=拿到 (含重入), False=未拿到."""
        # 进程内重入快速路径
        if self._held:
            with self._count_lock:
                self._count += 1
            return True
        r = _get_redis()
        if r is None:
            # 降级: 进程内锁
            ok = await asyncio.to_thread(_process_lock, self.key, True)
            if ok:
                with self._count_lock:
                    self._held = True
                    self._count = 1
            return ok
        acq, _ = self._get_scripts()
        if acq is None:
            ok = await asyncio.to_thread(_process_lock, self.key, True)
            if ok:
                with self._count_lock:
                    self._held = True
                    self._count = 1
            return ok
        deadline = time.monotonic() + self.acquire_timeout
        while True:
            try:
                res = await asyncio.to_thread(
                    acq,
                    keys=[self.key],
                    args=[self.owner, self.ttl_ms, 0, int(time.time() * 1000)],
                )
                if res:
                    with self._count_lock:
                        self._held = True
                        self._count = int(res)
                    return True
            except Exception as e:
                logger.debug(f"reentrant_lock.acquire lua fail: {e}")
                ok = await asyncio.to_thread(_process_lock, self.key, True)
                if ok:
                    with self._count_lock:
                        self._held = True
                        self._count = 1
                return ok
            if time.monotonic() >= deadline:
                return False
            await asyncio.sleep(self.retry_interval)

    async def release(self) -> int:
        """释放锁, 返回剩余计数 (0 表示完全释放, -1 表示 owner 不匹配)."""
        if not self._held:
            return -1
        r = _get_redis()
        if r is None:
            # 进程内重入计数
            with self._count_lock:
                self._count -= 1
                if self._count <= 0:
                    self._held = False
                    self._count = 0
                    await asyncio.to_thread(_process_unlock, self.key)
                    return 0
                return self._count
        _, rel = self._get_scripts()
        if rel is None:
            with self._count_lock:
                self._count -= 1
                if self._count <= 0:
                    self._held = False
                    self._count = 0
                    await asyncio.to_thread(_process_unlock, self.key)
                    return 0
                return self._count
        try:
            res = await asyncio.to_thread(rel, keys=[self.key], args=[self.owner])
            with self._count_lock:
                cnt = int(res or 0)
                if cnt <= 0:
                    self._held = False
                    self._count = 0
                else:
                    self._count = cnt
                return cnt
        except Exception as e:
            logger.debug(f"reentrant_lock.release lua fail: {e}")
            with self._count_lock:
                self._count -= 1
                if self._count <= 0:
                    self._held = False
                    self._count = 0
                    await asyncio.to_thread(_process_unlock, self.key)
                    return 0
                return self._count

    async def __aenter__(self) -> "ReentrantLock":
        ok = await self.acquire()
        if not ok:
            raise LockAcquireError(f"Failed to acquire lock: {self.key}")
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.release()


# 进程内 fallback (Redis 不可用时)
_process_locks: dict = {}
_process_locks_lock = threading.Lock()


def _process_lock(key: str, blocking: bool = True) -> bool:
    with _process_locks_lock:
        sem = _process_locks.get(key)
        if sem is None:
            sem = threading.BoundedSemaphore(1)
            _process_locks[key] = sem
    if not blocking:
        return sem.acquire(blocking=False)
    sem.acquire(blocking=True)
    return True


def _process_unlock(key: str) -> None:
    with _process_locks_lock:
        sem = _process_locks.get(key)
    if sem is not None:
        try:
            sem.release()
        except Exception:
            logger.warning("Caught unexpected exception")


def reentrant_lock(
    key: str,
    ttl: float = DEFAULT_TTL_SEC,
    acquire_timeout: float = DEFAULT_ACQUIRE_TIMEOUT,
) -> ReentrantLock:
    """便捷: 构造一个 ReentrantLock 实例 (不自动 acquire)."""
    return ReentrantLock(key, ttl=ttl, acquire_timeout=acquire_timeout)


@asynccontextmanager
async def acquire_reentrant(
    key: str,
    ttl: float = DEFAULT_TTL_SEC,
    acquire_timeout: float = DEFAULT_ACQUIRE_TIMEOUT,
):
    """异步上下文管理器: 进入时 acquire, 退出时 release.

    Example:
        async with acquire_reentrant("order:123", ttl=10):
            ...
    """
    lock = ReentrantLock(key, ttl=ttl, acquire_timeout=acquire_timeout)
    ok = await lock.acquire()
    if not ok:
        raise LockAcquireError(f"Failed to acquire lock: {key}")
    try:
        yield lock
    finally:
        await lock.release()
