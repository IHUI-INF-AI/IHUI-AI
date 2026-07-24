"""automation_executor.execute_automation_task 测试(2026-07-24 立,对标 Trae Work Automations + Codex)。

覆盖:
- 3 步全成功 → trace len 3,on_success callback
- 步骤失败 + retry 成功 → retry_attempt 记录,ok=True
- 步骤失败 + retry 用尽 + abort → STEP_FAILED
- 步骤失败 + fallback → fallback_steps 执行,ok=True
- fallback 失败 → FALLBACK_FAILED
- 配置无效 → INVALID_CONFIG
- stub 模式 → stub=True,mock trace
- on_success save_artifact → success.artifact_id
- on_success next_workflow
- unknown tool → TOOL_NOT_FOUND
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

from app.core.llm_gateway import llm_gateway
from app.services import mcp_server
from app.services.automation_executor import execute_automation_task


def _ok(args=None):
    """构造一个成功的 async tool handler。"""
    return AsyncMock(return_value={"ok": True, "data": "done"})


def _fail(args=None):
    """构造一个失败的 async tool handler。"""
    return AsyncMock(return_value={"ok": False, "errorCode": "STEP_FAILED", "message": "boom"})


def _patch_handlers(monkeypatch, handlers: dict):
    """替换 mcp_server._TOOL_HANDLERS 为指定 handler 字典。"""
    monkeypatch.setattr(mcp_server, "_TOOL_HANDLERS", handlers)


def _disable_stub(monkeypatch):
    """关闭 stub 模式,使 execute_automation_task 真实执行工具。"""
    monkeypatch.setattr(llm_gateway, "_is_stub_mode", lambda: False)


async def test_three_steps_success(monkeypatch):
    """3 步全成功 → ok=True,trace 3 条,on_success callback。"""
    _disable_stub(monkeypatch)
    _patch_handlers(monkeypatch, {"a": _ok(), "b": _ok(), "c": _ok()})
    out = await execute_automation_task({
        "task_id": "t1", "task_type": "workflow",
        "steps": [
            {"tool": "a", "args": {}},
            {"tool": "b", "args": {}},
            {"tool": "c", "args": {}},
        ],
        "on_success": {"action": "callback", "target": "notify_user"},
    })
    assert out["ok"] is True
    assert out["stub"] is False
    assert out["task_id"] == "t1"
    assert len(out["trace"]) == 3
    assert [t["tool"] for t in out["trace"]] == ["a", "b", "c"]
    assert all(t["ok"] for t in out["trace"])
    assert out["success"]["callback_dispatched"] == "notify_user"


async def test_step_retry_then_success(monkeypatch):
    """步骤失败 + retry 成功 → ok=True,trace 含 retry_attempt。"""
    _disable_stub(monkeypatch)
    flaky = AsyncMock(side_effect=[
        {"ok": False, "errorCode": "STEP_FAILED"},  # 第 1 次失败
        {"ok": True, "data": "recovered"},           # 重试成功
    ])
    _patch_handlers(monkeypatch, {"flaky": flaky})
    out = await execute_automation_task({
        "task_id": "t2", "task_type": "browser_automation",
        "steps": [{"tool": "flaky", "args": {}}],
        "on_failure": {"action": "retry", "max_retries": 3},
        "on_success": {"action": "save_artifact", "target": "art-1"},
    })
    assert out["ok"] is True
    assert len(out["trace"]) == 2
    assert out["trace"][0]["ok"] is False
    assert out["trace"][1]["retry_attempt"] == 1
    assert out["trace"][1]["ok"] is True
    assert out["success"]["artifact_id"] == "art-1"


async def test_step_abort_on_failure(monkeypatch):
    """步骤失败 + abort → ok=False,errorCode=STEP_FAILED。"""
    _disable_stub(monkeypatch)
    _patch_handlers(monkeypatch, {"bad": _fail()})
    out = await execute_automation_task({
        "task_id": "t3", "task_type": "computer_automation",
        "steps": [{"tool": "bad", "args": {}}],
        "on_failure": {"action": "abort"},
    })
    assert out["ok"] is False
    assert out["errorCode"] == "STEP_FAILED"
    assert out["failure"]["action"] == "abort"
    assert len(out["trace"]) == 1


async def test_step_fallback_success(monkeypatch):
    """步骤失败 + fallback → 执行 fallback_steps,ok=True。"""
    _disable_stub(monkeypatch)
    _patch_handlers(monkeypatch, {
        "primary": _fail(),
        "fb_a": _ok(),
        "fb_b": _ok(),
    })
    out = await execute_automation_task({
        "task_id": "t4", "task_type": "data_pipeline",
        "steps": [{"tool": "primary", "args": {}}],
        "on_failure": {"action": "fallback", "fallback_steps": [
            {"tool": "fb_a", "args": {}},
            {"tool": "fb_b", "args": {}},
        ]},
    })
    assert out["ok"] is True
    # 1 失败主步 + 2 fallback 步
    assert len(out["trace"]) == 3
    assert out["trace"][1]["fallback"] is True
    assert out["trace"][2]["fallback"] is True


async def test_fallback_failed(monkeypatch):
    """fallback 步骤也失败 → FALLBACK_FAILED。"""
    _disable_stub(monkeypatch)
    _patch_handlers(monkeypatch, {"primary": _fail(), "fb": _fail()})
    out = await execute_automation_task({
        "task_id": "t5", "task_type": "workflow",
        "steps": [{"tool": "primary", "args": {}}],
        "on_failure": {"action": "fallback", "fallback_steps": [{"tool": "fb", "args": {}}]},
    })
    assert out["ok"] is False
    assert out["errorCode"] == "FALLBACK_FAILED"


async def test_invalid_config_missing_steps():
    """缺 steps → INVALID_CONFIG。"""
    out = await execute_automation_task({"task_id": "x", "task_type": "workflow"})
    assert out["ok"] is False
    assert out["errorCode"] == "INVALID_CONFIG"
    assert "steps" in out["message"]


async def test_invalid_config_bad_task_type():
    """非法 task_type → INVALID_CONFIG。"""
    out = await execute_automation_task({
        "task_id": "x", "task_type": "unknown_type",
        "steps": [{"tool": "a", "args": {}}],
    })
    assert out["ok"] is False
    assert out["errorCode"] == "INVALID_CONFIG"


async def test_stub_mode_returns_mock_trace():
    """stub 模式 → stub=True,trace 为 mock(每步 ok=True,不真实调用工具)。"""
    with patch("app.services.automation_executor.llm_gateway") as gw_mock:
        gw_mock._is_stub_mode = lambda: True
        out = await execute_automation_task({
            "task_id": "stub1", "task_type": "workflow",
            "steps": [{"tool": "a", "args": {}}, {"tool": "b", "args": {}}],
        })
    assert out["ok"] is True
    assert out["stub"] is True
    assert len(out["trace"]) == 2
    assert all(t["ok"] for t in out["trace"])
    assert all(t["result"]["mock"] for t in out["trace"])


async def test_on_success_next_workflow(monkeypatch):
    """on_success action=next_workflow → success.next_workflow。"""
    _disable_stub(monkeypatch)
    _patch_handlers(monkeypatch, {"a": _ok()})
    out = await execute_automation_task({
        "task_id": "t6", "task_type": "workflow",
        "steps": [{"tool": "a", "args": {}}],
        "on_success": {"action": "next_workflow", "target": "wf-2"},
    })
    assert out["ok"] is True
    assert out["success"]["next_workflow"] == "wf-2"


async def test_unknown_tool(monkeypatch):
    """未注册工具 → TOOL_NOT_FOUND,abort → STEP_FAILED。"""
    _disable_stub(monkeypatch)
    _patch_handlers(monkeypatch, {})
    out = await execute_automation_task({
        "task_id": "t7", "task_type": "workflow",
        "steps": [{"tool": "ghost", "args": {}}],
        "on_failure": {"action": "abort"},
    })
    assert out["ok"] is False
    assert out["trace"][0]["error_code"] == "TOOL_NOT_FOUND"
