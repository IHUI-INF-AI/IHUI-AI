"""
记忆系统 — 对标 Claude Code 的 CLAUDE.md / AGENTS.md 持久指令机制。

三层记忆:
1. 项目级: AGENTS.md / CLAUDE.md (进版本库, 团队共享)
2. 用户级: ~/.ihui/AGENTS.md (本人所有项目)
3. 会话级: 运行时上下文 (不持久化)

对标 Claude Code:
- 每次会话启动自动加载 AGENTS.md
- @import 语法递归导入 (最多 4 层)
- .claude/rules/ 路径规则按需加载
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import MemoryEntry


# 记忆文件候选名 (按优先级)
# .cursorrules 是 Cursor 编辑器约定的项目级规则文件, 在 IHUI-AI 工作区中作为 CSS/样式规则来源
MEMORY_FILES = ["AGENTS.md", "CLAUDE.md", ".cursorrules", "AGENTS.local.md", "CLAUDE.local.md"]

# @import 递归深度限制
MAX_IMPORT_DEPTH = 4


def load_project_memory(workspace_path: str) -> dict[str, Any]:
    """加载项目记忆。

    查找工作区根目录及子目录中的 AGENTS.md / CLAUDE.md,
    支持 @import 语法递归导入。

    Returns:
        {
            "project_memory": str,  # 项目级记忆全文
            "user_memory": str,     # 用户级记忆全文
            "rules": list[dict],    # .claude/rules/ 路径规则
            "files": list[str],     # 已加载的文件列表
        }
    """
    workspace = Path(workspace_path).resolve()
    loaded_files: list[str] = []
    project_parts: list[str] = []
    rules: list[dict[str, Any]] = []

    # 1. 项目级记忆
    for filename in MEMORY_FILES:
        mem_file = workspace / filename
        if mem_file.exists():
            content = _expand_imports(mem_file, workspace, loaded_files, depth=0)
            if content:
                project_parts.append(f"# 来源: {filename}\n\n{content}")
                loaded_files.append(str(mem_file))

    # 2. .claude/rules/ 路径规则
    rules_dir = workspace / ".claude" / "rules"
    if rules_dir.is_dir():
        for rule_file in rules_dir.glob("*.md"):
            content = rule_file.read_text(encoding="utf-8", errors="replace")
            # 解析 frontmatter
            frontmatter, body = _parse_frontmatter(content)
            if frontmatter.get("paths"):
                rules.append({
                    "file": str(rule_file),
                    "paths": frontmatter["paths"],
                    "content": body,
                })
                loaded_files.append(str(rule_file))

    # 3. 用户级记忆 (~/.ihui/AGENTS.md)
    user_memory = ""
    home = Path.home()
    user_mem_file = home / ".ihui" / "AGENTS.md"
    if user_mem_file.exists():
        user_memory = user_mem_file.read_text(encoding="utf-8", errors="replace")
        loaded_files.append(str(user_mem_file))

    return {
        "project_memory": "\n\n---\n\n".join(project_parts),
        "user_memory": user_memory,
        "rules": rules,
        "files": loaded_files,
    }


def _expand_imports(file_path: Path, workspace: Path, loaded: list[str], depth: int) -> str:
    """展开 @import 语法。

    @path/to/file 语法在加载时把其他文件展开进上下文,
    相对路径相对于包含 import 的文件解析, 最多递归 4 层。
    """
    if depth >= MAX_IMPORT_DEPTH:
        return "[import depth limit reached]"

    content = file_path.read_text(encoding="utf-8", errors="replace")

    # 匹配 @import 语法 (@ 开头的路径)
    import_pattern = re.compile(r"^@([\w./_-]+)$", re.MULTILINE)

    def replace_import(match: re.Match) -> str:
        import_path = match.group(1)
        # 相对路径解析
        target = (file_path.parent / import_path).resolve()
        if not target.exists():
            # 尝试相对工作区
            target = (workspace / import_path).resolve()
        if not target.exists():
            return f"[import not found: {import_path}]"
        if str(target) in loaded:
            return f"[import already loaded: {import_path}]"
        loaded.append(str(target))
        return _expand_imports(target, workspace, loaded, depth + 1)

    return import_pattern.sub(replace_import, content)


def _parse_frontmatter(content: str) -> tuple[dict[str, Any], str]:
    """解析 YAML frontmatter (--- 分隔)。"""
    if not content.startswith("---"):
        return {}, content

    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content

    frontmatter_text = parts[1].strip()
    body = parts[2].strip()

    # 简单 YAML 解析 (不引入 PyYAML 依赖)
    result: dict[str, Any] = {}
    for line in frontmatter_text.split("\n"):
        line = line.strip()
        if ":" in line:
            key, value = line.split(":", 1)
            key = key.strip()
            value = value.strip()
            if value.startswith("[") and value.endswith("]"):
                # 列表
                result[key] = [v.strip().strip('"\'') for v in value[1:-1].split(",") if v.strip()]
            else:
                result[key] = value.strip('"\'')
    return result, body


def build_system_prompt(workspace_path: str, memory: dict[str, Any]) -> str:
    """构建系统提示词 — 包含项目记忆 + 工作区信息。

    对标 Codex 的 prompt 构建:
    - developer 消息 (沙箱权限描述)
    - user 消息 (environment_context)
    - AGENTS.md 内容
    """
    workspace = Path(workspace_path).resolve()

    parts: list[str] = []

    # 核心系统提示
    parts.append("""你是一个强大的 AI Coding Agent, 运行在用户的工作区中。
你可以读写文件、执行命令、搜索代码, 帮助用户完成编程任务。

你的能力对标 Claude Code / Codex / Cursor:
- 理解整个代码库的上下文
- 自主多步推理和工具调用
- 精确编辑代码
- 运行和验证

请始终用中文回复。""")

    # 项目记忆
    if memory.get("project_memory"):
        parts.append(f"\n## 项目指令 (AGENTS.md)\n\n{memory['project_memory']}")

    # 用户级记忆
    if memory.get("user_memory"):
        parts.append(f"\n## 用户级指令\n\n{memory['user_memory']}")

    # 路径规则
    for rule in memory.get("rules", []):
        parts.append(f"\n## 路径规则 ({rule['file']})\n\n{rule['content']}")

    return "\n\n".join(parts)


def save_memory_entry(workspace_path: str, entry: MemoryEntry) -> bool:
    """保存记忆条目到文件。"""
    try:
        if entry.scope == "project":
            target = Path(workspace_path) / ".ihui" / "memory"
        elif entry.scope == "user":
            target = Path.home() / ".ihui" / "memory"
        else:
            return False  # session 级不持久化

        target.mkdir(parents=True, exist_ok=True)
        mem_file = target / f"{entry.key}.md"
        mem_file.write_text(entry.value, encoding="utf-8")
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# AutoMemory 自动学习 (对标 Claude Code 的 Auto Memory / CLAUDE.md 自动更新)
# ---------------------------------------------------------------------------

# 自动学习存储路径
_AUTO_LEARNING_FILE = "auto-learnings.md"

# 提取 prompt — 指导 LLM 从对话中提取可记忆的知识
_EXTRACTION_PROMPT = """你是一个记忆提取助手。请分析以下 AI Agent 与用户的对话历史，提取值得长期记忆的知识。

提取规则:
1. 只提取项目特定的、非显而易见的知识（通用编程知识不需要提取）
2. 每条记忆要简洁、可操作
3. 按以下分类输出:

## 构建与运行命令
（项目特定的构建/测试/lint/部署命令, 如果之前不知道的话）

## 代码规范与风格
（用户强调的代码风格偏好、命名约定、禁止事项）

## 项目架构与依赖
（项目结构、关键依赖关系、模块间调用关系）

## 常见错误与修复
（遇到过的错误及解决方案, 避免重复踩坑）

## 用户偏好
（用户的工作习惯、沟通偏好、工具偏好）

如果某个分类没有值得提取的内容, 省略该分类。
如果整个对话没有值得记忆的内容, 输出 "NO_LEARNINGS"。

对话历史:
"""


async def extract_learnings_from_session(
    messages: list[dict[str, Any]],
    model_id: str,
    workspace_path: str,
) -> str | None:
    """从会话历史中提取关键学习内容。

    调用 LLM 分析对话历史, 提取:
    - 构建命令 / 代码规范 / 项目架构 / 常见错误 / 用户偏好

    Args:
        messages: 会话消息列表 (role/content 格式)
        model_id: 模型 ID
        workspace_path: 工作区路径

    Returns:
        提取的学习内容 (Markdown), 或 None 如果无值得记忆的内容
    """
    from app.api.v1.workspace.llm_gateway import ChatMessage, _get_model_config, _detect_protocol
    from app.api.v1.workspace.llm_gateway import chat_openai, chat_anthropic

    # 构建对话摘要 (过滤过长的工具输出)
    conv_parts: list[str] = []
    for msg in messages[-30:]:  # 最多取最近 30 条消息
        role = msg.get("role", "")
        content = msg.get("content", "")
        if not content:
            # 工具调用消息, 取摘要
            tc = msg.get("tool_call", {})
            if tc:
                name = tc.get("name", "")
                content = f"[工具调用: {name}]"
            tr = msg.get("tool_result", {})
            if tr:
                output = str(tr.get("output", ""))[:200]
                content = f"[工具结果: {output}]"
        if content:
            # 截断过长的消息
            if len(content) > 500:
                content = content[:500] + "..."
            conv_parts.append(f"**{role}**: {content}")

    if not conv_parts:
        return None

    conversation_text = "\n\n".join(conv_parts)

    # 获取模型配置
    cfg = _get_model_config(model_id)
    if not cfg:
        return None

    # 构建提取请求
    extract_messages = [
        ChatMessage(role="system", content=_EXTRACTION_PROMPT),
        ChatMessage(role="user", content=conversation_text),
    ]

    # 调用 LLM (非流式)
    try:
        protocol = _detect_protocol(cfg)
        result_text = ""

        if protocol == "anthropic":
            async for event in chat_anthropic(extract_messages, cfg, stream=False):
                if event.get("type") == "text_delta":
                    result_text += event.get("content", "")
                elif event.get("type") == "done":
                    break
                elif event.get("type") == "error":
                    return None
        else:
            async for event in chat_openai(extract_messages, cfg, stream=False):
                if event.get("type") == "text_delta":
                    result_text += event.get("content", "")
                elif event.get("type") == "done":
                    break
                elif event.get("type") == "error":
                    return None

        result_text = result_text.strip()
        if not result_text or result_text == "NO_LEARNINGS":
            return None

        return result_text
    except Exception as e:
        logger.warning(f"AutoMemory 提取失败: {e}")
        return None


def save_auto_learning(workspace_path: str, learning: str) -> bool:
    """保存自动学习内容到文件。

    追加到 .ihui/memory/auto-learnings.md, 带时间戳和分隔符。
    """
    try:
        import time
        mem_dir = Path(workspace_path) / ".ihui" / "memory"
        mem_dir.mkdir(parents=True, exist_ok=True)
        mem_file = mem_dir / _AUTO_LEARNING_FILE

        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        entry = f"\n\n---\n\n## 自动学习 — {timestamp}\n\n{learning}\n"

        # 追加模式
        with open(mem_file, "a", encoding="utf-8") as f:
            f.write(entry)

        return True
    except Exception as e:
        logger.warning(f"保存自动学习失败: {e}")
        return False


def load_auto_learnings(workspace_path: str) -> str:
    """加载自动学习内容。"""
    try:
        mem_file = Path(workspace_path) / ".ihui" / "memory" / _AUTO_LEARNING_FILE
        if mem_file.exists():
            return mem_file.read_text(encoding="utf-8", errors="replace")
        return ""
    except Exception:
        return ""


def clear_auto_learnings(workspace_path: str) -> bool:
    """清除自动学习内容。"""
    try:
        mem_file = Path(workspace_path) / ".ihui" / "memory" / _AUTO_LEARNING_FILE
        if mem_file.exists():
            mem_file.unlink()
            return True
        return False
    except Exception:
        return False


def build_system_prompt_with_auto(workspace_path: str, memory: dict[str, Any]) -> str:
    """构建系统提示词 — 包含项目记忆 + 自动学习 + 工作区信息。

    增强版: 在 build_system_prompt 基础上注入自动学习内容。
    """
    base_prompt = build_system_prompt(workspace_path, memory)

    # 注入自动学习内容
    auto_learnings = load_auto_learnings(workspace_path)
    if auto_learnings:
        base_prompt += f"\n\n## 自动学习记忆 (AutoMemory)\n\n以下是从历史会话中自动提取的知识, 请参考:\n\n{auto_learnings