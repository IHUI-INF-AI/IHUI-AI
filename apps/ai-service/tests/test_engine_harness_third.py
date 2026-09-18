# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Harness 细粒度能力(2026-09-18 第三批):榨干 Codex harness 剩余可学面的单测。

覆盖:
- request_permissions 内置工具(对标 RequestPermissionsTool:批准/拒绝/非法参/超时)
- thread.enqueue 消息入队 + 自动续跑(对标 Steer/ThreadQueueChanged)
- thread.goal 持久目标(对标 Goals:设置/清除/校验 + system 注入)
- thread.review 审查模式(对标 review:派生审查子代理)
- tokenBudget 预算硬停(对标 TokenBudget/RolloutBudget:BUDGET_EXHAUSTED)
- turn.diff 回合级工作区 diff(对标 TurnDiff)
- tool.retry 工具重试事件 + model.reroute 模型改道事件(对标 ModelReroute)
"""

import asyncio
import subprocess
from typing import Any

import pytest

from app.services.agent_engine import (
    BUDGET_EXHAUSTED,
    INVALID_PARAMS,
    AgentEngine,
)
from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition


# =============================================================================
# 夹具(与 test_engine_harness_fine 同款模式,自包含)
# =============================================================================


class _FakeLoop:
    def __init__(self, on_run: Any = None) -> None:
        self.spec: dict[str, Any] = {}
        self._on_run = on_run

    async def run(self, messages: list[dict[str, Any]]) -> Any:
        if self._on_run is not None:
            await self._on_run(self.spec, messages)
        return _SimpleResult()

    async def resume_from_checkpoint(self, checkpoint_id: str) -> Any:
        return _SimpleResult()

    async def interrupt(self, mode: str = "cancel") -> Any:
        return None


class _SimpleResult:
    success = True
    stop_reason = "end_turn"
    final_response = "done"
    iterations: list[Any] = []
    total_duration_ms = 1.0
    total_tokens_used = 123
    checkpoint_id = None
    error = None
    budget = None
    compaction_events: list[Any] = []


def _engine(store: Any = None, on_run: Any = None, **kwargs: Any):
    loops: list[_FakeLoop] = []

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop(on_run)
        loop.spec = spec
        loops.append(loop)
        return loop

    if store is not None:
        kwargs["store"] = store
    return AgentEngine(loop_factory=factory, **kwargs), loops


async def _rpc(engine: AgentEngine, method: str, params: dict[str, Any], req_id: int = 1):
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
    )
    assert response is not None and "error" not in response, response
    return response["result"]


@pytest.fixture(autouse=True)
def _mock_hook_engine(monkeypatch):
    """替换 agent_loop_v2 与 llm_gateway 的 hook_engine(记录待断言)。"""
    emitted: list[dict] = []

    class FakeHookEngine:
        async def emit(self, event, context):
            emitted.append({"event": event, **context})
            return []

    monkeypatch.setattr("app.services.agent_loop_v2.hook_engine", FakeHookEngine())
    monkeypatch.setattr("app.services.agent_loop_v2._approval_registry", {})
    monkeypatch.setattr("app.services.hook_engine.hook_engine", FakeHookEngine())
    yield {"emitted": emitted}


# =============================================================================
# request_permissions 内置工具(对标 RequestPermissionsTool)
# =============================================================================


def _find_builtin(engine: AgentEngine, thread: Any, name: str) -> Any:
    for definition in engine._builtin_tool_definitions(thread):
        if getattr(definition, "name", "") == name:
            return definition
    raise AssertionError(f"内置工具未注入: {name}")


@pytest.mark.asyncio
async def test_request_permissions_grant_and_deny_flow():
    """合法请求发 approval/request(kind=permissions),approval.respond 结算。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    requests: list[dict[str, Any]] = []

    async def _emit(message: dict[str, Any]) -> None:
        if message.get("method") == "approval/request":
            requests.append(message["params"])

    thread.emit = _emit
    tool = _find_builtin(engine, thread, "request_permissions")

    # 批准流
    task = asyncio.create_task(
        tool.executor(
            {"permissions": ["network", "workspace_write"], "reason": "需要联网拉取依赖"}
        )
    )
    for _ in range(100):
        if requests:
            break
        await asyncio.sleep(0.01)
    assert len(requests) == 1
    assert requests[0]["kind"] == "permissions"
    assert requests[0]["permissions"] == ["network", "workspace_write"]
    assert requests[0]["timeoutMs"] >= 1000
    await _rpc(
        engine,
        "approval.respond",
        {"approvalId": requests[0]["requestId"], "decision": "approve"},
        req_id=2,
    )
    granted = await task
    assert granted == {
        "granted": True,
        "permissions": ["network", "workspace_write"],
        "decision": "approve",
    }

    # 拒绝流
    task2 = asyncio.create_task(
        tool.executor({"permissions": ["elevated_exec"], "reason": "需要提权"})
    )
    for _ in range(100):
        if len(requests) == 2:
            break
        await asyncio.sleep(0.01)
    await _rpc(
        engine,
        "approval.respond",
        {"approvalId": requests[1]["requestId"], "decision": "reject"},
        req_id=3,
    )
    denied = await task2
    assert denied["granted"] is False
    assert denied["decision"] == "reject"
    assert denied["permissions"] == []


@pytest.mark.asyncio
async def test_request_permissions_invalid_args_fail_closed():
    """非法权限范围 / 空 reason → 直接 granted=False,不发审批请求。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "request_permissions")

    bad_scope = await tool.executor({"permissions": ["root"], "reason": "r"})
    assert bad_scope["granted"] is False and "允许" in bad_scope["reason"]
    empty = await tool.executor({"permissions": [], "reason": "r"})
    assert empty["granted"] is False
    no_reason = await tool.executor({"permissions": ["network"]})
    assert no_reason["granted"] is False and "理由" in no_reason["reason"]
    assert engine._permission_requests == {}


@pytest.mark.asyncio
async def test_request_permissions_timeout_defaults_to_deny():
    """超时未决策 → 默认拒绝(对标 Codex fail-closed 审批语义)。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    thread.emit = None  # 无承载层:请求发出但无人应答
    tool = _find_builtin(engine, thread, "request_permissions")
    result = await tool.executor(
        {"permissions": ["network"], "reason": "r", "timeoutMs": 1000}
    )
    assert result["granted"] is False
    assert "超时" in result["reason"]
    assert engine._permission_requests == {}  # finally 清理


# =============================================================================
# thread.enqueue(对标 Steer/ThreadQueueChanged)+ 自动续跑
# =============================================================================


@pytest.mark.asyncio
async def test_thread_enqueue_idle_then_prompt_autodrains():
    """空闲入队 → prompt 依序自动续跑(队列消化 + thread.queue 事件)。"""
    engine, loops = _engine()
    notifications: list[dict[str, Any]] = []

    async def _emit(message: dict[str, Any]) -> None:
        if message.get("method") == "thread/event":
            notifications.append(message["params"])

    started = await _rpc(engine, "thread.start", {})
    tid = started["threadId"]

    enq1 = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 2, "method": "thread.enqueue",
         "params": {"threadId": tid, "input": "追加任务 A"}},
    )
    assert enq1["result"]["queued"] == 1 and enq1["result"]["mode"] == "idle"
    await engine.handle_message(
        {"jsonrpc": "2.0", "id": 3, "method": "thread.enqueue",
         "params": {"threadId": tid, "input": "追加任务 B"}},
    )

    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 4, "method": "thread.prompt",
         "params": {"threadId": tid, "input": "开始"}},
        _emit,
    )
    assert response is not None and "error" not in response
    # 主轮 + 2 条队列消息 = 3 次 loop.run
    assert len(loops) == 3
    thread = engine._threads[tid]
    assert thread.queue == []  # 队列清空
    events = [n["event"] for n in notifications]
    assert events.count("thread.queue") == 2  # enqueued + drained
    # 状态自省暴露 queued / tokenBudget / goal
    state = await _rpc(engine, "thread.state", {"threadId": tid}, req_id=5)
    assert state["queued"] == 0


@pytest.mark.asyncio
async def test_thread_prompt_running_rejects_concurrent_prompt():
    """running 中再 prompt → THREAD_BUSY;此时 enqueue 走 steer 模式不冲突。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    thread.status = "running"
    params = {"threadId": thread.thread_id}
    with pytest.raises(Exception, match="正在执行"):
        await engine._handle_thread_prompt({**params, "input": "hi"}, None)
    steer = await engine._handle_thread_enqueue({**params, "input": "转向"}, None)
    assert steer["mode"] == "steer"
    thread.status = "idle"


# =============================================================================
# thread.goal(对标 Goals)
# =============================================================================


@pytest.mark.asyncio
async def test_thread_goal_set_clear_validation_and_injection():
    """goal 设置→进 spec→loop 注入 system;null 清除;非法值拒绝。"""
    engine, loops = _engine()
    started = await _rpc(engine, "thread.start", {"goal": "  把测试跑绿  "})
    tid = started["threadId"]
    assert started["goal"] == "把测试跑绿"  # 去空白
    await _rpc(engine, "thread.prompt", {"threadId": tid, "input": "hi"}, req_id=2)
    assert loops[0].spec["goal"] == "把测试跑绿"

    # loop 注入:run 入口 system 追加 [线程目标]
    captured: dict[str, Any] = {}

    async def _llm(messages, tools):
        captured["system"] = messages[0]["content"] if messages else None
        return {"content": "ok", "tool_calls": None, "usage": None, "model": "m"}

    loop = AgentLoopV2(_llm, [], thread_goal="把测试跑绿")
    await loop.run([{"role": "user", "content": "hi"}])
    assert "[线程目标] 把测试跑绿" in captured["system"]

    # 清除(goal=None)
    cleared = await _rpc(engine, "thread.goal", {"threadId": tid, "goal": None}, req_id=3)
    assert cleared["goal"] is None
    assert engine._threads[tid].goal is None

    # 非法值
    for bad in ({}, 123, "   "):
        response = await engine.handle_message(
            {"jsonrpc": "2.0", "id": 4, "method": "thread.goal",
             "params": {"threadId": tid, "goal": bad}}
        )
        assert response is not None and response["error"]["code"] == INVALID_PARAMS, bad


# =============================================================================
# tokenBudget 预算硬停(对标 TokenBudget/RolloutBudget)
# =============================================================================


@pytest.mark.asyncio
async def test_token_budget_hard_stop_budget_exhausted():
    """tokenBudget=50:首轮用 123 token 后,下一轮 BUDGET_EXHAUSTED(-32007)。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {"tokenBudget": 50})
    tid = started["threadId"]
    assert started["tokenBudget"] == 50
    await _rpc(engine, "thread.prompt", {"threadId": tid, "input": "第一轮"}, req_id=2)
    thread = engine._threads[tid]
    assert thread.session_tokens_used == 123
    state = await _rpc(engine, "thread.state", {"threadId": tid}, req_id=3)
    assert state["sessionTokensUsed"] == 123 and state["tokenBudget"] == 50

    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 4, "method": "thread.prompt",
         "params": {"threadId": tid, "input": "第二轮"}}
    )
    assert response is not None
    assert response["error"]["code"] == BUDGET_EXHAUSTED
    assert "预算已耗尽" in response["error"]["message"]


@pytest.mark.asyncio
async def test_token_budget_invalid_value_rejected():
    """tokenBudget 非正整数 → INVALID_PARAMS。"""
    engine, _ = _engine()
    for bad in (0, -1, "50", True, 1.5):
        response = await engine.handle_message(
            {"jsonrpc": "2.0", "id": 1, "method": "thread.start",
             "params": {"tokenBudget": bad}}
        )
        assert response is not None and response["error"]["code"] == INVALID_PARAMS, bad


@pytest.mark.asyncio
async def test_initialize_capabilities_advertise_third_batch():
    """initialize capabilities 宣告 messageQueue/goals/review/tokenBudget。"""
    engine, _ = _engine()
    result = await _rpc(engine, "engine.initialize", {})
    caps = result["capabilities"]
    assert caps["messageQueue"] is True
    assert caps["goals"] is True
    assert caps["review"] is True
    assert caps["tokenBudget"] is True


# =============================================================================
# thread.review(对标 Codex review)
# =============================================================================


@pytest.mark.asyncio
async def test_thread_review_spawns_transcript_subagent_and_cleans_up():
    """thread.review:派生一次性审查子代理(携带记录),返回结论,跑完即弃。"""
    engine, loops = _engine()
    started = await _rpc(engine, "thread.start", {"model": "parent-model"})
    tid = started["threadId"]
    await _rpc(engine, "thread.prompt", {"threadId": tid, "input": "帮我实现功能"}, req_id=2)

    review = await _rpc(
        engine, "thread.review", {"threadId": tid, "focus": "安全与正确性"}, req_id=3
    )
    assert review["success"] is True
    assert review["verdict"] == "done"
    assert review["usage"]["totalTokens"] == 123
    # 审查线程即弃
    assert review["reviewThreadId"] not in engine._threads
    # 审查子代理继承父模型 + 审查提示词包含 focus 与对话记录
    sub_spec = loops[-1].spec
    assert sub_spec["model"] == "parent-model"
    # running 中拒绝
    thread = engine._threads[tid]
    thread.status = "running"
    with pytest.raises(Exception, match="正在执行"):
        await engine._handle_thread_review({"threadId": tid}, None)
    thread.status = "idle"


# =============================================================================
# turn.diff(对标 TurnDiff)
# =============================================================================


@pytest.mark.asyncio
async def test_turn_diff_emitted_for_new_dirty_files(tmp_path):
    """回合内新变脏的工作区文件 → turn.diff 事件(相对回合前的新增)。"""
    repo = tmp_path / "ws"
    repo.mkdir()
    subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
    (repo / "base.txt").write_text("base", encoding="utf-8")

    async def _on_run(spec: dict[str, Any], messages: list[dict[str, Any]]) -> None:
        workspace = spec.get("workspace")
        if workspace:
            (repo / "generated.py").write_text("print('hi')", encoding="utf-8")

    engine, _ = _engine(on_run=_on_run)
    notifications: list[dict[str, Any]] = []

    async def _emit(message: dict[str, Any]) -> None:
        if message.get("method") == "thread/event":
            notifications.append(message["params"])

    started = await _rpc(engine, "thread.start", {"workspace": str(repo)})
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 2, "method": "thread.prompt",
         "params": {"threadId": started["threadId"], "input": "hi"}},
        _emit,
    )
    assert response is not None and "error" not in response
    diffs = [n for n in notifications if n["event"] == "turn.diff"]
    assert len(diffs) == 1
    assert diffs[0]["payload"]["files"] == ["generated.py"]
    assert diffs[0]["payload"]["truncated"] is False


# =============================================================================
# tool.retry / model.reroute 事件
# =============================================================================


@pytest.mark.asyncio
async def test_tool_retry_event_emitted(_mock_hook_engine):
    """工具瞬时失败重试时发 tool.retry(含 attempt/backoff)。"""
    calls = {"n": 0}

    async def _flaky_tool(args: dict[str, Any]) -> dict[str, Any]:
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("HTTP 500 transient server error")
        return {"ok": True}

    llm_results = iter(
        [
            {"content": "", "tool_calls": [{"id": "t1", "name": "flaky", "args": {}}]},
            {"content": "ok", "tool_calls": None},
        ]
    )

    async def _llm(messages, tools):
        return next(llm_results)

    loop = AgentLoopV2(
        _llm,
        [ToolDefinition(name="flaky", description="", parameters={}, executor=_flaky_tool)],
        tool_retry_max=2,
        tool_retry_backoff=0.01,
    )
    result = await loop.run([{"role": "user", "content": "hi"}])
    assert result.final_response == "ok"
    assert calls["n"] == 2  # 失败一次后重试成功
    retry_events = [e for e in _mock_hook_engine["emitted"] if e["event"] == "tool.retry"]
    assert len(retry_events) == 1
    evt = retry_events[0]
    assert evt["tool"] == "flaky" and evt["attempt"] == 1 and evt["max_attempts"] == 2
    assert evt["backoff_seconds"] >= 0


@pytest.mark.asyncio
async def test_model_reroute_event_emitted_for_auto_routing(_mock_hook_engine):
    """auto 路由改道发 model.reroute(requested/resolved),失败不阻塞主链路。"""
    from app.core.llm_gateway import LLMGateway

    await LLMGateway._emit_model_reroute(None, "auto", "gpt-x")  # type: ignore[arg-type]
    events = [e for e in _mock_hook_engine["emitted"] if e["event"] == "model.reroute"]
    assert len(events) == 1
    assert events[0]["requested"] == "auto"
    assert events[0]["resolved"] == "gpt-x"


@pytest.mark.asyncio
async def test_model_reroute_never_blocks_main_path(monkeypatch):
    """hook 总线炸掉时 model.reroute 静默降级,不抛异常。"""

    class _Boom:
        async def emit(self, event, context):
            raise RuntimeError("hook bus down")

    monkeypatch.setattr("app.services.hook_engine.hook_engine", _Boom())
    from app.core.llm_gateway import LLMGateway

    await LLMGateway._emit_model_reroute(None, "auto", "m")  # type: ignore[arg-type]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
