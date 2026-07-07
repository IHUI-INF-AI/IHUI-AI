"""
Agent 工具集实现 — 对标 Claude Code / Codex 的工具系统。

每个工具:
- 有清晰的 JSON Schema 定义 (供 LLM function calling)
- 有 async 执行函数
- 支持工作区路径沙箱 (cwd 相对路径解析)
- 安全: 拒绝越界路径访问 (path traversal)

工具清单:
  read_file      读取文件 (含行号范围)
  write_file     写入/创建文件
  edit_file      精确替换 (search/replace)
  multi_edit     批量编辑 (多个 search/replace)
  delete_file    删除文件/目录
  list_dir       列目录
  glob           文件名匹配
  grep           内容搜索 (正则)
  run_command    执行 shell 命令
  web_fetch      抓取 URL 内容
  todo_write     写入任务清单
  todo_read      读取任务清单
  git_status     查看 git 状态
  git_diff       查看 git diff
  git_log        查看 git 日志
"""

from __future__ import annotations

import asyncio
import fnmatch
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

from app.api.v1.workspace.checkpoint import commit_after_modify
from app.api.v1.workspace.schemas import ToolCallResult
from app.api.v1.workspace.sandbox import execute_in_sandbox, SandboxMode

# Windows 兼容
IS_WINDOWS = sys.platform == "win32"


# ---------------------------------------------------------------------------
# Shell 命令黑名单 (对标 Claude Code / Codex 安全策略)
# 在 default 权限模式下拦截, 防止破坏性系统操作
# 匹配规则: 正则 + 拒绝原因
# ---------------------------------------------------------------------------

SHELL_BLACKLIST: list[tuple[str, str]] = [
    # 危险删除: 根目录及子路径
    (r"\brm\s+-\w*r\w*\s+[/\\]\S*", "rm -r 根目录 禁止执行"),
    # 危险删除: 上级目录
    (r"\brm\s+-\w*r\w*\s+\.\.[/\\]?", "rm -r 上级目录 禁止执行"),
    # 危险删除: home 目录
    (r"\brm\s+-\w*r\w*\s+~[/\\]?", "rm -r home 目录 禁止执行"),
    # rmdir 根目录
    (r"\brmdir\s+(-\w+\s+)*[/\\](\s|$)", "rmdir / 禁止执行"),
    # del 根目录
    (r"\bdel\s+[/\\]\*", "del /* 禁止执行"),
    # 磁盘/文件系统破坏
    (r"\bmkfs\b", "mkfs 禁止执行"),
    (r"\bdd\s+.*\bof\s*=\s*/dev/", "dd to device 禁止执行"),
    (r"\bformat\s+[a-zA-Z]:", "format 禁止执行"),
    (r"\bdiskpart\b", "diskpart 禁止执行"),
    # 系统控制
    (r"\bshutdown\b", "shutdown 禁止执行"),
    (r"\breboot\b", "reboot 禁止执行"),
    (r"\bhalt\b", "halt 禁止执行"),
    (r"\bpoweroff\b", "poweroff 禁止执行"),
    (r"\binit\s+[0-6]\b", "init runlevel 禁止执行"),
    # 权限提升
    (r"\bsudo\b", "sudo 禁止执行 (请在终端中手动执行)"),
    (r"\bsu\s+-[a-zA-Z]*\s*\S", "su 切换用户禁止执行"),
    # Fork bomb
    (r":\(\)\s*\{.*:\|:.*\}\s*;", "fork bomb 禁止执行"),
    # 网络危险操作
    (r"\biptables\s+-F", "iptables flush 禁止执行"),
    (r"\bnc\s+-[a-zA-Z]*l", "netcat listener 禁止执行"),
]


def check_shell_blacklist(command: str) -> str | None:
    """检查 shell 命令是否在黑名单中. 命中返回拒绝原因, 否则返回 None."""
    cmd_lower = command.strip()
    for pattern, reason in SHELL_BLACKLIST:
        if re.search(pattern, cmd_lower, re.IGNORECASE):
            return reason
    return None


# ---------------------------------------------------------------------------
# 工具定义 (JSON Schema for LLM function calling)
# ---------------------------------------------------------------------------

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "读取文件内容。支持行号范围读取。返回带行号的文本。",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "文件路径 (相对工作区或绝对)"},
                    "start_line": {"type": "integer", "description": "起始行号 (1-based), 默认1"},
                    "end_line": {"type": "integer", "description": "结束行号 (1-based, 含), 默认末尾"},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "写入或创建文件。如文件已存在则覆盖。支持 dry_run 预览 diff。自动创建检查点, 可通过 undo 撤销。",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "文件路径"},
                    "content": {"type": "string", "description": "文件内容"},
                    "dry_run": {"type": "boolean", "description": "仅预览 diff 不写入, 默认 false"},
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "edit_file",
            "description": "精确编辑文件: 查找 old_text 并替换为 new_text。old_text 必须唯一。支持模糊匹配恢复 (空白差异容错) 和 dry_run 预览。自动创建检查点。",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "文件路径"},
                    "old_text": {"type": "string", "description": "要查找的文本块 (必须唯一)"},
                    "new_text": {"type": "string", "description": "替换为的文本块"},
                    "dry_run": {"type": "boolean", "description": "仅预览 diff 不写入, 默认 false"},
                },
                "required": ["path", "old_text", "new_text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_file",
            "description": "删除文件或空目录。recursive=true 时可删除非空目录。",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "路径"},
                    "recursive": {"type": "boolean", "description": "是否递归删除"},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_dir",
            "description": "列出目录内容。返回文件名/类型/大小/修改时间。",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "目录路径, 空表示工作区根"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "glob",
            "description": "按 glob 模式查找文件。如 **/*.vue 匹配所有 Vue 文件。",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "glob 模式, 如 **/*.py"},
                    "path": {"type": "string", "description": "搜索根目录, 默认工作区根"},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "grep",
            "description": "在文件内容中搜索正则表达式。支持文件名过滤。",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "正则表达式"},
                    "path": {"type": "string", "description": "搜索根目录, 默认工作区根"},
                    "glob": {"type": "string", "description": "文件名 glob 过滤, 如 *.ts"},
                    "output_mode": {"type": "string", "enum": ["content", "files_with_matches", "count"], "description": "输出模式"},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "执行 shell 命令并返回 stdout/stderr/exit_code。用于构建/测试/git 等操作。命令在容器沙箱中执行 (对标 Codex sandbox_mode): 网络默认隔离, 写操作默认仅限工作区。",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "要执行的命令"},
                    "cwd": {"type": "string", "description": "工作目录, 默认工作区根"},
                    "timeout_ms": {"type": "integer", "description": "超时毫秒, 默认 60000"},
                    "sandbox_mode": {
                        "type": "string",
                        "enum": ["read-only", "workspace-write", "danger-full-access"],
                        "description": "沙箱模式: read-only=只读且网络隔离 (用于查看/构建); workspace-write=仅允许写工作区且网络隔离 (默认, 常规构建/测试); danger-full-access=完全放开无沙箱无网络隔离 (仅用于必须联网或写工作区外的场景, 谨慎使用)",
                    },
                },
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "multi_edit",
            "description": "批量编辑文件: 在同一文件中执行多个 search/replace。原子性 — 任一替换失败则全部回滚。支持模糊匹配和 dry_run 预览。自动创建检查点。",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "文件路径"},
                    "edits": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "old_text": {"type": "string", "description": "要查找的文本"},
                                "new_text": {"type": "string", "description": "替换为的文本"},
                            },
                            "required": ["old_text", "new_text"],
                        },
                        "description": "编辑列表",
                    },
                    "dry_run": {"type": "boolean", "description": "仅预览 diff 不写入, 默认 false"},
                },
                "required": ["path", "edits"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_fetch",
            "description": "抓取 URL 内容并返回 markdown 格式。用于查阅文档/API 参考。",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "要抓取的 URL"},
                    "max_length": {"type": "integer", "description": "返回内容最大字符数, 默认 10000"},
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "使用搜索引擎搜索互联网。返回搜索结果摘要和相关链接。",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词"},
                    "max_results": {"type": "integer", "description": "最大结果数, 默认 5"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "todo_write",
            "description": "写入/更新任务清单。用于跟踪复杂任务的进度。",
            "parameters": {
                "type": "object",
                "properties": {
                    "todos": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "content": {"type": "string", "description": "任务描述"},
                                "status": {"type": "string", "enum": ["pending", "in_progress", "completed"], "description": "任务状态"},
                                "priority": {"type": "string", "enum": ["high", "medium", "low"], "description": "优先级"},
                            },
                            "required": ["content", "status"],
                        },
                        "description": "任务列表 (完整覆盖)",
                    },
                },
                "required": ["todos"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "todo_read",
            "description": "读取当前任务清单。",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git_status",
            "description": "查看工作区 git 状态 (分支/暂存/未跟踪文件)。",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git_diff",
            "description": "查看 git diff (工作区与暂存区/HEAD 的差异)。",
            "parameters": {
                "type": "object",
                "properties": {
                    "staged": {"type": "boolean", "description": "是否查看已暂存的 diff, 默认 false"},
                    "path": {"type": "string", "description": "限定文件路径, 可选"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git_log",
            "description": "查看 git 提交日志。",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "返回条目数, 默认 20"},
                    "oneline": {"type": "boolean", "description": "是否一行显示, 默认 true"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "undo",
            "description": "撤销最近一次文件修改 (write/edit/multi_edit/delete), 基于检查点快照恢复原始内容。对标 Aider git revert。",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_checkpoints",
            "description": "列出最近的检查点历史 (每次文件修改自动创建)。可用于查看可回滚的操作。",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "返回条目数, 默认 20"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "rollback",
            "description": "回滚到指定检查点: 撤销该检查点及之后所有文件修改。checkpoint_id 可通过 list_checkpoints 获取。",
            "parameters": {
                "type": "object",
                "properties": {
                    "checkpoint_id": {"type": "string", "description": "目标检查点 ID (如 cp-1234567890-0001)"},
                },
                "required": ["checkpoint_id"],
            },
        },
    },
]


def get_tool_names() -> list[str]:
    """返回所有工具名。"""
    return [t["function"]["name"] for t in TOOL_DEFINITIONS]


# ---------------------------------------------------------------------------
# 路径安全: 沙箱化
# ---------------------------------------------------------------------------

def _resolve_path(path: str, workspace: str) -> Path:
    """将路径解析为工作区内的安全绝对路径。

    - 相对路径: 相对 workspace 解析
    - 绝对路径: 必须在 workspace 内 (防 path traversal)
    - 越界: 抛 PermissionError
    """
    workspace_abs = Path(workspace).resolve()
    p = Path(path)

    if not p.is_absolute():
        p = workspace_abs / p
    else:
        p = p.resolve()

    # 安全检查: 必须在工作区内
    try:
        p.relative_to(workspace_abs)
    except ValueError:
        raise PermissionError(f"路径越界: {path} 不在工作区 {workspace} 内")

    return p


# ---------------------------------------------------------------------------
# Diff 生成 (对标 Aider SEARCH/REPLACE 可视化 + Claude Code diff 预览)
# ---------------------------------------------------------------------------

def _generate_unified_diff(old_content: str, new_content: str, filename: str = "") -> str:
    """生成 unified diff 格式的差异预览。

    对标 Aider 的 SEARCH/REPLACE 块可视化与 Claude Code 的 diff 预览。
    当文件是新建时, old_content 为空, 全部为新增行。
    """
    import difflib

    old_lines = old_content.splitlines(keepends=True)
    new_lines = new_content.splitlines(keepends=True)
    diff = difflib.unified_diff(
        old_lines,
        new_lines,
        fromfile=f"a/{filename}" if filename else "原始",
        tofile=f"b/{filename}" if filename else "修改后",
        lineterm="",
    )
    result = "\n".join(diff)
    if not result:
        return "(无差异)"
    # 限制 diff 长度, 避免超大 diff 撑爆上下文
    max_lines = 200
    lines = result.split("\n")
    if len(lines) > max_lines:
        lines = lines[:max_lines] + [f"\n... (差异共 {len(lines)} 行, 已截断显示前 {max_lines} 行)"]
    return "\n".join(lines)


def _fuzzy_find_match(content: str, old_text: str) -> str | None:
    """模糊匹配恢复 — 当精确匹配失败时, 尝试 whitespace 归一化匹配。

    对标 Claude Code 的 edit 工具容错: 当 old_text 因空白差异 (空格/制表符/换行) 匹配失败时,
    归一化空白后重新匹配, 并返回实际在文件中的精确文本 (供 replace 使用)。

    Returns:
        匹配到的精确文本 (可直接用于 str.replace), 或 None
    """
    import re

    def normalize(s: str) -> str:
        return re.sub(r"\s+", " ", s).strip()

    norm_old = normalize(old_text)
    if not norm_old:
        return None

    # 滑动窗口: 将文件按双换行分段, 逐段归一化匹配
    # 对于短 old_text, 直接在全文归一化后查找位置, 再反推原始文本
    content_lines = content.split("\n")
    old_lines = old_text.strip().split("\n")
    if not old_lines:
        return None

    norm_old_first = normalize(old_lines[0])
    norm_old_last = normalize(old_lines[-1])

    # 在文件中寻找首行模糊匹配的起始位置
    for i, line in enumerate(content_lines):
        if normalize(line) == norm_old_first:
            # 尝试从 i 开始取 len(old_lines) 行, 检查末行是否也匹配
            candidate_end = i + len(old_lines) - 1
            if candidate_end < len(content_lines):
                candidate = "\n".join(content_lines[i : candidate_end + 1])
                if normalize(candidate) == norm_old:
                    return candidate
            # 也尝试多取几行 (可能有额外空行)
            for extra in range(1, 4):
                cand_end = i + len(old_lines) - 1 + extra
                if cand_end < len(content_lines):
                    candidate = "\n".join(content_lines[i : cand_end + 1])
                    if normalize(candidate) == norm_old:
                        return candidate

    return None


def _checkpoint_snapshot(workspace: str, file_paths: list[str], tool: str, desc: str = "") -> str:
    """在修改文件前创建检查点快照 (对标 Aider git auto-commit / Gemini checkpointing)。

    Returns: 检查点 ID (失败时返回空字符串, 不阻断主流程)
    """
    try:
        from app.api.v1.workspace.checkpoint import snapshot_before_modify

        return snapshot_before_modify(workspace, file_paths, tool, desc)
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# 工具执行函数
# ---------------------------------------------------------------------------

async def tool_read_file(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """读取文件内容, 带行号。"""
    try:
        path = _resolve_path(args["path"], workspace)
        if not path.exists():
            return ToolCallResult(tool="read_file", input=args, output="", error=f"文件不存在: {path}", success=False)

        content = path.read_text(encoding="utf-8", errors="replace")
        lines = content.split("\n")
        start = args.get("start_line", 1) or 1
        end = args.get("end_line", len(lines)) or len(lines)
        start = max(1, min(start, len(lines)))
        end = max(start, min(end, len(lines)))

        # 带行号输出
        numbered = "\n".join(f"{i:>6}\t{line}" for i, line in enumerate(lines[start - 1 : end], start))
        truncated = end < len(lines)
        truncation_note = f"\n(显示 {start}-{end}/{len(lines)} 行, 已截断)" if truncated else f"\n(共 {len(lines)} 行)"

        return ToolCallResult(
            tool="read_file",
            input=args,
            output=numbered + truncation_note,
            success=True,
        )
    except PermissionError as e:
        return ToolCallResult(tool="read_file", input=args, output="", error=str(e), success=False)
    except Exception as e:
        return ToolCallResult(tool="read_file", input=args, output="", error=str(e), success=False)


async def tool_write_file(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """写入/创建文件 (支持 dry_run diff 预览 + 自动检查点快照)。"""
    try:
        path = _resolve_path(args["path"], workspace)
        content = args.get("content", "")
        dry_run = args.get("dry_run", False)
        rel_path = str(path.relative_to(Path(workspace).resolve()))

        # 读取原始内容 (用于 diff 预览 + 检查点)
        old_content = ""
        if path.exists():
            old_content = path.read_text(encoding="utf-8", errors="replace")

        # dry_run 模式: 仅返回 diff 预览, 不写入
        if dry_run:
            diff = _generate_unified_diff(old_content, content, rel_path)
            return ToolCallResult(
                tool="write_file",
                input=args,
                output=f"[dry_run 预览] {path}\n{diff}",
                success=True,
            )

        # 写入前创建检查点快照 (对标 Aider git auto-commit)
        cp_id = _checkpoint_snapshot(workspace, [rel_path], "write_file", f"write_file: {rel_path}")

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

        # 写入后可选 git auto-commit (对标 Aider)
        try:
            commit_after_modify(workspace, cp_id, "write_file", [rel_path])
        except Exception:
            pass

        # 返回结果中附带 diff 摘要 (帮助 Agent 理解变更)
        diff = _generate_unified_diff(old_content, content, rel_path)
        diff_preview = diff[:500] + "..." if len(diff) > 500 else diff
        return ToolCallResult(
            tool="write_file",
            input=args,
            output=f"已写入 {path} ({len(content)} 字符, {content.count(chr(10)) + 1} 行)\n\n变更预览:\n{diff_preview}",
            success=True,
        )
    except Exception as e:
        return ToolCallResult(tool="write_file", input=args, output="", error=str(e), success=False)


async def tool_edit_file(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """精确替换 (search/replace) — 支持 dry_run diff 预览 + 模糊匹配恢复 + 自动检查点。"""
    try:
        path = _resolve_path(args["path"], workspace)
        if not path.exists():
            return ToolCallResult(tool="edit_file", input=args, output="", error=f"文件不存在: {path}", success=False)

        rel_path = str(path.relative_to(Path(workspace).resolve()))
        content = path.read_text(encoding="utf-8", errors="replace")
        old_text = args["old_text"]
        new_text = args["new_text"]
        dry_run = args.get("dry_run", False)

        count = content.count(old_text)
        actual_old_text = old_text  # 实际用于 replace 的文本 (模糊匹配后可能不同)

        if count == 0:
            # 精确匹配失败 → 尝试模糊匹配恢复 (对标 Claude Code edit 容错)
            fuzzy_match = _fuzzy_find_match(content, old_text)
            if fuzzy_match:
                actual_old_text = fuzzy_match
                count = content.count(actual_old_text)
                if count == 1:
                    # 模糊匹配成功, 继续执行
                    pass
                else:
                    return ToolCallResult(
                        tool="edit_file",
                        input=args,
                        output="",
                        error=f"模糊匹配找到 {count} 处, old_text 必须唯一 (空白差异已容错)",
                        success=False,
                    )
            else:
                return ToolCallResult(
                    tool="edit_file",
                    input=args,
                    output="",
                    error="未找到匹配文本 (已尝试空白归一化模糊匹配)",
                    success=False,
                )
        if count > 1:
            return ToolCallResult(
                tool="edit_file",
                input=args,
                output="",
                error=f"找到 {count} 处匹配, old_text 必须唯一",
                success=False,
            )

        new_content = content.replace(actual_old_text, new_text, 1)

        # dry_run 模式: 仅返回 diff 预览
        if dry_run:
            diff = _generate_unified_diff(content, new_content, rel_path)
            return ToolCallResult(
                tool="edit_file",
                input=args,
                output=f"[dry_run 预览] {path}\n{diff}",
                success=True,
            )

        # 编辑前创建检查点快照
        cp_id = _checkpoint_snapshot(workspace, [rel_path], "edit_file", f"edit_file: {rel_path}")

        path.write_text(new_content, encoding="utf-8")

        # 编辑后可选 git auto-commit (对标 Aider)
        try:
            commit_after_modify(workspace, cp_id, "edit_file", [rel_path])
        except Exception:
            pass
        diff = _generate_unified_diff(content, new_content, rel_path)
        diff_preview = diff[:500] + "..." if len(diff) > 500 else diff
        match_note = " (模糊匹配恢复成功)" if actual_old_text != old_text else ""
        return ToolCallResult(
            tool="edit_file",
            input=args,
            output=f"已替换 1 处{match_note}, 文件 {path} 已更新\n\n变更预览:\n{diff_preview}",
            success=True,
        )
    except Exception as e:
        return ToolCallResult(tool="edit_file", input=args, output="", error=str(e), success=False)


async def tool_delete_file(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """删除文件/目录 (支持自动检查点快照, 可通过 undo 恢复)。"""
    try:
        path = _resolve_path(args["path"], workspace)
        recursive = args.get("recursive", False)
        rel_path = str(path.relative_to(Path(workspace).resolve()))

        # 删除前创建检查点快照 (对标 Aider git auto-commit, 支持撤销)
        cp_id = _checkpoint_snapshot(workspace, [rel_path], "delete_file", f"delete_file: {rel_path}")

        if path.is_dir():
            if recursive:
                import shutil

                shutil.rmtree(path)
            else:
                path.rmdir()  # 仅空目录
        else:
            path.unlink()

        # 删除后可选 git auto-commit (对标 Aider)
        try:
            commit_after_modify(workspace, cp_id, "delete_file", [rel_path])
        except Exception:
            pass

        return ToolCallResult(
            tool="delete_file",
            input=args,
            output=f"已删除 {path} (可通过 undo 工具恢复)",
            success=True,
        )
    except Exception as e:
        return ToolCallResult(tool="delete_file", input=args, output="", error=str(e), success=False)


async def tool_list_dir(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """列目录内容。"""
    try:
        target = args.get("path", "") or ""
        path = _resolve_path(target, workspace) if target else Path(workspace).resolve()
        if not path.exists():
            return ToolCallResult(tool="list_dir", input=args, output="", error=f"目录不存在: {path}", success=False)
        if not path.is_dir():
            return ToolCallResult(tool="list_dir", input=args, output="", error=f"不是目录: {path}", success=False)

        entries = []
        for item in sorted(path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
            # 跳过隐藏文件和常见忽略目录
            if item.name.startswith(".") or item.name in ("node_modules", "__pycache__", ".git", "dist", "build"):
                continue
            stat = item.stat()
            entries.append(
                f"{'[DIR] ' if item.is_dir() else '      '}{item.name}  ({stat.st_size} bytes)"
            )

        return ToolCallResult(
            tool="list_dir",
            input=args,
            output="\n".join(entries) or "(空目录)",
            success=True,
        )
    except Exception as e:
        return ToolCallResult(tool="list_dir", input=args, output="", error=str(e), success=False)


async def tool_glob(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """glob 模式匹配文件。"""
    try:
        pattern = args["pattern"]
        root = args.get("path", "") or workspace
        root_path = _resolve_path(root, workspace) if root else Path(workspace).resolve()

        matches: list[str] = []
        for dirpath, dirnames, filenames in os.walk(root_path):
            # 过滤忽略目录
            dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules", "__pycache__", "dist", "build", ".next")]
            for filename in filenames:
                full = os.path.join(dirpath, filename)
                rel = os.path.relpath(full, root_path)
                if fnmatch.fnmatch(rel, pattern) or fnmatch.fnmatch(filename, pattern):
                    matches.append(rel)
            if len(matches) > 500:
                matches.append("... (结果超过 500, 已截断)")
                break

        return ToolCallResult(
            tool="glob",
            input=args,
            output="\n".join(sorted(matches)) or "(无匹配)",
            success=True,
        )
    except Exception as e:
        return ToolCallResult(tool="glob", input=args, output="", error=str(e), success=False)


async def tool_grep(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """正则搜索文件内容。"""
    try:
        pattern = args["pattern"]
        root = args.get("path", "") or workspace
        root_path = _resolve_path(root, workspace) if root else Path(workspace).resolve()
        file_glob = args.get("glob")
        output_mode = args.get("output_mode", "content")

        regex = re.compile(pattern)
        results: list[str] = []
        match_count = 0
        file_count = 0
        files_with_matches: set[str] = set()  # 统一追踪有匹配的文件

        for dirpath, dirnames, filenames in os.walk(root_path):
            dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules", "__pycache__", "dist", "build")]
            for filename in filenames:
                if file_glob and not fnmatch.fnmatch(filename, file_glob):
                    continue
                full = os.path.join(dirpath, filename)
                try:
                    content = Path(full).read_text(encoding="utf-8", errors="replace")
                except Exception:
                    continue

                file_matched = False
                for i, line in enumerate(content.split("\n"), 1):
                    if regex.search(line):
                        match_count += 1
                        file_matched = True
                        if output_mode == "content":
                            rel = os.path.relpath(full, root_path)
                            results.append(f"{rel}:{i}: {line.strip()[:200]}")
                        elif output_mode == "files_with_matches":
                            results.append(os.path.relpath(full, root_path))
                            break  # 每文件只记一次

                if file_matched:
                    files_with_matches.add(full)

                if len(results) > 200:
                    results.append("... (结果超过 200, 已截断)")
                    break
            if len(results) > 200:
                break

        file_count = len(files_with_matches)

        if output_mode == "count":
            output = f"共 {match_count} 处匹配, {file_count} 个文件"
        elif output_mode == "files_with_matches":
            output = "\n".join(sorted(set(results))) or "(无匹配)"
        else:
            output = "\n".join(results) or "(无匹配)"

        return ToolCallResult(
            tool="grep",
            input=args,
            output=output,
            success=True,
        )
    except re.error as e:
        return ToolCallResult(tool="grep", input=args, output="", error=f"正则错误: {e}", success=False)
    except Exception as e:
        return ToolCallResult(tool="grep", input=args, output="", error=str(e), success=False)


async def tool_run_command(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """执行 shell 命令 (容器沙箱 + 网络隔离, 对标 Codex sandbox_mode)。

    三档沙箱模式:
    - read-only:            只读, 网络隔离
    - workspace-write:      仅写工作区, 网络隔离 (默认)
    - danger-full-access:   完全放开, 无沙箱无网络隔离
    """
    try:
        command = args["command"]
        cwd = args.get("cwd", "") or None
        timeout_ms = args.get("timeout_ms", 60000)
        sandbox_mode = args.get("sandbox_mode", "workspace-write")

        # 额外防护层: 命令黑名单 (沙箱前先检查, 与 sandbox 内置检查形成纵深防御)
        denial = check_shell_blacklist(command)
        if denial:
            return ToolCallResult(
                tool="run_command",
                input=args,
                output="",
                error=f"命令被安全策略拦截: {denial}",
                success=False,
            )

        # 沙箱执行 (Docker 优先, 自动降级进程级隔离)
        result = await execute_in_sandbox(
            command=command,
            workspace=workspace,
            mode=sandbox_mode,
            timeout_ms=timeout_ms,
            cwd=cwd,
        )

        rc = result["returncode"]
        # returncode == -1 表示超时 / 策略拦截 / 执行器错误 (未真正运行命令)
        is_system_error = rc == -1

        if is_system_error:
            # 与原行为一致: 系统级错误仅返回 error, output 留空
            return ToolCallResult(
                tool="run_command",
                input=args,
                output="",
                error=result["stderr"],
                success=False,
            )

        # 命令已执行 (成功或非零退出): 组装与原格式兼容的输出
        output_parts = []
        if result["stdout"]:
            output_parts.append(f"[stdout]\n{result['stdout']}")
        if result["stderr"]:
            output_parts.append(f"[stderr]\n{result['stderr']}")
        output_parts.append(f"[exit_code] {rc}")
        if result.get("sandboxed"):
            output_parts.append(f"[sandbox] method={result.get('method')}")

        return ToolCallResult(
            tool="run_command",
            input=args,
            output="\n\n".join(output_parts),
            success=result["success"],
        )
    except Exception as e:
        return ToolCallResult(tool="run_command", input=args, output="", error=str(e), success=False)


# ---------------------------------------------------------------------------
# 批量编辑 (multi_edit) — 原子性多 search/replace
# ---------------------------------------------------------------------------

async def tool_multi_edit(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """批量编辑文件: 在同一文件中执行多个 search/replace。原子性 — 任一失败则全部回滚。

    增强: dry_run diff 预览 + 模糊匹配恢复 + 自动检查点。
    """
    try:
        path = _resolve_path(args["path"], workspace)
        if not path.exists():
            return ToolCallResult(tool="multi_edit", input=args, output="", error=f"文件不存在: {path}", success=False)

        rel_path = str(path.relative_to(Path(workspace).resolve()))
        original_content = path.read_text(encoding="utf-8", errors="replace")
        content = original_content
        edits = args.get("edits", [])
        applied = 0
        dry_run = args.get("dry_run", False)
        fuzzy_used = False

        for i, edit in enumerate(edits):
            old_text = edit.get("old_text", "")
            new_text = edit.get("new_text", "")
            actual_old = old_text

            if old_text not in content:
                # 精确匹配失败 → 模糊匹配恢复
                fuzzy_match = _fuzzy_find_match(content, old_text)
                if fuzzy_match and content.count(fuzzy_match) == 1:
                    actual_old = fuzzy_match
                    fuzzy_used = True
                else:
                    # 回滚: 恢复原始内容 (内存中, 尚未写入)
                    return ToolCallResult(
                        tool="multi_edit",
                        input=args,
                        output=f"第 {i+1}/{len(edits)} 个替换失败: old_text 未找到 (已尝试模糊匹配), 已回滚",
                        error=f"edit #{i+1}: old_text not found in file",
                        success=False,
                    )
            content = content.replace(actual_old, new_text, 1)
            applied += 1

        # dry_run 模式: 仅返回 diff 预览
        if dry_run:
            diff = _generate_unified_diff(original_content, content, rel_path)
            return ToolCallResult(
                tool="multi_edit",
                input=args,
                output=f"[dry_run 预览] {path} ({applied}/{len(edits)} 个替换)\n{diff}",
                success=True,
            )

        # 写入前创建检查点快照
        cp_id = _checkpoint_snapshot(workspace, [rel_path], "multi_edit", f"multi_edit: {rel_path} ({applied} edits)")

        path.write_text(content, encoding="utf-8")

        # 编辑后可选 git auto-commit (对标 Aider)
        try:
            commit_after_modify(workspace, cp_id, "multi_edit", [rel_path])
        except Exception:
            pass
        diff = _generate_unified_diff(original_content, content, rel_path)
        diff_preview = diff[:500] + "..." if len(diff) > 500 else diff
        fuzzy_note = " (含模糊匹配恢复)" if fuzzy_used else ""
        return ToolCallResult(
            tool="multi_edit",
            input=args,
            output=f"成功应用 {applied}/{len(edits)} 个替换{fuzzy_note}\n\n变更预览:\n{diff_preview}",
            success=True,
        )
    except PermissionError as e:
        return ToolCallResult(tool="multi_edit", input=args, output="", error=str(e), success=False)
    except Exception as e:
        return ToolCallResult(tool="multi_edit", input=args, output="", error=str(e), success=False)


# ---------------------------------------------------------------------------
# Web 工具 (web_fetch) — URL 抓取
# ---------------------------------------------------------------------------

async def tool_web_fetch(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """抓取 URL 内容并返回。"""
    try:
        import httpx

        url = args["url"]
        max_length = args.get("max_length", 10000)

        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "IHUI-Agent/1.0"})
            if resp.status_code != 200:
                return ToolCallResult(
                    tool="web_fetch",
                    input=args,
                    output="",
                    error=f"HTTP {resp.status_code}",
                    success=False,
                )
            content_type = resp.headers.get("content-type", "")
            text = resp.text[:max_length]
            return ToolCallResult(
            tool="web_fetch",
            input=args,
            output=f"[URL] {url}\n[Status] {resp.status_code}\n[Content-Type] {content_type}\n\n{text}",
            success=True,
        )
    except Exception as e:
        return ToolCallResult(tool="web_fetch", input=args, output="", error=str(e), success=False)


# ---------------------------------------------------------------------------
# Web 搜索 (web_search) — DuckDuckGo 即时搜索 (无需 API Key)
# ---------------------------------------------------------------------------

async def tool_web_search(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """使用 DuckDuckGo Instant Answer API 搜索。"""
    try:
        import httpx

        query = args["query"]
        max_results = args.get("max_results", 5)

        # DuckDuckGo Instant Answer API (无需 API Key)
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://api.duckduckgo.com/",
                params={
                    "q": query,
                    "format": "json",
                    "no_redirect": "1",
                    "no_html": "1",
                },
                headers={"User-Agent": "IHUI-Agent/1.0"},
            )

            results: list[str] = []
            if resp.status_code == 200:
                data = resp.json()

                # Abstract (主要答案)
                if data.get("AbstractText"):
                    results.append(f"## {data.get('Heading', query)}")
                    results.append(data["AbstractText"])
                    if data.get("AbstractURL"):
                        results.append(f"来源: {data['AbstractURL']}")

                # Related Topics
                topics = data.get("RelatedTopics", [])
                count = 0
                for topic in topics:
                    if count >= max_results:
                        break
                    if isinstance(topic, dict) and topic.get("Text"):
                        results.append(f"- {topic['Text']}")
                        if topic.get("FirstURL"):
                            results.append(f"  URL: {topic['FirstURL']}")
                        count += 1
                    elif isinstance(topic, dict) and topic.get("Topics"):
                        # 嵌套话题
                        for sub in topic["Topics"]:
                            if count >= max_results:
                                break
                            if isinstance(sub, dict) and sub.get("Text"):
                                results.append(f"- {sub['Text']}")
                                count += 1

            if not results:
                results.append(f"(未找到 '{query}' 的搜索结果)")
                # 回退: 提供搜索链接
                results.append(f"建议访问: https://duckduckgo.com/?q={query.replace(' ', '+')}")

            return ToolCallResult(
                tool="web_search",
                input=args,
                output="\n".join(results),
                success=True,
            )
    except Exception as e:
        return ToolCallResult(tool="web_search", input=args, output="", error=str(e), success=False)


# ---------------------------------------------------------------------------
# 任务清单 (todo_write / todo_read) — 对标 Claude Code TodoWrite
# ---------------------------------------------------------------------------

# 会话级任务存储 (workspace → list of todos)
_todo_store: dict[str, list[dict[str, Any]]] = {}


async def tool_todo_write(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """写入/更新任务清单。"""
    try:
        todos = args.get("todos", [])
        _todo_store[workspace] = todos
        lines = ["## 任务清单"]
        for i, t in enumerate(todos, 1):
            status_icon = {"pending": "○", "in_progress": "◐", "completed": "●"}.get(t.get("status", "pending"), "○")
            priority_tag = f"[{t.get('priority', 'medium')}]" if t.get("priority") else ""
            lines.append(f"{i}. {status_icon} {t['content']} {priority_tag}")
        return ToolCallResult(
            tool="todo_write",
            input=args,
            output="\n".join(lines),
            success=True,
        )
    except Exception as e:
        return ToolCallResult(tool="todo_write", input=args, output="", error=str(e), success=False)


async def tool_todo_read(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """读取当前任务清单。"""
    todos = _todo_store.get(workspace, [])
    if not todos:
        return ToolCallResult(tool="todo_read", input=args, output="(无任务)", success=True)
    lines = ["## 任务清单"]
    for i, t in enumerate(todos, 1):
        status_icon = {"pending": "○", "in_progress": "◐", "completed": "●"}.get(t.get("status", "pending"), "○")
        lines.append(f"{i}. {status_icon} {t['content']}")
    return ToolCallResult(tool="todo_read", input=args, output="\n".join(lines), success=True)


# ---------------------------------------------------------------------------
# Git 工具 (git_status / git_diff / git_log)
# ---------------------------------------------------------------------------

async def _run_git(command: list[str], workspace: str) -> tuple[str, str, int]:
    """执行 git 命令的辅助函数。"""
    try:
        proc = await asyncio.to_thread(
            subprocess.run,
            ["git"] + command,
            cwd=workspace,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return proc.stdout, proc.stderr, proc.returncode
    except Exception as e:
        return "", str(e), -1


async def tool_git_status(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """查看 git 状态。"""
    stdout, stderr, code = await _run_git(["status", "--short", "--branch"], workspace)
    if code != 0:
        return ToolCallResult(tool="git_status", input=args, output="", error=f"git 错误: {stderr}", success=False)
    return ToolCallResult(tool="git_status", input=args, output=stdout or "(干净)", success=True)


async def tool_git_diff(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """查看 git diff。"""
    staged = args.get("staged", False)
    path = args.get("path")
    cmd = ["diff"]
    if staged:
        cmd.append("--cached")
    if path:
        cmd.append("--")
        cmd.append(path)
    stdout, stderr, code = await _run_git(cmd, workspace)
    if code != 0:
        return ToolCallResult(tool="git_diff", input=args, output="", error=f"git 错误: {stderr}", success=False)
    return ToolCallResult(tool="git_diff", input=args, output=stdout or "(无差异)", success=True)


async def tool_git_log(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """查看 git 日志。"""
    limit = args.get("limit", 20)
    oneline = args.get("oneline", True)
    cmd = ["log", f"-{limit}"]
    if oneline:
        cmd.append("--oneline")
    stdout, stderr, code = await _run_git(cmd, workspace)
    if code != 0:
        return ToolCallResult(tool="git_log", input=args, output="", error=f"git 错误: {stderr}", success=False)
    return ToolCallResult(tool="git_log", input=args, output=stdout or "(无日志)", success=True)


# ---------------------------------------------------------------------------
# Checkpoint 工具 (对标 Aider git revert / Gemini checkpointing)
# ---------------------------------------------------------------------------

async def tool_undo(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """撤销最近一次文件修改 (基于检查点快照恢复)。"""
    try:
        from app.api.v1.workspace.checkpoint import undo_last

        result = undo_last(workspace)
        return ToolCallResult(
            tool="undo",
            input=args,
            output=result["message"],
            success=result["success"],
            error="" if result["success"] else result["message"],
        )
    except Exception as e:
        return ToolCallResult(tool="undo", input=args, output="", error=str(e), success=False)


async def tool_list_checkpoints(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """列出最近的检查点历史。"""
    try:
        from app.api.v1.workspace.checkpoint import list_checkpoints

        limit = args.get("limit", 20)
        checkpoints = list_checkpoints(workspace, limit)
        if not checkpoints:
            return ToolCallResult(
                tool="list_checkpoints",
                input=args,
                output="(无检查点历史)",
                success=True,
            )
        lines = []
        for cp in checkpoints:
            status = "✓已应用" if cp["applied"] else "✗已撤销"
            files = ", ".join(cp["files"]) if cp["files"] else "(无文件)"
            lines.append(f"[{cp['id']}] {cp['tool']} — {cp['description']} [{status}] 文件: {files}")
        return ToolCallResult(
            tool="list_checkpoints",
            input=args,
            output="\n".join(lines),
            success=True,
        )
    except Exception as e:
        return ToolCallResult(tool="list_checkpoints", input=args, output="", error=str(e), success=False)


async def tool_rollback(args: dict[str, Any], workspace: str) -> ToolCallResult:
    """回滚到指定检查点 (撤销该检查点及之后所有修改)。"""
    try:
        from app.api.v1.workspace.checkpoint import rollback_to

        checkpoint_id = args.get("checkpoint_id", "")
        if not checkpoint_id:
            return ToolCallResult(
                tool="rollback",
                input=args,
                output="",
                error="缺少 checkpoint_id 参数",
                success=False,
            )
        result = rollback_to(workspace, checkpoint_id)
        return ToolCallResult(
            tool="rollback",
            input=args,
            output=result["message"],
            success=result["success"],
            error="" if result["success"] else result["message"],
        )
    except Exception as e:
        return ToolCallResult(tool="rollback", input=args, output="", error=str(e), success=False)


# ---------------------------------------------------------------------------
# 工具分发器
# ---------------------------------------------------------------------------

TOOL_DISPATCH: dict[str, Any] = {
    "read_file": tool_read_file,
    "write_file": tool_write_file,
    "edit_file": tool_edit_file,
    "multi_edit": tool_multi_edit,
    "delete_file": tool_delete_file,
    "list_dir": tool_list_dir,
    "glob": tool_glob,
    "grep": tool_grep,
    "run_command": tool_run_command,
    "web_fetch": tool_web_fetch,
    "web_search": tool_web_search,
    "todo_write": tool_todo_write,
    "todo_read": tool_todo_read,
    "git_status": tool_git_status,
    "git_diff": tool_git_diff,
    "git_log": tool_git_log,
    # Checkpoint 工具 (对标 Aider/Gemini 回滚能力)
    "undo": tool_undo,
    "list_checkpoints": tool_list_checkpoints,
    "rollback": tool_rollback,
    # task 工具由 subagents 模块提供, 延迟注册
}


async def execute_tool(name: str, args: dict[str, Any], workspace: str) -> ToolCallResult:
    """执行工具调用。

    Args:
        name: 工具名
        args: 工具参数
        workspace: 工作区根路径 (沙箱)

    Returns:
        ToolCallResult
    """
    handler = TOOL_DISPATCH.get(name)
    if not handler:
        return ToolCallResult(
            tool=name,
            input=args,
            output="",
            error=f"未知工具: {name}. 可用: {list(TOOL_DISPATCH.keys())}",
            success=False,
        )
    return await handler(args, workspace)
