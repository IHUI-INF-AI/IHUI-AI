"""dag.py 单元测试 — DAG 执行 + Worker Pool 任务管理 API。

测试覆盖:
- 数据模型:KanbanTaskCreate / DAGNodeSpec / DAGExecuteRequest(camelCase alias)
- DAG 执行端点:POST /dag/execute(成功 / 失败 500)
- DAG 查询端点:GET /dag/execute/{id}(命中 / 404)
- 任务管理端点:POST /dag/tasks / GET /dag/tasks/{id} / GET /dag/tasks / GET /dag/workers
- 隔离:mock DAGScheduler / WorkerPool 单例,不依赖真实 asyncio 池
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api import dag as dag_module
from app.api.dag import (
    DAGExecuteRequest,
    DAGNodeSpec,
    KanbanTaskCreate,
)
from app.services.dag_scheduler import (
    DAGNode,
    DAGResult,
    KanbanTask,
    NodeResult,
)


# =============================================================================
# 辅助
# =============================================================================


def _make_app():
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(dag_module.router, prefix="/api")
    return app


@pytest.fixture(autouse=True)
def _reset_globals():
    """每个测试前后清空全局 _pool + _executions。"""
    dag_module._pool = None
    dag_module._executions.clear()
    yield
    dag_module._pool = None
    dag_module._executions.clear()


# =============================================================================
# 数据模型
# =============================================================================


def test_kanban_task_create_camel_case_alias():
    """KanbanTaskCreate 接受 camelCase alias(agentId/scheduledAt/createdBy)。"""
    task = KanbanTaskCreate(
        agentId="agent-1",
        name="do something",
        description="desc",
        priority=5,
        payload={"k": "v"},
        scheduledAt="2026-07-23T00:00:00Z",
        dependencies=["dep1"],
        createdBy="user-1",
    )
    assert task.agent_id == "agent-1"
    assert task.scheduled_at == "2026-07-23T00:00:00Z"
    assert task.created_by == "user-1"
    assert task.priority == 5
    assert task.dependencies == ["dep1"]


def test_kanban_task_create_required_fields():
    """KanbanTaskCreate:agentId + name 必填。"""
    with pytest.raises(ValueError):
        KanbanTaskCreate(name="x")  # 缺 agentId
    with pytest.raises(ValueError):
        KanbanTaskCreate(agentId="a")  # 缺 name


def test_kanban_task_create_defaults():
    """KanbanTaskCreate 默认 priority=0, payload={}, dependencies=[]。"""
    t = KanbanTaskCreate(agentId="a", name="n")
    assert t.priority == 0
    assert t.payload == {}
    assert t.dependencies == []
    assert t.id is None


def test_dag_node_spec_camel_case_alias():
    """DAGNodeSpec 接受 maxRetries alias。"""
    spec = DAGNodeSpec(
        id="n1",
        name="node1",
        dependencies=["n0"],
        maxRetries=5,
        timeout=60.0,
    )
    assert spec.max_retries == 5
    assert spec.timeout == 60.0
    assert spec.dependencies == ["n0"]


def test_dag_node_spec_defaults():
    """DAGNodeSpec 默认 max_retries=3, timeout=300, dependencies=[]。"""
    spec = DAGNodeSpec(id="n1", name="node1")
    assert spec.max_retries == 3
    assert spec.timeout == 300.0
    assert spec.dependencies == []


def test_dag_execute_request_camel_case_alias():
    """DAGExecuteRequest 接受 initialContext alias。"""
    req = DAGExecuteRequest(
        nodes=[DAGNodeSpec(id="n1", name="n1")],
        edges=[{"from": "a", "to": "b"}],
        initialContext={"k": "v"},
    )
    assert req.initial_context == {"k": "v"}
    assert req.edges == [{"from": "a", "to": "b"}]


def test_dag_execute_request_defaults():
    """DAGExecuteRequest 默认 edges=[], initial_context={}。"""
    req = DAGExecuteRequest(nodes=[DAGNodeSpec(id="n", name="n")])
    assert req.edges == []
    assert req.initial_context == {}


# =============================================================================
# KanbanTask.to_camel_dict
# =============================================================================


def test_kanban_task_to_camel_dict_keys():
    """KanbanTask.to_camel_dict 字段名转 camelCase。"""
    t = KanbanTask(
        id="t1",
        agent_id="a1",
        name="task name",
        description="desc",
        priority=2,
        payload={"x": 1},
        dependencies=["d1"],
        created_by="u1",
    )
    d = t.to_camel_dict()
    assert d["id"] == "t1"
    assert d["agentId"] == "a1"
    assert d["name"] == "task name"
    assert d["createdBy"] == "u1"
    assert d["dependencies"] == ["d1"]
    # snake_case 不应出现在结果中
    assert "agent_id" not in d
    assert "created_by" not in d


# =============================================================================
# 端点:POST /dag/execute
# =============================================================================


async def test_execute_dag_success(monkeypatch):
    """POST /api/dag/execute 成功 → code=0 + executionId + status。"""
    fake_scheduler = MagicMock()
    fake_result = MagicMock(spec=DAGResult)
    fake_result.status = "success"
    fake_result.node_results = {}
    fake_result.total_duration_ms = 100.0
    fake_result.trace = []
    fake_scheduler.add_node = MagicMock()
    fake_scheduler.execute = AsyncMock(return_value=fake_result)
    fake_scheduler.nodes = {}

    monkeypatch.setattr(dag_module, "DAGScheduler", lambda: fake_scheduler)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/dag/execute",
            json={
                "nodes": [{"id": "n1", "name": "node1"}],
                "initialContext": {"k": "v"},
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert "executionId" in data["data"]
    assert data["data"]["status"] == "success"
    # 执行结果应被缓存到 _executions
    assert len(dag_module._executions) == 1


async def test_execute_dag_failure_returns_500(monkeypatch):
    """DAGScheduler.execute 抛异常 → code=500。"""
    fake_scheduler = MagicMock()
    fake_scheduler.add_node = MagicMock()
    fake_scheduler.execute = AsyncMock(side_effect=RuntimeError("dag boom"))
    monkeypatch.setattr(dag_module, "DAGScheduler", lambda: fake_scheduler)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/dag/execute",
            json={"nodes": [{"id": "n1", "name": "node1"}]},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 500
    assert "DAG 执行失败" in data["message"]
    assert data["data"] is None


# =============================================================================
# 端点:GET /dag/execute/{execution_id}
# =============================================================================


async def test_get_execution_found():
    """GET /api/dag/execute/{id}:命中缓存 → 返回数据。"""
    dag_module._executions["exec-1"] = {"executionId": "exec-1", "status": "success"}
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dag/execute/exec-1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert data["data"]["executionId"] == "exec-1"


async def test_get_execution_404():
    """GET /api/dag/execute/{id}:不存在 → 404。"""
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dag/execute/nonexistent")
    assert resp.status_code == 404


# =============================================================================
# 端点:POST /dag/tasks
# =============================================================================


async def test_submit_task_success(monkeypatch):
    """POST /api/dag/tasks:提交任务 → code=0 + taskId。"""
    fake_pool = MagicMock()
    fake_pool.start = AsyncMock()
    fake_pool.submit = AsyncMock(return_value="task-123")
    monkeypatch.setattr(dag_module, "_ensure_pool_started", AsyncMock(return_value=fake_pool))

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/dag/tasks",
            json={
                "agentId": "a1",
                "name": "task1",
                "payload": {"k": "v"},
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert data["data"]["taskId"] == "task-123"
    assert data["data"]["task"]["agentId"] == "a1"
    fake_pool.submit.assert_awaited_once()


async def test_submit_task_runtime_error_returns_500(monkeypatch):
    """POST /api/dag/tasks:pool.submit 抛 RuntimeError → code=500。"""
    fake_pool = MagicMock()
    fake_pool.start = AsyncMock()
    fake_pool.submit = AsyncMock(side_effect=RuntimeError("pool full"))
    monkeypatch.setattr(dag_module, "_ensure_pool_started", AsyncMock(return_value=fake_pool))

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/dag/tasks",
            json={"agentId": "a1", "name": "t1"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 500
    assert data["message"] == "pool full"


async def test_submit_task_with_explicit_id(monkeypatch):
    """POST /api/dag/tasks:传 id 时复用,不传则生成 UUID。"""
    fake_pool = MagicMock()
    fake_pool.start = AsyncMock()
    fake_pool.submit = AsyncMock(return_value="explicit-id")
    monkeypatch.setattr(dag_module, "_ensure_pool_started", AsyncMock(return_value=fake_pool))

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/dag/tasks",
            json={"id": "explicit-id", "agentId": "a", "name": "n"},
        )

    data = resp.json()
    assert data["data"]["taskId"] == "explicit-id"
    # pool.submit 收到的 task.id 应是 explicit-id
    submitted_task = fake_pool.submit.call_args.args[0]
    assert submitted_task.id == "explicit-id"


# =============================================================================
# 端点:GET /dag/tasks/{task_id}
# =============================================================================


async def test_get_task_found(monkeypatch):
    """GET /api/dag/tasks/{id}:命中 → 返回 task camelCase 字典。"""
    task = KanbanTask(id="t1", agent_id="a1", name="task1")
    fake_pool = MagicMock()
    fake_pool.get_status = AsyncMock(return_value=task)
    monkeypatch.setattr(dag_module, "_get_pool", lambda: fake_pool)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dag/tasks/t1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert data["data"]["id"] == "t1"
    assert data["data"]["agentId"] == "a1"


async def test_get_task_404(monkeypatch):
    """GET /api/dag/tasks/{id}:pool.get_status 返回 None → 404。"""
    fake_pool = MagicMock()
    fake_pool.get_status = AsyncMock(return_value=None)
    monkeypatch.setattr(dag_module, "_get_pool", lambda: fake_pool)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dag/tasks/missing")
    assert resp.status_code == 404


# =============================================================================
# 端点:GET /dag/tasks(列表)
# =============================================================================


async def test_list_tasks_no_filter(monkeypatch):
    """GET /api/dag/tasks:无 status 参数 → 返回全部。"""
    tasks = [
        KanbanTask(id="t1", agent_id="a", name="n1"),
        KanbanTask(id="t2", agent_id="a", name="n2"),
    ]
    fake_pool = MagicMock()
    fake_pool.list_tasks = MagicMock(return_value=tasks)
    monkeypatch.setattr(dag_module, "_get_pool", lambda: fake_pool)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dag/tasks")
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert data["total"] == 2
    assert len(data["data"]) == 2


async def test_list_tasks_with_status_filter(monkeypatch):
    """GET /api/dag/tasks?status=done → 把 status 透传给 pool.list_tasks。"""
    fake_pool = MagicMock()
    fake_pool.list_tasks = MagicMock(return_value=[])
    monkeypatch.setattr(dag_module, "_get_pool", lambda: fake_pool)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dag/tasks", params={"status": "done"})
    assert resp.status_code == 200
    fake_pool.list_tasks.assert_called_once_with(status="done")


# =============================================================================
# 端点:GET /dag/workers
# =============================================================================


async def test_list_workers(monkeypatch):
    """GET /api/dag/workers:返回 worker 状态列表。"""
    worker = MagicMock()
    worker.to_camel_dict = MagicMock(
        return_value={"workerId": "w1", "status": "idle", "type": "ai-service-worker"}
    )
    fake_pool = MagicMock()
    fake_pool.get_workers_state = MagicMock(return_value=[worker])
    monkeypatch.setattr(dag_module, "_get_pool", lambda: fake_pool)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dag/workers")
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert len(data["data"]) == 1
    assert data["data"][0]["workerId"] == "w1"


# =============================================================================
# _get_pool 单例
# =============================================================================


def test_get_pool_creates_singleton():
    """_get_pool:首次调用惰性创建 WorkerPool 实例。"""
    dag_module._pool = None
    pool1 = dag_module._get_pool()
    pool2 = dag_module._get_pool()
    assert pool1 is pool2


def test_get_pool_recreates_after_shutdown():
    """_get_pool:_shutdown=True 时重建实例。"""
    pool1 = dag_module._get_pool()
    pool1._shutdown = True
    pool2 = dag_module._get_pool()
    assert pool1 is not pool2


# =============================================================================
# _default_node_executor
# =============================================================================


async def test_default_node_executor_echoes_context_keys():
    """_default_node_executor:回显 context 的 keys。"""
    result = await dag_module._default_node_executor({"a": 1, "b": 2})
    assert result == {"executed": True, "contextKeys": ["a", "b"]}


async def test_default_node_executor_empty_context():
    """_default_node_executor:空 context → contextKeys=[]。"""
    result = await dag_module._default_node_executor({})
    assert result == {"executed": True, "contextKeys": []}
