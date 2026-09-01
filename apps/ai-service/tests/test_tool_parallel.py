# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠



"""P1-2 工具并行执行测试。

覆盖:
- conversation.chat:同轮 3 工具并发执行(结果顺序与 tool_calls 一致)
- conversation.chat:单工具失败不影响其他 + 失败 error 正确回灌
- conversation.chat:幂等只读工具失败自动重试 1 次,写工具不重试
- conversation.chat:单轮最大并行 5,超出分批
- agent_loop.run:同轮工具并发执行 + steps 顺序保持 + 白名单外跳过

测试通过 mock llm_gateway.complete 与 mcp_server.call_tool,
用共享计数 mock 判定并发(串行实现下最大并发=1,并行=工具数)。
"""

from __future__ import annotations

import asyncio

import pytest

from app.services import agent_loop as agent_loop_mod
from app.services import conversation as conv_mod
from app.services.agent_loop import AgentExecutor
from app.services.conversation import ConversationService
from app.services.memory import memory_store
from app.services.vector_memory import vector_memory


@pytest.fixture(autouse=True)
def _clear_singletons():
    """清理单例状态,避免测试间污染。"""
    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()
    vector_memory._entries.clear()
    vector_memory._vectors.clear()
    yield
    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()
    vector_memory._entries.clear()
    vector_memory._vectors.clear()


@pytest.fixture
def silence_meta_eval(monkeypatch):
    """屏蔽 agent_loop 完成后的自进化后台任务(与并行行为无关,避免噪音)。

    run() 完成后 fire-and-forget 触发 meta_learner.evaluate_and_record,
    其内部 self_evaluator 对含工具 steps 的 task_result 有预存 bug(与本次
    改动无关,self_evaluator.py 不在本次可改范围),后台抛异常污染测试日志。
    这里仅 mock 掉后台评估,聚焦并行行为本身。
    """

    async def _noop(*args, **kwargs):
        return None

    monkeypatch.setattr(agent_loop_mod.meta_learner, "evaluate_and_record", _noop)


def _tool_calls(*names: str) -> list[dict]:
    """构造 OpenAI tool_calls 格式(按传入顺序)。"""
    out = []
    for i, name in enumerate(names):
        out.append({
            "id": f"call_{i + 1}",
            "type": "function",
            "function": {"name": name, "arguments": '{"q":"x"}'},
        })
    return out


def _make_counting_call_tool(sleep: float = 0.02) -> tuple[dict, object]:
    """构造计数型 call_tool mock。

    共享计数 + 等长 sleep:并发执行时 max_concurrent = 并行数,
    串行执行时 max_concurrent = 1 —— 确定性判定并发,无需时间戳竞态。
    """
    state: dict = {"active": 0, "max_concurrent": 0, "names": []}

    async def fake_call_tool(name: str, args: dict | None = None) -> dict:
        state["active"] += 1
        state["max_concurrent"] = max(state["max_concurrent"], state["active"])
        state["names"].append(name)
        await asyncio.sleep(sleep)
        state["active"] -= 1
        return {"ok": True, "tool": name, "args": args or {}}

    return state, fake_call_tool


def _make_complete_with_tool_calls(tool_calls: list[dict]) -> tuple[dict, dict]:
    """构造 complete mock:call1=intent, call2=tool_calls, 之后 summarize。

    返回 (state, fake_complete);state["last_messages"] 记录每次入参。
    """
    state: dict = {"calls": 0, "last_messages": None}

    async def fake_complete(messages, model=None, **kwargs):
        state["calls"] += 1
        state["last_messages"] = list(messages)
        if state["calls"] == 1:
            return {
                "content": '{"intent":"tool_use","confidence":0.9,"needs_tool":true,'
                           '"suggested_tools":[]}',
                "model": model or "m",
            }
        if state["calls"] == 2:
            return {"content": "调用工具中", "model": model or "m", "tool_calls": tool_calls}
        return {"content": "全部完成", "model": model or "m"}

    return state, fake_complete


# =============================================================================
# conversation.py 并行执行
# =============================================================================


@pytest.mark.asyncio
async def test_conversation_parallel_execution(monkeypatch):
    """同轮 3 工具并发执行:结果顺序与 tool_calls 一致,trace 标记 parallel。"""
    calls = _tool_calls("web_search", "knowledge_lookup", "read_file")
    state, fake_complete = _make_complete_with_tool_calls(calls)
    tool_state, fake_call_tool = _make_counting_call_tool()
    monkeypatch.setattr(conv_mod.llm_gateway, "complete", fake_complete)
    monkeypatch.setattr(conv_mod.mcp_server, "call_tool", fake_call_tool)

    svc = ConversationService()
    result = await svc.chat(
        user_input="并行测试",
        session_id="conv-par-1",
        allowed_tools=["web_search"],
        max_iterations=1,
    )

    # 3 个工具全部执行且顺序与 tool_calls 一致(仅执行并发,结果按原顺序回灌)
    assert [tc.tool for tc in result.tool_calls] == ["web_search", "knowledge_lookup", "read_file"]
    assert all(tc.ok for tc in result.tool_calls)
    # 计数 mock 证明 3 个调用真实并发(串行实现 max_concurrent=1)
    assert tool_state["max_concurrent"] == 3
    assert tool_state["names"] == ["web_search", "knowledge_lookup", "read_file"]
    # trace 按工具逐个记录,带 parallel 标记
    tool_traces = [t for t in result.trace if t["node"] == "tool_execute"]
    assert len(tool_traces) == 3
    assert all(t.get("parallel") is True for t in tool_traces)
    # summarize 入参含 3 条 tool 消息,顺序与 tool_call_id 对应
    assert state["calls"] == 3
    tool_msgs = [m for m in state["last_messages"] if m.get("role") == "tool"]
    assert [m["tool_call_id"] for m in tool_msgs] == ["call_1", "call_2", "call_3"]
    assert [m["name"] for m in tool_msgs] == ["web_search", "knowledge_lookup", "read_file"]
    for m in tool_msgs:
        assert m["name"] in m["content"]


@pytest.mark.asyncio
async def test_conversation_single_tool_failure(monkeypatch):
    """单工具失败不影响其他工具,失败 error 正确回灌。"""
    calls = _tool_calls("web_search", "knowledge_lookup", "read_file")
    state, fake_complete = _make_complete_with_tool_calls(calls)
    monkeypatch.setattr(conv_mod.llm_gateway, "complete", fake_complete)

    async def fake_call_tool(name: str, args: dict | None = None) -> dict:
        if name == "read_file":
            return {
                "ok": False, "error": "file not found",
                "errorCode": "FILE_NOT_FOUND", "tool": name,
            }
        return {"ok": True, "tool": name}

    monkeypatch.setattr(conv_mod.mcp_server, "call_tool", fake_call_tool)

    svc = ConversationService()
    result = await svc.chat(
        user_input="失败测试",
        session_id="conv-fail-1",
        allowed_tools=["web_search"],
        max_iterations=1,
    )

    # 其他工具正常,read_file 单独失败
    assert [tc.tool for tc in result.tool_calls] == ["web_search", "knowledge_lookup", "read_file"]
    assert result.tool_calls[0].ok is True
    assert result.tool_calls[1].ok is True
    assert result.tool_calls[2].ok is False
    # trace 记录失败工具
    tool_traces = [t for t in result.trace if t["node"] == "tool_execute"]
    fail_trace = next(t for t in tool_traces if t["tool"] == "read_file")
    assert fail_trace["ok"] is False
    assert fail_trace["_tool_error"] == "file not found"
    # 回灌消息含失败标注,防止 LLM 幻觉"已完成"
    tool_msgs = [m for m in state["last_messages"] if m.get("role") == "tool"]
    fail_msg = next(m for m in tool_msgs if m["tool_call_id"] == "call_3")
    assert "TOOL EXECUTION FAILED" in fail_msg["content"]
    assert "FILE_NOT_FOUND" in fail_msg["content"]


@pytest.mark.asyncio
async def test_retry_idempotent_readonly_tool(monkeypatch):
    """web_search 首次失败自动重试 1 次并成功。"""
    calls = _tool_calls("web_search")
    state, fake_complete = _make_complete_with_tool_calls(calls)
    monkeypatch.setattr(conv_mod.llm_gateway, "complete", fake_complete)
    counters = {"n": 0}

    async def fake_call_tool(name: str, args: dict | None = None) -> dict:
        counters["n"] += 1
        if counters["n"] == 1:
            return {"ok": False, "error": "transient timeout"}
        return {"ok": True, "tool": name}

    monkeypatch.setattr(conv_mod.mcp_server, "call_tool", fake_call_tool)

    svc = ConversationService()
    result = await svc.chat(
        user_input="重试测试",
        session_id="conv-retry-1",
        allowed_tools=["web_search"],
        max_iterations=1,
    )
    assert counters["n"] == 2  # 失败 1 次 + 重试 1 次
    assert result.tool_calls[0].ok is True


@pytest.mark.asyncio
async def test_no_retry_for_write_tools(monkeypatch):
    """写操作工具(write_file)失败不重试,仅调用 1 次。"""
    calls = _tool_calls("write_file", "web_search")
    state, fake_complete = _make_complete_with_tool_calls(calls)
    monkeypatch.setattr(conv_mod.llm_gateway, "complete", fake_complete)
    counters = {"n": 0}

    async def fake_call_tool(name: str, args: dict | None = None) -> dict:
        counters["n"] += 1
        if name == "write_file":
            return {"ok": False, "error": "permission denied", "tool": name}
        return {"ok": True, "tool": name}

    monkeypatch.setattr(conv_mod.mcp_server, "call_tool", fake_call_tool)

    svc = ConversationService()
    result = await svc.chat(
        user_input="写工具测试",
        session_id="conv-write-1",
        allowed_tools=["write_file", "web_search"],
        max_iterations=1,
    )
    assert counters["n"] == 2  # 各调用一次,write_file 不重试
    assert result.tool_calls[0].ok is False
    assert result.tool_calls[1].ok is True


@pytest.mark.asyncio
async def test_conversation_max_parallel_batch(monkeypatch):
    """7 个工具按每批 5 分批执行,最大并发不超过 5。"""
    calls = _tool_calls(*[f"tool_{i}" for i in range(7)])
    state, fake_complete = _make_complete_with_tool_calls(calls)
    tool_state, fake_call_tool = _make_counting_call_tool(sleep=0.03)
    monkeypatch.setattr(conv_mod.llm_gateway, "complete", fake_complete)
    monkeypatch.setattr(conv_mod.mcp_server, "call_tool", fake_call_tool)

    svc = ConversationService()
    result = await svc.chat(
        user_input="批量测试",
        session_id="conv-batch-1",
        allowed_tools=["web_search"],
        max_iterations=1,
    )

    assert [tc.tool for tc in result.tool_calls] == [f"tool_{i}" for i in range(7)]
    assert all(tc.ok for tc in result.tool_calls)
    # 第一批 5 个并发;若不分批,7 个会同时执行 → max_concurrent=7
    assert tool_state["max_concurrent"] == 5
    assert len(tool_state["names"]) == 7


# =============================================================================
# agent_loop.py 并行执行
# =============================================================================


@pytest.mark.asyncio
async def test_agent_loop_parallel_execution(monkeypatch, silence_meta_eval):
    """agent_loop 同轮工具并发执行,steps 顺序保持 tool_calls 顺序。"""
    tool_calls = _tool_calls("web_search", "knowledge_lookup", "read_file")
    state: dict = {"calls": 0}

    async def fake_complete(messages, model=None, **kwargs):
        state["calls"] += 1
        if state["calls"] == 1:
            return {"content": "调用工具", "model": "m", "tool_calls": tool_calls}
        return {"content": "完成", "model": "m"}

    tool_state, fake_call_tool = _make_counting_call_tool()
    monkeypatch.setattr(agent_loop_mod.llm_gateway, "complete", fake_complete)
    monkeypatch.setattr(agent_loop_mod.mcp_server, "call_tool", fake_call_tool)

    executor = AgentExecutor()
    result = await executor.run(
        "并行测试", max_iterations=2, tools=["web_search", "knowledge_lookup", "read_file"]
    )

    assert result["status"] == "completed"
    tool_steps = [s for s in result["steps"] if s["type"] == "tool"]
    assert [s["tool_name"] for s in tool_steps] == ["web_search", "knowledge_lookup", "read_file"]
    assert all(s["status"] == "ok" for s in tool_steps)
    assert tool_state["max_concurrent"] == 3
    assert tool_state["names"] == ["web_search", "knowledge_lookup", "read_file"]


@pytest.mark.asyncio
async def test_agent_loop_single_tool_failure(monkeypatch, silence_meta_eval):
    """agent_loop 单工具异常不影响其他,错误回填不中断循环。"""
    tool_calls = _tool_calls("web_search", "knowledge_lookup", "read_file")
    state: dict = {"calls": 0}

    async def fake_complete(messages, model=None, **kwargs):
        state["calls"] += 1
        if state["calls"] == 1:
            return {"content": "调用工具", "model": "m", "tool_calls": tool_calls}
        return {"content": "完成", "model": "m"}

    async def fake_call_tool(name: str, args: dict | None = None) -> dict:
        if name == "read_file":
            raise RuntimeError("boom")
        return {"ok": True, "tool": name}

    monkeypatch.setattr(agent_loop_mod.llm_gateway, "complete", fake_complete)
    monkeypatch.setattr(agent_loop_mod.mcp_server, "call_tool", fake_call_tool)

    executor = AgentExecutor()
    result = await executor.run(
        "失败测试", max_iterations=2, tools=["web_search", "knowledge_lookup", "read_file"]
    )

    assert result["status"] == "completed"
    tool_steps = [s for s in result["steps"] if s["type"] == "tool"]
    assert [s["tool_name"] for s in tool_steps] == ["web_search", "knowledge_lookup", "read_file"]
    assert tool_steps[0]["status"] == "ok"
    assert tool_steps[1]["status"] == "ok"
    assert tool_steps[2]["status"] == "error"
    assert "工具 read_file 执行失败" in tool_steps[2]["content"]


@pytest.mark.asyncio
async def test_agent_loop_skip_outside_whitelist(monkeypatch, silence_meta_eval):
    """白名单外工具跳过(不执行),白名单内工具仍并行执行。"""
    tool_calls = _tool_calls("web_search", "write_file")
    state: dict = {"calls": 0}

    async def fake_complete(messages, model=None, **kwargs):
        state["calls"] += 1
        if state["calls"] == 1:
            return {"content": "调用工具", "model": "m", "tool_calls": tool_calls}
        return {"content": "完成", "model": "m"}

    executed: list[str] = []

    async def fake_call_tool(name: str, args: dict | None = None) -> dict:
        executed.append(name)
        return {"ok": True, "tool": name}

    monkeypatch.setattr(agent_loop_mod.llm_gateway, "complete", fake_complete)
    monkeypatch.setattr(agent_loop_mod.mcp_server, "call_tool", fake_call_tool)

    executor = AgentExecutor()
    result = await executor.run("跳过测试", max_iterations=2, tools=["web_search"])

    assert result["status"] == "completed"
    tool_steps = [s for s in result["steps"] if s["type"] == "tool"]
    assert [s["tool_name"] for s in tool_steps] == ["web_search", "write_file"]
    assert tool_steps[0]["status"] == "ok"
    assert tool_steps[1]["status"] == "skipped"
    assert "不在白名单" in tool_steps[1]["content"]
    assert executed == ["web_search"]  # write_file 未执行
