"""预置 Skill 集合。

6 个预置 skill: code-review / debug-fix / test-generator / doc-writer /
refactor-helper / api-designer。每个 skill 包含 name/description/prompt_template。
新增:SkillEvolutionService(任务后 LLM 自评→自动生成 SKILL.md)+ SkillRegistry 自动加载 auto 目录。
P3-2 扩展:SkillEvolutionService.evaluate 增加自动测试 + 质量门(通过率 < 0.6 拒绝落盘)+
落盘后初始化反馈追踪;新增 SkillEvolutionLoop 整合完整闭环
(生成→测试→落盘→反馈追踪→迭代优化)。
"""

import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class Skill:
    """预置 Skill 定义。"""

    name: str
    description: str
    prompt_template: str

    def render(self, variables: dict[str, Any] | None = None) -> str:
        """使用 variables 渲染 prompt_template(简单 {key} 替换)。"""
        template = self.prompt_template
        if variables:
            for key, value in variables.items():
                template = template.replace("{" + key + "}", str(value))
        return template


# 6 个预置 skill
_BUILTIN_SKILLS: list[Skill] = [
    Skill(
        name="code-review",
        description="代码审查: 检查代码质量、潜在 bug、最佳实践",
        prompt_template=(
            "请对以下 {language} 代码进行审查,关注:\n"
            "1. 代码质量与可读性\n"
            "2. 潜在 bug 与安全问题\n"
            "3. 性能与最佳实践\n\n"
            "代码:\n```\n{code}\n```"
        ),
    ),
    Skill(
        name="debug-fix",
        description="调试修复: 根据错误信息定位并修复 bug",
        prompt_template=(
            "请根据以下错误信息定位并修复 {language} 代码中的 bug:\n\n"
            "错误信息:\n{error}\n\n"
            "代码:\n```\n{code}\n```\n\n"
            "请给出: 1) 根因分析 2) 修复方案 3) 修复后的完整代码"
        ),
    ),
    Skill(
        name="test-generator",
        description="测试生成: 为代码自动生成单元测试",
        prompt_template=(
            "请为以下 {language} 代码生成 {framework} 单元测试:\n\n"
            "```\n{code}\n```\n\n"
            "要求: 覆盖正常路径、边界条件、异常情况"
        ),
    ),
    Skill(
        name="doc-writer",
        description="文档撰写: 为代码生成文档与注释",
        prompt_template=(
            "请为以下 {language} 代码撰写文档:\n\n"
            "```\n{code}\n```\n\n"
            "输出: 模块说明、函数文档字符串、使用示例"
        ),
    ),
    Skill(
        name="refactor-helper",
        description="重构辅助: 优化代码结构而不改变行为",
        prompt_template=(
            "请重构以下 {language} 代码,保持行为不变:\n\n"
            "```\n{code}\n```\n\n"
            "目标: 提升可读性、降低复杂度、消除重复"
        ),
    ),
    Skill(
        name="api-designer",
        description="API 设计: 根据需求设计 RESTful API",
        prompt_template=(
            "请根据以下需求设计 RESTful API:\n\n"
            "需求: {requirements}\n\n"
            "输出: 端点列表、请求/响应 schema、状态码、示例"
        ),
    ),
]


class SkillRegistry:
    """Skill 注册表,管理预置 skill + auto 目录自进化 skill 的查询。"""

    def __init__(self) -> None:
        self._skills: dict[str, Skill] = {s.name: s for s in _BUILTIN_SKILLS}
        self._load_auto_skills()

    @staticmethod
    def _auto_dir() -> str:
        """auto skill 目录绝对路径(app/skills/auto)。"""
        return os.path.join(os.path.dirname(__file__), "..", "skills", "auto")

    @staticmethod
    def _parse_skill_md(content: str) -> tuple[str, str, str]:
        """解析 SKILL.md frontmatter + 正文,返回 (name, description, instructions)。"""
        if not content.startswith("---"):
            return "", "", content
        match = re.match(r"^---\n(.*?)\n---\n?(.*)$", content, re.DOTALL)
        if not match:
            return "", "", content
        frontmatter, body = match.group(1), match.group(2)
        name = desc = ""
        for line in frontmatter.split("\n"):
            if line.startswith("name:"):
                name = line.split(":", 1)[1].strip()
            elif line.startswith("description:"):
                desc = line.split(":", 1)[1].strip()
        return name, desc, body

    def _load_auto_skills(self) -> None:
        """扫描 app/skills/auto/*.md 并注册(自进化生成的 skill)。"""
        auto_dir = self._auto_dir()
        if not os.path.isdir(auto_dir):
            return
        for fname in os.listdir(auto_dir):
            if not fname.endswith(".md"):
                continue
            try:
                with open(os.path.join(auto_dir, fname), "r", encoding="utf-8") as f:
                    content = f.read()
                name, desc, instructions = self._parse_skill_md(content)
                if name:
                    self._skills[name] = Skill(
                        name=name, description=desc, prompt_template=instructions
                    )
            except Exception:
                continue

    def reload_auto(self) -> None:
        """重新加载 auto 目录(自进化写入新 skill 后调用)。"""
        self._load_auto_skills()

    def list(self) -> list[Skill]:
        """列出全部 skill。"""
        return list(self._skills.values())

    def get(self, name: str) -> Skill | None:
        """按名称获取 skill,不存在返回 None。"""
        return self._skills.get(name)

    def exists(self, name: str) -> bool:
        """判断 skill 是否存在。"""
        return name in self._skills


skill_registry = SkillRegistry()


class SkillEvolutionService:
    """Skill 自进化服务:任务结束后 LLM 自评是否提炼可复用模式。

    对标 Hermes Agent 的任务后自评机制:把 goal/steps/finalResult 喂给 LLM,
    判断是否值得沉淀为 SKILL.md,值得则在 app/skills/auto/ 落盘并刷新注册表。
    """

    @staticmethod
    def _build_eval_prompt(request: dict) -> list[dict[str, Any]]:
        """构建评估 prompt(明确约束:仅可复用模式才生成,kebab-case 命名)。"""
        goal = request.get("goal", "")
        steps = request.get("steps", [])
        final_result = request.get("finalResult", "")
        existing = request.get("existingSkills", [])
        steps_text = json.dumps(steps, ensure_ascii=False, default=str)[:4000]
        return [
            {
                "role": "system",
                "content": (
                    "你是 Skill 评估专家。分析任务执行记录,判断是否值得沉淀为可复用的 Skill。\n"
                    "约束:\n"
                    "1. 只在任务确实包含可复用模式时才生成 skill,不要为一次性任务生成。\n"
                    "2. skill 名用 kebab-case(如 batch-fix-ts-errors)。\n"
                    "3. 描述 ≤ 1024 字符。\n"
                    "4. skillContent 是 SKILL.md 正文 Instructions 部分(可执行步骤)。\n"
                    "返回纯 JSON(不要 markdown 包裹):\n"
                    '{"shouldCreate": bool, "skillName": "kebab-case", '
                    '"skillContent": "Instructions 正文", "reason": "理由", '
                    '"relatedSkills": ["相关 skill 名"]}'
                ),
            },
            {
                "role": "user",
                "content": (
                    f"任务目标: {goal}\n\n"
                    f"执行步骤: {steps_text}\n\n"
                    f"最终结果: {str(final_result)[:2000]}\n\n"
                    f"已有 Skills: {json.dumps(existing, ensure_ascii=False)}"
                ),
            },
        ]

    async def evaluate(self, request: dict) -> dict:
        """评估任务是否值得沉淀为 skill。

        Args:
            request: SkillEvolutionRequest 字典
                (taskId/sessionId/goal/steps/finalResult/existingSkills)。

        Returns:
            SkillEvolutionResult 字典
            (shouldCreate/skillName/skillContent/reason/relatedSkills)。
        """
        # 局部导入避免 skill_registry 初始化时拉入重依赖
        from ..core.llm_gateway import llm_gateway

        messages = self._build_eval_prompt(request)
        result = await llm_gateway.complete(messages)
        content = str(result.get("content", ""))

        parsed = self._parse_eval_output(content)
        if not parsed.get("shouldCreate"):
            return parsed

        skill_name = parsed.get("skillName", "").strip()
        if not skill_name:
            parsed["shouldCreate"] = False
            parsed["reason"] = parsed.get("reason", "") + " [skillName 为空,未落盘]"
            return parsed

        # P3-2:自动测试 + 质量门(通过率 < 0.6 拒绝落盘)
        skill_content = parsed.get("skillContent", "")
        test_result = await self._run_quality_gate(skill_name, skill_content)
        parsed["testResult"] = test_result
        # 局部导入避免模块加载时循环依赖
        from .skill_tester import SkillTester

        if float(test_result.get("passRate", 0.0)) < SkillTester.QUALITY_GATE_PASS_RATE:
            parsed["shouldCreate"] = False
            parsed["reason"] = (
                parsed.get("reason", "")
                + f" [质量门未通过:通过率 {test_result.get('passRate', 0.0):.2f}"
                f" < {SkillTester.QUALITY_GATE_PASS_RATE}]"
            )
            return parsed

        # 写入 app/skills/auto/<skillName>.md
        try:
            auto_dir = SkillRegistry._auto_dir()
            os.makedirs(auto_dir, exist_ok=True)
            md = self._render_skill_md(
                skill_name=skill_name,
                description=parsed.get("reason", "")[:1024],
                instructions=parsed.get("skillContent", ""),
                task_id=str(request.get("taskId", "")),
                related=parsed.get("relatedSkills", []),
            )
            with open(os.path.join(auto_dir, f"{skill_name}.md"), "w", encoding="utf-8") as f:
                f.write(md)
            skill_registry.reload_auto()
            # P3-2:落盘后初始化反馈追踪(SkillFeedbackTracker 单例,空统计,
            # 等待首次使用记录;get_stats 对未知 skill 返回零值统计)
        except Exception as e:
            parsed["shouldCreate"] = False
            parsed["reason"] = parsed.get("reason", "") + f" [落盘失败: {e}]"
        return parsed

    async def _run_quality_gate(
        self, skill_name: str, skill_content: str
    ) -> dict:
        """P3-2:生成测试用例 + 执行测试,返回 SkillTestResult。

        降级:LLM 失败或异常返回 passRate=0 的空结果(触发质量门拒绝)。
        """
        from .skill_tester import skill_tester

        try:
            test_cases = await skill_tester.generate_test_cases(skill_name, skill_content)
            return await skill_tester.run_test({
                "skillName": skill_name,
                "skillContent": skill_content,
                "testCases": test_cases,
            })
        except Exception as e:
            return {
                "skillName": skill_name,
                "results": [],
                "passed": 0,
                "total": 0,
                "passRate": 0.0,
                "totalDurationMs": 0,
                "allPassed": False,
                "error": str(e)[:200],
            }

    @staticmethod
    def _parse_eval_output(content: str) -> dict:
        """解析 LLM 评估输出为 SkillEvolutionResult 字典(容错)。"""
        # 优先提取 JSON 对象(兼容 ```json 包裹与裸 JSON)
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            try:
                obj = json.loads(match.group())
                if isinstance(obj, dict):
                    return {
                        "shouldCreate": bool(obj.get("shouldCreate", False)),
                        "skillName": str(obj.get("skillName", "")),
                        "skillContent": str(obj.get("skillContent", "")),
                        "reason": str(obj.get("reason", "")),
                        "relatedSkills": list(obj.get("relatedSkills", []) or []),
                    }
            except (json.JSONDecodeError, TypeError):
                pass
        return {
            "shouldCreate": False,
            "skillName": "",
            "skillContent": "",
            "reason": "LLM 输出无法解析为 JSON",
            "relatedSkills": [],
        }

    @staticmethod
    def _render_skill_md(
        skill_name: str,
        description: str,
        instructions: str,
        task_id: str,
        related: list[str],
    ) -> str:
        """渲染 SKILL.md(frontmatter 对齐 packages/types SkillFrontmatter)。"""
        related_str = json.dumps(related, ensure_ascii=False) if related else "[]"
        return (
            "---\n"
            f"name: {skill_name}\n"
            f"description: {description[:1024]}\n"
            "version: 1.0.0\n"
            "license: MIT\n"
            "source: auto\n"
            f"autoGeneratedAt: {datetime.now(timezone.utc).isoformat()}\n"
            f"autoGeneratedFromTask: {task_id}\n"
            f"relatedSkills: {related_str}\n"
            "---\n\n"
            f"# Instructions\n\n{instructions}\n"
        )


skill_evolution_service = SkillEvolutionService()


class SkillEvolutionLoop:
    """Skill 自进化闭环(P3-2):生成 → 测试 → 落盘 → 反馈追踪 → 迭代优化。

    对标 Hermes Agent 的 Skill 生成后自动测试 + 使用反馈追踪 +
    基于反馈迭代优化 + 评分系统,整合 SkillEvolutionService /
    SkillTester / SkillFeedbackTracker / SkillIterator 四组件。
    """

    async def evolve(self, request: dict) -> dict:
        """完整闭环:生成 skill → 自动测试 → 质量门落盘 → 初始化反馈追踪。

        Args:
            request: SkillEvolutionRequest 字典
                (taskId/sessionId/goal/steps/finalResult/existingSkills)。

        Returns:
            SkillEvolutionResult 字典(含 testResult 字段记录质量门结果)。
            shouldCreate=true 表示通过质量门并已落盘。
        """
        # 1+2+3+4:SkillEvolutionService.evaluate 已整合
        # 生成 → 自动测试 → 质量门(通过率 < 0.6 拒绝)→ 落盘 → 反馈追踪初始化
        return await skill_evolution_service.evaluate(request)

    async def iterate_on_feedback(self, skill_name: str) -> dict:
        """基于使用反馈迭代优化 skill。

        流程:
        1. 读取 skill 内容 + 使用统计 + 失败案例
        2. 跑当前测试获取基线 passRate
        3. 调 SkillIterator.iterate 生成新版本(内部含写回 + 测试验证 + 回滚)

        Args:
            skill_name: skill 名。

        Returns:
            SkillIterationResult 字典
            (shouldIterate/newVersion?/newContent?/reason/expectedImprovements)。
        """
        # 局部导入避免模块加载时循环依赖
        from .skill_tester import skill_tester
        from .skill_feedback import skill_feedback_tracker
        from .skill_iterator import skill_iterator

        # 1. 读取 skill 内容
        skill = skill_registry.get(skill_name)
        if not skill:
            return {
                "shouldIterate": False,
                "reason": f"skill 不存在: {skill_name}",
                "expectedImprovements": [],
            }
        current_content = skill.prompt_template

        # 2. 读取使用统计 + 失败案例
        usage_stats = await skill_feedback_tracker.get_stats(skill_name)
        failure_cases = await skill_feedback_tracker.get_failure_cases(skill_name)

        # 3. 跑当前测试获取基线
        try:
            test_cases = await skill_tester.generate_test_cases(
                skill_name, current_content
            )
            baseline_test = await skill_tester.run_test({
                "skillName": skill_name,
                "skillContent": current_content,
                "testCases": test_cases,
            })
        except Exception as e:
            return {
                "shouldIterate": False,
                "reason": f"基线测试失败: {type(e).__name__}: {str(e)[:200]}",
                "expectedImprovements": [],
            }

        # 4. 调 SkillIterator.iterate(内部:生成新版本 → 写回 → 测试验证 →
        #    通过率提升则保留,否则回滚)
        return await skill_iterator.iterate({
            "skillName": skill_name,
            "currentContent": current_content,
            "usageStats": usage_stats,
            "failureCases": failure_cases,
            "currentTestResult": baseline_test,
        })


skill_evolution_loop = SkillEvolutionLoop()
