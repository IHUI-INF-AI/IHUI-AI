"""a2a.py 路由单元测试。

A2A(Agent-to-Agent)协议 HTTP 入口,5 端点:
- POST /a2a/agents/register:注册 agent
- GET /a2a/agents:列出所有 agent
- POST /a2a/tasks:发送任务
- GET /a2a/tasks/{task_id}/status:查询任务状态
- GET /a2a/tasks/{task_id}/result:获取任务结果

测试覆盖:
- 路由实例化:router 是 APIRouter
- 请求模型:RegisterAgentRequest / SendTaskRequest 字段验证
- 端点调用:patch a2a_server 单例后验证调用 + 返回结构
- 404 路径:get_task_status / get_task_result 不存在时抛 HTTPException(404)
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.routers.a2a import (
    RegisterAgentRequest,
    SendTaskRequest,
    get_task_result,
    get_task_status,
    list_agents,
    register_agent,
    router,
    send_task,
)
from app.services.a2a_service import A2AAgent, A2ATask


# =============================================================================
# 路由实例化
# =============================================================================


def test_router_is_api_router():
    """router 是 FastAPI APIRouter 实例。"""
    from fastapi import APIRouter
    assert isinstance(router, APIRouter)


def test_router_has_five_routes():
    """router 应至少注册 5 个路由。"""
    paths = {r.path for r in router.routes}
    expected = {
        "/a2a/agents/register",
        "/a2a/agents",
        "/a2a/tasks",
        "/a2a/tasks/{task_id}/status",
        "/a2a/tasks/{task_id}/result",
    }
    assert expected.issubset(paths)


# =============================================================================
# RegisterAgentRequest 模型
# =============================================================================


def test_register_agent_request_required_fields():
    """RegisterAgentRequest 必填 id + name。"""
    req = RegisterAgentRequest(id="a1", name="Agent1")
    assert req.id == "a1"
    assert req.name == "Agent1"
    assert req.description == ""
    assert req.capabilities == []
    assert req.endpoint == ""


def test_register_agent_request_all_fields():
    """RegisterAgentRequest 全字段。"""
    req = RegisterAgentRequest(
        id="a1",
        name="Agent1",
        description="test agent",
        capabilities=["search", "code"],
        endpoint="http://localhost:8001",
    )
    assert req.capabilities == ["search", "code"]
    assert req.endpoint == "http://localhost:8001"


def test_register_agent_request_missing_id_raises():
    """缺 id 时 Pydantic 校验失败。"""
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        RegisterAgentRequest(name="x")


def test_register_agent_request_missing_name_raises():
    """缺 name 时 Pydantic 校验失败。"""
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        RegisterAgentRequest(id="x")


# =============================================================================
# SendTaskRequest 模型
# =============================================================================


def test_send_task_request_required_fields():
    """SendTaskRequest 必填 name。"""
    req = SendTaskRequest(name="task1")
    assert req.name == "task1"
    assert req.description == ""
    assert req.input == {}
    assert req.assigned_agent_id == ""


def test_send_task_request_all_fields():
    """SendTaskRequest 全字段。"""
    req = SendTaskRequest(
        name="task1",
        description="do something",
        input={"goal": "x"},
        assigned_agent_id="agent-1",
    )
    assert req.input == {"goal": "x"}
    assert req.assigned_agent_id == "agent-1"


def test_send_task_request_missing_name_raises():
    """缺 name 时 Pydantic 校验失败。"""
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        SendTaskRequest()


# =============================================================================
# register_agent 端点
# =============================================================================


async def test_register_agent_returns_saved_agent_dict():
    """register_agent 返回 saved agent 的 to_dict。"""
    fake_agent = A2AAgent(
        agent_id="a1", name="Agent1",
        capabilities=["x"], endpoint="http://x", description="d",
    )

    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.register_agent = MagicMock(return_value=fake_agent)
        result = await register_agent(RegisterAgentRequest(
            id="a1", name="Agent1", capabilities=["x"], endpoint="http://x", description="d",
        ))

    assert result["id"] == "a1"
    assert result["name"] == "Agent1"
    assert result["capabilities"] == ["x"]
    mock_server.register_agent.assert_called_once()
    # 验证传入的是 A2AAgent 实例
    args, _ = mock_server.register_agent.call_args
    assert isinstance(args[0], A2AAgent)
    assert args[0].id == "a1"


async def test_register_agent_passes_all_fields():
    """register_agent 把所有字段传给 a2a_server.register_agent。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.register_agent = MagicMock(return_value=MagicMock(to_dict=lambda: {"id": "x"}))
        await register_agent(RegisterAgentRequest(
            id="agent-x", name="X", description="desc",
            capabilities=["a", "b"], endpoint="http://y",
        ))

    args, _ = mock_server.register_agent.call_args
    passed_agent = args[0]
    assert passed_agent.id == "agent-x"
    assert passed_agent.name == "X"
    assert passed_agent.description == "desc"
    assert passed_agent.capabilities == ["a", "b"]
    assert passed_agent.endpoint == "http://y"


# =============================================================================
# list_agents 端点
# =============================================================================


async def test_list_agents_returns_agents_and_count():
    """list_agents 返回 {agents: [...], count: N}。"""
    agents = [
        A2AAgent(agent_id="a1", name="A1"),
        A2AAgent(agent_id="a2", name="A2"),
    ]
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.list_agents = MagicMock(return_value=agents)
        result = await list_agents()

    assert len(result["agents"]) == 2
    assert result["count"] == 2
    assert result["agents"][0]["id"] == "a1"


async def test_list_agents_empty_returns_zero_count():
    """无 agent 时 count=0。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.list_agents = MagicMock(return_value=[])
        result = await list_agents()

    assert result["agents"] == []
    assert result["count"] == 0


# =============================================================================
# send_task 端点
# =============================================================================


async def test_send_task_returns_task_dict():
    """send_task 返回 task.to_dict。"""
    fake_task = A2ATask(task_id="task-1", name="t1", agent_id="a1", input_data={"goal": "x"})

    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.send_task = MagicMock(return_value=fake_task)
        result = await send_task(SendTaskRequest(
            name="t1", input={"goal": "x"}, assigned_agent_id="a1",
        ))

    assert result["id"] == "task-1"
    assert result["name"] == "t1"
    assert result["agent_id"] == "a1"
    assert result["input"] == {"goal": "x"}


async def test_send_task_passes_correct_args():
    """send_task 把 name/agent_id/input 传给 a2a_server.send_task。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.send_task = MagicMock(return_value=MagicMock(to_dict=lambda: {"id": "x"}))
        await send_task(SendTaskRequest(
            name="task-x", input={"k": "v"}, assigned_agent_id="agent-1",
        ))

    args, kwargs = mock_server.send_task.call_args
    # send_task 用关键字参数
    assert kwargs["name"] == "task-x"
    assert kwargs["agent_id"] == "agent-1"
    assert kwargs["input_data"] == {"k": "v"}


async def test_send_task_empty_input_uses_default():
    """input 缺省时传空 dict。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.send_task = MagicMock(return_value=MagicMock(to_dict=lambda: {"id": "x"}))
        await send_task(SendTaskRequest(name="t"))

    _, kwargs = mock_server.send_task.call_args
    assert kwargs["input_data"] == {}


# =============================================================================
# get_task_status 端点
# =============================================================================


async def test_get_task_status_returns_status_dict():
    """get_task_status 返回 {task_id, **status}。"""
    status_dict = {
        "id": "task-1",
        "status": "completed",
        "agent_id": "a1",
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:01:00+00:00",
    }
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.get_task_status = AsyncMock(return_value=status_dict)
        result = await get_task_status("task-1")

    assert result["task_id"] == "task-1"
    assert result["status"] == "completed"
    assert result["agent_id"] == "a1"


async def test_get_task_status_not_found_raises_404():
    """任务不存在时抛 HTTPException 404。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.get_task_status = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc_info:
            await get_task_status("nonexistent")

    assert exc_info.value.status_code == 404
    assert "nonexistent" in exc_info.value.detail


# =============================================================================
# get_task_result 端点
# =============================================================================


async def test_get_task_result_returns_result_dict():
    """get_task_result 返回 {task_id, **result}。"""
    result_dict = {
        "id": "task-1",
        "status": "completed",
        "result": {"output": "done"},
        "error": None,
    }
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.get_task_result = AsyncMock(return_value=result_dict)
        result = await get_task_result("task-1")

    assert result["task_id"] == "task-1"
    assert result["result"] == {"output": "done"}
    assert result["error"] is None


async def test_get_task_result_not_found_raises_404():
    """任务不存在时抛 HTTPException 404。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.get_task_result = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc_info:
            await get_task_result("nonexistent")

    assert exc_info.value.status_code == 404
    assert "nonexistent" in exc_info.value.detail


# =============================================================================
# 端点集成(通过 a2a_server 真实单例 + 内存模式)
# =============================================================================


async def test_register_then_list_agents_integration():
    """端到端:register_agent 后 list_agents 能看到。"""
    # 不 patch 单例,使用真实 a2a_server(纯内存模式)
    from app.routers.a2a import a2a_server

    # 清空状态(避免其他测试残留)
    a2a_server._agents.clear()

    try:
        await register_agent(RegisterAgentRequest(
            id="integration-a1", name="IntegrationA1",
            capabilities=["test"], endpoint="http://x",
        ))
        result = await list_agents()
        ids = [a["id"] for a in result["agents"]]
        assert "integration-a1" in ids
    finally:
        a2a_server._agents.clear()


async def test_send_task_then_get_status_integration():
    """端到端:send_task 后 get_task_status 能查到任务。"""
    from app.routers.a2a import a2a_server

    a2a_server._agents.clear()
    a2a_server._tasks.clear()

    try:
        # 注册一个 agent 让 send_task 顺利执行
        await register_agent(RegisterAgentRequest(id="it-a", name="ItA"))

        result = await send_task(SendTaskRequest(
            name="it-task", input={"goal": "test"}, assigned_agent_id="it-a",
        ))
        task_id = result["id"]

        status = await get_task_status(task_id)
        assert status["task_id"] == task_id
        assert status["status"] in ("pending", "running", "completed", "failed")
    finally:
        a2a_server._agents.clear()
        a2a_server._tasks.clear()
