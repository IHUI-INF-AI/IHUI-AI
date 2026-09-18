# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent Engine(JSON-RPC 2.0 编排引擎)测试(P2-③,2026-09-18 立)。

覆盖:
- 协议层:握手/ping/未知方法/非法报文/params 校验/通知无响应
- 线程生命周期:start → prompt → state → interrupt → resume → close
- 多轮会话语义:消息副本隔离(注入型 system 不跨轮累积)+ 线程忙保护
- 宿主工具:tools.register / tool/execute 往返 / tools.result 结算 / 超时降级
- 审批:approval.respond 打通主循环 resolve_approval_response
- 事件转发:hook 总线订阅 → thread/event 通知(按会话过滤)+ approval/request 派发
- 差异化能力出口:tools.list / models.list / cost.report
- HTTP 传输:POST /api/engine/rpc 单发 JSON 与流式 SSE(末帧为方法响应)
"""

import asyncio
import json
from typing import Any

import pytest

from app.services.agent_engine import (
    INVALID_PARAMS,
    INVALID_REQUEST,
    METHOD_NOT_FOUND,
    PARSE_ERROR,
    THREAD_BUSY,
    THREAD_CLOSED,
    THREAD_NOT_FOUND,
    WAIT_TIMEOUT,
    AgentEngine,
    JsonRpcError,
)


# ---------------------------------------------------------------------------
# 测试替身
# ---------------------------------------------------------------------------


class _FakeResult:
    def __init__(
        self,
        *,
        success: bool = True,
        stop_reason: str = "completed",
        final_response: str = "done",
        checkpoint_id: str | None = None,
        error: str | None = None,
    ) -> None:
        self.success = success
        self.stop_reason = stop_reason
        self.final_response = final_response
        self.iterations = [{"iteration": 1}]
        self.total_duration_ms = 12.5
        self.total_tokens_used = 42
        self.checkpoint_id = checkpoint_id
        self.error = error
        self.budget = None
        self.compaction_events = []


class _FakeLoop:
    """最小主循环替身:语义与 AgentLoopV2 对齐(run/resume/cancel/pause)。"""

    def __init__(self, mutate_system: bool = False) -> None:
        self.run_calls: list[list[dict[str, Any]]] = []
        self.cancel_calls = 0
        self.pause_calls = 0
        self.resume_calls: list[str] = []
        self.spec: dict[str, Any] = {}
        self.host_tools: list[Any] = []
        self._mutate_system = mutate_system

    async def run(self, messages: list[dict[str, Any]]) -> _FakeResult:
        if self._mutate_system and messages and messages[0].get("role") == "system":
            # 模拟主循环就地改写 system 做注入(记忆/画像/团队接力)
            messages[0]["content"] = f"{messages[0]['content']}\n\n[注入上下文]"
        # 快照必须在就地改写之后:否则断言只能看到改写前内容,跨轮累积无法被检出
        self.run_calls.append([dict(m) for m in messages])
        messages.append({"role": "assistant", "content": "回答"})
        return _FakeResult(final_response="回答")

    async def cancel(self) -> str:
        self.cancel_calls += 1
        return "ckpt-cancel"

    async def pause(self) -> str:
        self.pause_calls += 1
        return "ckpt-pause"

    async def resume_from_checkpoint(self, checkpoint_id: str) -> _FakeResult:
        self.resume_calls.append(checkpoint_id)
        if checkpoint_id == "missing":
            raise ValueError("checkpoint not found")
        return _FakeResult(final_response="续跑完成")


class _FakeBus:
    """hook 事件总线替身(subscribe/unsubscribe/push)。"""

    def __init__(self) -> None:
        self.queues: dict[str, list[asyncio.Queue[Any]]] = {}

    def subscribe(
        self, event: str, queue_factory: Any | None = None
    ) -> asyncio.Queue[Any]:
        # 与 hook_engine.subscribe 的真实签名对齐:支持 queue_factory 注入
        queue: Any = queue_factory() if queue_factory is not None else asyncio.Queue()
        self.queues.setdefault(event, []).append(queue)
        return queue

    def unsubscribe(self, event: str, queue: asyncio.Queue[Any]) -> None:
        subs = self.queues.get(event)
        if subs and queue in subs:
            subs.remove(queue)

    def push(self, event: str, payload: dict[str, Any]) -> None:
        for queue in self.queues.get(event, []):
            queue.put_nowait(payload)


def _engine(**kwargs: Any) -> tuple[AgentEngine, list[_FakeLoop]]:
    loops: list[_FakeLoop] = []

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop()
        loop.spec = spec
        loop.host_tools = host_tools
        loops.append(loop)
        return loop

    engine = AgentEngine(loop_factory=factory, **kwargs)
    return engine, loops


async def _rpc(
    engine: AgentEngine, method: str, params: dict[str, Any] | None = None, req_id: int = 1
) -> dict[str, Any]:
    message: dict[str, Any] = {"jsonrpc": "2.0", "id": req_id, "method": method}
    if params is not None:
        message["params"] = params
    response = await engine.handle_message(message)
    assert response is not None
    return response


# ---------------------------------------------------------------------------
# 协议层
# ---------------------------------------------------------------------------


async def test_initialize_declares_capabilities_and_methods():
    engine, _ = _engine(
        tool_lister=lambda: _async_list([{"name": "w"}]),
        cost_report=lambda filt: {"aggregate": {}},
        model_lister=lambda: [{"model": "gpt-5"}],
    )
    result = (await _rpc(engine, "engine.initialize"))["result"]
    assert result["protocolVersion"]
    caps = result["capabilities"]
    assert caps["streaming"] and caps["interrupt"] and caps["hostTools"]
    assert caps["mcp"] and caps["costLedger"] and caps["modelRouting"]
    assert caps["decisionChain"] is True
    assert "thread.prompt" in result["methods"]
    assert result["notifications"] == ["thread/event", "tool/execute", "approval/request"]
    assert any("19 家 provider" in item for item in result["differentiators"])


async def _async_list(items: list[Any]) -> list[Any]:
    return items


async def test_ping_returns_pong_and_thread_count():
    engine, _ = _engine()
    result = (await _rpc(engine, "engine.ping"))["result"]
    assert result["pong"] is True
    assert result["threads"] == 0


async def test_unknown_method_returns_method_not_found_with_supported():
    engine, _ = _engine()
    response = await _rpc(engine, "nope.nope")
    assert response["error"]["code"] == METHOD_NOT_FOUND
    assert "thread.prompt" in response["error"]["data"]["supported"]


async def test_invalid_json_returns_parse_error():
    engine, _ = _engine()
    response = await engine.handle_message("{not json")
    assert response is not None
    assert response["error"]["code"] == PARSE_ERROR
    assert response["id"] is None


async def test_missing_jsonrpc_version_returns_invalid_request():
    engine, _ = _engine()
    response = await engine.handle_message({"id": 1, "method": "engine.ping"})
    assert response is not None
    assert response["error"]["code"] == INVALID_REQUEST


async def test_non_object_params_returns_invalid_params():
    engine, _ = _engine()
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 1, "method": "engine.ping", "params": [1, 2]}
    )
    assert response is not None
    assert response["error"]["code"] == INVALID_PARAMS


async def test_notification_without_id_returns_none():
    engine, _ = _engine()
    assert await engine.handle_message({"jsonrpc": "2.0", "method": "engine.ping"}) is None


async def test_batch_style_list_is_not_supported_at_core_level():
    """内核只认单条报文;数组报文按非法请求处理(批量由传输层展开)。"""
    engine, _ = _engine()
    response = await engine.handle_message([{"jsonrpc": "2.0", "id": 1, "method": "engine.ping"}])
    assert response is not None
    assert response["error"]["code"] == INVALID_REQUEST


# ---------------------------------------------------------------------------
# 线程生命周期
# ---------------------------------------------------------------------------


async def test_thread_start_creates_idle_thread_with_system_message():
    engine, _ = _engine()
    result = (await _rpc(engine, "thread.start", {"permissionMode": "plan"}))["result"]
    assert result["threadId"].startswith("thr_")
    assert result["status"] == "idle"
    assert result["permissionMode"] == "plan"
    assert engine.thread_count() == 1


async def test_thread_prompt_returns_normalized_result():
    engine, loops = _engine()
    thread_id = (await _rpc(engine, "thread.start", {"tools": ["read_file"]}))["result"]["threadId"]
    result = (
        await _rpc(engine, "thread.prompt", {"threadId": thread_id, "input": "你好"})
    )["result"]
    assert result["success"] is True
    assert result["stopReason"] == "completed"
    assert result["finalResponse"] == "回答"
    assert result["iterations"] == 1
    assert result["totalTokensUsed"] == 42
    assert result["totalDurationMs"] == 12.5
    # 工具白名单透传到主循环工厂 spec
    assert loops[0].spec["tool_names"] == ["read_file"]
    assert loops[0].spec["thread_id"] == thread_id


async def test_thread_prompt_accepts_multiple_input_shapes():
    engine, loops = _engine()
    thread_id = (await _rpc(engine, "thread.start"))["result"]["threadId"]
    await _rpc(engine, "thread.prompt", {"threadId": thread_id, "input": {"text": "对象形式"}})
    await _rpc(
        engine, "thread.prompt", {"threadId": thread_id, "input": ["数组", {"content": "形式"}]}
    )
    contents = [
        m["content"]
        for call in loops
        for m in call.run_calls[0]
        if m.get("role") == "user"
    ]
    assert "对象形式" in contents
    assert "数组\n形式" in contents


async def test_thread_prompt_rejects_bad_input_shape():
    engine, _ = _engine()
    thread_id = (await _rpc(engine, "thread.start"))["result"]["threadId"]
    response = await _rpc(
        engine, "thread.prompt", {"threadId": thread_id, "input": 123}
    )
    assert response["error"]["code"] == INVALID_PARAMS


async def test_thread_prompt_unknown_thread_returns_thread_not_found():
    engine, _ = _engine()
    response = await _rpc(engine, "thread.prompt", {"threadId": "thr_nope", "input": "x"})
    assert response["error"]["code"] == THREAD_NOT_FOUND


async def test_multi_turn_history_isolated_from_system_injection():
    """注入型 system 内容每轮重新生成,不得跨轮累积进线程历史。"""
    loops: list[_FakeLoop] = []

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop(mutate_system=True)
        loops.append(loop)
        return loop

    engine = AgentEngine(loop_factory=factory)
    thread_id = (await _rpc(engine, "thread.start"))["result"]["threadId"]
    await _rpc(engine, "thread.prompt", {"threadId": thread_id, "input": "第一轮"})
    await _rpc(engine, "thread.prompt", {"threadId": thread_id, "input": "第二轮"})
    state = (await _rpc(engine, "thread.state", {"threadId": thread_id}))["result"]
    # 1 条 system + 2×(user+assistant) = 5
    assert state["messages"] == 5
    assert state["prompts"] == 2
    # 第二轮主循环拿到的 system 里只有一次注入(未累积第一轮的注入)
    second_call = loops[1].run_calls[0]
    assert second_call[0]["content"].count("[注入上下文]") == 1


async def test_thread_busy_guard_rejects_concurrent_prompt():
    engine, _ = _engine()
    thread_id = (await _rpc(engine, "thread.start"))["result"]["threadId"]
    thread = engine._threads[thread_id]
    thread.status = "running"
    response = await _rpc(engine, "thread.prompt", {"threadId": thread_id, "input": "x"})
    assert response["error"]["code"] == THREAD_BUSY
    thread.status = "idle"


async def test_thread_interrupt_calls_cancel_and_pause():
    engine, loops = _engine()
    thread_id = (await _rpc(engine, "thread.start"))["result"]["threadId"]
    await _rpc(engine, "thread.prompt", {"threadId": thread_id, "input": "跑一轮"})
    loop = loops[0]
    thread = engine._threads[thread_id]
    # 已结束(非 running)→ 不中断,给出原因
    idle = (await _rpc(engine, "thread.interrupt", {"threadId": thread_id}))["result"]
    assert idle["interrupted"] is False and idle["reason"] == "no_active_run"
    # 模拟运行中
    thread.status = "running"
    thread.loop = loop
    cancelled = (
        await _rpc(engine, "thread.interrupt", {"threadId": thread_id, "mode": "cancel"})
    )["result"]
    assert cancelled["interrupted"] is True
    assert loop.cancel_calls == 1
    paused = (
        await _rpc(engine, "thread.interrupt", {"threadId": thread_id, "mode": "pause"})
    )["result"]
    assert loop.pause_calls == 1
    assert paused["checkpointId"] == "ckpt-pause"
    thread.status = "idle"
    thread.loop = None


async def test_thread_interrupt_rejects_bad_mode():
    engine, _ = _engine()
    thread_id = (await _rpc(engine, "thread.start"))["result"]["threadId"]
    response = await _rpc(
        engine, "thread.interrupt", {"threadId": thread_id, "mode": "explode"}
    )
    assert response["error"]["code"] == INVALID_PARAMS


async def test_thread_resume_uses_checkpoint():
    engine, loops = _engine()
    thread_id = (await _rpc(engine, "thread.start"))["result"]["threadId"]
    result = (
        await _rpc(engine, "thread.resume", {"threadId": thread_id, "checkpointId": "ckpt-1"})
    )["result"]
    assert result["finalResponse"] == "续跑完成"
    assert loops[0].resume_calls == ["ckpt-1"]
    assert engine._threads[thread_id].checkpoint_id is None  # _FakeResult 未带 checkpoint


async def test_thread_resume_missing_checkpoint_maps_to_thread_not_found():
    engine, _ = _engine()
    thread_id = (await _rpc(engine, "thread.start"))["result"]["threadId"]
    response = await _rpc(
        engine, "thread.resume", {"threadId": thread_id, "checkpointId": "missing"}
    )
    assert response["error"]["code"] == THREAD_NOT_FOUND


async def test_thread_resume_requires_checkpoint_id():
    engine, _ = _engine()
    thread_id = (await _rpc(engine, "thread.start"))["result"]["threadId"]
    response = await _rpc(engine, "thread.resume", {"threadId": thread_id})
    assert response["error"]["code"] == INVALID_PARAMS


async def test_thread_state_reports_cost_when_reporter_injected():
    engine, _ = _engine(cost_report=lambda filt: {"aggregate": {"total_usd": 1.0}})
    thread_id = (await _rpc(engine, "thread.start"))["result"]["threadId"]
    state = (await _rpc(engine, "thread.state", {"threadId": thread_id}))["result"]
    assert state["cost"]["aggregate"]["total_usd"] == 1.0
    assert state["status"] == "idle"


async def test_thread_state_without_cost_reporter_returns_empty_cost():
    engine, _ = _engine()
    thread_id = (await _rpc(engine, "thread.start"))["result"]["threadId"]
    state = (await _rpc(engine, "thread.state", {"threadId": thread_id}))["result"]
    assert state["cost"] == {}


async def test_thread_close_marks_closed_and_rejects_further_use():
    engine, _ = _engine()
    thread_id = (await _rpc(engine, "thread.start"))["result"]["threadId"]
    closed = (await _rpc(engine, "thread.close", {"threadId": thread_id}))["result"]
    assert closed["closed"] is True
    response = await _rpc(engine, "thread.prompt", {"threadId": thread_id, "input": "x"})
    assert response["error"]["code"] == THREAD_CLOSED


# ---------------------------------------------------------------------------
# 宿主工具往返
# ---------------------------------------------------------------------------


async def test_tools_register_and_list():
    engine, _ = _engine(tool_lister=lambda: _async_list([{"name": "builtin_x"}]))
    thread_id = (await _rpc(engine, "thread.start"))["result"]["threadId"]
    registered = (
        await _rpc(
            engine,
            "tools.register",
            {
                "threadId": thread_id,
                "name": "my_host_tool",
                "description": "宿主侧查询",
                "parameters": {"type": "object", "properties": {"q": {"type": "string"}}},
            },
        )
    )["result"]
    assert registered["registered"] is True
    assert registered["hostTools"] == ["my_host_tool"]
    listed = (await _rpc(engine, "tools.list", {"threadId": thread_id}))["result"]
    assert [t["name"] for t in listed["hostTools"]] == ["my_host_tool"]
    assert listed["pool"] == [{"name": "builtin_x"}]
    assert listed["total"] == 2


async def test_tools_register_validation_errors():
    engine, _ = _engine()
    thread_id = (await _rpc(engine, "thread.start"))["result"]["threadId"]
    missing_name = await _rpc(engine, "tools.register", {"threadId": thread_id})
    assert missing_name["error"]["code"] == INVALID_PARAMS
    bad_schema = await _rpc(
        engine,
        "tools.register",
        {"threadId": thread_id, "name": "t", "parameters": ["not", "a", "dict"]},
    )
    assert bad_schema["error"]["code"] == INVALID_PARAMS
    bad_timeout = await _rpc(
        engine, "tools.register", {"threadId": thread_id, "name": "t", "timeoutMs": 0}
    )
    assert bad_timeout["error"]["code"] == INVALID_PARAMS


async def test_host_tool_execute_round_trip():
    """主循环调用宿主工具 → 引擎发 tool/execute 通知 → 客户端 tools.result 回传。"""
    notifications: list[dict[str, Any]] = []
    pending_replies: list[asyncio.Task[Any]] = []

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop()

        async def run(messages: list[dict[str, Any]]) -> _FakeResult:
            value = await host_tools[0].executor({"q": "abc"})
            return _FakeResult(final_response=json.dumps(value, ensure_ascii=False))

        loop.run = run  # type: ignore[method-assign]
        return loop

    engine = AgentEngine(loop_factory=factory)

    async def emit(message: dict[str, Any]) -> None:
        notifications.append(message)
        if message.get("method") == "tool/execute":
            request_id = message["params"]["requestId"]
            pending_replies.append(
                asyncio.ensure_future(
                    engine.handle_message(
                        {
                            "jsonrpc": "2.0",
                            "id": 99,
                            "method": "tools.result",
                            "params": {"requestId": request_id, "result": {"answer": 42}},
                        }
                    )
                )
            )

    thread_id = (
        await engine.handle_message(
            {"jsonrpc": "2.0", "id": 1, "method": "thread.start"}, emit
        )
    )["result"]["threadId"]
    await engine.handle_message(
        {"jsonrpc": "2.0", "id": 2, "method": "tools.register",
         "params": {"threadId": thread_id, "name": "host_probe", "description": "探针"}},
        emit,
    )
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 3, "method": "thread.prompt",
         "params": {"threadId": thread_id, "input": "用宿主工具"}},
        emit,
    )
    await asyncio.gather(*pending_replies)
    assert response is not None
    assert json.loads(response["result"]["finalResponse"]) == {"answer": 42}
    execute = [m for m in notifications if m.get("method") == "tool/execute"]
    assert len(execute) == 1
    assert execute[0]["params"]["name"] == "host_probe"
    assert execute[0]["params"]["arguments"] == {"q": "abc"}


async def test_host_tool_timeout_degrades_to_wait_timeout():
    """客户端不回传 → 宿主工具超时,异常带 WAIT_TIMEOUT 码,不悬挂线程。"""
    captured: list[JsonRpcError] = []

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop()

        async def run(messages: list[dict[str, Any]]) -> _FakeResult:
            try:
                await host_tools[0].executor({})
            except JsonRpcError as e:
                captured.append(e)
            return _FakeResult()

        loop.run = run  # type: ignore[method-assign]
        return loop

    engine = AgentEngine(loop_factory=factory, host_tool_timeout_ms=30)
    thread_id = (await _rpc(engine, "thread.start"))["result"]["threadId"]
    await _rpc(
        engine,
        "tools.register",
        {"threadId": thread_id, "name": "slow", "description": "慢工具"},
    )
    await _rpc(engine, "thread.prompt", {"threadId": thread_id, "input": "调用"})
    assert captured and captured[0].code == WAIT_TIMEOUT


async def test_tools_result_unknown_request_is_not_applied():
    engine, _ = _engine()
    result = (
        await _rpc(engine, "tools.result", {"requestId": "req_unknown", "result": 1})
    )["result"]
    assert result["applied"] is False
    assert result["reason"] == "unknown_request"


async def test_tools_result_error_path_marks_host_tool_failure():
    engine, _ = _engine()
    thread_id = (await _rpc(engine, "thread.start"))["result"]["threadId"]
    thread = engine._threads[thread_id]
    future: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
    thread.pending["req_x"] = future
    result = (
        await _rpc(
            engine, "tools.result", {"requestId": "req_x", "error": "客户端执行失败"}
        )
    )["result"]
    assert result["applied"] is True
    with pytest.raises(JsonRpcError):
        await future


# ---------------------------------------------------------------------------
# 审批
# ---------------------------------------------------------------------------


async def test_approval_respond_reports_unapplied_for_unknown_id():
    engine, _ = _engine()
    result = (
        await _rpc(engine, "approval.respond", {"approvalId": "appr_nope", "decision": "approve"})
    )["result"]
    assert result["applied"] is False
    assert result["decision"] == "approve"


async def test_approval_respond_validates_input():
    engine, _ = _engine()
    missing = await _rpc(engine, "approval.respond", {"decision": "approve"})
    assert missing["error"]["code"] == INVALID_PARAMS
    bad_decision = await _rpc(
        engine, "approval.respond", {"approvalId": "a1", "decision": "maybe"}
    )
    assert bad_decision["error"]["code"] == INVALID_PARAMS


async def test_approval_respond_normalizes_allow_deny(monkeypatch):
    """allow/deny 归一为 approve/reject 后回填主循环注册表。"""
    import app.services.agent_loop_v2 as loop_mod

    seen: list[tuple[str, str]] = []

    def _resolve(approval_id: str, decision: str) -> bool:
        seen.append((approval_id, decision))
        return True

    monkeypatch.setattr(loop_mod, "resolve_approval_response", _resolve)
    engine, _ = _engine()
    await _rpc(engine, "approval.respond", {"approvalId": "a1", "decision": "allow"})
    await _rpc(engine, "approval.respond", {"approvalId": "a2", "decision": "deny"})
    assert seen == [("a1", "approve"), ("a2", "reject")]


# ---------------------------------------------------------------------------
# 事件转发
# ---------------------------------------------------------------------------


async def test_events_are_forwarded_and_filtered_by_session():
    bus = _FakeBus()
    notifications: list[dict[str, Any]] = []

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop()

        async def run(messages: list[dict[str, Any]]) -> _FakeResult:
            bus.push("tool.before", {"session_id": spec["session_id"], "iteration": 1})
            bus.push("thinking.delta", {"run_id": spec["session_id"], "content": "想"})
            bus.push("tool.before", {"session_id": "other-thread", "iteration": 2})
            bus.push("tool.before", {"iteration": 3})  # 无会话标识 → 丢弃
            await asyncio.sleep(0.3)  # 留出转发窗口
            return _FakeResult()

        loop.run = run  # type: ignore[method-assign]
        return loop

    engine = AgentEngine(loop_factory=factory, hook_bus=bus)

    async def emit(message: dict[str, Any]) -> None:
        notifications.append(message)

    thread_id = (
        await engine.handle_message(
            {"jsonrpc": "2.0", "id": 1, "method": "thread.start",
             "params": {"sessionId": "sess-A"}},
            emit,
        )
    )["result"]["threadId"]
    await engine.handle_message(
        {"jsonrpc": "2.0", "id": 2, "method": "thread.prompt",
         "params": {"threadId": thread_id, "input": "跑"}},
        emit,
    )
    events = [m for m in notifications if m.get("method") == "thread/event"]
    # 2026-09-18 第二批:引擎自产 environment_context(prompt 前)与
    # turn.usage(回合结束)同走 thread/event 通道,插入总线事件序列首尾。
    assert [e["params"]["event"] for e in events] == [
        "environment_context",
        "tool.before",
        "thinking.delta",
        "turn.usage",
    ]
    assert all(e["params"]["threadId"] == thread_id for e in events)


async def test_tool_approval_event_dispatches_approval_request():
    bus = _FakeBus()
    notifications: list[dict[str, Any]] = []

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop()

        async def run(messages: list[dict[str, Any]]) -> _FakeResult:
            bus.push(
                "tool.approval",
                {
                    "session_id": spec["session_id"],
                    "approval_id": "appr_123",
                    "tool_name": "run_command",
                    "tool_call_id": "tc1",
                    "args_preview": "rm -rf /tmp/x",
                    "danger_level": "high",
                },
            )
            await asyncio.sleep(0.3)
            return _FakeResult()

        loop.run = run  # type: ignore[method-assign]
        return loop

    engine = AgentEngine(loop_factory=factory, hook_bus=bus)

    async def emit(message: dict[str, Any]) -> None:
        notifications.append(message)

    thread_id = (
        await engine.handle_message(
            {"jsonrpc": "2.0", "id": 1, "method": "thread.start"}, emit
        )
    )["result"]["threadId"]
    await engine.handle_message(
        {"jsonrpc": "2.0", "id": 2, "method": "thread.prompt",
         "params": {"threadId": thread_id, "input": "跑"}},
        emit,
    )
    approvals = [m for m in notifications if m.get("method") == "approval/request"]
    assert len(approvals) == 1
    params = approvals[0]["params"]
    assert params["requestId"] == "appr_123"
    assert params["toolName"] == "run_command"
    assert params["dangerLevel"] == "high"
    # 审批事件本身也照常作为 thread/event 回传
    assert any(
        m.get("method") == "thread/event" and m["params"]["event"] == "tool.approval"
        for m in notifications
    )


# ---------------------------------------------------------------------------
# 差异化能力出口
# ---------------------------------------------------------------------------


async def test_cost_report_passes_filter():
    captured: list[dict[str, Any] | None] = []

    def _report(filt: dict[str, Any] | None) -> dict[str, Any]:
        captured.append(filt)
        return {"aggregate": {"total_usd": 3.5}}

    engine, _ = _engine(cost_report=_report)
    result = (
        await _rpc(engine, "cost.report", {"session_id": "s1", "model": "gpt-5"})
    )["result"]
    assert result["available"] is True
    assert result["filter"] == {"session_id": "s1", "model": "gpt-5"}
    assert result["report"]["aggregate"]["total_usd"] == 3.5
    assert captured == [{"session_id": "s1", "model": "gpt-5"}]


async def test_cost_report_without_reporter_reports_unavailable():
    engine, _ = _engine()
    result = (await _rpc(engine, "cost.report"))["result"]
    assert result == {"available": False, "report": {}}


async def test_models_list_returns_router_table():
    engine, _ = _engine(model_lister=lambda: [{"model": "claude-sonnet-5"}])
    result = (await _rpc(engine, "models.list"))["result"]
    assert result["total"] == 1
    assert result["models"][0]["model"] == "claude-sonnet-5"


async def test_models_list_without_lister_reports_unavailable():
    engine, _ = _engine()
    result = (await _rpc(engine, "models.list"))["result"]
    assert result == {"available": False, "models": []}


async def test_tools_list_degrades_when_lister_raises():
    async def _boom() -> list[dict[str, Any]]:
        raise RuntimeError("pool down")

    engine, _ = _engine(tool_lister=_boom)
    result = (await _rpc(engine, "tools.list"))["result"]
    assert result["poolAvailable"] is False
    assert result["pool"] is None


# ---------------------------------------------------------------------------
# 默认装配(真实依赖,不打桩)
# ---------------------------------------------------------------------------


def test_default_model_lister_reads_real_pricing_table():
    from app.routers.engine import _default_model_lister

    rows = _default_model_lister()
    assert any(row["scope"] == "model" for row in rows)
    assert any(row["scope"] == "provider" for row in rows)
    anthropic_row = next(r for r in rows if r["model"] == "anthropic/*")
    # P0-① 缓存乘数已进入能力清单(anthropic 读 0.1x / 写 1.25x)
    assert anthropic_row["cacheReadMultiplier"] == 0.1
    assert anthropic_row["cacheWriteMultiplier"] == 1.25


def test_default_cost_report_reads_real_ledger():
    from app.routers.engine import _default_cost_report

    report = _default_cost_report({"session_id": "engine-test-nonexistent"})
    assert "aggregate" in report and "topTools" in report


async def test_default_tool_lister_returns_builtin_tools():
    from app.routers.engine import _default_tool_lister

    tools = await _default_tool_lister()
    assert tools and all({"name", "description", "source"} <= set(t) for t in tools)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
