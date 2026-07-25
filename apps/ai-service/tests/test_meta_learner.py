"""元学习器测试(L4-3 / L4-4,2026-07-25 立)。

覆盖 meta_learner.py:
- MetaLearner.learn_from_failures:从失败案例聚类 + 抽取 lessons
- MetaLearner.record_self_eval:从自评结果沉淀 lessons
- MetaLearner.evaluate_and_record:组合自评 + 沉淀
- MetaLearner._extract_lessons_from_patterns:从 patterns 抽取 lessons
- MetaLearner._upsert_lesson:DB UPSERT + 内存索引合并
- MetaLearner.load_all_lessons:DB → 内存 hydrate
- MetaLearner.delete_lesson:DB + 内存删除
- MetaLearner.build_system_prompt_snippet:system prompt 注入
- MetaLearner.get_cached_lessons / get_status:查询接口
- _build_snippet_for_lesson:单条 snippet 构建
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.meta_learner import (
    MetaLearner,
    _MAX_LESSONS_IN_PROMPT,
    _MIN_CONFIDENCE_FOR_PROMPT,
    meta_learner,
)


# =============================================================================
# 工厂函数
# =============================================================================


def make_pattern(
    pattern_id: str = "fp_1",
    category: str = "timeout",
    title: str = "T1",
    case_count: int = 5,
    source_skills: list[str] | None = None,
) -> dict:
    return {
        "patternId": pattern_id,
        "category": category,
        "title": title,
        "description": "D1",
        "sourceSkills": source_skills or ["skill-a"],
        "caseCount": case_count,
        "exampleCases": [{"skillName": "skill-a", "failureReason": "r1"}],
        "suggestedFix": "F1",
    }


def make_eval_result(
    score: float = 0.7,
    strengths: list[str] | None = None,
    improvements: list[str] | None = None,
    failure_mode: str | None = None,
    lesson: str | None = None,
) -> dict:
    return {
        "score": score,
        "strengths": strengths if strengths is not None else ["s1"],
        "improvements": improvements if improvements is not None else ["i1"],
        "failureMode": failure_mode,
        "lesson": lesson,
    }


def make_db_row(
    lesson_id: str = "00000000-0000-0000-0000-000000000001",
    lesson_type: str = "failure_pattern",
    title: str = "T1",
    content: str = "C1",
    source_skills: list[str] | None = None,
    occ: int = 1,
    conf: float = 0.6,
    snippet: str = "",
    failure_pattern_id: str | None = None,
) -> dict:
    """构造 asyncpg fetchrow/fetch 返回的行字典(mock 用)。"""
    return {
        "lesson_id": lesson_id,
        "lesson_type": lesson_type,
        "title": title,
        "content": content,
        "source_skills": source_skills if source_skills is not None else [],
        "failure_pattern_id": failure_pattern_id,
        "occ": occ,
        "conf": conf,
        "snippet": snippet,
        "created_at": None,
        "updated_at": None,
    }


# =============================================================================
# learn_from_failures:主入口
# =============================================================================


class TestLearnFromFailures:
    """learn_from_failures:从失败案例聚类 + 抽取 lessons。"""

    @pytest.mark.asyncio
    async def test_no_patterns_returns_empty(self, monkeypatch):
        """FailureClusterer 返回空 patterns → 0 lessons。"""
        learner = MetaLearner()
        monkeypatch.setattr(
            "app.services.failure_clusterer.failure_clusterer.cluster",
            AsyncMock(return_value=[]),
        )
        result = await learner.learn_from_failures([])
        assert result["patternsCount"] == 0
        assert result["lessonsExtracted"] == 0
        assert result["lessonsPersisted"] == 0

    @pytest.mark.asyncio
    async def test_patterns_extract_lessons(self, monkeypatch):
        """有 patterns → 抽取对应 lessons。"""
        learner = MetaLearner()
        patterns = [make_pattern(case_count=5), make_pattern(
            pattern_id="fp_2", case_count=3
        )]
        monkeypatch.setattr(
            "app.services.failure_clusterer.failure_clusterer.cluster",
            AsyncMock(return_value=patterns),
        )
        # mock UPSERT(返回 True)
        upsert_mock = AsyncMock(return_value=True)
        monkeypatch.setattr(learner, "_upsert_lesson", upsert_mock)

        result = await learner.learn_from_failures([{"skillName": "x"}])
        assert result["patternsCount"] == 2
        assert result["lessonsExtracted"] == 2
        assert result["lessonsPersisted"] == 2
        assert upsert_mock.await_count == 2


# =============================================================================
# record_self_eval
# =============================================================================


class TestRecordSelfEval:
    """record_self_eval:从自评结果抽取 lessons。"""

    @pytest.mark.asyncio
    async def test_extracts_improvements_strengths_lesson_failuremode(
        self, monkeypatch
    ):
        """有 improvements + strengths + lesson + failureMode → 抽 4 条 lessons。"""
        learner = MetaLearner()
        eval_result = make_eval_result(
            score=0.8,
            strengths=["s1", "s2"],
            improvements=["i1", "i2"],
            failure_mode="fm1",
            lesson="l1",
        )
        upsert_mock = AsyncMock(return_value=True)
        monkeypatch.setattr(learner, "_upsert_lesson", upsert_mock)

        result = await learner.record_self_eval(eval_result, skill_name="code-review")
        # 2 improvements + 1 lesson + 2 strengths + 1 failureMode = 6
        assert result["lessonsExtracted"] == 6
        assert result["lessonsPersisted"] == 6

    @pytest.mark.asyncio
    async def test_empty_eval_returns_zero(self, monkeypatch):
        """空自评 → 0 lessons。"""
        learner = MetaLearner()
        result = await learner.record_self_eval({
            "score": 0.5,
            "strengths": [],
            "improvements": [],
            "failureMode": None,
            "lesson": None,
        })
        assert result["lessonsExtracted"] == 0
        assert result["lessonsPersisted"] == 0

    @pytest.mark.asyncio
    async def test_no_skill_name_empty_source(self, monkeypatch):
        """skill_name 空 → sourceSkills 也是空。"""
        learner = MetaLearner()
        upsert_mock = AsyncMock(return_value=True)
        monkeypatch.setattr(learner, "_upsert_lesson", upsert_mock)

        await learner.record_self_eval(
            make_eval_result(improvements=["i1"]), skill_name=""
        )
        # 第一个调用的 lesson 是 improvement_tip
        called_lesson = upsert_mock.await_args_list[0].args[0]
        assert called_lesson["sourceSkills"] == []


# =============================================================================
# evaluate_and_record:组合自评 + 沉淀
# =============================================================================


class TestEvaluateAndRecord:
    """evaluate_and_record:组合 SelfEvaluator + record_self_eval。"""

    @pytest.mark.asyncio
    async def test_calls_evaluator_then_records(self, monkeypatch):
        learner = MetaLearner()
        eval_result = make_eval_result(score=0.85)
        monkeypatch.setattr(
            "app.services.self_evaluator.self_evaluator.evaluate",
            AsyncMock(return_value=eval_result),
        )
        upsert_mock = AsyncMock(return_value=True)
        monkeypatch.setattr(learner, "_upsert_lesson", upsert_mock)

        result = await learner.evaluate_and_record(
            {"success": True, "stop_reason": "completed"},
            task_input="test",
            skill_name="code-review",
        )
        assert result["evalResult"]["score"] == 0.85
        assert result["lessonsExtracted"] > 0
        assert result["lessonsPersisted"] > 0


# =============================================================================
# _extract_lessons_from_patterns
# =============================================================================


class TestExtractLessons:
    """_extract_lessons_from_patterns:从 patterns 抽取 lessons。"""

    @pytest.mark.asyncio
    async def test_empty_patterns_returns_empty(self):
        assert await MetaLearner()._extract_lessons_from_patterns([]) == []

    @pytest.mark.asyncio
    async def test_single_pattern_single_lesson(self):
        patterns = [make_pattern(case_count=10)]
        lessons = await MetaLearner()._extract_lessons_from_patterns(patterns)
        assert len(lessons) == 1
        lesson = lessons[0]
        assert lesson["lessonType"] == "failure_pattern"
        assert lesson["title"] == "T1"
        assert lesson["occurrenceCount"] == 10
        assert "症状" in lesson["content"]
        assert "建议" in lesson["content"]
        assert "案例" in lesson["content"]

    @pytest.mark.asyncio
    async def test_confidence_caps_at_09(self):
        """case_count 巨大时 confidence 封顶 0.9。"""
        patterns = [make_pattern(case_count=1000)]
        lessons = await MetaLearner()._extract_lessons_from_patterns(patterns)
        assert lessons[0]["confidence"] <= 0.9

    @pytest.mark.asyncio
    async def test_lesson_has_uuid_id(self):
        patterns = [make_pattern()]
        lessons = await MetaLearner()._extract_lessons_from_patterns(patterns)
        # lessonId 是 UUID 字符串
        assert len(lessons[0]["lessonId"]) == 36


# =============================================================================
# _upsert_lesson:内存合并
# =============================================================================


class TestUpsertLessonMemoryMerge:
    """_upsert_lesson 内存合并逻辑(无 DB mock)。"""

    @pytest.mark.asyncio
    async def test_new_lesson_added_to_memory(self, monkeypatch):
        learner = MetaLearner()
        # 关闭 DB 路径(模拟 DB 异常,只走内存)
        async def fake_pool():
            raise RuntimeError("DB down")
        monkeypatch.setattr(
            "app.services.meta_learner._get_pool", fake_pool
        )

        lesson = {
            "lessonId": "11111111-1111-1111-1111-111111111111",
            "lessonType": "improvement_tip",
            "title": "T1",
            "content": "C1",
            "sourceSkills": ["s1"],
            "failurePatternId": None,
            "occurrenceCount": 1,
            "confidence": 0.6,
        }
        ok = await learner._upsert_lesson(lesson)
        assert ok is True
        assert lesson["lessonId"] in learner._lessons

    @pytest.mark.asyncio
    async def test_existing_lesson_merges_occurrence(self, monkeypatch):
        """同 (lesson_type, title) 二次 UPSERT → occurrence_count 累加。"""
        learner = MetaLearner()
        async def fake_pool():
            raise RuntimeError("DB down")
        monkeypatch.setattr(
            "app.services.meta_learner._get_pool", fake_pool
        )

        lesson1 = {
            "lessonId": "11111111-1111-1111-1111-111111111111",
            "lessonType": "failure_pattern",
            "title": "T1",
            "content": "C1",
            "sourceSkills": ["s1"],
            "failurePatternId": "fp_1",
            "occurrenceCount": 3,
            "confidence": 0.5,
        }
        await learner._upsert_lesson(lesson1)

        lesson2 = {
            "lessonId": "22222222-2222-2222-2222-222222222222",
            "lessonType": "failure_pattern",
            "title": "T1",  # 同 title
            "content": "C2",
            "sourceSkills": ["s2"],
            "failurePatternId": "fp_1",
            "occurrenceCount": 2,
            "confidence": 0.6,
        }
        await learner._upsert_lesson(lesson2)

        # 内存中应只有 1 条(用原 id 11111111)
        assert len(learner._lessons) == 1
        merged = learner._lessons["11111111-1111-1111-1111-111111111111"]
        # occurrence_count 累加 3 + 2 = 5
        assert merged["occurrenceCount"] == 5
        # source_skills 合并
        assert set(merged["sourceSkills"]) == {"s1", "s2"}


# =============================================================================
# load_all_lessons:DB hydrate
# =============================================================================


class TestLoadAllLessons:
    """load_all_lessons:从 DB 全量 hydrate 到内存。"""

    @pytest.mark.asyncio
    async def test_loads_rows_to_memory(self, monkeypatch):
        learner = MetaLearner()
        rows = [
            make_db_row(
                lesson_id="11111111-1111-1111-1111-111111111111",
                lesson_type="failure_pattern",
                title="T1",
                occ=5,
                conf=0.7,
            ),
            make_db_row(
                lesson_id="22222222-2222-2222-2222-222222222222",
                lesson_type="improvement_tip",
                title="T2",
                occ=3,
                conf=0.4,
            ),
        ]
        mock_pool = MagicMock()
        mock_conn = MagicMock()
        mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
        mock_conn.fetch = AsyncMock(return_value=rows)

        async def fake_get_pool():
            return mock_pool
        monkeypatch.setattr(
            "app.services.meta_learner._get_pool", fake_get_pool
        )

        count = await learner.load_all_lessons()
        assert count == 2
        assert len(learner._lessons) == 2

    @pytest.mark.asyncio
    async def test_db_failure_returns_zero(self, monkeypatch):
        learner = MetaLearner()
        async def fake_get_pool():
            raise RuntimeError("DB down")
        monkeypatch.setattr(
            "app.services.meta_learner._get_pool", fake_get_pool
        )

        count = await learner.load_all_lessons()
        assert count == 0


# =============================================================================
# delete_lesson
# =============================================================================


class TestDeleteLesson:
    """delete_lesson:从 DB + 内存删除。"""

    @pytest.mark.asyncio
    async def test_empty_id_returns_false(self):
        learner = MetaLearner()
        assert await learner.delete_lesson("") is False

    @pytest.mark.asyncio
    async def test_memory_cleared(self, monkeypatch):
        learner = MetaLearner()
        # 预置内存
        learner._lessons["11111111-1111-1111-1111-111111111111"] = {
            "lessonId": "11111111-1111-1111-1111-111111111111",
            "lessonType": "failure_pattern",
            "title": "T1",
            "sourceSkills": [],
        }
        learner._title_index[("failure_pattern", "T1")] = "11111111-1111-1111-1111-111111111111"
        # mock DB 失败(只走内存清理)
        async def fake_get_pool():
            raise RuntimeError("DB down")
        monkeypatch.setattr(
            "app.services.meta_learner._get_pool", fake_get_pool
        )

        ok = await learner.delete_lesson("11111111-1111-1111-1111-111111111111")
        assert ok is True
        assert "11111111-1111-1111-1111-111111111111" not in learner._lessons
        assert ("failure_pattern", "T1") not in learner._title_index


# =============================================================================
# build_system_prompt_snippet
# =============================================================================


class TestBuildSnippet:
    """build_system_prompt_snippet:构建 system prompt 片段。"""

    def test_empty_returns_empty(self):
        learner = MetaLearner()
        assert learner.build_system_prompt_snippet() == ""

    def test_low_confidence_filtered(self):
        """confidence < _MIN_CONFIDENCE_FOR_PROMPT 不注入。"""
        learner = MetaLearner()
        learner._lessons["id1"] = {
            "lessonId": "id1",
            "lessonType": "failure_pattern",
            "title": "T1",
            "content": "C1",
            "confidence": _MIN_CONFIDENCE_FOR_PROMPT - 0.1,
            "occurrenceCount": 1,
        }
        snippet = learner.build_system_prompt_snippet()
        assert snippet == ""

    def test_high_confidence_included(self):
        learner = MetaLearner()
        learner._lessons["id1"] = {
            "lessonId": "id1",
            "lessonType": "failure_pattern",
            "title": "T1",
            "content": "C1",
            "confidence": 0.8,
            "occurrenceCount": 3,
            "failurePatternId": "fp_1",
        }
        snippet = learner.build_system_prompt_snippet()
        assert "## 元知识" in snippet
        assert "### 失败模式(避免)" in snippet
        assert "T1" in snippet
        assert "C1" in snippet

    def test_all_three_types_included(self):
        """3 种类型 lesson 都注入对应段落。"""
        learner = MetaLearner()
        learner._lessons["id1"] = {
            "lessonId": "id1",
            "lessonType": "failure_pattern",
            "title": "FT",
            "content": "FC",
            "confidence": 0.7,
            "occurrenceCount": 3,
            "failurePatternId": "fp_1",
        }
        learner._lessons["id2"] = {
            "lessonId": "id2",
            "lessonType": "improvement_tip",
            "title": "IT",
            "content": "IC",
            "confidence": 0.6,
            "occurrenceCount": 2,
        }
        learner._lessons["id3"] = {
            "lessonId": "id3",
            "lessonType": "best_practice",
            "title": "BT",
            "content": "BC",
            "confidence": 0.9,
            "occurrenceCount": 5,
        }
        snippet = learner.build_system_prompt_snippet()
        assert "### 失败模式(避免)" in snippet
        assert "### 改进建议(采纳)" in snippet
        assert "### 最佳实践(遵循)" in snippet

    def test_max_lessons_respected(self):
        """超过 max_lessons 时截断。"""
        learner = MetaLearner()
        for i in range(10):
            learner._lessons[f"id{i}"] = {
                "lessonId": f"id{i}",
                "lessonType": "best_practice",
                "title": f"T{i}",
                "content": f"C{i}",
                "confidence": 0.9,
                "occurrenceCount": i,
            }
        snippet = learner.build_system_prompt_snippet(max_lessons=3)
        # 应该只包含 3 条
        count = snippet.count("- T")
        assert count <= 3

    def test_snippet_truncated_to_1200_chars(self):
        """snippet 长度 ≤ 1200。"""
        learner = MetaLearner()
        learner._lessons["id1"] = {
            "lessonId": "id1",
            "lessonType": "best_practice",
            "title": "T" * 100,
            "content": "C" * 500,
            "confidence": 0.9,
            "occurrenceCount": 100,
        }
        snippet = learner.build_system_prompt_snippet()
        assert len(snippet) <= 1200


# =============================================================================
# _build_snippet_for_lesson
# =============================================================================


class TestBuildSnippetForLesson:
    """_build_snippet_for_lesson:单条 snippet 构建。"""

    def test_full_lesson(self):
        lesson = {
            "lessonType": "failure_pattern",
            "title": "T1",
            "content": "C1",
        }
        snippet = MetaLearner._build_snippet_for_lesson(lesson)
        assert "[失败模式]" in snippet
        assert "T1" in snippet
        assert "C1" in snippet

    def test_truncates_long_content(self):
        lesson = {
            "lessonType": "improvement_tip",
            "title": "T1",
            "content": "X" * 200,
        }
        snippet = MetaLearner._build_snippet_for_lesson(lesson)
        assert len(snippet) < 200
        assert "..." in snippet

    def test_empty_returns_empty(self):
        lesson = {"lessonType": "best_practice", "title": "", "content": ""}
        assert MetaLearner._build_snippet_for_lesson(lesson) == ""


# =============================================================================
# 查询接口
# =============================================================================


class TestQueryInterfaces:
    """get_cached_lessons / get_status:查询接口。"""

    def test_get_cached_lessons_empty(self):
        learner = MetaLearner()
        assert learner.get_cached_lessons() == []

    def test_get_cached_lessons_filters_by_type(self):
        learner = MetaLearner()
        learner._lessons["id1"] = {
            "lessonId": "id1",
            "lessonType": "failure_pattern",
            "title": "T1",
            "confidence": 0.8,
            "occurrenceCount": 5,
        }
        learner._lessons["id2"] = {
            "lessonId": "id2",
            "lessonType": "improvement_tip",
            "title": "T2",
            "confidence": 0.7,
            "occurrenceCount": 3,
        }
        result = learner.get_cached_lessons(lesson_type="failure_pattern")
        assert len(result) == 1
        assert result[0]["lessonType"] == "failure_pattern"

    def test_get_status_empty(self):
        learner = MetaLearner()
        status = learner.get_status()
        assert status["totalLessons"] == 0
        assert status["byType"] == {
            "failure_pattern": 0,
            "improvement_tip": 0,
            "best_practice": 0,
        }

    def test_get_status_with_lessons(self):
        learner = MetaLearner()
        learner._lessons["id1"] = {
            "lessonType": "failure_pattern",
            "confidence": 0.8,
        }
        learner._lessons["id2"] = {
            "lessonType": "improvement_tip",
            "confidence": 0.6,
        }
        learner._lessons["id3"] = {
            "lessonType": "failure_pattern",
            "confidence": 0.4,
        }
        status = learner.get_status()
        assert status["totalLessons"] == 3
        assert status["byType"]["failure_pattern"] == 2
        assert status["byType"]["improvement_tip"] == 1


# =============================================================================
# 常量
# =============================================================================


class TestConstants:
    """模块级常量。"""

    def test_max_lessons_in_prompt(self):
        assert _MAX_LESSONS_IN_PROMPT == 5

    def test_min_confidence_for_prompt(self):
        assert _MIN_CONFIDENCE_FOR_PROMPT == 0.4


# =============================================================================
# 单例
# =============================================================================


class TestSingleton:
    """meta_learner 单例。"""

    def test_singleton_exists(self):
        assert meta_learner is not None
        assert isinstance(meta_learner, MetaLearner)
