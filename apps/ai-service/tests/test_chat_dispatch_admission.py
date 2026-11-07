# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""网页主聊天派工的宿主准入与模拟结果。

不传 host_view 时仍直接派工:CLI 的 createSubagentTool、调度器,
以及既有单测走的是执行器,不是聊天宿主视图。
网页主路径始终传入由认证会话组装的视图。
默认派工留在本进程,不拉起操作系统进程。
"""

from __future__ import annotations

import asyncio
import multiprocessing
import subprocess

import pytest

from app.routers.llm import _build_subagent_end_event
from app.services.agent_orchestrator import AgentStepResult, agent_orchestrator
from app.services.mcp_server import _tool_dispatch_subagent
from app.services.memory import memory_store
from app.services.work_admission import (
    Assessment,
    Ledger,
    SqliteTicketStore,
    build_chat_trigger,
    get_ledger,
    reset_for_test,
    set_assessor_for_test,
    trigger_disposition,
)


@pytest.fixture(autouse=True)
def _fresh_ledger():
    reset_for_test()
    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()
    yield
    reset_for_test()
    memory_store._store.clear()


class _RecordingOrchestrator:
    def __init__(self, status: str = "completed") -> None:
        self.status = status
        self.calls = 0

    async def invoke(
        self,
        agent_name: str,
        user_input: str,
        session_id: str | None = None,
        **kwargs: object,
    ) -> AgentStepResult:
        self.calls += 1
        return AgentStepResult(
            agent_name=agent_name,
            input=user_input,
            output="ok" if self.status == "completed" else "",
            status=self.status,
            duration_ms=1.0,
        )


def _view(*, addressed: bool, trigger_id: str) -> dict[str, object]:
    return build_chat_trigger(
        user_id="user-1",
        session_id="conv-9",
        trigger_id=trigger_id,
        addressed=addressed,
    )


async def test_chat_host_view_explicit_request_invokes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _RecordingOrchestrator()
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)
    out = await _tool_dispatch_subagent(
        {"name": "coder", "task": "把范围改成别的目录"},
        host_view=_view(addressed=True, trigger_id="user-1:explicit-1"),
    )
    assert out["ok"] is True
    assert fake.calls == 1
    rec = get_ledger().find_trigger("user-1:explicit-1")
    assert rec is not None
    assert rec.mandate.scope == "chat:conv-9"
    assert out["ticketId"] == rec.ticket_id


async def test_observe_unaddressed_records_and_does_not_invoke(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("IHUI_WORK_ACCEPT_MODE", "observe")
    set_assessor_for_test(lambda _view: Assessment(matched_rule_ids=("user-asked",)))
    fake = _RecordingOrchestrator()
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)
    out = await _tool_dispatch_subagent(
        {"name": "coder", "task": "do"},
        host_view=_view(addressed=False, trigger_id="user-1:observe-1"),
    )
    assert fake.calls == 0
    assert out["ok"] is False
    assert out["status"] == "skipped"
    assert out["errorCode"] == "would_accept"
    assert len(get_ledger()) == 0


async def test_host_view_extra_key_rejects_without_invoke(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _RecordingOrchestrator()
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)
    view = _view(addressed=True, trigger_id="user-1:extra-1")
    view["message"] = "正文不能决定范围"
    out = await _tool_dispatch_subagent(
        {"name": "coder", "task": "do"},
        host_view=view,
    )
    assert fake.calls == 0
    assert out["ok"] is False
    assert out["errorCode"] == "host_view_rejected"


async def test_missing_host_view_still_invokes_for_executor_callers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """执行器/CLI/调度不经聊天宿主视图,保持「没传视图也能派」。"""
    fake = _RecordingOrchestrator()
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)
    out = await _tool_dispatch_subagent({"name": "coder", "task": "do"})
    assert out["ok"] is True
    assert fake.calls == 1
    assert "ticketId" not in out


async def test_stub_result_is_not_completed(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _RecordingOrchestrator(status="stub")
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)
    out = await _tool_dispatch_subagent({"name": "coder", "task": "do"})
    assert out["ok"] is False
    assert out["status"] == "stub"
    assert out["stub"] is True
    assert out["errorCode"] == "STUB_RESPONSE"


async def test_gateway_stub_step_is_not_completed(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_complete(*_args: object, **_kwargs: object) -> dict[str, object]:
        return {"content": "simulated", "stub": True, "model": "stub"}

    monkeypatch.setattr(
        "app.services.agent_orchestrator.llm_gateway.complete",
        fake_complete,
    )
    result = await agent_orchestrator.invoke(
        agent_name="researcher",
        user_input="调研",
        session_id="stub-session",
    )
    assert result.status == "stub"
    assert result.status != "completed"


async def test_default_dispatch_does_not_fork_a_process(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    started: list[str] = []

    class _Boom:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            started.append("process")
            raise AssertionError("default dispatch must stay in-process")

    monkeypatch.setattr(multiprocessing, "Process", _Boom)
    monkeypatch.setattr(subprocess, "Popen", _Boom)
    fake = _RecordingOrchestrator()
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)
    out = await _tool_dispatch_subagent({"name": "coder", "task": "do"})
    assert out["ok"] is True
    assert fake.calls == 1
    assert started == []


async def test_cancel_drops_inflight_ticket(monkeypatch: pytest.MonkeyPatch) -> None:
    class _Cancel:
        async def invoke(self, *_args: object, **_kwargs: object) -> AgentStepResult:
            raise asyncio.CancelledError()

    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: _Cancel())
    with pytest.raises(asyncio.CancelledError):
        await _tool_dispatch_subagent(
            {"name": "coder", "task": "do"},
            host_view=_view(addressed=True, trigger_id="user-1:cancel-1"),
        )
    rec = get_ledger().find_trigger("user-1:cancel-1")
    assert rec is not None
    assert rec.last_report == "dropped"
    assert rec.assignment == "ended"
    assert rec.open is False


async def test_restarted_ledger_does_not_redispatch(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    """派工、丢弃、模拟未完成写进会话库后,新账本按同一 trigger 读回且不再派。"""
    db = tmp_path / "sessions.db"
    reset_for_test(SqliteTicketStore(db))
    stub = _RecordingOrchestrator(status="stub")
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: stub)
    stub_out = await _tool_dispatch_subagent(
        {"name": "coder", "task": "do"},
        host_view=_view(addressed=True, trigger_id="user-1:stub-keep"),
    )
    assert stub.calls == 1
    assert stub_out["status"] == "stub"
    assert stub_out["ok"] is False

    class _Cancel:
        def __init__(self) -> None:
            self.calls = 0

        async def invoke(self, *_args: object, **_kwargs: object) -> AgentStepResult:
            self.calls += 1
            raise asyncio.CancelledError()

    cancel = _Cancel()
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: cancel)
    with pytest.raises(asyncio.CancelledError):
        await _tool_dispatch_subagent(
            {"name": "coder", "task": "do"},
            host_view=_view(addressed=True, trigger_id="user-1:drop-keep"),
        )
    assert cancel.calls == 1

    restarted = Ledger(store=SqliteTicketStore(db))
    try:
        stub_rec = restarted.find_trigger("user-1:stub-keep")
        drop_rec = restarted.find_trigger("user-1:drop-keep")
        assert stub_rec is not None
        assert trigger_disposition(stub_rec) == "simulation_incomplete"
        assert stub_rec.last_report != "ready"
        assert drop_rec is not None
        assert trigger_disposition(drop_rec) == "dropped"
    finally:
        restarted.close()

    reset_for_test(SqliteTicketStore(db))
    again = _RecordingOrchestrator()
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: again)
    replay = await _tool_dispatch_subagent(
        {"name": "coder", "task": "do"},
        host_view=_view(addressed=True, trigger_id="user-1:stub-keep"),
    )
    dropped_again = await _tool_dispatch_subagent(
        {"name": "coder", "task": "do"},
        host_view=_view(addressed=True, trigger_id="user-1:drop-keep"),
    )
    assert again.calls == 0
    assert replay["errorCode"] == "duplicate_trigger"
    assert dropped_again["errorCode"] == "duplicate_trigger"


def test_stub_end_event_is_not_done_and_has_no_failure_reason() -> None:
    evt = _build_subagent_end_event(
        "sub-1",
        False,
        {"status": "stub", "stub": True, "output": "模拟正文"},
    )
    assert evt["type"] == "subagent_end"
    assert evt["status"] == "stub"
    assert "failureReason" not in evt


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
