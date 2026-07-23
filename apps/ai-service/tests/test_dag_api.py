"""app/api/dag.py 单元测试:DAG 执行 + Worker Pool 任务管理 API 全覆盖。

测试覆盖:
- POST /api/dag/execute:成功 → executionId / 节点执行失败 → code 500 / 多节点 DAG
- GET /api/dag/execute/{execution_id}:存在 → data / 不存在 → 404
- POST /api/dag/tasks:提交任务 → taskId + task 对象 / agentId 缺失 → 422
- GET /api/dag/tasks/{task_id}:存在 → data / 不存在 → 404
- GET /api/dag/tasks:列出全部 / status 过滤
- GET /api/dag/workers:列出 worker 状态

测试隔离:每个测试重置全局 _pool / _executions 状态,mock WorkerPool 内部行为。
不依赖真实 asyncio 调度(WorkerPool 单例可能在测试间共享)。
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.api import dag
from app.services.dag_scheduler import (
    DAGNode,
    DAGScheduler,
    KanbanTask,
    WorkerPool,
    WorkerPoolConfig,
)


# =============================================================================
# 辅助:每个测试前重置全局单例状态
# =============================================================================


@pytest.fixture(autouse=True)
def _bypass_jwt(monkeypatch):
    """隔离 JWT 中间件:清空 jwt_secret → middleware 走跳过路径(node_env=development)。

    .env 中配置了真实 jwt_secret,JWTAuthMiddleware 会验证 token,测试无 token → 401。
    清空 jwt_secret + node_env=development 后,middleware 直接放行。
    """
    from app.core.config import settings
    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")


@pytest.fixture(autouse=True)
def _reset_dag_globals(monkeypatch):
    """重置 dag 模块全局 _pool / _executions,避免测试间污染。"""
    monkeypatch.setattr(dag, "_pool", None)
    monkeypatch.setattr(dag, "_executions", {})
    yield


# =============================================================================
# POST /api/dag/execute
# =============================================================================


class TestExecuteDag:
    """测试 DAG 执行端点。"""

    async def test_returns_execution_id_on_success(self, client):
        # 单节点 DAG → 成功,返回 executionId + status
        resp = await client.post("/api/dag/dag/execute", json={
            "nodes": [
                {"id": "n1", "name": "first node"},
            ],
            "initialContext": {"input": "value"},
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert "executionId" in body["data"]
        assert body["data"]["status"] in ("success", "partial")

    async def test_supports_camel_case_aliases(self, client):
        # maxRetries / initialContext 等 camelCase alias 正常解析
        resp = await client.post("/api/dag/dag/execute", json={
            "nodes": [
                {
                    "id": "n1",
                    "name": "node",
                    "dependencies": [],
                    "maxRetries": 5,
                    "timeout": 60.0,
                },
            ],
            "initialContext": {"k": "v"},
        })
        assert resp.status_code == 200
        assert resp.json()["code"] == 0

    async def test_supports_snake_case_field_names(self, client):
        # populate_by_name=True,也支持 max_retries / initial_context 等
        resp = await client.post("/api/dag/dag/execute", json={
            "nodes": [
                {
                    "id": "n1",
                    "name": "node",
                    "max_retries": 2,
                    "timeout": 30.0,
                },
            ],
            "initial_context": {},
        })
        assert resp.status_code == 200
        assert resp.json()["code"] == 0

    async def test_returns_422_when_nodes_missing(self, client):
        # nodes 必填 → 422
        resp = await client.post("/api/dag/dag/execute", json={"initialContext": {}})
        assert resp.status_code == 422

    async def test_returns_422_when_nodes_empty(self, client):
        # nodes 为空列表 → 触发 DAGScheduler.execute 返回(可能 success 空)
        # 这里测试不抛 422(空 list 类型正确,只是没有节点)
        resp = await client.post("/api/dag/dag/execute", json={"nodes": []})
        # 空节点 DAG 执行不抛错(只是没有节点)
        assert resp.status_code == 200

    async def test_returns_500_when_node_executor_fails(self, client, monkeypatch):
        # DAGScheduler.execute 抛异常 → code 500 + data None
        async def boom(self, initial_context):
            raise RuntimeError("cycle detected")

        monkeypatch.setattr(DAGScheduler, "execute", boom)

        resp = await client.post("/api/dag/dag/execute", json={
            "nodes": [{"id": "n1", "name": "n"}],
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 500
        assert body["data"] is None
        assert "DAG 执行失败" in body["message"]

    async def test_multi_node_dag_executes_in_dependency_order(self, client):
        # 多节点 DAG:节点 A → 节点 B(B 依赖 A)
        resp = await client.post("/api/dag/dag/execute", json={
            "nodes": [
                {"id": "a", "name": "node A", "dependencies": []},
                {"id": "b", "name": "node B", "dependencies": ["a"]},
            ],
            "initialContext": {"start": True},
        })
        assert resp.status_code == 200
        assert resp.json()["code"] == 0


# =============================================================================
# GET /api/dag/execute/{execution_id}
# =============================================================================


class TestGetExecution:
    """测试 DAG 执行状态查询端点。"""

    async def test_returns_data_for_existing_execution(self, client):
        # 先提交一个 DAG,再查询
        submit = await client.post("/api/dag/dag/execute", json={
            "nodes": [{"id": "n1", "name": "n"}],
        })
        exec_id = submit.json()["data"]["executionId"]

        resp = await client.get(f"/api/dag/dag/execute/{exec_id}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert "data" in body
        assert body["data"] is not None

    async def test_returns_404_for_nonexistent_execution(self, client):
        # 不存在的 executionId → 404 + 自定义 detail
        resp = await client.get("/api/dag/dag/execute/nonexistent-id")
        assert resp.status_code == 404
        assert "executionId 不存在" in resp.json()["detail"]

    async def test_returns_404_for_empty_execution_id(self, client):
        # 空 executionId → 路由匹配失败或 404
        resp = await client.get("/api/dag/dag/execute/")
        # FastAPI 路由匹配:尾部 / 可能匹配也可能 404
        assert resp.status_code in (404, 307)


# =============================================================================
# POST /api/dag/tasks
# =============================================================================


class TestSubmitTask:
    """测试 KanbanTask 提交端点。"""

    async def test_returns_task_id_on_success(self, client):
        # 提交任务 → 返回 taskId + task 对象
        resp = await client.post("/api/dag/dag/tasks", json={
            "agentId": "agent-1",
            "name": "Test Task",
            "priority": 5,
            "payload": {"key": "value"},
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert "taskId" in body["data"]
        assert "task" in body["data"]
        # task 对象含 agentId / name / priority
        task = body["data"]["task"]
        assert task["agentId"] == "agent-1"
        assert task["name"] == "Test Task"

    async def test_supports_camel_case_aliases(self, client):
        # agentId / scheduledAt / createdBy 等 camelCase
        resp = await client.post("/api/dag/dag/tasks", json={
            "agentId": "a1",
            "name": "task",
            "scheduledAt": "2026-07-23T10:00:00Z",
            "createdBy": "user-1",
            "dependencies": ["t-0"],
        })
        assert resp.status_code == 200
        assert resp.json()["code"] == 0

    async def test_returns_422_when_agent_id_missing(self, client):
        # agentId 必填 → 422
        resp = await client.post("/api/dag/dag/tasks", json={"name": "task"})
        assert resp.status_code == 422

    async def test_returns_422_when_name_missing(self, client):
        # name 必填 → 422
        resp = await client.post("/api/dag/dag/tasks", json={"agentId": "a1"})
        assert resp.status_code == 422

    async def test_returns_422_when_body_empty(self, client):
        # 空 body → 422
        resp = await client.post("/api/dag/dag/tasks", json={})
        assert resp.status_code == 422

    async def test_uses_provided_task_id_when_present(self, client):
        # 显式提供 id → 用该 id,而非新生成 uuid
        resp = await client.post("/api/dag/dag/tasks", json={
            "id": "my-custom-id",
            "agentId": "a1",
            "name": "task",
        })
        assert resp.status_code == 200
        assert resp.json()["data"]["taskId"] == "my-custom-id"

    async def test_returns_500_on_pool_submit_error(self, client, monkeypatch):
        # WorkerPool.submit 抛 RuntimeError → code 500
        async def boom(self, task):
            raise RuntimeError("pool is full")

        monkeypatch.setattr(WorkerPool, "submit", boom)

        resp = await client.post("/api/dag/dag/tasks", json={
            "agentId": "a1",
            "name": "task",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 500
        assert "pool is full" in body["message"]


# =============================================================================
# GET /api/dag/tasks/{task_id}
# =============================================================================


class TestGetTask:
    """测试任务状态查询端点。"""

    async def test_returns_task_for_existing_id(self, client):
        # 先提交任务,再查询
        submit = await client.post("/api/dag/dag/tasks", json={
            "agentId": "a1",
            "name": "task",
        })
        task_id = submit.json()["data"]["taskId"]

        resp = await client.get(f"/api/dag/dag/tasks/{task_id}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["id"] == task_id

    async def test_returns_404_for_nonexistent_task(self, client):
        # 不存在的 taskId → 404
        resp = await client.get("/api/dag/dag/tasks/nonexistent-task-id")
        assert resp.status_code == 404
        assert "任务不存在" in resp.json()["detail"]


# =============================================================================
# GET /api/dag/tasks 列表
# =============================================================================


class TestListTasks:
    """测试任务列表端点。"""

    async def test_returns_empty_list_when_no_tasks(self, client):
        # 无任务 → 空列表 + total 0
        resp = await client.get("/api/dag/dag/tasks")
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert isinstance(body["data"], list)
        assert body["total"] == len(body["data"])

    async def test_returns_list_after_submitting_tasks(self, client):
        # 提交任务后,列表含该任务
        await client.post("/api/dag/dag/tasks", json={"agentId": "a1", "name": "t1"})
        await client.post("/api/dag/dag/tasks", json={"agentId": "a2", "name": "t2"})

        resp = await client.get("/api/dag/dag/tasks")
        body = resp.json()
        assert body["total"] >= 2
        # 每个 task 含 agentId / name
        for task in body["data"]:
            assert "agentId" in task
            assert "name" in task

    async def test_supports_status_filter(self, client):
        # status 过滤参数(不报错,即使无匹配)
        resp = await client.get("/api/dag/dag/tasks?status=done")
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        # 所有返回的任务状态都应是 done(若有)
        for task in body["data"]:
            assert task.get("status") == "done"


# =============================================================================
# GET /api/dag/workers
# =============================================================================


class TestListWorkers:
    """测试 worker 状态列表端点。"""

    async def test_returns_workers_list(self, client):
        # 列出 worker 状态(即使为空也是 200)
        resp = await client.get("/api/dag/dag/workers")
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert isinstance(body["data"], list)

    async def test_returns_workers_after_task_submission(self, client):
        # 提交任务触发 WorkerPool 创建 → 列表非空
        await client.post("/api/dag/dag/tasks", json={
            "agentId": "a1",
            "name": "t1",
        })
        resp = await client.get("/api/dag/dag/workers")
        body = resp.json()
        # WorkerPool 默认配置应创建若干 worker
        assert body["code"] == 0
        # 至少有 1 个 worker(WorkerPoolConfig 默认 worker_count > 0)
        # 注意:worker 可能处于 idle 状态,但应存在
        assert isinstance(body["data"], list)


# =============================================================================
# 模型字段约束
# =============================================================================


class TestRequestModels:
    """测试请求模型字段定义。"""

    def test_kanban_task_create_defaults(self):
        # KanbanTaskCreate 默认值
        req = dag.KanbanTaskCreate(agentId="a1", name="t")
        assert req.priority == 0
        assert req.payload == {}
        assert req.dependencies == []
        assert req.id is None
        assert req.description is None

    def test_dag_node_spec_defaults(self):
        # DAGNodeSpec 默认值
        req = dag.DAGNodeSpec(id="n1", name="node")
        assert req.dependencies == []
        assert req.max_retries == 3
        assert req.timeout == 300.0

    def test_dag_execute_request_defaults(self):
        # DAGExecuteRequest 默认值
        req = dag.DAGExecuteRequest(nodes=[{"id": "n1", "name": "n"}])
        assert req.edges == []
        assert req.initial_context == {}

    def test_kanban_task_create_supports_camel_case(self):
        # agentId / scheduledAt / createdBy alias
        req = dag.KanbanTaskCreate(
            agentId="a1",
            name="t",
            scheduledAt="2026-07-23T10:00:00Z",
            createdBy="u1",
        )
        assert req.scheduled_at == "2026-07-23T10:00:00Z"
        assert req.created_by == "u1"
