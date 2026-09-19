# app/core/startup_prewarm.py
"""会话启动预热(2026-09-19 第三十批,对标 Codex session_startup_prewarm.rs)。

线程创建即后台发起连接预热(如到 LLM 网关的 TCP/TLS/握手),首个回合到来时
**限时兑现**:命中则零连接延迟起跑,超时/取消/失败则静默降级——
首回合永远不等一个未就绪的预热(Codex resolve 语义):

- **三态兑现**(SessionStartupPrewarmResolution):
  - ``ready``:预热完成,首回合直接复用;
  - ``timed_out``:超过剩余预算(总超时 − 已流逝时间),中止任务并降级;
  - ``cancelled``:会话被取消(用户中断),任务中止;
  - ``unavailable``:预热任务本身失败(带 status 与耗时);
- **age_at_first_turn**:预热发起至首回合的时延,供指标上报
  (对标 STARTUP_PREWARM_AGE_AT_FIRST_TURN_METRIC);
- **abort 安全**:abandon(丢弃句柄)时底层任务被取消,不泄漏后台协程。

预热体是调用方注入的异步工厂 ``async () -> T``(如网关连接句柄),
本模块与具体协议解耦。
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Any, Callable, Coroutine, Generic, Optional, TypeVar

T = TypeVar("T")


@dataclass
class PrewarmResolution(Generic[T]):
    status: str  # "ready" | "timed_out" | "cancelled" | "unavailable"
    value: Optional[T] = None
    prewarm_duration_ms: Optional[int] = None
    age_at_first_turn_ms: Optional[int] = None
    error: Optional[str] = None

    @property
    def ready(self) -> bool:
        return self.status == "ready"


class StartupPrewarmHandle(Generic[T]):
    """一个启动预热任务的句柄(对标 SessionStartupPrewarmHandle)。"""

    def __init__(
        self,
        task: "asyncio.Task[Any]",
        started_at: float,
        timeout: float,
    ) -> None:
        self._task = task
        self._started_at = started_at
        self._timeout = timeout

    @property
    def finished(self) -> bool:
        return self._task.done()

    async def resolve(self) -> PrewarmResolution[T]:
        """限时兑现:剩余预算 = 总超时 − 预热已流逝时间。"""
        resolve_started = time.perf_counter()
        age = resolve_started - self._started_at
        age_ms = int(age * 1000)
        remaining = self._timeout - age
        if remaining <= 0 and not self._task.done():
            self._task.cancel()
            return PrewarmResolution(
                status="timed_out",
                prewarm_duration_ms=int(age_ms),
                age_at_first_turn_ms=age_ms,
            )
        try:
            value = await asyncio.wait_for(asyncio.shield(self._task), timeout=max(0.0, remaining))
            return PrewarmResolution(
                status="ready",
                value=value,
                prewarm_duration_ms=int((time.perf_counter() - self._started_at) * 1000),
                age_at_first_turn_ms=age_ms,
            )
        except asyncio.TimeoutError:
            self._task.cancel()
            return PrewarmResolution(
                status="timed_out",
                prewarm_duration_ms=int((time.perf_counter() - self._started_at) * 1000),
                age_at_first_turn_ms=age_ms,
            )
        except asyncio.CancelledError:
            return PrewarmResolution(
                status="cancelled",
                prewarm_duration_ms=int((time.perf_counter() - self._started_at) * 1000),
                age_at_first_turn_ms=age_ms,
            )
        except Exception as e:  # noqa: BLE001 - 预热失败降级
            return PrewarmResolution(
                status="unavailable",
                prewarm_duration_ms=int((time.perf_counter() - self._started_at) * 1000),
                age_at_first_turn_ms=age_ms,
                error=str(e),
            )

    async def abort(self) -> None:
        """中止并等待任务结束(对标 SessionStartupPrewarmHandle::abort)。"""
        self._task.cancel()
        try:
            await self._task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass


def start_startup_prewarm(
    factory: Callable[[], "Coroutine[Any, Any, T]"],
    *,
    timeout: float = 10.0,
) -> StartupPrewarmHandle[T]:
    """线程创建时调用:后台发起预热,返回可兑现句柄。"""
    started_at = time.perf_counter()
    task: asyncio.Task[T] = asyncio.get_running_loop().create_task(factory())
    return StartupPrewarmHandle(task, started_at, timeout)
