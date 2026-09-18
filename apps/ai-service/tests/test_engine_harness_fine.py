# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Harness 细粒度能力(2026-09-18 第二批):榨干 Codex harness 剩余可学面的单测。

覆盖:
- 生成参数 / 推理配置(modelParams + reasoning:解析/冻结/透传 spec/非法拒绝)
- 负向工具过滤(denyTools,对标 Codex per-app omit_tools_from)
- 引擎事件面:environment_context(环境快照)/ turn.usage(对标 TokenCount)
- loop 侧:llm.retry 重试/限流事件(对标 Codex StreamError)+ model_params 透传
- 引擎内置工具:update_plan(对标 plan tool)/ spawn_subagent(对标 collab)/
  view_image(对标 view_image,工作区路径校验)
- thread.compact(对标 /compact + ContextCompacted)/ thread.export(rollout 导出)
"""

import base64
import json
from typing import Any

import pytest

from app.services.agent_engine import AgentEngine, INVALID_PARAMS
from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition
from app.services.session_store import SessionStore


# =============================================================================
# 夹具(与 test_engine_harness_policies 同款模式,自包含)
# =============================================================================


class _FakeLoop:
    def __init__(self) -> None:
        self.spec: dict[str, Any] = {}

    async def run(self, messages: list[dict[str, Any]]) -> Any:
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


def _engine(store: SessionStore | None = None, **kwargs: Any):
    loops: list[_FakeLoop] = []

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop()
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
    """替换 agent_loop_v2 的 hook_engine(loop 事件不真广播,记录待断言)。"""
    emitted: list[dict] = []

    class FakeHookEngine:
        async def emit(self, event, context):
            emitted.append({"event": event, **context})
            return []

    monkeypatch.setattr("app.services.agent_loop_v2.hook_engine", FakeHookEngine())
    monkeypatch.setattr("app.services.agent_loop_v2._approval_registry", {})
    yield {"emitted": emitted}


# =============================================================================
# loop 侧:llm.retry 事件 + model_params 透传
# =============================================================================


@pytest.mark.asyncio
async def test_llm_retry_event_emitted_with_rate_limited_flag(_mock_hook_engine):
    """LLM 调用失败重试时发 llm.retry;429 语义标注 rate_limited(对标 StreamError)。"""
    calls = {"n": 0}

    async def _flaky_llm(messages, tools):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("HTTP 429 rate limit exceeded")
        return {"content": "ok", "tool_calls": None, "usage": None, "model": "m"}

    loop = AgentLoopV2(_flaky_llm, [], llm_retry_max=2, llm_retry_backoff=0.01)
    result = await loop.run([{"role": "user", "content": "hi"}])
    assert result.final_response == "ok"
    emitted = _mock_hook_engine["emitted"]
    retry_events = [e for e in emitted if e["event"] == "llm.retry"]
    assert len(retry_events) == 1
    evt = retry_events[0]
    assert evt["attempt"] == 1 and evt["max_attempts"] == 2
    assert evt["rate_limited"] is True
    assert evt["error_type"] in ("http_4xx", "unknown", "http_5xx")


@pytest.mark.asyncio
async def test_model_params_forwarded_to_llm_call():
    """model_params 经 **kwargs 透传 llm_complete_fn(temperature/reasoning_effort)。"""
    seen: dict[str, Any] = {}

    async def _llm(messages, tools, **kwargs):
        seen.update(kwargs)
        return {"content": "ok", "tool_calls": None, "usage": None, "model": "m"}

    loop = AgentLoopV2(_llm, [], model_params={"temperature": 0.2, "reasoning_effort": "low"})
    await loop.run([{"role": "user", "content": "hi"}])
    assert seen.get("temperature") == 0.2
    assert seen.get("reasoning_effort") == "low"


@pytest.mark.asyncio
async def test_no_model_params_keeps_call_signature_zero_diff():
    """未配置 model_params 时不追加任何 kwargs(与现状逐零差异,mock 无 **kwargs 也不炸)。"""
    calls: list[tuple] = []

    async def _llm(messages, tools):
        calls.append((messages, tools))
        return {"content": "ok", "tool_calls": None, "usage": None, "model": "m"}

    loop = AgentLoopV2(_llm, [])
    result = await loop.run([{"role": "user", "content": "hi"}])
    assert result.final_response == "ok"
    assert len(calls) == 1


def test_model_params_type_validation():
    """非 dict 的 model_params 构造期 fail-fast。"""
    with pytest.raises(ValueError, match="model_params"):
        AgentLoopV2(None, [], model_params="temperature=0.2")  # type: ignore[arg-type]


# =============================================================================
# engine 侧:生成参数 / 推理配置 / 负向过滤
# =============================================================================


@pytest.mark.asyncio
async def test_generation_config_parsed_frozen_and_passed_to_spec():
    """modelParams(camelCase 别名)+ reasoning 解析入线程,冻结副本进 spec,resume 不漂移。"""
    engine, loops = _engine()
    started = await _rpc(
        engine,
        "thread.start",
        {
            "modelParams": {"temperature": 0.5, "maxTokens": 100},
            "reasoning": {"effort": "high"},
        },
    )
    assert started["modelParams"]["temperature"] == 0.5
    assert started["modelParams"]["max_tokens"] == 100  # camelCase 别名归一
    assert started["reasoning"]["effort"] == "high"
    tid = started["threadId"]
    await _rpc(engine, "thread.prompt", {"threadId": tid, "input": "hi"}, req_id=2)
    spec = loops[0].spec
    assert spec["model_params"]["temperature"] == 0.5
    assert spec["model_params"]["reasoning_effort"] == "high"  # effort 注入透传面

    # 轮间客户端篡改线程配置 → resume 用冻结副本,不串台(全量还原含 effort 注入项)
    engine._threads[tid].model_params = {"temperature": 9.9}
    await _rpc(engine, "thread.resume", {"threadId": tid, "checkpointId": "cp"}, req_id=3)
    assert loops[1].spec["model_params"]["temperature"] == 0.5
    assert engine._threads[tid].model_params == {
        "temperature": 0.5,
        "max_tokens": 100,
        "reasoning_effort": "high",
    }


@pytest.mark.asyncio
async def test_generation_config_invalid_values_rejected():
    """非法键 / 非法值类型 / 非法 effort → INVALID_PARAMS(-32602)。"""
    engine, _ = _engine()
    for bad_params in (
        {"modelParams": {"bogus_key": 1}},
        {"modelParams": {"temperature": "hot"}},
        {"modelParams": {"max_tokens": -5}},
        {"reasoning": {"effort": "extreme"}},
        {"reasoning": {"summary": "chatty"}},
        {"denyTools": "spawn_subagent"},
        {"denyTools": [1, 2]},
    ):
        response = await engine.handle_message(
            {"jsonrpc": "2.0", "id": 1, "method": "thread.start", "params": bad_params}
        )
        assert response is not None and response["error"]["code"] == INVALID_PARAMS, bad_params


@pytest.mark.asyncio
async def test_deny_tools_filters_builtins_and_enters_spec():
    """denyTools:内置工具被剔除,deny_tools 进 spec(对标 omit_tools_from)。"""
    engine, loops = _engine()
    started = await _rpc(
        engine, "thread.start", {"denyTools": ["spawn_subagent", "view_image"]}
    )
    thread = engine._threads[started["threadId"]]
    builtin_names = {getattr(d, "name", "") for d in engine._builtin_tool_definitions(thread)}
    assert "spawn_subagent" not in builtin_names
    assert "view_image" not in builtin_names
    assert "update_plan" in builtin_names  # 未被拒的仍在
    await _rpc(engine, "thread.prompt", {"threadId": started["threadId"], "input": "hi"}, req_id=2)
    assert loops[0].spec["deny_tools"] == ["spawn_subagent", "view_image"]


@pytest.mark.asyncio
async def test_tools_whitelist_gates_builtins():
    """tools 白名单不含内置工具名时不注入(显式列入才启用)。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {"tools": ["update_plan"]})
    thread = engine._threads[started["threadId"]]
    builtin_names = {getattr(d, "name", "") for d in engine._builtin_tool_definitions(thread)}
    assert builtin_names == {"update_plan"}


# =============================================================================
# engine 事件面:environment_context / turn.usage
# =============================================================================


@pytest.mark.asyncio
async def test_environment_context_and_turn_usage_emitted():
    """prompt 每轮发 environment_context;回合结束发 turn.usage(对标 TokenCount)。"""
    engine, _ = _engine()
    notifications: list[dict[str, Any]] = []

    async def _emit(message: dict[str, Any]) -> None:
        notifications.append(message)

    started = await _rpc(engine, "thread.start", {"workspace": "G:/demo"})
    tid = started["threadId"]
    response = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "thread.prompt",
            "params": {"threadId": tid, "input": "hi"},
        },
        _emit,
    )
    assert response is not None and "error" not in response
    events = [
        n["params"] for n in notifications if n.get("method") == "thread/event"
    ]
    env = [e for e in events if e["event"] == "environment_context"]
    assert len(env) == 1
    assert env[0]["payload"]["workspace"] == "G:/demo"
    assert "cwd" in env[0]["payload"] and "timestamp" in env[0]["payload"]
    usage = [e for e in events if e["event"] == "turn.usage"]
    assert len(usage) == 1
    assert usage[0]["payload"]["totalTokens"] == 123
    assert usage[0]["payload"]["iterations"] == 0
    # 结果体同样带 usage 字段(客户端不订阅通知也能拿到)
    result_payload = response["result"]
    assert result_payload["usage"]["totalTokens"] == 123


# =============================================================================
# 引擎内置工具:update_plan / spawn_subagent / view_image
# =============================================================================


def _find_builtin(engine: AgentEngine, thread: Any, name: str) -> Any:
    for definition in engine._builtin_tool_definitions(thread):
        if getattr(definition, "name", "") == name:
            return definition
    raise AssertionError(f"内置工具未注入: {name}")


@pytest.mark.asyncio
async def test_update_plan_tool_writes_plan_and_emits_notification():
    """update_plan:全量覆盖写入 thread.plan + 发 plan.update 通知;非法状态拒绝。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    notifications: list[dict[str, Any]] = []

    async def _emit(message: dict[str, Any]) -> None:
        notifications.append(message)

    thread.emit = _emit
    tool = _find_builtin(engine, thread, "update_plan")
    result = await tool.executor(
        {
            "plan": [
                {"step": "调研", "status": "completed"},
                {"step": "实现", "status": "in_progress"},
                {"step": "验证"},
            ],
            "explanation": "推进中",
        }
    )
    assert result["saved"] is True
    assert thread.plan is not None and len(thread.plan) == 3
    assert thread.plan[2] == {"step": "验证", "status": "pending"}  # 缺省补 pending
    plan_events = [
        n["params"]
        for n in notifications
        if n.get("method") == "thread/event" and n["params"].get("event") == "plan.update"
    ]
    assert len(plan_events) == 1 and len(plan_events[0]["payload"]["plan"]) == 3
    # 读取面:thread.plan RPC
    read = await _rpc(engine, "thread.plan", {"threadId": thread.thread_id}, req_id=2)
    assert read["plan"] == thread.plan
    with pytest.raises(Exception, match="status 非法"):
        await tool.executor({"plan": [{"step": "x", "status": "doing"}]})


@pytest.mark.asyncio
async def test_spawn_subagent_runs_headless_and_respects_depth_limit():
    """spawn_subagent:嵌套一次性执行返回结构化结果;深度上限 2 拒绝递归失控。"""
    engine, loops = _engine()
    started = await _rpc(engine, "thread.start", {"model": "parent-model"})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "spawn_subagent")
    result = await tool.executor({"prompt": "独立完成子任务", "maxIterations": 3})
    assert result["success"] is True
    assert result["response"] == "done"
    assert result["usage"]["totalTokens"] == 123
    assert result["threadId"].startswith("thr_")
    assert result["threadId"] not in engine._threads  # 跑完即弃(与 agent.exec 同语义)
    assert loops[-1].spec["model"] == "parent-model"  # 未指定 model 继承父线程

    # 深度上限:depth 已到 2 → 拒绝派生
    thread.depth = 2
    blocked = await tool.executor({"prompt": "再嵌一层"})
    assert "上限" in str(blocked.get("error", ""))
    assert engine._threads[started["threadId"]].depth == 2


@pytest.mark.asyncio
async def test_view_image_workspace_containment(tmp_path):
    """view_image:工作区内图片返回 dataUrl;越界路径 / 缺文件 / 非图片类型拒绝。"""
    engine, _ = _engine()
    workspace = tmp_path / "ws"
    workspace.mkdir()
    (workspace / "pic.png").write_bytes(b"\x89PNG fake-bytes")
    (workspace / "notes.txt").write_text("plain")
    started = await _rpc(engine, "thread.start", {"workspace": str(workspace)})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "view_image")

    ok = await tool.executor({"path": "pic.png"})
    assert ok["mimeType"] == "image/png"
    assert ok["sizeBytes"] == len(b"\x89PNG fake-bytes")
    expected = "data:image/png;base64," + base64.b64encode(b"\x89PNG fake-bytes").decode()
    assert ok["dataUrl"] == expected

    outside = await tool.executor({"path": str(tmp_path / "evil.png")})
    assert "越出工作区" in str(outside.get("error", ""))
    missing = await tool.executor({"path": "nope.png"})
    assert "不存在" in str(missing.get("error", ""))
    wrong_type = await tool.executor({"path": "notes.txt"})
    assert "不支持的图片类型" in str(wrong_type.get("error", ""))


# =============================================================================
# thread.compact / thread.export
# =============================================================================


@pytest.mark.asyncio
async def test_thread_compact_compresses_long_history_and_emits_event():
    """thread.compact:长历史强制触发确定性压缩 + context.compacted 通知;短对话不压。"""
    engine, _ = _engine()
    notifications: list[dict[str, Any]] = []

    async def _emit(message: dict[str, Any]) -> None:
        notifications.append(message)

    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    thread.messages = [
        {"role": "system", "content": "sys"},
        *[
            {"role": r, "content": f"{r}-{'x' * 500}-{i}"}
            for i in range(40)
            for r in ("user", "assistant")
        ],
    ]
    compacted: list[dict[str, Any]] = []

    async def _compact_emit(message: dict[str, Any]) -> None:
        notifications.append(message)
        if (
            message.get("method") == "thread/event"
            and message["params"].get("event") == "context.compacted"
        ):
            compacted.append(message["params"])

    response = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "thread.compact",
            "params": {"threadId": thread.thread_id, "keepRecent": 6},
        },
        _compact_emit,
    )
    assert response is not None and "error" not in response, response
    result = response["result"]
    assert result["compressed"] is True
    assert result["afterMessages"] < result["beforeMessages"]
    assert engine._threads[thread.thread_id].messages is not None
    assert len(engine._threads[thread.thread_id].messages) == result["afterMessages"]
    compacted = [
        n["params"]
        for n in notifications
        if n.get("method") == "thread/event"
        and n["params"].get("event") == "context.compacted"
    ]
    assert len(compacted) == 1

    # 短对话:无需压缩(compressed=False,不误伤)
    started2 = await _rpc(engine, "thread.start", {}, req_id=3)
    short = await _rpc(
        engine, "thread.compact", {"threadId": started2["threadId"]}, req_id=4
    )
    assert short["compressed"] is False


@pytest.mark.asyncio
async def test_thread_export_jsonl_from_store_and_file(tmp_path):
    """thread.export:store items 全量导出 JSONL;path 落盘;行均可 JSON 解析。"""
    store = SessionStore(str(tmp_path / "s.db"))
    engine, _ = _engine(store)
    started = await _rpc(engine, "thread.start", {"userId": "u1"})
    tid = started["threadId"]
    await _rpc(engine, "thread.prompt", {"threadId": tid, "input": "导出我"}, req_id=2)

    out_file = tmp_path / "rollout.jsonl"
    exported = await _rpc(
        engine, "thread.export", {"threadId": tid, "path": str(out_file)}, req_id=3
    )
    assert exported["format"] == "jsonl"
    assert exported["count"] >= 2  # user_message + agent_message
    assert exported["path"] == str(out_file)
    parsed = [json.loads(line) for line in exported["lines"]]
    types = {row.get("item_type") for row in parsed}
    assert "user_message" in types and "agent_message" in types
    on_disk = [json.loads(line) for line in out_file.read_text(encoding="utf-8").splitlines()]
    assert len(on_disk) == exported["count"]
    store.close()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
