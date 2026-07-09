"""预置 Skill 集合。

6 个预置 skill: code-review / debug-fix / test-generator / doc-writer /
refactor-helper / api-designer。每个 skill 包含 name/description/prompt_template。
"""

from dataclasses import dataclass
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
    """Skill 注册表,管理预置 skill 的查询。"""

    def __init__(self) -> None:
        self._skills: dict[str, Skill] = {s.name: s for s in _BUILTIN_SKILLS}

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
