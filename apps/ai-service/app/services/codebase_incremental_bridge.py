# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""file_watcher 事件 → 增量索引的去抖桥(goal-b49 Z8,2026-11-05 立)。

读数(2026-11-05 现读,动用时按当次复核):生产**无人订阅** `FileWatcherRouter`
—— `subscribe_file_changes` 全仓命中仅 agent_engine 定义处与测试;唯一喂源 =
apply_patch 落盘后的 `dispatch_file_change`(门控 `ENGINE_FILE_WATCHER_ENABLED`,默认关);
`Receiver` 轮询循环在生产无人启动。本桥只提供**订阅方与排空面**(`tick()`):
调度挂点 = 承载 agent_engine 的常驻事件循环(交主席落地,见状态件 §④);
本模块不自起 daemon(§0.9:消费者 = tick() 本身,由测试与挂点真实驱动,
不留无消费者的抽象)。

增量单位 = `FileWatcherEvent.paths`(去抖批内的文件路径集合);
去抖窗口 = `window_s` + `clock` 注入(测试不靠 sleep,§0.3 三态:
批/暂无变更(idle,判过的)/开窗中/未判定——订阅缺失与畸形事件都出声并点名)。
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass
from pathlib import Path

from ..core.file_watcher import FileWatcherEvent, FileWatcherRouter, Subscription

logger = logging.getLogger(__name__)

DRAIN_BATCH = "batch"
DRAIN_IDLE = "idle"
DRAIN_WINDOW_OPEN = "window-open"
DRAIN_UNDETERMINED = "undetermined"
#: 档位清单单源:实现与用例都从这里取,不另写第二份(§0.6)。
DRAIN_KINDS: tuple[str, ...] = (DRAIN_BATCH, DRAIN_IDLE, DRAIN_WINDOW_OPEN, DRAIN_UNDETERMINED)

#: 去抖窗口默认值(秒);env 非法 ⇒ 出声回落默认(与索引租约窗口同纪律)。
DEFAULT_WATCH_WINDOW_S = 5.0
WATCH_WINDOW_ENV = "IHUI_INCREMENTAL_INDEX_WINDOW_S"


def _watch_window_seconds() -> float:
    raw = os.environ.get(WATCH_WINDOW_ENV)
    if raw is None or not raw.strip():
        return DEFAULT_WATCH_WINDOW_S
    try:
        return max(float(raw), 0.0)
    except ValueError:
        logger.warning(
            "%s=%r 不是数字,回落默认 %s", WATCH_WINDOW_ENV, raw, DEFAULT_WATCH_WINDOW_S
        )
        return DEFAULT_WATCH_WINDOW_S


@dataclass(frozen=True)
class DrainOutcome:
    """一次排空的结论:kind 在 DRAIN_KINDS 四档里,未判定必须带原委。"""

    kind: str
    paths: tuple[str, ...] = ()
    reason: str | None = None

    def __post_init__(self) -> None:
        if self.kind not in DRAIN_KINDS:
            raise ValueError(f"排空档位 {self.kind!r} 不在 DRAIN_KINDS 里")


class DebouncedEventDrain:
    """把 Subscription.queue 里的事件按去抖窗合并成批。

    畸形载荷(非 FileWatcherEvent / 空 paths / 非字符串条目)⇒ 该条弃判并记原委:
    纯畸形 ⇒ `undetermined`(不冒充"没有变更");畸形与良构并存 ⇒ 批照常下发、
    原委挂在 reason 上(不吞数据也不哑报)。
    """

    def __init__(
        self,
        subscription: Subscription | None,
        *,
        window_s: float | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._sub = subscription
        self._window_s = window_s if window_s is not None else _watch_window_seconds()
        self._clock = clock
        self._pending: set[str] = set()
        self._deadline: float | None = None
        self._malformed: list[str] = []

    def drain(self) -> DrainOutcome:
        if self._sub is None:
            return DrainOutcome(
                DRAIN_UNDETERMINED,
                reason="订阅不存在(file_watcher 未启用/构造失败)⇒ 未判定,不得读成「没有变更」",
            )
        while True:
            try:
                event = self._sub.queue.get_nowait()
            except asyncio.QueueEmpty:
                break
            if not isinstance(event, FileWatcherEvent):
                self._malformed.append(f"队列里出现非 FileWatcherEvent 载荷({type(event).__name__})⇒ 弃判")
                continue
            if not event.paths or not all(isinstance(p, str) and p for p in event.paths):
                self._malformed.append(f"事件 paths 形态不合({event.paths!r})⇒ 弃判")
                continue
            self._pending.update(event.paths)
        note = ";".join(self._malformed) if self._malformed else None
        if not self._pending:
            if note is not None:
                self._malformed.clear()
                return DrainOutcome(DRAIN_UNDETERMINED, reason=note)
            return DrainOutcome(DRAIN_IDLE)
        if self._deadline is None:
            self._deadline = self._clock() + self._window_s
        if self._clock() >= self._deadline:
            batch = tuple(sorted(self._pending))
            self._pending.clear()
            self._deadline = None
            self._malformed.clear()
            return DrainOutcome(DRAIN_BATCH, paths=batch, reason=note)
        return DrainOutcome(DRAIN_WINDOW_OPEN, reason=note)


class IncrementalIndexBridge:
    """订阅 router(命中 repo 根的变更)→ 去抖 → 批回调(index_changed_paths)。

    `router=None`(引擎门控 off / 构造失败)⇒ tick 恒 `undetermined` 并点名,
    调用方据此走全量兜底,绝不被读成"没有变更"。
    """

    def __init__(
        self,
        router: FileWatcherRouter | None,
        repo_roots: Iterable[str | Path],
        index_run: Callable[[tuple[str, ...]], Awaitable[object]],
        *,
        window_s: float | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        subscription = (
            router.subscribe([str(Path(r)) for r in repo_roots]) if router is not None else None
        )
        self._subscription = subscription
        self._drain = DebouncedEventDrain(subscription, window_s=window_s, clock=clock)
        self._index_run = index_run

    @property
    def subscription(self) -> Subscription | None:
        return self._subscription

    @property
    def drain(self) -> DebouncedEventDrain:
        return self._drain

    async def tick(self) -> DrainOutcome:
        """消费面唯一入口:排空 → 命中批则下发 index_run;其余档只回结论不产生副作用。"""
        outcome = self._drain.drain()
        if outcome.kind == DRAIN_BATCH:
            await self._index_run(outcome.paths)
        return outcome


# 供主席接线的一行示例(刻意**不**在本模块自动订阅,防无调度器的悬空消费者):
#   bridge = IncrementalIndexBridge(
#       engine._file_watcher_router_or_none(), [repo_root],
#       lambda paths: index_changed_paths(codebase_indexer, repo_root, paths),
#   )
#   await bridge.tick()  # 挂在 agent_engine 常驻循环上(周期或 dispatch 后同步排空)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
