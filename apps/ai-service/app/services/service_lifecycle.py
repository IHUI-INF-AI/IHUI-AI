# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""服务生命周期编排三件套 — 统一实现 桌面端 ``CodexMicroService`` 模式。

设计依据
--------
``内部规格`` §3 微服务编排
(60 个 ``*Service``) 对复用价值的排序结论::

    「微服务编排模式(CodexMicroService: start/stop/dispose + ensureConnected
    + reconcile + RPC retry) —— 可移植到本仓 ai-service 的服务生命周期管理,
    尤其 RPC 重试与拓扑对账两套模式。」

设计要点（本仓实现）
--------------------
Codex 用这套三件套管理 60+ 命名服务的生命周期。本仓此前把 ``reconcile`` /
``retry`` 散布在 agent_orchestrator / local_provider_health 等各业务点, 缺一个
**通用、可复用的生命周期基座**。本模块抽出三个正交关注点:

1. **ensure_connected** — 懒初始化 + 幂等: 多协程并发请求时只初始化一次,
   后续调用复用; 初始化失败可重试。
2. **reconcile** — 期望态对账: 对比 desired 与 actual, 产出最小变更动作集,
   幂等可重放(对账逻辑是纯函数, 不做 IO)。
3. **rpc_retry** — 瞬态错误重试: 指数退避 + 抖动, 只对声明为可重试的异常/状态重试。

安全与边界
----------
本模块只提供**控制平面**逻辑, 不内置任何业务语义; 不持有凭据; reconcile 的
期望态/实际态由调用方提供, 本模块不推断。
"""

from __future__ import annotations

import asyncio
import random
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass
from typing import Any, TypeVar

__all__ = [
    "RetryPolicy",
    "RetryExhaustedError",
    "is_transient_status",
    "rpc_retry",
    "ServiceLifecycle",
    "plan_reconcile",
    "ReconcileAction",
]

T = TypeVar("T")

# ---------------------------------------------------------------------------
# RPC 重试
# ---------------------------------------------------------------------------
# 视为瞬态、可重试的 HTTP 状态码(取证: Codex 微服务对 5xx/429 做重试)。
TRANSIENT_STATUS_CODES: frozenset[int] = frozenset(
    {408, 409, 425, 429, 500, 502, 503, 504, 522, 524}
)


def is_transient_status(status_code: int) -> bool:
    """判断 HTTP 状态码是否属瞬态可重试。"""
    return status_code in TRANSIENT_STATUS_CODES


@dataclass(frozen=True)
class RetryPolicy:
    """RPC 重试策略: 指数退避 + 全抖动。"""

    max_attempts: int = 4
    base_delay_s: float = 0.2
    max_delay_s: float = 8.0
    multiplier: float = 2.0
    # 返回 True 表示该异常可重试; 默认只重试 ConnectionError/TimeoutError。
    retryable: Callable[[BaseException], bool] | None = None

    def is_retryable(self, exc: BaseException) -> bool:
        if self.retryable is not None:
            return self.retryable(exc)
        return isinstance(exc, (ConnectionError, TimeoutError))

    def delay_for(self, attempt: int, rng: random.Random | None = None) -> float:
        """第 attempt 次失败后的退避时长(0-based attempt)。全抖动。"""
        raw = min(self.base_delay_s * (self.multiplier**attempt), self.max_delay_s)
        r = rng or random
        return r.uniform(0.0, raw)


class RetryExhaustedError(RuntimeError):
    """重试次数用尽。携带最后一次异常与尝试次数。"""

    def __init__(self, attempts: int, last_exc: BaseException) -> None:
        self.attempts = attempts
        self.last_exc = last_exc
        super().__init__(
            f"rpc_retry exhausted after {attempts} attempts: {last_exc!r}"
        )


async def rpc_retry[T](
    op: Callable[[], Awaitable[T]],
    policy: RetryPolicy | None = None,
    *,
    rng: random.Random | None = None,
    sleep: Callable[[float], Awaitable[None]] | None = None,
) -> T:
    """执行 ``op`` 并按策略对瞬态失败重试。

    ``sleep`` 与 ``rng`` 可注入, 便于单测确定化。成功即返回; 重试耗尽抛
    :class:`RetryExhaustedError`。
    """
    pol = policy or RetryPolicy()
    do_sleep = sleep or asyncio.sleep
    last_exc: BaseException | None = None
    for attempt in range(pol.max_attempts):
        try:
            return await op()
        except BaseException as exc:  # noqa: BLE001 - 按策略判定是否重试
            last_exc = exc
            if not pol.is_retryable(exc):
                raise
            # 还有下一次机会才退避; 否则循环结束抛 RetryExhaustedError
            if attempt + 1 < pol.max_attempts:
                await do_sleep(pol.delay_for(attempt, rng))
    assert last_exc is not None
    raise RetryExhaustedError(pol.max_attempts, last_exc)


# ---------------------------------------------------------------------------
# 期望态对账
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class ReconcileAction:
    """单条对账动作: add / update / remove。"""

    kind: str  # "add" | "update" | "remove"
    key: str
    desired: Any = None
    actual: Any = None


def plan_reconcile(
    desired: dict[str, Any],
    actual: dict[str, Any],
    *,
    equal: Callable[[Any, Any], bool] | None = None,
) -> list[ReconcileAction]:
    """对比期望态与实际态, 产出**最小**变更动作集(纯函数, 幂等)。

    - desired 有、actual 无 → add
    - 两者都有但值不等 → update
    - actual 有、desired 无 → remove
    纯函数: 不修改入参, 同输入恒同输出。``equal`` 可自定义值比较。
    """
    eq = equal or (lambda a, b: a == b)
    actions: list[ReconcileAction] = []
    for key in desired:
        d = desired[key]
        if key not in actual:
            actions.append(ReconcileAction("add", key, desired=d))
        elif not eq(d, actual[key]):
            actions.append(
                ReconcileAction("update", key, desired=d, actual=actual[key])
            )
    for key in actual:
        if key not in desired:
            actions.append(ReconcileAction("remove", key, actual=actual[key]))
    # 稳定排序: add → update → remove, 同类内按 key, 便于重放确定性
    order = {"add": 0, "update": 1, "remove": 2}
    actions.sort(key=lambda a: (order[a.kind], a.key))
    return actions


# ---------------------------------------------------------------------------
# 服务生命周期基座
# ---------------------------------------------------------------------------
class ServiceLifecycle:
    """通用服务生命周期: 懒连接 + 状态机(start/stop/dispose)。

    ``connect`` 由子类/调用方注入, 做真正的初始化(如建连接、拉配置)。
    :meth:`ensure_connected` 保证并发下只连接一次; 失败可重试。
    """

    def __init__(
        self,
        name: str,
        connect: Callable[[], Awaitable[T]] | None = None,
        disconnect: Callable[[T], Awaitable[None]] | None = None,
    ) -> None:
        self.name = name
        self._connect = connect
        self._disconnect = disconnect
        self._conn: T | None = None
        self._conn_lock = asyncio.Lock()
        self._connected = False
        self._disposed = False

    @property
    def connected(self) -> bool:
        return self._connected

    async def ensure_connected(self) -> T:
        """懒连接, 并发幂等: 多协程同时调用只触发一次 ``connect``。"""
        if self._disposed:
            raise RuntimeError(f"service {self.name!r} already disposed")
        if self._connected and self._conn is not None:
            return self._conn
        async with self._conn_lock:
            # 双检: 拿到锁后可能已被前一个协程连好
            if self._connected and self._conn is not None:
                return self._conn
            if self._connect is None:
                raise RuntimeError(f"service {self.name!r} has no connect()")

            async def _op() -> T:
                assert self._connect is not None
                return await self._connect()

            self._conn = await rpc_retry(_op)
            self._connected = True
            return self._conn

    async def stop(self) -> None:
        """断开连接(幂等), 不标记 disposed, 可再次 ensure_connected。"""
        async with self._conn_lock:
            if self._conn is not None and self._disconnect is not None:
                await self._disconnect(self._conn)
            self._conn = None
            self._connected = False

    async def dispose(self) -> None:
        """断开并标记终止, 之后 ensure_connected 抛错。"""
        await self.stop()
        self._disposed = True


# ---------------------------------------------------------------------------
# reconcile 应用于动作列表的纯 helper(便于测试与重放)
# ---------------------------------------------------------------------------
def apply_reconcile(
    actual: dict[str, Any], actions: Iterable[ReconcileAction]
) -> dict[str, Any]:
    """把动作集应用到 actual 副本, 返回新 dict(不改入参)。"""
    out = dict(actual)
    for a in actions:
        if a.kind == "add" or a.kind == "update":
            out[a.key] = a.desired
        elif a.kind == "remove":
            out.pop(a.key, None)
    return out
