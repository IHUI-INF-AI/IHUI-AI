# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批58(十三):保留区逐组预算精修接线测试(对标 codex compact_remote_v2)。"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.services.agent_loop_v2 import (  # noqa: E402
    AgentLoopV2,
    _compaction_retention_budget_enabled_from_env,
    _compaction_retention_budget_tokens_from_env,
    _compaction_retention_image_budget_from_env,
    _compaction_retention_max_agent_tokens_from_env,
)


async def _noop_complete(messages, tools, **kwargs):  # pragma: no cover - 仅构造用
    return {"content": "", "tool_calls": None}


def _make_loop() -> AgentLoopV2:
    return AgentLoopV2(llm_complete_fn=_noop_complete, tools=[])


def _summary_msg() -> dict:
    return {"role": "user", "content": "[上下文摘要 — 之前 10 条消息已压缩]历史要点"}


def _big_agent_msg(tokens: int) -> dict:
    # estimate_tokens 约 4 字符/token
    return {"role": "assistant", "content": "x" * (tokens * 4)}


def test_disabled_by_default_returns_unchanged(monkeypatch):
    for key in (
        "AGENT_COMPACTION_RETENTION_BUDGET_ENABLED",
        "AGENT_COMPACTION_RETENTION_BUDGET_TOKENS",
        "AGENT_COMPACTION_RETENTION_IMAGE_BUDGET",
        "AGENT_COMPACTION_RETENTION_MAX_AGENT_TOKENS",
    ):
        monkeypatch.delenv(key, raising=False)
    loop = _make_loop()
    assert loop._retention_budget_enabled is False
    msgs = [_summary_msg(), {"role": "user", "content": "hi"}]
    out, meta = loop._apply_retention_budget(msgs)
    assert out is msgs
    assert meta == {"enabled": False}


def test_enabled_drops_over_budget_groups(monkeypatch):
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_ENABLED", "on")
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_TOKENS", "200")
    loop = _make_loop()
    assert loop._retention_budget_enabled is True
    assert loop._retention_budget_tokens == 200
    # 前缀(摘要)+ 3 组旧消息,每组约 300 tokens,预算 200 → 只能保留最新一组
    msgs = [
        _summary_msg(),
        {"role": "user", "content": "a" * 1200},
        _big_agent_msg(300),
        {"role": "user", "content": "b" * 1200},
        _big_agent_msg(300),
        {"role": "user", "content": "c" * 1200},
        _big_agent_msg(10),
    ]
    out, meta = loop._apply_retention_budget(msgs)
    assert meta["applied"] is True
    assert meta["dropped_groups"] > 0
    assert out[0] is msgs[0]  # 摘要前缀原位
    assert len(out) < len(msgs)


def test_enabled_keeps_within_budget_untouched(monkeypatch):
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_ENABLED", "1")
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_TOKENS", "100000")
    loop = _make_loop()
    msgs = [_summary_msg(), {"role": "user", "content": "small"}]
    out, meta = loop._apply_retention_budget(msgs)
    assert meta["applied"] is True
    assert meta["dropped_groups"] == 0
    assert len(out) == len(msgs)


def test_long_agent_message_truncated(monkeypatch):
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_ENABLED", "on")
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_TOKENS", "100000")
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_MAX_AGENT_TOKENS", "100")
    loop = _make_loop()
    assert loop._retention_max_agent_tokens == 100
    msgs = [_summary_msg(), _big_agent_msg(5000)]
    out, meta = loop._apply_retention_budget(msgs)
    assert meta["truncated_messages"] == 1
    assert len(out[-1]["content"]) < len(msgs[-1]["content"])


def test_all_dropped_budget_guard_keeps_original(monkeypatch):
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_ENABLED", "on")
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_TOKENS", "1")
    loop = _make_loop()
    msgs = [_summary_msg(), {"role": "user", "content": "y" * 4000}]
    out, meta = loop._apply_retention_budget(msgs)
    assert meta["applied"] is False
    assert meta["reason"] == "budget_would_drop_all_retained"
    assert out is msgs  # 保守护栏:不清空活上下文


def test_no_retained_segment(monkeypatch):
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_ENABLED", "on")
    loop = _make_loop()
    msgs = [_summary_msg()]
    out, meta = loop._apply_retention_budget(msgs)
    assert meta["applied"] is False
    assert meta["reason"] == "no_retained"
    assert out is msgs


def test_system_prefix_preserved(monkeypatch):
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_ENABLED", "on")
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_TOKENS", "100000")
    loop = _make_loop()
    sys_msg = {"role": "system", "content": "you are ihui"}
    msgs = [sys_msg, _summary_msg(), {"role": "user", "content": "hi"}]
    out, _meta = loop._apply_retention_budget(msgs)
    assert out[0] is sys_msg and out[1] is msgs[1]


# --- env 解析助手 ---


def test_env_helpers_defaults(monkeypatch):
    for key in (
        "AGENT_COMPACTION_RETENTION_BUDGET_ENABLED",
        "AGENT_COMPACTION_RETENTION_BUDGET_TOKENS",
        "AGENT_COMPACTION_RETENTION_IMAGE_BUDGET",
        "AGENT_COMPACTION_RETENTION_MAX_AGENT_TOKENS",
    ):
        monkeypatch.delenv(key, raising=False)
    assert _compaction_retention_budget_enabled_from_env() is False
    assert _compaction_retention_budget_tokens_from_env() == 64000
    assert _compaction_retention_image_budget_from_env() is False
    assert _compaction_retention_max_agent_tokens_from_env() == 10000


def test_env_helpers_invalid_fallback(monkeypatch):
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_TOKENS", "abc")
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_TOKENS", "-5")
    assert _compaction_retention_budget_tokens_from_env() == 64000
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_MAX_AGENT_TOKENS", "not-a-number")
    assert _compaction_retention_max_agent_tokens_from_env() == 10000


def test_env_helpers_truthy_values(monkeypatch):
    for value in ("on", "1", "true", "yes", "ON"):
        monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_ENABLED", value)
        assert _compaction_retention_budget_enabled_from_env() is True
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_IMAGE_BUDGET", "yes")
    assert _compaction_retention_image_budget_from_env() is True


def test_compaction_loop_env_flag_wired(monkeypatch):
    """开关经 __init__ 生效:开启后循环实例三参数与 env 同步。"""
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_ENABLED", "on")
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_BUDGET_TOKENS", "1234")
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_IMAGE_BUDGET", "on")
    monkeypatch.setenv("AGENT_COMPACTION_RETENTION_MAX_AGENT_TOKENS", "777")
    loop = _make_loop()
    assert loop._retention_budget_enabled is True
    assert loop._retention_budget_tokens == 1234
    assert loop._retention_image_budget is True
    assert loop._retention_max_agent_tokens == 777


def test_asyncio_smoke_no_pending():  # pragma: no cover - 防 asyncio 导入未用告警
    asyncio.run(asyncio.sleep(0))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
