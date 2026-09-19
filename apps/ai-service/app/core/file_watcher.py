# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""文件监听订阅路由(2026-09-19 第二十二批,对标 Codex file-watcher crate)。

语义忠实移植:
- FileWatcherEvent:粗粒度变更事件(只带变更路径集合,不带细节)
- Receiver:异步逐事件接收;本实现用轮询扫描(mtime+size+存在性)驱动,
  不引入第三方 watch 依赖,事件粒度与 codex notify 版一致(路径集合)
- ThrottledWatchReceiver:两次产出之间强制最小间隔(限流)
- DebouncedWatchReceiver:首个事件后开窗,窗口内到达的路径合并成一批(防抖)
- Subscription:订阅方持有 watched 路径集合,路由层只把命中事件发给匹配订阅方

取舍:codex 底层用 notify(inotify/FSEvents/ReadDirectoryChangesW);我方为
零依赖自包含,用轮询近似,Event 粒度与节流/防抖组合语义完全一致。
"""

from __future__ import annotations

import asyncio
import os
import time
from collections.abc import AsyncIterator, Iterable, Iterator
from dataclasses import dataclass, field
from typing import Any
from pathlib import Path


@dataclass(frozen=True)
class FileWatcherEvent:
    """一次变更事件:受影响路径集合(粗粒度,与 codex 语义一致)。"""

    paths: tuple[str, ...]


class Receiver:
    """轮询驱动的监听接收器:订阅路径集合上的变更逐事件产出。"""

    def __init__(
        self,
        watch_paths: Iterable[str | Path],
        poll_interval: float = 0.2,
        clock: Iterator[float] | None = None,
        max_depth: int = 4,
        max_entries: int = 2000,
    ) -> None:
        # resolved path → {"display": 订阅原始路径, "snap": 自身快照,
        #                  "children": {子路径: [显示路径, 快照]}}
        self._watch: dict[Path, dict[str, Any]] = {
            Path(p).resolve(): {"display": str(p), "snap": None, "children": {}}
            for p in watch_paths
        }
        self.poll_interval = poll_interval
        self.max_depth = max_depth
        self.max_entries = max_entries
        self._queue: asyncio.Queue[FileWatcherEvent] = asyncio.Queue()
        self._closed = False
        self._task: asyncio.Task[None] | None = None
        self._clock = clock
        # 订阅即基线:先建立初始快照,不把"订阅前已存在"误报为变更
        for entry in self._watch.values():
            entry["snap"] = self._snapshot(Path(entry["display"]))
            children: dict[Path, list[Any]] = entry["children"]
            self._snapshot_children(Path(entry["display"]), children)

    @staticmethod
    def _snapshot(path: Path) -> tuple[int, int] | None:
        try:
            stat = path.stat()
            return (stat.st_mtime_ns, stat.st_size)
        except OSError:
            return None  # 不存在(或已被删除)

    def _snapshot_children(
        self, directory: Path, into: dict[Path, list[Any]]
    ) -> None:
        """递归收集目录子项快照(深度/数量上限内;目录内容修改不改目录
        mtime,必须扫子项才能探测 modify,故每轮全量重扫)。"""
        into.clear()
        stack: list[tuple[Path, str, int]] = [(directory, str(directory), 0)]
        count = 0
        while stack and count < self.max_entries:
            directory_path, display, depth = stack.pop()
            try:
                children = list(directory_path.iterdir())
            except OSError:
                continue
            for child in children:
                if count >= self.max_entries:
                    return
                child_display = str(child)
                into[child.resolve()] = [child_display, self._snapshot(child)]
                count += 1
                if depth < self.max_depth and child.is_dir():
                    stack.append((child, child_display, depth + 1))

    def add_watch(self, path: str | Path) -> None:
        key = Path(path).resolve()
        self._watch.setdefault(
            key, {"display": str(path), "snap": None, "children": {}}
        )
        entry = self._watch[key]
        entry["snap"] = self._snapshot(key)
        if key.is_dir():
            self._snapshot_children(key, entry["children"])

    def remove_watch(self, path: str | Path) -> None:
        self._watch.pop(Path(path).resolve(), None)

    def _scan_once(self) -> FileWatcherEvent | None:
        changed: list[str] = []
        for key, entry in self._watch.items():
            display = entry["display"]
            current = self._snapshot(key)
            if current != entry["snap"]:
                changed.append(display)
                entry["snap"] = current
            # 目录内容修改不改目录 mtime:子项每轮全量比对
            if key.is_dir():
                previous: dict[Path, list[Any]] = entry["children"]
                fresh: dict[Path, list[Any]] = {}
                self._snapshot_children(key, fresh)
                for child_key, (child_display, child_snap) in fresh.items():
                    old = previous.get(child_key)
                    if old is None or old[1] != child_snap:
                        changed.append(child_display)
                # 已删除的子项也要上报
                for child_key, (child_display, _old_snap) in previous.items():
                    if child_key not in fresh:
                        changed.append(child_display)
                entry["children"] = fresh
        if not changed:
            return None
        # 去重保序
        seen: set[str] = set()
        unique: list[str] = []
        for p in changed:
            if p not in seen:
                seen.add(p)
                unique.append(p)
        return FileWatcherEvent(paths=tuple(unique))

    def _now(self) -> float:
        if self._clock is not None:
            return next(self._clock)
        return time.monotonic()

    async def _poll_loop(self) -> None:
        while not self._closed:
            event = self._scan_once()
            if event is not None:
                await self._queue.put(event)
            await asyncio.sleep(self.poll_interval)

    async def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._poll_loop())

    async def close(self) -> None:
        self._closed = True
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def recv(self) -> FileWatcherEvent | None:
        """接收下一个事件;监听已关闭且无积压时返回 None(codex 语义)。"""
        if self._closed and self._queue.empty():
            return None
        return await self._queue.get()

    def poll(self) -> FileWatcherEvent | None:
        """同步单次扫描(测试与无事件循环场景用)。"""
        return self._scan_once()


class ThrottledWatchReceiver:
    """限流包装:两次产出之间强制最小 delay(codex ThrottledWatchReceiver)。"""

    def __init__(self, rx: Receiver, interval: float) -> None:
        self._rx = rx
        self._interval = interval
        self._next_allowed: float | None = None

    async def recv(self) -> FileWatcherEvent | None:
        if self._next_allowed is not None:
            wait = self._next_allowed - time.monotonic()
            if wait > 0:
                await asyncio.sleep(wait)
        event = await self._rx.recv()
        if event is not None:
            self._next_allowed = time.monotonic() + self._interval
        return event


class DebouncedWatchReceiver:
    """防抖包装:首个事件后开窗,窗口内路径合并成一批(codex 语义)。"""

    def __init__(self, rx: Receiver, interval: float) -> None:
        self._rx = rx
        self._interval = interval
        self._changed: set[str] = set()

    async def recv(self) -> FileWatcherEvent | None:
        while not self._changed:
            event = await self._rx.recv()
            if event is None:
                return None
            self._changed.update(event.paths)
        deadline = time.monotonic() + self._interval
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            try:
                event = await asyncio.wait_for(self._rx.recv(), timeout=remaining)
            except asyncio.TimeoutError:
                break
            if event is None:
                break
            self._changed.update(event.paths)
        batch = FileWatcherEvent(paths=tuple(sorted(self._changed)))
        self._changed.clear()
        return batch


@dataclass
class Subscription:
    """订阅方:watched 路径模式集合 + 事件转发目标队列。"""

    paths: frozenset[str]
    queue: asyncio.Queue[FileWatcherEvent] = field(default_factory=asyncio.Queue)

    def matches(self, event: FileWatcherEvent) -> bool:
        return any(
            changed.startswith(watched) or watched.startswith(changed)
            for changed in event.paths
            for watched in self.paths
        )


class FileWatcherRouter:
    """路由层:把粗粒度变更事件分发给命中订阅方(codex routing 语义)。"""

    def __init__(self) -> None:
        self._subscriptions: list[Subscription] = []

    def subscribe(self, paths: Iterable[str | Path]) -> Subscription:
        sub = Subscription(paths=frozenset(str(Path(p).resolve()) for p in paths))
        self._subscriptions.append(sub)
        return sub

    def unsubscribe(self, sub: Subscription) -> None:
        if sub in self._subscriptions:
            self._subscriptions.remove(sub)

    def dispatch(self, event: FileWatcherEvent) -> int:
        delivered = 0
        for sub in self._subscriptions:
            if sub.matches(event):
                sub.queue.put_nowait(event)
                delivered += 1
        return delivered
