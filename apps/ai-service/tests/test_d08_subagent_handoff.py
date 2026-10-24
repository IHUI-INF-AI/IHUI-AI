# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D08②:agent 间换手消息(完成/受阻/求助)结构化事件。

覆盖:
- 载荷契约:kind(done/blocked/help) / agent_id / summary / [token_usage] / ts
- 三档映射唯一出口 `_subagent_handoff_kind`
- dispatch_subagent 单/并行完成、失败、求助时经 progress_callback 回传结构化字段
- `subagent_end` 帧复用(不新帧)且旧字段 status/id/timestamp/failureReason 语义不变

不起 dev server、不调真实 LLM:orchestrator 全部由 _FakeOrchestrator 替身。
"""

from __future__ import annotations

import pytest

from app.routers.llm import _build_subagent_end_event
from app.services.agent_orchestrator import AgentStepResult
from app.services.mcp_server import (
    _SUBAGENT_HANDOFF_KINDS,
    _subagent_handoff_event,
    _subagent_handoff_kind,
    _tool_dispatch_subagent,
)


class _FakeOrchestrator:
    """最小替身:只实现 invoke / invoke_parallel,不依赖注册表与 LLM。"""

    def __init__(self, invoke_impl=None, parallel_impl=None):
        self._invoke_impl = invoke_impl
        self._parallel_impl = parallel_impl
        self.invoke_calls: list[dict] = []
        self.parallel_calls: list[dict] = []

    async def invoke(self, agent_name, user_input, session_id=None, model_override=None):
        self.invoke_calls.append(
            {"agent_name": agent_name, "user_input": user_input, "session_id": session_id}
        )
        if self._invoke_impl is not None:
            return self._invoke_impl(agent_name, user_input, session_id)
        return AgentStepResult(
            agent_name=agent_name,
            input=user_input,
            output=f"ok-{agent_name}",
            status="completed",
            duration_ms=1.0,
        )

    async def invoke_parallel(self, tasks, max_concurrency=5):
        self.parallel_calls.append({"tasks": tasks, "max_concurrency": max_concurrency})
        if self._parallel_impl is not None:
            return self._parallel_impl(tasks, max_concurrency)
        results = [
            {"name": t["name"], "task": t["task"], "status": "completed",
             "output": f"done-{t['name']}", "error": None, "duration_ms": 1.0}
            for t in tasks
        ]
        return {
            "ok": True, "total": len(results), "succeeded": len(results),
            "failed": 0, "results": results,
            "message": f"并行派发完成:{len(results)}/{len(results)} 成功",
        }


def _single_done_event(events: list[dict]) -> dict:
    done = [e for e in events if e.get("phase") == "single_done"]
    assert len(done) == 1, f"single_done 事件应恰好一条,实际 {events}"
    return done[0]


def _parallel_done_event(events: list[dict]) -> dict:
    done = [e for e in events if e.get("phase") == "parallel_done"]
    assert len(done) == 1, f"parallel_done 事件应恰好一条,实际 {events}"
    return done[0]


# =============================================================================
# 载荷契约 / 三档映射
# =============================================================================

def test_handoff_event_required_fields():
    """一条换手消息至少含 kind / agent_id / summary / ts。"""
    evt = _subagent_handoff_event(
        "done", "sub-abc12345", "已完成 3 个文件", ts="2026-10-24T00:00:00+00:00"
    )
    assert evt == {
        "kind": "done",
        "agent_id": "sub-abc12345",
        "summary": "已完成 3 个文件",
        "ts": "2026-10-24T00:00:00+00:00",
    }


def test_handoff_event_token_usage_only_when_known():
    """token_usage 只在真实拿到时写入,不用 0 冒充。"""
    assert "token_usage" not in _subagent_handoff_event("done", "sub-1", "x", ts="t")
    evt = _subagent_handoff_event(
        "done", "sub-1", "x", token_usage={"total_tokens": 42}, ts="t"
    )
    assert evt["token_usage"] == {"total_tokens": 42}


def test_handoff_event_rejects_unknown_kind():
    """第四档 kind 不得静默落地(帧族只有 done/blocked/help 三种换手语义)。"""
    assert _SUBAGENT_HANDOFF_KINDS == ("done", "blocked", "help")
    with pytest.raises(ValueError):
        _subagent_handoff_event("running", "sub-1", "x")


def test_handoff_event_truncates_summary():
    """summary 是一行摘要(200 上限),不把整段输出塞进帧。"""
    evt = _subagent_handoff_event("done", "sub-1", "层" * 500, ts="t")
    assert len(evt["summary"]) == 200


def test_handoff_kind_mapping():
    """三档唯一映射:显式求助优先,其次按成败分 done / blocked。"""
    assert _subagent_handoff_kind(ok=True) == "done"
    assert _subagent_handoff_kind(ok=False) == "blocked"
    assert _subagent_handoff_kind(ok=False, needs_help=True) == "help"
    assert _subagent_handoff_kind(ok=True, needs_help=True) == "help"


# =============================================================================
# dispatch_subagent 出口:完成 / 受阻 / 求助
# =============================================================================

async def test_single_done_emits_done_handoff(monkeypatch):
    """单 agent 成功 → single_done 进度事件带 kind=done + agent_id + summary + ts。"""
    fake = _FakeOrchestrator()
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)
    events: list[dict] = []

    out = await _tool_dispatch_subagent(
        {"name": "coder", "task": "实现 A"}, progress_callback=events.append
    )

    assert out["ok"] is True
    evt = _single_done_event(events)
    assert evt["kind"] == "done"
    assert evt["agent_id"] == "coder"
    assert evt["summary"] == "ok-coder"
    assert evt["ts"]
    assert "token_usage" not in evt


async def test_single_failure_emits_blocked_handoff(monkeypatch):
    """单 agent 失败 → kind=blocked,summary 取失败原因。"""

    def failed_impl(agent_name, user_input, session_id):
        return AgentStepResult(
            agent_name=agent_name,
            input=user_input,
            output="",
            status="failed",
            error="工具链超时",
        )

    fake = _FakeOrchestrator(invoke_impl=failed_impl)
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)
    events: list[dict] = []

    out = await _tool_dispatch_subagent(
        {"name": "coder", "task": "A"}, progress_callback=events.append
    )

    assert out["ok"] is False
    evt = _single_done_event(events)
    assert evt["kind"] == "blocked"
    assert evt["agent_id"] == "coder"
    assert evt["summary"] == "工具链超时"


async def test_single_needs_help_emits_help_handoff(monkeypatch):
    """子代理显式 needs_help → kind=help,且工具结果带求助位供 subagent_end 复用。"""

    def help_impl(agent_name, user_input, session_id):
        result = AgentStepResult(
            agent_name=agent_name,
            input=user_input,
            output="",
            status="failed",
            error="需要主代理提供部署凭据",
        )
        result.needs_help = True
        return result

    fake = _FakeOrchestrator(invoke_impl=help_impl)
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)
    events: list[dict] = []

    out = await _tool_dispatch_subagent(
        {"name": "coder", "task": "A"}, progress_callback=events.append
    )

    evt = _single_done_event(events)
    assert evt["kind"] == "help"
    assert evt["summary"] == "需要主代理提供部署凭据"
    assert out["needs_help"] is True


async def test_parallel_done_emits_done_handoff(monkeypatch):
    """并行全部成功 → kind=done,summary 取编排汇总文案。"""
    fake = _FakeOrchestrator()
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)
    events: list[dict] = []

    await _tool_dispatch_subagent(
        {"tasks": [{"name": "coder", "task": "A"}, {"name": "researcher", "task": "B"}]},
        progress_callback=events.append,
    )

    evt = _parallel_done_event(events)
    assert evt["kind"] == "done"
    assert evt["agent_id"] == ""
    assert "成功" in evt["summary"]
    assert evt["ts"]


async def test_parallel_partial_failure_emits_blocked_handoff(monkeypatch):
    """并行有失败 → kind=blocked(计数透传,不把部分失败读成完成)。"""

    def partial_impl(tasks, max_concurrency):
        results = [
            {"name": "coder", "task": "A", "status": "completed",
             "output": "ok", "error": None, "duration_ms": 1.0},
            {"name": "debugger", "task": "B", "status": "failed",
             "output": "", "error": "模拟失败", "duration_ms": 1.0},
        ]
        return {"ok": True, "total": 2, "succeeded": 1, "failed": 1,
                "results": results, "message": "并行派发完成:1/2 成功"}

    fake = _FakeOrchestrator(parallel_impl=partial_impl)
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)
    events: list[dict] = []

    await _tool_dispatch_subagent(
        {"tasks": [{"name": "coder", "task": "A"}, {"name": "debugger", "task": "B"}]},
        progress_callback=events.append,
    )

    evt = _parallel_done_event(events)
    assert evt["kind"] == "blocked"
    assert evt["summary"] == "并行派发完成:1/2 成功"


async def test_parallel_needs_help_emits_help_handoff(monkeypatch):
    """任一子任务求助 → kind=help(求助优先于成败)。"""

    def help_impl(tasks, max_concurrency):
        results = [
            {"name": "coder", "task": "A", "status": "completed",
             "output": "ok", "error": None, "duration_ms": 1.0},
            {"name": "debugger", "task": "B", "status": "failed",
             "output": "", "error": "要人确认", "needs_help": True, "duration_ms": 1.0},
        ]
        return {"ok": False, "total": 2, "succeeded": 1, "failed": 1,
                "results": results, "message": "并行派发完成:1/2 成功"}

    fake = _FakeOrchestrator(parallel_impl=help_impl)
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)
    events: list[dict] = []

    out = await _tool_dispatch_subagent(
        {"tasks": [{"name": "coder", "task": "A"}, {"name": "debugger", "task": "B"}]},
        progress_callback=events.append,
    )

    assert _parallel_done_event(events)["kind"] == "help"
    assert out["needs_help"] is True


# =============================================================================
# SSE 侧:复用 subagent_end 帧(零新帧)
# =============================================================================

def test_end_frame_reuses_subagent_end_and_keeps_legacy_payload():
    """完成帧仍是 subagent_end,旧字段(id/status/timestamp)一字不动,只加换手字段。"""
    evt = _build_subagent_end_event(
        "sub-1234", True, {"status": "completed", "output": "done"}, ts="2026-10-24T00:00:00+00:00"
    )
    assert evt["type"] == "subagent_end"
    assert evt["id"] == "sub-1234"
    assert evt["status"] == "done"
    assert evt["timestamp"] == "2026-10-24T00:00:00+00:00"
    assert evt["kind"] == "done"
    assert evt["agent_id"] == "sub-1234"
    assert evt["summary"] == "done"
    assert evt["ts"] == "2026-10-24T00:00:00+00:00"
    assert "failureReason" not in evt


def test_end_frame_blocked_keeps_failure_reason():
    """受阻帧:kind=blocked,status=failed,failureReason 旧语义(优先 error)。"""
    evt = _build_subagent_end_event(
        "sub-2", False, {"status": "failed", "error": "timeout", "message": "ignored"}
    )
    assert evt["kind"] == "blocked"
    assert evt["status"] == "failed"
    assert evt["failureReason"] == "timeout"
    assert evt["summary"] == "timeout"


def test_end_frame_help_and_token_usage():
    """求助帧:kind=help;token_usage 有则透传,无则缺席。"""
    evt = _build_subagent_end_event(
        "sub-3",
        False,
        {
            "status": "failed",
            "error": "需要人工确认",
            "needs_help": True,
            "token_usage": {"total_tokens": 128},
        },
    )
    assert evt["kind"] == "help"
    assert evt["token_usage"] == {"total_tokens": 128}

    no_usage = _build_subagent_end_event("sub-4", True, {"output": "ok"})
    assert "token_usage" not in no_usage
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
