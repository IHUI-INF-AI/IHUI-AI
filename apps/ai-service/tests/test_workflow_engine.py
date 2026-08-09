"""工作流引擎测试(Phase 2:可视化工作流编辑器,2026-08-09 新增)。"""

from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI

from app.services.workflow_engine import (
    WorkflowEngine,
    Workflow,
    WorkflowInstance,
    WorkflowTask,
    WorkflowLog,
)


# =========================================================================
# Fixtures
# =========================================================================


@pytest.fixture
def engine() -> WorkflowEngine:
    """每次测试返回干净的引擎实例。"""
    return WorkflowEngine()


def _make_app() -> FastAPI:
    """创建测试用 FastAPI app(不含 middleware,仅注册路由)。"""
    from app.routers.workflow import router as workflow_router

    app = FastAPI()
    app.include_router(workflow_router, prefix="/api")
    return app


# =========================================================================
# 工作流 CRUD 测试
# =========================================================================


class TestWorkflowCRUD:
    """WorkflowEngine CRUD 操作测试。"""

    def test_create_workflow(self, engine: WorkflowEngine) -> None:
        """创建工作流返回正确的数据。"""
        wf = engine.create_workflow(
            name="测试工作流",
            description="这是一个测试",
            triggerType="manual",
            steps=[{"name": "step1", "type": "echo", "input": "hello"}],
        )
        assert wf.id.startswith("wf-")
        assert wf.name == "测试工作流"
        assert wf.description == "这是一个测试"
        assert wf.triggerType == "manual"
        assert len(wf.steps) == 1
        assert wf.isActive is True
        assert wf.createdAt != ""

    def test_create_workflow_empty_steps(self, engine: WorkflowEngine) -> None:
        """创建包含空 steps 的工作流。"""
        wf = engine.create_workflow(
            name="空步骤工作流",
            description="",
            triggerType="manual",
            steps=[],
        )
        assert wf.id.startswith("wf-")
        assert len(wf.steps) == 0

    def test_list_workflows_empty(self, engine: WorkflowEngine) -> None:
        """空列表返回空数组。"""
        assert engine.list_workflows() == []

    def test_list_workflows(self, engine: WorkflowEngine) -> None:
        """列表按创建时间降序返回。"""
        wf1 = engine.create_workflow("A", "", "manual", [])
        wf2 = engine.create_workflow("B", "", "manual", [])
        lst = engine.list_workflows()
        assert len(lst) == 2
        # 最新的在前
        assert lst[0].name == "B"
        assert lst[1].name == "A"

    def test_get_workflow(self, engine: WorkflowEngine) -> None:
        """按 ID 获取工作流。"""
        wf = engine.create_workflow("测试", "desc", "manual", [])
        got = engine.get_workflow(wf.id)
        assert got is not None
        assert got.name == "测试"

    def test_get_workflow_not_found(self, engine: WorkflowEngine) -> None:
        """不存在的 ID 返回 None。"""
        assert engine.get_workflow("nonexistent") is None

    def test_update_workflow(self, engine: WorkflowEngine) -> None:
        """更新工作流字段。"""
        wf = engine.create_workflow("旧名", "旧描述", "manual", [])
        updated = engine.update_workflow(
            wf.id,
            name="新名",
            description="新描述",
            triggerType="schedule",
            isActive=False,
        )
        assert updated is not None
        assert updated.name == "新名"
        assert updated.description == "新描述"
        assert updated.triggerType == "schedule"
        assert updated.isActive is False
        assert updated.updatedAt != ""

    def test_update_workflow_not_found(self, engine: WorkflowEngine) -> None:
        """更新不存在的 ID 返回 None。"""
        assert engine.update_workflow("nonexistent", name="new") is None

    def test_update_workflow_partial(self, engine: WorkflowEngine) -> None:
        """部分更新只改传入字段。"""
        wf = engine.create_workflow("原名", "原描述", "manual", [{"name": "s1"}])
        updated = engine.update_workflow(wf.id, name="新名")
        assert updated is not None
        assert updated.name == "新名"
        assert updated.description == "原描述"  # 未变
        assert len(updated.steps) == 1

    def test_delete_workflow(self, engine: WorkflowEngine) -> None:
        """删除工作流。"""
        wf = engine.create_workflow("测试", "", "manual", [])
        assert engine.delete_workflow(wf.id) is True
        assert engine.get_workflow(wf.id) is None

    def test_delete_workflow_not_found(self, engine: WorkflowEngine) -> None:
        """删除不存在的 ID 返回 False。"""
        assert engine.delete_workflow("nonexistent") is False


# =========================================================================
# 工作流执行测试
# =========================================================================


class TestWorkflowExecution:
    """工作流执行逻辑测试。"""

    @pytest.mark.asyncio
    async def test_trigger_workflow_not_found(self, engine: WorkflowEngine) -> None:
        """触发不存在的 ID 返回 None。"""
        result = await engine.trigger_workflow("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_trigger_workflow_inactive(self, engine: WorkflowEngine) -> None:
        """触发已禁用工作流返回 None。"""
        wf = engine.create_workflow("测试", "", "manual", [{"name": "s1", "type": "echo"}])
        engine.update_workflow(wf.id, isActive=False)
        result = await engine.trigger_workflow(wf.id)
        assert result is None

    @pytest.mark.asyncio
    async def test_trigger_echo_workflow(self, engine: WorkflowEngine) -> None:
        """触发 echo 类型的工作流,实例状态应为 completed。"""
        wf = engine.create_workflow(
            "echo 测试",
            "",
            "manual",
            [{"name": "step1", "type": "echo", "input": "hello world"}],
        )
        inst = await engine.trigger_workflow(wf.id)
        assert inst is not None
        assert inst.status == "pending"
        assert inst.workflowId == wf.id
        assert inst.workflowName == "echo 测试"

        # 等待异步执行完成
        await asyncio.sleep(0.1)

        # 重新获取实例
        updated = engine.get_instance(inst.id)
        assert updated is not None
        assert updated.status == "completed"
        assert updated.completedAt != ""

    @pytest.mark.asyncio
    async def test_trigger_workflow_cancel(self, engine: WorkflowEngine) -> None:
        """在执行过程中取消工作流。"""
        wf = engine.create_workflow(
            "取消测试",
            "",
            "manual",
            [{"name": "s1", "type": "echo", "input": "step1"}],
        )
        inst = await engine.trigger_workflow(wf.id)
        assert inst is not None

        # 取消
        ok = await engine.cancel_instance(inst.id)
        assert ok is True

        await asyncio.sleep(0.1)
        updated = engine.get_instance(inst.id)
        assert updated is not None
        # 可能 cancelled 或 completed(已执行完)
        assert updated.status in ("cancelled", "completed")

    @pytest.mark.asyncio
    async def test_cancel_not_running(self, engine: WorkflowEngine) -> None:
        """取消已完成实例返回 False。"""
        wf = engine.create_workflow(
            "测试",
            "",
            "manual",
            [{"name": "s1", "type": "echo", "input": "hi"}],
        )
        inst = await engine.trigger_workflow(wf.id)
        assert inst is not None
        await asyncio.sleep(0.1)
        ok = await engine.cancel_instance(inst.id)
        assert ok is False  # 已完成不能再取消

    @pytest.mark.asyncio
    async def test_retry_workflow(self, engine: WorkflowEngine) -> None:
        """重试失败实例。"""
        wf = engine.create_workflow(
            "重试测试",
            "",
            "manual",
            [{"name": "s1", "type": "echo", "input": "retry"}],
        )
        inst = await engine.trigger_workflow(wf.id)
        assert inst is not None
        await asyncio.sleep(0.1)

        # 手动标记为失败
        inst.status = "failed"
        inst.completedAt = ""

        retried = await engine.retry_instance(inst.id)
        assert retried is not None
        assert retried.id != inst.id  # 新实例
        assert retried.workflowId == wf.id

    @pytest.mark.asyncio
    async def test_retry_not_failed(self, engine: WorkflowEngine) -> None:
        """重试未失败的实例返回 None。"""
        wf = engine.create_workflow("测试", "", "manual", [{"name": "s1", "type": "echo"}])
        inst = await engine.trigger_workflow(wf.id)
        assert inst is not None
        await asyncio.sleep(0.1)
        result = await engine.retry_instance(inst.id)
        assert result is None  # 已完成不能重试

    @pytest.mark.asyncio
    async def test_trigger_concurrent_prevention(self, engine: WorkflowEngine) -> None:
        """防止并发触发同一工作流。"""
        wf = engine.create_workflow(
            "并发测试",
            "",
            "manual",
            [{"name": "s1", "type": "echo", "input": "slow"}],
        )
        inst1 = await engine.trigger_workflow(wf.id)
        assert inst1 is not None
        # 第二次触发应返回 None(正在运行)
        inst2 = await engine.trigger_workflow(wf.id)
        assert inst2 is None

    @pytest.mark.asyncio
    async def test_echo_step(self, engine: WorkflowEngine) -> None:
        """测试 echo 类型的 step 执行。"""
        result = await engine._execute_step(
            {"name": "s1", "type": "echo", "input": "test_value"},
            {},
            "test-instance",
        )
        assert result.get("output") == "test_value"

    @pytest.mark.asyncio
    async def test_echo_step_with_context(self, engine: WorkflowEngine) -> None:
        """echo step 返回 context 的 JSON 序列化。"""
        result = await engine._execute_step(
            {"name": "s1", "type": "echo"},
            {"key": "value"},
            "test-instance",
        )
        parsed = json.loads(result["output"])
        assert parsed["key"] == "value"

    @pytest.mark.asyncio
    async def test_unsupported_step_type(self, engine: WorkflowEngine) -> None:
        """不支持的 step type 返回 error。"""
        result = await engine._execute_step(
            {"name": "s1", "type": "invalid_type"},
            {},
            "test-instance",
        )
        assert "error" in result
        assert "不支持的" in result["error"]


# =========================================================================
# 实例管理测试
# =========================================================================


class TestInstanceManagement:
    """实例管理功能测试。"""

    @pytest.mark.asyncio
    async def test_list_instances_empty(self, engine: WorkflowEngine) -> None:
        """空列表返回空数组。"""
        assert engine.list_instances() == []

    @pytest.mark.asyncio
    async def test_list_instances_filter_by_workflow(self, engine: WorkflowEngine) -> None:
        """按 workflowId 筛选实例。"""
        wf1 = engine.create_workflow("WF1", "", "manual", [{"name": "s1", "type": "echo"}])
        wf2 = engine.create_workflow("WF2", "", "manual", [{"name": "s1", "type": "echo"}])

        i1 = await engine.trigger_workflow(wf1.id)
        i2 = await engine.trigger_workflow(wf2.id)
        assert i1 is not None
        assert i2 is not None
        await asyncio.sleep(0.1)

        wf1_insts = engine.list_instances(workflow_id=wf1.id)
        assert len(wf1_insts) == 1
        assert wf1_insts[0].id == i1.id

    @pytest.mark.asyncio
    async def test_get_instance_not_found(self, engine: WorkflowEngine) -> None:
        """不存在的实例返回 None。"""
        assert engine.get_instance("nonexistent") is None

    @pytest.mark.asyncio
    async def test_get_instance_tasks_empty(self, engine: WorkflowEngine) -> None:
        """不存在的实例返回空列表。"""
        assert engine.get_instance_tasks("nonexistent") == []

    @pytest.mark.asyncio
    async def test_get_instance_logs_empty(self, engine: WorkflowEngine) -> None:
        """不存在的实例返回空列表。"""
        assert engine.get_instance_logs("nonexistent") == []

    @pytest.mark.asyncio
    async def test_instance_tasks_and_logs(self, engine: WorkflowEngine) -> None:
        """执行后应有任务和日志。"""
        wf = engine.create_workflow(
            "日志测试",
            "",
            "manual",
            [
                {"name": "s1", "type": "echo", "input": "step1"},
                {"name": "s2", "type": "echo", "input": "step2"},
            ],
        )
        inst = await engine.trigger_workflow(wf.id)
        assert inst is not None
        await asyncio.sleep(0.2)

        tasks = engine.get_instance_tasks(inst.id)
        assert len(tasks) == 2
        assert tasks[0].step == 1
        assert tasks[0].name == "s1"
        assert tasks[0].status == "completed"

        logs = engine.get_instance_logs(inst.id)
        assert len(logs) >= 2
        assert logs[0].level == "info"
        assert logs[0].message != ""


# =========================================================================
# 序列化测试
# =========================================================================


class TestSerialization:
    """序列化方法测试。"""

    def test_workflow_to_dict(self, engine: WorkflowEngine) -> None:
        """workflow 可序列化为 dict。"""
        wf = engine.create_workflow("测试", "desc", "manual", [{"name": "s1"}])
        d = engine.workflow_to_dict(wf)
        assert d["id"] == wf.id
        assert d["name"] == "测试"
        assert d["steps"] == [{"name": "s1"}]
        assert d["isActive"] is True

    def test_instance_to_dict(self, engine: WorkflowEngine) -> None:
        """instance 可序列化为 dict。"""
        inst = WorkflowInstance(
            id="wi-test",
            workflowId="wf-test",
            workflowName="测试",
            status="completed",
            startedAt="2026-01-01T00:00:00",
        )
        d = engine.instance_to_dict(inst)
        assert d["id"] == "wi-test"
        assert d["status"] == "completed"
        assert d["workflowName"] == "测试"

    def test_task_to_dict(self, engine: WorkflowEngine) -> None:
        """task 可序列化为 dict。"""
        t = WorkflowTask(
            id="task-test",
            instanceId="wi-test",
            step=1,
            name="step1",
            type="echo",
            status="completed",
            input="in",
            output="out",
        )
        d = engine.task_to_dict(t)
        assert d["step"] == 1
        assert d["status"] == "completed"
        assert d["output"] == "out"

    def test_log_to_dict(self, engine: WorkflowEngine) -> None:
        """log 可序列化为 dict。"""
        log = WorkflowLog(
            id="log-test",
            instanceId="wi-test",
            timestamp="2026-01-01T00:00:00",
            level="info",
            message="测试日志",
        )
        d = engine.log_to_dict(log)
        assert d["level"] == "info"
        assert d["message"] == "测试日志"


# =========================================================================
# 端点集成测试
# =========================================================================


class TestWorkflowEndpoints:
    """工作流 API 端点集成测试。"""

    @pytest.mark.asyncio
    async def test_list_workflows_empty(self) -> None:
        """GET /api/workflows 返回空列表。"""
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/workflows")
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["list"] == []

    @pytest.mark.asyncio
    async def test_create_workflow(self) -> None:
        """POST /api/workflows 创建成功。"""
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post(
                "/api/workflows",
                json={
                    "name": "测试工作流",
                    "description": "desc",
                    "triggerType": "manual",
                    "steps": [{"name": "s1", "type": "echo", "input": "hello"}],
                },
            )
        assert resp.status_code == 201
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["name"] == "测试工作流"
        assert data["data"]["id"].startswith("wf-")

    @pytest.mark.asyncio
    async def test_create_workflow_validation_error(self) -> None:
        """POST /api/workflows 空名称返回 422。"""
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post(
                "/api/workflows",
                json={"name": "", "steps": []},
            )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_get_workflow_not_found(self) -> None:
        """GET /api/workflows/{id} 不存在返回 404。"""
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/workflows/nonexistent")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_workflow_ok(self) -> None:
        """GET /api/workflows/{id} 返回工作流详情。"""
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            # 先创建
            create_resp = await ac.post(
                "/api/workflows",
                json={"name": "测试", "description": "desc", "steps": []},
            )
            wf_id = create_resp.json()["data"]["id"]
            # 再获取
            resp = await ac.get(f"/api/workflows/{wf_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"]["workflow"]["name"] == "测试"

    @pytest.mark.asyncio
    async def test_update_workflow(self) -> None:
        """PUT /api/workflows/{id} 更新成功。"""
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            # 创建
            create_resp = await ac.post(
                "/api/workflows",
                json={"name": "原名", "steps": []},
            )
            wf_id = create_resp.json()["data"]["id"]
            # 更新
            resp = await ac.put(
                f"/api/workflows/{wf_id}",
                json={"name": "新名", "isActive": False},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"]["name"] == "新名"
        assert data["data"]["isActive"] is False

    @pytest.mark.asyncio
    async def test_delete_workflow(self) -> None:
        """DELETE /api/workflows/{id} 删除成功。"""
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            create_resp = await ac.post(
                "/api/workflows",
                json={"name": "删除测试", "steps": []},
            )
            wf_id = create_resp.json()["data"]["id"]
            # 删除
            resp = await ac.delete(f"/api/workflows/{wf_id}")
        assert resp.status_code == 200
        assert resp.json()["code"] == 0

    @pytest.mark.asyncio
    async def test_trigger_workflow(self) -> None:
        """POST /api/workflows/{id}/trigger 触发执行。"""
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            create_resp = await ac.post(
                "/api/workflows",
                json={
                    "name": "触发测试",
                    "steps": [{"name": "s1", "type": "echo", "input": "hi"}],
                },
            )
            wf_id = create_resp.json()["data"]["id"]
            resp = await ac.post(f"/api/workflows/{wf_id}/trigger", json={"input": {}})
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["status"] == "pending"
        assert data["data"]["workflowId"] == wf_id

    @pytest.mark.asyncio
    async def test_trigger_workflow_not_found(self) -> None:
        """触发不存在的 ID 返回 400。"""
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.post("/api/workflows/nonexistent/trigger", json={"input": {}})
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_list_instances(self) -> None:
        """GET /api/workflows/instances 返回实例列表。"""
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            create_resp = await ac.post(
                "/api/workflows",
                json={"name": "实例测试", "steps": [{"name": "s1", "type": "echo"}]},
            )
            wf_id = create_resp.json()["data"]["id"]
            await ac.post(f"/api/workflows/{wf_id}/trigger", json={"input": {}})
            await asyncio.sleep(0.1)
            resp = await ac.get(f"/api/workflows/instances?workflow_id={wf_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["data"]["list"]) >= 1

    @pytest.mark.asyncio
    async def test_get_instance_tasks_and_logs(self) -> None:
        """获取实例的任务和日志。"""
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            create_resp = await ac.post(
                "/api/workflows",
                json={
                    "name": "任务日志测试",
                    "steps": [
                        {"name": "s1", "type": "echo", "input": "a"},
                        {"name": "s2", "type": "echo", "input": "b"},
                    ],
                },
            )
            wf_id = create_resp.json()["data"]["id"]
            trig_resp = await ac.post(f"/api/workflows/{wf_id}/trigger", json={"input": {}})
            inst_id = trig_resp.json()["data"]["id"]
            await asyncio.sleep(0.2)

            # 获取任务
            tasks_resp = await ac.get(f"/api/workflows/instances/{inst_id}/tasks")
            assert tasks_resp.status_code == 200
            tasks_data = tasks_resp.json()
            assert len(tasks_data["data"]["list"]) == 2

            # 获取日志
            logs_resp = await ac.get(f"/api/workflows/instances/{inst_id}/logs")
            assert logs_resp.status_code == 200
            logs_data = logs_resp.json()
            assert len(logs_data["data"]["list"]) >= 2

    @pytest.mark.asyncio
    async def test_cancel_instance_api(self) -> None:
        """POST /api/workflows/instances/{id}/cancel 取消实例。"""
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            create_resp = await ac.post(
                "/api/workflows",
                json={"name": "取消测试", "steps": [{"name": "s1", "type": "echo"}]},
            )
            wf_id = create_resp.json()["data"]["id"]
            trig_resp = await ac.post(f"/api/workflows/{wf_id}/trigger", json={"input": {}})
            inst_id = trig_resp.json()["data"]["id"]
            cancel_resp = await ac.post(f"/api/workflows/instances/{inst_id}/cancel")
        assert cancel_resp.status_code == 200

    @pytest.mark.asyncio
    async def test_retry_instance_api(self) -> None:
        """POST /api/workflows/instances/{id}/retry 重试实例。"""
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            create_resp = await ac.post(
                "/api/workflows",
                json={"name": "重试测试", "steps": [{"name": "s1", "type": "echo"}]},
            )
            wf_id = create_resp.json()["data"]["id"]
            trig_resp = await ac.post(f"/api/workflows/{wf_id}/trigger", json={"input": {}})
            inst_id = trig_resp.json()["data"]["id"]
            await asyncio.sleep(0.1)

            # 手动标记为失败
            from app.services.workflow_engine import workflow_engine
            inst = workflow_engine.get_instance(inst_id)
            if inst:
                inst.status = "failed"

            retry_resp = await ac.post(f"/api/workflows/instances/{inst_id}/retry")
        assert retry_resp.status_code == 200
        data = retry_resp.json()
        assert data["data"]["workflowId"] is not None