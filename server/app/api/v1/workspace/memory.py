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
