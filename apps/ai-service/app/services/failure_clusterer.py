"""失败案例聚类器(L4-1,2026-07-25 立,对标 Hermes Agent 失败模式挖掘)。

输入跨 skill 的失败案例(skill_feedback_tracker 收集的 SkillUsageFeedback 中 success=False 的记录),
用 LLM 把相似失败案例聚类成 failure_patterns(类别 + 描述 + 案例集合)。

输出结构(FailurePattern):
  {
    "patternId": "fp_xxx",          # 聚类内部 ID(MetaLearner 落盘时换成 UUID)
    "category": "prompt_ambiguity",  # 类别:prompt_ambiguity / tool_misuse /
                                    #       output_format / context_loss / timeout / other
    "title": "短标题(≤ 50 字)",
    "description": "模式描述(症状 + 根因 + 触发条件,≤ 200 字)",
    "sourceSkills": ["skill-a", "skill-b"],  # 来源 skill 名集合
    "caseCount": 3,                 # 案例条数
    "exampleCases": [{"skillName": "...", "failureReason": "..."}],  # 代表性案例 ≤ 3 条
    "suggestedFix": "建议修复方向(供 MetaLearner 抽取 lesson)"
  }

降级策略:
1. LLM 调用失败 → 退化为按 failureReason 关键词分桶(简单 regex 分类)。
2. 失败案例 < min_cases → 返回空列表(不聚类)。
3. 任何异常 → 返回空列表,不阻塞 MetaLearner 主流程。

类型契约对齐 packages/types/src/agent-runtime.ts 的 FailurePattern(本任务新增类型)。
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# 触发聚类的最小失败案例数(< 此值返回空,避免单条失败误聚类)
_MIN_CASES_FOR_CLUSTERING = 3

# LLM 一次最多处理的失败案例数(控制 token,超出截断)
_MAX_CASES_PER_LLM_CALL = 30

# 关键词降级分类规则(按优先级匹配,首中即归类)
_KEYWORD_RULES: list[tuple[str, str]] = [
    ("timeout", "timeout"),
    ("timed out", "timeout"),
    ("超时", "timeout"),
    ("rate limit", "rate_limit"),
    ("429", "rate_limit"),
    ("限流", "rate_limit"),
    ("format", "output_format"),
    ("格式", "output_format"),
    ("json", "output_format"),
    ("parse", "output_format"),
    ("解析", "output_format"),
    ("not found", "tool_misuse"),
    ("404", "tool_misuse"),
    ("未找到", "tool_misuse"),
    ("ambiguity", "prompt_ambiguity"),
    ("歧义", "prompt_ambiguity"),
    ("模糊", "prompt_ambiguity"),
    ("context", "context_loss"),
    ("上下文", "context_loss"),
    ("丢失", "context_loss"),
]


class FailureClusterer:
    """失败案例聚类器:把跨 skill 的失败案例聚类成 failure_patterns。"""

    async def cluster(
        self, failure_cases: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """聚类失败案例。

        Args:
            failure_cases: 跨 skill 的失败案例列表(每条含 skillName/failureReason/usedAt)。

        Returns:
            failure_patterns 列表(按 caseCount 倒序)。
        """
        if len(failure_cases) < _MIN_CASES_FOR_CLUSTERING:
            return []

        # 优先 LLM 聚类
        patterns = await self._llm_cluster(failure_cases)
        if patterns:
            return patterns

        # 降级:关键词分桶
        return self._fallback_cluster(failure_cases)

    # ==================================================================
    # LLM 聚类(优先)
    # ==================================================================

    async def _llm_cluster(
        self, failure_cases: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """调 LLM 聚类失败案例。失败返回空列表。"""
        # 截断控制 token
        cases_for_llm = failure_cases[:_MAX_CASES_PER_LLM_CALL]
        cases_text = self._format_cases_for_llm(cases_for_llm)
        if not cases_text:
            return []

        prompt_messages = [
            {
                "role": "system",
                "content": (
                    "你是失败模式分析专家。基于跨 skill 的失败案例,聚类出共性失败模式。\n"
                    "约束:\n"
                    "1. 案例数 < 3 个的类别不输出(避免单条误聚类)。\n"
                    "2. category 必须是以下枚举之一:\n"
                    "   prompt_ambiguity / tool_misuse / output_format / context_loss / "
                    "timeout / rate_limit / other\n"
                    "3. exampleCases 最多 3 条代表性案例(优先选不同 skill 的)。\n"
                    "4. suggestedFix 给出具体可执行的修复方向(2-3 句)。\n"
                    "5. 总模式数控制在 1-5 个,按 caseCount 倒序输出。\n"
                    "输出纯 JSON 数组(不要 markdown 包裹),每条结构:\n"
                    '{"category": "枚举值", "title": "短标题", '
                    '"description": "症状+根因+触发条件", '
                    '"sourceSkills": ["skill-a"], '
                    '"caseCount": 3, '
                    '"exampleCases": [{"skillName": "...", "failureReason": "..."}], '
                    '"suggestedFix": "建议修复方向"}'
                ),
            },
            {
                "role": "user",
                "content": f"失败案例({len(cases_for_llm)} 条):\n{cases_text}",
            },
        ]

        try:
            from ..core.llm_gateway import llm_gateway

            resp = await llm_gateway.complete(prompt_messages)
            content = str(resp.get("content", "")) if isinstance(resp, dict) else ""
        except Exception as e:
            logger.warning(
                "[failure_clusterer] LLM 调用失败(降级关键词分桶): %s: %s",
                type(e).__name__,
                e,
            )
            return []

        return self._parse_llm_output(content, cases_for_llm)

    @staticmethod
    def _format_cases_for_llm(cases: list[dict[str, Any]]) -> str:
        """格式化失败案例为 LLM 可读文本(每条单行 + 序号)。"""
        lines: list[str] = []
        for idx, case in enumerate(cases):
            skill = str(case.get("skillName", "unknown"))
            reason = str(case.get("failureReason", "")).strip() or "(no reason)"
            # 单条 reason 截断 200 字符
            if len(reason) > 200:
                reason = reason[:197] + "..."
            lines.append(f"[{idx}] skill={skill} reason={reason}")
        return "\n".join(lines)

    @staticmethod
    def _parse_llm_output(
        content: str, original_cases: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """解析 LLM 输出为 failure_patterns 列表(容错)。

        容错策略:
        1. 剥离 markdown 代码块包裹
        2. 提取最外层 [..]
        3. 字段类型转换 + 默认值兜底
        4. patternId 用内部序号生成(后续 MetaLearner 落盘换 UUID)
        """
        if not content:
            return []
        # 剥离 markdown
        cleaned = re.sub(r"```(?:json)?\s*", "", content).strip()
        # 提取最外层 [..]
        arr_match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if not arr_match:
            return []
        try:
            arr = json.loads(arr_match.group())
        except (json.JSONDecodeError, TypeError):
            return []
        if not isinstance(arr, list):
            return []

        valid_categories = {
            "prompt_ambiguity",
            "tool_misuse",
            "output_format",
            "context_loss",
            "timeout",
            "rate_limit",
            "other",
        }

        patterns: list[dict[str, Any]] = []
        for idx, item in enumerate(arr):
            if not isinstance(item, dict):
                continue
            category = str(item.get("category", "other")).strip().lower()
            if category not in valid_categories:
                category = "other"
            case_count = int(item.get("caseCount", 0) or 0)
            if case_count < _MIN_CASES_FOR_CLUSTERING:
                # LLM 误聚类(< 3 案例也输出),过滤
                continue
            source_skills = item.get("sourceSkills", []) or []
            if not isinstance(source_skills, list):
                source_skills = []
            example_cases = item.get("exampleCases", []) or []
            if not isinstance(example_cases, list):
                example_cases = []
            # 截断 exampleCases ≤ 3
            example_cases = example_cases[:3]
            patterns.append({
                "patternId": f"fp_{idx + 1}",
                "category": category,
                "title": str(item.get("title", ""))[:80],
                "description": str(item.get("description", ""))[:500],
                "sourceSkills": [str(s) for s in source_skills],
                "caseCount": case_count,
                "exampleCases": example_cases,
                "suggestedFix": str(item.get("suggestedFix", ""))[:500],
            })

        # 按 caseCount 倒序
        patterns.sort(key=lambda p: p["caseCount"], reverse=True)
        return patterns

    # ==================================================================
    # 降级:关键词分桶
    # ==================================================================

    @staticmethod
    def _fallback_cluster(
        failure_cases: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """LLM 失败降级:按 failureReason 关键词分桶成简单 failure_patterns。

        每个匹配到的关键词类目成一个 pattern,内部案例数 ≥ 3 才输出。
        """
        # 关键词 → 案例列表
        buckets: dict[str, list[dict[str, Any]]] = {}
        for case in failure_cases:
            reason = str(case.get("failureReason", "")).lower()
            matched_category = "other"
            for keyword, category in _KEYWORD_RULES:
                if keyword in reason:
                    matched_category = category
                    break
            buckets.setdefault(matched_category, []).append(case)

        category_labels = {
            "timeout": "执行超时",
            "rate_limit": "速率限制",
            "output_format": "输出格式错误",
            "tool_misuse": "工具调用错误",
            "prompt_ambiguity": "提示歧义",
            "context_loss": "上下文丢失",
            "other": "其他失败",
        }

        patterns: list[dict[str, Any]] = []
        for category, cases in buckets.items():
            if len(cases) < _MIN_CASES_FOR_CLUSTERING:
                continue
            source_skills = sorted({
                str(c.get("skillName", "")) for c in cases if c.get("skillName")
            })
            # 取最近 3 条作为 exampleCases(列表尾部为最新)
            example_cases = [
                {
                    "skillName": str(c.get("skillName", "")),
                    "failureReason": str(c.get("failureReason", ""))[:200],
                }
                for c in cases[-3:]
            ]
            patterns.append({
                "patternId": f"fp_{category}",
                "category": category,
                "title": f"{category_labels.get(category, category)}({len(cases)} 次)",
                "description": (
                    f"跨 skill 出现 {len(cases)} 次同类失败,"
                    f"涉及 {len(source_skills)} 个 skill,关键词分类: {category}"
                )[:500],
                "sourceSkills": source_skills,
                "caseCount": len(cases),
                "exampleCases": example_cases,
                "suggestedFix": f"建议优先排查 {category_labels.get(category, category)} 类失败的共性根因",
            })

        patterns.sort(key=lambda p: p["caseCount"], reverse=True)
        return patterns


# 单例
failure_clusterer = FailureClusterer()
