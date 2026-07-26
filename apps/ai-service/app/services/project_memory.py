"""项目记忆加载与系统提示构建服务。

迁移自旧架构 workspace/app/api/v1/workspace/memory.py (M-37 补建)。

功能：
1. load_project_memory(workspace_path) — 扫描工作区中的项目记忆文件
   （支持 .ihui/memory.md、CLAUDE.md、AGENTS.md）
2. build_system_prompt(session_id, workspace_path) — 将项目记忆 + 业务代号字典
   注入 Agent 系统提示

对标 Claude Code 的 CLAUDE.md 机制，让 Agent 能够持久化用户项目偏好和自定义指令。
"""

import os
from pathlib import Path

from ..core.config import settings
from ..core.prompt_dict import format_domain_dict

# 项目记忆文件名优先级（从高到低）
MEMORY_FILENAMES = [".ihui/memory.md", "CLAUDE.md", "AGENTS.md"]

# 默认系统提示（无项目记忆时使用）
DEFAULT_SYSTEM_PROMPT = "你是 IHUI AI Service 的 agent，请协助用户完成任务。"


def load_project_memory(workspace_path: str | None = None) -> str | None:
    """加载项目记忆文件内容。

    按优先级搜索以下文件：
    1. {workspace_path}/.ihui/memory.md
    2. {workspace_path}/CLAUDE.md
    3. {workspace_path}/AGENTS.md

    Args:
        workspace_path: 工作区路径。None 时使用当前工作目录。

    Returns:
        项目记忆文件内容，无文件时返回 None。
    """
    if workspace_path is None:
        workspace_path = os.getcwd()

    base = Path(workspace_path)

    for filename in MEMORY_FILENAMES:
        filepath = base / filename
        if filepath.is_file():
            try:
                content = filepath.read_text(encoding="utf-8")
                if content.strip():
                    return content.strip()
            except (OSError, UnicodeDecodeError):
                continue

    return None


def build_system_prompt(
    session_id: str | None = None,
    workspace_path: str | None = None,
) -> str:
    """构建 Agent 系统提示，注入业务代号字典 + 项目记忆。

    1. 总是注入业务代号字典（format_domain_dict()），让 subagent 长任务
       反复使用短代号（D1/T1/SSR/RSC/PA/RAG/LTM...），省 token + 降假阳性
    2. 加载项目记忆文件，注入到系统提示
    3. 无项目记忆时仍返回包含业务代号字典的完整提示

    Args:
        session_id: 会话 ID（预留，未来可用于注入会话级记忆）
        workspace_path: 工作区路径

    Returns:
        完整的系统提示字符串（DEFAULT_SYSTEM_PROMPT + 业务代号字典 [+ 项目记忆]）。
    """
    project_memory = load_project_memory(workspace_path)
    domain_dict = format_domain_dict()

    if not project_memory:
        return f"{DEFAULT_SYSTEM_PROMPT}\n\n{domain_dict}"

    return f"""{DEFAULT_SYSTEM_PROMPT}

{domain_dict}

## 项目记忆

以下是项目的配置和偏好，请在协助用户时遵循：

{project_memory}
"""
