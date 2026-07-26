"""knowledge_lookup 统一知识查询门面单测。

测试覆盖:
- 三源全成功 / 各源失败降级 / 全部失败
- source_priority 自定义排序
- user_id 为空跳过 long_term_memory
- 同源内按 score 降序
- 空结果(各源返回 [] 但不报错)
- duration_ms 非负
- ValueError on invalid source_priority
- 格式化函数(_format_code_chunk / _format_rag_source / _format_ltm_summary)
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services.knowledge_lookup import (
    DEFAULT_PRIORITY,
    KnowledgeHit,
    KnowledgeLookupResult,
    _format_code_chunk,
    _format_ltm_summary,
    _format_rag_source,
    knowledge_lookup,
)
from app.services.rag import RAGSource


# =============================================================================
# 测试夹具:构造各源 mock 返回
# =============================================================================


def _make_codebase_chunk(
    *,
    score: float = 0.9,
    symbol_name: str = "authenticate",
    symbol_type: str = "function",
    file_path: str = "src/auth.ts",
    line_start: int = 10,
    line_end: int = 30,
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


def _make_ltm_item(
    *,
    score: float = 0.7,
    summary: str = "讨论了认证方案",
    key_facts: list | None = None,
    key_decisions: list | None = None,
) -> dict:
    return {
        "score": score,
        "summary": summary,
        "key_facts": key_facts if key_facts is not None else ["使用 JWT"],
        "key_decisions": key_decisions if key_decisions is not None else ["选 jose 库"],
    }


def _patch_all(
    *,
    codebase_return=None,
    codebase_side_effect=None,
    rag_return=None,
    rag_side_effect=None,
    ltm_return=None,
    ltm_side_effect=None,
):
    """一键 patch 三个源,返回三组 mock 对象。

    codebase_return / rag_return / ltm_return:正常返回值(优先于 side_effect)。
    *_side_effect:抛异常(用于测试降级)。
    """
    cb_kwargs = {"return_value": codebase_return} if codebase_return is not None else {}
    if codebase_side_effect is not None:
        cb_kwargs = {"side_effect": codebase_side_effect}

    rag_kwargs = {"return_value": rag_return} if rag_return is not None else {}
    if rag_side_effect is not None:
        rag_kwargs = {"side_effect": rag_side_effect}

    ltm_kwargs = {"return_value": ltm_return} if ltm_return is not None else {}
    if ltm_side_effect is not None:
        ltm_kwargs = {"side_effect": ltm_side_effect}

    cb_patch = patch(
        "app.services.knowledge_lookup.codebase_indexer.search",
        new=AsyncMock(**cb_kwargs),
    )
    rag_patch = patch(
        "app.services.knowledge_lookup.rag_service._retrieve",
        new=AsyncMock(**rag_kwargs),
    )
    ltm_patch = patch(
        "app.services.knowledge_lookup.long_term_memory.recall_cross_session",
        new=AsyncMock(**ltm_kwargs),
    )
    return cb_patch, rag_patch, ltm_patch


# =============================================================================
# 三源全成功
# =============================================================================


class TestAllSourcesSuccess:
    async def test_three_sources_all_return_hits(self):
        """三源全成功,各返回 1 条,hits 总数 3,errors 空。"""
        cb_p, rag_p, ltm_p = _patch_all(
            codebase_return=[_make_codebase_chunk(score=0.9)],
            rag_return=[_make_rag_source(score=0.85)],
            ltm_return=[_make_ltm_item(score=0.7)],
        )
        with cb_p as cb, rag_p as rag, ltm_p as ltm:
            result = await knowledge_lookup("认证逻辑", user_id="u1")

        assert isinstance(result, KnowledgeLookupResult)
        assert result.query == "认证逻辑"
        assert len(result.hits) == 3
        assert result.errors == []
        # 默认 priority: codebase → rag → long_term_memory
        assert result.hits[0].source == "codebase"
        assert result.hits[1].source == "rag"
        assert result.hits[2].source == "long_term_memory"
        # 各源 top-1 score
        assert result.hits[0].score == 0.9
        assert result.hits[1].score == 0.85
        assert result.hits[2].score == 0.7
        # 三源各调用 1 次
        cb.assert_awaited_once()
        rag.assert_awaited_once()
        ltm.assert_awaited_once()
        # duration_ms 非负
        assert result.duration_ms >= 0.0

    async def test_multiple_hits_per_source_score_desc(self):
        """同源内多条 hit 按 score 降序。"""
        cb_p, rag_p, ltm_p = _patch_all(
            codebase_return=[
                _make_codebase_chunk(score=0.5, symbol_name="low"),
                _make_codebase_chunk(score=0.95, symbol_name="high"),
                _make_codebase_chunk(score=0.7, symbol_name="mid"),
            ],
            rag_return=[],
            ltm_return=[],
        )
        with cb_p, rag_p, ltm_p:
            result = await knowledge_lookup("test", user_id="u1")

        assert len(result.hits) == 3
        assert result.hits[0].score == 0.95
        assert result.hits[1].score == 0.7
        assert result.hits[2].score == 0.5


# =============================================================================
# 各源失败降级
# =============================================================================


class TestSourceFailureDegrade:
    async def test_codebase_failure_others_ok(self):
        """codebase 抛异常,其他源正常,errors 含 codebase 1 条。"""
        cb_p, rag_p, ltm_p = _patch_all(
            codebase_side_effect=RuntimeError("cb http 500"),
            rag_return=[_make_rag_source()],
            ltm_return=[_make_ltm_item()],
        )
        with cb_p, rag_p, ltm_p:
            result = await knowledge_lookup("q", user_id="u1")

        assert len(result.hits) == 2  # rag + ltm
        assert len(result.errors) == 1
        assert result.errors[0]["source"] == "codebase"
        assert "RuntimeError" in result.errors[0]["error"]
        assert "cb http 500" in result.errors[0]["error"]

    async def test_rag_failure_others_ok(self):
        """RAG 抛异常,其他源正常,errors 含 rag 1 条。"""
        cb_p, rag_p, ltm_p = _patch_all(
            codebase_return=[_make_codebase_chunk()],
            rag_side_effect=ValueError("rag broken"),
            ltm_return=[_make_ltm_item()],
        )
        with cb_p, rag_p, ltm_p:
            result = await knowledge_lookup("q", user_id="u1")

        assert len(result.hits) == 2  # codebase + ltm
        assert len(result.errors) == 1
        assert result.errors[0]["source"] == "rag"

    async def test_ltm_failure_others_ok(self):
        """LTM 抛异常,其他源正常,errors 含 long_term_memory 1 条。"""
        cb_p, rag_p, ltm_p = _patch_all(
            codebase_return=[_make_codebase_chunk()],
            rag_return=[_make_rag_source()],
            ltm_side_effect=ConnectionError("db down"),
        )
        with cb_p, rag_p, ltm_p:
            result = await knowledge_lookup("q", user_id="u1")

        assert len(result.hits) == 2  # codebase + rag
        assert len(result.errors) == 1
        assert result.errors[0]["source"] == "long_term_memory"
        assert "ConnectionError" in result.errors[0]["error"]

    async def test_all_sources_failure(self):
        """三源全失败,hits 空,errors 3 条。"""
        cb_p, rag_p, ltm_p = _patch_all(
            codebase_side_effect=RuntimeError("cb"),
            rag_side_effect=RuntimeError("rag"),
            ltm_side_effect=RuntimeError("ltm"),
        )
        with cb_p, rag_p, ltm_p:
            result = await knowledge_lookup("q", user_id="u1")

        assert result.hits == []
        assert len(result.errors) == 3
        sources_in_errors = {e["source"] for e in result.errors}
        assert sources_in_errors == {"codebase", "rag", "long_term_memory"}
        # duration_ms 即使全失败也要有值(非 None)
        assert result.duration_ms >= 0.0


# =============================================================================
# 空结果(各源返回 [] 但不报错)
# =============================================================================


class TestEmptyResults:
    async def test_all_sources_return_empty_list(self):
        """三源都返回空 list,hits 空,errors 空(空不算错误)。"""
        cb_p, rag_p, ltm_p = _patch_all(
            codebase_return=[],
            rag_return=[],
            ltm_return=[],
        )
        with cb_p, rag_p, ltm_p:
            result = await knowledge_lookup("不存在的概念", user_id="u1")

        assert result.hits == []
        assert result.errors == []
        assert result.duration_ms >= 0.0


# =============================================================================
# source_priority 自定义排序
# =============================================================================


class TestSourcePriority:
    async def test_custom_priority_order(self):
        """自定义 priority=[rag, codebase, long_term_memory],hits 按此顺序。"""
        cb_p, rag_p, ltm_p = _patch_all(
            codebase_return=[_make_codebase_chunk(score=0.9)],
            rag_return=[_make_rag_source(score=0.85)],
            ltm_return=[_make_ltm_item(score=0.7)],
        )
        with cb_p, rag_p, ltm_p:
            result = await knowledge_lookup(
                "q",
                user_id="u1",
                source_priority=["rag", "codebase", "long_term_memory"],
            )

        assert result.hits[0].source == "rag"
        assert result.hits[1].source == "codebase"
        assert result.hits[2].source == "long_term_memory"

    async def test_priority_subset_only(self):
        """priority 只含 [codebase],只查 codebase,其他源不调用。"""
        cb_p, rag_p, ltm_p = _patch_all(
            codebase_return=[_make_codebase_chunk()],
            rag_return=[_make_rag_source()],  # 不应被调用
            ltm_return=[_make_ltm_item()],  # 不应被调用
        )
        with cb_p as cb, rag_p as rag, ltm_p as ltm:
            result = await knowledge_lookup(
                "q", user_id="u1", source_priority=["codebase"]
            )

        assert len(result.hits) == 1
        assert result.hits[0].source == "codebase"
        cb.assert_awaited_once()
        rag.assert_not_awaited()
        ltm.assert_not_awaited()

    async def test_invalid_source_raises_value_error(self):
        """source_priority 含不支持的源名 → ValueError。"""
        with pytest.raises(ValueError, match="不支持的源"):
            await knowledge_lookup(
                "q", source_priority=["codebase", "unknown_source"]
            )


# =============================================================================
# user_id 为空跳过 long_term_memory
# =============================================================================


class TestUserIdMissing:
    async def test_no_user_id_skips_ltm(self):
        """user_id 为空时跳过 LTM,不报错,errors 空。"""
        cb_p, rag_p, ltm_p = _patch_all(
            codebase_return=[_make_codebase_chunk()],
            rag_return=[_make_rag_source()],
            ltm_return=[_make_ltm_item()],  # 不应被调用
        )
        with cb_p as cb, rag_p as rag, ltm_p as ltm:
            result = await knowledge_lookup("q")  # 不传 user_id

        assert len(result.hits) == 2  # codebase + rag
        assert result.errors == []
        cb.assert_awaited_once()
        rag.assert_awaited_once()
        ltm.assert_not_awaited()  # LTM 不应被调用


# =============================================================================
# 参数传递
# =============================================================================


class TestParameterPassThrough:
    async def test_repo_id_passed_to_codebase(self):
        """repo_id 透传给 codebase_indexer.search。"""
        cb_p, rag_p, ltm_p = _patch_all(
            codebase_return=[], rag_return=[], ltm_return=[]
        )
        with cb_p as cb, rag_p, ltm_p:
            await knowledge_lookup("q", repo_id="my-repo", user_id="u1")

        cb.assert_awaited_once()
        args, kwargs = cb.call_args
        # search(query, repo_id=..., top_k=..., api_token=...)
        assert kwargs.get("repo_id") == "my-repo" or (len(args) >= 2 and args[1] == "my-repo")

    async def test_session_id_passed_to_rag(self):
        """session_id 透传给 rag_service._retrieve。"""
        cb_p, rag_p, ltm_p = _patch_all(
            codebase_return=[], rag_return=[], ltm_return=[]
        )
        with cb_p, rag_p as rag, ltm_p:
            await knowledge_lookup("q", session_id="sess-123", user_id="u1")

        rag.assert_awaited_once()
        args, kwargs = rag.call_args
        assert kwargs.get("session_id") == "sess-123" or "sess-123" in args

    async def test_top_k_passed_to_all_sources(self):
        """top_k_per_source 透传给三源。"""
        cb_p, rag_p, ltm_p = _patch_all(
            codebase_return=[], rag_return=[], ltm_return=[]
        )
        with cb_p as cb, rag_p as rag, ltm_p as ltm:
            await knowledge_lookup("q", user_id="u1", top_k_per_source=15)

        for mock in [cb, rag, ltm]:
            args, kwargs = mock.call_args
            assert kwargs.get("top_k") == 15 or 15 in args

    async def test_api_token_passed_to_codebase(self):
        """api_token 透传给 codebase_indexer.search。"""
        cb_p, rag_p, ltm_p = _patch_all(
            codebase_return=[], rag_return=[], ltm_return=[]
        )
        with cb_p as cb, rag_p, ltm_p:
            await knowledge_lookup("q", api_token="jwt-token", user_id="u1")

        cb.assert_awaited_once()
        args, kwargs = cb.call_args
        assert kwargs.get("api_token") == "jwt-token" or "jwt-token" in args


# =============================================================================
# 格式化函数
# =============================================================================


class TestFormatters:
    def test_format_code_chunk_complete(self):
        """codebase chunk 格式化:含 [codebase:type name] file:ls-le 头。"""
        c = _make_codebase_chunk(
            symbol_name="authenticate",
            symbol_type="function",
            file_path="src/auth.ts",
            line_start=10,
            line_end=30,
            content="export async function authenticate() { ... }",
        )
        out = _format_code_chunk(c)
        assert "[codebase:function authenticate]" in out
        assert "src/auth.ts:10-30" in out
        assert "export async function authenticate" in out

    def test_format_code_chunk_missing_fields(self):
        """缺字段时不崩,用 ? 兜底。"""
        out = _format_code_chunk({})
        assert "[codebase:symbol ?]" in out
        assert "?:?-?" in out

    def test_format_rag_source_complete(self):
        """RAGSource 格式化:含 [rag:role] timestamp 头。"""
        s = _make_rag_source(
            role="assistant", timestamp="2026-07-25", content="hello"
        )
        out = _format_rag_source(s)
        assert "[rag:assistant]" in out
        assert "2026-07-25" in out
        assert "hello" in out

    def test_format_rag_source_no_timestamp(self):
        """无 timestamp 时头只有 [rag:role]。"""
        s = RAGSource(
            session_id="s1", role="user", content="hi", score=1.0, timestamp=""
        )
        out = _format_rag_source(s)
        assert out.startswith("[rag:user]\n")
        assert "hi" in out

    def test_format_ltm_summary_complete(self):
        """LTM 摘要格式化:含 summary + 关键事实 + 关键决策。"""
        item = _make_ltm_item(
            summary="讨论认证方案",
            key_facts=["使用 JWT", "令牌 1h 过期"],
            key_decisions=["选 jose 库"],
        )
        out = _format_ltm_summary(item)
        assert "[long_term_memory] 讨论认证方案" in out
        assert "关键事实: 使用 JWT; 令牌 1h 过期" in out
        assert "关键决策: 选 jose 库" in out

    def test_format_ltm_summary_empty_facts_decisions(self):
        """key_facts / key_decisions 为空时只输出 summary 行。"""
        item = _make_ltm_item(
            summary="空讨论", key_facts=[], key_decisions=[]
        )
        out = _format_ltm_summary(item)
        assert out == "[long_term_memory] 空讨论"

    def test_format_ltm_summary_filters_falsy_items(self):
        """key_facts 含 None / 空字符串时被过滤。"""
        item = _make_ltm_item(
            summary="x", key_facts=["", None, "valid"], key_decisions=[]
        )
        out = _format_ltm_summary(item)
        assert "valid" in out
        # 空字符串和 None 不应出现在 facts_text 中
        # (验证 "关键事实:" 后只有 "valid")
        assert "关键事实: valid" in out


# =============================================================================
# 常量
# =============================================================================


class TestConstants:
    def test_default_priority_order(self):
        """默认 priority: codebase → rag → long_term_memory。"""
        assert DEFAULT_PRIORITY == ["codebase", "rag", "long_term_memory"]

    def test_dataclass_defaults(self):
        """KnowledgeLookupResult 默认值正确。"""
        r = KnowledgeLookupResult(query="test")
        assert r.query == "test"
        assert r.hits == []
        assert r.errors == []
        assert r.duration_ms == 0.0

    def test_knowledge_hit_dataclass(self):
        """KnowledgeHit 可正常构造,raw 默认空 dict。"""
        h = KnowledgeHit(source="codebase", score=0.9, content="x")
        assert h.source == "codebase"
        assert h.score == 0.9
        assert h.content == "x"
        assert h.raw == {}
