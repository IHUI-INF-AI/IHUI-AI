# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批次 2(2026-11-06 立):审批请求的结构化决策信息(两条审批链共用一份实现)。

为什么要有这一层
  审批弹窗此前只拿到 `tool_name + args_preview(裸 JSON 前 200 字)+ danger_level`。
  用户要点"允许执行命令"时,看不到将被执行的命令、在哪个目录执行、会碰哪些文件;
  裸 JSON 既不可读,又因截断丢掉关键字段。Trae/Codex 的审批面给的是**决策信息**
  而不是参数 dump。

本模块把 `(工具名, 参数)` 归一为 7 个可渲染字段(snake_case,两条链路一致):
  - reason_code     封闭集,为什么弹窗(执行/写/删/网络/库/高危/未知);
  - risk_level      low|medium|high,风险档(调用方已有的档优先,缺省由工具类推导);
  - argv            命令类工具的规范化参数数组(可空);
  - cwd             执行目录(只认参数里的声明,不反推);
  - affected_paths  受影响路径(最多 20 条、每条截断 260 字符);
  - scope           作用域封闭集 fs_read|fs_write|fs_delete|exec|network|db|other;
  - summary         一句人话摘要(命令文本/SQL/路径/URL),上限 120 字符。

三条纪律:
 ① **纯函数、无 I/O**:描述器不读盘、不探测进程,相同输入必得相同输出;
 ② **不编造**:参数里没有 cwd 就是 None,前端渲染"未上报",不填默认值;
 ③ **只给决策必需信息**:长参数/大文件正文不进帧(正文仍在 args_preview 兜底),
    避免审批通道变成第二个数据外泄面。
"""

from __future__ import annotations

import re
from typing import Any

# 原因码封闭集(TS 侧 packages/shared/src/sse/contract.ts 为权威镜像)。
REASON_CODES: tuple[str, ...] = (
    "dangerous_command",
    "destructive_operation",
    "writes_files",
    "deletes_files",
    "executes_command",
    "network_access",
    "database_write",
    "high_risk_tool",
    "requires_confirmation",
)

# 作用域封闭集(表示这次操作影响哪个面,不是审批授权作用域)。
OPERATION_SCOPES: tuple[str, ...] = (
    "fs_read",
    "fs_write",
    "fs_delete",
    "exec",
    "network",
    "db",
    "other",
)

RISK_LEVELS: tuple[str, ...] = ("low", "medium", "high")

_MAX_ARGV_ITEMS = 64
_MAX_PATHS = 20
_MAX_PATH_CHARS = 260
_MAX_SUMMARY_CHARS = 120

_EXEC_TOOLS = frozenset(
    {
        "run_command",
        "bash",
        "exec",
        "execute_command",
        "shell",
        "shell_command",
        "run_shell",
        "terminal",
    }
)
_FILE_WRITE_TOOLS = frozenset(
    {
        "write_file",
        "file_edit",
        "edit_file",
        "create_file",
        "apply_patch",
        "create_document",
        "generate_test",
    }
)
_FILE_DELETE_TOOLS = frozenset({"delete_file", "remove_file", "fs_delete"})
_FILE_READ_TOOLS = frozenset(
    {
        "read_file",
        "list_files",
        "list_dir",
        "read_dir",
        "file_search",
        "search_codebase",
        "read_tool_output",
    }
)
_NETWORK_TOOLS = frozenset(
    {
        "fetch_url",
        "fetch_readable",
        "web_search",
        "search_web",
        "image_search",
        "map_site",
        "crawl_site",
        "browser_navigate",
        "browser_open",
        "screenshot_url",
    }
)
_DB_TOOLS = frozenset({"db_query", "database_query", "sql_query"})

_PATH_KEYS: tuple[str, ...] = (
    "path",
    "file_path",
    "filePath",
    "dir",
    "directory",
    "target",
    "target_path",
    "targetPath",
    "output_path",
    "outputPath",
    "files",
    "paths",
)
_CWD_KEYS: tuple[str, ...] = (
    "cwd",
    "working_directory",
    "workingDirectory",
    "workdir",
    "directory",
)
_ARGV_KEYS: tuple[str, ...] = ("argv", "command", "cmd")

# 破坏性命令静态词(仅用于**描述分级**,不替代执行侧 `_match_destructive_command`
# 的硬门;两边判定可以不一致 —— 这里判重了只是文案更醒目,判轻了也仍会弹窗)。
_DESTRUCTIVE_PATTERNS = (
    r"(?i)(?:^|[\s&|;])\s*(?:rm|del|rd|rmdir)\b[^|]*?(?:-rf|-r\s|-recurse|/s|/f)",
    r"(?i)(?:^|[\s&|;])\s*(?:format|diskpart|mkfs|shutdown|reboot)\b",
    r"(?i)(?:^|[\s&|;])\s*dd\b[^|]*?of=",
    r"(?i)(?:^|[\s&|;])\s*git\s+(?:push|reset|clean)\b",
    r"(?i)(?:^|[\s&|;])\s*reg\s+delete\b",
)


def _clip(value: str, limit: int) -> str:
    text = value.strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _collect_paths(args: Any) -> list[str]:
    if not isinstance(args, dict):
        return []
    found: list[str] = []
    for key in _PATH_KEYS:
        value = args.get(key)
        candidates: list[Any] = []
        if isinstance(value, str):
            candidates = [value]
        elif isinstance(value, (list, tuple)):
            candidates = list(value)
        for item in candidates:
            if not isinstance(item, str):
                continue
            path = _clip(item, _MAX_PATH_CHARS)
            if path and path not in found:
                found.append(path)
            if len(found) >= _MAX_PATHS:
                return found
    return found


def _collect_argv(args: Any, tool_name: str) -> list[str] | None:
    if not isinstance(args, dict):
        return None
    for key in _ARGV_KEYS:
        value = args.get(key)
        if isinstance(value, (list, tuple)) and value:
            items = [str(v) for v in value if str(v).strip()]
            if items:
                return items[:_MAX_ARGV_ITEMS]
        if isinstance(value, str) and value.strip():
            # 命令字符串只在执行类工具上当作 argv 展示;写文件工具里的 "content"
            # 不是命令,不能误标。
            if tool_name in _EXEC_TOOLS:
                return value.strip().split()[: _MAX_ARGV_ITEMS]
    return None


def _collect_cwd(args: Any) -> str | None:
    if not isinstance(args, dict):
        return None
    for key in _CWD_KEYS:
        value = args.get(key)
        if isinstance(value, str) and value.strip():
            return _clip(value, _MAX_PATH_CHARS)
    return None


def _classify_scope(tool_name: str) -> str:
    name = tool_name.strip()
    if name in _EXEC_TOOLS:
        return "exec"
    if name in _FILE_DELETE_TOOLS or name.startswith("file_delete"):
        return "fs_delete"
    if name in _FILE_WRITE_TOOLS or name.startswith("file_write"):
        return "fs_write"
    if name in _FILE_READ_TOOLS or name.startswith("file_read"):
        return "fs_read"
    if name in _DB_TOOLS or name.startswith("db_"):
        return "db"
    if name in _NETWORK_TOOLS or name.startswith("browser_") or name.startswith("web_"):
        return "network"
    return "other"


def _is_destructive(argv: list[str] | None, command: str | None) -> bool:
    text = command or (" ".join(argv) if argv else "")
    if not text:
        return False
    return any(re.search(pattern, text) for pattern in _DESTRUCTIVE_PATTERNS)


def _derive_risk(tool_name: str, scope: str, destructive: bool) -> str:
    if destructive or scope in ("fs_delete", "db", "exec"):
        return "high"
    if scope in ("fs_write", "network"):
        return "medium"
    if tool_name.startswith("computer_"):
        return "high"
    return "medium"


def _build_summary(
    tool_name: str, scope: str, argv: list[str] | None, args: Any, paths: list[str]
) -> str:
    command = ""
    if isinstance(args, dict):
        raw_command = args.get("command") or args.get("cmd")
        if isinstance(raw_command, str):
            command = raw_command.strip()
    if scope == "exec":
        text = command or (" ".join(argv) if argv else "")
        return _clip(f"执行命令:{text}" if text else f"执行命令({tool_name})", _MAX_SUMMARY_CHARS)
    if scope == "fs_write":
        target = paths[0] if paths else ""
        return _clip(f"写入文件:{target}" if target else f"写入文件({tool_name})", _MAX_SUMMARY_CHARS)
    if scope == "fs_delete":
        target = "、".join(paths[:3])
        return _clip(f"删除路径:{target}" if target else f"删除路径({tool_name})", _MAX_SUMMARY_CHARS)
    if scope == "fs_read":
        target = paths[0] if paths else ""
        return _clip(f"读取:{target}" if target else f"读取({tool_name})", _MAX_SUMMARY_CHARS)
    if scope == "network":
        url = ""
        if isinstance(args, dict):
            for key in ("url", "href", "endpoint", "target_url", "targetUrl"):
                value = args.get(key)
                if isinstance(value, str) and value.strip():
                    url = value.strip()
                    break
        return _clip(f"访问网络:{url}" if url else f"访问网络({tool_name})", _MAX_SUMMARY_CHARS)
    if scope == "db":
        sql = ""
        if isinstance(args, dict):
            value = args.get("sql") or args.get("query")
            if isinstance(value, str):
                sql = value.strip()
        return _clip(f"执行数据库语句:{sql}" if sql else f"执行数据库语句({tool_name})", _MAX_SUMMARY_CHARS)
    return _clip(f"调用工具:{tool_name}", _MAX_SUMMARY_CHARS)


def describe_tool_request(
    tool_name: str,
    args: Any,
    *,
    risk_level: str | None = None,
) -> dict[str, Any]:
    """把一次工具调用归为结构化审批决策信息(纯函数)。

    返回键恒齐(值为 None 表示参数里确实没有该事实,而不是"默认值"):
    `reason_code/risk_level/argv/cwd/affected_paths/scope/summary`。

    `risk_level` 传入调用方已有的风险档(如主对话流的 `_danger`)时以其为准 ——
    判定只允许一个出口,描述器不另造第二套风险口径。
    """
    name = str(tool_name or "")
    scope = _classify_scope(name)
    argv = _collect_argv(args, name)
    cwd = _collect_cwd(args)
    paths = _collect_paths(args)

    command = None
    if isinstance(args, dict):
        raw = args.get("command") or args.get("cmd")
        if isinstance(raw, str):
            command = raw

    destructive = scope in ("fs_delete", "exec") and _is_destructive(argv, command)
    if destructive:
        reason = "destructive_operation"
    elif scope == "exec":
        reason = "executes_command"
    elif scope == "fs_delete":
        reason = "deletes_files"
    elif scope == "fs_write":
        reason = "writes_files"
    elif scope == "network":
        reason = "network_access"
    elif scope == "db":
        # 弹窗只出现在需要人工确认的库操作上;语句文本仍在 args_preview 里,
        # 此处只给"这是数据库写面"这一档,不再按 SQL 关键字拆第二套原因码。
        reason = "database_write"
    elif name.startswith("computer_"):
        reason = "high_risk_tool"
    else:
        reason = "requires_confirmation"

    resolved_risk = (
        risk_level
        if risk_level in RISK_LEVELS
        else _derive_risk(name, scope, destructive)
    )
    return {
        "reason_code": reason,
        "risk_level": resolved_risk,
        "argv": argv,
        "cwd": cwd,
        "affected_paths": paths,
        "scope": scope,
        "summary": _build_summary(name, scope, argv, args, paths),
    }


__all__ = [
    "REASON_CODES",
    "OPERATION_SCOPES",
    "RISK_LEVELS",
    "describe_tool_request",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
