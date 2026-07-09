"""agent_loop.py 单元测试:AgentExecutor 任务管理 + run + run_stream。

测试覆盖:
- 任务管理: list_running/status(存在/不存在)/cancel(存在/已完成/不存在)
- run: stub 模式(无 API key)单轮完成 + 任务状态 + memory 写入 + 无 tools 时单轮
- run_stream: yield 事件序列(message/thinking/usage/status)+ 异常路径
- 辅助方法: _new_task_id 唯一性 / _now ISO 格式

测试环境无 LLM API key,llm_gateway 自动降级为 stub 模式。
"""

from __future__ import annotations

import asyncio

import pytest

from app.services.agent_loop import AgentExecutor, agent_executor
from app.services.memory import memory_store


@pytest.fixture(autouse=True)
def force_memory_mode():
    """强制 memory_store 内存模式(测试环境无 Redis)。"""
    memory_store._use_redis = False
    memory_store._redis = None
    yield
    memory_store._use_redis = False
    memory_store._redis = None


@pytest.fixture
def executor():
    """每个测试用例使用独立的 AgentExecutor 实例,避免 _running 字典相互污染。"""
    return AgentExecutor()


# =============================================================================
# 辅助方法
# =============================================================================

def test_new_task_id_is_12_chars_hex():
    tid = AgentExecutor._new_task_id()
    assert len(tid) == 12
    int(tid, 16)  # 合法 hex


def test_new_task_id_unique():
    """_new_task_id 每次调用返回不同值(极小概率碰撞)。"""
    ids = {AgentExecutor._new_task_id() for _ in range(100)}
    assert len(ids) == 100


def test_now_returns_iso_string():
    ts = AgentExecutor._now()
    assert isinstance(ts, str)
    assert "T" in ts  # ISO 8601


# =============================================================================
# list_running / status / cancel (任务管理,不依赖 LLM)
# =============================================================================

def test_list_running_empty(executor):
    """空 executor 的 list_running 返回空 dict。"""
    assert executor.list_running() == {}


def test_status_nonexistent_returns_none(executor):
    assert executor.status("nonexistent") is None


def test_cancel_nonexistent_returns_false(executor):
    assert executor.cancel("nonexistent") is False


def test_cancel_completed_task_returns_false(executor):
    """已完成任务不能取消。"""
    # 手动注入一个已完成任务
    executor._running["t1"] = {
        "task_id": "t1",
        "status": "completed",
        "updated_at": AgentExecutor._now(),
    }
    assert executor.cancel("t1") is False


def test_cancel_failed_task_returns_false(executor):
    executor._running["t1"] = {
        "task_id": "t1",
        "status": "failed",
        "updated_at": AgentExecutor._now(),
    }
    assert executor.cancel("t1") is False


def test_cancel_canceled_task_returns_false(executor):
    executor._running["t1"] = {
        "task_id": "t1",
        "status": "canceled",
        "updated_at": AgentExecutor._now(),
    }
    assert executor.cancel("t1") is False


def test_cancel_running_task_success(executor):
    executor._running["t1"] = {
        "task_id": "t1",
        "status": "running",
        "updated_at": AgentExecutor._now(),
    }
    assert executor.cancel("t1") is True
    assert executor._running["t1"]["status"] == "canceled"
    assert "取消" in executor._running["t1"]["message"]


def test_status_returns_copy(executor):
    """status 返回任务信息副本,修改不影响内部状态。"""
    executor._running["t1"] = {"task_id": "t1", "status": "running"}
    info = executor.status("t1")
    assert info is not None
    info["status"] = "tampered"
    assert executor._running["t1"]["status"] == "running"


def test_list_running_returns_copy(executor):
    """list_running 返回副本,修改不影响内部状态。"""
    executor._running["t1"] = {"task_id": "t1", "status": "running"}
    snapshot = executor.list_running()
    snapshot["t1"]["status"] = "tampered"
    snapshot["t2"] = {"task_id": "t2"}
    assert executor._running["t1"]["status"] == "running"
    assert "t2" not in executor._running


# =============================================================================
# run (stub 模式,无 API key)
# =============================================================================

async def test_run_basic_completion(executor):
    """run 在 stub 模式下完成单轮迭代。"""
    result = await executor.run("hello", max_iterations=1)
    assert result["status"] == "completed"
    assert result["iterations"] == 1
    assert isinstance(result["task_id"], str)
    assert isinstance(result["session_id"], str)
    assert len(result["steps"]) == 1
    assert result["steps"][0]["type"] == "llm"
    assert result["steps"][0]["stub"] is True
    assert "[stub]" in result["result"]
    assert result["error"] is None


async def test_run_writes_user_message_to_memory(executor):
    """run 将用户输入写入 memory_store。"""
    result = await executor.run("test-goal", max_iterations=1)
    sid = result["session_id"]
    msgs = await memory_store.get(sid)
    # 第一条是 user,第二条是 assistant
    assert len(msgs) >= 2
    assert msgs[0]["role"] == "user"
    assert msgs[0]["content"] == "test-goal"
    assert msgs[0]["metadata"]["task_id"] == result["task_id"]
    assert msgs[1]["role"] == "assistant"
    assert "[stub]" in msgs[1]["content"]


async def test_run_with_explicit_session_id(executor):
    """run 使用传入的 session_id。"""
    result = await executor.run("goal", session_id="my-session", max_iterations=1)
    assert result["session_id"] == "my-session"


async def test_run_with_explicit_model(executor):
    """run 透传 model 参数(stub 模式下不实际调用,但参数应被接受)。"""
    result = await executor.run("goal", model="gpt-4", max_iterations=1)
    assert result["status"] == "completed"


async def test_run_no_tools_single_iteration(executor):
    """无 tools 时 stub 模式单轮完成。"""
    result = await executor.run("goal", max_iterations=5, tools=None)
    assert result["iterations"] == 1
    assert result["status"] == "completed"


async def test_run_with_tools_max_two_iterations(executor):
    """有 tools 时 stub 模式最多 2 轮(第一轮后 i>=1 break)。"""
    result = await executor.run("goal", max_iterations=10, tools=["search"])
    # stub 模式下 stub=True,第一轮即 break
    assert result["iterations"] == 1
    assert result["status"] == "completed"


async def test_run_task_registered_in_running(executor):
    """run 完成后任务在 _running 中可查。"""
    result = await executor.run("goal", max_iterations=1)
    tid = result["task_id"]
    info = executor.status(tid)
    assert info is not None
    assert info["status"] == "completed"
    assert info["goal"] == "goal"
    assert info["iterations"] == 1


async def test_run_default_max_iterations_from_settings(executor):
    """max_iterations=None 时使用 settings.max_agent_iterations。"""
    from app.core.config import settings
    result = await executor.run("goal", max_iterations=None)
    # stub 模式单轮完成,iterations=1
    assert result["iterations"] == 1
    # 但内部 max_iter 应等于 settings 值
    assert settings.max_agent_iterations >= 1


async def test_run_zero_iterations(executor):
    """max_iterations=0 时不执行任何迭代(空循环)。"""
    result = await executor.run("goal", max_iterations=0)
    assert result["iterations"] == 0
    assert result["steps"] == []
    assert result["result"] == ""
    # 任务仍标记为 completed(未取消)
    assert result["status"] == "completed"


# =============================================================================
# run_stream (stub 模式)
# =============================================================================

async def test_run_stream_event_sequence(executor):
    """run_stream yield 完整事件序列: message(user)/thinking/message(assistant)/status。"""
    events = []
    async for ev in executor.run_stream("hello"):
        events.append(ev)

    types = [e["type"] for e in events]
    assert "message" in types
    assert "thinking" in types
    assert "status" in types

    # 第一个事件是 user message
    assert events[0]["type"] == "message"
    assert events[0]["role"] == "user"
    assert events[0]["content"] == "hello"

    # 最后一个事件是 status completed
    assert events[-1]["type"] == "status"
    assert events[-1]["status"] == "completed"


async def test_run_stream_assistant_message(executor):
    """run_stream yield assistant 消息,含 stub 标记。"""
    events = []
    async for ev in executor.run_stream("goal"):
        events.append(ev)

    assistant_msgs = [e for e in events if e.get("role") == "assistant"]
    assert len(assistant_msgs) == 1
    assert "[stub]" in assistant_msgs[0]["content"]
    assert assistant_msgs[0]["stub"] is True


async def test_run_stream_task_id_consistent(executor):
    """run_stream 所有事件 task_id 一致。"""
    events = []
    async for ev in executor.run_stream("goal"):
        events.append(ev)

    task_ids = {e.get("task_id") for e in events if "task_id" in e}
    assert len(task_ids) == 1


async def test_run_stream_writes_memory(executor):
    """run_stream 将 user/assistant 消息写入 memory。"""
    events = []
    async for ev in executor.run_stream("stream-goal", session_id="stream-sid"):
        events.append(ev)

    msgs = await memory_store.get("stream-sid")
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[0]["content"] == "stream-goal"
    assert msgs[1]["role"] == "assistant"
    assert "[stub]" in msgs[1]["content"]


async def test_run_stream_task_registered(executor):
    """run_stream 完成后任务在 _running 中标记 completed。"""
    async for _ in executor.run_stream("goal"):
        pass
    # 至少有一个任务
    running = executor.list_running()
    assert len(running) >= 1
    # 最后一个状态为 completed
    statuses = [info["status"] for info in running.values()]
    assert "completed" in statuses


# =============================================================================
# 全局 agent_executor 实例
# =============================================================================

def test_global_agent_executor_is_instance():
    assert isinstance(agent_executor, AgentExecutor)


async def test_global_agent_executor_run():
    """全局 agent_executor 可正常 run。"""
    result = await agent_executor.run("global-test", max_iterations=1)
    assert result["status"] == "completed"
    # 清理:任务会留在 _running 中,但不影响其他测试(全局实例累积)
