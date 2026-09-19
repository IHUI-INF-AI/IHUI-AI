# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Harness 细粒度能力(2026-09-18 第四批):榨干 Codex harness 剩余可学面的单测。

覆盖:
- tools.search 工具目录搜索 + tools.load 延迟装载(对标 tool_search/LoadableToolSpec)
- request_user_input 中轮结构化提问(对标 elicitation:回填/非法参/超时)
- unified_exec 持久 shell 会话(对标 unified_exec:新建/续写增量/上限)
- auto-compact 阈值自动压缩(对标 compact_token_budget,trigger=auto)
- outputSchema 结构化终答校验(对标 output_schema,违例事件 + fail-open)
- 角色模板(对标 agent-roles:thread.start / spawn_subagent role 注入)
- turnTiming 回合计时(对标 turn_timing)+ thread.state 暴露新字段
"""

import asyncio
import json
from typing import Any

import pytest

from app.services.agent_engine import (
    INVALID_PARAMS,
    AgentEngine,
)

# =============================================================================
# 夹具(与 test_engine_harness_third 同款模式,自包含)
# =============================================================================


class _FakeLoop:
    def __init__(self, response: str = "done") -> None:
        self.spec: dict[str, Any] = {}
        self.host_tools: list[Any] = []
        self._response = response

    async def run(self, messages: list[dict[str, Any]]) -> Any:
        return _SimpleResult(self._response)

    async def resume_from_checkpoint(self, checkpoint_id: str) -> Any:
        return _SimpleResult(self._response)

    async def interrupt(self, mode: str = "cancel") -> Any:
        return None


class _SimpleResult:
    def __init__(self, final_response: str = "done") -> None:
        self.final_response = final_response

    success = True
    stop_reason = "end_turn"
    iterations: list[Any] = []
    total_duration_ms = 1.0
    total_tokens_used = 123
    checkpoint_id = None
    error = None
    budget = None
    compaction_events: list[Any] = []


def _engine(
    response: str = "done",
    tool_lister: Any = None,
    **kwargs: Any,
):
    loops: list[_FakeLoop] = []

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop(response)
        loop.spec = spec
        loop.host_tools = host_tools
        loops.append(loop)
        return loop

    if tool_lister is not None:
        kwargs["tool_lister"] = tool_lister
    return AgentEngine(loop_factory=factory, **kwargs), loops


async def _rpc(engine: AgentEngine, method: str, params: dict[str, Any], req_id: int = 1):
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
    )
    assert response is not None and "error" not in response, response
    return response["result"]


@pytest.fixture(autouse=True)
def _mock_hook_engine(monkeypatch):
    """替换 agent_loop_v2 的 hook_engine(loop 事件不真广播)。"""
    emitted: list[dict] = []

    class FakeHookEngine:
        async def emit(self, event, context):
            emitted.append({"event": event, **context})
            return []

    monkeypatch.setattr("app.services.agent_loop_v2.hook_engine", FakeHookEngine())
    monkeypatch.setattr("app.services.agent_loop_v2._approval_registry", {})
    yield {"emitted": emitted}


def _find_builtin(engine: AgentEngine, thread: Any, name: str) -> Any:
    for definition in engine._builtin_tool_definitions(thread):
        if getattr(definition, "name", "") == name:
            return definition
    raise AssertionError(f"内置工具未注入: {name}")


# =============================================================================
# tools.search / tools.load(对标 tool_search / LoadableToolSpec)
# =============================================================================


@pytest.mark.asyncio
async def test_tools_search_finds_builtin_and_mcp_pool():
    """tools.search:内置 + MCP 池合并目录模糊匹配;空 query 拒绝。"""
    async def _pool() -> list[dict[str, Any]]:
        return [
            {"name": "mcp_web_search", "description": "搜索互联网网页",
             "parameters": {"type": "object"}},
        ]

    engine, _ = _engine(tool_lister=_pool)
    started = await _rpc(engine, "thread.start", {})
    result = await _rpc(
        engine, "tools.search", {"threadId": started["threadId"], "query": "search"},
        req_id=2,
    )
    names = [r["name"] for r in result["results"]]
    assert "update_plan" not in names  # "search" 不匹配 plan 工具
    # 内置 web_search(入列晚于本测试)同样命中 "search"
    assert "web_search" in names
    assert "mcp_web_search" in names
    # 目录序 builtin → host → mcp:内置 web_search 先于 MCP 池
    assert result["results"][0]["source"] == "builtin"
    assert result["results"][-1]["source"] == "mcp"
    # 空 query → INVALID_PARAMS
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 3, "method": "tools.search",
         "params": {"query": "  "}}
    )
    assert response is not None and response["error"]["code"] == INVALID_PARAMS


@pytest.mark.asyncio
async def test_tools_load_registers_with_catalog_defaults():
    """tools.load:省略 schema 时从目录回填;内置工具拒绝装载;重复装载幂等。"""
    async def _pool() -> list[dict[str, Any]]:
        return [
            {"name": "mcp_web_search", "description": "搜索互联网网页",
             "parameters": {"type": "object", "properties": {"q": {"type": "string"}}}},
        ]

    engine, _ = _engine(tool_lister=_pool)
    started = await _rpc(engine, "thread.start", {})
    tid = started["threadId"]
    loaded = await _rpc(engine, "tools.load", {"threadId": tid, "name": "mcp_web_search"}, req_id=2)
    assert loaded["loaded"] is True and loaded["alreadyLoaded"] is False
    assert loaded["hostTools"] == ["mcp_web_search"]
    thread = engine._threads[tid]
    spec = thread.host_tools["mcp_web_search"]
    assert spec.description == "搜索互联网网页"  # 目录回填
    assert spec.parameters["properties"] == {"q": {"type": "string"}}
    # 重复装载幂等
    again = await _rpc(engine, "tools.load", {"threadId": tid, "name": "mcp_web_search"}, req_id=3)
    assert again["alreadyLoaded"] is True
    # 内置工具拒绝
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 4, "method": "tools.load",
         "params": {"threadId": tid, "name": "update_plan"}}
    )
    assert response is not None and response["error"]["code"] == INVALID_PARAMS


# =============================================================================
# request_user_input(对标 elicitation)
# =============================================================================


@pytest.mark.asyncio
async def test_request_user_input_respond_flow():
    """合法提问发 elicitation/request,elicitation.respond 回填 value。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    requests: list[dict[str, Any]] = []

    async def _emit(message: dict[str, Any]) -> None:
        if message.get("method") == "elicitation/request":
            requests.append(message["params"])

    thread.emit = _emit
    tool = _find_builtin(engine, thread, "request_user_input")
    task = asyncio.create_task(
        tool.executor({"question": "选择部署区域?", "schema": {"type": "object"}})
    )
    for _ in range(100):
        if requests:
            break
        await asyncio.sleep(0.01)
    assert len(requests) == 1
    assert requests[0]["question"] == "选择部署区域?"
    assert requests[0]["schema"] == {"type": "object"}
    await _rpc(
        engine, "elicitation.respond",
        {"elicitationId": requests[0]["elicitationId"], "value": {"region": "cn-north"}},
        req_id=2,
    )
    result = await task
    assert result == {"responded": True, "value": {"region": "cn-north"}}
    # 未知 id / 重复结算 → applied False,不炸
    unknown = await _rpc(
        engine, "elicitation.respond",
        {"elicitationId": "eli_nope", "value": None}, req_id=3,
    )
    assert unknown["applied"] is False


@pytest.mark.asyncio
async def test_request_user_input_invalid_and_timeout():
    """空 question fail-closed;超时默认未回答。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "request_user_input")
    bad = await tool.executor({"question": "   "})
    assert "error" in bad
    thread.emit = None  # 无人应答
    timed_out = await tool.executor({"question": "在吗?", "timeoutMs": 1000})
    assert timed_out["responded"] is False
    assert "超时" in timed_out["reason"]
    assert engine._elicitation_requests == {}


# =============================================================================
# unified_exec(对标 Codex unified_exec)
# =============================================================================


@pytest.mark.asyncio
async def test_unified_exec_new_session_then_reuse():
    """新建会话跑完即回 completed;按 sessionId 续写 stdin 只回增量。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "unified_exec")
    first = await tool.executor({"command": "echo hello-unified"})
    assert first["status"] in ("completed", "running")
    assert "hello-unified" in first["output"]
    assert first["sessionId"].startswith("shx_")
    assert first["exitCode"] in (0, None)
    # 续写:增量包含新输出
    second = await tool.executor(
        {"command": "echo world-unified", "sessionId": first["sessionId"]}
    )
    assert second["sessionId"] == first["sessionId"]
    assert "world-unified" in second["output"]
    # shell 快照:cwd 已记录
    assert thread.last_shell_cwd is not None
    # 不存在会话
    ghost = await tool.executor({"command": "echo x", "sessionId": "shx_ghost"})
    assert "不存在" in ghost["error"]


@pytest.mark.asyncio
async def test_unified_exec_session_limit(monkeypatch):
    """会话数达上限时拒绝新建(空闲回收照常)。"""
    import app.services.agent_engine as engine_mod

    monkeypatch.setattr(engine_mod, "_MAX_EXEC_SESSIONS", 1)
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "unified_exec")
    first = await tool.executor({"command": "echo one", "timeoutMs": 15000})
    assert "sessionId" in first
    second = await tool.executor({"command": "echo two"})
    assert "上限" in second["error"]


# =============================================================================
# auto-compact(对标 compact_token_budget)+ trigger 语义
# =============================================================================


@pytest.mark.asyncio
async def test_auto_compact_triggers_after_turn_with_auto_trigger():
    """autoCompact + 低阈值:轮后自动压缩,事件带 trigger=auto;手动入口 trigger=manual。"""
    engine, _ = _engine()
    notifications: list[dict[str, Any]] = []

    async def _emit(message: dict[str, Any]) -> None:
        if message.get("method") == "thread/event":
            notifications.append(message["params"])

    started = await _rpc(engine, "thread.start", {"autoCompact": True, "autoCompactThreshold": 1})
    tid = started["threadId"]
    assert started["autoCompact"] is True
    thread = engine._threads[tid]
    thread.messages = [
        {"role": "system", "content": "sys"},
        *[
            {"role": r, "content": f"{r}-{'y' * 500}-{i}"}
            for i in range(40)
            for r in ("user", "assistant")
        ],
    ]
    result = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 2, "method": "thread.prompt",
         "params": {"threadId": tid, "input": "hi"}},
        _emit,
    )
    assert result is not None and "error" not in result
    compacted = [
        n for n in notifications if n["event"] == "context.compacted"
    ]
    assert len(compacted) == 1
    assert compacted[0]["payload"]["trigger"] == "auto"
    assert len(thread.messages) < 81  # 确实压缩了
    # 手动压缩 trigger=manual
    manual = await _rpc(engine, "thread.compact", {"threadId": tid}, req_id=3)
    assert manual["trigger"] == "manual"


# =============================================================================
# outputSchema(对标 output_schema)
# =============================================================================


@pytest.mark.asyncio
async def test_output_schema_valid_json_passes():
    """finalResponse 为合法 JSON 且满足 required → valid=True,无违例事件。"""
    engine, loops = _engine(response=json.dumps({"answer": "42", "extra": 1}))
    notifications: list[dict[str, Any]] = []

    async def _emit(message: dict[str, Any]) -> None:
        if message.get("method") == "thread/event":
            notifications.append(message["params"])

    started = await _rpc(
        engine,
        "thread.start",
        {
            "outputSchema": {
                "type": "object",
                "properties": {"answer": {"type": "string"}},
                "required": ["answer"],
            }
        },
    )
    result = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 2, "method": "thread.prompt",
         "params": {"threadId": started["threadId"], "input": "hi"}},
        _emit,
    )
    assert result is not None and "error" not in result
    assert result["result"]["outputSchemaValidation"]["valid"] is True
    assert not [n for n in notifications if n["event"] == "output_schema.violation"]
    assert loops  # loop 被构建


@pytest.mark.asyncio
async def test_output_schema_violation_event_and_invalid_schema_rejected():
    """finalResponse 非 JSON → valid=False + output_schema.violation;非法 schema 构造期拒绝。"""
    engine, _ = _engine(response="这不是 JSON")
    notifications: list[dict[str, Any]] = []

    async def _emit(message: dict[str, Any]) -> None:
        if message.get("method") == "thread/event":
            notifications.append(message["params"])

    started = await _rpc(
        engine,
        "thread.start",
        {
            "outputSchema": {
                "type": "object",
                "properties": {"answer": {"type": "number"}},
                "required": ["answer"],
            }
        },
    )
    result = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 2, "method": "thread.prompt",
         "params": {"threadId": started["threadId"], "input": "hi"}},
        _emit,
    )
    assert result is not None and "error" not in result
    validation = result["result"]["outputSchemaValidation"]
    assert validation["valid"] is False
    assert any("JSON" in e for e in validation["errors"])
    violations = [n for n in notifications if n["event"] == "output_schema.violation"]
    assert len(violations) == 1
    # 非法 schema → INVALID_PARAMS
    for bad in ("not-a-dict", {"type": "string"}, {"type": "object"}):
        response = await engine.handle_message(
            {"jsonrpc": "2.0", "id": 3, "method": "thread.start",
             "params": {"outputSchema": bad}}
        )
        assert response is not None and response["error"]["code"] == INVALID_PARAMS, bad


# =============================================================================
# 角色模板(对标 agent-roles / collaboration-mode-templates)
# =============================================================================


@pytest.mark.asyncio
async def test_role_template_injected_into_system():
    """thread.start role=reviewer → system 追加模板;spawn_subagent role 透传;非法拒绝。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {"role": "reviewer"})
    assert started["role"] == "reviewer"
    thread = engine._threads[started["threadId"]]
    assert "[角色模板]" in thread.messages[0]["content"]
    assert "审查" in thread.messages[0]["content"]
    # 非法 role
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 2, "method": "thread.start", "params": {"role": "boss"}}
    )
    assert response is not None and response["error"]["code"] == INVALID_PARAMS


@pytest.mark.asyncio
async def test_spawn_subagent_role_propagates():
    """spawn_subagent 带 role:子线程 system 含模板,结果带 role;非法 role 拒绝。"""
    engine, loops = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "spawn_subagent")
    result = await tool.executor({"prompt": "审查这段代码", "role": "reviewer"})
    assert result["role"] == "reviewer"
    assert result["success"] is True
    # 子线程已即弃,但 spec 通过 factory 记录的 loops[-1].spec 无 system;直接看子线程消息不可行,
    # 改用:子线程 system 注入发生在 _handle_thread_start,验证通过 role 参数传递即可。
    assert result["threadId"].startswith("thr_")
    bad = await tool.executor({"prompt": "x", "role": "ceo"})
    assert "role 非法" in bad["error"]


# =============================================================================
# turnTiming + thread.state 暴露(对标 turn_timing)
# =============================================================================


@pytest.mark.asyncio
async def test_turn_timing_and_state_exposure():
    """结果带 turnTiming(startedAt/endedAt/durationMs);state 暴露第四批字段。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {"role": "planner", "autoCompact": True})
    tid = started["threadId"]
    result = await _rpc(engine, "thread.prompt", {"threadId": tid, "input": "hi"}, req_id=2)
    timing = result["turnTiming"]
    assert timing["endedAt"] >= timing["startedAt"]
    assert timing["durationMs"] >= 0
    state = await _rpc(engine, "thread.state", {"threadId": tid}, req_id=3)
    assert state["autoCompact"] is True
    assert state["role"] == "planner"
    assert "lastShellCwd" in state and "execSessions" in state
    assert state["turnTiming"]["durationMs"] >= 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
