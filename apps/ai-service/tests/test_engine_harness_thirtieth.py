# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/hook_runtime.py + startup_prewarm.py 第三十批测试。

import asyncio

import pytest

from app.core.hook_runtime import (
    HookKind,
    HookOutcome,
    HookRuntime,
)
from app.core.startup_prewarm import (
    PrewarmResolution,
    StartupPrewarmHandle,
    start_startup_prewarm,
)


# ======================================================================
# hook_runtime
# ======================================================================
class TestHookRuntime:
    @pytest.mark.asyncio
    async def test_empty_runtime_noop(self):
        rt = HookRuntime()
        outcome = await rt.run(HookKind.USER_PROMPT_SUBMIT, {"prompt": "hi"})
        assert outcome.should_stop is False
        assert outcome.additional_contexts == []
        assert outcome.events == []

    @pytest.mark.asyncio
    async def test_context_injection_in_registration_order(self):
        rt = HookRuntime()
        rt.register(HookKind.USER_PROMPT_SUBMIT, lambda p: {"additional_context": "ctx-1"}, name="h1")
        rt.register(HookKind.USER_PROMPT_SUBMIT, lambda p: {"additional_context": ["ctx-2", "ctx-3"]}, name="h2")
        outcome = await rt.run(HookKind.USER_PROMPT_SUBMIT, {})
        assert outcome.additional_contexts == ["ctx-1", "ctx-2", "ctx-3"]
        assert not outcome.should_stop
        assert [e.status for e in outcome.events] == ["ok", "ok"]
        assert [e.name for e in outcome.events] == ["h1", "h2"]

    @pytest.mark.asyncio
    async def test_stop_aggregation_first_reason_wins(self):
        rt = HookRuntime()
        rt.register(HookKind.USER_PROMPT_SUBMIT, lambda p: {"stop": True, "stop_reason": "blocked"}, name="a")
        rt.register(HookKind.USER_PROMPT_SUBMIT, lambda p: {"stop": True, "stop_reason": "other"}, name="b")
        outcome = await rt.run(HookKind.USER_PROMPT_SUBMIT, {})
        assert outcome.should_stop is True
        assert outcome.stop_reason == "blocked"

    @pytest.mark.asyncio
    async def test_stop_default_reason(self):
        rt = HookRuntime()
        rt.register(HookKind.PRE_COMPACT, lambda p: {"stop": True}, name="guard")
        outcome = await rt.run(HookKind.PRE_COMPACT, {})
        assert outcome.should_stop and "guard" in (outcome.stop_reason or "")

    @pytest.mark.asyncio
    async def test_failure_isolated(self):
        rt = HookRuntime()

        def boom(_):
            raise RuntimeError("hook exploded")

        rt.register(HookKind.USER_PROMPT_SUBMIT, boom, name="bad")
        rt.register(HookKind.USER_PROMPT_SUBMIT, lambda p: {"additional_context": "ok"}, name="good")
        outcome = await rt.run(HookKind.USER_PROMPT_SUBMIT, {})
        assert outcome.additional_contexts == ["ok"]
        assert outcome.events[0].status == "error"
        assert "hook exploded" in (outcome.events[0].error or "")
        assert outcome.events[1].status == "ok"

    @pytest.mark.asyncio
    async def test_timeout_isolated(self):
        rt = HookRuntime()

        async def slow(_):
            await asyncio.sleep(5)

        rt.register(HookKind.USER_PROMPT_SUBMIT, slow, name="slow", timeout=0.05)
        rt.register(HookKind.USER_PROMPT_SUBMIT, lambda p: {"additional_context": "after"}, name="fast")
        outcome = await rt.run(HookKind.USER_PROMPT_SUBMIT, {})
        assert outcome.events[0].status == "timeout"
        assert outcome.additional_contexts == ["after"]

    @pytest.mark.asyncio
    async def test_async_hook_supported(self):
        rt = HookRuntime()

        async def async_hook(p):
            return {"additional_context": f"seen:{p.get('x')}"}

        rt.register(HookKind.SESSION_START, async_hook, name="ah")
        outcome = await rt.run(HookKind.SESSION_START, {"x": 42})
        assert outcome.additional_contexts == ["seen:42"]

    @pytest.mark.asyncio
    async def test_pre_tool_use_deny(self):
        rt = HookRuntime()
        rt.register(HookKind.PRE_TOOL_USE, lambda p: {"decision": "deny", "reason": "危险命令"}, name="guard")
        outcome = await rt.run(HookKind.PRE_TOOL_USE, {"tool": "bash"})
        assert outcome.denial_reason == "危险命令"
        # 非 deny 决策不拒绝
        rt2 = HookRuntime()
        rt2.register(HookKind.PRE_TOOL_USE, lambda p: {"decision": "allow"}, name="pass")
        outcome2 = await rt2.run(HookKind.PRE_TOOL_USE, {})
        assert outcome2.denial_reason is None

    @pytest.mark.asyncio
    async def test_non_dict_result_ignored(self):
        rt = HookRuntime()
        rt.register(HookKind.USER_PROMPT_SUBMIT, lambda p: "just a string", name="s")
        outcome = await rt.run(HookKind.USER_PROMPT_SUBMIT, {})
        assert not outcome.should_stop
        assert outcome.additional_contexts == []

    @pytest.mark.asyncio
    async def test_events_audit_payload(self):
        rt = HookRuntime()
        rt.register(HookKind.STOP, lambda p: None, name="n1")
        outcome = await rt.run(HookKind.STOP, {})
        d = outcome.events_as_dicts()
        assert d[0]["name"] == "n1"
        assert d[0]["kind"] == "stop"
        assert d[0]["status"] == "ok"
        assert isinstance(d[0]["durationMs"], int)


# ======================================================================
# startup_prewarm
# ======================================================================
class TestStartupPrewarm:
    @pytest.mark.asyncio
    async def test_ready_before_first_turn(self):
        async def factory():
            return {"conn": "warm"}

        handle = start_startup_prewarm(factory, timeout=5)
        await asyncio.sleep(0.01)
        res = await handle.resolve()
        assert res.ready and res.value == {"conn": "warm"}
        assert res.age_at_first_turn_ms is not None

    @pytest.mark.asyncio
    async def test_timeout_downgrades(self):
        started = asyncio.Event()

        async def factory():
            started.set()
            await asyncio.sleep(30)

        handle = start_startup_prewarm(factory, timeout=0.05)
        res = await handle.resolve()
        assert res.status == "timed_out"
        assert res.value is None

    @pytest.mark.asyncio
    async def test_unavailable_on_failure(self):
        async def factory():
            raise RuntimeError("no upstream")

        handle = start_startup_prewarm(factory, timeout=5)
        res = await handle.resolve()
        assert res.status == "unavailable"
        assert "no upstream" in (res.error or "")

    @pytest.mark.asyncio
    async def test_cancelled_when_task_cancelled(self):
        async def factory():
            await asyncio.sleep(30)

        handle = start_startup_prewarm(factory, timeout=5)
        handle._task.cancel()
        res = await handle.resolve()
        assert res.status in ("cancelled", "unavailable")

    @pytest.mark.asyncio
    async def test_age_consumes_timeout_budget(self):
        async def factory():
            await asyncio.sleep(0.2)
            return 1

        handle = start_startup_prewarm(factory, timeout=0.1)
        await asyncio.sleep(0.15)  # 首回合来晚,预算已耗尽
        res = await handle.resolve()
        assert res.status == "timed_out"
        assert (res.age_at_first_turn_ms or 0) >= 100

    @pytest.mark.asyncio
    async def test_abort_cleans_task(self):
        async def factory():
            await asyncio.sleep(30)

        handle = start_startup_prewarm(factory, timeout=5)
        await handle.abort()
        assert handle.finished

    @pytest.mark.asyncio
    async def test_finished_property(self):
        async def factory():
            return 1

        handle = start_startup_prewarm(factory, timeout=5)
        await asyncio.sleep(0.01)
        assert handle.finished
