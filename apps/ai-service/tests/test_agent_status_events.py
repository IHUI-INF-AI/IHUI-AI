"""W9(2026-09-18)新增事件的契约与发射回归测试。

覆盖:
1. 事件契约:compaction / agent.status 进 hook_engine 白名单、agent_events 映射与订阅集;
2. 发射:pause()/cancel() 先发 agent.status 过渡事件(pausing/cancelling),再落 checkpoint。
"""
from __future__ import annotations

import asyncio

import pytest

from app.services.agent_events import (
    AGENT_SUBSCRIBE_EVENTS,
    HOOK_AGENT_STATUS,
    HOOK_COMPACTION,
    map_hook_event_to_sse,
)
from app.services.hook_engine import HOOK_EVENTS, hook_engine


# ---------------------------------------------------------------------------
# 1. 事件契约
# ---------------------------------------------------------------------------

def test_compaction_in_hook_whitelist_and_contract():
    assert "compaction" in HOOK_EVENTS
    assert HOOK_COMPACTION == "compaction"
    assert map_hook_event_to_sse(HOOK_COMPACTION) == "compaction"
    assert HOOK_COMPACTION in AGENT_SUBSCRIBE_EVENTS


def test_agent_status_in_hook_whitelist_and_contract():
    assert "agent.status" in HOOK_EVENTS
    assert HOOK_AGENT_STATUS == "agent.status"
    assert map_hook_event_to_sse(HOOK_AGENT_STATUS) == "agent-status"
    assert HOOK_AGENT_STATUS in AGENT_SUBSCRIBE_EVENTS


# ---------------------------------------------------------------------------
# 2. 发射:pause/cancel 过渡事件
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_pause_emits_agent_status_pausing(monkeypatch):
    """pause() 先发 agent.status:pausing 过渡事件,再落 checkpoint。"""
    import app.core.llm_gateway as lg
    from app.services.agent_loop_v2 import AgentLoopV2

    async def fake_complete(messages, model=None, **kwargs):
        return {"content": "第一步完成", "tool_calls": None}

    monkeypatch.setattr(lg.llm_gateway, "complete", fake_complete)

    q = hook_engine.subscribe(HOOK_AGENT_STATUS)
    try:
        loop = AgentLoopV2(
            _fake_loop_factory(),
            tools=[],
            session_id="w9-status-test",
            max_iterations=4,
            enable_checkpoint=True,
            llm_retry_max=0,
        )
        # 后台跑 loop,pause 触发过渡事件
        run_task = asyncio.create_task(loop.run([{"role": "user", "content": "长任务"}]))
        await asyncio.sleep(0.05)
        await loop.pause()
        try:
            await asyncio.wait_for(run_task, timeout=5)
        except asyncio.TimeoutError:
            run_task.cancel()
        # 过渡事件必须出现(队列可能还有 session 等其他载荷,逐个取直到命中或超时)
        statuses: list[str] = []
        while not q.empty():
            statuses.append(str((q.get_nowait() or {}).get("status")))
        assert "pausing" in statuses, statuses
    finally:
        hook_engine.unsubscribe(HOOK_AGENT_STATUS, q)


@pytest.mark.asyncio
async def test_cancel_emits_agent_status_cancelling(monkeypatch):
    """cancel() 先发 agent.status:cancelling 过渡事件。"""
    import app.core.llm_gateway as lg
    from app.services.agent_loop_v2 import AgentLoopV2

    async def fake_complete(messages, model=None, **kwargs):
        await asyncio.sleep(0.05)  # 拉长 LLM 调用,给 cancel 留出触发窗口
        return {"content": "还在执行", "tool_calls": None}

    monkeypatch.setattr(lg.llm_gateway, "complete", fake_complete)

    q = hook_engine.subscribe(HOOK_AGENT_STATUS)
    try:
        loop = AgentLoopV2(
            _fake_loop_factory(),
            tools=[],
            session_id="w9-cancel-test",
            max_iterations=8,
            enable_checkpoint=True,
            llm_retry_max=0,
        )
        run_task = asyncio.create_task(loop.run([{"role": "user", "content": "超长任务"}]))
        await asyncio.sleep(0.02)
        await loop.cancel()
        try:
            await asyncio.wait_for(run_task, timeout=5)
        except asyncio.TimeoutError:
            run_task.cancel()
        statuses: list[str] = []
        while not q.empty():
            statuses.append(str((q.get_nowait() or {}).get("status")))
        assert "cancelling" in statuses, statuses
    finally:
        hook_engine.unsubscribe(HOOK_AGENT_STATUS, q)


def _fake_loop_factory():
    """最小可用 llm_complete_fn(与 parity 测试同构,完整接线由 _make_loop_v2_llm 提供)。"""
    # 直接复用 parity 测试的生产接线工厂,避免重复维护
    from tests.test_agents_parity import _make_loop_v2_llm

    return _make_loop_v2_llm(model="test-model")
