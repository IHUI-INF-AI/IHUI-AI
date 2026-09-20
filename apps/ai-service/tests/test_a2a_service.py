# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""A2A 服务单元测试。

测试 A2ATask / A2AAgent 序列化反序列化、A2AServer 注册/查询/任务创建,
以及 O11 收权新增的任务归属(owner_id)与裁决函数 can_access_task。
不依赖 Redis(降级纯内存模式 + 用例内 fake redis,绝不连生产 8811)。
"""

import json

import pytest

from app.services.a2a_service import (
    ADMIN_ROLE,
    A2AAgent,
    A2AServer,
    A2ATask,
    can_access_task,
)
from app.services.capability_gate import ALL_SCOPES, Principal

TASK_RESPONSE_KEYS = {
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


def _principal(
    sub: str | None = "user-1",
    *,
    role: int = 0,
    kind: str = "jwt",
) -> Principal:
    return Principal(kind=kind, sub=sub, role=role, scopes=frozenset({ALL_SCOPES}))


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


class TestA2ATaskOwnership:
    """O11 收权:任务归属 owner_id 的持久化与响应形状冻结。"""

    def test_to_dict_shape_is_frozen(self):
        """向后兼容硬约束:to_dict 键集合 = 收权前的 9 个字段,一个不多一个不少。"""
        task = A2ATask(task_id="t-1", name="n", agent_id="a", owner_id="user-1")
        assert set(task.to_dict()) == TASK_RESPONSE_KEYS
        assert "owner_id" not in task.to_dict()

    def test_storage_dict_adds_only_owner_id(self):
        """to_storage_dict = 响应形状 + owner_id(唯一允许的持久化扩展)。"""
        task = A2ATask(task_id="t-1", name="n", agent_id="a", owner_id="user-1")
        storage = task.to_storage_dict()
        assert set(storage) == TASK_RESPONSE_KEYS | {"owner_id"}
        assert storage["owner_id"] == "user-1"
        # 其余字段逐值一致(不得因持久化通道改动语义)
        for key in TASK_RESPONSE_KEYS:
            assert storage[key] == task.to_dict()[key]

    def test_owner_id_round_trip(self):
        """owner_id 经存储字典往返后保留(Redis 重启恢复不丢归属)。"""
        task = A2ATask(task_id="t-2", name="n", agent_id="a", owner_id="user-2")
        restored = A2ATask.from_dict(json.loads(json.dumps(task.to_storage_dict())))
        assert restored.owner_id == "user-2"

    def test_legacy_row_without_owner_id(self):
        """收权前的历史 Redis 行(无 owner_id 键)反序列化为无主任务。"""
        legacy = {
            "id": "t-3",
            "name": "n",
            "agent_id": "a",
            "input": {},
            "status": "completed",
            "result": None,
            "error": None,
            "created_at": "2026-01-01T00:00:00+00:00",
            "updated_at": "2026-01-01T00:00:00+00:00",
        }
        restored = A2ATask.from_dict(legacy)
        assert restored.owner_id is None
        assert restored.status == "completed"

    def test_dirty_owner_id_degrades_to_none(self):
        """owner_id 是脏数据(非字符串)时按无主处理,不抛异常。"""
        task = A2ATask.from_dict({**A2ATask("t-4", "n", "a").to_storage_dict(), "owner_id": 123})
        assert task.owner_id is None

    @pytest.mark.asyncio
    async def test_persist_task_writes_owner_to_storage(self):
        """_persist_task 落盘的是 to_storage_dict(含归属),响应字典仍不含归属。"""

        class FakeRedis:
            def __init__(self) -> None:
                self.store: dict[str, str] = {}

            async def set(self, key: str, value: str, ex: int | None = None) -> None:
                self.store[key] = value

            async def zadd(self, key: str, mapping: dict[str, float]) -> None:
                self.store.setdefault(key, json.dumps(sorted(mapping)))

        fake = FakeRedis()
        server = A2AServer()
        server._redis = fake
        server._redis_available = True
        task = A2ATask("t-5", "n", "a", owner_id="user-5")
        await server._persist_task(task)

        payload = json.loads(fake.store[A2AServer.REDIS_TASK_KEY_PREFIX + "t-5"])
        assert payload["owner_id"] == "user-5"
        assert set(payload) == TASK_RESPONSE_KEYS | {"owner_id"}


class TestA2ATaskViews:
    """状态/结果视图键集合冻结(旧端点响应形状回归)。"""

    def test_status_dict_keys(self):
        task = A2ATask("t-1", "n", "a")
        assert set(task.status_dict()) == {
            "id",
            "status",
            "agent_id",
            "created_at",
            "updated_at",
        }

    def test_result_dict_keys(self):
        task = A2ATask("t-1", "n", "a")
        assert set(task.result_dict()) == {"id", "status", "result", "error"}

    @pytest.mark.asyncio
    async def test_service_views_match_task_helpers(self):
        """get_task_status / get_task_result 复用视图方法(两处形状不可能漂移)。"""
        server = A2AServer()
        server._tasks["t-1"] = A2ATask("t-1", "n", "a", owner_id="user-1")
        assert await server.get_task_status("t-1") == server._tasks["t-1"].status_dict()
        assert await server.get_task_result("t-1") == server._tasks["t-1"].result_dict()


class TestCanAccessTask:
    """归属裁决矩阵(纯函数,无 I/O)。"""

    def test_owner_can_read(self):
        assert can_access_task(A2ATask("t", "n", "a", owner_id="u1"), _principal("u1")) is True

    def test_other_user_is_denied(self):
        assert can_access_task(A2ATask("t", "n", "a", owner_id="u1"), _principal("u2")) is False

    def test_substring_collision_is_denied(self):
        """归属比较用严格相等,不得被 'u1' 前缀命中 'u11'。"""
        assert can_access_task(A2ATask("t", "n", "a", owner_id="u11"), _principal("u1")) is False

    def test_admin_role_can_read_any(self):
        task = A2ATask("t", "n", "a", owner_id="u1")
        assert can_access_task(task, _principal("admin", role=ADMIN_ROLE)) is True

    def test_unowned_task_rejects_identified_principal(self):
        """无主任务 + 带身份调用方 → 拒绝(fail-closed)。"""
        assert can_access_task(A2ATask("t", "n", "a"), _principal("u1")) is False

    def test_unowned_task_allows_dev_anonymous(self):
        """无主任务 + 本机开发回退主体(sub=None)→ 放行(本地零摩擦)。"""
        task = A2ATask("t", "n", "a", owner_id=None)
        assert can_access_task(task, _principal(None, kind="dev-anonymous")) is True

    def test_owned_task_rejects_dev_anonymous(self):
        """他人有主任务 + 无身份主体 → 拒绝。"""
        task = A2ATask("t", "n", "a", owner_id="u1")
        assert can_access_task(task, _principal(None, kind="dev-anonymous")) is False

    def test_none_principal_is_denied(self):
        assert can_access_task(A2ATask("t", "n", "a"), None) is False

    def test_internal_machine_principal_uses_sub(self):
        task = A2ATask("t", "n", "a", owner_id="svc-a")
        assert can_access_task(task, _principal("svc-a", kind="internal")) is True
        assert can_access_task(task, _principal("svc-b", kind="internal")) is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
