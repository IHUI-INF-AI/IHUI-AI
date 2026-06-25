"""服务韧性模块 -- 熔断 / 限流 / 降级.

设计目标:
1. CircuitBreaker: 防止下游故障拖垮上游 (CLOSED → OPEN → HALF_OPEN)
2. TokenBucketRateLimit: 令牌桶限流, 防止突发流量压垮服务
3. degraded_mode: 装饰器, 下游异常时返回兜底数据
4. bulkhead: 信号量隔离, 限制并发

所有组件都是同步函数/装饰器, 可直接对同步函数包装.
对异步函数提供 async 版装饰器.
"""

import asyncio
import functools
import logging
import threading
import time
from collections.abc import Callable
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# CircuitBreaker 熔断器
# ---------------------------------------------------------------------------


class CircuitBreakerOpen(Exception):
    """熔断器已打开, 拒绝请求."""

    pass


class CircuitBreaker:
    """三态熔断器.

    状态机:
        CLOSED       正常放行
        OPEN         拒绝请求, 等待 reset_timeout 后转 HALF_OPEN
        HALF_OPEN    放行一个探测请求, 成功转 CLOSED, 失败转 OPEN

    参数:
        failure_threshold: 连续失败 N 次后熔断 (默认 5)
        reset_timeout:     熔断持续时间, 秒 (默认 30)
        success_threshold: HALF_OPEN 状态连续成功 N 次后恢复 (默认 2)
    """

    STATE_CLOSED = "closed"
    STATE_OPEN = "open"
    STATE_HALF_OPEN = "half_open"

    def __init__(
        self, name: str = "default", failure_threshold: int = 5, reset_timeout: float = 30.0, success_threshold: int = 2
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.success_threshold = success_threshold
        self._state = self.STATE_CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._opened_at: float | None = None
        self._lock = threading.Lock()
        # 指标
        self.stats_open = 0
        self.stats_half_open = 0
        self.stats_rejected = 0
        self.stats_success = 0
        self.stats_failure = 0

    @property
    def state(self) -> str:
        return self._state

    def allow(self) -> bool:
        """检查是否允许通过."""
        with self._lock:
            if self._state == self.STATE_CLOSED:
                return True
            if self._state == self.STATE_OPEN:
                if self._opened_at and (time.monotonic() - self._opened_at) >= self.reset_timeout:
                    self._state = self.STATE_HALF_OPEN
                    self._success_count = 0
                    self.stats_half_open += 1
                    logger.info(f"[CB:{self.name}] OPEN → HALF_OPEN")
                    return True
                return False
            # HALF_OPEN
            return True

    def record_success(self):
        with self._lock:
            self.stats_success += 1
            if self._state == self.STATE_HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.success_threshold:
                    self._state = self.STATE_CLOSED
                    self._failure_count = 0
                    self._success_count = 0
                    logger.info(f"[CB:{self.name}] HALF_OPEN → CLOSED")
            elif self._state == self.STATE_CLOSED:
                self._failure_count = 0  # 成功重置连续失败计数

    def record_failure(self):
        with self._lock:
            self.stats_failure += 1
            if self._state == self.STATE_HALF_OPEN:
                self._state = self.STATE_OPEN
                self._opened_at = time.monotonic()
                self.stats_open += 1
                logger.warning(f"[CB:{self.name}] HALF_OPEN → OPEN (探测失败)")
            elif self._state == self.STATE_CLOSED:
                self._failure_count += 1
                if self._failure_count >= self.failure_threshold:
                    self._state = self.STATE_OPEN
                    self._opened_at = time.monotonic()
                    self.stats_open += 1
                    logger.warning(f"[CB:{self.name}] CLOSED → OPEN (连续失败 {self._failure_count})")

    def call(self, func: Callable, *args, **kwargs):
        """同步函数调用入口."""
        if not self.allow():
            self.stats_rejected += 1
            raise CircuitBreakerOpen(f"circuit '{self.name}' is OPEN")
        try:
            r = func(*args, **kwargs)
        except Exception:
            self.record_failure()
            raise
        else:
            self.record_success()
            return r

    async def acall(self, func: Callable, *args, **kwargs):
        """异步函数调用入口."""
        if not self.allow():
            self.stats_rejected += 1
            raise CircuitBreakerOpen(f"circuit '{self.name}' is OPEN")
        try:
            r = await func(*args, **kwargs)
        except Exception:
            self.record_failure()
            raise
        else:
            self.record_success()
            return r

    def reset(self):
        with self._lock:
            self._state = self.STATE_CLOSED
            self._failure_count = 0
            self._success_count = 0
            self._opened_at = None

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "name": self.name,
                "state": self._state,
                "failure_count": self._failure_count,
                "success_count": self._success_count,
                "stats": {
                    "open": self.stats_open,
                    "half_open": self.stats_half_open,
                    "rejected": self.stats_rejected,
                    "success": self.stats_success,
                    "failure": self.stats_failure,
                },
            }


# ---------------------------------------------------------------------------
# 熔断器注册中心
# ---------------------------------------------------------------------------
_registry_lock = threading.Lock()
_CIRCUITS: dict = {}


def get_circuit(name: str, **kwargs) -> CircuitBreaker:
    """获取或创建熔断器 (单例)."""
    with _registry_lock:
        if name not in _CIRCUITS:
            _CIRCUITS[name] = CircuitBreaker(name=name, **kwargs)
        return _CIRCUITS[name]


def circuit(name: str, **cb_kwargs):
    """装饰器: 自动为被装饰函数添加熔断器.

    用法:
        @circuit("payment", failure_threshold=3, reset_timeout=60)
        def call_payment_api(...):
            ...
    """
    cb = get_circuit(name, **cb_kwargs)

    def decorator(func: Callable) -> Callable:
        if asyncio.iscoroutinefunction(func):

            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                return await cb.acall(func, *args, **kwargs)

            return async_wrapper
        else:

            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                return cb.call(func, *args, **kwargs)

            return sync_wrapper

    return decorator


# ---------------------------------------------------------------------------
# TokenBucketRateLimit 令牌桶限流
# ---------------------------------------------------------------------------


class TokenBucketRateLimit:
    """令牌桶限流.

    - capacity: 桶容量 (瞬时可放行数)
    - refill_rate: 每秒补充令牌数
    """

    def __init__(self, name: str = "default", capacity: int = 100, refill_rate: float = 10.0):
        self.name = name
        self.capacity = capacity
        self.refill_rate = refill_rate
        self._tokens = float(capacity)
        self._last_refill = time.monotonic()
        self._lock = threading.Lock()
        self.stats_allowed = 0
        self.stats_rejected = 0

    def _refill(self):
        now = time.monotonic()
        delta = now - self._last_refill
        self._tokens = min(self.capacity, self._tokens + delta * self.refill_rate)
        self._last_refill = now

    def acquire(self, n: int = 1) -> bool:
        with self._lock:
            self._refill()
            if self._tokens >= n:
                self._tokens -= n
                self.stats_allowed += n
                return True
            self.stats_rejected += 1
            return False

    async def aacquire(self, n: int = 1) -> bool:
        """异步版 (可能短暂阻塞, 内部用 threading.Lock).

        用 run_in_threadpool 包装同步 acquire, 避免在事件循环线程中阻塞。
        """
        from starlette.concurrency import run_in_threadpool

        return await run_in_threadpool(self.acquire, n)

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "name": self.name,
                "capacity": self.capacity,
                "refill_rate": self.refill_rate,
                "current_tokens": self._tokens,
                "stats": {"allowed": self.stats_allowed, "rejected": self.stats_rejected},
            }


_LIMITERS: dict = {}


def get_limiter(name: str, **kwargs) -> TokenBucketRateLimit:
    with _registry_lock:
        if name not in _LIMITERS:
            _LIMITERS[name] = TokenBucketRateLimit(name=name, **kwargs)
        return _LIMITERS[name]


def rate_limit(name: str, capacity: int = 100, refill_rate: float = 10.0, on_reject=None):
    """装饰器: 令牌桶限流."""
    limiter = get_limiter(name, capacity=capacity, refill_rate=refill_rate)

    def decorator(func: Callable) -> Callable:
        if asyncio.iscoroutinefunction(func):

            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                if not limiter.acquire():
                    if on_reject:
                        if asyncio.iscoroutinefunction(on_reject):
                            return await on_reject()
                        return on_reject()
                    raise RuntimeError(f"rate limit exceeded for '{name}'")
                return await func(*args, **kwargs)

            return async_wrapper
        else:

            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                if not limiter.acquire():
                    if on_reject:
                        return on_reject()
                    raise RuntimeError(f"rate limit exceeded for '{name}'")
                return func(*args, **kwargs)

            return sync_wrapper

    return decorator


# ---------------------------------------------------------------------------
# degraded_mode 降级
# ---------------------------------------------------------------------------


def degraded_mode(fallback: Any = None, exceptions: tuple = (Exception,), log: bool = True):
    """装饰器: 调用失败时返回兜底值 (降级).

    用法:
        @degraded_mode(fallback=[], exceptions=(httpx.RequestError,))
        def fetch_recommendations(user_id):
            ...
    """

    def decorator(func: Callable) -> Callable:
        if asyncio.iscoroutinefunction(func):

            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    if log:
                        logger.warning(f"[degraded] {func.__name__} failed: {e}, returning fallback")
                    return fallback

            return async_wrapper
        else:

            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if log:
                        logger.warning(f"[degraded] {func.__name__} failed: {e}, returning fallback")
                    return fallback

            return sync_wrapper

    return decorator


# ---------------------------------------------------------------------------
# bulkhead 信号量隔离
# ---------------------------------------------------------------------------

_BULKHEADS: dict = {}


def get_bulkhead(name: str, max_concurrent: int = 10) -> asyncio.Semaphore:
    """获取或创建信号量隔离器 (异步)."""
    with _registry_lock:
        if name not in _BULKHEADS:
            _BULKHEADS[name] = asyncio.Semaphore(max_concurrent)
        return _BULKHEADS[name]


def bulkhead(name: str, max_concurrent: int = 10):
    """装饰器: 限制并发数 (异步函数专用)."""
    sem = get_bulkhead(name, max_concurrent)

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            async with sem:
                return await func(*args, **kwargs)

        return wrapper

    return decorator


# ---------------------------------------------------------------------------
# 超时包装
# ---------------------------------------------------------------------------


def with_timeout(timeout_sec: float):
    """装饰器: 给异步函数加超时 (超过抛 asyncio.TimeoutError)."""

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            return await asyncio.wait_for(func(*args, **kwargs), timeout=timeout_sec)

        return wrapper

    return decorator


# ---------------------------------------------------------------------------
# 全局状态导出 (用于 /healthz / 监控)
# ---------------------------------------------------------------------------


def all_snapshots() -> dict:
    return {
        "circuits": {n: c.snapshot() for n, c in _CIRCUITS.items()},
        "limiters": {n: l.snapshot() for n, l in _LIMITERS.items()},
    }
