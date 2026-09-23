# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批58(接线):5 个零生产引用模块的接线验收测试。

覆盖 context_fragments / session_prefix / instructional_fragments /
startup_prewarm / stream_events 在 agent_loop_v2.py 的真实接线点。

每个模块 4 项:off 零差异 / on 生效 / 异常隔离 / 非法 env 按 off(共 21 项)。
接线铁律:off 时与接线前逐字节等价;on 时调用模块能力;异常 logger 降级跳过;
非法 env 值按 off。
"""

import asyncio

import pytest

from app.services.agent_loop_v2 import AgentLoopV2

_ENV_KEYS = (
    "AGENT_CONTEXT_FRAGMENTS_ENABLED",
    "AGENT_SESSION_PREFIX_ENABLED",
    "AGENT_INSTRUCTIONAL_FRAGMENTS_ENABLED",
    "AGENT_STARTUP_PREWARM_ENABLED",
    "AGENT_STREAM_EVENTS_ENABLED",
)


def _make_loop(monkeypatch, env=None):
    """清掉所有相关 env 后按需设置,构造最小 AgentLoopV2 实例。

    env 在构造期即被读取(__init__ 内设置 *_enabled 实例属性),故必须先设 env。
    """
    for _k in _ENV_KEYS:
        monkeypatch.delenv(_k, raising=False)
    if env:
        for _k, _v in env.items():
            monkeypatch.setenv(_k, _v)

    async def _fake_llm(messages, tools, **kwargs):
        return {"content": "ok", "tool_calls": None}

    return AgentLoopV2(
        _fake_llm,
        [],
        enable_checkpoint=False,
        checkpoint_manager=object(),
        session_id="sess-58",
    )


# ---------------------------------------------------------------------------
# 1. context_fragments
# ---------------------------------------------------------------------------
def test_context_fragments_off_no_injection(monkeypatch):
    loop = _make_loop(monkeypatch)
    msgs = [{"role": "user", "content": "hi"}]
    before = [dict(m) for m in msgs]
    loop._inject_context_fragments(msgs)
    assert msgs == before


def test_context_fragments_on_injects_recap(monkeypatch):
    loop = _make_loop(monkeypatch, {"AGENT_CONTEXT_FRAGMENTS_ENABLED": "on"})
    msgs = [{"role": "user", "content": "hi"}]
    loop._inject_context_fragments(msgs)
    assert len(msgs) == 2
    assert msgs[1]["role"] == "developer"
    assert "回到本任务" in msgs[1]["content"]


def test_context_fragments_exception_isolated(monkeypatch):
    loop = _make_loop(monkeypatch, {"AGENT_CONTEXT_FRAGMENTS_ENABLED": "on"})
    import app.core.context_fragments as cf

    def _raise(*a, **k):
        raise RuntimeError("boom")

    monkeypatch.setattr(cf, "build_recap_prompt", _raise)
    msgs = [{"role": "user", "content": "hi"}]
    before = [dict(m) for m in msgs]
    loop._inject_context_fragments(msgs)
    assert msgs == before


def test_context_fragments_illegal_env_off(monkeypatch):
    loop = _make_loop(monkeypatch, {"AGENT_CONTEXT_FRAGMENTS_ENABLED": "maybe"})
    assert loop._context_fragments_enabled is False
    msgs = [{"role": "user", "content": "hi"}]
    before = [dict(m) for m in msgs]
    loop._inject_context_fragments(msgs)
    assert msgs == before


# ---------------------------------------------------------------------------
# 2. session_prefix
# ---------------------------------------------------------------------------
def test_session_prefix_off_no_injection(monkeypatch):
    loop = _make_loop(monkeypatch)
    msgs = [{"role": "user", "content": "hi"}]
    before = [dict(m) for m in msgs]
    loop._inject_session_prefix(msgs)
    assert msgs == before


def test_session_prefix_on_injects(monkeypatch):
    loop = _make_loop(monkeypatch, {"AGENT_SESSION_PREFIX_ENABLED": "on"})
    msgs = [{"role": "user", "content": "hi"}]
    loop._inject_session_prefix(msgs)
    assert len(msgs) == 2
    assert msgs[1]["role"] == "assistant"
    assert "FINAL_ANSWER" in msgs[1]["content"][0]["text"]


def test_session_prefix_exception_isolated(monkeypatch):
    loop = _make_loop(monkeypatch, {"AGENT_SESSION_PREFIX_ENABLED": "on"})
    import app.core.session_prefix as sp

    def _raise(*a, **k):
        raise RuntimeError("boom")

    monkeypatch.setattr(sp, "build_inter_agent_completion_fragment", _raise)
    msgs = [{"role": "user", "content": "hi"}]
    before = [dict(m) for m in msgs]
    loop._inject_session_prefix(msgs)
    assert msgs == before


def test_session_prefix_illegal_env_off(monkeypatch):
    loop = _make_loop(monkeypatch, {"AGENT_SESSION_PREFIX_ENABLED": "yesplease"})
    assert loop._session_prefix_enabled is False
    msgs = [{"role": "user", "content": "hi"}]
    before = [dict(m) for m in msgs]
    loop._inject_session_prefix(msgs)
    assert msgs == before


# ---------------------------------------------------------------------------
# 3. instructional_fragments
# ---------------------------------------------------------------------------
def test_instructional_off_no_injection(monkeypatch):
    loop = _make_loop(monkeypatch)
    msgs = [{"role": "user", "content": "hi"}]
    before = [dict(m) for m in msgs]
    loop._inject_instructional_fragments(msgs)
    assert msgs == before


def test_instructional_on_injects(monkeypatch):
    loop = _make_loop(monkeypatch, {"AGENT_INSTRUCTIONAL_FRAGMENTS_ENABLED": "on"})
    msgs = [{"role": "user", "content": "hi"}]
    loop._inject_instructional_fragments(msgs)
    assert len(msgs) == 5
    joined = "\n".join(str(m.get("content")) for m in msgs[1:])
    assert "Apps (Connectors)" in joined


def test_instructional_exception_isolated(monkeypatch):
    loop = _make_loop(monkeypatch, {"AGENT_INSTRUCTIONAL_FRAGMENTS_ENABLED": "on"})
    import app.core.instructional_fragments as inf

    def _raise(*a, **k):
        raise RuntimeError("boom")

    monkeypatch.setattr(inf, "build_apps_instructions_fragment", _raise)
    msgs = [{"role": "user", "content": "hi"}]
    before = [dict(m) for m in msgs]
    loop._inject_instructional_fragments(msgs)
    assert msgs == before


def test_instructional_illegal_env_off(monkeypatch):
    loop = _make_loop(monkeypatch, {"AGENT_INSTRUCTIONAL_FRAGMENTS_ENABLED": "maybe"})
    assert loop._instructional_fragments_enabled is False
    msgs = [{"role": "user", "content": "hi"}]
    before = [dict(m) for m in msgs]
    loop._inject_instructional_fragments(msgs)
    assert msgs == before


# ---------------------------------------------------------------------------
# 4. startup_prewarm
# ---------------------------------------------------------------------------
def test_startup_prewarm_off_no_start(monkeypatch):
    loop = _make_loop(monkeypatch)

    async def _run():
        await loop._maybe_start_startup_prewarm()
        await loop._resolve_startup_prewarm()
        return loop._startup_prewarm_handle, loop._startup_prewarm_resolution

    h, res = asyncio.run(_run())
    assert h is None and res is None


def test_startup_prewarm_on_starts_and_resolves(monkeypatch):
    loop = _make_loop(monkeypatch, {"AGENT_STARTUP_PREWARM_ENABLED": "on"})

    async def _run():
        await loop._maybe_start_startup_prewarm()
        assert loop._startup_prewarm_handle is not None
        await loop._resolve_startup_prewarm()
        return loop._startup_prewarm_resolution

    res = asyncio.run(_run())
    assert res is not None
    assert res.status == "ready"


def test_startup_prewarm_exception_isolated(monkeypatch):
    loop = _make_loop(monkeypatch, {"AGENT_STARTUP_PREWARM_ENABLED": "on"})
    import app.core.startup_prewarm as sp

    def _raise(*a, **k):
        raise RuntimeError("boom")

    monkeypatch.setattr(sp, "start_startup_prewarm", _raise)

    async def _run():
        await loop._maybe_start_startup_prewarm()
        return loop._startup_prewarm_handle

    h = asyncio.run(_run())
    assert h is None


def test_startup_prewarm_illegal_env_off(monkeypatch):
    loop = _make_loop(monkeypatch, {"AGENT_STARTUP_PREWARM_ENABLED": "2"})
    assert loop._startup_prewarm_enabled is False

    async def _run():
        await loop._maybe_start_startup_prewarm()
        return loop._startup_prewarm_handle

    assert asyncio.run(_run()) is None


# ---------------------------------------------------------------------------
# 5. stream_events
# ---------------------------------------------------------------------------
def test_stream_events_off_no_record(monkeypatch):
    loop = _make_loop(monkeypatch)
    loop._record_stream_turn_item({"content": "hello", "id": "x"})
    assert loop._last_stream_turn_item is None


def test_stream_events_on_records(monkeypatch):
    loop = _make_loop(monkeypatch, {"AGENT_STREAM_EVENTS_ENABLED": "on"})
    loop._record_stream_turn_item({"content": "hello", "id": "x"})
    assert loop._last_stream_turn_item is not None
    assert loop._last_stream_turn_item.get("type") == "agent_message"


def test_stream_events_on_empty_content(monkeypatch):
    loop = _make_loop(monkeypatch, {"AGENT_STREAM_EVENTS_ENABLED": "on"})
    loop._record_stream_turn_item({"content": None, "id": None})
    assert loop._last_stream_turn_item is not None


def test_stream_events_on_empty_content(monkeypatch):
    loop = _make_loop(monkeypatch, {"AGENT_STREAM_EVENTS_ENABLED": "on"})
    loop._record_stream_turn_item({"content": None, "id": None})
    assert loop._last_stream_turn_item is not None


def test_stream_events_exception_isolated(monkeypatch):
    loop = _make_loop(monkeypatch, {"AGENT_STREAM_EVENTS_ENABLED": "on"})
    import app.core.stream_events as se

    def _raise(*a, **k):
        raise RuntimeError("boom")

    monkeypatch.setattr(se, "parse_turn_item", _raise)
    loop._record_stream_turn_item({"content": "hi"})
    assert loop._last_stream_turn_item is None


def test_stream_events_illegal_env_off(monkeypatch):
    loop = _make_loop(monkeypatch, {"AGENT_STREAM_EVENTS_ENABLED": "maybe"})
    assert loop._stream_events_enabled is False
    loop._record_stream_turn_item({"content": "hi"})
    assert loop._last_stream_turn_item is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
