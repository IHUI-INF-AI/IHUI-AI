"""预置 Skill 集合。

6 个预置 skill: code-review / debug-fix / test-generator / doc-writer /
refactor-helper / api-designer。每个 skill 包含 name/description/prompt_template。
新增:SkillEvolutionService(任务后 LLM 自评→自动生成 SKILL.md)+ SkillRegistry 自动加载 auto 目录。
P3-2 扩展:SkillEvolutionService.evaluate 增加自动测试 + 质量门(通过率 < 0.6 拒绝落盘)+
落盘后初始化反馈追踪;新增 SkillEvolutionLoop 整合完整闭环
(生成→测试→落盘→反馈追踪→迭代优化)。

2026-07-23 扩展:Skill dataclass 增加 icon/category/tags/source/sourceUrl/available
扩展字段,新增 19 个 AI Skills TOP(CODEX 自媒体 + GitHub 热门合集),供前端
SkillLibrary 弹窗 ai-skills tab 展示,10 个真集成(nuwa-skill / hugshu-design /
auto-redbook-skills / guizang-ppt-skill / superpowers / caveman / graphify /
agent-skills / awesome-claude-skills / taste-skill),其余 9 个以元数据 +
GitHub 链接占位,后续按需逐个实装。"""
from __future__ import annotations  # 2026-07-23:SkillRegistry.list() 方法名 shadow 内置 list,注解 lazy 化避免 class body 内 list[Skill] 求值失败

import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class Skill:
    """预置 Skill 定义。"""

    name: str
    description: str
    prompt_template: str
    # 2026-07-23 扩展:UI 展示 + 路由分发元数据(全部可选,默认兼容老 6 个预置 skill)
    icon: str = "sparkles"  # lucide-react 图标名(对齐 web 端)
    category: str = "code"  # code / media / ai-top
    tags: list[str] = field(default_factory=list)
    source: str = "builtin"  # builtin / auto / ai-top
    source_url: str = ""  # GitHub 链接(ai-top 类别)
    available: bool = True  # True=真集成可调用,False=元数据占位

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


# 2026-07-23 新增:19 个 AI Skills TOP(CODEX 自媒体 10 + GitHub 热门 10 - MediaCrawler 重复 = 19)
# 对应前端 SkillLibrary 弹窗 ai-skills tab,用户可选调用。
# 3 个真集成可调用(nuwa-skill / hugshu-design / guizang-ppt-skill),
# 其余 16 个以元数据 + GitHub 链接占位,available=False,后续按需逐个实装。
_AI_TOP_SKILLS: list[Skill] = [
    # ===== CODEX 自媒体必装 10 个(来源图 1)=====
    Skill(
        name="agent-reach",
        description="搜国内外多平台热点,收集素材",
        prompt_template="(元数据占位,见 ai_skills.py handler)",
        icon="search",
        category="ai-top",
        tags=["搜索", "热点", "素材"],
        source="ai-top",
        source_url="https://github.com/agent-reach/agent-reach",
        available=False,
    ),
    Skill(
        name="horizon",
        description="每天热点和趋势简报,资讯雷达",
        prompt_template="(元数据占位,见 ai_skills.py handler)",
        icon="radar",
        category="ai-top",
        tags=["趋势", "热点", "简报"],
        source="ai-top",
        source_url="https://github.com/horizon/horizon",
        available=False,
    ),
    Skill(
        name="media-crawler",
        description="采集公开内容与评论反馈(发布前后均可用)",
        prompt_template="(元数据占位,见 ai_skills.py handler)",
        icon="rss",
        category="ai-top",
        tags=["采集", "评论", "复盘"],
        source="ai-top",
        source_url="https://github.com/NanmiCoder/MediaCrawler",
        available=False,
    ),
    Skill(
        name="hugshu-design",
        description="生成 HTML、原型、可编辑 PPT、动画设计稿",
        prompt_template=(
            "你是一名资深前端设计师。请根据以下需求生成可直接渲染的 HTML 原型:\n\n"
            "需求: {requirements}\n\n"
            "输出: 完整 HTML(包含 <style> 内联),不依赖外部 CDN,移动端友好。"
        ),
        icon="layout-template",
        category="ai-top",
        tags=["设计", "HTML", "原型", "PPT"],
        source="ai-top",
        source_url="https://github.com/hugshu/hugshu-design",
        available=True,  # 真集成:llm_gateway 生成 HTML + screenshot 预览
    ),
    Skill(
        name="auto-redbook-skills",
        description="自动写小红书风格文案,长文集生成",
        prompt_template=(
            "你是一名资深小红书博主,文风活泼、emoji 适度、首句抓人。请按以下主题写一篇小红书笔记:\n\n"
            "主题: {topic}\n\n"
            "要求:\n1. 标题 ≤ 20 字,带 1-2 个 emoji\n"
            "2. 正文 200-400 字,分 3-5 段,每段 ≤3 行\n"
            "3. 结尾 3-5 个相关 hashtag\n"
            "4. 禁止 AI 味词汇(在这个时代 / 让我们一起 / 总而言之等)"
        ),
        icon="book-heart",
        category="ai-top",
        tags=["小红书", "文案", "创作"],
        source="ai-top",
        source_url="https://github.com/auto-redbook/auto-redbook-skills",
        available=True,  # 真集成:llm_gateway 风格 prompt
    ),
    Skill(
        name="generative-media-skills",
        description="图片、视频、音频生成工作流编排",
        prompt_template="(元数据占位,见 ai_skills.py handler,接 dashscope/jimeng/kling/stepfun provider)",
        icon="image-play",
        category="ai-top",
        tags=["图", "视频", "音频", "多模态"],
        source="ai-top",
        source_url="https://github.com/generative-media/generative-media-skills",
        available=False,
    ),
    Skill(
        name="nuwa-skill",
        description="图文改写,统一账号表达风格",
        prompt_template=(
            "你是一名资深内容编辑。请将以下原文改写为「{style}」风格,保持核心信息不变:\n\n"
            "原文:\n{content}\n\n"
            "要求:\n1. 保持原文字数 ±20%\n2. 使用目标风格的词汇 + 句式\n3. 禁止 AI 味词汇,文风自然有人味\n4. 输出一段式改写结果"
        ),
        icon="feather",
        category="ai-top",
        tags=["改写", "风格", "图文"],
        source="ai-top",
        source_url="https://github.com/nuwa/nuwa-skill",
        available=True,  # 真集成:llm_gateway 风格改写
    ),
    Skill(
        name="guizang-social-card-skill",
        description="生成图文卡片和封面图",
        prompt_template="(元数据占位,见 ai_skills.py handler)",
        icon="image",
        category="ai-top",
        tags=["封面", "卡片", "图文"],
        source="ai-top",
        source_url="https://github.com/guizang/guizang-social-card-skill",
        available=False,
    ),
    Skill(
        name="social-auto-upload",
        description="多平台内容自动上传(已集成 14 平台适配器,见 publish 路由)",
        prompt_template="(元数据占位,见 ai_skills.py handler)",
        icon="upload-cloud",
        category="ai-top",
        tags=["发布", "多平台", "自动"],
        source="ai-top",
        source_url="https://github.com/social-auto-upload/social-auto-upload",
        available=False,
    ),
    # ===== GitHub 本周热门 AI Skills 10 个(来源图 2)=====
    Skill(
        name="superpowers",
        description="AI 从聊天框变成可复用工作流(248k stars, Shell)",
        prompt_template=(
            "你是一名工作流设计专家。请将以下任务拆解为可执行的工作流步骤,"
            "每步明确输入、产出、依赖关系,适合直接交给 AI Agent 按序执行。\n\n"
            "任务: {task}\n\n"
            "输出 JSON 数组(不要 markdown 包裹),每步结构:\n"
            '{"step": 1, "name": "步骤名", "input": "输入", '
            '"output": "产出", "dependsOn": [前序 step 号], "tool": "可选工具"}\n\n'
            "约束:\n"
            "1. 步骤数控制在 3-10 步\n"
            "2. 每步必须可单独执行,不要笼统的'开发'/'测试'\n"
            "3. 依赖关系要明确(dependsOn)\n"
            "4. 失败回退步骤用 step=0 标注(回滚/清理)"
        ),
        icon="zap",
        category="ai-top",
        tags=["工作流", "Shell", "开源"],
        source="ai-top",
        source_url="https://github.com/obra/superpowers",
        available=True,  # 真集成:llm_gateway 工作流拆解
    ),
    Skill(
        name="caveman",
        description="让 Claude Code 用更少 token 做事(81k stars, JavaScript)",
        prompt_template=(
            "你是一名文本压缩专家。请将以下文本压缩到原字数的 50% 左右,"
            "保留全部核心信息,删除冗余修饰、重复说明、空话套话。\n\n"
            "原文:\n{text}\n\n"
            "要求:\n"
            "1. 压缩后字数控制在原文的 45%-55% 之间\n"
            "2. 保留所有数字、专有名词、关键结论\n"
            "3. 删除'在这个时代'/'让我们一起'/'总而言之'等空话\n"
            "4. 保留原始段落顺序与逻辑关系\n"
            "5. 只输出压缩后的文本,不要加'压缩后:'之类前缀"
        ),
        icon="cpu",
        category="ai-top",
        tags=["节省 token", "JavaScript", "Claude"],
        source="ai-top",
        source_url="https://github.com/NkxxkN/caveman",
        available=True,  # 真集成:llm_gateway 文本压缩
    ),
    Skill(
        name="graphify",
        description="把代码、文档变成 AI 可查知识图谱(75k stars, Python)",
        prompt_template=(
            "你是一名知识图谱构建专家。请从以下文本中提取实体(Entities)"
            "和实体间关系(Relations),输出结构化 JSON 知识图谱。\n\n"
            "文本:\n{text}\n\n"
            "输出 JSON(不要 markdown 包裹),严格遵循以下结构:\n"
            "{\n"
            '  "entities": [\n'
            '    {"id": "e1", "name": "实体名", "type": "Person|Concept|Tool|Event|Place|Org", "attrs": {"key": "value"}}\n'
            "  ],\n"
            '  "relations": [\n'
            '    {"from": "e1", "to": "e2", "type": "uses|creates|belongs_to|related_to|cites", "weight": 0.0-1.0}\n'
            "  ]\n"
            "}\n\n"
            "约束:\n"
            "1. 实体数量控制在 5-20 个,优先保留核心概念\n"
            "2. 关系必须指向真实存在的实体 id\n"
            "3. weight 表示关系强度(0-1)\n"
            "4. attrs 仅放文本中明确出现的属性"
        ),
        icon="git-branch",
        category="ai-top",
        tags=["知识图谱", "Python", "AI 可查"],
        source="ai-top",
        source_url="https://github.com/bartolli/graphify",
        available=True,  # 真集成:llm_gateway 实体关系抽取
    ),
    Skill(
        name="agent-skills",
        description="给 AI 编程助手装上工程能力(70k stars, Shell)",
        prompt_template=(
            "你是一名资深软件工程师 + 工程化顾问。请针对以下编程任务给出"
            "工程化最佳实践建议,覆盖代码组织、测试、可观测性、CI/CD、"
            "安全、可维护性 6 个维度。\n\n"
            "任务: {task}\n"
            "技术栈: {language}\n\n"
            "输出 JSON(不要 markdown 包裹),结构:\n"
            "{\n"
            '  "codeStructure": {"建议": "...", "理由": "..."},\n'
            '  "testing": {"建议": "...", "理由": "..."},\n'
            '  "observability": {"建议": "...", "理由": "..."},\n'
            '  "cicd": {"建议": "...", "理由": "..."},\n'
            '  "security": {"建议": "...", "理由": "..."},\n'
            '  "maintainability": {"建议": "...", "理由": "..."}\n'
            "}\n\n"
            "约束:\n"
            "1. 每条建议必须可落地(具体到工具/库/命令)\n"
            "2. 理由解释为什么这个建议对本任务有价值\n"
            "3. 不要泛泛而谈'写好测试',要给出'用 pytest + factory_boy 写集成测试'\n"
            "4. 优先给出开源免费工具"
        ),
        icon="wrench",
        category="ai-top",
        tags=["工程", "Shell", "AI 编程"],
        source="ai-top",
        source_url="https://github.com/VoltAgent/agent-skills",
        available=True,  # 真集成:llm_gateway 工程化建议
    ),
    Skill(
        name="awesome-claude-skills",
        description="Claude Skills 入口目录,一次收藏(68k stars, Python)",
        prompt_template=(
            "你是 Skill 路由专家。请根据用户的输入,推荐最合适的 1-3 个 skill "
            "来执行该任务,并说明推荐理由。\n\n"
            "用户输入: {input}\n\n"
            "可选 Skill 池:\n"
            "- code-review: 代码审查\n"
            "- debug-fix: 调试修复\n"
            "- test-generator: 测试生成\n"
            "- doc-writer: 文档撰写\n"
            "- refactor-helper: 重构辅助\n"
            "- api-designer: API 设计\n"
            "- nuwa-skill: 图文改写(风格统一)\n"
            "- hugshu-design: HTML/原型/PPT 设计\n"
            "- auto-redbook-skills: 小红书文案\n"
            "- guizang-ppt-skill: PPT 大纲\n"
            "- superpowers: 工作流拆解\n"
            "- caveman: 文本压缩\n"
            "- graphify: 知识图谱\n"
            "- agent-skills: 工程化建议\n"
            "- taste-skill: 去模板味\n\n"
            "输出 JSON(不要 markdown 包裹):\n"
            "{\n"
            '  "recommendations": [\n'
            '    {"skill": "skill-name", "confidence": 0.0-1.0, "reason": "为什么推荐", "params": {"key": "value"}}\n'
            "  ],\n"
            '  "fallback": "若都不合适的兜底建议"\n'
            "}\n\n"
            "约束:\n"
            "1. 推荐数量 1-3 个,按 confidence 降序\n"
            "2. params 字段填入该 skill 实际需要的输入变量值\n"
            "3. 若用户输入模糊,confidence 全部 < 0.5 并给出澄清问题"
        ),
        icon="book-marked",
        category="ai-top",
        tags=["合集", "Claude", "目录"],
        source="ai-top",
        source_url="https://github.com/ComposioHQ/awesome-claude-skills",
        available=True,  # 真集成:llm_gateway 任务路由
    ),
    Skill(
        name="taste-skill",
        description="让 AI 少些模板味,多一点审美(52k stars, JavaScript)",
        prompt_template=(
            "你是一名有审美的文字编辑。请去除以下文本中的 AI 模板味,"
            "替换为有温度、有节奏感的人话表达。\n\n"
            "原文:\n{text}\n\n"
            "需要替换的 AI 味词汇(高频,看到就改):\n"
            "- 在这个时代 / 当今社会\n"
            "- 让我们一起 / 让我们共同\n"
            "- 总而言之 / 综上所述 / 不得不说\n"
            "- 深入探讨 / 全面解析 / 详细解读\n"
            "- 重要性不言而喻 / 值得我们关注\n"
            "- 开启了新篇章 / 迈向了新台阶\n"
            "- 众所周知 / 显而易见\n"
            "- 赋能 / 抓手 / 闭环 / 链路\n"
            "- 重磅 / 炸裂 / 绝绝子 / yyds\n\n"
            "替换原则:\n"
            "1. 用具体事实代替空话(原'在这个时代,AI 改变生活' → '去年 ChatGPT 上线后,"
            "我发现自己查资料的方式变了')\n"
            "2. 用主动句代替被动结构\n"
            "3. 用短句代替长句(20 字以内的句子比例 ≥ 50%)\n"
            "4. 允许口语化(我/你/咱们),禁止公文式表达\n"
            "5. 保留原文核心信息和情绪基调\n\n"
            "只输出去模板味后的文本,不加'改写后:'之类前缀"
        ),
        icon="palette",
        category="ai-top",
        tags=["审美", "JavaScript", "去模板"],
        source="ai-top",
        source_url="https://github.com/rohitg00/taste-skill",
        available=True,  # 真集成:llm_gateway 去 AI 味
    ),
    Skill(
        name="obsidian-skills",
        description="让 AI 读写 Obsidian 笔记库(39k stars, Markdown)",
        prompt_template="(GitHub 外部项目,见 ai_skills.py handler)",
        icon="notebook",
        category="ai-top",
        tags=["笔记", "Obsidian", "Markdown"],
        source="ai-top",
        source_url="https://github.com/kepano/obsidian-skills",
        available=False,
    ),
    Skill(
        name="claude-plugins-official",
        description="Anthropic 官方 Claude 插件目录(33k stars, Python)",
        prompt_template="(GitHub 外部项目,见 ai_skills.py handler)",
        icon="plug",
        category="ai-top",
        tags=["官方", "插件", "Anthropic"],
        source="ai-top",
        source_url="https://github.com/anthropics/claude-plugins-official",
        available=False,
    ),
    Skill(
        name="awesome-agent-skills",
        description="1000+ Agent Skills 导航仓库(28k stars, Markdown)",
        prompt_template="(GitHub 外部项目,见 ai_skills.py handler)",
        icon="compass",
        category="ai-top",
        tags=["导航", "Agent", "1000+"],
        source="ai-top",
        source_url="https://github.com/awesome-agent-skills/awesome-agent-skills",
        available=False,
    ),
    Skill(
        name="guizang-ppt-skill",
        description="用 AI 生成更像作品集的 PPT(21k stars, HTML)",
        prompt_template=(
            "你是一名资深 PPT 设计师。请根据以下主题生成 PPT 大纲(8-12 页):\n\n"
            "主题: {topic}\n\n"
            "输出格式(每页 1 个 object):\n"
            "[\n  {\"slide\": 1, \"title\": \"...\", \"bullets\": [\"...\", \"...\"], \"layout\": \"title-only|bullet|image-left|image-right|two-column\"},\n  ...\n]"
        ),
        icon="presentation",
        category="ai-top",
        tags=["PPT", "作品集", "HTML"],
        source="ai-top",
        source_url="https://github.com/guizang/guizang-ppt-skill",
        available=True,  # 真集成:llm_gateway 生成大纲 + screenshot 渲染
    ),
]


class SkillRegistry:
    """Skill 注册表,管理预置 skill + auto 目录自进化 skill + AI Skills TOP 的查询。"""

    def __init__(self) -> None:
        self._skills: dict[str, Skill] = {s.name: s for s in _BUILTIN_SKILLS}
        # 2026-07-23:合并 19 个 AI Skills TOP(覆盖同名时 builtin 优先,保持向后兼容)
        for s in _AI_TOP_SKILLS:
            self._skills.setdefault(s.name, s)
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
        import builtins
        return builtins.list(self._skills.values())

    def list_by_category(self, category: str) -> list[Skill]:
        """按 category 过滤 skill(2026-07-23 新增,供 ai_skills 路由分类查询)。

        Args:
            category: 'code' | 'media' | 'ai-top' | 'all'
        """
        import builtins
        if category == "all" or not category:
            return self.list()
        return [s for s in self._skills.values() if s.category == category]

    def list_ai_top(self) -> list[Skill]:
        """列出 19 个 AI Skills TOP(2026-07-23 新增,前端 ai-skills tab 用)。"""
        return self.list_by_category("ai-top")

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
