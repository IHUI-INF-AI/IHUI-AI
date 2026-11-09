# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-008 夹具:命令流/子代理进度流必须是有界队列。

- command_streamer:queue 原为无 maxsize,慢客户端时 reader 永不阻塞,内存无界增长。
  现在建有界队列,`await queue.put` 天然把背压传回子进程 pipe。
- llm 子代理进度:回调是同步 `put_nowait`,不能背压;现在有界 + 满时丢最旧并
  累计 dropped,排水时把 dropped_before 挂到下一帧,显式标记截断。
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.routers import llm as llm_router
from app.services import command_streamer as cs


class _FakeStream:
    async def readline(self) -> bytes:
        return b""


class _FakeProc:
    returncode = 0

    def __init__(self) -> None:
        self.stdout = _FakeStream()
        self.stderr = _FakeStream()

    async def wait(self) -> int:
        return 0

    def terminate(self) -> None:
        return None

    def kill(self) -> None:
        return None


class _SpyQueue(asyncio.Queue):
    created_maxsize: list[int] = []

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        _SpyQueue.created_maxsize.append(kwargs.get("maxsize") or 0)


async def test_command_stream_queue_is_bounded(monkeypatch: pytest.MonkeyPatch) -> None:
    """改前必红:旧码 asyncio.Queue() 的 maxsize=0,reader 永不阻塞。"""
    _SpyQueue.created_maxsize = []

    async def _spawn(*args: Any, **kwargs: Any) -> _FakeProc:
        return _FakeProc()

    monkeypatch.setattr(cs.asyncio, "Queue", _SpyQueue)
    monkeypatch.setattr(cs.asyncio, "create_subprocess_exec", _spawn)

    events = [ev async for ev in cs.stream_command("echo hi", timeout=30)]
    assert events and events[-1]["type"] == "exit", events
    assert _SpyQueue.created_maxsize, "没有观察到队列创建"
    assert _SpyQueue.created_maxsize[0] > 0, (
        f"命令流队列仍无界: maxsize={_SpyQueue.created_maxsize[0]}"
    )


def test_progress_queue_drops_oldest_and_counts() -> None:
    """改前必红:没有这个有界投递入口,同步回调只能无界 put_nowait。"""
    assert hasattr(llm_router, "_enqueue_progress_event"), (
        "缺少子代理进度有界投递入口(AIS-008)"
    )
    q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=2)
    dropped = [0]
    for i in range(3):
        llm_router._enqueue_progress_event(q, {"i": i}, dropped)

    assert dropped[0] == 1, dropped
    assert [q.get_nowait()["i"] for _ in range(2)] == [1, 2]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
