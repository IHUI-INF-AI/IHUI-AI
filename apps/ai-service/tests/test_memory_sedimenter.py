# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D10 memory_sedimenter 单元测试。

覆盖:
1. 阈值触发 —— 计数达阈值触发一次沉淀(fake store 被调用)
2. 未到阈值不触发 —— 计数未达阈值,fake store 不被调用
3. 禁用开关 —— IHUI_MEMORY_SEDIMENT_EVERY=0 全局禁用
4. extractor 异常不冒泡 —— fake store 抛异常时,maybe_sediment 不向上抛,后台任务静默
"""

import asyncio

import pytest

import app.services.memory_sedimenter as ms


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    """每个用例前清空计数与待跑任务,并隔离 _store_fn。"""
    ms._COUNT.clear()
    ms._pending.clear()
    monkeypatch.setattr(ms, "_store_fn", ms._default_store)
    yield
    ms._COUNT.clear()
    ms._pending.clear()


async def _drain():
    """让后台沉淀任务跑完(取自 _pending 快照,gather 不抛异常)。"""
    pending = list(ms._pending)
    if pending:
        await asyncio.gather(*pending, return_exceptions=True)
    else:
        await asyncio.sleep(0.02)


async def test_threshold_triggers_once(monkeypatch):
    calls = []

    async def fake_store(user_uuid, messages, session_id):
        calls.append((user_uuid, len(messages), session_id))

    monkeypatch.setenv("IHUI_MEMORY_SEDIMENT_EVERY", "3")
    monkeypatch.setattr(ms, "_store_fn", fake_store)

    msgs = [{"role": "user", "content": "我喜欢用 TypeScript"}]
    for _ in range(3):
        await ms.maybe_sediment("sess-1", "user-1", recent_messages=msgs)
    await _drain()

    assert len(calls) == 1
    assert calls[0][0] == "user-1"
    assert calls[0][2] == "sess-1"


async def test_below_threshold_does_not_trigger(monkeypatch):
    calls = []

    async def fake_store(user_uuid, messages, session_id):
        calls.append(1)

    monkeypatch.setenv("IHUI_MEMORY_SEDIMENT_EVERY", "3")
    monkeypatch.setattr(ms, "_store_fn", fake_store)

    msgs = [{"role": "user", "content": "x"}]
    for _ in range(2):
        await ms.maybe_sediment("sess-2", "user-2", recent_messages=msgs)
    await _drain()

    assert calls == []


async def test_disabled_switch(monkeypatch):
    calls = []

    async def fake_store(user_uuid, messages, session_id):
        calls.append(1)

    monkeypatch.setenv("IHUI_MEMORY_SEDIMENT_EVERY", "0")
    monkeypatch.setattr(ms, "_store_fn", fake_store)

    msgs = [{"role": "user", "content": "x"}]
    for _ in range(3):
        await ms.maybe_sediment("sess-3", "user-3", recent_messages=msgs)
    await _drain()

    assert calls == []


async def test_extractor_exception_does_not_bubble(monkeypatch):
    calls = []

    async def fake_store_raises(user_uuid, messages, session_id):
        calls.append(1)
        raise RuntimeError("fake extractor boom")

    monkeypatch.setenv("IHUI_MEMORY_SEDIMENT_EVERY", "3")
    monkeypatch.setattr(ms, "_store_fn", fake_store_raises)

    msgs = [{"role": "user", "content": "x"}]
    # maybe_sediment 本身绝不抛异常(异常在后台任务内被吞)
    for _ in range(3):
        await ms.maybe_sediment("sess-4", "user-4", recent_messages=msgs)
    # 后台任务即使抛异常也不冒泡到此处
    await _drain()

    # fake store 确实被尝试过一次,但异常被静默处理
    assert len(calls) == 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
