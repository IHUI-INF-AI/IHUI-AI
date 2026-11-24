# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""run_workflow 后台化契约。

钉住五件事:
① run_in_background=true 时**不同步执行**,立即返回 task_id/status=pending;
② 提交进后台的是同一份 run_workflow 语义(主体/角色/续跑 run_id 原样带入);
③ 后台任务被拒/禁用 ⇒ BACKGROUND_REJECTED + detail,不伪装成已开始;
④ 不传 run_in_background ⇒ 旧同步契约零变化;
⑤ 身份缺失仍先 fail-closed,连后台都不提交。
"""

from __future__ import annotations

import inspect
from typing import Any

import pytest

from app.services import background_tasks, mcp_server, workflow_runner

NODES: list[dict[str, Any]] = [
    {"id": "research", "agent": "analyze", "arguments": {"topic": "x"}},
    {"id": "write", "agent": "compose", "arguments": {}, "depends_on": ["research"]},
]

IDENTITY = {"__session_id": "s1", "__user_id": "u1", "__user_role": 0}


class SubmitSpy:
    def __init__(self, result: str | dict[str, Any] = "task-42") -> None:
        self.result = result
        self.calls: list[dict[str, Any]] = []

    async def __call__(self, coro_factory, **kwargs):  # noqa: ANN001, ANN003
        self.calls.append({"factory": coro_factory, **kwargs})
        return self.result


@pytest.fixture
def submitted(monkeypatch: pytest.MonkeyPatch) -> SubmitSpy:
    spy = SubmitSpy()
    monkeypatch.setattr(background_tasks.background_task_manager, "submit", spy)
    return spy


@pytest.fixture
def executed(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    seen: list[dict[str, Any]] = []

    async def fake_run(nodes, *, principal, user_role=None, resume_from_run_id=None):  # noqa: ANN001
        seen.append(
            {
                "nodes": nodes,
                "principal": principal,
                "user_role": user_role,
                "resume_from_run_id": resume_from_run_id,
            }
        )
        return {
            "ok": True,
            "run_id": "run-1",
            "status": "completed",
            "executed": ["research"],
            "cached": [],
            "skipped": {},
            "failed": {},
            "results": {"research": {"ok": True}},
        }

    monkeypatch.setattr(workflow_runner, "run_workflow", fake_run)
    return seen


async def test_background_returns_task_id_without_executing(
    submitted: SubmitSpy, executed: list[dict[str, Any]]
) -> None:
    result = await mcp_server._tool_run_workflow(
        {"nodes": NODES, **IDENTITY, "run_in_background": True}
    )
    assert result["ok"] is True
    assert result["background"] is True
    assert result["task_id"] == "task-42"
    assert result["status"] == "pending"
    assert result["run_id"] is None
    assert result["executed"] == []
    assert executed == []  # 同步路径一次都没跑
    assert len(submitted.calls) == 1
    call = submitted.calls[0]
    assert call["user_id"] == "u1"
    assert call["session_id"] == "s1"
    assert call["notify_on_done"] is False
    assert call["timeout_s"] == 1800.0
    assert "2 节点" in call["name"]

    # 后台真正执行时,带的是同一份主体/角色/续跑参数
    body = call["factory"]()
    assert inspect.iscoroutine(body)
    await body
    assert executed[0]["principal"] == "u1"
    assert executed[0]["user_role"] == 0
    assert executed[0]["resume_from_run_id"] is None
    assert [n["id"] for n in executed[0]["nodes"]] == ["research", "write"]


async def test_background_rejection_is_explicit(
    monkeypatch: pytest.MonkeyPatch, executed: list[dict[str, Any]]
) -> None:
    spy = SubmitSpy({"error": "too_many_background_tasks", "active": 8, "max": 8})
    monkeypatch.setattr(background_tasks.background_task_manager, "submit", spy)
    result = await mcp_server._tool_run_workflow(
        {"nodes": NODES, **IDENTITY, "run_in_background": True}
    )
    assert result["ok"] is False
    assert result["errorCode"] == "BACKGROUND_REJECTED"
    assert result["detail"]["max"] == 8
    assert executed == []


async def test_foreground_keeps_sync_contract(
    submitted: SubmitSpy, executed: list[dict[str, Any]]
) -> None:
    result = await mcp_server._tool_run_workflow({"nodes": NODES, **IDENTITY})
    assert result["ok"] is True
    assert result["run_id"] == "run-1"
    assert submitted.calls == []
    assert executed[0]["principal"] == "u1"


async def test_background_flag_parsing_and_timeout_clamp(
    submitted: SubmitSpy, executed: list[dict[str, Any]]
) -> None:
    await mcp_server._tool_run_workflow(
        {
            "nodes": NODES,
            **IDENTITY,
            "run_in_background": "true",
            "timeout_s": 99999,
            "notify_on_done": "yes",
        }
    )
    call = submitted.calls[0]
    assert call["timeout_s"] == 3600.0
    assert call["notify_on_done"] is True
    assert executed == []


async def test_missing_identity_never_reaches_background(
    submitted: SubmitSpy, executed: list[dict[str, Any]]
) -> None:
    result = await mcp_server._tool_run_workflow(
        {"nodes": NODES, "__session_id": "s1", "run_in_background": True}
    )
    assert result["ok"] is False
    assert result["errorCode"] == "PRINCIPAL_REQUIRED"
    assert submitted.calls == []
    assert executed == []
