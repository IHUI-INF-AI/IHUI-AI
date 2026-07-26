"""agent_tools 工厂函数单测。

测试覆盖:
- make_knowledge_lookup_tool 返回 ToolDefinition
- name / description / parameters / executor 字段正确
- parameters schema 含 query (required) + top_k_per_source (optional)
- executor 调 knowledge_lookup,参数透传正确
- executor 空 query 返回 error
- executor ValueError 降级返回 error
- executor 返回 dict 含 hits / errors / duration_ms
- 闭包参数(user_id / repo_id 等)透传给 knowledge_lookup
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services.agent_loop_v2 import ToolDefinition
from app.services.agent_tools import make_knowledge_lookup_tool
from app.services.knowledge_lookup import KnowledgeHit, KnowledgeLookupResult


# =============================================================================
# 工具定义
# =============================================================================


class TestToolDefinition:
    def test_returns_tool_definition(self):
        tool = make_knowledge_lookup_tool()
        assert isinstance(tool, ToolDefinition)

    def test_tool_name(self):
        tool = make_knowledge_lookup_tool()
        assert tool.name == "knowledge_lookup"

    def test_tool_description_nonempty(self):
        tool = make_knowledge_lookup_tool()
        assert isinstance(tool.description, str)
        assert len(tool.description) > 10

    def test_tool_parameters_schema(self):
        tool = make_knowledge_lookup_tool()
        params = tool.parameters
        assert params["type"] == "object"
        assert "query" in params["properties"]
        assert params["properties"]["query"]["type"] == "string"
        assert "top_k_per_source" in params["properties"]
        assert params["properties"]["top_k_per_source"]["type"] == "integer"
        assert params["required"] == ["query"]
        assert params["additionalProperties"] is False

    def test_tool_executor_is_callable(self):
        tool = make_knowledge_lookup_tool()
        assert callable(tool.executor)


# =============================================================================
# executor 执行
# =============================================================================


class TestExecutorExecution:
    async def test_executor_calls_knowledge_lookup_with_query(self):
        """executor 收到 {query} → 调 knowledge_lookup(query, ...)。"""
        tool = make_knowledge_lookup_tool(user_id="u1", repo_id="r1")
        with patch(
            "app.services.agent_tools.knowledge_lookup",
            new=AsyncMock(return_value=KnowledgeLookupResult(query="test")),
        ) as mock_kl:
            result = await tool.executor({"query": "test"})
        mock_kl.assert_awaited_once()
        args, kwargs = mock_kl.call_args
        assert args[0] == "test" or kwargs.get("query") == "test"

    async def test_executor_passes_closure_params(self):
        """闭包参数(user_id/repo_id/session_id/top_k_per_source/source_priority/api_token)
        透传给 knowledge_lookup。"""
        tool = make_knowledge_lookup_tool(
            user_id="u1",
            repo_id="r1",
            session_id="s1",
            top_k_per_source=10,
            source_priority=["rag", "codebase"],
            api_token="jwt",
        )
        with patch(
            "app.services.agent_tools.knowledge_lookup",
            new=AsyncMock(return_value=KnowledgeLookupResult(query="q")),
        ) as mock_kl:
            await tool.executor({"query": "q"})
        mock_kl.assert_awaited_once()
        args, kwargs = mock_kl.call_args
        assert kwargs.get("user_id") == "u1"
        assert kwargs.get("repo_id") == "r1"
        assert kwargs.get("session_id") == "s1"
        assert kwargs.get("top_k_per_source") == 10
        assert kwargs.get("source_priority") == ["rag", "codebase"]
        assert kwargs.get("api_token") == "jwt"

    async def test_executor_llm_can_override_top_k(self):
        """LLM 传 {query, top_k_per_source: 15} → 用 15 覆盖闭包默认 5。"""
        tool = make_knowledge_lookup_tool(top_k_per_source=5)
        with patch(
            "app.services.agent_tools.knowledge_lookup",
            new=AsyncMock(return_value=KnowledgeLookupResult(query="q")),
        ) as mock_kl:
            await tool.executor({"query": "q", "top_k_per_source": 15})
        args, kwargs = mock_kl.call_args
        assert kwargs.get("top_k_per_source") == 15

    async def test_executor_empty_query_returns_error(self):
        """空 query → 返回 {error: 'query is required', hits: []}。"""
        tool = make_knowledge_lookup_tool()
        result = await tool.executor({"query": ""})
        assert "error" in result
        assert "required" in result["error"]
        assert result["hits"] == []
        assert result["errors"] == []
        assert result["duration_ms"] == 0.0

    async def test_executor_missing_query_key_returns_error(self):
        """args 不含 query key → 返回 error。"""
        tool = make_knowledge_lookup_tool()
        result = await tool.executor({})
        assert "error" in result

    async def test_executor_value_error_degrade(self):
        """knowledge_lookup 抛 ValueError → 降级返回 error dict(不抛)。"""
        tool = make_knowledge_lookup_tool()
        with patch(
            "app.services.agent_tools.knowledge_lookup",
            new=AsyncMock(side_effect=ValueError("invalid priority")),
        ):
            result = await tool.executor({"query": "q"})
        assert "error" in result
        assert "ValueError" in result["error"]
        assert result["hits"] == []
        assert result["duration_ms"] == 0.0

    async def test_executor_returns_dict_with_required_fields(self):
        """正常返回 dict 含 query / hits / errors / duration_ms。"""
        fake_result = KnowledgeLookupResult(
            query="test",
            hits=[
                KnowledgeHit(
                    source="codebase",
                    score=0.9,
                    content="[codebase:function auth] file.ts:1-10\n...",
                )
            ],
            errors=[],
            duration_ms=42.5,
        )
        tool = make_knowledge_lookup_tool()
        with patch(
            "app.services.agent_tools.knowledge_lookup",
            new=AsyncMock(return_value=fake_result),
        ):
            result = await tool.executor({"query": "test"})
        assert result["query"] == "test"
        assert len(result["hits"]) == 1
        assert result["hits"][0]["source"] == "codebase"
        assert result["hits"][0]["score"] == 0.9
        assert "auth" in result["hits"][0]["content"]
        assert result["errors"] == []
        assert result["duration_ms"] == 42.5

    async def test_executor_strips_query_whitespace(self):
        """query 前后空格被 strip。"""
        tool = make_knowledge_lookup_tool()
        with patch(
            "app.services.agent_tools.knowledge_lookup",
            new=AsyncMock(return_value=KnowledgeLookupResult(query="  test  ")),
        ) as mock_kl:
            await tool.executor({"query": "  test  "})
        args, kwargs = mock_kl.call_args
        assert args[0] == "test" or kwargs.get("query") == "test"

    async def test_executor_does_not_include_raw_in_hits(self):
        """hits 不含 raw 字段(避免 LLM 上下文冗长)。"""
        fake_result = KnowledgeLookupResult(
            query="q",
            hits=[
                KnowledgeHit(
                    source="codebase",
                    score=0.9,
                    content="x",
                    raw={"secret": "should_not_leak"},
                )
            ],
        )
        tool = make_knowledge_lookup_tool()
        with patch(
            "app.services.agent_tools.knowledge_lookup",
            new=AsyncMock(return_value=fake_result),
        ):
            result = await tool.executor({"query": "q"})
        assert "raw" not in result["hits"][0]
