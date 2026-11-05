# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""file_watcher→增量索引去抖桥用例(goal-b49 Z8)。

钉死三格:
1. 订阅缺失(router=None)⇒ undetermined 并点名,零副作用(不冒充"没有变更");
2. 畸形事件(空 paths / 非 FileWatcherEvent)⇒ undetermined 点名;畸形+良构并存
   ⇒ 批照常下发且原委挂在 reason(不吞数据也不哑报);
3. 去抖:窗口内多次变更只在过窗后重算一次(注入时钟,不靠 sleep)。
"""

from __future__ import annotations

import pytest

from app.core.file_watcher import FileWatcherEvent, FileWatcherRouter
from app.services.codebase_incremental_bridge import (
    DRAIN_BATCH,
    DRAIN_IDLE,
    DRAIN_KINDS,
    DRAIN_UNDETERMINED,
    DRAIN_WINDOW_OPEN,
    DebouncedEventDrain,
    DrainOutcome,
    IncrementalIndexBridge,
)


class _Clock:
    def __init__(self) -> None:
        self.t = 0.0

    def __call__(self) -> float:
        return self.t

    def advance(self, dt: float) -> None:
        self.t += dt


async def _noop(paths):
    return None


def test_drain_kinds_single_source():
    assert DRAIN_KINDS == ("batch", "idle", "window-open", "undetermined")
    with pytest.raises(ValueError):
        DrainOutcome(kind="nope")


@pytest.mark.asyncio
async def test_missing_subscription_speaks_undetermined(tmp_path):
    calls: list[tuple[str, ...]] = []

    async def _run(paths):
        calls.append(paths)

    bridge = IncrementalIndexBridge(None, [tmp_path], index_run=_run)
    assert bridge.subscription is None
    out = await bridge.tick()
    assert out.kind == DRAIN_UNDETERMINED
    assert "未判定" in out.reason  # 点名原委
    assert calls == []  # 断言副作用没发生


@pytest.mark.asyncio
async def test_malformed_events_are_named_not_silent(tmp_path):
    router = FileWatcherRouter()
    drain = DebouncedEventDrain(router.subscribe([tmp_path]), window_s=0.0, clock=_Clock())
    sub = drain._sub

    sub.queue.put_nowait(FileWatcherEvent(paths=()))  # 空批事件:形态不合
    out = drain.drain()
    assert out.kind == DRAIN_UNDETERMINED and "paths" in out.reason

    sub.queue.put_nowait(object())  # 非事件载荷
    out = drain.drain()
    assert out.kind == DRAIN_UNDETERMINED and "FileWatcherEvent" in out.reason

    # 畸形与良构并存:良构路径不吞,原委仍点名
    good = str(tmp_path / "f.py")
    sub.queue.put_nowait(FileWatcherEvent(paths=("",)))
    router.dispatch(FileWatcherEvent(paths=(good,)))
    out = drain.drain()
    assert out.kind == DRAIN_BATCH and out.paths == (good,)
    assert out.reason and "形态不合" in out.reason


@pytest.mark.asyncio
async def test_idle_is_a_verdict_not_invented(tmp_path):
    """队列确空且无挂起 ⇒ idle(判过的"暂无变更"),与 undetermined 分档。"""
    drain = DebouncedEventDrain(FileWatcherRouter().subscribe([tmp_path]), window_s=1.0, clock=_Clock())
    assert drain.drain().kind == DRAIN_IDLE


@pytest.mark.asyncio
async def test_debounce_window_merges_to_single_recompute(tmp_path):
    router = FileWatcherRouter()
    clock = _Clock()
    calls: list[tuple[str, ...]] = []

    async def _run(paths):
        calls.append(paths)

    bridge = IncrementalIndexBridge(
        router, [tmp_path], index_run=_run, window_s=2.0, clock=clock
    )
    p1 = str(tmp_path / "f1.py")
    p2 = str(tmp_path / "f2.py")
    p3 = str(tmp_path / "f3.py")

    router.dispatch(FileWatcherEvent(paths=(p1,)))
    assert (await bridge.tick()).kind == DRAIN_WINDOW_OPEN  # 开窗,未过窗⇒不重算

    router.dispatch(FileWatcherEvent(paths=(p2,)))
    clock.advance(1.0)
    assert (await bridge.tick()).kind == DRAIN_WINDOW_OPEN  # 窗口内第二次变更⇒仍未重算

    router.dispatch(FileWatcherEvent(paths=(p1, p3)))  # 重复路径 p1 应被并掉
    clock.advance(1.6)  # t=2.6 ≥ deadline(2.0)
    out = await bridge.tick()
    assert out.kind == DRAIN_BATCH
    assert out.paths == tuple(sorted([p1, p2, p3]))  # 合并去重排序成一批
    assert calls == [tuple(sorted([p1, p2, p3]))]  # 短时间三次变更⇒只重算一次

    assert (await bridge.tick()).kind == DRAIN_IDLE  # 批后清账:判过的"暂无变更"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
