"""影子流量异步比对器 (建议 120).

设计:
  - 周期性聚合 ShadowRouter 产出的比对记录
  - 输出 3 档分级: 完全一致 / 字段级 diff / 数量级 diff
  - 5 分钟窗口聚合
  - 上报: Loki (loguru JSON) + Prometheus Counter

使用:
    from app.shadow_traffic import get_default_router
    from app.shadow_compare import ShadowCompareAggregator

    router = get_default_router()
    agg = ShadowCompareAggregator(router=router, window_sec=300)
    await agg.start()  # 后台 task
    ...
    await agg.stop()
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field

try:
    from loguru import logger as _loguru_logger
except Exception:
    _loguru_logger = None  # type: ignore

import contextlib

from app.shadow_traffic import DiffKind, ShadowRouter

# ---------------------------------------------------------------------------
# 聚合档位
# ---------------------------------------------------------------------------


@dataclass
class CompareBucket:
    """一个时间窗口内的比对聚合."""

    window_start: float = 0.0
    window_end: float = 0.0
    total: int = 0
    match: int = 0
    mismatch: int = 0
    by_kind: dict = field(default_factory=dict)
    by_tenant: dict = field(default_factory=dict)
    by_endpoint: dict = field(default_factory=dict)

    @property
    def match_rate(self) -> float:
        if self.total == 0:
            return 1.0
        return self.match / self.total

    @property
    def mismatch_rate(self) -> float:
        if self.total == 0:
            return 0.0
        return self.mismatch / self.total

    @property
    def grade(self) -> str:
        """3 档分级: complete / field / magnitude / clean."""
        if self.mismatch == 0:
            return "clean"
        r = self.mismatch_rate
        # 数量级 diff 占比
        magnitude = self.by_kind.get("length", 0) + self.by_kind.get("keys", 0)
        if r > 0.10:
            return "magnitude"  # 数量级不一致 (大量字段/数量差异)
        if magnitude > 0:
            return "field"  # 字段级不一致
        return "body"  # 纯 body hash 不一致


class ShadowCompareAggregator:
    """周期性聚合 ShadowRouter 的历史比对记录.

    用法:
        agg = ShadowCompareAggregator(router, window_sec=300, interval_sec=60)
        await agg.start()       # 后台 task
        # ... 业务运行 ...
        await agg.stop()
        report = agg.get_last_report()
    """

    def __init__(self, router: ShadowRouter, window_sec: float = 300.0, interval_sec: float = 60.0):
        self.router = router
        self.window_sec = window_sec
        self.interval_sec = interval_sec
        self._task: asyncio.Task | None = None
        # _stop 统一在 start() 中创建, 避免在无事件循环时构造 asyncio.Event
        self._stop: asyncio.Event | None = None
        self._last_report: CompareBucket | None = None
        self._reports: list[CompareBucket] = []
        self._max_reports = 100
        # 记录上次聚合时的 history 长度 (增量聚合)
        self._last_history_idx = 0

    async def start(self) -> None:
        if self._task is not None:
            return
        self._stop = asyncio.Event()
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._stop is not None:
            self._stop.set()
        if self._task is not None:
            with contextlib.suppress(TimeoutError, asyncio.CancelledError):
                await asyncio.wait_for(self._task, timeout=self.interval_sec + 5)
            self._task = None

    async def _loop(self) -> None:
        assert self._stop is not None
        while not self._stop.is_set():
            try:
                await self.aggregate_once()
            except Exception as e:
                if _loguru_logger is not None:
                    with contextlib.suppress(Exception):
                        _loguru_logger.warning(f"[shadow_compare] aggregate failed: {e}")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.interval_sec)
            except TimeoutError:
                continue

    def aggregate_once(self) -> CompareBucket:
        """跑一次窗口聚合 (同步, 方便测试)."""
        now = time.time()
        window_start = now - self.window_sec
        history = self.router.get_history_snapshot()
        # 只看 [last_idx, end) 区间增量 (避免重复计算)
        new_records = history[self._last_history_idx :]
        self._last_history_idx = len(history)

        bucket = CompareBucket(window_start=window_start, window_end=now)
        for c in new_records:
            if c.timestamp < window_start:
                continue
            bucket.total += 1
            k = c.diff_kind.value
            bucket.by_kind[k] = bucket.by_kind.get(k, 0) + 1
            t = c.tenant_id
            bucket.by_tenant[t] = bucket.by_tenant.get(t, 0) + 1
            e = c.endpoint
            bucket.by_endpoint[e] = bucket.by_endpoint.get(e, 0) + 1
            if c.diff_kind == DiffKind.MATCH:
                bucket.match += 1
            elif c.diff_kind != DiffKind.SKIP:
                bucket.mismatch += 1

        self._last_report = bucket
        self._reports.append(bucket)
        if len(self._reports) > self._max_reports:
            self._reports = self._reports[-self._max_reports :]

        # 上报 (Loki / Prom)
        if bucket.total > 0:
            self._emit(bucket)
        return bucket

    def _emit(self, bucket: CompareBucket) -> None:
        """上报聚合结果."""
        if _loguru_logger is None:
            return
        with contextlib.suppress(Exception):
            _loguru_logger.bind(
                shadow_window_start=bucket.window_start,
                shadow_window_end=bucket.window_end,
                shadow_total=bucket.total,
                shadow_match=bucket.match,
                shadow_mismatch=bucket.mismatch,
                shadow_grade=bucket.grade,
                shadow_by_kind=str(bucket.by_kind),
            ).info(
                f"[shadow_compare] {bucket.total} compares, {bucket.grade} grade, "
                f"match={bucket.match}, mismatch={bucket.mismatch}"
            )

    def get_last_report(self) -> CompareBucket | None:
        return self._last_report

    def get_reports(self, last: int = 10) -> list[CompareBucket]:
        return list(self._reports[-last:])
