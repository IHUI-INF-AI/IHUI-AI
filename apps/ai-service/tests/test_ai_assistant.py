"""ai_assistant.py 单元测试:基于 LLM 的 AI 辅助写作服务。

测试覆盖:
- _platform_hint:已知平台 / 未知平台
- _truncate:短文本不截断 / 长文本截断 + 加尾注
- SeoReport:合法构造 / 越界 score 抛 ValidationError
- AiWritingService._complete:成功返回内容 / LLM 异常返回空串
- AiWritingService._astream:成功 yield chunk / 异常静默结束 / 非 chunk 事件过滤
- generate_titles:空内容 / LLM 成功(解析多行)/ LLM 失败返回空 / count 截断 / 编号去除
- polish_content:空内容 / 成功 / 失败 / 未知 style 走默认
- recommend_tags:空内容 / 成功(逗号分隔)/ 中文逗号 / 失败 / count 截断
- generate_summary:空内容 / 成功 / 失败
- analyze_seo:空内容 / 合法 JSON / ```json 包裹 / 非法 JSON / 字段类型异常
- suggest_cover:空内容 / 成功 / 失败 / 仅取前 3 行
- analyze_all:正常路径(5 个并发调用)
- asyncio_gather:辅助函数
- ai_writing_service 单例
"""

from __future__ import annotations

from typing import Any, AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

from app.services.publish import ai_assistant
from app.services.publish.ai_assistant import (
    AiWritingService,
    SeoReport,
    _platform_hint,
    _truncate,
    ai_writing_service,
    asyncio_gather,
)


# =============================================================================
# 1. _platform_hint
# =============================================================================


class TestPlatformHint:
    """_platform_hint 平台风格提示。"""

    def test_known_platform_returns_specific_hint(self) -> None:
        """已知平台返回对应风格提示。"""
        assert "微信公众号" in _platform_hint("wechat")
        assert "知乎" in _platform_hint("zhihu")
        assert "小红书" in _platform_hint("xiaohongshu")
        assert "CSDN" in _platform_hint("csdn")

    def test_unknown_platform_returns_generic_hint(self) -> None:
        """未知平台返回通用提示。"""
        result = _platform_hint("nonexistent")
        assert "通用平台" in result

    def test_empty_string_returns_generic_hint(self) -> None:
        """空串返回通用提示。"""
        result = _platform_hint("")
        assert "通用平台" in result


# =============================================================================
# 2. _truncate
# =============================================================================


class TestTruncate:
    """_truncate 内容截断。"""

    def test_short_content_not_truncated(self) -> None:
        """短内容不截断。"""
        text = "短文本"
        assert _truncate(text) == text

    def test_exact_max_chars_not_truncated(self) -> None:
        """恰好 max_chars 长度不截断。"""
        text = "a" * 100
        assert _truncate(text, max_chars=100) == text

    def test_long_content_truncated_with_suffix(self) -> None:
        """超长内容截断并加尾注。"""
        text = "x" * 5000
        result = _truncate(text, max_chars=1000)
        assert len(result) < len(text)
        assert "内容已截断" in result
        assert result.startswith("x")

    def test_custom_max_chars(self) -> None:
        """自定义 max_chars 生效。"""
        text = "abcdefghij"
        result = _truncate(text, max_chars=5)
        assert result.startswith("abcde")
        assert "内容已截断" in result


# =============================================================================
# 3. SeoReport
# =============================================================================


class TestSeoReport:
    """SeoReport pydantic 模型。"""

    def test_valid_construction(self) -> None:
        """合法构造。"""
        r = SeoReport(
            score=80,
            title_score=85,
            content_score=75,
            keyword_density={"AI": 0.05},
            suggestions=["增加关键词", "优化标题"],
        )
        assert r.score == 80
        assert r.title_score == 85
        assert r.content_score == 75
        assert r.keyword_density == {"AI": 0.05}
        assert r.suggestions == ["增加关键词", "优化标题"]

    def test_default_empty_collections(self) -> None:
        """默认 keyword_density / suggestions 为空。"""
        r = SeoReport(score=50, title_score=50, content_score=50)
        assert r.keyword_density == {}
        assert r.suggestions == []

    def test_score_above_100_raises(self) -> None:
        """score > 100 抛 ValidationError。"""
        with pytest.raises(ValidationError):
            SeoReport(score=101, title_score=50, content_score=50)

    def test_score_below_0_raises(self) -> None:
        """score < 0 抛 ValidationError。"""
        with pytest.raises(ValidationError):
            SeoReport(score=-1, title_score=50, content_score=50)


# =============================================================================
# 4. AiWritingService._complete
# =============================================================================


class TestComplete:
    """AiWritingService._complete 非流式 LLM 调用。"""

    @pytest.mark.asyncio
    async def test_success_returns_content(self) -> None:
        """成功调用返回 stripped 内容。"""
        svc = AiWritingService()
        with patch.object(
            ai_assistant, "llm_gateway",
        ) as mock_gw:
            mock_gw.complete = AsyncMock(return_value={"content": "  hello world  "})
            result = await svc._complete("prompt")
            assert result == "hello world"

    @pytest.mark.asyncio
    async def test_returns_empty_string_on_exception(self) -> None:
        """LLM 异常时返回空串。"""
        svc = AiWritingService()
        with patch.object(ai_assistant, "llm_gateway") as mock_gw:
            mock_gw.complete = AsyncMock(side_effect=RuntimeError("LLM down"))
            result = await svc._complete("prompt")
            assert result == ""

    @pytest.mark.asyncio
    async def test_non_dict_result_returns_empty(self) -> None:
        """result 非 dict 时返回空串。"""
        svc = AiWritingService()
        with patch.object(ai_assistant, "llm_gateway") as mock_gw:
            mock_gw.complete = AsyncMock(return_value="not a dict")
            result = await svc._complete("prompt")
            assert result == ""

    @pytest.mark.asyncio
    async def test_system_prompt_added_to_messages(self) -> None:
        """system 非空时添加 system message。"""
        svc = AiWritingService()
        captured: list[dict[str, str]] = []

        async def fake_complete(messages: list[dict[str, str]], model: str) -> dict[str, str]:
            captured.extend(messages)
            return {"content": "ok"}

        with patch.object(ai_assistant, "llm_gateway") as mock_gw:
            mock_gw.complete = fake_complete
            await svc._complete("user input", system="be helpful")
            assert len(captured) == 2
            assert captured[0] == {"role": "system", "content": "be helpful"}
            assert captured[1] == {"role": "user", "content": "user input"}

    @pytest.mark.asyncio
    async def test_no_system_prompt_single_message(self) -> None:
        """system=None 时只有 user message。"""
        svc = AiWritingService()
        captured: list[dict[str, str]] = []

        async def fake_complete(messages: list[dict[str, str]], model: str) -> dict[str, str]:
            captured.extend(messages)
            return {"content": "ok"}

        with patch.object(ai_assistant, "llm_gateway") as mock_gw:
            mock_gw.complete = fake_complete
            await svc._complete("user input")
            assert len(captured) == 1
            assert captured[0] == {"role": "user", "content": "user input"}


# =============================================================================
# 5. AiWritingService._astream
# =============================================================================


class TestAstream:
    """AiWritingService._astream 流式 LLM 调用。"""

    @pytest.mark.asyncio
    async def test_yields_chunks(self) -> None:
        """成功 yield 字符串 chunk。"""
        svc = AiWritingService()

        async def fake_astream(messages: list[dict[str, str]], model: str) -> AsyncIterator[dict[str, Any]]:
            yield {"type": "chunk", "content": "hello "}
            yield {"type": "chunk", "content": "world"}

        with patch.object(ai_assistant, "llm_gateway") as mock_gw:
            mock_gw.astream = fake_astream
            chunks = [c async for c in svc._astream("prompt")]
            assert chunks == ["hello ", "world"]

    @pytest.mark.asyncio
    async def test_filters_non_chunk_events(self) -> None:
        """非 chunk 事件应被过滤。"""
        svc = AiWritingService()

        async def fake_astream(messages: list[dict[str, str]], model: str) -> AsyncIterator[dict[str, Any]]:
            yield {"type": "start"}
            yield {"type": "chunk", "content": "data"}
            yield {"type": "done"}

        with patch.object(ai_assistant, "llm_gateway") as mock_gw:
            mock_gw.astream = fake_astream
            chunks = [c async for c in svc._astream("prompt")]
            assert chunks == ["data"]

    @pytest.mark.asyncio
    async def test_empty_string_chunk_skipped(self) -> None:
        """空字符串 chunk 应被跳过。"""
        svc = AiWritingService()

        async def fake_astream(messages: list[dict[str, str]], model: str) -> AsyncIterator[dict[str, Any]]:
            yield {"type": "chunk", "content": ""}
            yield {"type": "chunk", "content": "real"}

        with patch.object(ai_assistant, "llm_gateway") as mock_gw:
            mock_gw.astream = fake_astream
            chunks = [c async for c in svc._astream("prompt")]
            assert chunks == ["real"]

    @pytest.mark.asyncio
    async def test_exception_silently_ends(self) -> None:
        """astream 抛异常时静默结束(不抛)。"""
        svc = AiWritingService()

        async def fake_astream(messages: list[dict[str, str]], model: str) -> AsyncIterator[dict[str, Any]]:
            raise RuntimeError("stream failed")
            yield {"type": "chunk", "content": "never"}  # noqa: unreachable

        with patch.object(ai_assistant, "llm_gateway") as mock_gw:
            mock_gw.astream = fake_astream
            chunks = [c async for c in svc._astream("prompt")]
            assert chunks == []


# =============================================================================
# 6. generate_titles
# =============================================================================


class TestGenerateTitles:
    """generate_titles 标题生成。"""

    @pytest.mark.asyncio
    async def test_empty_content_returns_empty_list(self) -> None:
        """空内容返回空列表。"""
        svc = AiWritingService()
        assert await svc.generate_titles("") == []
        assert await svc.generate_titles("   ") == []

    @pytest.mark.asyncio
    async def test_success_parses_lines(self) -> None:
        """LLM 成功 → 解析多行为标题列表。"""
        svc = AiWritingService()
        with patch.object(svc, "_complete", AsyncMock(return_value="标题1\n标题2\n标题3")):
            result = await svc.generate_titles("正文内容")
            assert result == ["标题1", "标题2", "标题3"]

    @pytest.mark.asyncio
    async def test_strips_numbering_prefix(self) -> None:
        """去除编号前缀(1. / 1、 / 1)等。"""
        svc = AiWritingService()
        with patch.object(
            svc, "_complete",
            AsyncMock(return_value="1. 标题一\n2、标题二\n3) 标题三\n4 标题四"),
        ):
            result = await svc.generate_titles("x")
            assert result == ["标题一", "标题二", "标题三", "标题四"]

    @pytest.mark.asyncio
    async def test_count_limit(self) -> None:
        """count 参数限制返回数量。"""
        svc = AiWritingService()
        with patch.object(
            svc, "_complete",
            AsyncMock(return_value="t1\nt2\nt3\nt4\nt5"),
        ):
            result = await svc.generate_titles("x", count=3)
            assert len(result) == 3
            assert result == ["t1", "t2", "t3"]

    @pytest.mark.asyncio
    async def test_llm_failure_returns_empty(self) -> None:
        """LLM 返回空串 → 返回空列表。"""
        svc = AiWritingService()
        with patch.object(svc, "_complete", AsyncMock(return_value="")):
            assert await svc.generate_titles("x") == []

    @pytest.mark.asyncio
    async def test_filters_empty_lines(self) -> None:
        """空行应被过滤。"""
        svc = AiWritingService()
        with patch.object(
            svc, "_complete",
            AsyncMock(return_value="t1\n\n  \nt2"),
        ):
            result = await svc.generate_titles("x")
            assert result == ["t1", "t2"]


# =============================================================================
# 7. polish_content
# =============================================================================


class TestPolishContent:
    """polish_content 正文润色。"""

    @pytest.mark.asyncio
    async def test_empty_content_returns_empty(self) -> None:
        """空内容返回空串。"""
        svc = AiWritingService()
        assert await svc.polish_content("") == ""
        assert await svc.polish_content("   ") == ""

    @pytest.mark.asyncio
    async def test_success_returns_polished(self) -> None:
        """成功润色返回结果。"""
        svc = AiWritingService()
        with patch.object(svc, "_complete", AsyncMock(return_value="润色后的内容")):
            assert await svc.polish_content("原文") == "润色后的内容"

    @pytest.mark.asyncio
    async def test_default_style_used_for_unknown(self) -> None:
        """未知 style 走默认(专业)。"""
        svc = AiWritingService()
        captured: list[str] = []

        async def fake_complete(prompt: str, system: Any = None) -> str:
            captured.append(prompt)
            return "ok"

        with patch.object(svc, "_complete", side_effect=fake_complete):
            await svc.polish_content("x", style="unknown_style")
            assert any("专业" in p for p in captured)

    @pytest.mark.asyncio
    async def test_technical_style_passed(self) -> None:
        """technical style 应在 prompt 中体现。"""
        svc = AiWritingService()
        captured: list[str] = []

        async def fake_complete(prompt: str, system: Any = None) -> str:
            captured.append(prompt)
            return "ok"

        with patch.object(svc, "_complete", side_effect=fake_complete):
            await svc.polish_content("x", style="technical")
            assert any("技术、严谨" in p for p in captured)


# =============================================================================
# 8. recommend_tags
# =============================================================================


class TestRecommendTags:
    """recommend_tags 标签推荐。"""

    @pytest.mark.asyncio
    async def test_empty_content_returns_empty(self) -> None:
        """空内容返回空列表。"""
        svc = AiWritingService()
        assert await svc.recommend_tags("") == []

    @pytest.mark.asyncio
    async def test_success_parses_comma_separated(self) -> None:
        """LLM 成功 → 解析逗号分隔为列表。"""
        svc = AiWritingService()
        with patch.object(svc, "_complete", AsyncMock(return_value="AI,机器学习,深度学习")):
            result = await svc.recommend_tags("正文")
            assert result == ["AI", "机器学习", "深度学习"]

    @pytest.mark.asyncio
    async def test_chinese_comma_supported(self) -> None:
        """中文逗号也能解析。"""
        svc = AiWritingService()
        with patch.object(svc, "_complete", AsyncMock(return_value="AI，机器学习，深度学习")):
            result = await svc.recommend_tags("正文")
            assert result == ["AI", "机器学习", "深度学习"]

    @pytest.mark.asyncio
    async def test_strips_hash_prefix(self) -> None:
        """去除标签前的 #。"""
        svc = AiWritingService()
        with patch.object(svc, "_complete", AsyncMock(return_value="#AI,#机器学习")):
            result = await svc.recommend_tags("正文")
            assert result == ["AI", "机器学习"]

    @pytest.mark.asyncio
    async def test_count_limit(self) -> None:
        """count 参数限制数量。"""
        svc = AiWritingService()
        with patch.object(svc, "_complete", AsyncMock(return_value="a,b,c,d,e")):
            result = await svc.recommend_tags("x", count=3)
            assert len(result) == 3

    @pytest.mark.asyncio
    async def test_llm_failure_returns_empty(self) -> None:
        """LLM 失败 → 空列表。"""
        svc = AiWritingService()
        with patch.object(svc, "_complete", AsyncMock(return_value="")):
            assert await svc.recommend_tags("x") == []


# =============================================================================
# 9. generate_summary
# =============================================================================


class TestGenerateSummary:
    """generate_summary 摘要生成。"""

    @pytest.mark.asyncio
    async def test_empty_content_returns_empty(self) -> None:
        """空内容返回空串。"""
        svc = AiWritingService()
        assert await svc.generate_summary("") == ""

    @pytest.mark.asyncio
    async def test_success_returns_summary(self) -> None:
        """成功返回摘要。"""
        svc = AiWritingService()
        with patch.object(svc, "_complete", AsyncMock(return_value="这是摘要")):
            assert await svc.generate_summary("正文") == "这是摘要"

    @pytest.mark.asyncio
    async def test_max_length_in_prompt(self) -> None:
        """max_length 应出现在 prompt 中。"""
        svc = AiWritingService()
        captured: list[str] = []

        async def fake_complete(prompt: str, system: Any = None) -> str:
            captured.append(prompt)
            return "ok"

        with patch.object(svc, "_complete", side_effect=fake_complete):
            await svc.generate_summary("x", max_length=200)
            assert any("200" in p for p in captured)


# =============================================================================
# 10. analyze_seo
# =============================================================================


class TestAnalyzeSeo:
    """analyze_seo SEO 分析。"""

    @pytest.mark.asyncio
    async def test_empty_content_returns_none(self) -> None:
        """空内容返回 None。"""
        svc = AiWritingService()
        assert await svc.analyze_seo("title", "") is None

    @pytest.mark.asyncio
    async def test_valid_json_returns_report(self) -> None:
        """合法 JSON → SeoReport。"""
        svc = AiWritingService()
        json_resp = (
            '{"score":80,"title_score":85,"content_score":75,'
            '"keyword_density":{"AI":0.05},"suggestions":["优化标题"]}'
        )
        with patch.object(svc, "_complete", AsyncMock(return_value=json_resp)):
            result = await svc.analyze_seo("标题", "正文")
            assert result is not None
            assert result.score == 80
            assert result.title_score == 85
            assert result.content_score == 75
            assert result.keyword_density == {"AI": 0.05}
            assert result.suggestions == ["优化标题"]

    @pytest.mark.asyncio
    async def test_json_wrapped_in_code_block(self) -> None:
        """```json 包裹的 JSON 也能解析。"""
        svc = AiWritingService()
        json_resp = (
            '```json\n{"score":90,"title_score":90,"content_score":90,'
            '"keyword_density":{},"suggestions":[]}\n```'
        )
        with patch.object(svc, "_complete", AsyncMock(return_value=json_resp)):
            result = await svc.analyze_seo("t", "content")
            assert result is not None
            assert result.score == 90

    @pytest.mark.asyncio
    async def test_invalid_json_returns_none(self) -> None:
        """非法 JSON → None。"""
        svc = AiWritingService()
        with patch.object(svc, "_complete", AsyncMock(return_value="not json at all")):
            assert await svc.analyze_seo("t", "c") is None

    @pytest.mark.asyncio
    async def test_llm_failure_returns_none(self) -> None:
        """LLM 返回空 → None。"""
        svc = AiWritingService()
        with patch.object(svc, "_complete", AsyncMock(return_value="")):
            assert await svc.analyze_seo("t", "c") is None

    @pytest.mark.asyncio
    async def test_invalid_field_types_filtered(self) -> None:
        """keyword_density 非数字值应被过滤;suggestions 非字符串应被过滤。"""
        svc = AiWritingService()
        json_resp = (
            '{"score":50,"title_score":50,"content_score":50,'
            '"keyword_density":{"valid":0.1,"invalid":"not a number"},'
            '"suggestions":["valid", 123]}'
        )
        with patch.object(svc, "_complete", AsyncMock(return_value=json_resp)):
            result = await svc.analyze_seo("t", "c")
            assert result is not None
            assert result.keyword_density == {"valid": 0.1}
            assert result.suggestions == ["valid"]

    @pytest.mark.asyncio
    async def test_score_out_of_range_returns_none(self) -> None:
        """score 越界(>100)导致 SeoReport 构造失败 → None。"""
        svc = AiWritingService()
        json_resp = (
            '{"score":150,"title_score":50,"content_score":50,'
            '"keyword_density":{},"suggestions":[]}'
        )
        with patch.object(svc, "_complete", AsyncMock(return_value=json_resp)):
            assert await svc.analyze_seo("t", "c") is None


# =============================================================================
# 11. suggest_cover
# =============================================================================


class TestSuggestCover:
    """suggest_cover 封面建议。"""

    @pytest.mark.asyncio
    async def test_empty_content_returns_empty(self) -> None:
        """空内容返回空列表。"""
        svc = AiWritingService()
        assert await svc.suggest_cover("") == []

    @pytest.mark.asyncio
    async def test_success_returns_lines(self) -> None:
        """成功返回行列表。"""
        svc = AiWritingService()
        with patch.object(
            svc, "_complete",
            AsyncMock(return_value="方案1:蓝色科技风\n方案2:暖色温馨\n方案3:极简白"),
        ):
            result = await svc.suggest_cover("正文")
            assert len(result) == 3
            assert "方案1:蓝色科技风" in result

    @pytest.mark.asyncio
    async def test_only_returns_first_three(self) -> None:
        """超过 3 行只取前 3。"""
        svc = AiWritingService()
        with patch.object(
            svc, "_complete",
            AsyncMock(return_value="a\nb\nc\nd\ne"),
        ):
            result = await svc.suggest_cover("x")
            assert len(result) == 3
            assert result == ["a", "b", "c"]

    @pytest.mark.asyncio
    async def test_filters_empty_lines(self) -> None:
        """空行应被过滤。"""
        svc = AiWritingService()
        with patch.object(
            svc, "_complete",
            AsyncMock(return_value="real\n\n  \nreal2"),
        ):
            result = await svc.suggest_cover("x")
            assert result == ["real", "real2"]

    @pytest.mark.asyncio
    async def test_llm_failure_returns_empty(self) -> None:
        """LLM 失败 → 空列表。"""
        svc = AiWritingService()
        with patch.object(svc, "_complete", AsyncMock(return_value="")):
            assert await svc.suggest_cover("x") == []


# =============================================================================
# 12. analyze_all
# =============================================================================


class TestAnalyzeAll:
    """analyze_all 批量分析。"""

    @pytest.mark.asyncio
    async def test_returns_all_fields(self) -> None:
        """返回 titles/tags/summary/seo/covers 5 个字段。"""
        svc = AiWritingService()
        with patch.object(svc, "generate_titles", AsyncMock(return_value=["t1"])), \
             patch.object(svc, "recommend_tags", AsyncMock(return_value=["tag1"])), \
             patch.object(svc, "generate_summary", AsyncMock(return_value="sum")), \
             patch.object(svc, "analyze_seo", AsyncMock(return_value=SeoReport(
                 score=80, title_score=80, content_score=80,
             ))), \
             patch.object(svc, "suggest_cover", AsyncMock(return_value=["cover1"])):
            result = await svc.analyze_all("content", "title", "wechat")
            assert result["titles"] == ["t1"]
            assert result["tags"] == ["tag1"]
            assert result["summary"] == "sum"
            assert result["seo"] is not None
            assert result["seo"]["score"] == 80
            assert result["covers"] == ["cover1"]

    @pytest.mark.asyncio
    async def test_seo_none_when_analyze_fails(self) -> None:
        """analyze_seo 返回 None → result["seo"] = None。"""
        svc = AiWritingService()
        with patch.object(svc, "generate_titles", AsyncMock(return_value=[])), \
             patch.object(svc, "recommend_tags", AsyncMock(return_value=[])), \
             patch.object(svc, "generate_summary", AsyncMock(return_value="")), \
             patch.object(svc, "analyze_seo", AsyncMock(return_value=None)), \
             patch.object(svc, "suggest_cover", AsyncMock(return_value=[])):
            result = await svc.analyze_all("c", "t")
            assert result["seo"] is None


# =============================================================================
# 13. asyncio_gather
# =============================================================================


class TestAsyncioGather:
    """asyncio_gather 辅助函数。"""

    @pytest.mark.asyncio
    async def test_gathers_multiple_coroutines(self) -> None:
        """并发执行多个协程并返回结果列表。"""

        async def coro1() -> int:
            return 1

        async def coro2() -> int:
            return 2

        async def coro3() -> int:
            return 3

        result = await asyncio_gather(coro1(), coro2(), coro3())
        assert result == [1, 2, 3]

    @pytest.mark.asyncio
    async def test_empty_call_returns_empty_list(self) -> None:
        """无参数时返回空列表。"""
        result = await asyncio_gather()
        assert result == []


# =============================================================================
# 14. ai_writing_service 单例
# =============================================================================


class TestSingleton:
    """模块级单例 ai_writing_service。"""

    def test_singleton_exists(self) -> None:
        """ai_writing_service 应为 AiWritingService 实例。"""
        assert isinstance(ai_writing_service, AiWritingService)

    def test_singleton_is_module_level(self) -> None:
        """多次 import 应返回同一对象。"""
        from app.services.publish.ai_assistant import ai_writing_service as svc2
        assert ai_writing_service is svc2
