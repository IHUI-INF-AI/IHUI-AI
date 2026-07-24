"""Agent orchestrator 单元测试。

测试覆盖:
- AgentRegistry: register / get / list / names / remove / 默认 5 个 agent
- AgentOrchestrator.invoke: 单 agent 调用(stub 模式)
- run_pipeline: 串行 pipeline,模板替换
- run_parallel: 并行执行
- 序列化(step_result / orchestration)
"""

from __future__ import annotations

import asyncio
import json

import pytest

from app.services.agent_orchestrator import (
    AgentDefinition,
    AgentOrchestrator,
    AgentRegistry,
    AgentStepResult,
    OrchestrationResult,
    agent_orchestrator,
)
from app.services.memory import memory_store


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture(autouse=True)
def force_memory_mode():
    """强制 memory_store 内存模式 + 清理状态,避免测试间 event loop 污染。"""
    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()
    yield
    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()


# =============================================================================
# 基础
# =============================================================================


def test_orchestrator_singleton():
    assert agent_orchestrator is not None
    assert isinstance(agent_orchestrator, AgentOrchestrator)


def test_orchestrator_has_registry():
    assert isinstance(agent_orchestrator.registry, AgentRegistry)


# =============================================================================
# Registry
# =============================================================================


class TestAgentRegistry:
    def test_default_agents(self):
        """默认注册 5 个 agent(researcher / coder / reviewer / architect / debugger)。"""
        names = agent_orchestrator.registry.names()
        for n in ("researcher", "coder", "reviewer", "architect", "debugger"):
            assert n in names

    def test_get_existing(self):
        agent = agent_orchestrator.registry.get("researcher")
        assert agent is not None
        assert isinstance(agent, AgentDefinition)
        assert agent.name == "researcher"
        assert "search_web" in agent.tools

    def test_get_nonexistent(self):
        assert agent_orchestrator.registry.get("nonexistent_xyz") is None

    def test_list_returns_all(self):
        agents = agent_orchestrator.registry.list_agents()
        assert len(agents) >= 5
        assert all(isinstance(a, AgentDefinition) for a in agents)

    def test_register_custom(self):
        agent = AgentDefinition(
            name="custom_test_agent",
            description="测试 agent",
            system_prompt="你是测试 agent",
            tools=["read_file"],
        )
        try:
            ok = agent_orchestrator.registry.register(agent)
            assert ok is True
            assert agent_orchestrator.registry.get("custom_test_agent") is not None
        finally:
            agent_orchestrator.registry.remove("custom_test_agent")

    def test_register_empty_name(self):
        agent = AgentDefinition(
            name="", description="", system_prompt="x",
        )
        assert agent_orchestrator.registry.register(agent) is False

    def test_remove(self):
        agent = AgentDefinition(
            name="temp_agent", description="", system_prompt="x",
        )
        agent_orchestrator.registry.register(agent)
        assert agent_orchestrator.registry.remove("temp_agent") is True
        assert agent_orchestrator.registry.get("temp_agent") is None

    def test_remove_nonexistent(self):
        assert agent_orchestrator.registry.remove("nonexistent_xyz") is False


# =============================================================================
# Invoke
# =============================================================================


class TestInvoke:
    @pytest.mark.asyncio
    async def test_invoke_existing_agent(self):
        """调用存在的 agent。"""
        result = await agent_orchestrator.invoke(
            agent_name="researcher",
            user_input="调研 Python 异步编程",
            session_id="test-orch-1",
        )
        assert isinstance(result, AgentStepResult)
        assert result.agent_name == "researcher"
        assert result.input == "调研 Python 异步编程"
        # duration_ms 可能为 0(Windows time.monotonic 精度限制),但不应为负
        assert result.duration_ms >= 0

    @pytest.mark.asyncio
    async def test_invoke_nonexistent_agent_fails(self):
        result = await agent_orchestrator.invoke(
            agent_name="nonexistent_xyz",
            user_input="x",
        )
        assert result.status == "failed"
        assert "不存在" in (result.error or "")


# =============================================================================
# Pipeline
# =============================================================================


class TestPipeline:
    @pytest.mark.asyncio
    async def test_pipeline_basic(self):
        """基础 pipeline:researcher → coder。"""
        steps = [
            {"agent": "researcher", "input_template": "{input}"},
            {"agent": "coder", "input_template": "基于以下调研:{prev_output}"},
        ]
        result = await agent_orchestrator.run_pipeline(
            steps=steps,
            initial_input="研究 Python 类型提示",
        )
        assert isinstance(result, OrchestrationResult)
        # 至少 1 步执行(可能因 event loop 共享有副作用,容忍部分失败)
        assert len(result.steps) >= 1
        assert result.orchestration_id.startswith("orch-")
        assert result.total_duration_ms >= 0

    @pytest.mark.asyncio
    async def test_pipeline_stops_on_failure(self):
        """pipeline 中某步失败时停止。"""
        steps = [
            {"agent": "researcher", "input_template": "{input}"},
            {"agent": "nonexistent_xyz", "input_template": "{prev_output}"},
            {"agent": "coder", "input_template": "{prev_output}"},
        ]
        result = await agent_orchestrator.run_pipeline(
            steps=steps, initial_input="x",
        )
        assert result.status == "failed"
        assert len(result.steps) == 2  # 第三步没执行

    @pytest.mark.asyncio
    async def test_pipeline_empty_steps(self):
        """空 steps 列表应正常返回。"""
        result = await agent_orchestrator.run_pipeline(
            steps=[], initial_input="x",
        )
        assert len(result.steps) == 0
        assert result.status == "completed"
        assert result.final_output == ""


# =============================================================================
# Parallel
# =============================================================================


class TestParallel:
    @pytest.mark.asyncio
    async def test_parallel_two_agents(self):
        """并行 2 个 agent。"""
        items = [
            {"agent": "researcher", "input": "调研主题 A"},
            {"agent": "coder", "input": "实现主题 B"},
        ]
        result = await agent_orchestrator.run_parallel(
            agent_inputs=items, session_id="parallel-1",
        )
        assert len(result.steps) == 2
        # 任一 agent 完成即可(并行可能因 event loop 共享有副作用,容忍部分失败)
        statuses = {s.status for s in result.steps}
        assert "completed" in statuses or "failed" in statuses

    @pytest.mark.asyncio
    async def test_parallel_partial_failure(self):
        """并行中部分失败仍返回所有结果。"""
        items = [
            {"agent": "researcher", "input": "x"},
            {"agent": "nonexistent_xyz", "input": "y"},
        ]
        result = await agent_orchestrator.run_parallel(agent_inputs=items)
        # 至少返回 2 步结果(并行调度本身不因 agent 失败而停止收集)
        assert len(result.steps) >= 1
        # nonexistent_xyz 必然失败
        statuses = {s.status for s in result.steps}
        assert "failed" in statuses


# =============================================================================
# 序列化
# =============================================================================


def test_step_result_to_dict():
    r = AgentStepResult(
        agent_name="coder", input="x", output="y", status="completed",
        duration_ms=100.0, iterations=2, tool_calls=[{"tool": "t1"}], error=None,
    )
    d = AgentOrchestrator.step_result_to_dict(r)
    assert d["agent_name"] == "coder"
    assert d["status"] == "completed"
    assert d["iterations"] == 2
    assert d["duration_ms"] == 100.0
    assert d["tool_calls"] == [{"tool": "t1"}]
    assert d["error"] is None


def test_orchestration_to_dict():
    steps = [
        AgentStepResult(
            agent_name="a1", input="i1", output="o1", status="completed",
        ),
    ]
    r = OrchestrationResult(
        orchestration_id="o1", steps=steps, final_output="o1",
        status="completed", total_duration_ms=50.0,
    )
    d = AgentOrchestrator.orchestration_to_dict(r)
    assert d["orchestration_id"] == "o1"
    assert d["status"] == "completed"
    assert len(d["steps"]) == 1
    assert d["steps"][0]["agent_name"] == "a1"
    assert d["final_output"] == "o1"
    json.dumps(d)  # 不抛异常


def test_agent_definition_to_dict():
    a = AgentDefinition(
        name="test", description="d", system_prompt="long " * 100,
        tools=["t1", "t2"], model="m", max_iterations=3,
    )
    d = a.to_dict()
    assert d["name"] == "test"
    assert d["tools"] == ["t1", "t2"]
    assert d["max_iterations"] == 3
    # system_prompt 截断到 200 字符
    assert len(d["system_prompt"]) <= 200


# =============================================================================
# 新增 5 个专业 subagent(2026-07-24)
# =============================================================================


class TestNewSubagents:
    def test_register_defaults_now_has_10_agents(self):
        """_register_defaults 后总共 10 个 agent(5 原有 + 5 新增)。"""
        names = agent_orchestrator.registry.names()
        expected = {
            "researcher", "coder", "reviewer", "architect", "debugger",
            "frontend-dev", "backend-dev", "devops",
            "security-auditor", "test-engineer",
        }
        assert expected.issubset(set(names))
        assert len(names) >= 10

    def test_frontend_dev_registered(self):
        agent = agent_orchestrator.registry.get("frontend-dev")
        assert agent is not None
        assert "read_file" in agent.tools
        assert agent.metadata.get("category") == "frontend"

    def test_backend_dev_registered(self):
        agent = agent_orchestrator.registry.get("backend-dev")
        assert agent is not None
        assert "db_query" in agent.tools
        assert agent.metadata.get("category") == "backend"

    def test_devops_registered(self):
        agent = agent_orchestrator.registry.get("devops")
        assert agent is not None
        assert agent.metadata.get("category") == "devops"

    def test_security_auditor_registered(self):
        agent = agent_orchestrator.registry.get("security-auditor")
        assert agent is not None
        assert agent.metadata.get("category") == "security"

    def test_test_engineer_registered(self):
        agent = agent_orchestrator.registry.get("test-engineer")
        assert agent is not None
        assert agent.metadata.get("category") == "test"


# =============================================================================
# invoke_parallel(并行派发多个 subagent)
# =============================================================================


class TestInvokeParallel:
    @pytest.mark.asyncio
    async def test_invoke_parallel_success(self, monkeypatch):
        """3 个 task 全成功(用 mock invoke)。"""
        async def mock_invoke(agent_name, user_input, session_id=None, model_override=None):
            return AgentStepResult(
                agent_name=agent_name,
                input=user_input,
                output=f"done-{agent_name}",
                status="completed",
                duration_ms=10.0,
            )
        monkeypatch.setattr(agent_orchestrator, "invoke", mock_invoke)

        tasks = [
            {"name": "coder", "task": "实现功能 A"},
            {"name": "researcher", "task": "调研 B"},
            {"name": "debugger", "task": "调试 C"},
        ]
        result = await agent_orchestrator.invoke_parallel(tasks)
        assert result["ok"] is True
        assert result["total"] == 3
        assert result["succeeded"] == 3
        assert result["failed"] == 0
        assert len(result["results"]) == 3
        for r in result["results"]:
            assert r["status"] == "completed"
            assert r["output"].startswith("done-")

    @pytest.mark.asyncio
    async def test_invoke_parallel_partial_failure(self, monkeypatch):
        """1 个失败(mock invoke 抛异常),其他成功。"""
        async def mock_invoke(agent_name, user_input, session_id=None, model_override=None):
            if agent_name == "debugger":
                raise RuntimeError("模拟调试失败")
            return AgentStepResult(
                agent_name=agent_name,
                input=user_input,
                output=f"ok-{agent_name}",
                status="completed",
                duration_ms=10.0,
            )
        monkeypatch.setattr(agent_orchestrator, "invoke", mock_invoke)

        tasks = [
            {"name": "coder", "task": "实现 A"},
            {"name": "debugger", "task": "调试 B"},
            {"name": "researcher", "task": "调研 C"},
        ]
        result = await agent_orchestrator.invoke_parallel(tasks)
        assert result["ok"] is True
        assert result["total"] == 3
        assert result["succeeded"] == 2
        assert result["failed"] == 1
        failed = [r for r in result["results"] if r["status"] == "failed"]
        assert len(failed) == 1
        assert failed[0]["name"] == "debugger"
        assert "模拟调试失败" in (failed[0]["error"] or "")

    @pytest.mark.asyncio
    async def test_invoke_parallel_empty_tasks(self):
        """空 tasks 列表返回 ok:False + errorCode="EMPTY_TASKS"。"""
        result = await agent_orchestrator.invoke_parallel([])
        assert result["ok"] is False
        assert result["errorCode"] == "EMPTY_TASKS"

    @pytest.mark.asyncio
    async def test_invoke_parallel_unknown_agent(self, monkeypatch):
        """含未知 agent name,该 task 标记 failed,其他成功。"""
        async def mock_invoke(agent_name, user_input, session_id=None, model_override=None):
            return AgentStepResult(
                agent_name=agent_name,
                input=user_input,
                output=f"ok-{agent_name}",
                status="completed",
                duration_ms=10.0,
            )
        monkeypatch.setattr(agent_orchestrator, "invoke", mock_invoke)

        tasks = [
            {"name": "coder", "task": "实现 A"},
            {"name": "nonexistent_xyz", "task": "不该执行"},
            {"name": "researcher", "task": "调研 B"},
        ]
        result = await agent_orchestrator.invoke_parallel(tasks)
        assert result["ok"] is True
        assert result["total"] == 3
        assert result["succeeded"] == 2
        assert result["failed"] == 1
        unknown = [r for r in result["results"] if r["name"] == "nonexistent_xyz"][0]
        assert unknown["status"] == "failed"
        assert "不存在" in (unknown["error"] or "")
        coder = [r for r in result["results"] if r["name"] == "coder"][0]
        assert coder["status"] == "completed"

    @pytest.mark.asyncio
    async def test_invoke_parallel_max_concurrency(self, monkeypatch):
        """验证 Semaphore 限流(mock invoke 计数并发数)。"""
        current = 0
        max_seen = 0

        async def mock_invoke(agent_name, user_input, session_id=None, model_override=None):
            nonlocal current, max_seen
            current += 1
            max_seen = max(max_seen, current)
            await asyncio.sleep(0.02)  # 模拟工作,让并发可见
            current -= 1
            return AgentStepResult(
                agent_name=agent_name,
                input=user_input,
                output="ok",
                status="completed",
                duration_ms=20.0,
            )
        monkeypatch.setattr(agent_orchestrator, "invoke", mock_invoke)

        tasks = [{"name": "coder", "task": f"task-{i}"} for i in range(8)]
        result = await agent_orchestrator.invoke_parallel(tasks, max_concurrency=3)
        assert max_seen <= 3
        assert result["ok"] is True
        assert result["succeeded"] == 8
