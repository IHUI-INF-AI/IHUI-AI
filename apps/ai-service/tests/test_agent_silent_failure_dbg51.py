# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""DBG-51: 代理循环与工具执行里被 except Exception: pass 吞掉的失败。

钉住两件事:失败必须留下 warning;调用方拿到的返回值不能把失败说成成功。
"""

from __future__ import annotations

import asyncio
import base64
import logging
from pathlib import Path

import pytest

from app.services import agent_engine as engine_mod
from app.services.agent_loop_v2 import (
    AgentLoopV2,
    _approval_persist_keys,
    grant_tool_approval_persist,
    revoke_tool_approval,
)

_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


async def _noop(messages, tools, **kwargs):
    return {"content": "", "tool_calls": None}


def _loop() -> AgentLoopV2:
    return AgentLoopV2(llm_complete_fn=_noop, tools=[])


def test_revoke_failure_is_false_and_logged(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    def _boom(*_a: object, **_k: object) -> None:
        raise RuntimeError("revoke down")

    monkeypatch.setattr("app.services.approval_persistence.revoke", _boom)
    caplog.set_level(logging.WARNING)
    assert revoke_tool_approval("write_file", {"path": "/tmp/x"}) is False
    assert "revoke down" in caplog.text
    assert "不得当成已撤销" in caplog.text


def test_revoke_success_returns_true(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: list[tuple[object, object]] = []

    def _ok(key: object, kind: object) -> None:
        seen.append((key, kind))

    monkeypatch.setattr("app.services.approval_persistence.revoke", _ok)
    assert revoke_tool_approval("write_file", {"path": "/tmp/x"}) is True
    assert seen and seen[0][1] == "mcp_tool"


def test_grant_persist_failure_returns_false_and_logs(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    def _boom(*_a: object, **_k: object) -> None:
        raise RuntimeError("grant down")

    monkeypatch.setattr("app.services.approval_persistence.grant", _boom)
    _approval_persist_keys["appr_dbg51"] = "write_file\x1f{}"
    caplog.set_level(logging.WARNING)
    try:
        assert grant_tool_approval_persist("appr_dbg51", "session") is False
    finally:
        _approval_persist_keys.pop("appr_dbg51", None)
    assert "grant down" in caplog.text
    assert "不当成已授予" in caplog.text


def test_context_tokens_left_failure_is_unknown(caplog: pytest.LogCaptureFixture) -> None:
    loop = _loop()

    class _Boom:
        def tokens_left(self) -> int:
            raise RuntimeError("budget down")

    loop._rollout_budget = _Boom()
    caplog.set_level(logging.WARNING)
    assert loop._context_tokens_left() is None
    assert "budget down" in caplog.text
    assert "按未知返回" in caplog.text


def test_effort_pin_retire_failure_is_logged(caplog: pytest.LogCaptureFixture) -> None:
    loop = _loop()

    class _Pin:
        def retire_on_compaction(self) -> None:
            raise RuntimeError("pin down")

    loop._reasoning_effort_pin = _Pin()
    caplog.set_level(logging.WARNING)
    loop._retire_effort_pin_on_compaction()
    assert "pin down" in caplog.text
    assert "压缩结果仍有效" in caplog.text


def test_clock_sleep_failure_is_returned(caplog: pytest.LogCaptureFixture) -> None:
    eng = engine_mod.AgentEngine.__new__(engine_mod.AgentEngine)
    thread = engine_mod.EngineThread.__new__(engine_mod.EngineThread)
    thread.touch = lambda: None

    class _BadEvent:
        def wait(self) -> None:
            raise RuntimeError("wait down")

    class _Loop:
        steer_wake_event = _BadEvent()

    thread.loop = _Loop()
    tool = eng._clock_sleep_tool(thread)
    caplog.set_level(logging.WARNING)
    result = asyncio.run(tool.executor({"duration_ms": 20}))
    assert str(result["error"]).startswith("clock_sleep 等待失败")
    assert "wait down" in result["error"]
    assert result["interrupted"] is False
    assert "slept_ms" in result
    assert "wait down" in caplog.text


def test_clock_sleep_cancel_still_propagates() -> None:
    eng = engine_mod.AgentEngine.__new__(engine_mod.AgentEngine)
    thread = engine_mod.EngineThread.__new__(engine_mod.EngineThread)
    thread.touch = lambda: None

    class _CancelEvent:
        def wait(self) -> None:
            raise asyncio.CancelledError()

    class _Loop:
        steer_wake_event = _CancelEvent()

    thread.loop = _Loop()
    tool = eng._clock_sleep_tool(thread)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(tool.executor({"duration_ms": 20}))


def _view_tool(tmp_path: Path) -> object:
    eng = engine_mod.AgentEngine.__new__(engine_mod.AgentEngine)
    thread = engine_mod.EngineThread.__new__(engine_mod.EngineThread)
    thread.workspace = str(tmp_path)
    thread.loop = None
    thread.emit = None
    (tmp_path / "dot.png").write_bytes(_PNG)
    return eng._view_image_tool(thread)


def test_view_image_prepare_failure_logs_and_returns_bytes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    def _boom(*_a: object, **_k: object) -> None:
        raise RuntimeError("prep down")

    monkeypatch.setattr(engine_mod, "_load_data_url_for_prompt", _boom)
    tool = _view_tool(tmp_path)
    caplog.set_level(logging.WARNING)
    result = asyncio.run(tool.executor({"path": "dot.png"}))
    assert "error" not in result
    assert result["dataUrl"].startswith("data:image/png;base64,")
    raw = base64.b64decode(result["dataUrl"].split(",", 1)[1])
    assert raw == _PNG
    assert "prep down" in caplog.text
    assert "回退原始 dataUrl" in caplog.text


class _Prepared:
    width = 8
    height = 8
    source_width = 64
    source_height = 64

    def into_data_url(self) -> str:
        return "data:image/png;base64,QUJD"


def test_view_image_notice_failure_logs_and_keeps_image(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(engine_mod, "_load_data_url_for_prompt", lambda *_a, **_k: _Prepared())

    def _boom(*_a: object, **_k: object) -> None:
        raise RuntimeError("notice down")

    monkeypatch.setattr(
        "app.core.image_preparation.build_image_resize_notice_fragment",
        _boom,
    )
    tool = _view_tool(tmp_path)
    caplog.set_level(logging.WARNING)
    result = asyncio.run(tool.executor({"path": "dot.png"}))
    assert "error" not in result
    assert result["dataUrl"] == "data:image/png;base64,QUJD"
    assert "降采样" in result["note"]
    assert "notice down" in caplog.text
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
