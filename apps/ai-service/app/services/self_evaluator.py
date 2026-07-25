"""自评器(L4-2,2026-07-25 立,对标 Hermes Agent self-evaluation)。

每次任务执行后,LLM 自评本次任务表现:
1. 评分(0-1)
2. 优势(strengths):哪些做得好
3. 可改进点(improvements):哪些可以做得更好
4. 失败模式(failureMode):若识别出失败模式,记录到 procedural memory
5. 教训(lesson):本次任务的可复用经验

输入(AgentLoopResult):
  - success: 任务是否成功
  - iterations: 每轮迭代记录(reasoning + tool_calls + tool_results)
  - final_response: 最终回复
  - total_duration_ms: 总耗时
  - total_tokens_used: 估算 token 数
  - stop_reason: 完成原因

输出(SelfEvalResult):
  {
    "score": 0.0-1.0,
    "strengths": ["优势1", "优势2"],
    "improvements": ["改进点1", "改进点2"],
    "failureMode": "失败模式(可空)",
    "lesson": "可复用经验(可空)"
  }

降级策略:
1. LLM 调用失败 → 按 stop_reason 简单打分(error=0.0, max_iterations=0.4, completed=0.7)。
2. 任务 trace 为空 → 返回默认评分 0.5。
3. 任何异常 → 返回默认评分,不阻塞主流程。

类型契约对齐 packages/types/src/agent-runtime.ts 的 SelfEvalResult(本任务新增类型)。
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# LLM 输入 trace 截断(防 token 爆炸)
_MAX_TRACE_CHARS = 4000

# 默认评分(降级时使用)
_DEFAULT_SCORE = 0.5


class SelfEvaluator:
    """自评器:任务执行后 LLM 自评得分 + 优势 + 改进点 + 失败模式 + 教训。"""

    async def evaluate(
        self, task_result: dict[str, Any], task_input: str = ""
    ) -> dict[str, Any]:
        """对单次任务执行结果进行自评。

        Args:
            task_result: AgentLoopResult 字典
                (success/iterations/final_response/total_duration_ms/
                 total_tokens_used/stop_reason)
            task_input: 任务输入(用户 query 或任务描述,可选)

        Returns:
            SelfEvalResult 字典
            (score/strengths/improvements/failureMode/lesson)
        """
        # trace 为空 → 默认评分
        if not task_result:
            return self._default_eval("空任务结果")

        # 优先 LLM 自评
        eval_result = await self._llm_evaluate(task_result, task_input)
        if eval_result:
            return eval_result

        # 降级:按 stop_reason 简单打分
        return self._fallback_evaluate(task_result)

    # ==================================================================
    # LLM 自评(优先)
    # ==================================================================

    async def _llm_evaluate(
        self, task_result: dict[str, Any], task_input: str
    ) -> dict[str, Any] | None:
        """调 LLM 自评任务表现。失败返回 None。"""
        trace_text = self._format_trace_for_llm(task_result)
        if not trace_text:
            return None

        prompt_messages = [
            {
                "role": "system",
                "content": (
                    "你是 Agent 自评专家。基于任务输入和执行 trace,评估 Agent 表现。\n"
                    "约束:\n"
                    "1. score 是 0.0-1.0 浮点数(1.0 完美,0.5 中等,0.0 失败)。\n"
                    "2. strengths 和 improvements 各列 1-3 条(具体可执行)。\n"
                    "3. failureMode 仅在识别出失败模式时填,否则为 null。\n"
                    "4. lesson 是本次任务的可复用经验(≤ 100 字),无则 null。\n"
                    "输出纯 JSON(不要 markdown 包裹):\n"
                    '{"score": 0.0, "strengths": ["..."], , "improvements": ["..."], '
                    '"failureMode": null, "lesson": null}'
                ),
            },
            {
                "role": "user",
                "content": (
                    f"任务输入:\n{task_input[:500]}\n\n"
                    f"执行 trace:\n{trace_text}"
                ),
            },
        ]

        try:
            from ..core.llm_gateway import llm_gateway

            resp = await llm_gateway.complete(prompt_messages)
            content = str(resp.get("content", "")) if isinstance(resp, dict) else ""
        except Exception as e:
            logger.warning(
                "[self_evaluator] LLM 调用失败(降级规则打分): %s: %s",
                type(e).__name__,
                e,
            )
            return None

        return self._parse_llm_output(content)

    @staticmethod
    def _format_trace_for_llm(task_result: dict[str, Any]) -> str:
        """格式化任务 trace 为 LLM 可读文本(控制 token ≤ 4000 字符)。

        空 task_result 返回空字符串,让上层 _llm_evaluate 走降级路径。
        """
        if not task_result:
            return ""
        lines: list[str] = []
        success = task_result.get("success", False)
        stop_reason = str(task_result.get("stop_reason", "unknown"))
        final_resp = str(task_result.get("final_response", ""))[:500]
        total_ms = float(task_result.get("total_duration_ms", 0) or 0)
        tokens = int(task_result.get("total_tokens_used", 0) or 0)
        iterations = task_result.get("iterations", []) or []

        lines.append(
            f"success={success} stop_reason={stop_reason} "
            f"duration_ms={total_ms:.0f} tokens={tokens} iterations={len(iterations)}"
        )
        if final_resp:
            lines.append(f"final_response: {final_resp}")

        # 每轮迭代摘(只取 reasoning 前 1000 字 + tool_calls 名 + 是否 error)
        for idx, it in enumerate(iterations[:5]):  # 最多 5 轮
            reasoning = str(it.get("reasoning", ""))[:1000] if isinstance(it, dict) else ""
            tool_calls = it.get("tool_calls", []) if isinstance(it, dict) else []
            tool_names = [
                str(tc.get("name", "")) for tc in tool_calls if isinstance(tc, dict)
            ]
            tool_results = it.get("tool_results", []) if isinstance(it, dict) else []
            errors = [
                str(tr.get("error"))
                for tr in tool_results
                if isinstance(tr, dict) and tr.get("error")
            ]
            line = f"[{idx}] reasoning={reasoning}"
            if tool_names:
                line += f" tools={','.join(tool_names)}"
            if errors:
                line += f" errors={errors[:2]}"
            lines.append(line)

        text = "\n".join(lines)
        if len(text) > _MAX_TRACE_CHARS:
            text = text[:_MAX_TRACE_CHARS - 20] + "\n...(已截断)"
        return text

    @staticmethod
    def _parse_llm_output(content: str) -> dict[str, Any] | None:
        """解析 LLM 输出为 SelfEvalResult(容错)。"""
        if not content:
            return None
        # 剥离 markdown
        cleaned = re.sub(r"```(?:json)?\s*", "", content).strip()
        # 提取最外层 {...}
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            return None
        try:
            obj = json.loads(match.group())
        except (json.JSONDecodeError, TypeError):
            return None
        if not isinstance(obj, dict):
            return None

        # 字段类型转换 + 默认值兜底
        try:
            score = float(obj.get("score", _DEFAULT_SCORE))
        except (TypeError, ValueError):
            score = _DEFAULT_SCORE
        # score 限制在 [0, 1]
        score = max(0.0, min(1.0, score))

        strengths = obj.get("strengths", []) or []
        if not isinstance(strengths, list):
            strengths = []
        strengths = [str(s) for s in strengths][:5]

        improvements = obj.get("improvements", []) or []
        if not isinstance(improvements, list):
            improvements = []
        improvements = [str(s) for s in improvements][:5]

        failure_mode = obj.get("failureMode")
        if failure_mode is not None:
            failure_mode = str(failure_mode)[:200] if failure_mode else None

        lesson = obj.get("lesson")
        if lesson is not None:
            lesson = str(lesson)[:200] if lesson else None

        return {
            "score": score,
            "strengths": strengths,
            "improvements": improvements,
            "failureMode": failure_mode,
            "lesson": lesson,
        }

    # ==================================================================
    # 降级:按 stop_reason 简单打分
    # ==================================================================

    @staticmethod
    def _fallback_evaluate(task_result: dict[str, Any]) -> dict[str, Any]:
        """LLM 失败降级:按 stop_reason 简单打分。"""
        stop_reason = str(task_result.get("stop_reason", "completed"))
        success = bool(task_result.get("success", False))

        # 评分规则:成功完成 0.7-0.9,失败 0.0-0.4
        if success and stop_reason == "completed":
            score = 0.8
            improvements = ["建议 LLM 自评获取更详细改进点(当前为降级评分)"]
        elif stop_reason == "max_iterations":
            score = 0.4
            improvements = ["达到最大迭代数,建议增加 max_iterations 或优化任务拆解"]
        elif stop_reason == "error":
            score = 0.2
            improvements = [f"执行错误: {task_result.get('error', 'unknown')}"]
        elif stop_reason in ("paused", "cancelled"):
            score = 0.3
            improvements = [f"任务被 {stop_reason},建议检查中断原因"]
        else:
            score = _DEFAULT_SCORE
            improvements = ["未知 stop_reason,建议 LLM 自评细化"]

        # 成功但有 error 也算降级
        if not success and stop_reason == "completed":
            score = min(score, 0.5)

        return {
            "score": score,
            "strengths": [],
            "improvements": improvements,
            "failureMode": None if success else f"stop_reason={stop_reason}",
            "lesson": None,
        }

    @staticmethod
    def _default_eval(reason: str) -> dict[str, Any]:
        """空输入兜底:返回默认评分。"""
        return {
            "score": _DEFAULT_SCORE,
            "strengths": [],
            "improvements": [f"任务结果为空({reason}),无法评估"],
            "failureMode": None,
            "lesson": None,
        }


# 单例
self_evaluator = SelfEvaluator()
