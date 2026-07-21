"""question_parser 单元测试。

覆盖:
- 完整标记解析(单标记 / 多标记 / 嵌入文本中)
- 跨 chunk 分片(标记被切到多个 chunk)
- 不完整标记 flush 残留处理
- 非法 JSON / 缺字段 → None(不阻塞流)
- 选项 / 自定义输入 / 多选字段映射
"""

from __future__ import annotations

import pytest

from app.core.question_parser import (
    Question,
    QuestionStreamParser,
    parse_question_json,
)


class TestParseQuestionJson:
    """parse_question_json 函数测试。"""

    def test_minimal_valid(self):
        """最小合法 JSON(只有 prompt)。"""
        q = parse_question_json('{"prompt":"你好是什么?"}')
        assert q is not None
        assert q.prompt == "你好是什么?"
        assert q.options == []
        assert q.allow_custom is True
        assert q.allow_multiple is False

    def test_with_options(self):
        """含选项列表。"""
        raw = '{"prompt":"选择语言","options":[{"id":"py","label":"Python"},{"id":"ts","label":"TypeScript"}]}'
        q = parse_question_json(raw)
        assert q is not None
        assert len(q.options) == 2
        assert q.options[0].id == "py"
        assert q.options[1].label == "TypeScript"

    def test_allow_custom_false(self):
        """allowCustom: false 显式禁用自由输入。"""
        q = parse_question_json('{"prompt":"x","allowCustom":false}')
        assert q is not None
        assert q.allow_custom is False

    def test_allow_multiple_true(self):
        """allowMultiple: true 启用多选。"""
        q = parse_question_json('{"prompt":"x","allowMultiple":true}')
        assert q is not None
        assert q.allow_multiple is True

    def test_invalid_json_returns_none(self):
        """非法 JSON 返回 None(不抛异常)。"""
        assert parse_question_json("not-json") is None
        assert parse_question_json("{broken") is None

    def test_missing_prompt_returns_none(self):
        """缺 prompt 字段返回 None。"""
        assert parse_question_json('{"options":[]}') is None
        assert parse_question_json('{"prompt":""}') is None
        assert parse_question_json('{"prompt":"   "}') is None

    def test_non_dict_returns_none(self):
        """非对象 JSON 返回 None。"""
        assert parse_question_json("[1,2,3]") is None
        assert parse_question_json('"string"') is None
        assert parse_question_json("123") is None

    def test_options_with_invalid_entries_filtered(self):
        """options 中非法条目被过滤,合法条目保留。"""
        raw = '{"prompt":"x","options":[{"id":"a","label":"A"},"bad",{"id":"b","label":"B"},{"id":1,"label":"no-id"}]}'
        q = parse_question_json(raw)
        assert q is not None
        assert len(q.options) == 2
        assert q.options[0].id == "a"
        assert q.options[1].id == "b"

    def test_to_dict_field_mapping(self):
        """Question.to_dict() 字段映射(SSE 推送格式)。"""
        q = parse_question_json('{"prompt":"测试","options":[{"id":"a","label":"A"}],"allowCustom":false,"allowMultiple":true}')
        assert q is not None
        d = q.to_dict()
        assert d["prompt"] == "测试"
        assert d["options"] == [{"id": "a", "label": "A"}]
        assert d["allowCustom"] is False
        assert d["allowMultiple"] is True
        assert "questionId" in d
        assert len(d["questionId"]) > 0


class TestQuestionStreamParserSingleChunk:
    """单 chunk 解析(无分片)。"""

    def test_no_marker_passthrough(self):
        """无标记的文本原样输出。"""
        parser = QuestionStreamParser()
        text, qs = parser.feed("Hello world")
        assert text == "Hello world"
        assert qs == []

    def test_marker_only(self):
        """仅一个标记,无周围文本。"""
        parser = QuestionStreamParser()
        text, qs = parser.feed('[[ASK_USER:{"prompt":"确认吗?"}]]')
        assert text == ""
        assert len(qs) == 1
        assert qs[0].prompt == "确认吗?"

    def test_marker_embedded_in_text(self):
        """标记嵌入在文本中,前后文本都保留。"""
        parser = QuestionStreamParser()
        chunk = '正在处理...[[ASK_USER:{"prompt":"选择风格","options":[{"id":"a","label":"A"}]}]]...继续'
        text, qs = parser.feed(chunk)
        assert text == "正在处理......继续"
        assert len(qs) == 1
        assert qs[0].prompt == "选择风格"
        assert len(qs[0].options) == 1

    def test_multiple_markers_in_one_chunk(self):
        """单 chunk 内多个标记。"""
        parser = QuestionStreamParser()
        chunk = '[[ASK_USER:{"prompt":"Q1"}]]middle[[ASK_USER:{"prompt":"Q2"}]]'
        text, qs = parser.feed(chunk)
        assert text == "middle"
        assert len(qs) == 2
        assert qs[0].prompt == "Q1"
        assert qs[1].prompt == "Q2"

    def test_invalid_marker_json_skipped(self):
        """标记内 JSON 非法 → 标记被丢弃,不阻塞流。"""
        parser = QuestionStreamParser()
        chunk = "before[[ASK_USER:not-json]]after"
        text, qs = parser.feed(chunk)
        assert text == "beforeafter"
        assert qs == []


class TestQuestionStreamParserCrossChunk:
    """跨 chunk 分片解析。"""

    def test_marker_split_across_chunks(self):
        """标记被切到 2 个 chunk。"""
        parser = QuestionStreamParser()
        text1, qs1 = parser.feed("正在处理[[ASK_USER:{")
        assert text1 == "正在处理"
        assert qs1 == []

        text2, qs2 = parser.feed('"prompt":"Q1"}]]done')
        assert text2 == "done"
        assert len(qs2) == 1
        assert qs2[0].prompt == "Q1"

    def test_marker_split_into_many_chunks(self):
        """标记被切到 4 个 chunk。"""
        parser = QuestionStreamParser()
        parts = ["[[", "ASK_USER:", '{"prompt":', '"Q"', "}", "]]", "tail"]
        all_text = ""
        all_qs: list[Question] = []
        for p in parts:
            t, qs = parser.feed(p)
            all_text += t
            all_qs.extend(qs)
        assert all_text == "tail"
        assert len(all_qs) == 1
        assert all_qs[0].prompt == "Q"

    def test_open_marker_prefix_preserved(self):
        """开标记前缀(如 `[[ASK_USE`)保留在 buffer 等待下个 chunk。"""
        parser = QuestionStreamParser()
        # 喂入"前缀+部分开标记"
        text1, qs1 = parser.feed("hello[[ASK_USE")
        # hello 应输出,但 [[ASK_USE 应保留
        assert text1 == "hello"
        assert qs1 == []
        # 喂完后续完整标记
        text2, qs2 = parser.feed('R:{"prompt":"Q"}]]world')
        assert text2 == "world"
        assert len(qs2) == 1

    def test_partial_open_marker_at_chunk_end(self):
        """chunk 末尾恰好是部分开标记(如 `[`)。"""
        parser = QuestionStreamParser()
        text1, _ = parser.feed("abc[")
        # abc 输出,[ 保留(可能是开标记开始)
        assert text1 == "abc"
        # 接着喂非标记内容
        text2, _ = parser.feed("def")
        assert text2 == "[def"  # 保留的 [ 与新内容合并输出


class TestQuestionStreamParserFlush:
    """flush 残留处理。"""

    def test_flush_empty(self):
        """空 buffer flush 返回空。"""
        parser = QuestionStreamParser()
        text, qs = parser.flush()
        assert text == ""
        assert qs == []

    def test_flush_incomplete_marker_dropped_as_text(self):
        """不完整标记 flush 时作为文本输出(不吞内容)。"""
        parser = QuestionStreamParser()
        parser.feed("hello[[ASK_USER:")
        text, qs = parser.flush()
        # 残留含开标记 → 原样输出(暴露 AI 输出失误,不吞内容)
        assert "hello" not in text  # hello 已在 feed 时输出
        assert "[[ASK_USER:" in text
        assert qs == []

    def test_flush_partial_json_in_marker(self):
        """标记内有部分 JSON,flush 时原样输出。"""
        parser = QuestionStreamParser()
        parser.feed('[[ASK_USER:{"prompt":"unterminated')
        text, qs = parser.flush()
        assert "[[ASK_USER:" in text
        assert "unterminated" in text
        assert qs == []


class TestQuestionStreamParserEdgeCases:
    """边界情况。"""

    def test_empty_chunk_returns_empty(self):
        """空 chunk 返回空文本和空列表。"""
        parser = QuestionStreamParser()
        text, qs = parser.feed("")
        assert text == ""
        assert qs == []

    def test_marker_at_start_of_stream(self):
        """标记在流开头。"""
        parser = QuestionStreamParser()
        text, qs = parser.feed('[[ASK_USER:{"prompt":"Q"}]]tail')
        assert text == "tail"
        assert len(qs) == 1

    def test_marker_at_end_of_stream(self):
        """标记在流末尾。"""
        parser = QuestionStreamParser()
        text, qs = parser.feed('head[[ASK_USER:{"prompt":"Q"}]]')
        assert text == "head"
        assert len(qs) == 1

    def test_consecutive_markers_no_text_between(self):
        """连续标记之间无文本。"""
        parser = QuestionStreamParser()
        chunk = '[[ASK_USER:{"prompt":"Q1"}]][[ASK_USER:{"prompt":"Q2"}]]'
        text, qs = parser.feed(chunk)
        assert text == ""
        assert len(qs) == 2

    def test_question_id_unique(self):
        """每个 Question 的 questionId 唯一。"""
        parser = QuestionStreamParser()
        chunk = '[[ASK_USER:{"prompt":"Q1"}]][[ASK_USER:{"prompt":"Q2"}]]'
        _, qs = parser.feed(chunk)
        ids = {q.question_id for q in qs}
        assert len(ids) == 2
