"""agent_graph 综合测试(2026-07-23 立,补齐 Agent Runtime LangGraph 状态机零覆盖)。

源码:app/services/agent_graph.py(91 行,plan → execute → summarize 流水线最小实现)。

覆盖维度(33 cases):
1. 常量与类型:_DEFAULT_MODEL 字符串值 / AgentState TypedDict 字段集合 / total=False(3 tests)
2. plan_node:bypassPermissions 短路 / manual 短路 / default LLM 成功 / 异常降级 / 非 dict 返回 / 缺 content 字段 / 空 messages / mode 未设默认 default(8 tests)
3. execute_node:skip-planning 直跑 / 空 plan 直跑 / 非空 plan 注入 system 消息 / LLM 异常降级 / 非 dict 返回 / model 传递(6 tests)
4. summarize_node:有 execution_result 原样返回 / 空 execution_result 返回空 summary / 缺字段降级 / 不调用 LLM(4 tests)
5. should_continue 路由:plan failed → summarize / execute failed → execute / 无 error → execute / error=None(4 tests)
6. build_agent_graph:编译成功 / 节点结构正确 / 端到端 plan 成功路径(3 tests)
7. 单例机制:get_agent_graph 首次构建 / 单例缓存 / reset 后重建新实例(3 tests)
8. 完整流水线集成:plan 失败短路 plan→summarize / execute 异常仍进 summarize / bypassPermissions 全链路(3 tests)
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services.agent_graph import (
    AgentState,
    _DEFAULT_MODEL,
    build_agent_graph,
    execute_node,
    get_agent_graph,
    plan_node,
    reset_agent_graph_for_test,
    should_continue,
    summarize_node,
)


# =============================================================================
# 工厂函数
# =============================================================================


def make_state(
    messages: list[dict] | None = None,
    mode: str = "default",
    session_id: str = "s1",
    plan: str = "",
    execution_result: str = "",
    summary: str = "",
    error: str | None = None,
) -> AgentState:
    """构造 AgentState 测试输入。"""
    return {
        "messages": messages if messages is not None else [
            {"role": "user", "content": "hello"},
        ],
        "mode": mode,
        "session_id": session_id,
        "plan": plan,
        "execution_result": execution_result,
        "summary": summary,
        "error": error,
    }


# =============================================================================
# 1. 常量与类型(3 tests)
# =============================================================================


class TestConstantsAndTypes:
    """_DEFAULT_MODEL 常量 + AgentState TypedDict 字段定义。"""

    def test_default_model_value(self):
        """_DEFAULT_MODEL 应为 stepfun/step-3.7-flash(与源码常量一致)。"""
        assert _DEFAULT_MODEL == "stepfun/step-3.7-flash"
        assert isinstance(_DEFAULT_MODEL, str)

    def test_agent_state_annotations_contain_all_fields(self):
        """AgentState 必须声明 7 个字段(messages/mode/session_id/plan/execution_result/summary/error)。"""
        fields = set(AgentState.__annotations__.keys())
        assert fields == {
            "messages", "mode", "session_id",
            "plan", "execution_result", "summary", "error",
        }

    def test_agent_state_total_false_all_fields_optional(self):
        """total=False → 所有字段可选,可构造空 dict 作 AgentState。"""
        assert AgentState.__total__ is False
        empty: AgentState = {}
        assert empty == {}


# =============================================================================
# 2. plan_node(8 tests)
# =============================================================================


class TestPlanNode:
    """plan_node:规划节点,基于 mode 决定短路或调用 LLM。"""

    @pytest.mark.asyncio
    async def test_bypass_permissions_mode_short_circuits(self):
        """mode=bypassPermissions → 直接返回 skip-planning,不调 LLM。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(return_value={"content": "should not be called"})
            result = await plan_node(make_state(mode="bypassPermissions"))
        assert result == {"plan": "skip-planning"}
        mock_llm.complete.assert_not_called()

    @pytest.mark.asyncio
    async def test_manual_mode_short_circuits(self):
        """mode=manual → 直接返回 skip-planning,不调 LLM。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(return_value={"content": "x"})
            result = await plan_node(make_state(mode="manual"))
        assert result == {"plan": "skip-planning"}
        mock_llm.complete.assert_not_called()

    @pytest.mark.asyncio
    async def test_default_mode_calls_llm_and_returns_content(self):
        """mode=default → 调用 LLM,返回 content.strip()。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(return_value={"content": "  step1\nstep2  "})
            result = await plan_node(make_state(mode="default"))
        assert result == {"plan": "step1\nstep2"}
        mock_llm.complete.assert_awaited_once()
        # 验证 messages 参数:system 前缀 + 原 messages
        sent_messages = mock_llm.complete.call_args.args[0]
        assert sent_messages[0]["role"] == "system"
        assert "规划助手" in sent_messages[0]["content"]
        assert sent_messages[1] == {"role": "user", "content": "hello"}
        # 验证 model 传递
        assert mock_llm.complete.call_args.kwargs.get("model") == _DEFAULT_MODEL

    @pytest.mark.asyncio
    async def test_llm_exception_returns_empty_plan_with_error(self):
        """LLM 抛异常 → 返回 plan="" + error="plan failed: ..."。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(side_effect=RuntimeError("network down"))
            result = await plan_node(make_state(mode="default"))
        assert result["plan"] == ""
        assert "plan failed" in result["error"]
        assert "network down" in result["error"]

    @pytest.mark.asyncio
    async def test_llm_returns_non_dict_string_coerced(self):
        """LLM 返回非 dict(str)→ str(result) 处理。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(return_value="plain-string-plan")
            result = await plan_node(make_state(mode="default"))
        assert result == {"plan": "plain-string-plan"}

    @pytest.mark.asyncio
    async def test_llm_returns_dict_without_content_key(self):
        """LLM 返回 dict 但无 content 字段 → content="" → plan=""。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(return_value={"other": "no content here"})
            result = await plan_node(make_state(mode="default"))
        assert result == {"plan": ""}

    @pytest.mark.asyncio
    async def test_empty_messages_still_calls_llm(self):
        """空 messages 列表仍进入 LLM 调用分支(只传 system prompt)。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(return_value={"content": "empty plan"})
            result = await plan_node(make_state(messages=[], mode="default"))
        assert result == {"plan": "empty plan"}
        sent_messages = mock_llm.complete.call_args.args[0]
        assert len(sent_messages) == 1
        assert sent_messages[0]["role"] == "system"

    @pytest.mark.asyncio
    async def test_mode_unset_defaults_to_default_and_calls_llm(self):
        """mode 未设(默认 "default")→ 走 LLM 分支(与显式 default 等价)。"""
        state: AgentState = {"messages": [{"role": "user", "content": "hi"}]}
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(return_value={"content": "plan-x"})
            result = await plan_node(state)
        assert result == {"plan": "plan-x"}
        mock_llm.complete.assert_awaited_once()


# =============================================================================
# 3. execute_node(6 tests)
# =============================================================================


class TestExecuteNode:
    """execute_node:执行节点,plan 空或 skip-planning 直跑,否则注入 plan system。"""

    @pytest.mark.asyncio
    async def test_skip_planning_uses_messages_directly(self):
        """plan=skip-planning → execute_messages = list(messages),不注入 plan。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(return_value={"content": "done"})
            result = await execute_node(make_state(plan="skip-planning"))
        assert result == {"execution_result": "done"}
        sent = mock_llm.complete.call_args.args[0]
        assert len(sent) == 1
        assert sent[0] == {"role": "user", "content": "hello"}

    @pytest.mark.asyncio
    async def test_empty_plan_uses_messages_directly(self):
        """plan="" → 走 not plan 分支,直接用 messages。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(return_value={"content": "ok"})
            result = await execute_node(make_state(plan=""))
        assert result == {"execution_result": "ok"}
        sent = mock_llm.complete.call_args.args[0]
        assert len(sent) == 1

    @pytest.mark.asyncio
    async def test_non_empty_plan_injects_system_message(self):
        """plan 非空 → 注入 system 消息含 "参考执行计划" 和 plan 内容。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(return_value={"content": "  result  "})
            result = await execute_node(make_state(plan="my-plan-step"))
        assert result == {"execution_result": "result"}
        sent = mock_llm.complete.call_args.args[0]
        assert len(sent) == 2
        assert sent[0] == {"role": "user", "content": "hello"}
        injected = sent[1]
        assert injected["role"] == "system"
        assert "参考执行计划" in injected["content"]
        assert "my-plan-step" in injected["content"]
        assert mock_llm.complete.call_args.kwargs.get("model") == _DEFAULT_MODEL

    @pytest.mark.asyncio
    async def test_llm_exception_returns_empty_result_with_error(self):
        """LLM 异常 → execution_result="" + error="execute failed: ..."。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(side_effect=ValueError("boom"))
            result = await execute_node(make_state(plan="skip-planning"))
        assert result["execution_result"] == ""
        assert "execute failed" in result["error"]
        assert "boom" in result["error"]

    @pytest.mark.asyncio
    async def test_llm_returns_non_dict_string_coerced(self):
        """LLM 返回非 dict(str)→ str(result).strip()。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(return_value="  raw-string  ")
            result = await execute_node(make_state(plan="skip-planning"))
        assert result == {"execution_result": "raw-string"}

    @pytest.mark.asyncio
    async def test_model_passed_through_to_llm(self):
        """execute_node 传递 _DEFAULT_MODEL 给 llm_gateway.complete。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(return_value={"content": "x"})
            await execute_node(make_state(plan="skip-planning"))
            assert mock_llm.complete.call_args.kwargs.get("model") == _DEFAULT_MODEL


# =============================================================================
# 4. summarize_node(4 tests)
# =============================================================================


class TestSummarizeNode:
    """summarize_node:做减法,直接返回 execution_result,不调 LLM。"""

    @pytest.mark.asyncio
    async def test_non_empty_result_returns_as_summary(self):
        """非空 execution_result → 原样返回为 summary。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(return_value={"content": "should not call"})
            result = await summarize_node(make_state(execution_result="final output"))
        assert result == {"summary": "final output"}
        mock_llm.complete.assert_not_called()

    @pytest.mark.asyncio
    async def test_empty_result_returns_empty_summary(self):
        """空 execution_result → summary=""。"""
        result = await summarize_node(make_state(execution_result=""))
        assert result == {"summary": ""}

    @pytest.mark.asyncio
    async def test_missing_execution_result_returns_empty_summary(self):
        """state 缺 execution_result 字段 → state.get 返回 "" → summary=""。"""
        state: AgentState = {"messages": []}
        result = await summarize_node(state)
        assert result == {"summary": ""}

    @pytest.mark.asyncio
    async def test_does_not_invoke_llm_gateway(self):
        """summarize_node 完全不调用 LLM(避免延迟)。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock()
            await summarize_node(make_state(execution_result="x"))
            await summarize_node(make_state(execution_result=""))
            mock_llm.complete.assert_not_called()


# =============================================================================
# 5. should_continue 路由(4 tests)
# =============================================================================


class TestShouldContinue:
    """should_continue:plan 失败短路到 summarize,否则进 execute。"""

    def test_plan_failed_error_routes_to_summarize(self):
        """error 含 "plan failed" → 路由到 summarize。"""
        state = make_state(error="plan failed: LLM down")
        assert should_continue(state) == "summarize"

    def test_execute_failed_error_routes_to_execute(self):
        """error 含 "execute failed" 但非 "plan failed" → 仍进 execute。"""
        state = make_state(error="execute failed: timeout")
        assert should_continue(state) == "execute"

    def test_none_error_routes_to_execute(self):
        """error=None → 进 execute。"""
        state = make_state(error=None)
        assert should_continue(state) == "execute"

    def test_missing_error_routes_to_execute(self):
        """state 无 error 字段 → state.get("error") 返回 None → 进 execute。"""
        state: AgentState = {"messages": []}
        assert should_continue(state) == "execute"


# =============================================================================
# 6. build_agent_graph(3 tests)
# =============================================================================


class TestBuildAgentGraph:
    """build_agent_graph:StateGraph 编译为可执行 graph。"""

    def test_compile_returns_callable_graph(self):
        """编译产物非 None 且具有 ainvoke / invoke 方法。"""
        graph = build_agent_graph()
        assert graph is not None
        assert hasattr(graph, "ainvoke")
        assert hasattr(graph, "invoke")

    def test_compiled_graph_has_three_nodes(self):
        """编译后底层 StateGraph 应含 plan / execute / summarize 三个节点。"""
        graph = build_agent_graph()
        nodes = getattr(graph, "nodes", None)
        assert nodes is not None
        node_names = set(nodes.keys())
        assert {"plan", "execute", "summarize"}.issubset(node_names)

    @pytest.mark.asyncio
    async def test_graph_end_to_end_plan_success_path(self):
        """集成:plan 成功 → execute → summarize,mock LLM 验证全链路。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(side_effect=[
                {"content": "the plan"},   # plan_node
                {"content": "executed"},   # execute_node
            ])
            graph = build_agent_graph()
            result = await graph.ainvoke(make_state(mode="default"))
        assert result["plan"] == "the plan"
        assert result["execution_result"] == "executed"
        assert result["summary"] == "executed"
        assert mock_llm.complete.await_count == 2


# =============================================================================
# 7. 单例机制(3 tests)
# =============================================================================


class TestSingleton:
    """get_agent_graph 单例 + reset_agent_graph_for_test 重置。"""

    def setup_method(self):
        """每个测试前重置单例,避免互相污染。"""
        reset_agent_graph_for_test()

    def test_get_agent_graph_builds_on_first_call(self):
        """首次调用 → 构建 graph(非 None)。"""
        g = get_agent_graph()
        assert g is not None
        assert hasattr(g, "ainvoke")

    def test_get_agent_graph_returns_same_instance(self):
        """二次调用 → 返回相同实例(单例缓存)。"""
        g1 = get_agent_graph()
        g2 = get_agent_graph()
        assert g1 is g2

    def test_reset_rebuilds_new_instance(self):
        """reset 后 → 再调用返回新实例(与旧实例不同)。"""
        g1 = get_agent_graph()
        reset_agent_graph_for_test()
        g2 = get_agent_graph()
        assert g1 is not g2


# =============================================================================
# 8. 完整流水线集成(3 tests)
# =============================================================================


class TestPipelineIntegration:
    """端到端流水线:plan → should_continue → execute/跳过 → summarize。"""

    @pytest.mark.asyncio
    async def test_plan_failure_short_circuits_to_summarize(self):
        """plan_node 异常 → should_continue 路由 summarize → 跳过 execute。

        验证:execute_node 不被调用(complete 只调 1 次,且来自 plan_node),
        最终 summary="" 因 execution_result 缺失。
        """
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(side_effect=RuntimeError("plan LLM down"))
            graph = build_agent_graph()
            result = await graph.ainvoke(make_state(mode="default"))
        assert result["plan"] == ""
        assert "plan failed" in (result.get("error") or "")
        assert result.get("summary", "") == ""
        assert mock_llm.complete.await_count == 1

    @pytest.mark.asyncio
    async def test_execute_failure_still_reaches_summarize(self):
        """execute_node 异常 → execution_result="" + error,仍进 summarize → summary=""。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(side_effect=[
                {"content": "the plan"},   # plan_node 成功
                RuntimeError("execute LLM down"),  # execute_node 异常
            ])
            graph = build_agent_graph()
            result = await graph.ainvoke(make_state(mode="default"))
        assert result["plan"] == "the plan"
        assert result["execution_result"] == ""
        assert "execute failed" in (result.get("error") or "")
        assert result["summary"] == ""
        assert mock_llm.complete.await_count == 2

    @pytest.mark.asyncio
    async def test_bypass_permissions_mode_skips_planning_llm(self):
        """mode=bypassPermissions → plan_node 短路,不调 LLM;
        execute_node 仍调 LLM;summarize 返回 execution_result。"""
        with patch("app.services.agent_graph.llm_gateway") as mock_llm:
            mock_llm.complete = AsyncMock(return_value={"content": "bypassed output"})
            graph = build_agent_graph()
            result = await graph.ainvoke(make_state(mode="bypassPermissions"))
        assert result["plan"] == "skip-planning"
        assert result["execution_result"] == "bypassed output"
        assert result["summary"] == "bypassed output"
        assert mock_llm.complete.await_count == 1
