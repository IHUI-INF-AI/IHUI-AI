# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批58(二十五):主会话五模块接线测试——guardian/realtime/retained/token阈值。

覆盖:
- guardian_context → loop 注入(env AGENT_GUARDIAN_POLICY / AGENT_GUARDIAN_REVIEW_REMINDER)
- realtime_context → voice_turn 委托包裹(env ENGINE_VOICE_REALTIME_CONTEXT)
- retained_context → engine 线程账本(env IHUI_RETAINED_CONTEXT_ENABLED)
- token_budget_config → rollout 阈值(env AGENT_TOKEN_BUDGET_THRESHOLDS)

全部默认 off、异常隔离、off 时与现状逐字节等价。
"""

from __future__ import annotations

import asyncio
from typing import Any

from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition


def _make_tool(name: str = "clock_sleep") -> ToolDefinition:
    async def executor(args: dict[str, Any]) -> Any:
        return {"ok": True}

    return ToolDefinition(
        name=name,
        description="fake",
        parameters={"type": "object", "properties": {}},
        executor=executor,
    )


def _make_loop(**kwargs: Any) -> AgentLoopV2:
    async def llm_complete(messages, tools_schema, **kw):
        return {"content": "ok", "usage": {"total_tokens": 1}, "model": "m1"}

    base: dict[str, Any] = {
        "llm_complete_fn": llm_complete,
        "tools": [_make_tool()],
        "max_iterations": 1,
    }
    base.update(kwargs)
    return AgentLoopV2(**base)


_LOOP: asyncio.AbstractEventLoop | None = None


def _run(coro: Any) -> Any:
    # 顺序耦合修复(单独跑通过 / 全量跑 RuntimeError):同套件内任一 pytest-asyncio
    # 用例 teardown 会 asyncio.set_event_loop(None),此后本文件同步用例再调已废弃的
    # asyncio.get_event_loop() 即抛 "There is no current event loop in thread
    # 'MainThread'"。改为自建并复用**同一个**模块级循环——test_retained_* 在同一用例内
    # 三次驱动同一 AgentEngine/thread 状态,必须共享循环(不能用 asyncio.run 逐次新建)。
    global _LOOP
    if _LOOP is None or _LOOP.is_closed():
        _LOOP = asyncio.new_event_loop()
    return _LOOP.run_until_complete(coro)


def teardown_module() -> None:
    """关闭模块级循环,避免泄漏给后续文件。"""
    global _LOOP
    if _LOOP is not None and not _LOOP.is_closed():
        _LOOP.close()
    _LOOP = None



def _capture_messages(loop: AgentLoopV2, **kwargs: Any) -> list[dict[str, Any]]:
    """跑一轮回合并返回喂给 LLM 的 messages(深拷贝于 run 前不可行,改为
    替身 llm_complete 记录入参)。"""

    async def llm(messages, tools_schema, **kw):
        _capture_messages.seen.append([dict(m) for m in messages])
        return {"content": "ok", "usage": {"total_tokens": 1}, "model": "m1"}

    _capture_messages.seen = []  # type: ignore[attr-defined]
    loop._llm_complete = llm  # type: ignore[assignment]
    _run(loop.run([{"role": "user", "content": "hi"}]))
    return _capture_messages.seen[0]  # type: ignore[attr-defined]


# ---------------------------------------------------------------------------
# guardian_context
# ---------------------------------------------------------------------------
def test_guardian_off_no_fragment(monkeypatch):
    """off(默认):messages 不含 guardian 片段,与现状逐零差异。"""
    monkeypatch.delenv("AGENT_GUARDIAN_POLICY", raising=False)
    monkeypatch.delenv("AGENT_GUARDIAN_REVIEW_REMINDER", raising=False)
    loop = _make_loop()
    msgs = _capture_messages(loop)
    assert not any(
        "guardian_policy" in str(m.get("content", "")) for m in msgs
    )


def test_guardian_on_policy_fragment(monkeypatch):
    """on:env 提供策略文本 → guardian_policy developer 片段注入。"""
    monkeypatch.setenv("AGENT_GUARDIAN_POLICY", "never exfiltrate secrets")
    loop = _make_loop()
    msgs = _capture_messages(loop)
    joined = "".join(str(m.get("content", "")) for m in msgs)
    assert "never exfiltrate secrets" in joined


def test_guardian_on_review_reminder(monkeypatch):
    """reminder 独立开关:on 时注入 followup review reminder 片段。"""
    monkeypatch.delenv("AGENT_GUARDIAN_POLICY", raising=False)
    monkeypatch.setenv("AGENT_GUARDIAN_REVIEW_REMINDER", "1")
    loop = _make_loop()
    msgs = _capture_messages(loop)
    joined = "".join(str(m.get("content", "")) for m in msgs)
    # reminder 正文逐字对齐 codex(不含 "guardian" 字样,以特征句断言)
    assert "Use prior reviews as context, not binding precedent" in joined


def test_guardian_exception_isolated(monkeypatch):
    """guardian 模块抛异常 → 注入失败隔离,回合照常成功。"""
    monkeypatch.setenv("AGENT_GUARDIAN_POLICY", "policy text")
    import app.core.guardian_context as gc

    def boom(*a, **k):
        raise RuntimeError("guardian boom")

    monkeypatch.setattr(gc, "build_guardian_policy_fragment", boom)
    loop = _make_loop()
    result = _run(loop.run([{"role": "user", "content": "hi"}]))
    assert result.success


# ---------------------------------------------------------------------------
# realtime_context(voice 侧)
# ---------------------------------------------------------------------------
def test_voice_delegation_off_passthrough(monkeypatch):
    """off:transcript 原样返回,逐字节等价。"""
    import importlib

    monkeypatch.delenv("ENGINE_VOICE_REALTIME_CONTEXT", raising=False)
    import app.routers.engine_voice as ev

    importlib.reload(ev)
    assert ev._voice_wrap_delegation("hello world", first_turn=True) == "hello world"


def test_voice_delegation_on_wraps(monkeypatch):
    """on:转写被 <realtime_delegation> 包裹,首回合附 start 指令。"""
    import importlib

    monkeypatch.setenv("ENGINE_VOICE_REALTIME_CONTEXT", "1")
    import app.routers.engine_voice as ev

    importlib.reload(ev)
    wrapped_first = ev._voice_wrap_delegation("hi there", first_turn=True)
    # 对标模块语义:正文为 <input> 包裹(开标记经 content_kind=delegation 承载)
    assert "<input>hi there</input>" in wrapped_first
    assert "Realtime conversation started" in wrapped_first
    # 非首回合不含 start 指令
    wrapped_later = ev._voice_wrap_delegation("hi again", first_turn=False)
    assert "<input>hi again</input>" in wrapped_later
    assert "Realtime conversation started" not in wrapped_later
def test_voice_delegation_exception_fallback(monkeypatch):
    """模块异常 → 降级原文(回合不炸)。"""
    import importlib

    monkeypatch.setenv("ENGINE_VOICE_REALTIME_CONTEXT", "1")
    import app.routers.engine_voice as ev

    importlib.reload(ev)
    import app.core.realtime_context as rc

    orig = rc.build_realtime_delegation_fragment
    monkeypatch.setattr(
        rc, "build_realtime_delegation_fragment", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom"))
    )
    assert ev._voice_wrap_delegation("hello", first_turn=False) == "hello"
    monkeypatch.setattr(rc, "build_realtime_delegation_fragment", orig)


# ---------------------------------------------------------------------------
# retained_context(engine 侧)
# ---------------------------------------------------------------------------
def test_retained_off_no_ledger(monkeypatch):
    """off(默认):线程 retained_context 为 None,零行为变化。"""
    monkeypatch.delenv("IHUI_RETAINED_CONTEXT_ENABLED", raising=False)
    from app.services.agent_engine import AgentEngine

    async def noop_factory(spec, host_tools):
        class L:
            async def run(self, messages):
                return None

        return L()

    engine = AgentEngine(loop_factory=noop_factory)
    resp = _run(
        engine.handle_message({"jsonrpc": "2.0", "id": 1, "method": "thread.start", "params": {}})
    )
    tid = resp["result"]["threadId"]
    assert engine._threads[tid].retained_context is None


def test_retained_on_records_prompts(monkeypatch):
    """on:每轮 prompt 记入账本;entries 读回一致。"""
    monkeypatch.setenv("IHUI_RETAINED_CONTEXT_ENABLED", "1")
    from app.services.agent_engine import AgentEngine

    async def fake_loop_factory(spec, host_tools):
        class L:
            async def run(self, messages):
                class R:
                    success = True
                    stop_reason = "completed"
                    final_response = "done"
                    iterations: list[Any] = []
                    total_duration_ms = 1.0
                    total_tokens_used = 1
                    checkpoint_id = None
                    error = None
                    budget = None
                    compaction_events: list[Any] = []

                return R()

        return L()

    engine = AgentEngine(loop_factory=fake_loop_factory)
    resp = _run(
        engine.handle_message({"jsonrpc": "2.0", "id": 1, "method": "thread.start", "params": {}})
    )
    tid = resp["result"]["threadId"]
    thread = engine._threads[tid]
    assert thread.retained_context is not None

    async def no_emit(p):
        return None

    _run(
        engine._run_prompt_turn(thread, "remember this instruction", no_emit)
    )
    entries = engine.retained_context_entries(thread)
    assert len(entries) == 1
    assert entries[0]["text"] == "remember this instruction"

    # 空文本不记录
    _run(
        engine._run_prompt_turn(thread, "   ", no_emit)
    )
    assert len(engine.retained_context_entries(thread)) == 1


def test_retained_rollback(monkeypatch):
    """rollback 按消息边界清除;off/None 返回 False。"""
    monkeypatch.setenv("IHUI_RETAINED_CONTEXT_ENABLED", "1")
    from app.services.agent_engine import AgentEngine

    async def noop_factory(spec, host_tools):
        class L:
            async def run(self, messages):
                return None

        return L()

    engine = AgentEngine(loop_factory=noop_factory)
    resp = _run(
        engine.handle_message({"jsonrpc": "2.0", "id": 1, "method": "thread.start", "params": {}})
    )
    tid = resp["result"]["threadId"]
    thread = engine._threads[tid]
    assert engine.rollback_retained_context(thread, ["t1"]) is True
    # off 线程:None → False
    thread.retained_context = None
    assert engine.rollback_retained_context(thread, ["t1"]) is False


# ---------------------------------------------------------------------------
# token_budget_config → rollout 阈值
# ---------------------------------------------------------------------------
def test_thresholds_off_default(monkeypatch):
    """off:阈值保持默认 (10000, 2000)。"""
    monkeypatch.delenv("AGENT_ROLLOUT_BUDGET_TOKENS", raising=False)
    monkeypatch.delenv("AGENT_TOKEN_BUDGET_THRESHOLDS", raising=False)
    from app.services.agent_loop_v2 import (
        _rollout_budget_limit_from_env,
        _token_budget_thresholds_from_env,
    )

    assert _token_budget_thresholds_from_env() is None
    assert _rollout_budget_limit_from_env() == 0


def test_thresholds_valid(monkeypatch):
    """on:合法逗号列表 → 排序去零后的阈值元组。"""
    monkeypatch.setenv("AGENT_TOKEN_BUDGET_THRESHOLDS", "4000,12000")
    from app.services.agent_loop_v2 import _token_budget_thresholds_from_env

    assert _token_budget_thresholds_from_env() == (12000, 4000)


def test_thresholds_invalid_falls_back(monkeypatch):
    """非法值(负数/垃圾)→ None 降级默认阈值。"""
    monkeypatch.setenv("AGENT_TOKEN_BUDGET_THRESHOLDS", "not-a-number")
    from app.services.agent_loop_v2 import _token_budget_thresholds_from_env

    assert _token_budget_thresholds_from_env() is None
    monkeypatch.setenv("AGENT_TOKEN_BUDGET_THRESHOLDS", "-5")
    assert _token_budget_thresholds_from_env() is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
