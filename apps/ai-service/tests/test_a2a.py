# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
- O11 收权:Principal 归属(建单写 principal.sub)+ 越权 403 + scope 门禁
  + 既有响应形状逐字段冻结(向后兼容回归)

Redis 隔离:本文件所有用例都在纯内存模式下跑(monkeypatch _get_redis → None),
不触碰真实 Redis(测试隔离铁律:禁连生产 8811)。
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal
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
from app.services.a2a_service import ADMIN_ROLE, A2AAgent, A2AServer, A2ATask
from app.services.capability_gate import ALL_SCOPES, Principal

PrincipalKind = Literal["jwt", "internal", "dev-anonymous"]
_FULL_SCOPES: frozenset[str] = frozenset({ALL_SCOPES})


def _principal(
    sub: str | None = "user-1",
    *,
    role: int = 0,
    kind: PrincipalKind = "jwt",
    scopes: frozenset[str] = _FULL_SCOPES,
) -> Principal:
    """构造调用主体(默认 = 已认证普通用户,全量 scope)。"""
    return Principal(kind=kind, sub=sub, role=role, scopes=scopes)


def _task(task_id: str = "task-1", *, owner: str | None = "user-1", **overrides: Any) -> A2ATask:
    """构造一个任务对象(默认归属 user-1)。"""
    task = A2ATask(task_id=task_id, name="t", agent_id="a1", owner_id=owner)
    for key, value in overrides.items():
        setattr(task, key, value)
    return task


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
        result = await send_task(
            SendTaskRequest(name="t1", input={"goal": "x"}, assigned_agent_id="a1"),
            _principal(),
        )

    assert result["id"] == "task-1"
    assert result["name"] == "t1"
    assert result["agent_id"] == "a1"
    assert result["input"] == {"goal": "x"}


async def test_send_task_response_shape_is_frozen():
    """O11 向后兼容:建单响应键集合与收权前**逐字段一致**(归属不得外泄)。"""
    fake_task = A2ATask(task_id="task-1", name="t1", agent_id="a1", owner_id="user-1")

    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.send_task = MagicMock(return_value=fake_task)
        result = await send_task(SendTaskRequest(name="t1"), _principal("user-1"))

    assert set(result) == {
        "id",
        "name",
        "agent_id",
        "input",
        "status",
        "result",
        "error",
        "created_at",
        "updated_at",
    }
    assert "owner_id" not in result


async def test_send_task_passes_correct_args():
    """send_task 把 name/agent_id/input 传给 a2a_server.send_task。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.send_task = MagicMock(return_value=MagicMock(to_dict=lambda: {"id": "x"}))
        await send_task(
            SendTaskRequest(name="task-x", input={"k": "v"}, assigned_agent_id="agent-1"),
            _principal("user-9"),
        )

    args, kwargs = mock_server.send_task.call_args
    # send_task 用关键字参数
    assert kwargs["name"] == "task-x"
    assert kwargs["agent_id"] == "agent-1"
    assert kwargs["input_data"] == {"k": "v"}


async def test_send_task_attributes_caller_from_principal():
    """O11 收权:任务归属写为 `principal.sub`(不再是匿名/无主)。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.send_task = MagicMock(return_value=MagicMock(to_dict=lambda: {"id": "x"}))
        await send_task(SendTaskRequest(name="t"), _principal("user-42"))

    _, kwargs = mock_server.send_task.call_args
    assert kwargs["owner_id"] == "user-42"


async def test_send_task_dev_anonymous_principal_has_no_owner():
    """本机开发回退主体(sub=None)建单 → 归属为空(与 can_access_task 口径配套)。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.send_task = MagicMock(return_value=MagicMock(to_dict=lambda: {"id": "x"}))
        await send_task(SendTaskRequest(name="t"), _principal(None, kind="dev-anonymous"))

    _, kwargs = mock_server.send_task.call_args
    assert kwargs["owner_id"] is None


async def test_send_task_denied_without_call_scope():
    """缺 `agents:call` scope → 403(能力闸 enforce_scope)。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.send_task = MagicMock(return_value=MagicMock(to_dict=lambda: {"id": "x"}))
        with pytest.raises(HTTPException) as exc_info:
            await send_task(
                SendTaskRequest(name="t"),
                _principal("user-1", scopes=frozenset({"files:read"})),
            )

    assert exc_info.value.status_code == 403
    mock_server.send_task.assert_not_called()


async def test_send_task_empty_input_uses_default():
    """input 缺省时传空 dict。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.send_task = MagicMock(return_value=MagicMock(to_dict=lambda: {"id": "x"}))
        await send_task(SendTaskRequest(name="t"), _principal())

    _, kwargs = mock_server.send_task.call_args
    assert kwargs["input_data"] == {}


# =============================================================================
# get_task_status 端点
# =============================================================================


async def test_get_task_status_returns_status_dict():
    """get_task_status 返回 {task_id, **status}。"""
    task = _task("task-1", owner="user-1")
    task.status = "completed"
    task.updated_at = datetime(2026, 1, 1, tzinfo=UTC)
    task.created_at = datetime(2026, 1, 1, tzinfo=UTC)
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.get_task = AsyncMock(return_value=task)
        result = await get_task_status("task-1", _principal("user-1"))

    assert result["task_id"] == "task-1"
    assert result["status"] == "completed"
    assert result["agent_id"] == "a1"
    assert set(result) == {"task_id", "id", "status", "agent_id", "created_at", "updated_at"}


async def test_get_task_status_not_found_raises_404():
    """任务不存在时抛 HTTPException 404。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.get_task = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc_info:
            await get_task_status("nonexistent", _principal())

    assert exc_info.value.status_code == 404
    assert "nonexistent" in exc_info.value.detail


async def test_get_task_status_other_owner_raises_403():
    """O11 收权:读取他人任务 → 403。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.get_task = AsyncMock(return_value=_task("task-x", owner="user-1"))
        with pytest.raises(HTTPException) as exc_info:
            await get_task_status("task-x", _principal("user-2"))

    assert exc_info.value.status_code == 403


async def test_get_task_status_admin_can_read_any_owner():
    """管理员(role>=1)跨归属可读(运维排障口径)。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.get_task = AsyncMock(return_value=_task("task-x", owner="user-1"))
        result = await get_task_status("task-x", _principal("admin-1", role=ADMIN_ROLE))

    assert result["task_id"] == "task-x"


async def test_get_task_status_denied_without_read_scope():
    """缺 `agents:read` scope → 403,且不查任务。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.get_task = AsyncMock(return_value=_task())
        with pytest.raises(HTTPException) as exc_info:
            await get_task_status("task-1", _principal("user-1", scopes=frozenset({"chat:read"})))

    assert exc_info.value.status_code == 403
    mock_server.get_task.assert_not_called()



# =============================================================================
# get_task_result 端点
# =============================================================================


async def test_get_task_result_returns_result_dict():
    """get_task_result 返回 {task_id, **result}。"""
    task = _task("task-1", owner="user-1", status="completed", result={"output": "done"}, error=None)
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.get_task = AsyncMock(return_value=task)
        result = await get_task_result("task-1", _principal("user-1"))

    assert result["task_id"] == "task-1"
    assert result["result"] == {"output": "done"}
    assert result["error"] is None
    assert set(result) == {"task_id", "id", "status", "result", "error"}


async def test_get_task_result_not_found_raises_404():
    """任务不存在时抛 HTTPException 404。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.get_task = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc_info:
            await get_task_result("nonexistent", _principal())

    assert exc_info.value.status_code == 404
    assert "nonexistent" in exc_info.value.detail


async def test_get_task_result_other_owner_raises_403():
    """O11 收权:读取他人任务结果 → 403。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.get_task = AsyncMock(return_value=_task("task-x", owner="user-1"))
        with pytest.raises(HTTPException) as exc_info:
            await get_task_result("task-x", _principal("user-2"))

    assert exc_info.value.status_code == 403


async def test_get_task_result_legacy_unowned_task_rejects_identified_caller():
    """收权前写入的无主任务:带身份的调用方一律 403(fail-closed,不做"无主即可读")。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.get_task = AsyncMock(return_value=_task("task-old", owner=None))
        with pytest.raises(HTTPException) as exc_info:
            await get_task_result("task-old", _principal("user-1"))

    assert exc_info.value.status_code == 403


async def test_get_task_result_dev_anonymous_can_read_unowned():
    """本机开发回退主体(sub=None)可读无主任务(本地开发零摩擦)。"""
    with patch("app.routers.a2a.a2a_server") as mock_server:
        mock_server.get_task = AsyncMock(return_value=_task("task-dev", owner=None))
        result = await get_task_result(
            "task-dev", _principal(None, kind="dev-anonymous")
        )

    assert result["task_id"] == "task-dev"


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
    """端到端:send_task 后 get_task_status 能查到任务(同一归属主体)。"""
    from app.routers.a2a import a2a_server

    a2a_server._agents.clear()
    a2a_server._tasks.clear()
    # 隔离:不连真实 Redis(测试隔离铁律)、不跑 agent_executor(避免 LLM 外呼)
    with (
        patch.object(A2AServer, "_get_redis", new=AsyncMock(return_value=None)),
        patch.object(A2AServer, "_execute_task", new=AsyncMock(return_value=None)),
    ):
        try:
            # 注册一个 agent 让 send_task 顺利执行
            await register_agent(RegisterAgentRequest(id="it-a", name="ItA"))

            result = await send_task(
                SendTaskRequest(name="it-task", input={"goal": "test"}, assigned_agent_id="it-a"),
                _principal("it-user"),
            )
            task_id = result["id"]

            status = await get_task_status(task_id, _principal("it-user"))
            assert status["task_id"] == task_id
            assert status["status"] in ("pending", "running", "completed", "failed")

            # 同一任务,别的用户读不到
            with pytest.raises(HTTPException) as exc_info:
                await get_task_status(task_id, _principal("other-user"))
            assert exc_info.value.status_code == 403
        finally:
            a2a_server._agents.clear()
            a2a_server._tasks.clear()

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
