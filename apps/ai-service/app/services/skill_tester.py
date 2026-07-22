"""Skill 自动测试器(P3-2,对标 Hermes Agent Skill 生成后自动测试)。

LLM 生成 3-5 个测试用例 → 用 skill 作为 system prompt 执行 → 比对期望 pattern
→ 汇总通过率。类型契约对齐 packages/types/src/agent-runtime.ts 的
SkillTestCase / SkillTestRequest / SkillTestResult / SkillTestCaseResult。
"""

import asyncio
import json
import logging
import re
import time
from typing import Any

from ..core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)


class SkillTester:
    """Skill 自动测试器:生成用例 + 执行 + 评估通过率。"""

    # 质量门:通过率低于此值拒绝落盘(由 SkillEvolutionLoop 使用)
    QUALITY_GATE_PASS_RATE = 0.6

    @staticmethod
    def _build_gen_prompt(skill_name: str, skill_content: str) -> list[dict[str, Any]]:
        """构建生成测试用例的 prompt(3-5 个用例,覆盖正常/边界/异常)。"""
        return [
            {
                "role": "system",
                "content": (
                    "你是 Skill 测试用例生成专家。基于 skill 内容生成 3-5 个测试用例,"
                    "覆盖正常路径 / 边界条件 / 异常情况。\n"
                    "约束:\n"
                    "1. 每个用例含 name/input/expectedPattern/isRegex。\n"
                    "2. expectedPattern 是关键词(子串匹配,isRegex=false)或正则(isRegex=true)。\n"
                    "3. 用例应能区分 skill 输出质量(坏输出应不匹配)。\n"
                    "4. input 模拟真实调用场景,不要写 'test' 这种无意义输入。\n"
                    "返回纯 JSON(不要 markdown 包裹):\n"
                    '{"testCases": [{"name": "...", "input": "...", '
                    '"expectedPattern": "...", "isRegex": false}]}'
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Skill 名: {skill_name}\n\n"
                    f"Skill 内容:\n{skill_content[:4000]}"
                ),
            },
        ]

    async def generate_test_cases(
        self, skill_name: str, skill_content: str
    ) -> list[dict[str, Any]]:
        """LLM 生成 3-5 个测试用例(SkillTestCase 列表)。

        LLM 调用失败或解析失败时降级为单个兜底 smoke 用例(空 expectedPattern)。
        """
        messages = self._build_gen_prompt(skill_name, skill_content)
        try:
            result = await llm_gateway.complete(messages)
            content = str(result.get("content", ""))
            cases = self._parse_test_cases(content)
            if cases:
                return cases
        except Exception as e:
            logger.warning("生成测试用例失败(skill=%s): %s", skill_name, e)
        # 兜底:单个 smoke 用例(确保结构完整,通过率由实际输出决定)
        return [{
            "name": "smoke-test",
            "input": "请按 skill 指令执行。",
            "expectedPattern": "",
            "isRegex": False,
        }]

    @staticmethod
    def _parse_test_cases(content: str) -> list[dict[str, Any]]:
        """解析 LLM 输出为测试用例列表(容错,兼容 ```json 包裹)。"""
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if not match:
            return []
        try:
            obj = json.loads(match.group())
            raw_cases = obj.get("testCases", []) if isinstance(obj, dict) else []
        except (json.JSONDecodeError, TypeError):
            return []
        cases: list[dict[str, Any]] = []
        for c in raw_cases:
            if not isinstance(c, dict):
                continue
            name = str(c.get("name", "")).strip()
            inp = str(c.get("input", ""))
            if not name or not inp:
                continue
            cases.append({
                "name": name,
                "input": inp,
                "expectedPattern": str(c.get("expectedPattern", "")),
                "isRegex": bool(c.get("isRegex", False)),
            })
        return cases

    async def run_test(self, request: dict[str, Any]) -> dict[str, Any]:
        """执行测试,返回 SkillTestResult。

        Args:
            request: SkillTestRequest 字典
                (skillName/skillContent/testCases/timeoutSeconds?)。

        Returns:
            SkillTestResult 字典
            (skillName/results/passed/total/passRate/totalDurationMs/allPassed)。
        """
        skill_name = str(request.get("skillName", ""))
        skill_content = str(request.get("skillContent", ""))
        test_cases = request.get("testCases", []) or []
        timeout_seconds = int(request.get("timeoutSeconds", 30) or 30)

        results: list[dict[str, Any]] = []
        total_start = time.monotonic()
        for case in test_cases:
            if not isinstance(case, dict):
                continue
            case_result = await self._run_single(
                skill_content=skill_content,
                case=case,
                timeout_seconds=timeout_seconds,
            )
            results.append(case_result)

        total_ms = int((time.monotonic() - total_start) * 1000)
        passed = sum(1 for r in results if r.get("passed"))
        total = len(results)
        pass_rate = (passed / total) if total > 0 else 0.0
        return {
            "skillName": skill_name,
            "results": results,
            "passed": passed,
            "total": total,
            "passRate": pass_rate,
            "totalDurationMs": total_ms,
            "allPassed": total > 0 and passed == total,
        }

    async def _run_single(
        self,
        *,
        skill_content: str,
        case: dict[str, Any],
        timeout_seconds: int,
    ) -> dict[str, Any]:
        """执行单个测试用例,超时或异常标记为 failed(不抛错)。"""
        name = str(case.get("name", ""))
        inp = str(case.get("input", ""))
        pattern = str(case.get("expectedPattern", ""))
        is_regex = bool(case.get("isRegex", False))

        start = time.monotonic()
        messages = [
            {"role": "system", "content": skill_content or "你是通用助手。"},
            {"role": "user", "content": inp},
        ]
        try:
            result = await asyncio.wait_for(
                llm_gateway.complete(messages),
                timeout=timeout_seconds,
            )
        except asyncio.TimeoutError:
            return self._fail(name, "", f"超时({timeout_seconds}s)", start)
        except Exception as e:
            return self._fail(
                name, "", f"异常: {type(e).__name__}: {str(e)[:200]}", start
            )

        output = str(result.get("content", ""))
        if result.get("error"):
            return self._fail(
                name, output,
                f"LLM 错误: {str(result.get('error_message', ''))[:200]}",
                start,
            )

        duration_ms = int((time.monotonic() - start) * 1000)
        passed, reason = self._match(output, pattern, is_regex)
        case_result: dict[str, Any] = {
            "name": name,
            "actualOutput": output,
            "passed": passed,
            "durationMs": duration_ms,
        }
        if not passed:
            case_result["failureReason"] = reason
        return case_result

    @staticmethod
    def _match(
        output: str, pattern: str, is_regex: bool
    ) -> tuple[bool, str | None]:
        """比对实际输出与期望 pattern,返回 (passed, failureReason)。"""
        # 空 pattern:smoke test,只要非空输出即通过
        if not pattern:
            return (bool(output.strip()), None if output.strip() else "输出为空")
        if is_regex:
            try:
                matched = re.search(pattern, output) is not None
            except re.error as e:
                return (False, f"正则编译失败: {e}")
            return (matched, None if matched else f"正则未匹配: {pattern}")
        matched = pattern in output
        return (matched, None if matched else f"未包含关键词: {pattern}")

    @staticmethod
    def _fail(
        name: str, output: str, reason: str, start: float
    ) -> dict[str, Any]:
        """构造失败用例结果。"""
        return {
            "name": name,
            "actualOutput": output,
            "passed": False,
            "failureReason": reason,
            "durationMs": int((time.monotonic() - start) * 1000),
        }


skill_tester = SkillTester()
