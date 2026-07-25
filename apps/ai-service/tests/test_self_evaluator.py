"""自评器测试(L4-2,2026-07-25 立)。

覆盖 self_evaluator.py:
- SelfEvaluator.evaluate:主入口(LLM 路径 + 降级路径)
- _llm_evaluate:LLM 自评(成功/失败降级)
- _format_trace_for_llm:trace 格式化
- _parse_llm_output:LLM 输出解析(容错)
- _fallback_evaluate:按 stop_reason 降级打分
- _default_eval:空输入兜底
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.self_evaluator import (
    SelfEvaluator,
    _DEFAULT_SCORE,
    _MAX_TRACE_CHARS,
    self_evaluator,
)


# =============================================================================
# 工厂函数
# =============================================================================


def make_task_result(
    success: bool = True,
    stop_reason: str = "completed",
    final_response: str = "task done",
    iterations_count: int = 2,
    error: str | None = None,
) -> dict:
    """构造 AgentLoopResult 风格的 task_result 字典。"""
    iterations = []
    for i in range(iterations_count):
        iterations.append({
            "reasoning": f"thinking step {i}",
            "tool_calls": [{"name": f"tool_{i}", "args": {}}],
            "tool_results": [
                {
                    "tool_call_id": "0",
                    "name": f"tool_{i}",
                    "result": "ok" if i % 2 == 0 else "fail",
                    "error": "tool error" if i == 1 else None,
                }
            ],
        })
    return {
        "success": success,
        "stop_reason": stop_reason,
        "final_response": final_response,
        "iterations": iterations,
        "total_duration_ms": 1234.5,
        "total_tokens_used": 5678,
        "error": error,
    }


def make_llm_response(content: str = "") -> dict:
    return {"content": content, "model": "stub", "usage": {}, "stub": True}


def patch_llm_gateway(content: str = "", side_effect=None):
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

    def test_default_score(self):
        assert _DEFAULT_SCORE == 0.5

    def test_max_trace_chars(self):
        assert _MAX_TRACE_CHARS == 4000


# =============================================================================
# evaluate:主入口
# =============================================================================


class TestEvaluate:
    """evaluate:对任务结果进行自评。"""

    @pytest.mark.asyncio
    async def test_empty_task_result_returns_default(self):
        """空 task_result → 默认评分。"""
        result = await self_evaluator.evaluate({})
        assert result["score"] == _DEFAULT_SCORE
        assert "空任务结果" in result["improvements"][0]

    @pytest.mark.asyncio
    async def test_llm_success_returns_eval(self):
        """LLM 成功返回自评结果。"""
        llm_output = (
            '{"score": 0.85, "strengths": ["清晰拆解", "工具使用合理"], '
            '"improvements": ["可增加边界条件检查"], '
            '"failureMode": null, "lesson": "复杂任务先验证 schema"}'
        )
        task_result = make_task_result()
        with patch_llm_gateway(content=llm_output):
            result = await self_evaluator.evaluate(task_result, task_input="test task")
        assert result["score"] == 0.85
        assert len(result["strengths"]) == 2
        assert len(result["improvements"]) == 1
        assert result["failureMode"] is None
        assert result["lesson"] == "复杂任务先验证 schema"

    @pytest.mark.asyncio
    async def test_llm_failure_falls_back(self):
        """LLM 异常 → 降级按 stop_reason 打分。"""
        task_result = make_task_result(success=False, stop_reason="error", error="boom")
        with patch_llm_gateway(side_effect=RuntimeError("LLM down")):
            result = await self_evaluator.evaluate(task_result)
        assert result["score"] == 0.2  # error stop_reason = 0.2
        assert result["failureMode"] is not None


# =============================================================================
# _format_trace_for_llm
# =============================================================================


class TestFormatTrace:
    """_format_trace_for_llm:trace 格式化为 LLM 文本。"""

    def test_empty_trace(self):
        """空 dict → 空字符串(走降级路径)。"""
        assert SelfEvaluator._format_trace_for_llm({}) == ""

    def test_basic_format(self):
        task_result = make_task_result(iterations_count=2)
        text = SelfEvaluator._format_trace_for_llm(task_result)
        assert "success=True" in text
        assert "stop_reason=completed" in text
        assert "[0]" in text
        assert "[1]" in text
        assert "tool_0" in text

    def test_truncates_long_trace(self):
        """超长 trace 截断到 _MAX_TRACE_CHARS。"""
        # 构造 5 个 iteration,每个 reasoning 1500 字符(代码 [:1000] 截断)
        # 5 * 1000 + 500(final_response 截断)+ 50(基础行) = 5550 > 4000
        task_result = {
            "success": True,
            "stop_reason": "completed",
            "final_response": "x" * 2000,
            "iterations": [
                {"reasoning": "y" * 1500, "tool_calls": [], "tool_results": []}
                for _ in range(5)
            ],
            "total_duration_ms": 100,
            "total_tokens_used": 100,
        }
        text = SelfEvaluator._format_trace_for_llm(task_result)
        assert len(text) <= _MAX_TRACE_CHARS
        assert "已截断" in text

    def test_iterations_truncated_to_five(self):
        """iterations 最多展示前 5 轮。"""
        task_result = make_task_result(iterations_count=10)
        text = SelfEvaluator._format_trace_for_llm(task_result)
        # 5 轮 [0]-[4]
        for i in range(5):
            assert f"[{i}]" in text
        assert "[5]" not in text  # 第 6 轮被截断

    def test_handles_non_dict_iterations(self):
        """iterations 元素非 dict 时不崩溃。"""
        task_result = {
            "success": True,
            "stop_reason": "completed",
            "iterations": ["not-a-dict", {"reasoning": "ok"}],
            "final_response": "",
            "total_duration_ms": 0,
            "total_tokens_used": 0,
        }
        text = SelfEvaluator._format_trace_for_llm(task_result)
        assert "success=True" in text


# =============================================================================
# _parse_llm_output
# =============================================================================


class TestParseLlmOutput:
    """_parse_llm_output:LLM 输出解析为 SelfEvalResult(容错)。"""

    def test_empty_content_returns_none(self):
        assert SelfEvaluator._parse_llm_output("") is None

    def test_no_json_object_returns_none(self):
        assert SelfEvaluator._parse_llm_output("not a json") is None

    def test_invalid_json_returns_none(self):
        assert SelfEvaluator._parse_llm_output("{invalid json}") is None

    def test_valid_json_parses(self):
        content = (
            '{"score": 0.8, "strengths": ["s1"], "improvements": ["i1"], '
            '"failureMode": null, "lesson": "l1"}'
        )
        result = SelfEvaluator._parse_llm_output(content)
        assert result is not None
        assert result["score"] == 0.8
        assert result["strengths"] == ["s1"]
        assert result["improvements"] == ["i1"]
        assert result["failureMode"] is None
        assert result["lesson"] == "l1"

    def test_score_clamped_to_range(self):
        """score 限制在 [0, 1]。"""
        content = '{"score": 1.5, "strengths": [], "improvements": []}'
        result = SelfEvaluator._parse_llm_output(content)
        assert result is not None
        assert result["score"] == 1.0

        content = '{"score": -0.5, "strengths": [], "improvements": []}'
        result = SelfEvaluator._parse_llm_output(content)
        assert result is not None
        assert result["score"] == 0.0

    def test_invalid_score_uses_default(self):
        """score 非 number → 用默认值。"""
        content = '{"score": "invalid", "strengths": [], "improvements": []}'
        result = SelfEvaluator._parse_llm_output(content)
        assert result is not None
        assert result["score"] == _DEFAULT_SCORE

    def test_non_list_strengths_converted_to_empty(self):
        content = '{"score": 0.5, "strengths": "not a list", "improvements": []}'
        result = SelfEvaluator._parse_llm_output(content)
        assert result is not None
        assert result["strengths"] == []

    def test_strengths_truncated_to_five(self):
        """strengths 最多 5 条。"""
        content = (
            '{"score": 0.5, "strengths": ["s1", "s2", "s3", "s4", "s5", "s6", "s7"], '
            '"improvements": []}'
        )
        result = SelfEvaluator._parse_llm_output(content)
        assert result is not None
        assert len(result["strengths"]) == 5

    def test_markdown_stripped(self):
        """LLM 输出 markdown 包裹时能正确解析。"""
        content = (
            '```json\n{"score": 0.7, "strengths": [], "improvements": []}\n```'
        )
        result = SelfEvaluator._parse_llm_output(content)
        assert result is not None
        assert result["score"] == 0.7


# =============================================================================
# _fallback_evaluate
# =============================================================================


class TestFallbackEvaluate:
    """_fallback_evaluate:按 stop_reason 降级打分。"""

    def test_completed_success(self):
        result = SelfEvaluator._fallback_evaluate({
            "success": True,
            "stop_reason": "completed",
        })
        assert result["score"] == 0.8

    def test_max_iterations(self):
        result = SelfEvaluator._fallback_evaluate({
            "success": False,
            "stop_reason": "max_iterations",
        })
        assert result["score"] == 0.4

    def test_error(self):
        result = SelfEvaluator._fallback_evaluate({
            "success": False,
            "stop_reason": "error",
            "error": "boom",
        })
        assert result["score"] == 0.2
        assert result["failureMode"] == "stop_reason=error"

    def test_paused(self):
        result = SelfEvaluator._fallback_evaluate({
            "success": False,
            "stop_reason": "paused",
        })
        assert result["score"] == 0.3

    def test_cancelled(self):
        result = SelfEvaluator._fallback_evaluate({
            "success": False,
            "stop_reason": "cancelled",
        })
        assert result["score"] == 0.3

    def test_unknown_stop_reason(self):
        result = SelfEvaluator._fallback_evaluate({
            "success": True,
            "stop_reason": "unknown_reason",
        })
        assert result["score"] == _DEFAULT_SCORE

    def test_success_but_completed_with_error_capped(self):
        """success=False 但 stop_reason=completed → score 限制在 0.5。"""
        result = SelfEvaluator._fallback_evaluate({
            "success": False,
            "stop_reason": "completed",
        })
        assert result["score"] <= 0.5


# =============================================================================
# _default_eval
# =============================================================================


class TestDefaultEval:
    """_default_eval:空输入兜底。"""

    def test_returns_default_score(self):
        result = SelfEvaluator._default_eval("some reason")
        assert result["score"] == _DEFAULT_SCORE
        assert result["strengths"] == []
        assert "some reason" in result["improvements"][0]
        assert result["failureMode"] is None
        assert result["lesson"] is None


# =============================================================================
# 单例
# =============================================================================


class TestSingleton:
    """self_evaluator 单例。"""

    def test_singleton_exists(self):
        assert self_evaluator is not None
        assert isinstance(self_evaluator, SelfEvaluator)
