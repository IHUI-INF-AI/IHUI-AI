"""dispatch_subagent 工具双模式测试。

覆盖:
- 并行模式(tasks 数组)→ invoke_parallel 真实并行派发,返回 parallel 结构
- 单 agent 模式(name+task)兼容 → invoke,返回 single 结构
- 空 tasks 数组 → EMPTY_TASKS
- agent 不存在(单模式 invoke 返回 failed / 并行模式部分失败)
- 部分失败(parallel 结果透传 succeeded/failed 计数)
- DUAL_MODE(name+task+tasks 同时传 → 互斥报错)
- 缺参数(无 name/task 且无 tasks → MISSING_PARAMS)
- tasks 元素缺字段 → INVALID_PARAMS
- max_concurrency 透传

通过 monkeypatch mcp_server._get_orchestrator 返回 _FakeOrchestrator,
不依赖真实 agent 注册表 / LLM。
"""

from __future__ import annotations

from app.services.agent_orchestrator import AgentStepResult
from app.services.mcp_server import _tool_dispatch_subagent


class _FakeOrchestrator:
    """模拟 AgentOrchestrator,记录 invoke / invoke_parallel 调用。

    - invoke_impl: 可选 (agent_name, user_input, session_id) -> AgentStepResult
    - parallel_impl: 可选 (tasks, max_concurrency) -> dict
    未配置时使用默认行为(全部 completed)。
    """

    def __init__(self, invoke_impl=None, parallel_impl=None):
        self.invoke_calls: list[dict] = []
        self.parallel_calls: list[dict] = []
        self._invoke_impl = invoke_impl
        self._parallel_impl = parallel_impl

    async def invoke(self, agent_name, user_input, session_id=None, model_override=None):
        self.invoke_calls.append(
            {"agent_name": agent_name, "user_input": user_input, "session_id": session_id}
        )
        if self._invoke_impl is not None:
            return self._invoke_impl(agent_name, user_input, session_id)
        return AgentStepResult(
            agent_name=agent_name, input=user_input, output=f"ok-{agent_name}",
            status="completed", duration_ms=1.0,
        )

    async def invoke_parallel(self, tasks, max_concurrency=5):
        self.parallel_calls.append({"tasks": tasks, "max_concurrency": max_concurrency})
        if self._parallel_impl is not None:
            return self._parallel_impl(tasks, max_concurrency)
        results = [
            {"name": t["name"], "task": t["task"], "status": "completed",
             "output": f"done-{t['name']}", "error": None, "duration_ms": 1.0}
            for t in tasks
        ]
        return {
            "ok": True, "total": len(results), "succeeded": len(results),
            "failed": 0, "results": results,
            "message": f"并行派发完成:{len(results)}/{len(results)} 成功",
        }


# =============================================================================
# 并行模式
# =============================================================================

async def test_parallel_mode_success(monkeypatch):
    """tasks 数组 → 调 invoke_parallel,返回 parallel 结构(3/3 成功)。"""
    fake = _FakeOrchestrator()
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)

    out = await _tool_dispatch_subagent({
        "tasks": [
            {"name": "coder", "task": "实现 A"},
            {"name": "researcher", "task": "调研 B"},
            {"name": "debugger", "task": "调试 C"},
        ],
    })

    assert out["tool"] == "dispatch_subagent"
    assert out["mode"] == "parallel"
    assert out["ok"] is True
    assert out["total"] == 3
    assert out["succeeded"] == 3
    assert out["failed"] == 0
    assert len(out["results"]) == 3
    assert "成功" in out["message"]
    # 验证 invoke_parallel 被调用(非 invoke)
    assert len(fake.parallel_calls) == 1
    assert fake.parallel_calls[0]["max_concurrency"] == 5  # 默认值透传
    assert len(fake.invoke_calls) == 0


async def test_parallel_mode_max_concurrency_passthrough(monkeypatch):
    """max_concurrency 参数透传到 invoke_parallel。"""
    fake = _FakeOrchestrator()
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)

    await _tool_dispatch_subagent({
        "tasks": [{"name": "coder", "task": "A"}],
        "max_concurrency": 2,
    })

    assert fake.parallel_calls[0]["max_concurrency"] == 2


async def test_parallel_mode_partial_failure(monkeypatch):
    """并行模式部分失败:invoke_parallel 返回 2/3 成功,wrapper 透传计数。"""
    def partial_impl(tasks, max_concurrency):
        results = []
        for t in tasks:
            if t["name"] == "debugger":
                results.append({"name": "debugger", "task": t["task"], "status": "failed",
                                "output": "", "error": "模拟调试失败", "duration_ms": 1.0})
            else:
                results.append({"name": t["name"], "task": t["task"], "status": "completed",
                                "output": "ok", "error": None, "duration_ms": 1.0})
        return {"ok": True, "total": 3, "succeeded": 2, "failed": 1,
                "results": results, "message": "并行派发完成:2/3 成功"}

    fake = _FakeOrchestrator(parallel_impl=partial_impl)
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)

    out = await _tool_dispatch_subagent({
        "tasks": [
            {"name": "coder", "task": "A"},
            {"name": "debugger", "task": "B"},
            {"name": "researcher", "task": "C"},
        ],
    })

    assert out["mode"] == "parallel"
    assert out["ok"] is True
    assert out["total"] == 3
    assert out["succeeded"] == 2
    assert out["failed"] == 1
    failed = [r for r in out["results"] if r["status"] == "failed"]
    assert len(failed) == 1
    assert failed[0]["name"] == "debugger"


async def test_parallel_mode_agent_not_exists(monkeypatch):
    """并行模式含未知 agent → invoke_parallel 返回该 task failed,wrapper 透传。"""
    def impl(tasks, max_concurrency):
        results = [
            {"name": "coder", "task": "A", "status": "completed", "output": "ok",
             "error": None, "duration_ms": 1.0},
            {"name": "nonexistent-xyz", "task": "B", "status": "failed", "output": "",
             "error": "Agent 不存在: nonexistent-xyz", "duration_ms": 1.0},
        ]
        return {"ok": True, "total": 2, "succeeded": 1, "failed": 1,
                "results": results, "message": "并行派发完成:1/2 成功"}

    fake = _FakeOrchestrator(parallel_impl=impl)
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)

    out = await _tool_dispatch_subagent({
        "tasks": [
            {"name": "coder", "task": "A"},
            {"name": "nonexistent-xyz", "task": "B"},
        ],
    })

    assert out["succeeded"] == 1
    assert out["failed"] == 1
    unknown = [r for r in out["results"] if r["name"] == "nonexistent-xyz"][0]
    assert unknown["status"] == "failed"
    assert "不存在" in unknown["error"]


# =============================================================================
# 单 agent 模式(兼容)
# =============================================================================

async def test_single_mode_success(monkeypatch):
    """name+task(无 tasks)→ 调 invoke,返回 single 结构。"""
    def invoke_impl(agent_name, user_input, session_id):
        return AgentStepResult(
            agent_name=agent_name, input=user_input, output="review done",
            status="completed", duration_ms=12.0, iterations=3,
        )

    fake = _FakeOrchestrator(invoke_impl=invoke_impl)
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)

    out = await _tool_dispatch_subagent({
        "name": "code-reviewer", "task": "审查 PR #1", "session_id": "s1",
    })

    assert out["tool"] == "dispatch_subagent"
    assert out["mode"] == "single"
    assert out["ok"] is True
    assert out["agent"] == "code-reviewer"
    assert out["status"] == "completed"
    assert out["output"] == "review done"
    assert out["iterations"] == 3
    assert len(fake.invoke_calls) == 1
    assert fake.invoke_calls[0]["session_id"] == "s1"
    assert len(fake.parallel_calls) == 0


async def test_single_mode_unknown_agent(monkeypatch):
    """单 agent 模式未知 agent → invoke 返回 failed,ok=False。"""
    def invoke_impl(agent_name, user_input, session_id):
        return AgentStepResult(
            agent_name=agent_name, input=user_input, output="",
            status="failed", duration_ms=0.5, error=f"Agent 不存在: {agent_name}",
        )

    fake = _FakeOrchestrator(invoke_impl=invoke_impl)
    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: fake)

    out = await _tool_dispatch_subagent({"name": "ghost", "task": "x"})

    assert out["mode"] == "single"
    assert out["ok"] is False
    assert out["status"] == "failed"
    assert "不存在" in out["error"]


# =============================================================================
# 错误分支
# =============================================================================

async def test_dual_mode_rejected():
    """同时传 name+task 与 tasks → DUAL_MODE。"""
    out = await _tool_dispatch_subagent({
        "name": "coder", "task": "A",
        "tasks": [{"name": "coder", "task": "A"}],
    })
    assert out["ok"] is False
    assert out["errorCode"] == "DUAL_MODE"


async def test_empty_tasks():
    """tasks=[] → EMPTY_TASKS。"""
    out = await _tool_dispatch_subagent({"tasks": []})
    assert out["ok"] is False
    assert out["errorCode"] == "EMPTY_TASKS"


async def test_missing_params_no_name_no_task():
    """既无 name/task 又无 tasks → MISSING_PARAMS。"""
    out = await _tool_dispatch_subagent({})
    assert out["ok"] is False
    assert out["errorCode"] == "MISSING_PARAMS"


async def test_missing_params_only_name():
    """只传 name 缺 task(无 tasks)→ MISSING_PARAMS。"""
    out = await _tool_dispatch_subagent({"name": "coder"})
    assert out["ok"] is False
    assert out["errorCode"] == "MISSING_PARAMS"


async def test_tasks_invalid_element():
    """tasks 元素缺 task 字段 → INVALID_PARAMS。"""
    out = await _tool_dispatch_subagent({
        "tasks": [{"name": "coder"}, {"name": "x", "task": "y"}],
    })
    assert out["ok"] is False
    assert out["errorCode"] == "INVALID_PARAMS"
    assert "tasks[0]" in out["error"]


async def test_tasks_not_list():
    """tasks 不是数组 → INVALID_PARAMS。"""
    out = await _tool_dispatch_subagent({"tasks": "not-a-list"})
    assert out["ok"] is False
    assert out["errorCode"] == "INVALID_PARAMS"


async def test_parallel_mode_exception(monkeypatch):
    """invoke_parallel 抛异常 → SUBAGENT_FAILED。"""
    class _Boom(_FakeOrchestrator):
        async def invoke_parallel(self, tasks, max_concurrency=5):
            raise RuntimeError("orchestrator 崩溃")

    monkeypatch.setattr("app.services.mcp_server._get_orchestrator", lambda: _Boom())
    out = await _tool_dispatch_subagent({"tasks": [{"name": "coder", "task": "A"}]})

    assert out["ok"] is False
    assert out["mode"] == "parallel"
    assert out["errorCode"] == "SUBAGENT_FAILED"
    assert "崩溃" in out["error"]
