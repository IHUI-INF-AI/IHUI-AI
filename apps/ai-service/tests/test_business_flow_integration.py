"""端到端业务流集成测试。

覆盖:
- 对话流(conversation):intent → tool select → LLM → tool exec → response
- 智能体流(agent_orchestrator):agent registry → invoke → multi-agent
- 工具调用(MCP):register → list → invoke → result
- RAG 检索增强:embed → search → rerank → context → generate
- LangGraph StateGraph:plan → execute → summarize
- API 端点:chat / agent invoke / rag

设计原则:全部用 stub 降级,无需真实 API key,保证 CI 离线可跑。
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from app.services.conversation import (
    ConversationResult,
    IntentResult,
    ToolCallRecord,
    conversation_service,
)
from app.services.rag import RAGService, RAGResult, rag_service
from app.services.mcp_server import mcp_server


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def fresh_session() -> str:
    """每个测试用独立 session_id,避免串扰。"""
    return f"test-session-async-{id(object())}"


# =============================================================================
# 对话流 — 端到端
# =============================================================================


class TestConversationEndToEnd:
    """conversation_service 完整业务流测试。"""

    @pytest.mark.asyncio
    async def test_simple_chat_completes(self) -> None:
        """纯闲聊走完整流程,返回 ConversationResult。"""
        result = await conversation_service.chat(
            user_input="今天天气不错",
            session_id=None,
            model="gpt-4o-mini",
        )
        assert isinstance(result, ConversationResult)
        assert result.final_response  # 非空回复
        assert result.iterations >= 1
        assert result.duration_ms >= 0
        # trace 应包含 intent + tool_select + llm_call 节点
        stages = [t.get("node") for t in result.trace]
        assert "intent_classify" in stages
        assert "tool_select" in stages
        assert "llm_call" in stages

    @pytest.mark.asyncio
    async def test_session_id_persists_across_calls(self, fresh_session: str) -> None:
        """同一 session_id 多次调用保持一致。"""
        r1 = await conversation_service.chat(
            user_input="我叫小明",
            session_id=fresh_session,
        )
        r2 = await conversation_service.chat(
            user_input="你还记得我吗?",
            session_id=fresh_session,
        )
        assert r1.session_id == fresh_session
        assert r2.session_id == fresh_session

    @pytest.mark.asyncio
    async def test_max_iterations_caps_tool_loop(self) -> None:
        """max_iterations 限制 tool loop 次数,避免无限循环。"""
        result = await conversation_service.chat(
            user_input="测试最大迭代",
            max_iterations=2,
        )
        assert result.iterations <= 2

    @pytest.mark.asyncio
    async def test_result_to_dict_serializable(self) -> None:
        """result_to_dict 必须返回 JSON-serializable dict。"""
        result = await conversation_service.chat(user_input="hello")
        d = conversation_service.result_to_dict(result)
        # 不应抛
        json.dumps(d, default=str)
        assert "session_id" in d
        assert "user_input" in d
        assert "intent" in d
        assert "tool_calls" in d
        assert "final_response" in d

    @pytest.mark.asyncio
    async def test_fallback_intent_used_when_classify_returns_other(self) -> None:
        """当 _classify_intent 返回 other 意图,主流程仍正常。"""
        fallback_intent = IntentResult(
            intent="other",
            confidence=0.5,
            needs_tool=False,
        )
        with patch.object(
            conversation_service,
            "_classify_intent",
            new=AsyncMock(return_value=fallback_intent),
        ):
            result = await conversation_service.chat(user_input="hello")
            assert result.intent.intent == "other"
            assert result.final_response


# =============================================================================
# 工具调用 — MCP
# =============================================================================


class TestMCPIntegration:
    """MCP 工具注册 + 调用 + 结果。"""

    def test_list_tools_returns_registered(self) -> None:
        """list_tools 返回所有注册工具。"""
        tools = mcp_server.list_tools()
        assert isinstance(tools, list)
        assert len(tools) > 0
        for t in tools:
            assert hasattr(t, "name")
            assert hasattr(t, "description")
            assert hasattr(t, "input_schema")

    def test_tool_names_unique(self) -> None:
        """所有工具名称唯一。"""
        tools = mcp_server.list_tools()
        names = [t.name for t in tools]
        assert len(names) == len(set(names))

    @pytest.mark.asyncio
    async def test_call_tool_nonexistent_returns_error(self) -> None:
        """调用不存在的工具返回 {ok: False, error}。"""
        result = await mcp_server.call_tool("nonexistent_tool_xyz", {})
        assert result["ok"] is False
        assert "error" in result

    @pytest.mark.asyncio
    async def test_call_tool_real_returns_dict(self) -> None:
        """调用真实工具返回 {ok, ...} dict。"""
        tools = mcp_server.list_tools()
        if not tools:
            pytest.skip("No tools registered")
        target = tools[0]
        result = await mcp_server.call_tool(target.name, {})
        assert isinstance(result, dict)
        assert "ok" in result

    @pytest.mark.asyncio
    async def test_call_tool_exception_caught(self) -> None:
        """工具内部异常被捕获,返回 {ok: False, error}。"""
        # 通过注入异常 handler 测试
        from app.services import mcp_server as m

        original_handlers = m._TOOL_HANDLERS.copy()
        try:
            async def boom(_: dict) -> dict:
                raise RuntimeError("intentional boom")

            m._TOOL_HANDLERS["__test_boom__"] = boom
            result = await mcp_server.call_tool("__test_boom__", {})
            assert result["ok"] is False
            assert "boom" in result["error"]
        finally:
            m._TOOL_HANDLERS.clear()
            m._TOOL_HANDLERS.update(original_handlers)

    def test_list_resources(self) -> None:
        """list_resources 返回已注册资源。"""
        resources = mcp_server.list_resources()
        assert isinstance(resources, list)
        for r in resources:
            assert hasattr(r, "uri")
            assert hasattr(r, "name")

    def test_list_prompts(self) -> None:
        """list_prompts 返回已注册 prompts。"""
        prompts = mcp_server.list_prompts()
        assert isinstance(prompts, list)
        for p in prompts:
            assert hasattr(p, "name")
            assert hasattr(p, "arguments")


# =============================================================================
# RAG 检索增强
# =============================================================================


class TestRAGIntegration:
    """RAG 检索 + 重排 + 上下文拼接 + 生成。"""

    def test_rag_service_singleton(self) -> None:
        """RAG service 是单例。"""
        assert isinstance(rag_service, RAGService)

    def test_rag_result_dataclass(self) -> None:
        """RAGResult / RAGSource 字段契约。"""
        from app.services.rag import RAGSource

        s = RAGSource(session_id="s", role="user", content="hi", score=0.5)
        r = RAGResult(
            query="q",
            answer="a",
            sources=[s],
            model="m",
            context_tokens=10,
            duration_ms=1.0,
            stub=True,
        )
        assert r.query == "q"
        assert len(r.sources) == 1
        assert r.stub is True

    @pytest.mark.asyncio
    async def test_rag_query_returns_result(self) -> None:
        """query 返回 RAGResult dataclass。"""
        result = await rag_service.query(
            question="什么是 LangGraph?",
            top_k=3,
        )
        assert isinstance(result, RAGResult)
        assert result.query == "什么是 LangGraph?"
        assert isinstance(result.sources, list)
        assert result.duration_ms >= 0

    @pytest.mark.asyncio
    async def test_rag_set_system_template(self) -> None:
        """set_system_template 更新模板。"""
        original = rag_service._system_template
        try:
            rag_service.set_system_template("custom {context} template")
            assert rag_service._system_template == "custom {context} template"
        finally:
            rag_service.set_system_template(original)


# =============================================================================
# LangGraph 业务流
# =============================================================================


class TestLangGraphBusinessFlow:
    """LangGraph StateGraph 业务流:plan → execute → summarize。"""

    @pytest.mark.asyncio
    async def test_graph_run_returns_status(self) -> None:
        """run_graph 返回包含 status 的结果。"""
        from app.services.langgraph_service import langgraph_service

        result = await langgraph_service.run_graph(
            goal="测试目标",
            session_id="test-sess",
        )
        assert "status" in result
        assert result["status"] in ("completed", "failed", "partial", "planned")

    @pytest.mark.asyncio
    async def test_graph_handles_empty_goal(self) -> None:
        """空 goal 仍能正常完成(或优雅失败)。"""
        from app.services.langgraph_service import langgraph_service

        result = await langgraph_service.run_graph(
            goal="",
            session_id="empty-sess",
        )
        assert "status" in result


# =============================================================================
# 端到端 API(httpx + ASGI)
# =============================================================================


class TestAPIEndpoints:
    """API endpoints end-to-end:chat / agent / rag。"""

    @pytest.mark.asyncio
    async def test_health_endpoint(self, client) -> None:
        """/health 返回 200。"""
        r = await client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert "status" in data or "code" in data

    @pytest.mark.asyncio
    async def test_chat_endpoint_format(self, client) -> None:
        """POST /api/v1/ai/chat 返回 {code, message, data} 格式。"""
        r = await client.post(
            "/api/v1/ai/chat",
            json={"message": "hi", "max_iterations": 1},
        )
        assert r.status_code == 200
        data = r.json()
        assert "code" in data
        assert "message" in data
        assert "data" in data
        assert data["code"] == 0  # success

    @pytest.mark.asyncio
    async def test_chat_endpoint_rag_flag_propagates(self, client) -> None:
        """use_rag 标志透传到 response data。"""
        r = await client.post(
            "/api/v1/ai/chat",
            json={"message": "test", "use_rag": True, "rag_top_k": 5},
        )
        data = r.json()
        if data.get("code") == 0:
            assert data["data"].get("use_rag") is True
            assert data["data"].get("rag_top_k") == 5

    @pytest.mark.asyncio
    async def test_chat_endpoint_rejects_invalid_max_iterations(self, client) -> None:
        """max_iterations 超出 [1,10] 范围应被 Pydantic 拒绝。"""
        r = await client.post(
            "/api/v1/ai/chat",
            json={"message": "test", "max_iterations": 100},  # 超出 10
        )
        assert r.status_code in (400, 422)

    @pytest.mark.asyncio
    async def test_rag_query_endpoint(self, client) -> None:
        """POST /api/v1/ai/rag 返回 {code, message, data} 格式。"""
        r = await client.post(
            "/api/v1/ai/rag",
            json={"query": "LangGraph 是什么?", "top_k": 3},
        )
        assert r.status_code == 200
        data = r.json()
        assert "code" in data
        assert "data" in data
        if data["code"] == 0:
            assert "query" in data["data"]
            assert "sources" in data["data"]

    @pytest.mark.asyncio
    async def test_rag_add_document_endpoint(self, client) -> None:
        """POST /api/v1/ai/rag/documents 添加文档到 RAG 知识库。"""
        r = await client.post(
            "/api/v1/ai/rag/documents",
            json={
                "session_id": "test-rag-sess",
                "content": "LangGraph 是一个用于构建有状态、多角色 LLM 应用的框架。",
                "role": "system",
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == 0
        assert data["data"]["content_length"] > 0

    @pytest.mark.asyncio
    async def test_agent_list_endpoint(self, client) -> None:
        """GET /api/v1/ai/agent/list 列出可用 agent。"""
        r = await client.get("/api/v1/ai/agent/list")
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == 0
        assert "agents" in data["data"]
        assert "count" in data["data"]
        assert data["data"]["count"] > 0  # 默认 5 个 agent

    @pytest.mark.asyncio
    async def test_agent_invoke_endpoint(self, client) -> None:
        """POST /api/v1/ai/agent/invoke 调用单个 agent。"""
        r = await client.post(
            "/api/v1/ai/agent/invoke",
            json={"agent": "researcher", "message": "调研 Python 异步编程"},
        )
        assert r.status_code == 200
        data = r.json()
        assert "code" in data
        if data["code"] == 0:
            assert "status" in data["data"]

    @pytest.mark.asyncio
    async def test_agent_invoke_unknown_agent_returns_error(self, client) -> None:
        """调用未知 agent 返回 500 或 code != 0。"""
        r = await client.post(
            "/api/v1/ai/agent/invoke",
            json={"agent": "nonexistent_agent_xyz", "message": "test"},
        )
        # 应该返回 200 但 code != 0,或 500
        if r.status_code == 200:
            data = r.json()
            assert data["code"] != 0
        else:
            assert r.status_code in (400, 500)


# =============================================================================
# IntentResult / ToolCallRecord / ConversationResult dataclass 契约
# =============================================================================


class TestDataclassContracts:
    """业务 dataclass 字段契约。"""

    def test_intent_result_defaults(self) -> None:
        """IntentResult 默认值正确。"""
        i = IntentResult(intent="chat", confidence=0.9)
        assert i.entities == {}
        assert i.suggested_tools == []
        assert i.needs_tool is False

    def test_tool_call_record_defaults(self) -> None:
        """ToolCallRecord 默认值正确。"""
        t = ToolCallRecord(tool="x", arguments={}, result={}, ok=True)
        assert t.duration_ms == 0.0

    def test_conversation_result_fields(self) -> None:
        """ConversationResult 字段齐全。"""
        r = ConversationResult(
            session_id="s",
            user_input="hi",
            intent=IntentResult(intent="chat", confidence=1.0),
            tool_calls=[],
            final_response="hello",
            model="gpt-4o-mini",
            iterations=1,
            duration_ms=10.0,
            stub=True,
        )
        assert r.session_id == "s"
        assert r.stub is True
