"""Bug-69: 大模型调用熔断器 (Circuit Breaker).

状态机:
  - CLOSED: 正常调用
  - OPEN: 拒绝调用 (返回降级结果), 等待 N 秒后 → HALF_OPEN
  - HALF_OPEN: 放少量探测请求, 成功 → CLOSED, 失败 → OPEN

参数:
  - failure_threshold: 连续失败次数, 触发 OPEN
  - recovery_timeout: OPEN → HALF_OPEN 等待时间 (秒)
  - half_open_max_calls: HALF_OPEN 期最大并发探测
  - success_threshold: HALF_OPEN 连续成功 → CLOSED

使用:
    from app.utils.circuit_breaker import circuit_breaker, CircuitOpen

    cb = circuit_breaker("llm.chat", failure_threshold=3, recovery_timeout=30)

    async def chat():
        try:
            return await call_llm()
        except Exception:
            cb.record_failure()
            raise
"""

import asyncio
import logging
import threading
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_FAILURE_THRESHOLD = 5
DEFAULT_RECOVERY_TIMEOUT = 30.0
DEFAULT_HALF_OPEN_MAX_CALLS = 3
DEFAULT_SUCCESS_THRESHOLD = 2
DEFAULT_FALLBACK_VALUE: Any = None


class CircuitState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitOpen(Exception):
    """熔断器打开, 拒绝调用."""

    def __init__(self, name: str, until_ts: float):
        self.name = name
        self.until_ts = until_ts
        super().__init__(f"circuit '{name}' is OPEN, retry after {until_ts - time.time():.1f}s")


@dataclass
class CircuitStats:
    name: str
    state: CircuitState = CircuitState.CLOSED
    fail_count: int = 0
    success_count: int = 0
    half_open_calls: int = 0
    half_open_success: int = 0
    opened_at: float | None = None
    last_fail_at: float | None = None
    last_success_at: float | None = None
    total_calls: int = 0
    total_failures: int = 0
    total_short_circuits: int = 0

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "state": self.state.value,
            "fail_count": self.fail_count,
            "success_count": self.success_count,
            "half_open_calls": self.half_open_calls,
            "half_open_success": self.half_open_success,
            "opened_at": self.opened_at,
            "last_fail_at": self.last_fail_at,
            "last_success_at": self.last_success_at,
            "total_calls": self.total_calls,
            "total_failures": self.total_failures,
            "total_short_circuits": self.total_short_circuits,
        }


class CircuitBreaker:
    """单实例熔断器."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = DEFAULT_FAILURE_THRESHOLD,
        recovery_timeout: float = DEFAULT_RECOVERY_TIMEOUT,
        half_open_max_calls: int = DEFAULT_HALF_OPEN_MAX_CALLS,
        success_threshold: int = DEFAULT_SUCCESS_THRESHOLD,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        self.success_threshold = success_threshold
        self._stats = CircuitStats(name=name)
        self._lock = threading.Lock()
        self._half_open_lock = self._init_half_open_lock()

    def _init_half_open_lock(self):
        """延迟创建 asyncio.Lock, 避免在无 event loop 线程中初始化失败."""
        try:
            asyncio.get_event_loop()
            return asyncio.Lock()
        except RuntimeError:
            return None

    @property
    def stats(self) -> CircuitStats:
        return self._stats

    def _transition(self, to_state: CircuitState) -> None:
        if self._stats.state == to_state:
            return
        logger.info(f"circuit '{self.name}' {self._stats.state.value} -> {to_state.value}")
        self._stats.state = to_state
        if to_state == CircuitState.OPEN:
            self._stats.opened_at = time.time()
            try:
                from app.utils.alert_router import alert_warning

                alert_warning(
                    f"circuit_open:{self.name}",
                    f"Circuit '{self.name}' opened (fail_count={self._stats.fail_count})",
                )
            except Exception:
                logger.warning("Caught unexpected exception")
        elif to_state == CircuitState.CLOSED:
            self._stats.fail_count = 0
            self._stats.success_count = 0
            self._stats.half_open_calls = 0
            self._stats.half_open_success = 0
        elif to_state == CircuitState.HALF_OPEN:
            self._stats.half_open_calls = 0
            self._stats.half_open_success = 0

    def _maybe_half_open(self) -> None:
        if self._stats.state == CircuitState.OPEN and self._stats.opened_at is not None and time.time() - self._stats.opened_at >= self.recovery_timeout:
            self._transition(CircuitState.HALF_OPEN)

    def allow_request(self) -> bool:
        with self._lock:
            self._maybe_half_open()
            if self._stats.state == CircuitState.CLOSED:
                return True
            if self._stats.state == CircuitState.OPEN:
                self._stats.total_short_circuits += 1
                return False
            # HALF_OPEN
            if self._stats.half_open_calls >= self.half_open_max_calls:
                return False
            self._stats.half_open_calls += 1
            return True

    def record_success(self) -> None:
        with self._lock:
            self._stats.total_calls += 1
            self._stats.last_success_at = time.time()
            if self._stats.state == CircuitState.HALF_OPEN:
                self._stats.half_open_success += 1
                if self._stats.half_open_success >= self.success_threshold:
                    self._transition(CircuitState.CLOSED)
            elif self._stats.state == CircuitState.CLOSED:
                self._stats.success_count += 1
                # 连续成功清失败计数
                self._stats.fail_count = 0

    def record_failure(self) -> None:
        with self._lock:
            self._stats.total_calls += 1
            self._stats.total_failures += 1
            self._stats.last_fail_at = time.time()
            if self._stats.state == CircuitState.HALF_OPEN:
                # 探测失败 → 重新 OPEN
                self._transition(CircuitState.OPEN)
                return
            if self._stats.state == CircuitState.CLOSED:
                self._stats.fail_count += 1
                if self._stats.fail_count >= self.failure_threshold:
                    self._transition(CircuitState.OPEN)

    def reset(self) -> None:
        with self._lock:
            self._stats = CircuitStats(name=self.name)
            self._stats.state = CircuitState.CLOSED

    async def call(
        self,
        fn: Callable[..., Awaitable[Any]],
        *args,
        fallback: Any | None = DEFAULT_FALLBACK_VALUE,
        **kwargs,
    ) -> Any:
        """异步执行受熔断保护的操作."""
        if not self.allow_request():
            until = (self._stats.opened_at or 0) + self.recovery_timeout
            if fallback is not DEFAULT_FALLBACK_VALUE:
                return fallback
            raise CircuitOpen(self.name, until)
        try:
            r = await fn(*args, **kwargs)
            self.record_success()
            return r
        except Exception:
            self.record_failure()
            if fallback is not DEFAULT_FALLBACK_VALUE:
                return fallback
            raise

    def call_sync(
        self,
        fn: Callable[..., Any],
        *args,
        fallback: Any | None = DEFAULT_FALLBACK_VALUE,
        **kwargs,
    ) -> Any:
        if not self.allow_request():
            until = (self._stats.opened_at or 0) + self.recovery_timeout
            if fallback is not DEFAULT_FALLBACK_VALUE:
                return fallback
            raise CircuitOpen(self.name, until)
        try:
            r = fn(*args, **kwargs)
            self.record_success()
            return r
        except Exception:
            self.record_failure()
            if fallback is not DEFAULT_FALLBACK_VALUE:
                return fallback
            raise


# 全局熔断器注册表
_breakers: dict[str, CircuitBreaker] = {}
_breakers_lock = threading.Lock()


def circuit_breaker(
    name: str,
    failure_threshold: int = DEFAULT_FAILURE_THRESHOLD,
    recovery_timeout: float = DEFAULT_RECOVERY_TIMEOUT,
    half_open_max_calls: int = DEFAULT_HALF_OPEN_MAX_CALLS,
    success_threshold: int = DEFAULT_SUCCESS_THRESHOLD,
) -> CircuitBreaker:
    """拿 / 创建熔断器 (按 name 复用)."""
    with _breakers_lock:
        cb = _breakers.get(name)
        if cb is None:
            cb = CircuitBreaker(
                name=name,
                failure_threshold=failure_threshold,
                recovery_timeout=recovery_timeout,
                half_open_max_calls=half_open_max_calls,
                success_threshold=success_threshold,
            )
            _breakers[name] = cb
        return cb


def all_breakers() -> dict[str, CircuitStats]:
    with _breakers_lock:
        return {n: cb.stats for n, cb in _breakers.items()}


def reset_breaker(name: str) -> bool:
    with _breakers_lock:
        cb = _breakers.get(name)
        if cb is None:
            return False
        cb.reset()
        return True
