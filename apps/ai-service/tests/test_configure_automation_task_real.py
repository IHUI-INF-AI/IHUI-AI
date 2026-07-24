"""configure_automation_task 真实执行测试(2026-07-24 立,对标 Trae Work Automations + Codex)。

覆盖:
- execute=True + action=schedule → 真实调用 _tool_schedule_task,executed=True
- execute=True + action=dispatch_subagent → 真实调用 _tool_dispatch_subagent
- execute=True + action=webhook → httpx POST 到 webhook_url
- execute=False → executed=False(仅配置)
- 不支持的 action → INVALID_PARAMS
- webhook 缺 webhook_url → MISSING_PARAMS
- config_id 返回 + 缓存到 _AUTOMATION_CONFIGS
- koubo_daily config 路径(httpx POST 到 api config 端点)
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.mcp_server import (
    _tool_configure_automation_task,
    _AUTOMATION_CONFIGS,
)


def _mock_httpx_client(status_code: int = 200, text: str = "ok", json_data=None):
    """构造 httpx.AsyncClient mock: async context manager 返回带 post 的 client。

    post 返回的 response 含 status_code / text / json() 方法。
    """
    if json_data is None:
        json_data = {"code": 0, "data": {"enabled": True}}
    resp = SimpleNamespace(
        status_code=status_code,
        text=text,
        json=lambda: json_data,
    )
    client_mock = AsyncMock()
    client_mock.post = AsyncMock(return_value=resp)
    ctx = AsyncMock()
    ctx.__aenter__ = AsyncMock(return_value=client_mock)
    ctx.__aexit__ = AsyncMock(return_value=None)
    return MagicMock(return_value=ctx)


async def test_execute_schedule_calls_schedule_task():
    """execute=True + action=schedule → 真实调用 _tool_schedule_task,executed=True。"""
    schedule_result = {"tool": "schedule_task", "ok": True, "task_id": "abc", "status": "scheduled"}
    with patch("app.services.mcp_server._tool_schedule_task", new=AsyncMock(return_value=schedule_result)) as sched_mock:
        out = await _tool_configure_automation_task({
            "task_id": "custom_task", "action": "schedule", "execute": True,
            "name": "每日报告", "prompt": "生成日报", "schedule": "once", "run_at": "2026-08-01T09:00:00",
        })
    assert out["ok"] is True
    assert out["executed"] is True
    assert out["configured"] is True  # 非 koubo/wechat 视为配置通过
    assert out["execution_result"] == schedule_result
    assert sched_mock.await_count == 1
    assert out["config_id"]  # 返回 config_id


async def test_execute_dispatch_subagent_calls_dispatch():
    """execute=True + action=dispatch_subagent → 真实调用 _tool_dispatch_subagent。"""
    dispatch_result = {"tool": "dispatch_subagent", "agent": "coder", "ok": True, "status": "completed"}
    with patch("app.services.mcp_server._tool_dispatch_subagent", new=AsyncMock(return_value=dispatch_result)) as disp_mock:
        out = await _tool_configure_automation_task({
            "task_id": "custom_task", "action": "dispatch_subagent", "execute": True,
            "name": "coder", "task": "fix bug",
        })
    assert out["executed"] is True
    assert out["execution_result"] == dispatch_result
    assert disp_mock.await_count == 1


async def test_execute_webhook_posts_to_url():
    """execute=True + action=webhook → httpx POST 到 webhook_url,executed 基于 status_code。"""
    with patch("httpx.AsyncClient", _mock_httpx_client(200, "received")):
        out = await _tool_configure_automation_task({
            "task_id": "custom_task", "action": "webhook", "execute": True,
            "webhook_url": "https://hooks.example.com/incoming",
            "webhook_payload": {"event": "daily_report"},
        })
    assert out["executed"] is True
    assert out["execution_result"]["ok"] is True
    assert out["execution_result"]["status_code"] == 200


async def test_execute_webhook_failure_status():
    """webhook 返回 5xx → executed=False。"""
    with patch("httpx.AsyncClient", _mock_httpx_client(500, "error")):
        out = await _tool_configure_automation_task({
            "task_id": "custom_task", "action": "webhook", "execute": True,
            "webhook_url": "https://hooks.example.com/incoming",
        })
    assert out["executed"] is False
    assert out["execution_result"]["ok"] is False
    assert out["execution_result"]["status_code"] == 500


async def test_execute_webhook_missing_url():
    """action=webhook 但无 webhook_url → MISSING_PARAMS,executed=False。"""
    out = await _tool_configure_automation_task({
        "task_id": "custom_task", "action": "webhook", "execute": True,
    })
    assert out["executed"] is False
    assert out["execution_result"]["errorCode"] == "MISSING_PARAMS"


async def test_unsupported_action():
    """不支持的 action → INVALID_PARAMS,executed=False。"""
    out = await _tool_configure_automation_task({
        "task_id": "custom_task", "action": "unknown_action", "execute": True,
    })
    assert out["executed"] is False
    assert out["execution_result"]["errorCode"] == "INVALID_PARAMS"


async def test_execute_false_only_configures():
    """execute=False → 仅配置不执行,executed=False,execution_result 为空。"""
    with patch("app.services.mcp_server._tool_schedule_task", new=AsyncMock()) as sched_mock:
        out = await _tool_configure_automation_task({
            "task_id": "custom_task", "action": "schedule", "execute": False,
            "name": "x", "prompt": "y", "schedule": "once", "run_at": "2026-08-01T09:00:00",
        })
    assert out["executed"] is False
    assert out["execution_result"] == {}
    assert out["configured"] is True
    assert sched_mock.await_count == 0  # 未执行


async def test_no_action_only_configures():
    """无 action(空)→ 不执行,executed=False(即使 execute=True)。"""
    out = await _tool_configure_automation_task({
        "task_id": "custom_task", "execute": True,
    })
    assert out["executed"] is False
    assert out["action"] == ""


async def test_config_cached_in_automation_configs():
    """配置结果缓存到 _AUTOMATION_CONFIGS,config_id 可查。"""
    with patch("app.services.mcp_server._tool_schedule_task", new=AsyncMock(return_value={"ok": True})):
        out = await _tool_configure_automation_task({
            "task_id": "custom_task", "action": "schedule", "execute": True,
            "name": "x", "prompt": "y", "schedule": "once", "run_at": "2026-08-01T09:00:00",
        })
    cid = out["config_id"]
    assert cid in _AUTOMATION_CONFIGS
    assert _AUTOMATION_CONFIGS[cid]["task_id"] == "custom_task"
    assert _AUTOMATION_CONFIGS[cid]["action"] == "schedule"


async def test_koubo_daily_config_path():
    """koubo_daily task_id → 走 api config 端点(httpx POST),config_ok=True。"""
    with patch("httpx.AsyncClient", _mock_httpx_client(200, '{"code":0,"data":{"enabled":true}}')):
        out = await _tool_configure_automation_task({
            "task_id": "koubo_daily", "execute": False,
            "hour": 10, "minute": 30, "dry_run": False, "enabled": True,
        })
    assert out["configured"] is True
    assert out["task_id"] == "koubo_daily"
    assert out["executed"] is False


async def test_koubo_daily_config_failure():
    """koubo_daily config api 返回 4xx → configured=False,ok=False。"""
    with patch("httpx.AsyncClient", _mock_httpx_client(404, "not found")):
        out = await _tool_configure_automation_task({
            "task_id": "koubo_daily", "execute": False,
        })
    assert out["configured"] is False
    assert out["ok"] is False
