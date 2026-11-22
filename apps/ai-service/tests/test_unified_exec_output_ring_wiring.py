# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""unified_exec 输出环接线(2026-11-23 P0-5)。

立因:旧实现把常驻 shell 的输出存成一个纯字符串,超限时截断,增量读取却按
**旧长度**切 ⇒ 截断后那一刀落在随机位置,输出被静默吞掉("(无新增输出)")。
本文件钉住接线后的三条事实:

  1. 会话只持有 `OutputRing`(不再有 legacy `buffer`),容量来自既有 HEAD/TAIL 常量;
  2. 回执带绝对偏移三字段(`nextOffset` / `outputLossy` / `outputDroppedChars`);
  3. 大输出触发丢弃时**标 lossy + 丢弃数**,不许静默变空。
"""

from __future__ import annotations

import sys
from typing import Any

import pytest

import app.services.agent_engine as engine_mod
from app.services.agent_engine import AgentEngine
from app.services.output_ring import OutputRing

# =============================================================================
# 夹具(与 test_engine_harness_fourth 同款模式,自包含)
# =============================================================================


class _SimpleResult:
    def __init__(self, final_response: str = "done") -> None:
        self.final_response = final_response

    success = True
    stop_reason = "end_turn"
    iterations: list[Any] = []
    total_duration_ms = 1.0
    total_tokens_used = 123
    checkpoint_id = None
    error = None
    budget = None
    compaction_events: list[Any] = []


class _FakeLoop:
    def __init__(self, response: str = "done") -> None:
        self.spec: dict[str, Any] = {}
        self.host_tools: list[Any] = []
        self._response = response

    async def run(self, messages: list[dict[str, Any]]) -> Any:
        return _SimpleResult(self._response)

    async def resume_from_checkpoint(self, checkpoint_id: str) -> Any:
        return _SimpleResult(self._response)

    async def interrupt(self, mode: str = "cancel") -> Any:
        return None


def _engine():
    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop()
        loop.spec = spec
        loop.host_tools = host_tools
        return loop

    return AgentEngine(loop_factory=factory)


async def _thread_tool(engine: AgentEngine):
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 1, "method": "thread.start", "params": {}}
    )
    assert response is not None and "error" not in response, response
    thread = engine._threads[response["result"]["threadId"]]
    for definition in engine._builtin_tool_definitions(thread):
        if getattr(definition, "name", "") == "unified_exec":
            return definition
    raise AssertionError("内置工具未注入: unified_exec")


@pytest.fixture(autouse=True)
def _mock_hook_engine(monkeypatch):
    class FakeHookEngine:
        async def emit(self, event, context):
            return []

    monkeypatch.setattr("app.services.agent_loop_v2.hook_engine", FakeHookEngine())
    monkeypatch.setattr("app.services.agent_loop_v2._approval_registry", {})
    yield


# =============================================================================
# 1. 会话持有 OutputRing,不再有 legacy buffer
# =============================================================================


@pytest.mark.asyncio
async def test_session_uses_output_ring_not_legacy_buffer():
    engine = _engine()
    tool = await _thread_tool(engine)
    first = await tool.executor({"command": "echo ring-probe", "timeoutMs": 5000})
    assert "ring-probe" in first["output"], first
    session = engine._exec_sessions[first["sessionId"]]
    assert "buffer" not in session, "legacy 字符串 buffer 必须退场(否则双真相源)"
    ring = session["ring"]
    assert isinstance(ring, OutputRing)
    assert ring._max_chars == engine_mod._EXEC_BUFFER_HEAD + engine_mod._EXEC_BUFFER_TAIL
    assert ring._head_cap == engine_mod._EXEC_BUFFER_HEAD


# =============================================================================
# 2. 回执带绝对偏移三字段
# =============================================================================


@pytest.mark.asyncio
async def test_receipt_carries_absolute_offset_fields():
    engine = _engine()
    tool = await _thread_tool(engine)
    first = await tool.executor({"command": "echo offset-a", "timeoutMs": 5000})
    assert isinstance(first["nextOffset"], int)
    assert first["nextOffset"] > 0
    assert first["outputLossy"] is False
    assert first["outputDroppedChars"] == 0
    second = await tool.executor(
        {"command": "echo offset-b", "sessionId": first["sessionId"], "timeoutMs": 5000}
    )
    assert second["nextOffset"] >= first["nextOffset"], "绝对偏移只增不减"


# =============================================================================
# 3. 大输出:标 lossy + 丢弃数,不静默变空
# =============================================================================


@pytest.mark.asyncio
async def test_large_output_marks_lossy_instead_of_silent_empty(monkeypatch):
    monkeypatch.setattr(engine_mod, "_EXEC_BUFFER_HEAD", 100)
    monkeypatch.setattr(engine_mod, "_EXEC_BUFFER_TAIL", 600)
    engine = _engine()
    tool = await _thread_tool(engine)
    command = f'"{sys.executable}" -c "print(\'y\'*20000)"'
    first = await tool.executor({"command": command, "timeoutMs": 30000})
    assert "error" not in first, first
    assert first["outputLossy"] is True, first
    assert first["outputDroppedChars"] > 0, first
    assert first["output"], "不许回空串冒充"
    assert "y" in first["output"], "窗口内仍有尾部输出"
    assert "中间丢弃" in first["output"], "截断处必须带标记"


# =============================================================================
# 4. 截断后续读:从环窗口读,不报"无新增输出"的空欢喜
# =============================================================================


@pytest.mark.asyncio
async def test_reuse_after_truncation_reads_from_ring_window(monkeypatch):
    monkeypatch.setattr(engine_mod, "_EXEC_BUFFER_HEAD", 100)
    monkeypatch.setattr(engine_mod, "_EXEC_BUFFER_TAIL", 600)
    engine = _engine()
    tool = await _thread_tool(engine)
    command = f'"{sys.executable}" -c "print(\'z\'*12000)"'
    first = await tool.executor({"command": command, "timeoutMs": 30000})
    session = engine._exec_sessions[first["sessionId"]]
    # 续写一条新命令:游标从当前 total 起,读到的是新输出(不再按旧长度错位)
    second = await tool.executor(
        {"command": "echo after-truncate", "sessionId": first["sessionId"], "timeoutMs": 5000}
    )
    assert second["sessionId"] == first["sessionId"]
    assert "after-truncate" in second["output"], second
    assert second["nextOffset"] > session["ring"].total_written - 100
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
