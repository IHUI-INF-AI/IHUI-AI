# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批58(接线):上下文窗口/世界状态/附加上下文 三模块生产接线测试
(对标 codex state/auto_compact_window.rs、model.rs / context_window_guidance.rs /
token_budget_context.rs、state/additional_context.rs)。

构造手法照 test_retention_budget_wiring_58.py:直接构造 AgentLoopV2、驱动相关
内部方法,证明「开关开启有效果 / 开关关闭零差异 / 异常隔离 / 非法 env 降级」。
"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.services.agent_loop_v2 import (  # noqa: E402
    AgentLoopV2,
    _additional_context_enabled_from_env,
    _auto_compact_window_enabled_from_env,
    _build_additional_context_store_from_env,
    _build_auto_compact_window_from_env,
    _world_state_sections_enabled_from_env,
)

_WORLD_ENV = "AGENT_WORLD_STATE_SECTIONS_ENABLED"
_AUTO_ENV = "AGENT_AUTO_COMPACT_WINDOW_ENABLED"
_ADD_ENV = "AGENT_ADDITIONAL_CONTEXT_ENABLED"


async def _noop(messages, tools, **kwargs):  # pragma: no cover - 仅构造用
    return {"content": "", "tool_calls": None}


def _make(model_params=None) -> AgentLoopV2:
    return AgentLoopV2(llm_complete_fn=_noop, tools=[], model_params=model_params)


def _all_keys() -> tuple[str, ...]:
    return (_AUTO_ENV, _WORLD_ENV, _ADD_ENV,
            "AGENT_ROLLOUT_BUDGET_TOKENS", "AGENT_COMPACTION_ENABLED",
            "AGENT_DECISION_CHAIN_ENABLED")


def _clear(monkeypatch) -> None:
    for k in _all_keys():
        monkeypatch.delenv(k, raising=False)


def _count_marker(msgs, marker: str) -> int:
    n = 0
    for m in msgs:
        for c in m.get("content") or []:
            if isinstance(c, dict) and marker in (c.get("text") or ""):
                n += 1
    return n


def _flat_text(msgs) -> str:
    parts = []
    for m in msgs:
        for c in m.get("content") or []:
            if isinstance(c, dict) and c.get("text"):
                parts.append(c["text"])
    return "\n".join(parts)


# --- 默认关闭 / 零差异 ---


def test_disabled_by_default(monkeypatch):
    _clear(monkeypatch)
    loop = _make()
    assert loop._auto_compact_window is None
    assert loop._world_state_sections_enabled is False
    assert loop._additional_context_enabled is False
    assert loop._additional_context_store is None


def test_disabled_injection_no_fragments(monkeypatch):
    _clear(monkeypatch)
    loop = _make()
    msgs = [{"role": "user", "content": "hi"}]
    before = list(msgs)
    loop._inject_world_state_sections(msgs)
    loop._inject_additional_context(msgs)
    # 与接线前逐字节一致
    assert msgs == before
    assert _count_marker(msgs, "<context_window") == 0
    assert _count_marker(msgs, "<context_window_guidance") == 0
    assert _count_marker(msgs, "<external_") == 0


def test_env_helpers_defaults(monkeypatch):
    _clear(monkeypatch)
    assert _auto_compact_window_enabled_from_env() is False
    assert _world_state_sections_enabled_from_env() is False
    assert _additional_context_enabled_from_env() is False
    assert _build_auto_compact_window_from_env() is None
    assert _build_additional_context_store_from_env() is None


def test_env_helpers_invalid_fallback(monkeypatch):
    for bad in ("maybe", "2", "FALSE", "offx"):
        monkeypatch.setenv(_WORLD_ENV, bad)
        assert _world_state_sections_enabled_from_env() is False
        monkeypatch.setenv(_AUTO_ENV, bad)
        assert _auto_compact_window_enabled_from_env() is False
        monkeypatch.setenv(_ADD_ENV, bad)
        assert _additional_context_enabled_from_env() is False


# --- auto_compact_window ---


def test_auto_compact_window_enabled_constructs(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_AUTO_ENV, "on")
    loop = _make()
    assert loop._auto_compact_window is not None


def test_auto_compact_prefill_recorded(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_AUTO_ENV, "on")
    loop = _make()
    loop._observe_auto_compact_prefill({"input_tokens": 123})
    assert loop._auto_compact_window.snapshot().prefill_input_tokens == 123


def test_auto_compact_prefill_first_sample_priority(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_AUTO_ENV, "on")
    loop = _make()
    loop._observe_auto_compact_prefill({"input_tokens": 100})
    loop._observe_auto_compact_prefill({"input_tokens": 50})
    # 首个服务端样本恒优先,不被后续覆盖
    assert loop._auto_compact_window.snapshot().prefill_input_tokens == 100


def test_auto_compact_advance_on_compaction(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_AUTO_ENV, "on")
    monkeypatch.setenv("AGENT_DECISION_CHAIN_ENABLED", "off")
    import app.core.context_compaction as cc

    def _fake_compress(messages, context_limit, trigger_ratio, target_ratio, keep_recent):
        return (
            messages,
            {
                "compressed": True,
                "original_tokens": 10,
                "compressed_tokens": 5,
                "removed_count": 1,
            },
        )

    monkeypatch.setattr(cc, "compress_messages_if_needed", _fake_compress)
    loop = AgentLoopV2(llm_complete_fn=_noop, tools=[], compaction_enabled=True)
    loop._current_iteration = 0  # 避免 broad-except 掩盖 advance 异常隔离
    loop._compaction_context_limit = 200  # 否则 1512 行提前返回,不进入压缩路径
    assert loop._auto_compact_window.window_number == 0
    out = asyncio.run(loop._maybe_compact_context([{"role": "user", "content": "hi"}]))
    assert isinstance(out, list)
    assert loop._auto_compact_window.window_number == 1


# --- world_state_sections ---


def test_world_state_sections_static_only_when_window_missing(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_WORLD_ENV, "on")  # auto_compact 关 → 无窗 id
    loop = _make()
    msgs: list[dict] = []
    loop._inject_world_state_sections(msgs)
    # 仅静态片段(剩余 token),不出现 <context_window>
    assert _count_marker(msgs, "<context_window>") == 0
    assert _count_marker(msgs, "<context_window_guidance") == 0
    assert "tokens left" in _flat_text(msgs)
    for m in msgs:
        assert m["role"] == "developer"


def test_world_state_sections_with_window(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_WORLD_ENV, "on")
    monkeypatch.setenv(_AUTO_ENV, "on")  # 提供真实窗 id
    loop = _make()
    msgs: list[dict] = []
    loop._inject_world_state_sections(msgs)
    text = _flat_text(msgs)
    assert "<context_window>" in text
    assert "tokens left" in text
    # 窗 id 与账本一致,不得伪造
    assert loop._auto_compact_window.ids.window_id in text


def test_world_state_sections_tokens_left_consistency(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_WORLD_ENV, "on")
    monkeypatch.setenv("AGENT_ROLLOUT_BUDGET_TOKENS", "50000")
    loop = _make()
    left = loop._context_tokens_left()
    assert left == 50000
    msgs: list[dict] = []
    loop._inject_world_state_sections(msgs)
    text = _flat_text(msgs)
    assert str(left) in text  # 与 rollout_budget.tokens_left() 一致


def test_world_state_sections_invalid_env_off(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_WORLD_ENV, "maybe")
    loop = _make()
    assert loop._world_state_sections_enabled is False
    msgs: list[dict] = []
    loop._inject_world_state_sections(msgs)  # 不崩、零片段
    assert msgs == []


# --- additional_context_store ---


def test_additional_context_untrusted_user_marker(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_ADD_ENV, "on")
    loop = _make()
    loop.set_additional_context("weather", "sunny", "Untrusted")
    msgs: list[dict] = []
    loop._inject_additional_context(msgs)
    assert len(msgs) == 1
    assert msgs[0]["role"] == "user"
    assert "<external_weather>" in msgs[0]["content"][0]["text"]


def test_additional_context_application_developer_no_marker(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_ADD_ENV, "on")
    loop = _make()
    loop.set_additional_context("sysmsg", "rule", "Application")
    msgs: list[dict] = []
    loop._inject_additional_context(msgs)
    assert len(msgs) == 1
    assert msgs[0]["role"] == "developer"
    assert "<sysmsg>" in msgs[0]["content"][0]["text"]
    assert "<external_" not in msgs[0]["content"][0]["text"]


def test_additional_context_same_value_no_duplicate(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_ADD_ENV, "on")
    loop = _make()
    loop.set_additional_context("k", "v", "Untrusted")
    m1: list[dict] = []
    loop._inject_additional_context(m1)
    assert _count_marker(m1, "<external_") == 1
    # 同值重复 set → 再 merge 不重复产出
    loop.set_additional_context("k", "v", "Untrusted")
    m2: list[dict] = []
    loop._inject_additional_context(m2)
    assert _count_marker(m2, "<external_") == 0


def test_additional_context_empty_store_no_fragment(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_ADD_ENV, "on")
    loop = _make()  # 未 set 任何值
    msgs: list[dict] = []
    loop._inject_additional_context(msgs)
    assert msgs == []


def test_additional_context_off_set_is_noop(monkeypatch):
    _clear(monkeypatch)  # 全部开关默认 off
    loop = _make()
    loop.set_additional_context("k", "v", "Untrusted")
    msgs: list[dict] = []
    loop._inject_additional_context(msgs)
    assert msgs == []
    assert loop._additional_context_store is None


def test_additional_context_invalid_kind_ignored(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_ADD_ENV, "on")
    loop = _make()
    loop.set_additional_context("k", "v", "Bogus")
    # 非法 kind 不写入存储
    assert loop._additional_context_store.get("k") is None
    msgs: list[dict] = []
    loop._inject_additional_context(msgs)
    assert msgs == []


# --- 异常隔离 ---


def test_isolation_world_state(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_WORLD_ENV, "on")
    loop = _make()
    loop._context_tokens_left = lambda: 1 / 0  # 强制抛出异常
    msgs: list[dict] = []
    loop._inject_world_state_sections(msgs)  # 不得抛出,降级跳过
    assert msgs == []


def test_isolation_additional_context(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_ADD_ENV, "on")
    loop = _make()

    class _Boom:
        def merge(self, values):
            raise RuntimeError("boom")

    loop._additional_context_store = _Boom()
    msgs: list[dict] = []
    loop._inject_additional_context(msgs)  # 不得抛出
    assert msgs == []


def test_isolation_auto_compact_prefill(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_AUTO_ENV, "on")
    loop = _make()

    class _Boom:
        def ensure_server_observed_prefill_from_usage(self, input_tokens):
            raise RuntimeError("boom")

    loop._auto_compact_window = _Boom()
    loop._observe_auto_compact_prefill({"input_tokens": 10})  # 不得抛出


def test_isolation_auto_compact_advance(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv(_AUTO_ENV, "on")
    monkeypatch.setenv("AGENT_DECISION_CHAIN_ENABLED", "off")
    import app.core.context_compaction as cc

    def _fake_compress(messages, context_limit, trigger_ratio, target_ratio, keep_recent):
        return (messages, {"compressed": True, "original_tokens": 10,
                           "compressed_tokens": 5, "removed_count": 1})

    monkeypatch.setattr(cc, "compress_messages_if_needed", _fake_compress)
    loop = AgentLoopV2(llm_complete_fn=_noop, tools=[], compaction_enabled=True)
    loop._current_iteration = 0
    loop._compaction_context_limit = 200  # 否则提前返回,不进入压缩路径

    class _Boom:
        def advance(self):
            raise RuntimeError("boom")

    loop._auto_compact_window = _Boom()
    out = asyncio.run(loop._maybe_compact_context([{"role": "user", "content": "hi"}]))
    assert isinstance(out, list)  # 不得抛出
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
