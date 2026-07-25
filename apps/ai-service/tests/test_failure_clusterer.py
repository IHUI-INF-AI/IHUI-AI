"""失败案例聚类器测试(L4-1,2026-07-25 立)。

覆盖 failure_clusterer.py:
- FailureClusterer.cluster:主入口(LLM 路径 + 降级路径)
- _llm_cluster:LLM 聚类(成功/失败降级)
- _format_cases_for_llm:案例格式化
- _parse_llm_output:LLM 输出解析(容错)
- _fallback_cluster:关键词分桶降级
- 常量 _MIN_CASES_FOR_CLUSTERING / _MAX_CASES_PER_LLM_CALL / _KEYWORD_RULES
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.failure_clusterer import (
    FailureClusterer,
    _KEYWORD_RULES,
    _MAX_CASES_PER_LLM_CALL,
    _MIN_CASES_FOR_CLUSTERING,
    failure_clusterer,
)


# =============================================================================
# 工厂函数
# =============================================================================


def make_failure(
    skill: str = "code-review",
    reason: str = "json parse error",
    used_at: str = "2026-07-25T10:00:00Z",
) -> dict:
    """构造一条失败案例。"""
    return {
        "skillName": skill,
        "failureReason": reason,
        "usedAt": used_at,
    }


def make_failures(n: int = 5, reason: str = "json parse error") -> list[dict]:
    """构造 n 条相同 failureReason 的失败案例(可触发聚类)。"""
    return [make_failure(skill=f"skill-{i % 3}", reason=reason) for i in range(n)]


def make_llm_response(content: str = "") -> dict:
    """构造 llm_gateway.complete 的返回值。"""
    return {"content": content, "model": "stub", "usage": {}, "stub": True}


def patch_llm_gateway(content: str = "", side_effect=None):
    """patch app.core.llm_gateway.llm_gateway 单例,返回 patcher。"""
    mock_gw = MagicMock()
    if side_effect is not None:
        mock_gw.complete = AsyncMock(side_effect=side_effect)
    else:
        mock_gw.complete = AsyncMock(return_value=make_llm_response(content))
    return patch("app.core.llm_gateway.llm_gateway", mock_gw)


# =============================================================================
# 常量
# =============================================================================


class TestConstants:
    """模块级常量。"""

    def test_min_cases_for_clustering(self):
        assert _MIN_CASES_FOR_CLUSTERING == 3

    def test_max_cases_per_llm_call(self):
        assert _MAX_CASES_PER_LLM_CALL == 30

    def test_keyword_rules_non_empty(self):
        assert len(_KEYWORD_RULES) > 0
        # 规则元素是 (keyword, category) 元组
        for kw, cat in _KEYWORD_RULES:
            assert isinstance(kw, str)
            assert isinstance(cat, str)


# =============================================================================
# cluster:主入口
# =============================================================================


class TestCluster:
    """cluster:聚类失败案例。"""

    @pytest.mark.asyncio
    async def test_below_threshold_returns_empty(self):
        """失败案例 < _MIN_CASES_FOR_CLUSTERING → 返回 []。"""
        cases = make_failures(_MIN_CASES_FOR_CLUSTERING - 1)
        result = await failure_clusterer.cluster(cases)
        assert result == []

    @pytest.mark.asyncio
    async def test_llm_success_returns_patterns(self):
        """LLM 成功返回聚类模式(过滤 < 3 案例的)。"""
        cases = make_failures(5)
        llm_output = (
            '[{"category": "output_format", "title": "JSON 解析错误", '
            '"description": "跨 skill 出现 JSON 解析错误", '
            '"sourceSkills": ["skill-0", "skill-1", "skill-2"], '
            '"caseCount": 5, '
            '"exampleCases": [{"skillName": "skill-0", "failureReason": "json parse error"}], '
            '"suggestedFix": "加强 JSON schema 校验"}]'
        )
        with patch_llm_gateway(content=llm_output):
            patterns = await failure_clusterer.cluster(cases)
        assert len(patterns) == 1
        assert patterns[0]["category"] == "output_format"
        assert patterns[0]["caseCount"] == 5
        assert patterns[0]["patternId"].startswith("fp_")

    @pytest.mark.asyncio
    async def test_llm_failure_falls_back_to_keyword(self):
        """LLM 异常 → 降级到关键词分桶。"""
        cases = make_failures(5, reason="json parse error")
        with patch_llm_gateway(side_effect=RuntimeError("LLM down")):
            patterns = await failure_clusterer.cluster(cases)
        # 关键词 'json' / 'parse' 命中 output_format 类目
        assert len(patterns) == 1
        assert patterns[0]["category"] == "output_format"
        assert patterns[0]["caseCount"] >= 3


# =============================================================================
# _format_cases_for_llm
# =============================================================================


class TestFormatCases:
    """_format_cases_for_llm:案例格式化为 LLM 文本。"""

    def test_empty_cases_returns_empty(self):
        assert FailureClusterer._format_cases_for_llm([]) == ""

    def test_format_single_case(self):
        cases = [make_failure(skill="code-review", reason="timeout")]
        text = FailureClusterer._format_cases_for_llm(cases)
        assert "[0]" in text
        assert "code-review" in text
        assert "timeout" in text

    def test_format_truncates_long_reason(self):
        long_reason = "x" * 300
        cases = [make_failure(reason=long_reason)]
        text = FailureClusterer._format_cases_for_llm(cases)
        assert "..." in text
        # 截断到 197 + ...
        assert len(text) < 300

    def test_format_handles_empty_reason(self):
        cases = [{"skillName": "skill-x", "failureReason": "", "usedAt": ""}]
        text = FailureClusterer._format_cases_for_llm(cases)
        assert "(no reason)" in text


# =============================================================================
# _parse_llm_output
# =============================================================================


class TestParseLlmOutput:
    """_parse_llm_output:LLM 输出解析为 patterns(容错)。"""

    def test_empty_content_returns_empty(self):
        assert FailureClusterer._parse_llm_output("", []) == []

    def test_no_array_match_returns_empty(self):
        assert FailureClusterer._parse_llm_output("not an array", []) == []

    def test_invalid_json_returns_empty(self):
        assert FailureClusterer._parse_llm_output("[invalid json]", []) == []

    def test_valid_array_parses(self):
        content = (
            '[{"category": "timeout", "title": "T1", "description": "D1", '
            '"sourceSkills": ["s1"], "caseCount": 5, '
            '"exampleCases": [{"skillName": "s1", "failureReason": "r1"}], '
            '"suggestedFix": "F1"}]'
        )
        patterns = FailureClusterer._parse_llm_output(content, [])
        assert len(patterns) == 1
        assert patterns[0]["category"] == "timeout"
        assert patterns[0]["caseCount"] == 5
        assert patterns[0]["patternId"] == "fp_1"

    def test_invalid_category_defaults_to_other(self):
        content = (
            '[{"category": "INVALID", "title": "T1", "caseCount": 5, '
            '"description": "D1", "sourceSkills": [], "exampleCases": [], '
            '"suggestedFix": ""}]'
        )
        patterns = FailureClusterer._parse_llm_output(content, [])
        assert len(patterns) == 1
        assert patterns[0]["category"] == "other"

    def test_low_casecount_filtered(self):
        """caseCount < _MIN_CASES_FOR_CLUSTERING 的模式被过滤。"""
        content = (
            '[{"category": "timeout", "title": "T1", "caseCount": 2, '
            '"description": "D1", "sourceSkills": [], "exampleCases": [], '
            '"suggestedFix": ""}]'
        )
        patterns = FailureClusterer._parse_llm_output(content, [])
        assert patterns == []

    def test_sorted_by_casecount_desc(self):
        content = (
            '[{"category": "timeout", "title": "T1", "caseCount": 3, '
            '"description": "D1", "sourceSkills": [], "exampleCases": [], '
            '"suggestedFix": ""}, '
            '{"category": "other", "title": "T2", "caseCount": 10, '
            '"description": "D2", "sourceSkills": [], "exampleCases": [], '
            '"suggestedFix": ""}]'
        )
        patterns = FailureClusterer._parse_llm_output(content, [])
        assert len(patterns) == 2
        assert patterns[0]["caseCount"] >= patterns[1]["caseCount"]

    def test_markdown_stripped(self):
        """LLM 输出 markdown ```json 包裹时能正确解析。"""
        content = (
            '```json\n[{"category": "timeout", "title": "T1", "caseCount": 5, '
            '"description": "D1", "sourceSkills": [], "exampleCases": [], '
            '"suggestedFix": ""}]\n```'
        )
        patterns = FailureClusterer._parse_llm_output(content, [])
        assert len(patterns) == 1


# =============================================================================
# _fallback_cluster
# =============================================================================


class TestFallbackCluster:
    """_fallback_cluster:关键词分桶降级。"""

    def test_empty_cases_returns_empty(self):
        assert FailureClusterer._fallback_cluster([]) == []

    def test_below_threshold_bucket_filtered(self):
        """桶内案例数 < _MIN_CASES_FOR_CLUSTERING → 过滤。"""
        cases = [
            make_failure(reason="timeout error"),
            make_failure(reason="json parse"),  # 不同关键词
        ]
        # 各 1 条,均 < 3
        patterns = FailureClusterer._fallback_cluster(cases)
        assert patterns == []

    def test_keyword_matching(self):
        """timeout / json / parse 等关键词命中正确类目。"""
        cases = [
            make_failure(skill="s1", reason="timeout error"),
            make_failure(skill="s2", reason="timed out"),
            make_failure(skill="s3", reason="connection timeout"),
        ]
        patterns = FailureClusterer._fallback_cluster(cases)
        assert len(patterns) == 1
        assert patterns[0]["category"] == "timeout"
        assert patterns[0]["caseCount"] == 3

    def test_multiple_categories(self):
        """不同关键词分别聚成不同类目。"""
        cases = [
            make_failure(skill="s1", reason="timeout"),
            make_failure(skill="s2", reason="timeout"),
            make_failure(skill="s3", reason="timeout"),
            make_failure(skill="s4", reason="json parse"),
            make_failure(skill="s5", reason="json format"),
            make_failure(skill="s6", reason="parse error"),
        ]
        patterns = FailureClusterer._fallback_cluster(cases)
        assert len(patterns) == 2
        categories = {p["category"] for p in patterns}
        assert "timeout" in categories
        assert "output_format" in categories

    def test_sorted_by_casecount_desc(self):
        cases = []
        # 6 条 timeout
        for i in range(6):
            cases.append(make_failure(skill=f"s{i}", reason="timeout"))
        # 3 条 json
        for i in range(3):
            cases.append(make_failure(skill=f"j{i}", reason="json parse"))
        patterns = FailureClusterer._fallback_cluster(cases)
        assert patterns[0]["caseCount"] >= patterns[1]["caseCount"]

    def test_example_cases_max_three(self):
        """exampleCases 最多 3 条。"""
        cases = [
            make_failure(skill=f"s{i}", reason="timeout") for i in range(10)
        ]
        patterns = FailureClusterer._fallback_cluster(cases)
        assert len(patterns[0]["exampleCases"]) == 3

    def test_unknown_keyword_falls_to_other(self):
        """未匹配关键词归入 other。"""
        cases = [
            make_failure(skill="s1", reason="unknown weird problem"),
            make_failure(skill="s2", reason="unknown weird problem"),
            make_failure(skill="s3", reason="unknown weird problem"),
        ]
        patterns = FailureClusterer._fallback_cluster(cases)
        assert len(patterns) == 1
        assert patterns[0]["category"] == "other"


# =============================================================================
# 单例
# =============================================================================


class TestSingleton:
    """failure_clusterer 单例。"""

    def test_singleton_exists(self):
        assert failure_clusterer is not None
        assert isinstance(failure_clusterer, FailureClusterer)
