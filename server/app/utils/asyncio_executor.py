"""Bug-101: 异步执行器 (业务线程池 / IO 线程池分离).

设计:
  - 提供"业务池"(CPU bound) 和 "IO 池" 分离
  - 队列满时降级 (丢弃 / 阻塞 / 转交其它池)
  - 提供 contextvars 隔离 (业务 trace_id 不串)
  - 统计: 总提交 / 完成 / 失败 / 拒绝 / 队列峰值
  - 优雅关闭: drain + timeout
"""

import logging
import queue
import threading
import time
import uuid
from collections.abc import Callable
from concurrent.futures import Future
from contextvars import copy_context
from dataclasses import dataclass
from enum import StrEnum
from typing import Optional

logger = logging.getLogger(__name__)


class OverflowPolicy(StrEnum):
    BLOCK = "block"  # 阻塞提交直到有空位
    DROP = "drop"  # 丢弃新任务
    DEGRADE = "degrade"  # 降级到 default 池
    RAISE = "raise"  # 抛异常


@dataclass
class PoolStats:
    submitted: int = 0
    completed: int = 0
    failed: int = 0
    rejected: int = 0
    degraded: int = 0
    queue_peak: int = 0
    active: int = 0
    total_threads: int = 0
    overflow_count: int = 0

    def to_dict(self) -> dict:
        return self.__dict__.copy()


class IsolatedExecutor:
    """隔离的线程池: 含队列 + 溢出策略 + 统计."""

    def __init__(
        self,
        name: str,
        max_workers: int = 4,
        max_queue: int = 1000,
        overflow: OverflowPolicy = OverflowPolicy.BLOCK,
        default_executor: Optional["IsolatedExecutor"] = None,
    ):
        self.name = name
        self._max_workers = max_workers
        self._max_queue = max_queue
        self._overflow = overflow
        self._default = default_executor
        self._queue: queue.Queue = queue.Queue(maxsize=max_queue)
        self._stop = threading.Event()
        self._workers: list[threading.Thread] = []
        self._lock = threading.Lock()
        self._stats = PoolStats()
        self._start_workers()

    def _start_workers(self) -> None:
        for i in range(self._max_workers):
            t = threading.Thread(
                target=self._worker_loop,
                name=f"{self.name}-w{i}",
                daemon=True,
            )
            t.start()
            self._workers.append(t)
        self._stats.total_threads = len(self._workers)

    def _worker_loop(self) -> None:
        while not self._stop.is_set():
            try:
                item = self._queue.get(timeout=0.5)
            except queue.Empty:
                continue
            if item is None:
                self._queue.task_done()
                break
            _task_id, ctx, fn, args, kwargs, fut = item
            self._stats.active += 1
            try:
                if ctx is not None:
                    ctx.run(lambda: None)  # noop
                    result = self._run_in_ctx(ctx, fn, args, kwargs)
                else:
                    result = fn(*args, **kwargs)
                if fut is not None and not fut.done():
                    fut.set_result(result)
                self._stats.completed += 1
            except Exception as e:
                if fut is not None and not fut.done():
                    fut.set_exception(e)
                self._stats.failed += 1
                logger.warning("executor %s task failed: %s", self.name, e)
            finally:
                self._stats.active -= 1
                self._queue.task_done()

    @staticmethod
    def _run_in_ctx(ctx, fn, args, kwargs):
        return ctx.run(lambda: fn(*args, **kwargs))

    def submit(
        self,
        fn: Callable,
        *args,
        timeout: float | None = None,
        _future: bool = False,
        **kwargs,
    ):
        task_id = uuid.uuid4().hex[:8]
        fut: Future | None = Future() if _future else None
        ctx = copy_context()
        item = (task_id, ctx, fn, args, kwargs, fut)
        try:
            self._queue.put(item, timeout=timeout)
            self._stats.submitted += 1
            cur = self._queue.qsize()
            if cur > self._stats.queue_peak:
                self._stats.queue_peak = cur
        except queue.Full:
            self._stats.rejected += 1
            self._stats.overflow_count += 1
            if self._overflow == OverflowPolicy.DROP:
                return None
            if self._overflow == OverflowPolicy.RAISE:
                raise queue.Full(f"{self.name} queue full") from None
            if self._overflow == OverflowPolicy.DEGRADE and self._default is not None:
                self._stats.degraded += 1
                return self._default.submit(fn, *args, _future=_future, **kwargs)
            # BLOCK 模式
            try:
                self._queue.put(item, timeout=timeout or 5.0)
                self._stats.submitted += 1
            except queue.Full:
                self._stats.rejected += 1
                if fut is not None and not fut.done():
                    fut.set_exception(queue.Full("hard full"))
        if fut is not None:
            return fut
        return None

    def submit_future(self, fn: Callable, *args, **kwargs) -> Future:
        return self.submit(fn, *args, _future=True, **kwargs)

    def map(self, fn: Callable, items: list, timeout: float | None = None) -> list:
        futs = [self.submit_future(fn, x) for x in items]
        return [f.result(timeout=timeout) for f in futs]

    def qsize(self) -> int:
        return self._queue.qsize()

    def stats(self) -> dict:
        d = self._stats.to_dict()
        d["name"] = self.name
        d["max_workers"] = self._max_workers
        d["max_queue"] = self._max_queue
        d["overflow"] = self._overflow.value
        d["qsize"] = self._queue.qsize()
        return d

    def shutdown(self, wait: bool = True, timeout: float = 10.0) -> None:
        self._stop.set()
        if wait:
            deadline = time.time() + timeout
            for w in self._workers:
                remaining = max(0.0, deadline - time.time())
                w.join(timeout=remaining)
        # drain queue
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
            except queue.Empty:
                break


class AsyncioExecutorBundle:
    """业务线程池 + IO 线程池组合."""

    def __init__(
        self,
        biz_workers: int = 8,
        io_workers: int = 32,
        max_queue: int = 2000,
    ):
        self.io = IsolatedExecutor(
            name="io",
            max_workers=io_workers,
            max_queue=max_queue,
            overflow=OverflowPolicy.BLOCK,
        )
        self.biz = IsolatedExecutor(
            name="biz",
            max_workers=biz_workers,
            max_queue=max_queue,
            overflow=OverflowPolicy.DEGRADE,
            default_executor=None,
        )
        # 业务池溢出降级到 io 池
        self.biz._default = self.io

    def submit_io(self, fn, *args, **kwargs):
        return self.io.submit(fn, *args, **kwargs)

    def submit_io_future(self, fn, *args, **kwargs):
        return self.io.submit_future(fn, *args, **kwargs)

    def submit_biz(self, fn, *args, **kwargs):
        return self.biz.submit(fn, *args, **kwargs)

    def submit_biz_future(self, fn, *args, **kwargs):
        return self.biz.submit_future(fn, *args, **kwargs)

    def stats(self) -> dict:
        return {
            "io": self.io.stats(),
            "biz": self.biz.stats(),
        }

    def shutdown(self, wait: bool = True, timeout: float = 10.0) -> None:
        self.biz.shutdown(wait=wait, timeout=timeout)
        self.io.shutdown(wait=wait, timeout=timeout)


# 全局单例
executor_bundle = AsyncioExecutorBundle()
