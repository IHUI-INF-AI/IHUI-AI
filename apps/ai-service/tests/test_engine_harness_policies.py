# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Harness 对标收尾(2026-09-18):Codex harness 剩余五项能力落地单测。

覆盖:
- 工具级审批策略(per-tool approval_policy: never/on-request/always,显式配置
  优先于模式隐含与高危清单;loop 侧消费 + engine 侧 spec 传递)
- Turn Context 冻结(每轮快照;checkpoint resume 强制用冻结副本防串台)
- headless 一次性执行(agent.exec:跑完即弃 + 结构化结果 + 持久化留痕)
- 服务端 system prompt 锁定(防客户端覆盖安全提示)
- 结构化策略配置(policyToml TOML 解析,对标 Codex config.toml)
"""

import asyncio
from typing import Any

import pytest

from app.services.agent_engine import INVALID_PARAMS, AgentEngine
from app.services.agent_loop_v2 import (
    AgentLoopV2,
    ToolCall,
    ToolDefinition,
    resolve_approval_response,
)
from app.services.session_store import SessionStore

THREAD_NOT_FOUND = -32001

# =============================================================================
# loop 侧:工具级审批策略消费
# =============================================================================


@pytest.fixture(autouse=True)
def _mock_hook_engine(monkeypatch):
    """替换 agent_loop_v2 的 hook_engine(不真广播,记录审批事件)。"""
    emitted: list[dict] = []

    class FakeHookEngine:
        async def emit(self, event, context):
            emitted.append({"event": event, **context})
            return []

    monkeypatch.setattr("app.services.agent_loop_v2.hook_engine", FakeHookEngine())
    monkeypatch.setattr("app.services.agent_loop_v2._approval_registry", {})
    yield {"emitted": emitted}


def _last_approval(emitted: list[dict]) -> dict:
    for item in reversed(emitted):
        if item["event"] == "tool.approval":
            return item
    raise AssertionError("未找到 tool.approval 事件")


async def test_policy_never_skips_approval_for_high_risk_tool():
    """never:高危工具免审直接执行(decision hint 记录覆盖决策)。"""
    executed: list[str] = []

    async def _exec(args):
        executed.append("ran")
        return {"ok": True}

    loop = AgentLoopV2(
        None,
        [ToolDefinition(name="run_command", description="命令", parameters={}, executor=_exec)],
        approval_enabled=True,
        approval_timeout=5,
        approval_policies={"run_command": "never"},
        # 2026-09-26 V3 #47 第二格:run_command ∈ _ADMIN_ONLY_TOOLS,而角色闸排在审批闸之前。
        # 本例测的是 approval_policy=never 覆盖审批档,不是覆盖角色 —— 所以前置条件是
        # "调用者本来就有这个权"(role=1),而不是把角色闸一起免掉。
        # never ≠ admin:免审只免"要不要问用户",从未免"你有没有资格"。
        user_role=1,
    )
    tr = await loop._execute_single(ToolCall(id="c1", name="run_command", args={"command": "ls"}))
    assert tr.error is None and tr.result == {"ok": True}
    assert executed == ["ran"]
    assert loop._decision_hints["c1"][0] == "approval_policy_never"


async def test_policy_always_forces_approval_for_low_risk_tool(_mock_hook_engine):
    """always:低危工具也强制人工审批,批准后正常执行。"""
    emitted = _mock_hook_engine["emitted"]

    async def _exec(args):
        return {"ok": True}

    loop = AgentLoopV2(
        None,
        [ToolDefinition(name="web_search", description="搜索", parameters={}, executor=_exec)],
        approval_enabled=True,
        approval_timeout=5,
        approval_policies={"web_search": "always"},
    )
    tc = ToolCall(id="c1", name="web_search", args={"q": "x"})
    task = asyncio.create_task(loop._execute_single(tc))
    await asyncio.sleep(0)
    ctx = _last_approval(emitted)
    assert ctx["tool_name"] == "web_search"
    resolve_approval_response(ctx["approval_id"], "approve")
    tr = await task
    assert tr.error is None and tr.result == {"ok": True}
    assert loop._decision_hints["c1"][0] == "approval_policy_always"


def test_policy_invalid_value_raises():
    """非法策略值构造期 fail-fast。"""
    with pytest.raises(ValueError, match="approval_policy"):
        AgentLoopV2(None, [], approval_policies={"x": "maybe"})


def test_policy_on_request_keeps_default_behavior():
    """on-request:与现状一致(低危免审)。"""
    loop = AgentLoopV2(None, [], approval_policies={"web_search": "on-request"})
    assert loop._approval_policies == {"web_search": "on-request"}


# =============================================================================
# engine 侧:策略解析 / 冻结 / headless / prompt 锁定
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
    total_tokens_used = 1
    checkpoint_id = None
    error = None
    budget = None
    compaction_events: list[Any] = []


def _engine(store: SessionStore | None = None, **kwargs: Any) -> tuple[AgentEngine, list[_FakeLoop]]:
    loops: list[_FakeLoop] = []

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop()
        loop.spec = spec
        loops.append(loop)
        return loop

    if store is not None:
        kwargs["store"] = store
    return AgentEngine(loop_factory=factory, **kwargs), loops


async def _rpc(engine: AgentEngine, method: str, params: dict[str, Any], req_id: int = 1) -> dict[str, Any]:
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
    )
    assert response is not None and "error" not in response, response
    return response["result"]


@pytest.mark.asyncio
async def test_policy_config_parsed_into_spec():
    """三种策略形态(approvalPolicy/toolApprovalPolicies/policyToml)解析并传入 spec。"""
    engine, loops = _engine()
    started = await _rpc(
        engine,
        "thread.start",
        {
            "approvalPolicy": "on-request",
            "toolApprovalPolicies": {"run_command": "always"},
            "policyToml": '[tools.write_file]\napproval_policy = "never"\n',
        },
    )
    assert started["approvalPolicies"] == {
        "*": "on-request",
        "run_command": "always",
        "write_file": "never",
    }
    result = await _rpc(
        engine, "thread.prompt", {"threadId": started["threadId"], "input": "hi"}, req_id=2
    )
    assert result["success"] is True
    spec = loops[0].spec
    assert spec["approval_policies"]["run_command"] == "always"
    assert spec["approval_policies"]["write_file"] == "never"


@pytest.mark.asyncio
async def test_policy_bad_toml_and_bad_value_rejected():
    """非法 TOML / 非法策略值 → INVALID_PARAMS(-32602)。"""
    engine, _ = _engine()
    for bad_params in (
        {"policyToml": "[tools.x\nbroken"},
        {"toolApprovalPolicies": {"x": "maybe"}},
        {"approvalPolicy": "sometimes"},
    ):
        response = await engine.handle_message(
            {"jsonrpc": "2.0", "id": 1, "method": "thread.start", "params": bad_params}
        )
        assert response is not None and response["error"]["code"] == INVALID_PARAMS, bad_params


@pytest.mark.asyncio
async def test_locked_system_prompt_overrides_client(tmp_path):
    """服务端锁定 prompt:客户端 systemPrompt 被忽略,来源标注 server-locked。"""
    store = SessionStore(str(tmp_path / "s.db"))
    engine, loops = _engine(store, locked_system_prompt="SERVER SECURITY PROMPT")
    started = await _rpc(
        engine, "thread.start", {"systemPrompt": "客户端恶意覆盖", "userId": "u1"}
    )
    assert started["systemPromptSource"] == "server-locked"
    result = await _rpc(
        engine, "thread.prompt", {"threadId": started["threadId"], "input": "hi"}, req_id=2
    )
    assert result["success"] is True
    # spec 消息与持久化 metadata 都是服务端值
    assert loops[0].spec  # 已构造
    restored = [(m.role, m.content) for m in store.resume(started["threadId"])]
    assert ("user", "hi") in restored
    assert all("恶意覆盖" not in c for _, c in restored)
    thread_row = store.get_thread(started["threadId"])
    assert thread_row is not None
    assert thread_row.metadata["systemPrompt"] == "SERVER SECURITY PROMPT"
    assert thread_row.metadata["systemPromptSource"] == "server-locked"
    store.close()


@pytest.mark.asyncio
async def test_turn_context_freeze_on_resume():
    """checkpoint resume 强制用冻结副本:interrupt 后改配置不串台。"""
    engine, loops = _engine()
    started = await _rpc(engine, "thread.start", {"model": "model-A"})
    tid = started["threadId"]
    await _rpc(engine, "thread.prompt", {"threadId": tid, "input": "第一轮"}, req_id=2)
    assert loops[0].spec["model"] == "model-A"

    # 轮间客户端改配置 → 新一轮用新值(每轮刷新快照)
    thread = engine._threads[tid]
    thread.model = "model-B"
    await _rpc(engine, "thread.prompt", {"threadId": tid, "input": "第二轮"}, req_id=3)
    assert loops[1].spec["model"] == "model-B"

    # resume(模拟 interrupt→checkpoint 续跑):即使配置再被改,用冻结副本
    thread.model = "model-C"
    result = await _rpc(
        engine,
        "thread.resume",
        {"threadId": tid, "checkpointId": "cp_x"},
        req_id=4,
    )
    assert result["success"] is True
    assert loops[2].spec["model"] == "model-B"  # 冻结副本(model-B),非 model-C
    assert engine._threads[tid].model == "model-B"  # 线程配置被还原


@pytest.mark.asyncio
async def test_headless_exec_run_and_discard(tmp_path):
    """agent.exec:一次性执行返回结构化结果,线程出内存,store 留痕可恢复。"""
    store = SessionStore(str(tmp_path / "s.db"))
    engine, loops = _engine(store)
    result = await _rpc(
        engine, "agent.exec", {"input": "只跑这一轮", "model": "gpt-x"}, req_id=1
    )
    assert result["headless"] is True
    assert result["success"] is True
    assert result["finalResponse"] == "done"
    assert result["threadId"].startswith("thr_")
    assert loops[0].spec["model"] == "gpt-x"
    # 跑完即弃:线程已出内存
    assert result["threadId"] not in engine._threads
    # 但 store 留痕(审计):thread.state 未命中内存 → 按需从库恢复成功
    state = await _rpc(
        engine, "thread.state", {"threadId": result["threadId"]}, req_id=2
    )
    assert state["status"] == "idle"
    assert state["threadId"] == result["threadId"]
    assert engine._threads[result["threadId"]].prompts == 0  # 恢复态,非原运行线程
    # 但 store 留痕(审计),新引擎可恢复续查
    thread_row = store.get_thread(result["threadId"])
    assert thread_row is not None and thread_row.item_count >= 2
    history = [(m.role, m.content) for m in store.resume(result["threadId"])]
    assert ("user", "只跑这一轮") in history
    store.close()


@pytest.mark.asyncio
async def test_headless_exec_requires_input():
    """空 input → INVALID_PARAMS。"""
    engine, _ = _engine()
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 1, "method": "agent.exec", "params": {"input": "   "}}
    )
    assert response is not None and response["error"]["code"] == INVALID_PARAMS
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
