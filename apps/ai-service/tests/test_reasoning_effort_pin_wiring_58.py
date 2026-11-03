# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批58(十九):推理努力档位钉扎接线测试(对标 codex reasoning_effort.rs)。"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.core.reasoning_effort_pin import ReasoningEffortPin  # noqa: E402
from app.services.agent_loop_v2 import (  # noqa: E402
    AgentLoopV2,
    _build_reasoning_effort_pin_from_env,
)

_PIN_ENV = (
    "AGENT_REASONING_EFFORT_PIN_ENABLED",
    "AGENT_REASONING_EFFORT_PIN_MODELS",
    "AGENT_MODEL_NAME",
)


async def _noop(messages, tools, **kwargs):  # pragma: no cover
    return {"content": "", "tool_calls": None}


def _clear(monkeypatch) -> None:
    for key in _PIN_ENV:
        monkeypatch.delenv(key, raising=False)


def _make(model_params=None) -> AgentLoopV2:
    return AgentLoopV2(llm_complete_fn=_noop, tools=[], model_params=model_params)


# --- 构造门 ---


def test_pin_disabled_by_default(monkeypatch):
    _clear(monkeypatch)
    assert _build_reasoning_effort_pin_from_env() is None


def test_pin_requires_model_whitelist(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("AGENT_REASONING_EFFORT_PIN_ENABLED", "on")
    assert _build_reasoning_effort_pin_from_env() is None  # 白名单空 → 不启用
    monkeypatch.setenv("AGENT_REASONING_EFFORT_PIN_MODELS", "gpt-5, o3 ")
    pin = _build_reasoning_effort_pin_from_env()
    assert isinstance(pin, ReasoningEffortPin)
    assert pin.allowed_models == frozenset({"gpt-5", "o3"})


def test_loop_without_pin_returns_none(monkeypatch):
    _clear(monkeypatch)
    loop = _make()
    assert loop._reasoning_effort_pin is None
    assert loop._resolve_effort_for_request("high") is None


# --- 采样请求档位解析 ---


def test_enabled_pin_establishes_and_sticks(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("AGENT_REASONING_EFFORT_PIN_ENABLED", "on")
    monkeypatch.setenv("AGENT_REASONING_EFFORT_PIN_MODELS", "gpt-5")
    monkeypatch.setenv("AGENT_MODEL_NAME", "gpt-5")
    loop = _make()
    assert loop._resolve_effort_for_request("medium") == "medium"
    # 粘滞:同窗内后续不同档位请求返回既有钉扎值
    assert loop._resolve_effort_for_request("high") == "medium"


def test_model_params_model_takes_precedence(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("AGENT_REASONING_EFFORT_PIN_ENABLED", "on")
    monkeypatch.setenv("AGENT_REASONING_EFFORT_PIN_MODELS", "gpt-5")
    monkeypatch.setenv("AGENT_MODEL_NAME", "other-model")
    loop = _make({"model": "gpt-5"})
    assert loop._resolve_effort_for_request("low") == "low"


def test_model_not_in_whitelist_not_pinned(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("AGENT_REASONING_EFFORT_PIN_ENABLED", "on")
    monkeypatch.setenv("AGENT_REASONING_EFFORT_PIN_MODELS", "gpt-5")
    monkeypatch.setenv("AGENT_MODEL_NAME", "unlisted")
    loop = _make()
    assert loop._resolve_effort_for_request("high") is None


def test_unknown_effort_not_injected(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("AGENT_REASONING_EFFORT_PIN_ENABLED", "on")
    monkeypatch.setenv("AGENT_REASONING_EFFORT_PIN_MODELS", "gpt-5")
    loop = _make()
    assert loop._resolve_effort_for_request("custom-x") is None
    assert loop._reasoning_effort_pin.state.get("default") is None


def test_non_string_effort_ignored(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("AGENT_REASONING_EFFORT_PIN_ENABLED", "on")
    monkeypatch.setenv("AGENT_REASONING_EFFORT_PIN_MODELS", "gpt-5")
    loop = _make()
    assert loop._resolve_effort_for_request(None) is None
    assert loop._resolve_effort_for_request(3) is None


def test_falls_back_to_default_model_key(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("AGENT_REASONING_EFFORT_PIN_ENABLED", "on")
    monkeypatch.setenv("AGENT_REASONING_EFFORT_PIN_MODELS", "default")
    loop = _make()
    assert loop._resolve_effort_for_request("minimal") == "minimal"


# --- 压缩退役 ---


def test_retire_on_compaction_resets_pin(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("AGENT_REASONING_EFFORT_PIN_ENABLED", "on")
    monkeypatch.setenv("AGENT_REASONING_EFFORT_PIN_MODELS", "default")
    loop = _make()
    assert loop._resolve_effort_for_request("high") == "high"
    loop._retire_effort_pin_on_compaction()
    assert loop._reasoning_effort_pin.state.compacted is True
    assert loop._reasoning_effort_pin.state.get("default") is None
    # 退役后新窗可重建基线
    assert loop._resolve_effort_for_request("low") == "low"


def test_retire_noop_without_pin(monkeypatch):
    _clear(monkeypatch)
    loop = _make()
    loop._retire_effort_pin_on_compaction()  # 不应抛异常
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
