# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""bg_task_status 的等待/取消控制面(对齐 DSH job_output(wait)/job_kill)。

钉住六件事:
① wait_s>0 等到终态即返回,不把 running 说成完成;
② 到点仍未终态 ⇒ waitTimedOut=true;
③ cancel=true 真正调用 manager.cancel,并回取消后的状态;
④ 已终态再 cancel ⇒ 如实回"不再变更",不伪造成功;
⑤ 列表模式拒绝 cancel/wait_s,不误伤别的任务;
⑥ 非本人任务与不存在同形,且不触发 cancel。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services import background_tasks, mcp_server

IDENTITY = {"__user_id": "u1"}


class FakeManager:
    def __init__(self, statuses: list[dict[str, Any]], cancel_result: dict[str, Any] | None = None):
        self.statuses = [dict(s) for s in statuses]
        self.cancel_result = cancel_result or {"ok": True, "state": "cancelled"}
        self.cancel_calls: list[str] = []
        self.list_calls: list[dict[str, Any]] = []
        self.cancelled = False

    async def get_status(self, task_id: str) -> dict[str, Any] | None:
        if self.cancelled:
            return {**self.statuses[-1], "task_id": task_id, "state": "cancelled"}
        if len(self.statuses) > 1:
            return self.statuses.pop(0)
        return self.statuses[0]

    async def cancel(self, task_id: str) -> dict[str, Any]:
        self.cancel_calls.append(task_id)
        if self.cancel_result.get("ok"):
            self.cancelled = True
        return self.cancel_result

    async def list_tasks(self, user_id: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
        self.list_calls.append({"user_id": user_id, "limit": limit})
        return []


def _status(state: str, user_id: str = "u1") -> dict[str, Any]:
    return {"task_id": "t1", "user_id": user_id, "state": state, "name": "job", "result": None}


@pytest.fixture
def fake(monkeypatch: pytest.MonkeyPatch):
    def install(statuses: list[dict[str, Any]], cancel_result: dict[str, Any] | None = None) -> FakeManager:
        manager = FakeManager(statuses, cancel_result)
        monkeypatch.setattr(background_tasks.background_task_manager, "get_status", manager.get_status)
        monkeypatch.setattr(background_tasks.background_task_manager, "cancel", manager.cancel)
        monkeypatch.setattr(background_tasks.background_task_manager, "list_tasks", manager.list_tasks)
        return manager

    return install


async def test_wait_returns_terminal_state(fake) -> None:
    manager = fake([_status("running"), _status("succeeded")])
    result = await mcp_server._tool_bg_task_status(
        {"task_id": "t1", "wait_s": 0.05, **IDENTITY}
    )
    assert result["ok"] is True
    assert result["waited"] is True
    assert result["waitTimedOut"] is False
    assert result["task"]["state"] == "succeeded"
    assert manager.cancel_calls == []


async def test_wait_times_out_honestly(fake) -> None:
    fake([_status("running")])
    result = await mcp_server._tool_bg_task_status(
        {"task_id": "t1", "wait_s": 0.02, **IDENTITY}
    )
    assert result["ok"] is True
    assert result["waited"] is True
    assert result["waitTimedOut"] is True
    assert result["task"]["state"] == "running"


async def test_cancel_calls_manager_and_reports_terminal(fake) -> None:
    manager = fake([_status("running")])
    result = await mcp_server._tool_bg_task_status(
        {"task_id": "t1", "cancel": True, **IDENTITY}
    )
    assert result["ok"] is True
    assert result["cancelled"] is True
    assert result["task"]["state"] == "cancelled"
    assert manager.cancel_calls == ["t1"]


async def test_cancel_on_terminal_reports_not_changed(fake) -> None:
    fake(
        [_status("succeeded")],
        {"ok": False, "state": "succeeded", "message": "任务已落终态,不再变更"},
    )
    result = await mcp_server._tool_bg_task_status(
        {"task_id": "t1", "cancel": True, **IDENTITY}
    )
    assert result["ok"] is True
    assert result["cancelled"] is False
    assert result["cancel"]["message"] == "任务已落终态,不再变更"


async def test_list_mode_rejects_cancel_and_wait(fake) -> None:
    manager = fake([_status("running")])
    for extra in ({"cancel": True}, {"wait_s": 5}):
        result = await mcp_server._tool_bg_task_status({**extra, **IDENTITY})
        assert result["ok"] is False
        assert result["errorCode"] == "INVALID_ARGUMENT"
    assert manager.cancel_calls == []
    assert manager.list_calls == []


async def test_foreign_task_is_not_found_and_not_cancelled(fake) -> None:
    manager = fake([_status("running", user_id="u2")])
    result = await mcp_server._tool_bg_task_status(
        {"task_id": "t1", "cancel": True, **IDENTITY}
    )
    assert result["ok"] is False
    assert "任务不存在" in result["error"]
    assert manager.cancel_calls == []


def test_schema_advertises_control_args() -> None:
    tool = next(t for t in mcp_server._TOOLS if t.name == "bg_task_status")
    props = tool.input_schema["properties"]
    assert props["wait_s"]["minimum"] == 0
    assert props["wait_s"]["maximum"] == 300
    assert props["cancel"]["type"] == "boolean"
    assert "waitTimedOut" in tool.description
