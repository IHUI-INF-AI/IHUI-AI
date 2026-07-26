"""G6 LTM 源接入端到端集成测试(2026-07-26 立)。

验证完整链路:
  mcp_server.call_tool("knowledge_lookup", ..., user_id="u1")
    → _tool_knowledge_lookup (从 arguments 提取 __user_id)
    → knowledge_lookup(user_id="u1", ...)
    → _query_ltm(user_id="u1", query, top_k)
    → long_term_memory.recall_cross_session("u1", query, top_k) [mock]
    → 返回真实 LTM hits

mock 策略:
- codebase_indexer.search → [] (聚焦 LTM)
- rag_service.retrieve_only → [] (聚焦 LTM)
- long_term_memory.recall_cross_session → 真实 LTM 数据结构

测试覆盖:
- LTM 源返回真实 hits / user_id=None 跳过 LTM / LTM 失败降级
- 三源聚合 / hit content 格式 / user_id 透传 / top_k 透传
- 返回结构不含 raw / 空 query 错误 / 完整 MCP 返回结构
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from app.services.knowledge_lookup import KnowledgeHit  # noqa: F401 (用于类型参考)
from app.services.mcp_server import mcp_server
from app.services.rag import RAGSource


# =============================================================================
# 测试夹具:构造 LTM / codebase / rag mock 返回
# =============================================================================


def _make_ltm_item(
    *,
    score: float = 0.85,
    summary: str = "讨论了用户认证方案",
    key_facts: list | None = None,
    key_decisions: list | None = None,
    session_id: str = "sess-001",
    summary_id: str = "uuid-001",
) -> dict:
    """构造 LTM mock 返回的单条 item(结构对齐 session_summarizer._row_to_summary_dict + score 字段)。"""
    return {
        "summary_id": summary_id,
        "session_id": session_id,
        "summary": summary,
        "key_facts": key_facts if key_facts is not None else ["使用 JWT", "令牌 1h 过期"],
        "key_decisions": key_decisions if key_decisions is not None else ["选 jose 库"],
        "message_count": 10,
        "token_count": 1500,
        "start_time": "2026-07-20T10:00:00",
        "end_time": "2026-07-20T11:00:00",
        "importance_score": 0.8,
        "embedding": None,
        "created_at": "2026-07-20T11:00:00",
        "score": score,  # _query_ltm 用 item.get("score", 0.0) 读这个
    }


def _make_codebase_chunk(
    *,
    score: float = 0.9,
    symbol_name: str = "authenticate",
    symbol_type: str = "function",
    file_path: str = "src/auth.ts",
    line_start: int = 1,
    line_end: int = 10,
    content: str = "export async function authenticate() { ... }",
) -> dict:
    return {
        "score": score,
        "symbol_name": symbol_name,
        "symbol_type": symbol_type,
        "file_path": file_path,
        "line_start": line_start,
        "line_end": line_end,
        "content": content,
    }


def _make_rag_source(
    *,
    score: float = 0.85,
    role: str = "assistant",
    content: str = "用户认证基于 JWT",
    session_id: str = "s1",
    timestamp: str = "2026-07-25",
) -> RAGSource:
    return RAGSource(
        session_id=session_id,
        role=role,
        content=content,
        score=score,
        timestamp=timestamp,
    )


def _patch_sources(
    *,
    codebase_return=None,
    codebase_side_effect=None,
    rag_return=None,
    rag_side_effect=None,
    ltm_return=None,
    ltm_side_effect=None,
):
    """一键 patch 三源(codebase/rag/ltm),返回三组 mock。

    用法:
        cb_p, rag_p, ltm_p = _patch_sources(ltm_return=[_make_ltm_item()])
        with cb_p as cb, rag_p as rag, ltm_p as ltm:
            result = await mcp_server.call_tool(...)
            ltm.assert_awaited_once()
    """
    cb_kwargs = {"return_value": codebase_return} if codebase_return is not None else {}
    if codebase_side_effect is not None:
        cb_kwargs = {"side_effect": codebase_side_effect}
    if not cb_kwargs:
        cb_kwargs = {"return_value": []}  # 默认空

    rag_kwargs = {"return_value": rag_return} if rag_return is not None else {}
    if rag_side_effect is not None:
        rag_kwargs = {"side_effect": rag_side_effect}
    if not rag_kwargs:
        rag_kwargs = {"return_value": []}

    ltm_kwargs = {"return_value": ltm_return} if ltm_return is not None else {}
    if ltm_side_effect is not None:
        ltm_kwargs = {"side_effect": ltm_side_effect}
    if not ltm_kwargs:
        ltm_kwargs = {"return_value": []}

    cb_patch = patch(
        "app.services.knowledge_lookup.codebase_indexer.search",
        new=AsyncMock(**cb_kwargs),
    )
    rag_patch = patch(
        "app.services.knowledge_lookup.rag_service.retrieve_only",
        new=AsyncMock(**rag_kwargs),
    )
    ltm_patch = patch(
        "app.services.knowledge_lookup.long_term_memory.recall_cross_session",
        new=AsyncMock(**ltm_kwargs),
    )
    return cb_patch, rag_patch, ltm_patch


# =============================================================================
# 端到端集成测试
# =============================================================================


class TestKnowledgeLookupG6EndToEnd:
    """G6 LTM 源接入端到端集成测试。

    验证 mcp_server.call_tool → knowledge_lookup → LTM 源全链路。
    """

    async def test_e2e_ltm_returns_real_hits_via_call_tool(self):
        """E2E:user_id="u1" + LTM mock 返回真实数据 → hits 含 long_term_memory 源。"""
        cb_p, rag_p, ltm_p = _patch_sources(
            ltm_return=[_make_ltm_item(score=0.85, summary="讨论了用户认证方案")],
        )
        with cb_p, rag_p, ltm_p:
            result = await mcp_server.call_tool(
                "knowledge_lookup", {"query": "认证逻辑"}, user_id="u1"
            )

        assert result["tool"] == "knowledge_lookup"
        assert result["ok"] is True
        assert len(result["hits"]) == 1
        assert result["hits"][0]["source"] == "long_term_memory"
        assert result["hits"][0]["score"] > 0
        assert "[long_term_memory]" in result["hits"][0]["content"]
        assert "认证" in result["hits"][0]["content"]

    async def test_e2e_ltm_skipped_when_user_id_none(self):
        """E2E:user_id=None → LTM 源跳过(不调用),hits 空,ok=True(空结果不算失败)。"""
        cb_p, rag_p, ltm_p = _patch_sources(
            ltm_return=[_make_ltm_item()],  # 不应被调用
        )
        with cb_p as cb, rag_p as rag, ltm_p as ltm:
            result = await mcp_server.call_tool(
                "knowledge_lookup", {"query": "q"}
            )  # 不传 user_id

        assert len(result["hits"]) == 0
        assert result["ok"] is True
        ltm.assert_not_awaited()
        assert result["errors"] == []

    async def test_e2e_ltm_failure_degrades_gracefully(self):
        """E2E:LTM 抛 RuntimeError → hits 空,ok=False,errors 含 long_term_memory 1 条。"""
        cb_p, rag_p, ltm_p = _patch_sources(
            ltm_side_effect=RuntimeError("db down"),
        )
        with cb_p, rag_p, ltm_p:
            result = await mcp_server.call_tool(
                "knowledge_lookup", {"query": "q"}, user_id="u1"
            )

        assert len(result["hits"]) == 0
        assert result["ok"] is False
        assert len(result["errors"]) == 1
        assert result["errors"][0]["source"] == "long_term_memory"
        assert "RuntimeError" in result["errors"][0]["error"]
        assert "db down" in result["errors"][0]["error"]

    async def test_e2e_three_sources_aggregated_via_call_tool(self):
        """E2E:三源各返回 1 条 → hits 3 条,按默认 priority 排序(codebase/rag/ltm)。"""
        cb_p, rag_p, ltm_p = _patch_sources(
            codebase_return=[_make_codebase_chunk(score=0.9, symbol_name="auth")],
            rag_return=[_make_rag_source(score=0.85, content="...")],
            ltm_return=[_make_ltm_item(score=0.7, summary="...")],
        )
        with cb_p, rag_p, ltm_p:
            result = await mcp_server.call_tool(
                "knowledge_lookup", {"query": "q"}, user_id="u1"
            )

        assert len(result["hits"]) == 3
        assert result["hits"][0]["source"] == "codebase"
        assert result["hits"][1]["source"] == "rag"
        assert result["hits"][2]["source"] == "long_term_memory"

    async def test_e2e_ltm_hit_content_format(self):
        """E2E:LTM hit content 含 [long_term_memory] 头 + summary + 关键事实 + 关键决策。"""
        cb_p, rag_p, ltm_p = _patch_sources(
            ltm_return=[
                _make_ltm_item(
                    summary="讨论了用户认证方案",
                    key_facts=["使用 JWT", "令牌 1h 过期"],
                    key_decisions=["选 jose 库"],
                )
            ],
        )
        with cb_p, rag_p, ltm_p:
            result = await mcp_server.call_tool(
                "knowledge_lookup", {"query": "q"}, user_id="u1"
            )

        content = result["hits"][0]["content"]
        assert "[long_term_memory]" in content
        assert "讨论了用户认证方案" in content
        assert "关键事实:" in content
        assert "关键决策:" in content

    async def test_e2e_user_id_propagated_to_ltm(self):
        """E2E:user_id="u1" 透传到 long_term_memory.recall_cross_session 第一个位置参数。"""
        cb_p, rag_p, ltm_p = _patch_sources(
            ltm_return=[],
        )
        with cb_p as cb, rag_p as rag, ltm_p as ltm:
            await mcp_server.call_tool(
                "knowledge_lookup", {"query": "q"}, user_id="u1"
            )

        ltm.assert_awaited_once()
        args, kwargs = ltm.call_args
        # recall_cross_session(user_id, query, top_k=...) → 第一个位置参数是 user_id
        assert args[0] == "u1"

    async def test_e2e_top_k_propagated_to_ltm(self):
        """E2E:top_k_per_source=10 透传到 long_term_memory.recall_cross_session(top_k=10)。"""
        cb_p, rag_p, ltm_p = _patch_sources(
            ltm_return=[],
        )
        with cb_p as cb, rag_p as rag, ltm_p as ltm:
            await mcp_server.call_tool(
                "knowledge_lookup",
                {"query": "q", "top_k_per_source": 10},
                user_id="u1",
            )

        ltm.assert_awaited_once()
        args, kwargs = ltm.call_args
        assert kwargs.get("top_k") == 10

    async def test_e2e_ltm_hit_raw_field_not_in_response(self):
        """E2E:返回的 hit 不含 raw 字段(避免 LLM 上下文冗长)。"""
        cb_p, rag_p, ltm_p = _patch_sources(
            ltm_return=[_make_ltm_item()],
        )
        with cb_p, rag_p, ltm_p:
            result = await mcp_server.call_tool(
                "knowledge_lookup", {"query": "q"}, user_id="u1"
            )

        assert len(result["hits"]) == 1
        assert "raw" not in result["hits"][0]

    async def test_e2e_empty_query_returns_error(self):
        """E2E:空 query → ok=False,message 含 'query' 或 '空',hits 空。"""
        cb_p, rag_p, ltm_p = _patch_sources(
            ltm_return=[_make_ltm_item()],  # 不应被调用
        )
        with cb_p, rag_p, ltm_p:
            result = await mcp_server.call_tool(
                "knowledge_lookup", {"query": ""}, user_id="u1"
            )

        assert result["ok"] is False
        assert "query" in result["message"].lower() or "空" in result["message"]
        assert result["hits"] == []

    async def test_e2e_full_chain_returns_mcp_structure(self):
        """E2E:完整 MCP 返回结构(7 个必需字段 + total_hits == len(hits))。"""
        cb_p, rag_p, ltm_p = _patch_sources(
            ltm_return=[_make_ltm_item()],
        )
        with cb_p, rag_p, ltm_p:
            result = await mcp_server.call_tool(
                "knowledge_lookup", {"query": "q"}, user_id="u1"
            )

        # 必需字段全部存在
        for field in ("tool", "query", "hits", "errors", "duration_ms", "total_hits", "ok", "message"):
            assert field in result, f"missing field: {field}"
        assert result["tool"] == "knowledge_lookup"
        assert result["total_hits"] == len(result["hits"])
        assert result["duration_ms"] >= 0.0
