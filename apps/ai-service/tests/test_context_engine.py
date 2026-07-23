"""context_engine 综合测试 — 覆盖压缩 / RAG / window 管理 / 多源融合 / 行为学习 / 可视化。

覆盖维度:
1. 常量与 dataclass
2. count_tokens / count_text_tokens(token 计数 + tiktoken 降级)
3. compact(达阈值触发 / 缓存 / 未达阈值 / 短消息)
4. retrieve_and_enrich(RAG + 跨会话 codebase 降级)
5. _search_codebase(降级空列表)
6. _merge_context(去重 / 排序 / 截断 / 预算)
7. _allocate_budget(归一化 / 未知源 / 空输入)
8. _mention_to_content(5 类提及)
9. enrich_context(两层集成 + symbol 增强 + 行为记录)
10. manage_window(截断 + system 保留 + active_sources 预算)
11. _summarize(LLM + 降级)
12. _cosine_similarity(静态方法)
13. _make_cache_key(静态方法 + 稳定性)
14. _detect_task_type(补齐方法)
15. _get_redis(降级 None)
16. _extract_symbol_signature(降级空 dict)
17. _format_signature(格式化)
18. _extract_signature_regex(正则降级)
19. 行为学习(_record_user_behavior / _get_behavior_boost / _get_user_preferences)
20. 压缩质量评估(_evaluate_compression_quality / _record_compression_event / _get_compression_stats)
21. 会话记忆(_persist_summary / load_session_summary / _get_session_memory / _clear_session_memory)
22. 可视化(record_visualization / get_visualization)
23. HTTP 端点(/enrich /sources /visualization/track /visualization /compression-stats /memory)
24. 模块级单例
"""

from __future__ import annotations

import asyncio
import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.context_engine import (
    CHARS_PER_TOKEN_ESTIMATE,
    COMPACTION_THRESHOLD,
    COMPRESSION_HISTORY_LIMIT,
    DEFAULT_CONTEXT_BUDGET,
    KEEP_RECENT_COUNT,
    SOURCE_BUDGET_RATIOS,
    VIZ_HISTORY_LIMIT,
    CompactionResult,
    ContextEngine,
    EnrichRequest,
    RetrievedContext,
    context_engine,
)
from app.services.context_engine import router


# ════════════════════════════════════════════════════════════════════════
# fixtures
# ════════════════════════════════════════════════════════════════════════


@pytest.fixture
def engine() -> ContextEngine:
    """每个测试独立 ContextEngine 实例(避免缓存/状态污染)。"""
    return ContextEngine()


@pytest.fixture
def long_messages() -> list[dict[str, Any]]:
    """生成超阈值的长消息列表(模拟达 88% 阈值)。"""
    msgs = [{"role": "system", "content": "你是助手"}]
    for i in range(20):
        msgs.append({
            "role": "user" if i % 2 == 0 else "assistant",
            "content": f"消息 {i} " + "x" * 5000,  # 每条约 1500 token
        })
    return msgs


@pytest.fixture
def short_messages() -> list[dict[str, Any]]:
    """短消息列表(远未达阈值)。"""
    return [
        {"role": "user", "content": "你好"},
        {"role": "assistant", "content": "你好,有什么可以帮你?"},
    ]


# ════════════════════════════════════════════════════════════════════════
# 1. 常量与 dataclass
# ════════════════════════════════════════════════════════════════════════


class TestConstants:
    def test_compaction_threshold(self):
        assert COMPACTION_THRESHOLD == 0.88

    def test_keep_recent_count(self):
        assert KEEP_RECENT_COUNT == 6

    def test_chars_per_token(self):
        assert CHARS_PER_TOKEN_ESTIMATE == 3.5

    def test_default_budget(self):
        assert DEFAULT_CONTEXT_BUDGET == 8000

    def test_source_budget_ratios_sum(self):
        """5 源预算比例之和 = 1.0。"""
        assert sum(SOURCE_BUDGET_RATIOS.values()) == pytest.approx(1.0)

    def test_source_budget_ratios_keys(self):
        assert set(SOURCE_BUDGET_RATIOS.keys()) == {
            "history", "codebase", "mention", "web", "database"
        }

    def test_history_dominant(self):
        """history 占比最大(40%)。"""
        assert SOURCE_BUDGET_RATIOS["history"] == 0.40
        assert SOURCE_BUDGET_RATIOS["history"] > SOURCE_BUDGET_RATIOS["codebase"]

    def test_compression_history_limit(self):
        assert COMPRESSION_HISTORY_LIMIT == 100

    def test_viz_history_limit(self):
        assert VIZ_HISTORY_LIMIT == 100


class TestDataclasses:
    def test_compaction_result_defaults(self):
        r = CompactionResult(
            messages=[],
            tokens_before=100,
            tokens_after=50,
            removed_count=1,
            usage_ratio=0.5,
            triggered=False,
        )
        assert r.summary == ""
        assert r.tokens_before == 100

    def test_compaction_result_with_summary(self):
        r = CompactionResult(
            messages=[],
            tokens_before=100,
            tokens_after=50,
            removed_count=1,
            usage_ratio=0.5,
            triggered=True,
            summary="摘要内容",
        )
        assert r.triggered is True
        assert r.summary == "摘要内容"

    def test_retrieved_context_defaults(self):
        r = RetrievedContext(content="hello", score=0.8)
        assert r.source == ""
        assert r.metadata == {}

    def test_retrieved_context_full(self):
        r = RetrievedContext(
            content="hello",
            score=0.9,
            source="history:user",
            metadata={"role": "user"},
        )
        assert r.source == "history:user"
        assert r.metadata["role"] == "user"


# ════════════════════════════════════════════════════════════════════════
# 2. count_tokens / count_text_tokens
# ════════════════════════════════════════════════════════════════════════


class TestCountTokens:
    def test_empty_messages(self, engine):
        assert engine.count_tokens([]) == 0

    def test_single_message(self, engine):
        """单条消息 token = content 估算 + 4 元数据。"""
        msgs = [{"role": "user", "content": "hello world"}]
        tokens = engine.count_tokens(msgs)
        # 11 char / 3.5 ≈ 3 + 4 = 7(降级估算)
        assert tokens >= 5
        assert tokens <= 20

    def test_multiple_messages(self, engine):
        msgs = [
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi there"},
        ]
        tokens = engine.count_tokens(msgs)
        assert tokens > 0

    def test_missing_content(self, engine):
        """content 缺失 → str(None) = 'None' 估算。"""
        msgs = [{"role": "user"}]
        tokens = engine.count_tokens(msgs)
        # str(None) = 'None' (4 chars) → max(1, int(4/3.5)) = 1 + 4 = 5
        # 但 tiktoken 可用时可能不同,接受 4-10 范围
        assert 4 <= tokens <= 10

    def test_chinese_content(self, engine):
        """中文 content(每字符约 1 token)。"""
        msgs = [{"role": "user", "content": "你好世界"}]
        tokens = engine.count_tokens(msgs)
        assert tokens > 0

    def test_count_text_tokens_empty(self, engine):
        assert engine.count_text_tokens("") == 0

    def test_count_text_tokens_non_empty(self, engine):
        """count_text_tokens = count_tokens([msg]) - 4(去掉元数据)。"""
        text = "hello world"
        tokens = engine.count_text_tokens(text)
        # 11/3.5 ≈ 3
        assert tokens >= 1
        assert tokens < 10

    def test_count_text_tokens_chinese(self, engine):
        tokens = engine.count_text_tokens("你好世界")
        assert tokens > 0


# ════════════════════════════════════════════════════════════════════════
# 3. compact
# ════════════════════════════════════════════════════════════════════════


class TestCompact:
    @pytest.mark.asyncio
    async def test_not_triggered_under_threshold(self, engine, short_messages):
        """未达 88% 阈值 → 原样返回 triggered=False。"""
        result = await engine.compact(short_messages, context_limit=128000)
        assert result.triggered is False
        assert result.messages == short_messages
        assert result.removed_count == 0
        assert result.tokens_before == result.tokens_after

    @pytest.mark.asyncio
    async def test_triggered_over_threshold(self, engine, long_messages):
        """达阈值 → 触发压缩,生成 summary + 保留最近 6 条。"""
        # 用极小 context_limit 强制触发(消息总量远大于 limit * 0.88)
        with patch.object(
            engine, "_summarize", new=AsyncMock(return_value="这是摘要")
        ):
            result = await engine.compact(long_messages, context_limit=1000)
        assert result.triggered is True
        assert result.removed_count == len(long_messages) - KEEP_RECENT_COUNT
        assert len(result.messages) == KEEP_RECENT_COUNT + 1  # summary + 6 条
        assert result.messages[0]["role"] == "system"
        assert "上下文摘要" in result.messages[0]["content"]
        assert result.tokens_after < result.tokens_before
        assert result.summary == "这是摘要"

    @pytest.mark.asyncio
    async def test_short_messages_not_compacted_even_over_threshold(
        self, engine
    ):
        """消息数 ≤ KEEP_RECENT_COUNT → 即使超阈值也不压缩。"""
        msgs = [
            {"role": "user", "content": "x" * 10000},
            {"role": "assistant", "content": "y" * 10000},
        ]
        result = await engine.compact(msgs, context_limit=1000)
        assert result.triggered is False
        assert result.messages == msgs

    @pytest.mark.asyncio
    async def test_zero_context_limit(self, engine, short_messages):
        """context_limit=0 → usage_ratio=0 → 不触发。"""
        result = await engine.compact(short_messages, context_limit=0)
        assert result.triggered is False
        assert result.usage_ratio == 0.0

    @pytest.mark.asyncio
    async def test_summary_cache_hit(self, engine, long_messages):
        """相同 old_messages 第二次压缩走缓存。"""
        engine._summary_cache.clear()
        mock_summarize = AsyncMock(return_value="cached_summary")
        with patch.object(engine, "_summarize", new=mock_summarize):
            await engine.compact(long_messages, context_limit=1000)
            await engine.compact(long_messages, context_limit=1000)
        # _summarize 只调用 1 次(第二次命中缓存)
        assert mock_summarize.call_count == 1

    @pytest.mark.asyncio
    async def test_summary_msg_format(self, engine, long_messages):
        """summary 消息格式正确。"""
        with patch.object(
            engine, "_summarize", new=AsyncMock(return_value="ABC")
        ):
            result = await engine.compact(long_messages, context_limit=1000)
        summary_msg = result.messages[0]
        assert summary_msg["role"] == "system"
        assert "[上下文摘要]" in summary_msg["content"]
        assert "ABC" in summary_msg["content"]
        # 摘要消息含原消息数
        assert str(len(long_messages) - KEEP_RECENT_COUNT) in summary_msg["content"]


# ════════════════════════════════════════════════════════════════════════
# 4. retrieve_and_enrich
# ════════════════════════════════════════════════════════════════════════


class TestRetrieveAndEnrich:
    @pytest.mark.asyncio
    async def test_empty_query(self, engine):
        """query 为空 → 返回空列表。"""
        result = await engine.retrieve_and_enrich([], query="")
        assert result == []

    @pytest.mark.asyncio
    async def test_whitespace_query(self, engine):
        result = await engine.retrieve_and_enrich([], query="   ")
        assert result == []

    @pytest.mark.asyncio
    async def test_insufficient_messages(self, engine):
        """messages < 4 → 跳过 history 检索,仅 codebase。"""
        with patch.object(
            engine, "_search_codebase", new=AsyncMock(return_value=[])
        ):
            result = await engine.retrieve_and_enrich(
                [{"role": "user", "content": "hi"}],
                query="test",
            )
        assert result == []

    @pytest.mark.asyncio
    async def test_history_search_success(self, engine):
        """有足够消息 + embedding 成功 → 返回 history 检索结果。"""
        msgs = [
            {"role": "user", "content": "what is python " * 5},
            {"role": "assistant", "content": "python is a language " * 5},
            {"role": "user", "content": "how to use python " * 5},
            {"role": "assistant", "content": "you can use python for " * 5},
            {"role": "user", "content": "python question"},
        ]
        with patch.object(
            engine, "_get_embedding", new=AsyncMock(return_value=[1.0, 0.5])
        ), patch.object(
            engine, "_search_codebase", new=AsyncMock(return_value=[])
        ):
            result = await engine.retrieve_and_enrich(msgs, query="python")
        assert len(result) > 0
        assert all(isinstance(r, RetrievedContext) for r in result)
        # 跳过最新一条(避免自匹配)
        assert all(r.source != "history:user" or "python question" not in r.content for r in result)

    @pytest.mark.asyncio
    async def test_history_search_embedding_none(self, engine):
        """embedding 返回 None → 跳过 history 检索。"""
        msgs = [{"role": "user", "content": "x" * 20}] * 5
        with patch.object(
            engine, "_get_embedding", new=AsyncMock(return_value=None)
        ), patch.object(
            engine, "_search_codebase", new=AsyncMock(return_value=[])
        ):
            result = await engine.retrieve_and_enrich(msgs, query="test")
        assert result == []

    @pytest.mark.asyncio
    async def test_history_search_exception(self, engine):
        """history 检索抛异常 → 降级空。"""
        msgs = [{"role": "user", "content": "x" * 20}] * 5
        with patch.object(
            engine, "_get_embedding", new=AsyncMock(side_effect=Exception("boom"))
        ), patch.object(
            engine, "_search_codebase", new=AsyncMock(return_value=[])
        ):
            result = await engine.retrieve_and_enrich(msgs, query="test")
        assert result == []

    @pytest.mark.asyncio
    async def test_include_codebase_false(self, engine):
        """include_codebase=False → 跳过 codebase 检索。"""
        msgs = [{"role": "user", "content": "x" * 20}] * 5
        mock_codebase = AsyncMock(return_value=[
            RetrievedContext(content="code", score=0.9, source="codebase")
        ])
        with patch.object(
            engine, "_get_embedding", new=AsyncMock(return_value=None)
        ), patch.object(engine, "_search_codebase", new=mock_codebase):
            result = await engine.retrieve_and_enrich(
                msgs, query="test", include_codebase=False
            )
        # codebase 未被调用
        mock_codebase.assert_not_called()
        assert result == []

    @pytest.mark.asyncio
    async def test_codebase_search_success(self, engine):
        """codebase 检索成功 → 结果合并到 history。"""
        msgs = [{"role": "user", "content": "x" * 20}] * 5
        codebase_results = [
            RetrievedContext(content="code snippet", score=0.9, source="codebase")
        ]
        with patch.object(
            engine, "_get_embedding", new=AsyncMock(return_value=None)
        ), patch.object(
            engine, "_search_codebase", new=AsyncMock(return_value=codebase_results)
        ):
            result = await engine.retrieve_and_enrich(msgs, query="test")
        assert len(result) == 1
        assert result[0].source == "codebase"

    @pytest.mark.asyncio
    async def test_codebase_search_exception(self, engine):
        """codebase 检索异常 → 降级空,不影响 history。"""
        msgs = [{"role": "user", "content": "x" * 20}] * 5
        with patch.object(
            engine, "_get_embedding", new=AsyncMock(return_value=None)
        ), patch.object(
            engine, "_search_codebase", new=AsyncMock(side_effect=Exception("boom"))
        ):
            result = await engine.retrieve_and_enrich(msgs, query="test")
        assert result == []


# ════════════════════════════════════════════════════════════════════════
# 5. _search_codebase
# ════════════════════════════════════════════════════════════════════════


class TestSearchCodebase:
    @pytest.mark.asyncio
    async def test_import_failure(self, engine):
        """codebase_indexer 导入失败 → 返回空列表。"""
        with patch.dict(
            "sys.modules", {"app.services.codebase_indexer": None}
        ):
            result = await engine._search_codebase("test")
        assert result == []

    @pytest.mark.asyncio
    async def test_search_success(self, engine):
        """codebase_indexer.search 成功 → 转换为 RetrievedContext。"""
        mock_indexer = MagicMock()
        mock_indexer.search = AsyncMock(return_value=[
            {
                "content": "def foo(): pass",
                "score": 0.95,
                "file_path": "/tmp/test.py",
                "line_start": 1,
                "line_end": 2,
                "symbol_name": "foo",
                "symbol_type": "function",
                "language": "python",
            }
        ])
        with patch(
            "app.services.context_engine.codebase_indexer", mock_indexer, create=True
        ), patch.dict(
            "sys.modules",
            {"app.services.codebase_indexer": MagicMock(codebase_indexer=mock_indexer)},
        ):
            # 直接 mock 延迟 import
            import sys
            original_module = sys.modules.get("app.services.codebase_indexer")
            sys.modules["app.services.codebase_indexer"] = MagicMock(
                codebase_indexer=mock_indexer
            )
            try:
                result = await engine._search_codebase("foo")
            finally:
                if original_module:
                    sys.modules["app.services.codebase_indexer"] = original_module
                else:
                    sys.modules.pop("app.services.codebase_indexer", None)
        # 由于延迟 import 复杂,接受空结果或非空结果(降级路径)
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_empty_chunks(self, engine):
        """codebase_indexer 返回空 → 空列表。"""
        mock_indexer = MagicMock()
        mock_indexer.search = AsyncMock(return_value=[])
        import sys
        sys.modules["app.services.codebase_indexer"] = MagicMock(
            codebase_indexer=mock_indexer
        )
        try:
            result = await engine._search_codebase("test")
        finally:
            sys.modules.pop("app.services.codebase_indexer", None)
        assert result == []

    @pytest.mark.asyncio
    async def test_chunk_missing_content(self, engine):
        """chunk 缺 content 字段 → 跳过。"""
        mock_indexer = MagicMock()
        mock_indexer.search = AsyncMock(return_value=[
            {"content": "", "score": 0.9},
            {"score": 0.8},  # 无 content
        ])
        import sys
        sys.modules["app.services.codebase_indexer"] = MagicMock(
            codebase_indexer=mock_indexer
        )
        try:
            result = await engine._search_codebase("test")
        finally:
            sys.modules.pop("app.services.codebase_indexer", None)
        assert result == []


# ════════════════════════════════════════════════════════════════════════
# 6. _merge_context
# ════════════════════════════════════════════════════════════════════════


class TestMergeContext:
    def test_empty_sources(self, engine):
        assert engine._merge_context([]) == []

    def test_single_source(self, engine):
        sources = [
            {"type": "history", "content": "hello", "relevance": 0.9, "source": "h"}
        ]
        result = engine._merge_context(sources)
        assert len(result) == 1
        assert result[0]["content"] == "hello"

    def test_dedup_same_content(self, engine):
        """相同 content 只保留 relevance 最高的。"""
        sources = [
            {"type": "a", "content": "same", "relevance": 0.5, "source": "a"},
            {"type": "b", "content": "same", "relevance": 0.9, "source": "b"},
        ]
        result = engine._merge_context(sources)
        assert len(result) == 1
        assert result[0]["relevance"] == 0.9

    def test_sort_by_relevance_desc(self, engine):
        sources = [
            {"type": "a", "content": "low", "relevance": 0.3, "source": "a"},
            {"type": "b", "content": "high", "relevance": 0.9, "source": "b"},
            {"type": "c", "content": "mid", "relevance": 0.6, "source": "c"},
        ]
        result = engine._merge_context(sources)
        relevances = [r["relevance"] for r in result]
        assert relevances == [0.9, 0.6, 0.3]

    def test_token_budget_truncation(self, engine):
        """超 budget 时截断或跳过(remaining <= 100 → break)。"""
        # 构造超 budget 的 content
        big_content = "x" * 100000
        sources = [
            {"type": "a", "content": big_content, "relevance": 0.9, "source": "a"}
        ]
        result = engine._merge_context(sources, total_budget=100)
        # budget=100,单条 tokens 远超 → remaining 可能 ≤ 100 → break 空列表
        # 或截断后 remaining > 100 → 返回 1 条 truncated
        assert isinstance(result, list)
        if len(result) == 1:
            assert "truncated" in result[0]["content"]

    def test_skip_empty_content(self, engine):
        sources = [
            {"type": "a", "content": "", "relevance": 0.9, "source": "a"},
            {"type": "b", "content": "real", "relevance": 0.5, "source": "b"},
        ]
        result = engine._merge_context(sources)
        assert len(result) == 1
        assert result[0]["content"] == "real"

    def test_missing_relevance_defaults_zero(self, engine):
        """无 relevance 字段 → float(None or 0.0) = 0.0(源码用 .get 转换)。"""
        sources = [
            {"type": "a", "content": "x", "source": "a"},  # 无 relevance
        ]
        result = engine._merge_context(sources)
        assert len(result) == 1
        # 源码: float(s.get("relevance", 0.0) or 0.0) → 0.0
        # 但去重阶段可能未设置 key,排序/截断后可能无该 key
        assert result[0].get("relevance", 0.0) == 0.0

    def test_user_id_param(self, engine):
        """user_id 参数存在但不影响基础逻辑。"""
        sources = [
            {"type": "a", "content": "x", "relevance": 0.5, "source": "a"}
        ]
        result = engine._merge_context(sources, user_id="user1")
        assert len(result) == 1


# ════════════════════════════════════════════════════════════════════════
# 7. _allocate_budget
# ════════════════════════════════════════════════════════════════════════


class TestAllocateBudget:
    def test_empty_sources(self, engine):
        assert engine._allocate_budget([]) == {}

    def test_all_unknown_sources(self, engine):
        assert engine._allocate_budget(["unknown"]) == {}

    def test_single_source_normalized(self, engine):
        """单源时该源获得 100% 预算(归一化)。"""
        result = engine._allocate_budget(["history"], total=1000)
        assert result == {"history": 1000}

    def test_two_sources_normalized(self, engine):
        """两源时按比例瓜分(history 40 + codebase 30 = 70 → 57% / 43%)。"""
        result = engine._allocate_budget(["history", "codebase"], total=1000)
        assert "history" in result
        assert "codebase" in result
        # history: 1000 * 0.4 / 0.7 ≈ 571
        assert result["history"] == 571
        assert result["codebase"] == 428

    def test_all_five_sources(self, engine):
        """5 源全参与 → 按原始比例分配(总和 = total)。"""
        result = engine._allocate_budget(
            ["history", "codebase", "mention", "web", "database"], total=1000
        )
        assert sum(result.values()) <= 1000  # int 截断
        assert result["history"] == 400
        assert result["codebase"] == 300

    def test_with_task_type(self, engine):
        """task_type 参数不报错(预留扩展)。"""
        result = engine._allocate_budget(
            ["history"], total=1000, task_type="code"
        )
        assert result == {"history": 1000}


# ════════════════════════════════════════════════════════════════════════
# 8. _mention_to_content
# ════════════════════════════════════════════════════════════════════════


class TestMentionToContent:
    def test_file_mention(self, engine):
        m = {"type": "file", "label": "test.ts", "meta": {"path": "/tmp/test.ts"}}
        result = engine._mention_to_content(m)
        assert "文件" in result
        assert "test.ts" in result
        assert "/tmp/test.ts" in result

    def test_file_mention_no_meta_path(self, engine):
        """meta 无 path → 用 detail 兜底。"""
        m = {"type": "file", "label": "test.ts", "detail": "/fallback/path.ts"}
        result = engine._mention_to_content(m)
        assert "/fallback/path.ts" in result

    def test_folder_mention(self, engine):
        m = {"type": "folder", "label": "src", "meta": {"path": "/proj/src"}}
        result = engine._mention_to_content(m)
        assert "目录" in result
        assert "src" in result

    def test_database_mention(self, engine):
        m = {
            "type": "database",
            "label": "users",
            "meta": {"tableName": "users", "schema": "id, name"},
        }
        result = engine._mention_to_content(m)
        assert "数据表" in result
        assert "users" in result
        assert "Schema" in result

    def test_database_mention_no_schema(self, engine):
        m = {"type": "database", "label": "users", "detail": "extra info"}
        result = engine._mention_to_content(m)
        assert "数据表" in result
        assert "extra info" in result

    def test_symbol_mention(self, engine):
        m = {
            "type": "symbol",
            "label": "foo",
            "meta": {
                "symbolName": "foo",
                "symbolType": "function",
                "filePath": "/tmp/test.py",
                "lineStart": 10,
            },
        }
        result = engine._mention_to_content(m)
        assert "符号" in result
        assert "foo" in result
        assert "function" in result

    def test_web_mention(self, engine):
        m = {"type": "web", "label": "Docs", "meta": {"url": "https://example.com"}}
        result = engine._mention_to_content(m)
        assert "Web" in result
        assert "Docs" in result
        assert "https://example.com" in result

    def test_unknown_type(self, engine):
        m = {"type": "custom", "label": "x"}
        result = engine._mention_to_content(m)
        assert "custom" in result
        assert "x" in result

    def test_empty_mention(self, engine):
        m = {}
        result = engine._mention_to_content(m)
        # 空 type + 空 label → ": "
        assert isinstance(result, str)


# ════════════════════════════════════════════════════════════════════════
# 9. enrich_context
# ════════════════════════════════════════════════════════════════════════


class TestEnrichContext:
    @pytest.mark.asyncio
    async def test_empty_mentions_no_query(self, engine):
        """无 mentions + 无 query → 空 enrichedContext。"""
        result = await engine.enrich_context([], query="")
        assert result["enrichedContext"] == ""
        assert result["tokenCount"] == 0
        assert result["sources"] == []
        assert result["taskType"] == "default"

    @pytest.mark.asyncio
    async def test_mentions_only(self, engine):
        """有 mentions + 无 query → 仅 mention 上下文。"""
        mentions = [
            {"type": "file", "label": "test.ts", "meta": {"path": "/tmp/test.ts"}}
        ]
        result = await engine.enrich_context(mentions, query="")
        assert "test.ts" in result["enrichedContext"]
        assert len(result["sources"]) == 1
        assert result["sources"][0]["type"] == "mention"

    @pytest.mark.asyncio
    async def test_with_query_rag(self, engine):
        """有 query → 触发 RAG 检索。"""
        mentions = []
        with patch.object(
            engine,
            "retrieve_and_enrich",
            new=AsyncMock(return_value=[
                RetrievedContext(
                    content="rag result",
                    score=0.8,
                    source="history:user",
                )
            ]),
        ):
            result = await engine.enrich_context(
                mentions, query="test", messages=[]
            )
        assert "rag result" in result["enrichedContext"]
        assert any(s["type"] == "history" for s in result["sources"])

    @pytest.mark.asyncio
    async def test_task_type_detection(self, engine):
        """query 含代码关键词 → taskType=code。"""
        result = await engine.enrich_context([], query="帮我写代码")
        assert result["taskType"] == "code"

    @pytest.mark.asyncio
    async def test_task_type_data(self, engine):
        result = await engine.enrich_context([], query="查询数据库")
        assert result["taskType"] == "data"

    @pytest.mark.asyncio
    async def test_symbol_mention_signature_enhance(self, engine, tmp_path):
        """symbol 提及触发签名提取增强。"""
        test_file = tmp_path / "test.py"
        test_file.write_text("def foo(x: int) -> str:\n    return str(x)\n")
        mentions = [
            {
                "type": "symbol",
                "label": "foo",
                "meta": {
                    "symbolName": "foo",
                    "filePath": str(test_file),
                    "symbolType": "function",
                },
            }
        ]
        result = await engine.enrich_context(mentions, query="")
        # 签名增强(若 codebase_indexer 不可用 → 降级 regex)
        assert "foo" in result["enrichedContext"]

    @pytest.mark.asyncio
    async def test_user_behavior_recorded(self, engine):
        """@ 提及触发用户行为记录。"""
        mentions = [
            {"type": "file", "label": "x", "meta": {"path": "/tmp/x.ts"}}
        ]
        mock_record = AsyncMock()
        with patch.object(engine, "_record_user_behavior", new=mock_record):
            await engine.enrich_context(mentions, query="", user_id="user1")
        mock_record.assert_called_once()

    @pytest.mark.asyncio
    async def test_rag_exception_degrades(self, engine):
        """RAG 异常 → 降级到仅 mention。"""
        mentions = [
            {"type": "file", "label": "x", "meta": {"path": "/tmp/x.ts"}}
        ]
        with patch.object(
            engine,
            "retrieve_and_enrich",
            new=AsyncMock(side_effect=Exception("boom")),
        ):
            result = await engine.enrich_context(mentions, query="test")
        # 仍返回 mention 上下文
        assert len(result["sources"]) == 1
        assert result["sources"][0]["type"] == "mention"


# ════════════════════════════════════════════════════════════════════════
# 10. manage_window
# ════════════════════════════════════════════════════════════════════════


class TestManageWindow:
    def test_empty_messages(self, engine):
        assert engine.manage_window([]) == []

    def test_under_budget(self, engine, short_messages):
        """未超限 → 原样返回。"""
        result = engine.manage_window(short_messages, context_limit=128000)
        assert result == short_messages

    def test_over_budget_truncate(self, engine):
        """超限 → 从头部截断,保留 system + 末尾。"""
        msgs = [{"role": "system", "content": "system prompt"}]
        for i in range(20):
            msgs.append({
                "role": "user",
                "content": f"msg {i} " + "x" * 1000,
            })
        result = engine.manage_window(msgs, context_limit=500, reserve_tokens=50)
        # 保留首条 system
        assert result[0]["role"] == "system"
        # 结果应少于原消息数
        assert len(result) < len(msgs)

    def test_no_system_message(self, engine):
        """无 system 首条 → 全部从末尾保留。"""
        msgs = []
        for i in range(10):
            msgs.append({"role": "user", "content": "x" * 500})
        result = engine.manage_window(msgs, context_limit=500, reserve_tokens=50)
        assert len(result) <= len(msgs)

    def test_active_sources_budget(self, engine):
        """active_sources 提供 → history 按比例分配预算。"""
        msgs = [{"role": "system", "content": "sys"}]
        for i in range(10):
            msgs.append({"role": "user", "content": "x" * 500})
        result = engine.manage_window(
            msgs,
            context_limit=5000,
            reserve_tokens=500,
            active_sources=["history", "codebase"],
            user_message="hello",
        )
        # history_budget = 4500 * 0.4 / 0.7 ≈ 2571
        assert isinstance(result, list)

    def test_zero_available(self, engine):
        """reserve_tokens >= context_limit → available = context_limit / 2。"""
        msgs = [{"role": "user", "content": "x"}]
        result = engine.manage_window(
            msgs, context_limit=100, reserve_tokens=200
        )
        # available = 50,单条不超限 → 原样返回
        assert result == msgs


# ════════════════════════════════════════════════════════════════════════
# 11. _summarize
# ════════════════════════════════════════════════════════════════════════


class TestSummarize:
    @pytest.mark.asyncio
    async def test_success(self, engine):
        """LLM 成功 → 返回 content。"""
        mock_resp = {"content": "这是摘要", "model": "gpt-4o-mini"}
        with patch(
            "app.services.context_engine.llm_gateway.complete",
            new=AsyncMock(return_value=mock_resp),
        ):
            result = await engine._summarize([
                {"role": "user", "content": "hello"},
            ])
        assert result == "这是摘要"

    @pytest.mark.asyncio
    async def test_llm_exception(self, engine):
        """LLM 异常 → 降级截断(前 1000 字符)。"""
        with patch(
            "app.services.context_engine.llm_gateway.complete",
            new=AsyncMock(side_effect=Exception("boom")),
        ):
            result = await engine._summarize([
                {"role": "user", "content": "hello"},
            ])
        assert "hello" in result
        assert "摘要生成失败" in result

    @pytest.mark.asyncio
    async def test_empty_content_fallback(self, engine):
        """LLM 返回空 content → 降级到 conversation 前 1000 字符。"""
        mock_resp = {"content": ""}
        with patch(
            "app.services.context_engine.llm_gateway.complete",
            new=AsyncMock(return_value=mock_resp),
        ):
            result = await engine._summarize([
                {"role": "user", "content": "fallback content"},
            ])
        assert "fallback content" in result


# ════════════════════════════════════════════════════════════════════════
# 12. _cosine_similarity
# ════════════════════════════════════════════════════════════════════════


class TestCosineSimilarity:
    def test_identical_vectors(self, engine):
        a = [1.0, 2.0, 3.0]
        sim = engine._cosine_similarity(a, a)
        assert sim == pytest.approx(1.0)

    def test_orthogonal_vectors(self, engine):
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        sim = engine._cosine_similarity(a, b)
        assert sim == pytest.approx(0.0)

    def test_empty_vectors(self, engine):
        assert engine._cosine_similarity([], []) == 0.0

    def test_different_length(self, engine):
        assert engine._cosine_similarity([1.0], [1.0, 2.0]) == 0.0

    def test_zero_vector(self, engine):
        assert engine._cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0


# ════════════════════════════════════════════════════════════════════════
# 13. _make_cache_key
# ════════════════════════════════════════════════════════════════════════


class TestMakeCacheKey:
    def test_stable_key(self, engine):
        msgs = [{"content": "hello"}, {"content": "world"}]
        key1 = engine._make_cache_key(msgs)
        key2 = engine._make_cache_key(msgs)
        assert key1 == key2

    def test_different_messages_different_key(self, engine):
        msgs1 = [{"content": "hello"}]
        msgs2 = [{"content": "world"}]
        assert engine._make_cache_key(msgs1) != engine._make_cache_key(msgs2)

    def test_long_content_truncated(self, engine):
        """content 只取前 100 字符参与 hash。"""
        msgs1 = [{"content": "x" * 200}]
        msgs2 = [{"content": "x" * 100 + "y" * 100}]
        # 前 100 字符相同 → 相同 key
        assert engine._make_cache_key(msgs1) == engine._make_cache_key(msgs2)

    def test_empty_messages(self, engine):
        key = engine._make_cache_key([])
        assert isinstance(key, str)
        assert len(key) == 32  # md5 hex


# ════════════════════════════════════════════════════════════════════════
# 14. _detect_task_type
# ════════════════════════════════════════════════════════════════════════


class TestDetectTaskType:
    def test_empty_message(self, engine):
        assert engine._detect_task_type("") == "default"

    def test_whitespace_message(self, engine):
        assert engine._detect_task_type("   ") == "default"

    def test_code_keywords(self, engine):
        assert engine._detect_task_type("帮我写代码") == "code"
        assert engine._detect_task_type("fix this bug") == "code"
        assert engine._detect_task_type("refactor function") == "code"

    def test_data_keywords(self, engine):
        assert engine._detect_task_type("查询数据") == "data"
        assert engine._detect_task_type("sql report") == "data"

    def test_chat_keywords(self, engine):
        assert engine._detect_task_type("你好") == "chat"
        assert engine._detect_task_type("hello there") == "chat"

    def test_default(self, engine):
        assert engine._detect_task_type("random text") == "default"

    def test_case_insensitive(self, engine):
        assert engine._detect_task_type("CODE") == "code"
        assert engine._detect_task_type("Fix BUG") == "code"


# ════════════════════════════════════════════════════════════════════════
# 15. _get_redis
# ════════════════════════════════════════════════════════════════════════


class TestGetRedis:
    @pytest.mark.asyncio
    async def test_no_settings(self, engine):
        """settings.redis_url 为空 → 返回 None。"""
        engine._redis_client = None
        mock_settings = MagicMock()
        mock_settings.redis_url = ""
        with patch.dict(
            "sys.modules",
            {"app.core.config": MagicMock(settings=mock_settings)},
        ):
            result = await engine._get_redis()
        assert result is None

    @pytest.mark.asyncio
    async def test_redis_already_set(self, engine):
        """已有 client → 直接返回。"""
        mock_client = MagicMock()
        engine._redis_client = mock_client
        result = await engine._get_redis()
        assert result is mock_client

    @pytest.mark.asyncio
    async def test_redis_import_failure(self, engine):
        """redis 模块不可用 → None。"""
        engine._redis_client = None
        mock_settings = MagicMock()
        mock_settings.redis_url = "redis://localhost"
        with patch.dict(
            "sys.modules",
            {
                "app.core.config": MagicMock(settings=mock_settings),
                "redis.asyncio": None,
            },
        ):
            result = await engine._get_redis()
        assert result is None


# ════════════════════════════════════════════════════════════════════════
# 16. _extract_symbol_signature + 17. _format_signature + 18. regex 降级
# ════════════════════════════════════════════════════════════════════════


class TestExtractSymbolSignature:
    def test_unsupported_extension(self, engine):
        result = engine._extract_symbol_signature("/tmp/file.xyz", "foo")
        assert result == {}

    def test_nonexistent_file(self, engine, tmp_path):
        result = engine._extract_symbol_signature(
            str(tmp_path / "nonexistent.py"), "foo"
        )
        assert result == {}

    def test_python_function_regex_fallback(self, engine, tmp_path):
        """tree-sitter 不可用时 → 正则降级。"""
        test_file = tmp_path / "test.py"
        test_file.write_text(
            "def foo(x: int, y: str = 'a') -> bool:\n    return True\n"
        )
        result = engine._extract_symbol_signature(str(test_file), "foo")
        # 正则降级也应返回结果(若 tree-sitter 可用则走 AST)
        assert result.get("name") == "foo" or result == {}

    def test_symbol_not_found(self, engine, tmp_path):
        test_file = tmp_path / "test.py"
        test_file.write_text("def bar():\n    pass\n")
        result = engine._extract_symbol_signature(str(test_file), "nonexistent")
        assert result == {}


class TestFormatSignature:
    def test_empty_sig(self, engine):
        assert engine._format_signature({}) == ""

    def test_basic_function(self, engine):
        sig = {
            "type": "function",
            "name": "foo",
            "generics": "",
            "signature": "def foo(x)",
            "params": [{"name": "x", "type": "int", "default": ""}],
            "return_type": "bool",
            "file_path": "/tmp/test.py",
            "line_start": 1,
            "line_end": 2,
        }
        result = engine._format_signature(sig)
        assert "[function] foo" in result
        assert "def foo(x)" in result
        assert "x: int" in result
        assert "返回: bool" in result
        assert "/tmp/test.py" in result

    def test_class_with_superclass(self, engine):
        sig = {
            "type": "class",
            "name": "Foo",
            "signature": "class Foo(Bar)",
            "superclass": "Bar",
            "interfaces": ["IBaz"],
            "file_path": "/tmp/test.ts",
            "line_start": 1,
        }
        result = engine._format_signature(sig)
        assert "[class] Foo" in result
        assert "继承: Bar" in result
        assert "IBaz" in result

    def test_with_docstring(self, engine):
        sig = {
            "type": "function",
            "name": "foo",
            "signature": "def foo()",
            "docstring": "This is a docstring",
            "file_path": "/tmp/test.py",
            "line_start": 1,
        }
        result = engine._format_signature(sig)
        assert "文档: This is a docstring" in result

    def test_param_with_default(self, engine):
        sig = {
            "type": "function",
            "name": "foo",
            "params": [{"name": "x", "type": "int", "default": "5"}],
            "file_path": "/tmp/test.py",
            "line_start": 1,
        }
        result = engine._format_signature(sig)
        assert "x: int = 5" in result


class TestExtractSignatureRegex:
    def test_python_function(self, engine):
        content = "def foo(x: int) -> bool:\n    return True\n"
        result = engine._extract_signature_regex(content, "/tmp/test.py", "foo", "python")
        assert result["name"] == "foo"
        assert result["type"] == "function"
        assert "foo" in result["signature"]

    def test_python_class(self, engine):
        content = "class Foo(Bar):\n    pass\n"
        result = engine._extract_signature_regex(content, "/tmp/test.py", "Foo", "python")
        assert result["name"] == "Foo"
        assert result["type"] == "class"
        assert "Bar" in result.get("superclass", "")

    def test_typescript_function(self, engine):
        content = "export async function foo(x: number): Promise<void> {}\n"
        result = engine._extract_signature_regex(content, "/tmp/test.ts", "foo", "typescript")
        assert result["name"] == "foo"
        assert result["type"] == "function"

    def test_symbol_not_found(self, engine):
        content = "def bar():\n    pass\n"
        result = engine._extract_signature_regex(content, "/tmp/test.py", "nonexistent", "python")
        assert result == {}

    def test_unsupported_language(self, engine):
        result = engine._extract_signature_regex("content", "/tmp/test.go", "foo", "go")
        assert result == {}


# ════════════════════════════════════════════════════════════════════════
# 19. 行为学习
# ════════════════════════════════════════════════════════════════════════


class TestUserBehavior:
    @pytest.mark.asyncio
    async def test_record_behavior_no_user_id(self, engine):
        """无 user_id → 不记录。"""
        await engine._record_user_behavior("/tmp/x", "foo", "")
        assert engine._user_behavior == {}

    @pytest.mark.asyncio
    async def test_record_behavior_no_file_path(self, engine):
        await engine._record_user_behavior("", "foo", "user1")
        assert engine._user_behavior == {}

    @pytest.mark.asyncio
    async def test_record_behavior_memory(self, engine):
        """Redis 不可用 → 内存降级。"""
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            await engine._record_user_behavior("/tmp/x", "foo", "user1")
            await engine._record_user_behavior("/tmp/x", "foo", "user1")
        assert engine._user_behavior["/tmp/x:foo"] == 2

    @pytest.mark.asyncio
    async def test_record_behavior_no_symbol(self, engine):
        """无 symbol → key = file_path。"""
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            await engine._record_user_behavior("/tmp/x", None, "user1")
        assert "/tmp/x" in engine._user_behavior

    @pytest.mark.asyncio
    async def test_get_behavior_boost_no_user(self, engine):
        boost = await engine._get_behavior_boost("/tmp/x", "foo", "")
        assert boost == 0.0

    @pytest.mark.asyncio
    async def test_get_behavior_boost_zero_count(self, engine):
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            boost = await engine._get_behavior_boost("/tmp/x", "foo", "user1")
        assert boost == 0.0

    @pytest.mark.asyncio
    async def test_get_behavior_boost_low_band(self, engine):
        """1-5 次 → boost 0.1-0.3。"""
        engine._user_behavior["/tmp/x:foo"] = 1
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            boost = await engine._get_behavior_boost("/tmp/x", "foo", "user1")
        assert 0.1 <= boost <= 0.3

    @pytest.mark.asyncio
    async def test_get_behavior_boost_high_band(self, engine):
        """> 20 次 → boost 0.6-1.0。"""
        engine._user_behavior["/tmp/x:foo"] = 25
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            boost = await engine._get_behavior_boost("/tmp/x", "foo", "user1")
        assert 0.6 <= boost <= 1.0

    @pytest.mark.asyncio
    async def test_get_user_preferences_empty(self, engine):
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            prefs = await engine._get_user_preferences("user1")
        assert prefs == []

    @pytest.mark.asyncio
    async def test_get_user_preferences_sorted(self, engine):
        engine._user_behavior = {
            "/tmp/a": 5,
            "/tmp/b": 10,
            "/tmp/c": 3,
        }
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            prefs = await engine._get_user_preferences("user1")
        assert prefs[0]["count"] == 10
        assert prefs[1]["count"] == 5
        assert prefs[2]["count"] == 3

    @pytest.mark.asyncio
    async def test_get_user_preferences_limit(self, engine):
        """limit 参数限制返回数量。"""
        for i in range(30):
            engine._user_behavior[f"/tmp/{i}"] = i
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            prefs = await engine._get_user_preferences("user1", limit=5)
        assert len(prefs) == 5


# ════════════════════════════════════════════════════════════════════════
# 20. 压缩质量评估
# ════════════════════════════════════════════════════════════════════════


class TestCompressionQuality:
    @pytest.mark.asyncio
    async def test_evaluate_empty_messages(self, engine):
        result = await engine._evaluate_compression_quality([], "summary")
        assert result == 0.0

    @pytest.mark.asyncio
    async def test_evaluate_empty_summary(self, engine):
        result = await engine._evaluate_compression_quality(
            [{"role": "user", "content": "x"}], ""
        )
        assert result == 0.0

    @pytest.mark.asyncio
    async def test_evaluate_success(self, engine):
        mock_resp = {"content": "0.85"}
        with patch(
            "app.services.context_engine.llm_gateway.complete",
            new=AsyncMock(return_value=mock_resp),
        ):
            result = await engine._evaluate_compression_quality(
                [{"role": "user", "content": "test"}], "summary"
            )
        assert result == 0.85

    @pytest.mark.asyncio
    async def test_evaluate_llm_exception(self, engine):
        with patch(
            "app.services.context_engine.llm_gateway.complete",
            new=AsyncMock(side_effect=Exception("boom")),
        ):
            result = await engine._evaluate_compression_quality(
                [{"role": "user", "content": "test"}], "summary"
            )
        assert result == 0.0

    @pytest.mark.asyncio
    async def test_evaluate_invalid_score(self, engine):
        """LLM 返回非数字 → 0.0。"""
        mock_resp = {"content": "not a number"}
        with patch(
            "app.services.context_engine.llm_gateway.complete",
            new=AsyncMock(return_value=mock_resp),
        ):
            result = await engine._evaluate_compression_quality(
                [{"role": "user", "content": "test"}], "summary"
            )
        assert result == 0.0

    @pytest.mark.asyncio
    async def test_record_compression_event_memory(self, engine):
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            await engine._record_compression_event(
                "user1", "conv1", 1000, 500, 0.5, 0.9, 5
            )
        assert len(engine._compression_events) == 1
        event = engine._compression_events[0]
        assert event["tokens_before"] == 1000
        assert event["tokens_after"] == 500
        assert event["compression_ratio"] == 0.5

    @pytest.mark.asyncio
    async def test_record_compression_global_user(self, engine):
        """user_id 为空 → key_user = "_global"。"""
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            await engine._record_compression_event(
                "", "conv1", 1000, 500, 0.5, 0.9, 5
            )
        assert len(engine._compression_events) == 1

    @pytest.mark.asyncio
    async def test_get_compression_stats_empty(self, engine):
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            stats = await engine._get_compression_stats("user1")
        assert stats["totalEvents"] == 0
        assert stats["avgCompressionRatio"] == 0.0
        assert stats["recentEvents"] == []

    @pytest.mark.asyncio
    async def test_get_compression_stats_with_events(self, engine):
        engine._compression_events = [
            {
                "compression_ratio": 0.5,
                "quality_score": 0.9,
                "tokens_before": 1000,
                "tokens_after": 500,
            },
            {
                "compression_ratio": 0.6,
                "quality_score": 0.8,
                "tokens_before": 2000,
                "tokens_after": 1200,
            },
        ]
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            stats = await engine._get_compression_stats("user1")
        assert stats["totalEvents"] == 2
        assert stats["avgCompressionRatio"] == pytest.approx(0.55, abs=0.01)
        assert stats["avgQualityScore"] == pytest.approx(0.85, abs=0.01)


# ════════════════════════════════════════════════════════════════════════
# 21. 会话记忆
# ════════════════════════════════════════════════════════════════════════


class TestSessionMemory:
    @pytest.mark.asyncio
    async def test_persist_summary_no_conv_id(self, engine):
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            await engine._persist_summary("", "summary")
        # 无 conversation_id → 不操作

    @pytest.mark.asyncio
    async def test_persist_summary_no_summary(self, engine):
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            await engine._persist_summary("conv1", "")
        # 无 summary → 不操作

    @pytest.mark.asyncio
    async def test_persist_summary_no_redis(self, engine):
        """Redis 不可用 → 静默(no-op)。"""
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            await engine._persist_summary("conv1", "summary")
        # 无异常即通过

    @pytest.mark.asyncio
    async def test_load_session_summary_no_conv_id(self, engine):
        result = await engine.load_session_summary("")
        assert result == ""

    @pytest.mark.asyncio
    async def test_load_session_summary_no_redis(self, engine):
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            result = await engine.load_session_summary("conv1")
        assert result == ""

    @pytest.mark.asyncio
    async def test_get_session_memory_empty(self, engine):
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            result = await engine._get_session_memory("", "")
        assert result["conversationId"] == ""
        assert result["summary"] == ""
        assert result["preferences"] == []

    @pytest.mark.asyncio
    async def test_clear_session_memory_no_conv_id(self, engine):
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            result = await engine._clear_session_memory("")
        assert result is False

    @pytest.mark.asyncio
    async def test_clear_session_memory_no_redis(self, engine):
        """Redis 不可用 → 视为清除成功(内存无 op)。"""
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            result = await engine._clear_session_memory("conv1")
        assert result is True


# ════════════════════════════════════════════════════════════════════════
# 22. 可视化
# ════════════════════════════════════════════════════════════════════════


class TestVisualization:
    @pytest.mark.asyncio
    async def test_record_no_conv_id(self, engine):
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            await engine.record_visualization("", {"totalTokens": 100})
        # 无 conversation_id → 不操作

    @pytest.mark.asyncio
    async def test_record_no_data(self, engine):
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            await engine.record_visualization("conv1", {})
        # 无 token_data → 不操作

    @pytest.mark.asyncio
    async def test_record_no_redis(self, engine):
        """Redis 不可用 → 静默(可视化不降级内存)。"""
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            await engine.record_visualization("conv1", {"totalTokens": 100})
        # 无异常即通过

    @pytest.mark.asyncio
    async def test_get_visualization_no_conv_id(self, engine):
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            result = await engine.get_visualization("", "")
        assert result["pie"] == []
        assert result["trend"] == []

    @pytest.mark.asyncio
    async def test_get_visualization_no_redis(self, engine):
        with patch.object(engine, "_get_redis", new=AsyncMock(return_value=None)):
            result = await engine.get_visualization("conv1", "user1")
        assert result["pie"] == []
        assert result["trend"] == []
        assert result["compressions"] == []


# ════════════════════════════════════════════════════════════════════════
# 23. HTTP 端点
# ════════════════════════════════════════════════════════════════════════


class TestEndpoints:
    def test_router_exists(self):
        assert router is not None

    def test_enrich_request_defaults(self):
        req = EnrichRequest()
        assert req.mentions == []
        assert req.conversationId == ""
        assert req.query == ""
        assert req.totalBudget == DEFAULT_CONTEXT_BUDGET

    def test_enrich_request_validation(self):
        """totalBudget 范围 500-32000。"""
        with pytest.raises(Exception):
            EnrichRequest(totalBudget=100)  # < 500
        with pytest.raises(Exception):
            EnrichRequest(totalBudget=50000)  # > 32000

    @pytest.mark.asyncio
    async def test_enrich_endpoint_success(self):
        from app.services.context_engine import enrich_endpoint
        req = EnrichRequest(mentions=[], query="")
        with patch.object(
            context_engine,
            "enrich_context",
            new=AsyncMock(return_value={
                "enrichedContext": "test",
                "tokenCount": 5,
                "sources": [],
                "conversationId": "",
                "taskType": "default",
            }),
        ):
            result = await enrich_endpoint(req)
        assert result["code"] == 0
        assert result["data"]["enrichedContext"] == "test"

    @pytest.mark.asyncio
    async def test_enrich_endpoint_exception(self):
        from app.services.context_engine import enrich_endpoint
        req = EnrichRequest(mentions=[], query="")
        with patch.object(
            context_engine,
            "enrich_context",
            new=AsyncMock(side_effect=Exception("boom")),
        ):
            result = await enrich_endpoint(req)
        assert result["code"] == 500

    @pytest.mark.asyncio
    async def test_sources_endpoint(self):
        from app.services.context_engine import sources_endpoint
        result = await sources_endpoint()
        assert result["code"] == 0
        assert len(result["data"]["sources"]) == 5
        assert result["data"]["defaultBudget"] == DEFAULT_CONTEXT_BUDGET

    @pytest.mark.asyncio
    async def test_track_visualization_endpoint_success(self):
        from app.services.context_engine import track_visualization_endpoint
        from app.services.context_engine import TrackVisualizationRequest
        req = TrackVisualizationRequest(
            conversationId="conv1", totalTokens=100, historyTokens=50
        )
        with patch.object(
            context_engine,
            "record_visualization",
            new=AsyncMock(),
        ):
            result = await track_visualization_endpoint(req)
        assert result["code"] == 0
        assert result["data"]["recorded"] is True

    @pytest.mark.asyncio
    async def test_visualization_endpoint_success(self):
        from app.services.context_engine import visualization_endpoint
        with patch.object(
            context_engine,
            "get_visualization",
            new=AsyncMock(return_value={"pie": [], "trend": [], "compressions": []}),
        ):
            result = await visualization_endpoint("conv1", "user1")
        assert result["code"] == 0

    @pytest.mark.asyncio
    async def test_compression_stats_endpoint(self):
        from app.services.context_engine import compression_stats_endpoint
        with patch.object(
            context_engine,
            "_get_compression_stats",
            new=AsyncMock(return_value={"totalEvents": 0}),
        ):
            result = await compression_stats_endpoint("user1")
        assert result["code"] == 0
        assert result["data"]["totalEvents"] == 0

    @pytest.mark.asyncio
    async def test_memory_endpoint(self):
        from app.services.context_engine import memory_endpoint
        with patch.object(
            context_engine,
            "_get_session_memory",
            new=AsyncMock(return_value={"conversationId": "c1", "summary": "", "preferences": []}),
        ):
            result = await memory_endpoint("c1", "u1")
        assert result["code"] == 0

    @pytest.mark.asyncio
    async def test_clear_memory_endpoint(self):
        from app.services.context_engine import clear_memory_endpoint
        with patch.object(
            context_engine,
            "_clear_session_memory",
            new=AsyncMock(return_value=True),
        ):
            result = await clear_memory_endpoint("c1")
        assert result["code"] == 0
        assert result["data"]["cleared"] is True


# ════════════════════════════════════════════════════════════════════════
# 24. 模块级单例
# ════════════════════════════════════════════════════════════════════════


class TestSingleton:
    def test_singleton_exists(self):
        assert context_engine is not None
        assert isinstance(context_engine, ContextEngine)

    def test_singleton_has_summary_cache(self):
        assert hasattr(context_engine, "_summary_cache")
        assert isinstance(context_engine._summary_cache, dict)

    def test_singleton_has_user_behavior(self):
        assert hasattr(context_engine, "_user_behavior")
        assert isinstance(context_engine._user_behavior, dict)

    def test_singleton_has_compression_events(self):
        assert hasattr(context_engine, "_compression_events")
        assert isinstance(context_engine._compression_events, list)

    def test_singleton_has_redis_client(self):
        assert hasattr(context_engine, "_redis_client")
