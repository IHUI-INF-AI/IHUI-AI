"""RAG service 单元测试。

测试覆盖:
- context 拼接(空源 / 单源 / 多源 / 长度限制)
- rerank(阈值过滤 / 去重)
- 关键词打分(_keyword_score)
- 序列化(RAGResult → dict)
- 模板设置
"""

from __future__ import annotations

import json

import pytest

from app.services.rag import RAGResult, RAGService, RAGSource, rag_service


# =============================================================================
# 基础
# =============================================================================


def test_service_singleton_exists():
    assert rag_service is not None
    assert isinstance(rag_service, RAGService)


def test_default_template_has_placeholder():
    """默认 system template 含 {context} 占位符。"""
    assert "{context}" in rag_service._system_template


def test_set_custom_template():
    """可自定义 template。"""
    original = rag_service._system_template
    try:
        rag_service.set_system_template("Custom: {context}")
        assert rag_service._system_template == "Custom: {context}"
    finally:
        rag_service._system_template = original


# =============================================================================
# 关键词打分
# =============================================================================


class TestKeywordScore:
    def test_empty_inputs(self):
        assert RAGService._keyword_score("", "abc") == 0.0
        assert RAGService._keyword_score("abc", "") == 0.0

    def test_no_match(self):
        score = RAGService._keyword_score("xyz", "abcdef")
        # 单字符查询时 fallback 到 substring
        if "xyz" not in "abcdef":
            assert score == 0.0

    def test_single_keyword_match(self):
        score = RAGService._keyword_score("python function", "this is a python function")
        assert score > 0.0

    def test_multi_keyword_match(self):
        score_single = RAGService._keyword_score("python", "python is great")
        score_multi = RAGService._keyword_score("python function", "python function is great")
        assert score_multi > score_single


# =============================================================================
# Rerank
# =============================================================================


class TestRerank:
    def test_rerank_empty(self):
        assert RAGService._rerank([]) == []

    def test_rerank_sorts_by_score_desc(self):
        sources = [
            RAGSource("s1", "user", "c1", 0.5),
            RAGSource("s2", "user", "c2", 0.9),
            RAGSource("s3", "user", "c3", 0.3),
        ]
        result = RAGService._rerank(sources)
        assert [s.session_id for s in result] == ["s2", "s1", "s3"]

    def test_rerank_filters_by_threshold(self):
        sources = [
            RAGSource("s1", "user", "c1", 0.5),
            RAGSource("s2", "user", "c2", 0.9),
            RAGSource("s3", "user", "c3", 0.3),
        ]
        result = RAGService._rerank(sources, score_threshold=0.4)
        assert len(result) == 2
        assert all(s.score >= 0.4 for s in result)

    def test_rerank_dedupes_content(self):
        sources = [
            RAGSource("s1", "user", "duplicate content", 0.9),
            RAGSource("s2", "user", "duplicate content", 0.8),
            RAGSource("s3", "user", "unique content", 0.7),
        ]
        result = RAGService._rerank(sources)
        assert len(result) == 2
        contents = {s.content for s in result}
        assert "duplicate content" in contents
        assert "unique content" in contents


# =============================================================================
# Context 拼接
# =============================================================================


class TestBuildContext:
    def test_empty_sources(self):
        context, tokens = RAGService._build_context([])
        assert context == ""
        assert tokens == 0

    def test_single_source(self):
        sources = [RAGSource("s1", "user", "hello world", 0.9)]
        context, tokens = RAGService._build_context(sources)
        assert "hello world" in context
        assert "[来源 1]" in context
        assert tokens > 0

    def test_multiple_sources_numbered(self):
        sources = [
            RAGSource("s1", "user", "first content", 0.9),
            RAGSource("s2", "assistant", "second content", 0.7),
        ]
        context, tokens = RAGService._build_context(sources)
        assert "[来源 1]" in context
        assert "[来源 2]" in context
        assert "first content" in context
        assert "second content" in context

    def test_max_chars_truncation(self):
        long_content = "x" * 5000
        sources = [
            RAGSource("s1", "user", long_content, 0.9),
            RAGSource("s2", "user", "y" * 5000, 0.8),
        ]
        context, tokens = RAGService._build_context(sources, max_chars=1000)
        assert len(context) <= 1500  # 允许截断提示
        # 第一个源应被截断或截断提示
        assert "(已截断)" in context or len(context) < 10000

    def test_score_in_context(self):
        sources = [RAGSource("s1", "user", "content", 0.85)]
        context, _ = RAGService._build_context(sources)
        assert "0.85" in context or "0.850" in context


# =============================================================================
# 序列化
# =============================================================================


def test_result_to_dict_complete():
    """result_to_dict 包含所有必要字段。"""
    sources = [RAGSource("s1", "user", "test content", 0.9)]
    result = RAGResult(
        query="q",
        answer="a",
        sources=sources,
        model="gpt-4",
        context_tokens=100,
        duration_ms=50.0,
        stub=True,
        trace=[{"node": "retrieve"}],
    )
    d = RAGService.result_to_dict(result)
    assert d["query"] == "q"
    assert d["answer"] == "a"
    assert d["source_count"] == 1
    assert d["model"] == "gpt-4"
    assert d["stub"] is True
    assert d["sources"][0]["session_id"] == "s1"
    assert d["sources"][0]["score"] == 0.9


def test_result_to_dict_json_serializable():
    """result_to_dict 可 JSON 序列化。"""
    result = RAGResult(
        query="q", answer="a", sources=[], model="m",
        context_tokens=0, duration_ms=0.0, stub=True,
    )
    d = RAGService.result_to_dict(result)
    json.dumps(d)  # 不抛异常


def test_result_to_dict_truncates_long_content():
    """长 content 在序列化时被截断(避免 API 响应过大)。"""
    sources = [RAGSource("s1", "user", "x" * 5000, 0.9)]
    result = RAGResult(
        query="q", answer="a", sources=sources, model="m",
        context_tokens=0, duration_ms=0.0, stub=True,
    )
    d = RAGService.result_to_dict(result)
    assert len(d["sources"][0]["content"]) <= 500
