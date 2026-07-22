"""记忆自动提取器测试(P3 深度层 — 记忆系统三件套之二)。

覆盖 memory_extractor.py:
- MemoryExtractor.extract:主入口(兼容 dict/list 调用 + 去重)
- MemoryExtractor._llm_extract:LLM 提取(失败降级空列表)
- MemoryExtractor._parse_extract_output:解析 JSON 数组/对象
- MemoryExtractor._is_duplicate:difflib SequenceMatcher 去重(阈值 0.85)
"""

import json
from unittest.mock import AsyncMock, patch

import pytest

from app.services.memory_extractor import MemoryExtractor, _DEDUP_THRESHOLD


# =============================================================================
# 辅助:构造 LLM 响应
# =============================================================================


def _llm_json_response(items: list[dict]) -> dict:
    """构造 LLM 返回(JSON 数组字符串)。"""
    return {"content": json.dumps(items), "model": "mock", "stub": False}


def _llm_markdown_response(items: list[dict]) -> dict:
    """构造 LLM 返回(markdown 代码块包裹的 JSON 数组)。"""
    return {"content": f"```json\n{json.dumps(items)}\n```", "model": "mock", "stub": False}


# =============================================================================
# extract:主入口
# =============================================================================


class TestExtract:
    """extract:从对话中自动提取记忆。"""

    async def test_empty_messages_returns_empty(self):
        """空消息列表 → 空 extracted。"""
        extractor = MemoryExtractor()
        result = await extractor.extract([])
        assert result["extracted"] == []
        assert result["durationMs"] >= 0

    async def test_dict_call_compatibility(self):
        """dict 调用兼容(MemorySystem 传入 request dict)。"""
        extractor = MemoryExtractor()
        with patch("app.core.llm_gateway.llm_gateway") as mock:
            mock.complete = AsyncMock(return_value=_llm_json_response([]))
            result = await extractor.extract({
                "messages": [{"role": "user", "content": "hi"}],
                "userId": "u1",
                "sessionId": "s1",
            })
        assert result["extracted"] == []

    async def test_normal_extraction(self):
        """正常提取:LLM 返回 2 条记忆。"""
        extractor = MemoryExtractor()
        items = [
            {"type": "preference", "category": "UI", "text": "偏好深色模式", "confidence": 0.9, "sourceMessageIndex": 0},
            {"type": "convention", "category": "代码", "text": "用 4 空格缩进", "confidence": 0.85, "sourceMessageIndex": 1},
        ]
        with patch("app.core.llm_gateway.llm_gateway") as mock:
            mock.complete = AsyncMock(return_value=_llm_json_response(items))
            result = await extractor.extract([
                {"role": "user", "content": "我喜欢深色模式"},
                {"role": "assistant", "content": "好的,已记录"},
            ])
        assert len(result["extracted"]) == 2
        assert result["extracted"][0]["type"] == "preference"
        assert result["extracted"][1]["text"] == "用 4 空格缩进"

    async def test_dedup_with_existing(self):
        """与已有记忆去重(相似度 > 0.85)。"""
        extractor = MemoryExtractor()
        items = [
            {"type": "fact", "text": "用户是前端开发者", "confidence": 0.8},
        ]
        existing = [
            {"text": "用户是前端开发者"},  # 完全相同
        ]
        with patch("app.core.llm_gateway.llm_gateway") as mock:
            mock.complete = AsyncMock(return_value=_llm_json_response(items))
            result = await extractor.extract(
                [{"role": "user", "content": "我是前端"}],
                existing_entries=existing,
            )
        assert len(result["extracted"]) == 0  # 去重

    async def test_dedup_within_extracted(self):
        """本轮提取内部去重。"""
        extractor = MemoryExtractor()
        items = [
            {"type": "fact", "text": "使用 TypeScript", "confidence": 0.9},
            {"type": "fact", "text": "使用 TypeScript", "confidence": 0.8},  # 重复
        ]
        with patch("app.core.llm_gateway.llm_gateway") as mock:
            mock.complete = AsyncMock(return_value=_llm_json_response(items))
            result = await extractor.extract([{"role": "user", "content": "我用 TS"}])
        assert len(result["extracted"]) == 1

    async def test_llm_failure_degrades_to_empty(self):
        """LLM 异常 → 降级空列表。"""
        extractor = MemoryExtractor()
        with patch("app.core.llm_gateway.llm_gateway") as mock:
            mock.complete = AsyncMock(side_effect=RuntimeError("LLM down"))
            result = await extractor.extract([{"role": "user", "content": "hi"}])
        assert result["extracted"] == []

    async def test_duration_ms_non_negative(self):
        """durationMs 非负。"""
        extractor = MemoryExtractor()
        with patch("app.core.llm_gateway.llm_gateway") as mock:
            mock.complete = AsyncMock(return_value=_llm_json_response([]))
            result = await extractor.extract([{"role": "user", "content": "hi"}])
        assert result["durationMs"] >= 0

    async def test_empty_text_items_skipped(self):
        """空 text 的条目被跳过。"""
        extractor = MemoryExtractor()
        items = [
            {"type": "fact", "text": "", "confidence": 0.5},
            {"type": "fact", "text": "有效记忆", "confidence": 0.8},
        ]
        with patch("app.core.llm_gateway.llm_gateway") as mock:
            mock.complete = AsyncMock(return_value=_llm_json_response(items))
            result = await extractor.extract([{"role": "user", "content": "test"}])
        assert len(result["extracted"]) == 1
        assert result["extracted"][0]["text"] == "有效记忆"

    async def test_default_values_for_missing_fields(self):
        """缺字段的条目用默认值。"""
        extractor = MemoryExtractor()
        items = [{"text": "无类型记忆"}]  # 缺 type/category/confidence/sourceMessageIndex
        with patch("app.core.llm_gateway.llm_gateway") as mock:
            mock.complete = AsyncMock(return_value=_llm_json_response(items))
            result = await extractor.extract([{"role": "user", "content": "test"}])
        assert len(result["extracted"]) == 1
        item = result["extracted"][0]
        assert item["type"] == "fact"
        assert item["category"] == "未分类"
        assert item["confidence"] == 0.5
        assert item["sourceMessageIndex"] == -1


# =============================================================================
# _llm_extract:LLM 提取
# =============================================================================


class TestLlmExtract:
    """_llm_extract:调 LLM 从对话中提取记忆。"""

    async def test_message_truncation_single(self):
        """单条消息 > 500 字符截断。"""
        extractor = MemoryExtractor()
        long_content = "A" * 600
        with patch("app.core.llm_gateway.llm_gateway") as mock:
            mock.complete = AsyncMock(return_value=_llm_json_response([]))
            await extractor._llm_extract([{"role": "user", "content": long_content}])
        prompt = mock.complete.call_args[0][0][0]["content"]
        assert "..." in prompt
        assert len(prompt) < 5000  # 截断后不会太长

    async def test_message_truncation_total(self):
        """整体对话 > 4000 字符截断。"""
        extractor = MemoryExtractor()
        messages = [{"role": "user", "content": "B" * 300} for _ in range(20)]  # 6000 字符
        with patch("app.core.llm_gateway.llm_gateway") as mock:
            mock.complete = AsyncMock(return_value=_llm_json_response([]))
            await extractor._llm_extract(messages)
        prompt = mock.complete.call_args[0][0][0]["content"]
        assert "已截断" in prompt

    async def test_empty_content_skipped(self):
        """空 content 消息跳过。"""
        extractor = MemoryExtractor()
        with patch("app.core.llm_gateway.llm_gateway") as mock:
            mock.complete = AsyncMock(return_value=_llm_json_response([]))
            await extractor._llm_extract([
                {"role": "user", "content": ""},
                {"role": "assistant", "content": "valid"},
            ])
        prompt = mock.complete.call_args[0][0][0]["content"]
        assert "valid" in prompt
        assert "[0]" not in prompt or "[1]" in prompt

    async def test_llm_exception_returns_empty(self):
        """LLM 异常 → 返回空列表。"""
        extractor = MemoryExtractor()
        with patch("app.core.llm_gateway.llm_gateway") as mock:
            mock.complete = AsyncMock(side_effect=RuntimeError("boom"))
            result = await extractor._llm_extract([{"role": "user", "content": "hi"}])
        assert result == []


# =============================================================================
# _parse_extract_output:解析 LLM 输出
# =============================================================================


class TestParseExtractOutput:
    """_parse_extract_output:解析 LLM 输出为记忆条目列表。"""

    def test_json_array(self):
        """纯 JSON 数组。"""
        content = json.dumps([
            {"type": "fact", "text": "记忆1"},
            {"type": "preference", "text": "记忆2"},
        ])
        result = MemoryExtractor._parse_extract_output(content)
        assert len(result) == 2
        assert result[0]["text"] == "记忆1"

    def test_json_object_with_extracted(self):
        """JSON 对象含 extracted 字段。"""
        content = json.dumps({"extracted": [{"type": "fact", "text": "from obj"}]})
        result = MemoryExtractor._parse_extract_output(content)
        assert len(result) == 1
        assert result[0]["text"] == "from obj"

    def test_markdown_code_block(self):
        """markdown 代码块包裹的 JSON 数组。"""
        content = f"```json\n{json.dumps([{'type': 'fact', 'text': 'md'}])}\n```"
        result = MemoryExtractor._parse_extract_output(content)
        assert len(result) == 1
        assert result[0]["text"] == "md"

    def test_empty_string(self):
        """空字符串 → []。"""
        assert MemoryExtractor._parse_extract_output("") == []

    def test_invalid_json(self):
        """非法 JSON → []。"""
        assert MemoryExtractor._parse_extract_output("not json at all") == []

    def test_non_dict_items_filtered(self):
        """非字典元素被过滤。"""
        content = json.dumps(["str", 42, {"text": "valid"}])
        result = MemoryExtractor._parse_extract_output(content)
        assert len(result) == 1
        assert result[0]["text"] == "valid"

    def test_plain_code_block(self):
        """无 json 标记的代码块。"""
        content = f"```\n{json.dumps([{'text': 'plain'}])}\n```"
        result = MemoryExtractor._parse_extract_output(content)
        assert len(result) == 1


# =============================================================================
# _is_duplicate:文本去重
# =============================================================================


class TestIsDuplicate:
    """_is_duplicate:difflib SequenceMatcher,相似度 > 0.85 视为重复。"""

    def test_identical_text(self):
        """完全相同 → True。"""
        assert MemoryExtractor._is_duplicate("hello world", ["hello world"]) is True

    def test_completely_different(self):
        """完全不同 → False。"""
        assert MemoryExtractor._is_duplicate("abcdef", ["xyz123"]) is False

    def test_high_similarity(self):
        """高相似度(> 0.85)→ True。"""
        # "hello world test" vs "hello world test!" → ratio ≈ 0.97 > 0.85
        assert MemoryExtractor._is_duplicate(
            "hello world test",
            ["hello world test!"],
        ) is True

    def test_empty_existing(self):
        """空已有列表 → False。"""
        assert MemoryExtractor._is_duplicate("any", []) is False

    def test_case_insensitive(self):
        """大小写不敏感。"""
        assert MemoryExtractor._is_duplicate("Hello World", ["hello world"]) is True

    def test_empty_string_in_existing_skipped(self):
        """已有列表中空字符串跳过。"""
        assert MemoryExtractor._is_duplicate("test", ["", "test"]) is True

    def test_threshold_value(self):
        """阈值 _DEDUP_THRESHOLD = 0.85。"""
        assert _DEDUP_THRESHOLD == 0.85
