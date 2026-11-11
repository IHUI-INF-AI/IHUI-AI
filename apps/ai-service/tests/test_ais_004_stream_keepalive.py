# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""AIS-004 回归:主上游首个事件前的等待心跳。

票面:原生流消费是单个 `async for`,上游慢首包(推理模型/冷启动/退避)期间零字节
输出,前端 30s 读超时掐流。修法是首个事件到达前起独立 ticker 每 interval 注一帧
SSE 注释 `: ping`,与上游读取 `asyncio.wait(..., FIRST_COMPLETED)` 竞争;首包到达
后停 ticker。本文件用假异步生成器钉住四条:**有 ping、不丢内容、快流不多 ping、
关停无 pending 任务**。
"""

from __future__ import annotations

import asyncio
import inspect
from collections.abc import AsyncIterator
from typing import Any

import pytest

from app.routers import llm as llm_router
from app.routers.llm import (
    _STREAM_KEEPALIVE_PING,
    _astream_first_event_keepalive,
)

_INTERVAL = 0.05  # 秒:测试注入值(远小于线上 15s,但仍是可观测的真等待)


@pytest.fixture(autouse=True)
def _fast_keepalive_interval(monkeypatch: pytest.MonkeyPatch) -> None:
    """常量可被测试注入更小值:包装器每次等待都现读模块常量。"""
    monkeypatch.setattr(llm_router, "_STREAM_KEEPALIVE_INTERVAL", _INTERVAL)


async def _collect(agen: AsyncIterator[dict[str, Any] | str]) -> list[Any]:
    return [item async for item in agen]


def _leaked_tasks(before: set[asyncio.Task[Any]]) -> list[asyncio.Task[Any]]:
    return [
        t for t in asyncio.all_tasks() - before if t is not asyncio.current_task() and not t.done()
    ]


async def test_slow_first_chunk_emits_ping_without_losing_content() -> None:
    """首包延迟 > 2 个 interval ⇒ 至少一次 `: ping`,且上游事件一帧不丢、顺序不变。"""
    events: list[dict[str, Any]] = [
        {"type": "chunk", "content": "hello"},
        {"type": "reasoning", "content": "thinking"},
        {"type": "done"},
    ]

    async def _slow() -> AsyncIterator[dict[str, Any]]:
        await asyncio.sleep(_INTERVAL * 4)  # 慢首包(> 2 个 interval)
        for evt in events:
            yield evt

    before = asyncio.all_tasks()
    out = await _collect(_astream_first_event_keepalive(_slow()))

    pings = [x for x in out if isinstance(x, str)]
    data = [x for x in out if not isinstance(x, str)]
    assert len(pings) >= 1
    assert all(p == _STREAM_KEEPALIVE_PING for p in pings)
    assert pings[0] == ": ping\n\n"
    # ping 必须出现在首个上游事件之前(等待期注帧,不是首包后的噪声)
    assert isinstance(out[0], str)
    # 内容零丢失:上游事件逐帧、逐序原样透传
    assert data == events
    # 正常收口后不留 pending 任务(ticker 与在途 anext 均已取消并 await)
    await asyncio.sleep(0)
    assert _leaked_tasks(before) == []


async def test_fast_stream_produces_no_ping() -> None:
    """首包立即到达 ⇒ 一帧 ping 都不产生(不在快流上多造字节)。"""
    events: list[dict[str, Any]] = [
        {"type": "chunk", "content": "a"},
        {"type": "chunk", "content": "b"},
        {"type": "done"},
    ]

    async def _fast() -> AsyncIterator[dict[str, Any]]:
        for evt in events:
            yield evt

    before = asyncio.all_tasks()
    out = await _collect(_astream_first_event_keepalive(_fast()))

    assert [x for x in out if isinstance(x, str)] == []
    assert out == events
    await asyncio.sleep(0)
    assert _leaked_tasks(before) == []


async def test_aclose_while_waiting_cancels_ticker_and_source() -> None:
    """客户端断开式关停:取消 ticker + 在途 anext,并关停借来的上游流,零泄漏。"""
    upstream_closed = asyncio.Event()

    async def _never() -> AsyncIterator[dict[str, Any]]:
        try:
            await asyncio.sleep(60)
            yield {"type": "chunk", "content": "never"}
        finally:
            upstream_closed.set()

    before = asyncio.all_tasks()
    wrapper = _astream_first_event_keepalive(_never())
    # 能拿到第一帧 ping 即证明 ticker 已在跑(否则会一直等到超时才返回)
    assert await wrapper.__anext__() == _STREAM_KEEPALIVE_PING

    await wrapper.aclose()

    assert upstream_closed.is_set()
    await asyncio.sleep(0)
    assert _leaked_tasks(before) == []


async def test_upstream_error_propagates_without_leaking_tasks() -> None:
    """上游抛错必须原样冒泡(不吞成正常结束),收尾同样不留 pending 任务。"""

    async def _boom() -> AsyncIterator[dict[str, Any]]:
        await asyncio.sleep(_INTERVAL * 2)
        raise RuntimeError("upstream exploded")
        yield {"type": "chunk"}  # pragma: no cover - 让函数保持异步生成器

    before = asyncio.all_tasks()
    with pytest.raises(RuntimeError, match="upstream exploded"):
        await _collect(_astream_first_event_keepalive(_boom()))
    await asyncio.sleep(0)
    assert _leaked_tasks(before) == []


def test_complete_stream_wires_keepalive_wrapper() -> None:
    """接线钉子:主聊天流必须消费心跳包装,而不是退回裸 `_native_fc_stream`。"""
    source = inspect.getsource(llm_router.complete_stream)
    assert "_astream_first_event_keepalive(_native_fc_stream)" in source
    assert "async for event in _native_fc_events:" in source
