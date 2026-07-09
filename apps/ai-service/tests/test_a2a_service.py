"""A2A 服务单元测试。

测试 A2ATask / A2AAgent 序列化反序列化、A2AServer 注册/查询/任务创建。
不依赖 Redis(降级纯内存模式)。
"""

import pytest

from app.services.a2a_service import A2AAgent, A2AServer, A2ATask


class TestA2ATaskSerialization:
    """A2ATask to_dict / from_dict 往返。"""

    def test_task_to_dict_contains_all_fields(self):
        """to_dict 包含所有字段。"""
        task = A2ATask(task_id="task-1", name="测试任务", agent_id="agent-1", input_data={"key": "value"})
        d = task.to_dict()
        assert d["id"] == "task-1"
        assert d["name"] == "测试任务"
        assert d["agent_id"] == "agent-1"
        assert d["input"] == {"key": "value"}
        assert d["status"] == "pending"
        assert d["result"] is None
        assert d["error"] is None
        assert "created_at" in d
        assert "updated_at" in d

    def test_task_from_dict_round_trip(self):
        """from_dict 反序列化后字段一致。"""
        task = A2ATask(task_id="task-2", name="往返", agent_id="agent-2")
        task.status = "completed"
        task.result = {"output": "done"}
        d = task.to_dict()

        restored = A2ATask.from_dict(d)
        assert restored.id == "task-2"
        assert restored.name == "往返"
        assert restored.agent_id == "agent-2"
        assert restored.status == "completed"
        assert restored.result == {"output": "done"}

    def test_task_default_status_is_pending(self):
        """新建任务默认 status=pending。"""
        task = A2ATask(task_id="task-3", name="默认", agent_id="agent-3")
        assert task.status == "pending"
        assert task.input == {}

    def test_task_with_none_input_defaults_to_empty(self):
        """input_data=None 时 input 默认为空字典。"""
        task = A2ATask(task_id="task-4", name="空输入", agent_id="agent-4", input_data=None)
        assert task.input == {}


class TestA2AAgentSerialization:
    """A2AAgent to_dict / from_dict 往返。"""

    def test_agent_to_dict_contains_all_fields(self):
        """to_dict 包含所有字段。"""
        agent = A2AAgent(
            agent_id="agent-1",
            name="测试Agent",
            capabilities=["search", "code"],
            endpoint="http://localhost:8001",
            description="测试用",
        )
        d = agent.to_dict()
        assert d["id"] == "agent-1"
        assert d["name"] == "测试Agent"
        assert d["capabilities"] == ["search", "code"]
        assert d["endpoint"] == "http://localhost:8001"
        assert d["description"] == "测试用"

    def test_agent_from_dict_round_trip(self):
        """from_dict 反序列化后字段一致。"""
        agent = A2AAgent(agent_id="agent-2", name="往返", capabilities=["write"])
        d = agent.to_dict()
        restored = A2AAgent.from_dict(d)
        assert restored.id == "agent-2"
        assert restored.name == "往返"
        assert restored.capabilities == ["write"]

    def test_agent_default_capabilities_is_empty(self):
        """capabilities=None 时默认空列表。"""
        agent = A2AAgent(agent_id="agent-3", name="默认")
        assert agent.capabilities == []
        assert agent.endpoint == ""
        assert agent.description == ""


class TestA2AServerMemoryMode:
    """A2AServer 纯内存模式(无 Redis)。

    register_agent / send_task 内部调用 asyncio.create_task,需在事件循环中执行。
    """

    @pytest.mark.asyncio
    async def test_register_agent_stores_in_memory(self):
        """register_agent 后 agent 存入内存。"""
        server = A2AServer()
        agent = A2AAgent(agent_id="a1", name="Agent1")
        saved = server.register_agent(agent)
        assert saved.id == "a1"
        assert server.get_agent("a1") is not None
        assert server.get_agent("a1").name == "Agent1"

    @pytest.mark.asyncio
    async def test_list_agents_returns_all(self):
        """list_agents 返回所有已注册 agent。"""
        server = A2AServer()
        server.register_agent(A2AAgent(agent_id="a1", name="A1"))
        server.register_agent(A2AAgent(agent_id="a2", name="A2"))
        agents = server.list_agents()
        assert len(agents) == 2
        ids = {a.id for a in agents}
        assert ids == {"a1", "a2"}

    def test_get_agent_returns_none_for_unknown(self):
        """get_agent 查不存在的 id 返回 None。"""
        server = A2AServer()
        assert server.get_agent("nonexistent") is None

    @pytest.mark.asyncio
    async def test_send_task_creates_pending_task(self):
        """send_task 返回 pending 状态的任务。"""
        server = A2AServer()
        task = server.send_task(name="测试", agent_id="a1", input_data={"goal": "hello"})
        assert task.status == "pending"
        assert task.name == "测试"
        assert task.agent_id == "a1"
        assert task.input == {"goal": "hello"}
        assert task.id.startswith("task-")

    @pytest.mark.asyncio
    async def test_send_task_generates_unique_ids(self):
        """多次 send_task 生成不同的 task_id(uuid4)。"""
        server = A2AServer()
        t1 = server.send_task(name="t1", agent_id="a1")
        t2 = server.send_task(name="t2", agent_id="a1")
        assert t1.id != t2.id

    @pytest.mark.asyncio
    async def test_list_tasks_returns_cached_tasks(self):
        """list_tasks 返回内存缓存中的任务。"""
        server = A2AServer()
        server.send_task(name="t1", agent_id="a1")
        tasks = server.list_tasks()
        assert len(tasks) >= 1

    @pytest.mark.asyncio
    async def test_get_task_returns_none_for_unknown(self):
        """get_task 查不存在的 id 返回 None。"""
        server = A2AServer()
        result = await server.get_task("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_task_status_returns_none_for_unknown(self):
        """get_task_status 查不存在的 id 返回 None。"""
        server = A2AServer()
        result = await server.get_task_status("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_task_result_returns_none_for_unknown(self):
        """get_task_result 查不存在的 id 返回 None。"""
        server = A2AServer()
        result = await server.get_task_result("nonexistent")
        assert result is None
