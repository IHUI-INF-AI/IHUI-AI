# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
"""AIS-063 回归:thread.resume 必须把续跑产出回写线程历史。

修前只有 `run()` 分支调 `_absorb_messages(thread, working)`,`resume_from_checkpoint`
分支直接拿到 result 就走 —— 线程历史停在崩溃前那一条:
- 下一轮 prompt 看到的上下文比 checkpoint 少,模型会重复已做过的工作;
- 持久层/前端(读 thread.messages)与 checkpoint 三份不一致;
- 续跑出来的 assistant 产出等于没发生。

本文件钉住:
① 续跑路径确实调用了回写,且用的是**循环内那份** `_messages`(不是 thread 自己的旧列表);
② 注入型 system 仍然被过滤(与正常轮同一 `_absorb_messages` 纪律,不因续跑而放行);
③ 循环拿不到 `_messages` 时**不回写**并留告警,绝不拿旧历史冒充产出。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.agent_engine import AgentEngine, EngineThread


class _FakeLoop:
    """最小循环替身:只提供 resume 入口与 `_messages`。"""

    def __init__(self, messages: list[dict[str, Any]] | None) -> None:
        self._messages = messages
        self.resume_calls: list[str] = []

    async def resume_from_checkpoint(self, checkpoint_id: str) -> Any:
        self.resume_calls.append(checkpoint_id)

        class _Result:
            checkpoint_id = None
            success = True
            final_response = "续跑完成"
            iterations: list[Any] = []
            total_duration_ms = 0.0
            total_tokens_used = 0
            stop_reason = "completed"
            error = None
            budget = None
            compaction_events: list[Any] = []
            memory_updates: list[Any] = []

            def model_dump(self) -> dict[str, Any]:
                return {
                    "success": True,
                    "final_response": "续跑完成",
                    "stop_reason": "completed",
                }

        return _Result()


def _engine(loop: Any) -> AgentEngine:
    async def factory(*_a: Any, **_k: Any) -> Any:
        return loop

    return AgentEngine(factory)


def _thread() -> EngineThread:
    return EngineThread(
        thread_id="thr_resume",
        session_id="sess_resume",
        model=None,
        permission_mode="default",
        max_iterations=10,
        tool_names=None,
        workspace=None,
        user_id=None,
        conversation_id=None,
        messages=[
            {"role": "system", "content": "You are a helpful agent."},
            {"role": "user", "content": "崩溃前的那条"},
        ],
    )


async def _run(engine: AgentEngine, thread: EngineThread) -> None:
    async def emit(_event: str, _data: Any) -> None:
        return None

    engine._threads[thread.thread_id] = thread
    await engine._run_thread(thread, emit, from_checkpoint="ckpt_1")


@pytest.mark.asyncio
async def test_resume_absorbs_loop_messages():
    """续跑后线程历史必须含本轮新产出(user + assistant)。"""
    loop = _FakeLoop(
        [
            {"role": "system", "content": "You are a helpful agent."},
            {"role": "user", "content": "崩溃前的那条"},
            {"role": "assistant", "content": "崩溃前已答的一半"},
            {"role": "user", "content": "续跑触发"},
            {"role": "assistant", "content": "续跑产出"},
        ]
    )
    engine = _engine(loop)
    thread = _thread()
    await _run(engine, thread)

    contents = [m.get("content") for m in thread.messages if m.get("role") == "assistant"]
    assert "续跑产出" in contents, "AIS-063:续跑产出必须回写线程历史"
    assert loop.resume_calls == ["ckpt_1"]


@pytest.mark.asyncio
async def test_resume_injected_system_is_not_absorbed():
    """注入型 system 仍被过滤(续跑不得成为绕过该纪律的口子)。"""
    loop = _FakeLoop(
        [
            {"role": "system", "content": "You are a helpful agent."},
            {"role": "user", "content": "崩溃前的那条"},
            {"role": "system", "content": "<memory_graph>注入型</memory_graph>"},
            {"role": "assistant", "content": "续跑产出"},
        ]
    )
    engine = _engine(loop)
    thread = _thread()
    await _run(engine, thread)

    systems = [m.get("content") for m in thread.messages if m.get("role") == "system"]
    assert not any("memory_graph" in str(s) for s in systems), "注入型 system 不得进线程历史"
    assert systems and systems[0] == "You are a helpful agent."


@pytest.mark.asyncio
async def test_resume_without_loop_messages_does_not_touch_history(caplog):
    """循环拿不到 `_messages` ⇒ 历史一字不动 + 告警(不拿旧历史冒充产出)。"""
    loop = _FakeLoop(None)
    engine = _engine(loop)
    thread = _thread()
    before = list(thread.messages)

    with caplog.at_level("WARNING"):
        await _run(engine, thread)

    assert thread.messages == before, "取不到本轮消息时不得改写历史"
    assert any("未能取回循环消息" in r.message for r in caplog.records)
