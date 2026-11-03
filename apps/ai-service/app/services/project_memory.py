# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""项目记忆加载与系统提示构建服务。

迁移自旧架构 workspace/app/api/v1/workspace/memory.py (M-37 补建)。

功能：
1. load_project_memory(workspace_path) — 扫描工作区中的项目记忆文件
   （支持 .ihui/memory.md、CLAUDE.md、AGENTS.md）
2. build_system_prompt(session_id, workspace_path) — 将项目记忆 + 业务代号字典
   注入 Agent 系统提示

对标 Claude Code 的 CLAUDE.md 机制，让 Agent 能够持久化用户项目偏好和自定义指令。
"""

from pathlib import Path

from ..core.prompt_dict import format_domain_dict

# 项目记忆文件名优先级（从高到低）
MEMORY_FILENAMES = [".ihui/memory.md", "CLAUDE.md", "AGENTS.md"]

# 默认系统提示（无项目记忆时使用）
DEFAULT_SYSTEM_PROMPT = "你是 IHUI AI Service 的 agent，请协助用户完成任务。"


def _read_memory_text(path: Path) -> str | None:
    """读一份记忆文件。空内容、读失败都当成没有。"""
    if not path.is_file():
        return None
    try:
        content = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None
    stripped = content.strip()
    return stripped or None


def _local_memory_name(filename: str) -> str:
    """同名 .local 兄弟:AGENTS.md → AGENTS.local.md,.ihui/memory.md → .ihui/memory.local.md。"""
    if filename.endswith(".md"):
        return filename[:-3] + ".local.md"
    return filename + ".local"


def _memory_snippet(directory: Path) -> str | None:
    """一个目录里按既有优先级取基础文件,再叠同名 .local(本地段在后,覆盖优先)。"""
    for filename in MEMORY_FILENAMES:
        base = _read_memory_text(directory / filename)
        local = _read_memory_text(directory / _local_memory_name(filename))
        if base is None and local is None:
            continue
        if base and local:
            return f"{base}\n\n{local}"
        return base or local
    return None


def _git_workspace_root(start: Path) -> Path | None:
    """从 start 上溯,碰到 .git 即工作区根。没有就 None,不猜盘根。"""
    cur = start.resolve()
    while True:
        if (cur / ".git").exists():
            return cur
        if cur.parent == cur:
            return None
        cur = cur.parent


def _is_inside(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
    except ValueError:
        return False
    return True


def _dirs_up_to(start: Path, ceiling: Path) -> list[Path]:
    """从 start 往上走到 ceiling(含),最近的在前。start 不在 ceiling 内则只给 ceiling。"""
    start_r = start.resolve()
    ceiling_r = ceiling.resolve()
    if start_r != ceiling_r and not _is_inside(start_r, ceiling_r):
        return [ceiling_r]
    found: list[Path] = []
    cur = start_r
    while True:
        found.append(cur)
        if cur == ceiling_r or cur.parent == cur:
            break
        cur = cur.parent
    return found


def load_project_memory(workspace_path: str | None = None) -> str | None:
    """加载项目记忆文件内容。

    按优先级搜索以下文件：
    1. .ihui/memory.md
    2. CLAUDE.md
    3. AGENTS.md

    从当前目录上溯到工作区根(显式 workspace_path 是天花板,不越过它)。
    最近一层有内容的目录胜出;该层先读基础文件,再叠同名 .local 兄弟
    (AGENTS.local.md 等),本地段在后。

    Args:
        workspace_path: 工作区路径。None 时从当前工作目录上溯到 git 根。

    Returns:
        项目记忆文件内容，无文件时返回 None。
    """
    cwd = Path.cwd()
    if workspace_path is None:
        start = cwd
        ceiling = _git_workspace_root(start) or start
    else:
        ceiling = Path(workspace_path)
        start = cwd if _is_inside(cwd, ceiling) else ceiling

    for directory in _dirs_up_to(start, ceiling):
        snippet = _memory_snippet(directory)
        if snippet:
            return snippet
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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
