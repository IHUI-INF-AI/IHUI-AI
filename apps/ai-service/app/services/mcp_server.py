"""MCP 服务端。

定义 11 个工具、3 个资源、3 个提示词,并提供统一的查询/调用接口。
工具实现为真实文件系统/网络操作,无外部依赖时返回降级结果。
"""

import asyncio
import difflib
import os
import re
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qs, quote_plus, urlparse

# 2026-07-22 P1 鲁棒性加固:MCP tool 全局超时,防 handler 无限挂起
MCP_GLOBAL_TIMEOUT = 120

from .skills import skill_registry


# ---------------------------------------------------------------------------
# 安全常量(2026-07-22 P0 Round 2 鲁棒性加固)
# ---------------------------------------------------------------------------

# 工作区根目录白名单:MCP read_file/write_file 只允许读写白名单内文件
# 从 env MCP_WORKSPACE_ROOTS 读取(分隔符 os.pathsep),默认当前工作目录
_WORKSPACE_ROOTS: list[str] = [
    os.path.abspath(r)
    for r in os.environ.get("MCP_WORKSPACE_ROOTS", os.getcwd()).split(os.pathsep)
    if r.strip()
]

# 工具权限矩阵:admin 专属工具(role >= 1),其他工具所有用户可用
# 危险工具:写文件 / 执行命令 / 数据库查询 / git 操作 / 自动化配置 / 电脑控制 / 截图(SSRF 入口)
_ADMIN_ONLY_TOOLS: set[str] = {
    "write_file", "run_command", "db_query", "git_operations",
    "configure_automation_task",
    # 2026-07-24 file_edit:写文件操作(精细编辑),必须 admin
    "file_edit",
    # computer_* 系列:控制电脑是高危操作,需 admin
    "computer_screenshot_screen", "computer_mouse_move", "computer_mouse_click",
    "computer_keyboard_type", "computer_mouse_scroll", "computer_keyboard_press",
    "computer_keyboard_hotkey", "computer_active_window",
    "computer_clipboard_get", "computer_clipboard_set",
    # 2026-07-24 安全加固:screenshot_url 是 SSRF 入口(Playwright 访问任意 URL),
    # 即使有 _validate_url_ssrf 校验,仍限定 admin 调用,defense-in-depth
    "screenshot_url",
    # 2026-07-24 扩展工具(对标 Trae Work + Codex 核心能力):
    # fetch_url:SSRF 入口 + 可探测内网;image_generation:外部 API 调用 + 计费;
    # review_pr:GitHub API + 可能暴露源代码;schedule_task:调度后台任务
    "fetch_url",
    "image_generation",
    "review_pr",
    "schedule_task",
}

# agent_control 内部调用密钥(从 settings 读取,确保 .env 配置生效)
# 2026-07-22 修复:原 os.environ.get 在模块加载时求值,main.py 同步 os.environ 晚于本模块导入 → 永远为空
# 改为函数调用时动态读取,确保 .env 配置已加载
def _get_agent_control_secret() -> str:
    from ..core.config import settings
    return settings.agent_control_internal_secret or os.environ.get("AGENT_CONTROL_INTERNAL_SECRET", "")


def _validate_path_in_workspace(path: str) -> tuple[bool, str]:
    """校验路径在工作区白名单内,防 symlink 穿越。

    Returns:
        (ok, resolved_path) 或 (False, error_message)
    """
    from pathlib import Path

    if not path:
        return False, "路径为空"
    try:
        # resolve(strict=False) 解析 symlink + .. ,但不要求路径存在
        resolved = Path(path).resolve(strict=False)
        resolved_str = str(resolved)
        # 检查 resolved 是否在任一白名单根目录下(防 symlink 穿越到 /etc/passwd 等)
        for root in _WORKSPACE_ROOTS:
            try:
                resolved.relative_to(root)
                return True, resolved_str
            except ValueError:
                continue
        return False, (
            f"路径不在工作区白名单内: {path}"
            f"(允许根目录: {_WORKSPACE_ROOTS})"
        )
    except Exception as e:
        return False, f"路径解析失败: {e}"


# 2026-07-24 安全加固:敏感文件读取黑名单(防 MCP read_file 泄露凭证)
# 匹配文件名(basename)或路径片段,命中即拒绝读取。
_SENSITIVE_FILE_PATTERNS = (
    ".env",                # .env / .env.production / .env.local
    ".npmrc",              # npm token
    ".pypirc",             # pip token
    ".netrc",              # HTTP 凭证
    "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519",  # SSH 私钥
    "credentials.json",    # GCP/AWS 凭证
    "service_account.json",  # GCP 服务账号
)
_SENSITIVE_FILE_EXTENSIONS = (
    ".key", ".pem", ".crt", ".pfx", ".p12",  # 私钥/证书
    ".keystore", ".jks",  # Java 密钥库
    ".kdbx",  # KeePass 数据库
)


def _is_sensitive_file(path: str) -> bool:
    """检查路径是否为敏感文件(可能含 API key/私钥/凭证)。

    匹配规则:
      1. 文件名 basename 命中 _SENSITIVE_FILE_PATTERNS(含前缀匹配,如 .env.production)
      2. 扩展名命中 _SENSITIVE_FILE_EXTENSIONS
    """
    import os
    basename = os.path.basename(path).lower()
    # 精确匹配 + 前缀匹配(如 .env 匹配 .env / .env.local / .env.production)
    for pat in _SENSITIVE_FILE_PATTERNS:
        if basename == pat or basename.startswith(pat + ".") or basename.startswith(pat + "_"):
            return True
    # 扩展名匹配
    for ext in _SENSITIVE_FILE_EXTENSIONS:
        if basename.endswith(ext):
            return True
    return False


# ---------------------------------------------------------------------------
# 数据模型
# ---------------------------------------------------------------------------


@dataclass
class MCPTool:
    """MCP 工具定义。"""

    name: str
    description: str
    input_schema: dict[str, Any]


@dataclass
class MCPResource:
    """MCP 资源定义。"""

    uri: str
    name: str
    description: str
    mime_type: str = "application/json"


@dataclass
class MCPPrompt:
    """MCP 提示词定义。"""

    name: str
    description: str
    arguments: list[dict[str, Any]]


# ---------------------------------------------------------------------------
# 工具实现(11 个)
# ---------------------------------------------------------------------------


async def _tool_search_codebase(arguments: dict[str, Any]) -> dict[str, Any]:
    """search_codebase: 代码符号搜索(真实文件系统)。

    专注于代码符号(函数/类/方法定义 + 引用)的搜索,支持:
    - query: 符号名或关键词(如函数名、类名)
    - path: 搜索根目录(默认当前目录)
    - pattern: 文件名 glob 限定(默认 *.py/*.ts/*.tsx/*.js/*.jsx/*.go/*.rs/*.java)
    - max_results: 最大返回数(默认 50)
    - symbol_type: 符号类型过滤(def/class/func/function/interface/type,默认空=全部)
    - 忽略常见依赖/构建/缓存目录
    - 忽略二进制文件
    - 返回: 文件路径 + 行号 + 符号类型 + 代码行 + 上下文预览
    """
    query = arguments.get("query", "")
    path = arguments.get("path", ".")
    pattern = arguments.get("pattern", "")
    max_results = int(arguments.get("max_results", 50))
    symbol_type = arguments.get("symbol_type", "").strip().lower()
    # 2026-07-22 新增:语义搜索开关(默认 True,失败/无结果时 fallback 到 regex)
    use_semantic = arguments.get("use_semantic", True)

    # 默认代码文件扩展名(若未指定 pattern)
    _CODE_EXTS = {
        ".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
        ".go", ".rs", ".java", ".kt", ".swift", ".c", ".h", ".cpp", ".cc", ".hpp",
        ".cs", ".rb", ".php", ".scala", ".clj", ".el", ".ex", ".exs",
        ".vue", ".svelte", ".astro",
        ".sql", ".sh", ".bash", ".zsh", ".ps1",
        ".yml", ".yaml", ".toml", ".json", ".xml", ".html", ".css", ".scss",
    }
    # 忽略目录
    _IGNORED_DIRS = {
        "node_modules", ".git", "__pycache__", ".venv", "venv",
        "dist", "build", ".next", ".turbo", ".cache", "coverage",
        ".mypy_cache", ".pytest_cache", ".ruff_cache", ".tox", "env",
    }
    # 符号定义模式(按语言)
    # 匹配 def/class/func/function/interface/type 等关键字后跟符号名
    _SYMBOL_PATTERNS = {
        "def": re.compile(r"^\s*(?:async\s+def|def)\s+(\w+)", re.MULTILINE),  # Python
        "class": re.compile(r"^\s*(?:abstract\s+class|class|interface|trait)\s+(\w+)", re.MULTILINE),
        "func": re.compile(r"^\s*func\s+(\w+)", re.MULTILINE),  # Go
        "function": re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)", re.MULTILINE),  # JS/TS
        "interface": re.compile(r"^\s*(?:export\s+)?interface\s+(\w+)", re.MULTILINE),  # TS
        "type": re.compile(r"^\s*(?:export\s+)?type\s+(\w+)", re.MULTILINE),  # TS
    }

    if not query:
        return {
            "tool": "search_codebase",
            "query": query,
            "path": path,
            "matches": [],
            "message": "搜索关键词为空",
            "ok": False,
        }

    # 2026-07-22 新增:语义搜索路径(pgvector ANN,优先于 regex)
    # 失败或无结果时静默 fallback 到下方 regex 路径
    if use_semantic:
        try:
            from .codebase_indexer import codebase_indexer
            semantic_results = await codebase_indexer.search(query, top_k=max_results)
            if semantic_results:
                matches: list[dict[str, Any]] = []
                for r in semantic_results[:max_results]:
                    content_preview = r.get("content", "")
                    if len(content_preview) > 500:
                        content_preview = content_preview[:500]
                    matches.append({
                        "path": r.get("filePath", ""),
                        "file": r.get("filePath", "").rsplit("/", 1)[-1],
                        "line": r.get("lineStart", 0),
                        "symbol_type": r.get("symbolType", "semantic"),
                        "symbol_name": r.get("symbolName", ""),
                        "code": content_preview[:200],
                        "preview": content_preview,
                        "score": round(r.get("score", 0), 4),
                    })
                return {
                    "tool": "search_codebase",
                    "query": query,
                    "path": path,
                    "use_semantic": True,
                    "matches": matches,
                    "total": len(matches),
                    "truncated": False,
                    "message": f"语义搜索找到 {len(matches)} 个匹配(pgvector ANN)",
                    "ok": True,
                }
        except Exception as e:
            import logging as _logging
            _logging.getLogger(__name__).debug(
                "semantic search failed, fallback to regex: %s", e
            )

    try:
        from pathlib import Path
        import fnmatch
        import os

        root = Path(path).resolve()
        if not root.exists():
            return {
                "tool": "search_codebase",
                "query": query,
                "path": path,
                "matches": [],
                "message": f"路径不存在: {path}",
                "ok": False,
            }
        if not root.is_dir():
            return {
                "tool": "search_codebase",
                "query": query,
                "path": path,
                "matches": [],
                "message": f"路径不是目录: {path}",
                "ok": False,
            }

        # 构建 pattern 列表(支持逗号分隔多 pattern)
        if pattern:
            patterns = [p.strip() for p in pattern.split(",") if p.strip()]
        else:
            patterns = []  # 用扩展名过滤

        query_lower = query.lower()
        matches: list[dict[str, Any]] = []
        count = 0

        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in _IGNORED_DIRS]
            for fname in filenames:
                if count >= max_results:
                    break
                # pattern 或扩展名过滤
                if patterns:
                    if not any(fnmatch.fnmatch(fname, p) for p in patterns):
                        continue
                else:
                    ext = os.path.splitext(fname)[1].lower()
                    if ext not in _CODE_EXTS:
                        continue

                fpath = os.path.join(dirpath, fname)
                try:
                    with open(fpath, encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                except OSError:
                    continue

                lines = content.splitlines()
                rel_path = os.path.relpath(fpath, root)

                # 先快速过滤:文件内容必须含 query(大小写不敏感)
                if query_lower not in content.lower():
                    continue

                # 1) 符号定义匹配:扫描每种符号模式
                symbol_matches: list[tuple[int, str, str]] = []  # (line_no, sym_type, line_text)
                for sym_type, sym_re in _SYMBOL_PATTERNS.items():
                    if symbol_type and sym_type != symbol_type:
                        continue
                    for m in sym_re.finditer(content):
                        sym_name = m.group(1)
                        if sym_name.lower() == query_lower or query_lower in sym_name.lower():
                            # 计算 line_no
                            line_no = content.count("\n", 0, m.start()) + 1
                            line_text = lines[line_no - 1] if 0 < line_no <= len(lines) else ""
                            symbol_matches.append((line_no, sym_type, line_text))

                # 2) 通用行匹配(任意包含 query 的行)
                line_matches: list[tuple[int, str]] = []  # (line_no, line_text)
                for i, ln in enumerate(lines):
                    if query_lower in ln.lower():
                        line_matches.append((i + 1, ln))

                # 合并:符号匹配优先,再补通用行匹配(去重)
                seen_lines = {ln for ln, _, _ in symbol_matches}
                for ln, txt in line_matches:
                    if ln not in seen_lines:
                        symbol_matches.append((ln, "reference", txt))
                        seen_lines.add(ln)

                if not symbol_matches:
                    continue

                # 限制每个文件最多 10 条匹配
                for line_no, sym_type, line_text in symbol_matches[:10]:
                    # 提取上下文(前后各 2 行)
                    start = max(0, line_no - 3)
                    end = min(len(lines), line_no + 2)
                    preview = "\n".join(
                        f"{start + j + 1}: {lines[start + j]}" for j in range(end - start)
                    )
                    matches.append({
                        "path": rel_path,
                        "file": fname,
                        "line": line_no,
                        "symbol_type": sym_type,
                        "code": line_text.strip()[:200],
                        "preview": preview[:500],
                    })
                    count += 1
                    if count >= max_results:
                        break

            if count >= max_results:
                break

        return {
            "tool": "search_codebase",
            "query": query,
            "path": path,
            "pattern": pattern,
            "symbol_type": symbol_type,
            "matches": matches,
            "total": len(matches),
            "truncated": count >= max_results,
            "message": f"在 {path} 下找到 {len(matches)} 个匹配"
                       + ("(已截断)" if count >= max_results else ""),
            "ok": True,
        }
    except Exception as e:
        return {
            "tool": "search_codebase",
            "query": query,
            "path": path,
            "matches": [],
            "message": f"搜索失败: {e}",
            "ok": False,
            "error": str(e),
        }


async def _tool_read_file(arguments: dict[str, Any]) -> dict[str, Any]:
    """read_file: 读取文件内容(路径必须在工作区白名单内,防 symlink 穿越)。"""
    path = arguments.get("path", "")
    ok, info = _validate_path_in_workspace(path)
    if not ok:
        return {"tool": "read_file", "path": path, "content": "", "ok": False, "error": info}
    resolved_path = info
    # 2026-07-24 安全加固:敏感文件读取拦截(防 .env/*.key/*.pem 泄露 API key/私钥)
    # 工作区白名单只防路径穿越,不防敏感文件内容泄露;此处补敏感文件名黑名单。
    if _is_sensitive_file(resolved_path):
        return {
            "tool": "read_file",
            "path": resolved_path,
            "content": "",
            "ok": False,
            "error": "拒绝读取敏感文件(可能含 API key/私钥/凭证)",
            "errorCode": "SENSITIVE_FILE_BLOCKED",
        }
    try:
        with open(resolved_path, encoding="utf-8") as f:
            content = f.read()
        return {"tool": "read_file", "path": resolved_path, "content": content, "ok": True}
    except Exception as e:
        return {"tool": "read_file", "path": resolved_path, "content": "", "ok": False, "error": str(e)}


async def _tool_write_file(arguments: dict[str, Any]) -> dict[str, Any]:
    """write_file: 写入文件内容(路径必须在工作区白名单内,防 symlink 穿越)。"""
    path = arguments.get("path", "")
    content = arguments.get("content", "")
    ok, info = _validate_path_in_workspace(path)
    if not ok:
        return {"tool": "write_file", "path": path, "ok": False, "error": info}
    resolved_path = info
    try:
        with open(resolved_path, "w", encoding="utf-8") as f:
            f.write(content)
        return {"tool": "write_file", "path": resolved_path, "bytes_written": len(content.encode("utf-8")), "ok": True}
    except Exception as e:
        return {"tool": "write_file", "path": resolved_path, "ok": False, "error": str(e)}


async def _tool_file_edit(arguments: dict[str, Any]) -> dict[str, Any]:
    """file_edit: 精细编辑文件,精确替换 old_string 为 new_string,带 conflict 检测。

    对标 Trae Edit 工具:replace_all=false 时要求 old_string 唯一匹配,
    多个匹配报 AMBIGUOUS_MATCH 错误,避免误改多处。
    """
    def _err(code: str, msg: str, **extra) -> dict[str, Any]:
        return {"tool": "file_edit", "file_path": resolved_path, "ok": False,
                "error": msg, "errorCode": code, **extra}

    path = arguments.get("file_path", "")
    old_string = arguments.get("old_string", "")
    new_string = arguments.get("new_string", "")
    replace_all = bool(arguments.get("replace_all", False))

    if not old_string:
        return {"tool": "file_edit", "file_path": path, "ok": False,
                "error": "old_string 不能为空", "errorCode": "INVALID_ARGUMENT"}

    ok, info = _validate_path_in_workspace(path)
    if not ok:
        return {"tool": "file_edit", "file_path": path, "ok": False,
                "error": info, "errorCode": "PATH_NOT_ALLOWED"}
    resolved_path = info

    try:
        if not os.path.isfile(resolved_path):
            return _err("FILE_NOT_FOUND", "文件不存在")
        if os.path.getsize(resolved_path) > 10 * 1024 * 1024:
            return _err("FILE_TOO_LARGE", "文件大于 10MB,拒绝编辑")
        with open(resolved_path, "rb") as f:
            raw = f.read()
    except OSError as e:
        return _err("IO_ERROR", str(e))

    if b"\x00" in raw:
        return _err("BINARY_FILE", "文件含 NUL 字节,判定为二进制文件")
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError as e:
        return _err("BINARY_FILE", f"文件非 UTF-8: {e}")

    count = content.count(old_string)
    if count == 0:
        return _err("NOT_FOUND", "未找到要替换的字符串", match_count=0)
    if not replace_all and count >= 2:
        return _err("AMBIGUOUS_MATCH", f"找到 {count} 处匹配,需指定 replace_all=true 或提供更长上下文", match_count=count)

    if replace_all:
        new_content = content.replace(old_string, new_string)
        replaced_count = count
    else:
        new_content = content.replace(old_string, new_string, 1)
        replaced_count = 1

    backup_path = resolved_path + ".bak"
    try:
        with open(backup_path, "wb") as f:
            f.write(raw)
        with open(resolved_path, "wb") as f:
            f.write(new_content.encode("utf-8"))
    except OSError as e:
        # 失败回滚:恢复原内容(raw),删除 .bak(不保留)
        try:
            with open(resolved_path, "wb") as f:
                f.write(raw)
        except OSError:
            pass
        try:
            os.remove(backup_path)
        except OSError:
            pass
        return _err("IO_ERROR", str(e))

    diff = list(difflib.unified_diff(content.splitlines(keepends=True),
                new_content.splitlines(keepends=True), fromfile="old", tofile="new", n=2))
    return {"tool": "file_edit", "ok": True, "file_path": resolved_path,
            "replaced_count": replaced_count, "backup_path": backup_path,
            "diff_preview": "".join(diff[:20])}


async def _drain_stream(stream, lines_list: list[str]) -> None:
    """逐行读取 asyncio subprocess stream,累积到 lines_list(防长命令一次性读阻塞)。"""
    while True:
        line_bytes = await stream.readline()
        if not line_bytes:
            break
        lines_list.append(line_bytes.decode("utf-8", errors="replace").rstrip("\r\n"))


def _build_subprocess_env(user_env: dict | None) -> dict:
    """构建 subprocess env:复制 os.environ,合并用户 env(禁止覆盖 PATH/HOME)。

    2026-07-24 流式升级:支持 env 参数透传,但不允许覆盖 PATH/HOME(防劫持命令查找)。
    """
    env = dict(os.environ)
    if isinstance(user_env, dict):
        for k, v in user_env.items():
            if not isinstance(k, str) or not isinstance(v, (str, int, float)):
                continue
            if k.upper() in ("PATH", "HOME", "USERPROFILE"):
                continue  # 不允许覆盖 PATH/HOME
            env[k] = str(v)
    return env


async def _tool_run_command(arguments: dict[str, Any]) -> dict[str, Any]:
    """run_command: 运行 shell 命令(asyncio.subprocess 流式读取 stdout/stderr,长命令不超时)。

    出于安全考虑,仅允许只读/查询类命令,禁止任何修改/删除/网络写入操作。
    - command: 命令字符串(如 "git status", "ls -la", "python --version")
    - cwd: 工作目录(默认当前目录,需 _validate_path_in_workspace 校验)
    - timeout: 超时秒数(默认 60)
    - max_timeout: 超时上限(默认 600,timeout 不超过此值)
    - env: 环境变量 dict(不允许覆盖 PATH/HOME)
    - sandbox_backend: 沙箱后端(默认 local,可选 docker/ssh/modal/daytona/singularity)
    - 白名单: git/ls/cat/echo/python/node/npm/pnpm/tsc/ruff/mypy/pytest/find/grep/wc/head/tail 等
    - 禁止: rm/mv/cp/mkdir/curl/wget/dd/mkfs/>/>>/|/`/$() 等危险操作
    - 超时 → kill 进程 + 返回 partial_output + errorCode=TIMEOUT
    """
    command = arguments.get("command", "").strip()
    cwd = arguments.get("cwd", ".")
    sandbox_backend = arguments.get("sandbox_backend", "local")
    docker_image = arguments.get("docker_image", "python:3.12-slim")
    ssh_host = arguments.get("ssh_host")
    ssh_user = arguments.get("ssh_user", "root")
    user_env = arguments.get("env")

    max_timeout = max(1, int(arguments.get("max_timeout", 600)))
    timeout = max(1, min(int(arguments.get("timeout", 60)), max_timeout))

    if not command:
        return {
            "tool": "run_command", "command": command,
            "exit_code": -1, "stdout": "", "stderr": "",
            "ok": False, "streamed": True, "message": "命令为空",
        }

    # cwd 校验(非默认 . 时需在工作区白名单内,防任意目录读写)
    if cwd and cwd != ".":
        ok_cwd, cwd_info = _validate_path_in_workspace(cwd)
        if not ok_cwd:
            return {
                "tool": "run_command", "command": command,
                "exit_code": -1, "stdout": "", "stderr": "",
                "ok": False, "streamed": True,
                "errorCode": "PATH_NOT_ALLOWED",
                "message": f"cwd 不在工作区白名单: {cwd_info}",
            }
        cwd = cwd_info

    # 非 local 后端:委托 sandbox_executor(Docker/SSH/预留后端)
    if sandbox_backend != "local":
        from .sandbox import sandbox_executor
        result = await sandbox_executor.execute(
            command, backend=sandbox_backend, timeout=timeout, workdir=cwd,
            docker_image=docker_image, ssh_host=ssh_host, ssh_user=ssh_user,
        )
        return {
            "tool": "run_command", "command": command,
            "backend": sandbox_backend,
            "exit_code": result.exit_code, "stdout": result.stdout,
            "stderr": result.stderr, "duration_ms": result.duration_ms,
            "timed_out": result.timed_out, "ok": result.exit_code == 0,
            "streamed": False,
            "message": f"backend={sandbox_backend} exit_code={result.exit_code}",
        }

    # 危险字符/操作黑名单(Shell 注入 + 破坏性操作)
    _DANGEROUS_PATTERNS = [
        r";\s*\S", r"&&\s*\S", r"\|\|\s*\S",
        r"\brm\b", r"\brmdir\b", r"\bmv\b", r"\bcp\b", r"\bmkdir\b",
        r"\btouch\b", r"\bchmod\b", r"\bchown\b",
        r"\bcurl\b", r"\bwget\b", r"\bscp\b", r"\bssh\b",
        r"\bdd\b", r"\bmkfs\b", r"\bshutdown\b", r"\breboot\b",
        r"\bkill\b", r"\bkillall\b",
        r">\s*", r">>\s*", r"<\s*", r"\|\s*",
        r"`[^`]*`", r"\$\([^)]*\)", r"\$\{[^}]*\}",
    ]
    for pat in _DANGEROUS_PATTERNS:
        if re.search(pat, command):
            return {
                "tool": "run_command", "command": command,
                "exit_code": -1, "stdout": "", "stderr": "",
                "ok": False, "streamed": True,
                "errorCode": "DANGEROUS_COMMAND",
                "message": f"命令包含禁止的模式: {pat}(安全限制)",
            }

    # 命令前缀白名单
    _ALLOWED_PREFIXES = {
        "git", "ls", "cat", "echo", "python", "python3", "node", "npm", "npx",
        "pnpm", "tsc", "ruff", "mypy", "pytest", "find", "grep", "rg", "wc",
        "head", "tail", "date", "whoami", "pwd", "which", "where", "env",
        "uname", "ver", "dir", "type", "getopt",
    }
    first_token = command.split()[0] if command.split() else ""
    cmd_name = first_token.rsplit("/", 1)[-1].rsplit("\\", 1)[-1].lower()
    if cmd_name not in _ALLOWED_PREFIXES:
        return {
            "tool": "run_command", "command": command,
            "exit_code": -1, "stdout": "", "stderr": "",
            "ok": False, "streamed": True,
            "message": f"命令 '{cmd_name}' 不在白名单中(允许: {', '.join(sorted(_ALLOWED_PREFIXES))})",
        }

    try:
        import shlex
        import sys

        _WIN_BUILTINS = {
            "echo", "type", "ver", "dir", "set", "cd", "cls", "color",
            "prompt", "title", "path", "assoc", "ftype",
        }
        args = shlex.split(command, posix=sys.platform != "win32")
        env_for_proc = _build_subprocess_env(user_env) if user_env else None

        if sys.platform == "win32" and cmd_name in _WIN_BUILTINS:
            proc = await asyncio.create_subprocess_exec(
                "cmd", "/c", command,
                cwd=cwd, env=env_for_proc,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        else:
            proc = await asyncio.create_subprocess_exec(
                *args,
                cwd=cwd, env=env_for_proc,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

        # 流式逐行读取 stdout/stderr(并发 drain,防长输出阻塞)
        stdout_lines: list[str] = []
        stderr_lines: list[str] = []
        drain = asyncio.gather(
            _drain_stream(proc.stdout, stdout_lines),
            _drain_stream(proc.stderr, stderr_lines),
        )
        try:
            await asyncio.wait_for(drain, timeout=timeout)
            await proc.wait()
            timed_out = False
        except asyncio.TimeoutError:
            timed_out = True
            try:
                proc.kill()
            except ProcessLookupError:
                pass
            # 取消 drain task 并等其退出(readline 会被 CancelledError 中断)
            drain.cancel()
            try:
                await drain
            except (asyncio.CancelledError, Exception):
                pass
            try:
                await proc.wait()
            except Exception:
                pass

        stdout = "\n".join(stdout_lines)
        stderr = "\n".join(stderr_lines)
        max_output = 10000
        if len(stdout) > max_output:
            stdout = stdout[:max_output] + f"\n...(已截断,共 {len(stdout)} 字符)"
        if len(stderr) > max_output:
            stderr = stderr[:max_output] + f"\n...(已截断,共 {len(stderr)} 字符)"

        if timed_out:
            return {
                "tool": "run_command", "command": command,
                "exit_code": -1,
                "stdout": stdout, "stderr": stderr,
                "partial_output": stdout,
                "ok": False, "streamed": True,
                "errorCode": "TIMEOUT",
                "message": f"命令执行超时({timeout} 秒,已 kill 进程)",
            }

        exit_code = proc.returncode if proc.returncode is not None else -1
        return {
            "tool": "run_command", "command": command,
            "exit_code": exit_code, "stdout": stdout, "stderr": stderr,
            "ok": exit_code == 0, "streamed": True,
            "message": f"命令退出码: {exit_code}",
        }
    except FileNotFoundError:
        return {
            "tool": "run_command", "command": command,
            "exit_code": -1, "stdout": "", "stderr": f"命令未找到: {first_token}",
            "ok": False, "streamed": True,
            "message": f"命令未找到: {first_token}",
        }
    except Exception as e:
        return {
            "tool": "run_command", "command": command,
            "exit_code": -1, "stdout": "", "stderr": str(e),
            "ok": False, "streamed": True,
            "message": f"命令执行失败: {e}", "error": str(e),
        }


async def _tool_web_search(arguments: dict[str, Any]) -> dict[str, Any]:
    """web_search: 网页搜索(复用 DuckDuckGo Lite HTML 搜索)。

    与 search_web 功能等价,但接口更简洁(仅 query 参数,默认 5 条结果)。
    无网络或解析失败时返回空结果 + 错误信息。
    """
    query = arguments.get("query", "")
    max_results = int(arguments.get("max_results", 5))

    if not query:
        return {
            "tool": "web_search",
            "ok": True,
            "query": query,
            "results": [],
            "message": "搜索关键词为空",
        }

    # 复用 search_web 的实现
    sub_result = await _tool_search_web({
        "query": query,
        "max_results": max_results,
    })

    # 转换字段名(tool → web_search,保留 results)
    return {
        "tool": "web_search",
        "ok": True,
        "query": query,
        "max_results": max_results,
        "results": sub_result.get("results", []),
        "total": sub_result.get("total", 0),
        "message": sub_result.get("message", ""),
    }


async def _tool_search_web(arguments: dict[str, Any]) -> dict[str, Any]:
    """search_web: DuckDuckGo HTML 搜索,返回解析后的结果列表。

    使用 DuckDuckGo Lite HTML 版本(无需 API key),解析结果。
    无网络或解析失败时返回空结果 + 错误信息。
    """
    query = arguments.get("query", "")
    max_results = int(arguments.get("max_results", 5))

    if not query:
        return {
            "tool": "search_web",
            "ok": True,
            "query": query,
            "max_results": max_results,
            "results": [],
            "message": "搜索关键词为空",
        }

    try:
        # 动态导入 httpx(未安装时降级)
        try:
            import httpx
        except ImportError:
            return {
                "tool": "search_web",
                "ok": True,
                "query": query,
                "max_results": max_results,
                "results": [],
                "message": "[stub] httpx 未安装,无法执行真实搜索",
            }

        # DuckDuckGo Lite HTML 搜索
        url = f"https://lite.duckduckgo.com/lite/?q={quote_plus(query)}&kl=wt-wt"
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        }

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            html = resp.text

        # 解析 DuckDuckGo Lite HTML 结果
        results = _parse_ddg_lite_html(html, max_results)

        return {
            "tool": "search_web",
            "ok": True,
            "query": query,
            "max_results": max_results,
            "results": results,
            "total": len(results),
            "message": f"找到 {len(results)} 条结果" if results else "未找到结果",
        }

    except Exception as e:
        return {
            "tool": "search_web",
            "ok": False,
            "query": query,
            "max_results": max_results,
            "results": [],
            "message": f"搜索失败: {e}",
            "error": str(e),
        }


def _parse_ddg_lite_html(html: str, max_results: int) -> list[dict[str, str]]:
    """解析 DuckDuckGo Lite HTML 结果页。

    DuckDuckGo Lite 的结果在 <a class="result-link" href="..."> 标题 </a> 中,
    摘要在 <td class="result-snippet"> 中。
    """
    results: list[dict[str, str]] = []

    # 匹配结果链接(多种可能的选择器,容错)
    # DuckDuckGo Lite: <a rel="nofollow" class="result-link" href="URL">TITLE</a>
    link_pattern = re.compile(
        r'<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
        re.IGNORECASE | re.DOTALL,
    )
    # 摘要: <td class="result-snippet">...</td>
    snippet_pattern = re.compile(
        r'<td[^>]*class="result-snippet"[^>]*>(.*?)</td>',
        re.IGNORECASE | re.DOTALL,
    )

    links = link_pattern.findall(html)
    snippets = snippet_pattern.findall(html)

    for i, (url, title_html) in enumerate(links[:max_results]):
        # 清理 HTML 标签
        title = re.sub(r"<[^>]+>", "", title_html).strip()
        snippet = ""
        if i < len(snippets):
            snippet = re.sub(r"<[^>]+>", "", snippets[i]).strip()

        # DuckDuckGo 可能用 redirect URL,提取真实 URL
        # 格式: //duckduckgo.com/l/?uddg=ENCODED_URL&rut=...
        if "uddg=" in url:
            parsed = urlparse(url)
            qs = parse_qs(parsed.query)
            if "uddg" in qs:
                url = qs["uddg"][0]
        elif url.startswith("//"):
            url = "https:" + url

        if title and url:
            results.append(
                {
                    "title": title,
                    "url": url,
                    "snippet": snippet[:300] if snippet else "",
                }
            )

    return results


async def _tool_analyze_code(arguments: dict[str, Any]) -> dict[str, Any]:
    """analyze_code: 代码分析(基础静态分析)。"""
    code = arguments.get("code", "")
    language = arguments.get("language", "text")
    lines = code.splitlines()
    return {
        "tool": "analyze_code",
        "ok": True,
        "language": language,
        "metrics": {
            "lines": len(lines),
            "chars": len(code),
            "blank_lines": sum(1 for l in lines if not l.strip()),
            "comment_lines": sum(
                1
                for l in lines
                if l.strip().startswith(("#", "//", "--", "/*", "*"))
            ),
        },
        "message": f"基础静态分析完成(language={language})",
    }


async def _tool_generate_test(arguments: dict[str, Any]) -> dict[str, Any]:
    """generate_test: 生成测试模板。"""
    code = arguments.get("code", "")
    language = arguments.get("language", "python")
    framework = arguments.get("framework", "pytest")
    template = f"""# 自动生成的测试模板({framework})
# 源代码语言: {language}

def test_placeholder():
    \"\"\"TODO: 根据以下代码补充测试用例。\"\"\"
    # 源代码:
    # {chr(10).join('# ' + l for l in code.splitlines()[:20])}
    pass
"""
    return {
        "tool": "generate_test",
        "ok": True,
        "language": language,
        "framework": framework,
        "test_code": template,
        "message": "测试模板已生成(需结合 LLM 完善用例)",
    }


async def _tool_file_search(arguments: dict[str, Any]) -> dict[str, Any]:
    """file_search: 搜索文件内容(真实文件系统搜索)。

    支持:
    - pattern: 文件名 glob 匹配(默认 *)
    - query: 文件内容关键词搜索(为空则仅按文件名匹配)
    - path: 搜索根目录(默认当前目录)
    - max_results: 最大返回数(默认 50)
    - 忽略常见忽略目录(node_modules/.git/__pycache__/.venv/venv/dist/build)
    - 忽略二进制文件(按扩展名判断)
    """
    query = arguments.get("query", "")
    path = arguments.get("path", ".")
    pattern = arguments.get("pattern", "*")
    max_results = int(arguments.get("max_results", 50))

    # 忽略目录(常见依赖/构建/缓存)
    _IGNORED_DIRS = {
        "node_modules", ".git", "__pycache__", ".venv", "venv",
        "dist", "build", ".next", ".turbo", ".cache", "coverage",
    }
    # 忽略二进制/大文件扩展名
    _IGNORED_EXTS = {
        ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp",
        ".pdf", ".zip", ".tar", ".gz", ".rar", ".7z",
        ".exe", ".dll", ".so", ".dylib", ".class", ".jar",
        ".mp3", ".mp4", ".avi", ".mov", ".wav", ".flv",
        ".woff", ".woff2", ".ttf", ".eot", ".otf",
    }

    matches: list[dict[str, Any]] = []
    try:
        from pathlib import Path
        import fnmatch
        import os

        root = Path(path).resolve()
        if not root.exists():
            return {
                "tool": "file_search",
                "query": query,
                "path": path,
                "pattern": pattern,
                "matches": [],
                "message": f"路径不存在: {path}",
                "ok": False,
            }
        if not root.is_dir():
            return {
                "tool": "file_search",
                "query": query,
                "path": path,
                "pattern": pattern,
                "matches": [],
                "message": f"路径不是目录: {path}",
                "ok": False,
            }

        query_lower = query.lower() if query else None
        count = 0
        for dirpath, dirnames, filenames in os.walk(root):
            # 原地修改 dirnames 跳过忽略目录
            dirnames[:] = [d for d in dirnames if d not in _IGNORED_DIRS]
            for fname in filenames:
                if count >= max_results:
                    break
                if not fnmatch.fnmatch(fname, pattern):
                    continue
                ext = os.path.splitext(fname)[1].lower()
                if ext in _IGNORED_EXTS:
                    continue
                fpath = os.path.join(dirpath, fname)
                try:
                    rel_path = os.path.relpath(fpath, root)
                    # 若有 query,需读取文件内容匹配
                    if query_lower:
                        try:
                            with open(fpath, encoding="utf-8", errors="ignore") as f:
                                content = f.read()
                            if query_lower not in content.lower():
                                continue
                            # 提取匹配行上下文
                            lines = content.splitlines()
                            line_numbers = [
                                i + 1 for i, ln in enumerate(lines) if query_lower in ln.lower()
                            ]
                            preview = ""
                            if line_numbers:
                                ln = line_numbers[0]
                                start = max(0, ln - 2)
                                end = min(len(lines), ln + 1)
                                preview = "\n".join(
                                    f"{start + j + 1}: {lines[start + j]}" for j in range(end - start)
                                )
                            matches.append({
                                "path": rel_path,
                                "file": fname,
                                "line_numbers": line_numbers[:10],
                                "preview": preview[:500],
                            })
                        except (OSError, UnicodeDecodeError):
                            continue
                    else:
                        # 无 query,仅文件名匹配
                        try:
                            size = os.path.getsize(fpath)
                        except OSError:
                            size = 0
                        matches.append({
                            "path": rel_path,
                            "file": fname,
                            "size": size,
                        })
                    count += 1
                except OSError:
                    continue
            if count >= max_results:
                break

        return {
            "tool": "file_search",
            "query": query,
            "path": path,
            "pattern": pattern,
            "matches": matches,
            "total": len(matches),
            "truncated": count >= max_results,
            "message": f"在 {path} 下找到 {len(matches)} 个匹配文件"
                       + ("(已截断)" if count >= max_results else ""),
            "ok": True,
        }
    except Exception as e:
        return {
            "tool": "file_search",
            "query": query,
            "path": path,
            "pattern": pattern,
            "matches": [],
            "message": f"搜索失败: {e}",
            "ok": False,
            "error": str(e),
        }


async def _tool_git_operations(arguments: dict[str, Any]) -> dict[str, Any]:
    """git_operations: Git 操作(真实 git 命令执行)。

    支持的 action:
      只读(所有用户): status/diff/log/branch(show)/show/stash(list)/list
      写操作(需 admin,role >= 1): branch_create/branch_switch/branch_delete/merge/
                                  rebase/stash_push/stash_pop/tag_create/tag_list
    """
    action = arguments.get("action", "status")
    repo = arguments.get("repo", ".")

    # 只读操作白名单(所有用户可用)
    _READONLY_ACTIONS = {
        "status": ["status", "--short", "--branch"],
        "diff": ["diff", "--stat"],
        "log": ["log", "--oneline", "-20"],
        "branch": ["branch", "-a"],
        "show": ["show", "--stat"],  # show 需要 ref 参数
        "stash": ["stash", "list"],
        "list": ["ls-files"],
    }

    # 写操作集合(admin only,role >= 1)Wave 8 新增
    _WRITE_ACTIONS = {
        "branch_create", "branch_switch", "branch_delete", "merge",
        "rebase", "stash_push", "stash_pop", "tag_create", "tag_list",
    }

    if action not in _READONLY_ACTIONS and action not in _WRITE_ACTIONS:
        return {
            "tool": "git_operations",
            "action": action,
            "repo": repo,
            "output": "",
            "message": (
                f"不允许的 git 操作: {action}。允许: "
                f"只读={', '.join(sorted(_READONLY_ACTIONS))}; "
                f"写操作(admin)={', '.join(sorted(_WRITE_ACTIONS))}"
            ),
            "ok": False,
        }

    # 写操作 admin 权限校验(defense-in-depth,call_tool 层已校验 _ADMIN_ONLY_TOOLS,
    # 此处再校验 __user_role 以防绕过)
    if action in _WRITE_ACTIONS:
        user_role = arguments.get("__user_role", 0)
        if user_role < 1:
            return {
                "tool": "git_operations",
                "action": action,
                "repo": repo,
                "output": "",
                "message": f"写操作 '{action}' 需要 admin 权限(role >= 1),当前 role={user_role}",
                "ok": False,
                "error": "PERMISSION_DENIED",
            }

    try:
        import subprocess
        import os

        repo_path = os.path.abspath(repo)
        if not os.path.isdir(repo_path):
            return {
                "tool": "git_operations",
                "action": action,
                "repo": repo,
                "output": "",
                "message": f"仓库路径不存在或不是目录: {repo}",
                "ok": False,
            }

        # 构造 git 命令参数
        if action in _READONLY_ACTIONS:
            git_args = list(_READONLY_ACTIONS[action])
            # show 命令需要 ref 参数
            if action == "show":
                ref = arguments.get("ref", "HEAD")
                git_args.append(ref)
        else:
            # 写操作:根据 action 构造命令参数
            git_args = _build_write_action_args(action, arguments)
            if git_args is None:
                return {
                    "tool": "git_operations",
                    "action": action,
                    "repo": repo,
                    "output": "",
                    "message": f"写操作 '{action}' 参数无效或缺失必填参数",
                    "ok": False,
                }

        result = subprocess.run(
            ["git"] + git_args,
            cwd=repo_path,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=30,
            check=False,
        )

        output = result.stdout
        if result.stderr:
            output = (output + "\n" + result.stderr).strip() if output else result.stderr.strip()

        return {
            "tool": "git_operations",
            "action": action,
            "repo": repo,
            "output": output,
            "exit_code": result.returncode,
            "ok": result.returncode == 0,
            "message": f"git {action} 完成(exit_code={result.returncode})",
        }
    except subprocess.TimeoutExpired:
        return {
            "tool": "git_operations",
            "action": action,
            "repo": repo,
            "output": "",
            "message": "git 命令执行超时(30s)",
            "ok": False,
        }
    except FileNotFoundError:
        return {
            "tool": "git_operations",
            "action": action,
            "repo": repo,
            "output": "",
            "message": "git 命令未找到(需安装 git 并加入 PATH)",
            "ok": False,
        }
    except Exception as e:
        return {
            "tool": "git_operations",
            "action": action,
            "repo": repo,
            "output": "",
            "message": f"git 操作失败: {e}",
            "ok": False,
            "error": str(e),
        }


def _build_write_action_args(action: str, arguments: dict[str, Any]) -> list[str] | None:
    """构造写操作的 git 命令参数(Wave 8 新增)。

    Returns:
        git 命令参数列表,或 None(参数无效/缺失必填)。
    """
    if action == "branch_create":
        name = arguments.get("name")
        if not name:
            return None
        args = ["branch", str(name)]
        from_ref = arguments.get("from")
        if from_ref:
            args.append(str(from_ref))
        return args

    if action == "branch_switch":
        name = arguments.get("name")
        if not name:
            return None
        create = arguments.get("create", False)
        args = ["checkout"]
        if create:
            args.append("-b")
        args.append(str(name))
        return args

    if action == "branch_delete":
        name = arguments.get("name")
        if not name:
            return None
        force = arguments.get("force", False)
        return ["branch", "-D" if force else "-d", str(name)]

    if action == "merge":
        branch = arguments.get("branch")
        if not branch:
            return None
        args = ["merge"]
        if arguments.get("no_ff"):
            args.append("--no-ff")
        if arguments.get("squash"):
            args.append("--squash")
        message = arguments.get("message")
        if message:
            args.extend(["-m", str(message)])
        args.append(str(branch))
        return args

    if action == "rebase":
        upstream = arguments.get("upstream")
        if not upstream:
            return None
        args = ["rebase", str(upstream)]
        branch = arguments.get("branch")
        if branch:
            args.append(str(branch))
        return args

    if action == "stash_push":
        args = ["stash", "push"]
        message = arguments.get("message")
        if message:
            args.extend(["-m", str(message)])
        if arguments.get("include_untracked"):
            args.append("-u")
        return args

    if action == "stash_pop":
        index = arguments.get("index", 0)
        apply = arguments.get("apply", False)
        return ["stash", "apply" if apply else "pop", f"stash@{{{int(index)}}}"]

    if action == "tag_create":
        name = arguments.get("name")
        if not name:
            return None
        args = ["tag"]
        if arguments.get("annotated"):
            args.extend(["-a", str(name)])
            message = arguments.get("message")
            args.extend(["-m", str(message) if message else f"Tag {name}"])
        else:
            args.append(str(name))
        return args

    if action == "tag_list":
        args = ["tag", "-l"]
        pattern = arguments.get("pattern")
        if pattern:
            args.append(str(pattern))
        return args

    return None


async def _tool_db_query(arguments: dict[str, Any]) -> dict[str, Any]:
    """db_query: 数据库只读查询(真实 postgres 查询,安全加固)。

    安全策略:
    - 仅允许 SELECT / WITH 查询(只读),禁止 INSERT/UPDATE/DELETE/DROP/ALTER 等
    - SQL 语句经正则校验,必须以 SELECT 或 WITH 开头(忽略前导空白/注释)
    - 参数化查询:arguments.params 透传给 asyncpg.fetch($1,$2... 占位符)
    - 查询超时 10s
    - 结果行数限制 max_rows(默认 100,上限 1000)
    - database_url 未配置时返回 ok=False
    - 任何异常捕获,不泄露完整 SQL 错误(仅返回简短信息)
    """
    sql = arguments.get("sql", "").strip()
    params = arguments.get("params", [])
    max_rows = min(int(arguments.get("max_rows", 100)), 1000)

    # 安全校验:仅允许 SELECT / WITH 开头
    import re
    # 去除前导 SQL 注释(-- ... 和 /* ... */)和空白
    _SQL_LEADING_COMMENT_RE = re.compile(
        r"^\s*(?:--[^\n]*\n|/\*.*?\*/\s*)*",
        re.DOTALL,
    )
    stripped = _SQL_LEADING_COMMENT_RE.sub("", sql).lstrip()
    sql_upper = stripped.upper()
    if not sql_upper.startswith("SELECT") and not sql_upper.startswith("WITH"):
        return {
            "tool": "db_query",
            "sql": sql,
            "rows": [],
            "ok": False,
            "message": "仅允许 SELECT / WITH 查询(只读),禁止写操作/DDL",
        }

    # 禁止危险关键词(在 SQL 任意位置,忽略大小写)
    _DANGEROUS_KEYWORDS = [
        "INSERT ", "UPDATE ", "DELETE ", "DROP ", "ALTER ", "CREATE ",
        "TRUNCATE ", "GRANT ", "REVOKE ", "EXEC ", "EXECUTE ", "MERGE ",
        "VACUUM ", "REINDEX ", "CLUSTER ",
    ]
    sql_check = " " + sql_upper + " "
    for kw in _DANGEROUS_KEYWORDS:
        if kw in sql_check:
            return {
                "tool": "db_query",
                "sql": sql,
                "rows": [],
                "ok": False,
                "message": f"SQL 含禁止关键词: {kw.strip()}",
            }

    # 检查 database_url 配置
    from app.core.config import settings
    if not settings.database_url:
        return {
            "tool": "db_query",
            "sql": sql,
            "rows": [],
            "ok": False,
            "message": "DATABASE_URL 未配置,无法执行数据库查询",
        }

    # 执行查询
    try:
        import asyncio
        import asyncpg

        # 强制只读:在事务外用 READ ONLY 模式(若 postgres 支持)
        # asyncpg 不直接支持事务只读模式,这里靠 SQL 校验 + SELECT 限制保证只读
        conn = await asyncio.wait_for(
            asyncpg.connect(settings.database_url),
            timeout=5,
        )
        try:
            # 添加 LIMIT(若 SQL 未含 LIMIT)
            if "LIMIT" not in sql_upper:
                sql_with_limit = f"{sql.rstrip(';')} LIMIT {max_rows}"
            else:
                sql_with_limit = sql

            rows = await asyncio.wait_for(
                conn.fetch(sql_with_limit, *params),
                timeout=10,
            )
            # 转换为可序列化 dict 列表
            result_rows = [dict(r) for r in rows]
            # 将非 JSON 类型转为字符串
            for r in result_rows:
                for k, v in r.items():
                    if not isinstance(v, (str, int, float, bool, type(None))):
                        r[k] = str(v)
            return {
                "tool": "db_query",
                "sql": sql,
                "rows": result_rows,
                "row_count": len(result_rows),
                "truncated": len(result_rows) >= max_rows,
                "ok": True,
                "message": f"查询成功,返回 {len(result_rows)} 行",
            }
        finally:
            await conn.close()
    except asyncio.TimeoutError:
        return {
            "tool": "db_query",
            "sql": sql,
            "rows": [],
            "ok": False,
            "message": "查询超时(连接 5s / 查询 10s)",
        }
    except Exception as e:
        # 仅返回错误类型,不泄露完整 SQL 错误
        err_type = type(e).__name__
        return {
            "tool": "db_query",
            "sql": sql,
            "rows": [],
            "ok": False,
            "message": f"查询失败: {err_type}",
            "error": str(e)[:200],  # 截断错误信息
        }


# ---------------------------------------------------------------------------
# AI 自动控制工具(22 个:12 browser + 10 computer,2026-07-22 立)
# 转发到 api 层 /api/agent-control/execute,由 extension/desktop 端执行
# ---------------------------------------------------------------------------

# api 层 agent-control 端点(转发到 extension/desktop 端执行)
# 2026-07-24 修复:原硬编码 http://127.0.0.1:8801(端口 8801 是 web,agent-control 路由在 api 8802)
# 改为从 settings.api_service_url 动态构建,与 .env API_SERVICE_URL 配置一致
def _get_agent_control_api_url() -> str:
    """动态构建 agent-control API URL(确保 settings 已加载 .env)。"""
    from ..core.config import settings
    return f"{settings.api_service_url}/api/agent-control/execute"


async def _tool_agent_control(
    category: str, action: str, arguments: dict[str, Any]
) -> dict[str, Any]:
    """agent_control: AI 自动控制浏览器/电脑(转发到 extension/desktop 端执行)。

    category='browser'  → extension 端执行 DOM 操作 + 截图
    category='computer' → desktop 端执行 Tauri IPC(截图/鼠标/键盘)
    """
    import uuid

    import httpx

    # 从 arguments 提取参数(去掉 MCP tool 的元数据字段)
    timeout_ms = int(arguments.pop("timeout", 30000))
    params = dict(arguments)

    request = {
        "requestId": f"mcp-{uuid.uuid4().hex[:12]}",
        "category": category,
        "action": action,
        "params": params,
        "timeout": timeout_ms,
    }

    tool_name = f"{category}_{action}"
    # 内部服务密钥从 env 读取(2026-07-22 修复:原硬编码 "internal-service")
    # api 层用 secrets.compare_digest 校验,密钥未配置时拒绝调用(fail-closed)
    if not _get_agent_control_secret():
        return {
            "tool": tool_name,
            "ok": False,
            "error": "AGENT_CONTROL_INTERNAL_SECRET 未配置,拒绝 agent_control 调用(fail-closed)",
            "errorCode": "MISSING_SECRET",
        }
    try:
        async with httpx.AsyncClient(timeout=timeout_ms / 1000 + 10) as client:
            response = await client.post(
                _get_agent_control_api_url(),
                json=request,
                headers={"Authorization": f"Bearer {_get_agent_control_secret()}"},
            )
            response.raise_for_status()
            payload = response.json()
            # api 层返回 ApiResponse<AgentActionResponse> = { code, message, data }
            data = payload.get("data", payload) if isinstance(payload, dict) else {}
            return {
                "tool": tool_name,
                "ok": bool(data.get("success", False)),
                "action": action,
                "category": category,
                "result": data,
            }
    except httpx.TimeoutException:
        return {
            "tool": tool_name,
            "ok": False,
            "error": f"控制调用超时({timeout_ms}ms)",
            "errorCode": "TIMEOUT",
        }
    except Exception as e:
        err_type = type(e).__name__
        return {
            "tool": tool_name,
            "ok": False,
            "error": str(e)[:200],
            "errorCode": "EXECUTION_FAILED",
            "message": f"控制调用失败: {err_type}",
        }


def _make_agent_control_handler(category: str, action: str):
    """生成 agent control handler 闭包,绑定 category + action。"""

    async def handler(arguments: dict[str, Any]) -> dict[str, Any]:
        return await _tool_agent_control(category, action, arguments)

    return handler


# ---------------------------------------------------------------------------
# 自动化任务配置工具(2026-07-22 新增)
# 调用 api 层 /api/self-media/automation/tasks/:taskId/config
# ---------------------------------------------------------------------------

# 2026-07-24 修复:原硬编码 8801(web),self-media/automation 路由在 api 8802
def _get_automation_api_base() -> str:
    """动态构建 self-media automation API base URL(确保 settings 已加载 .env)。"""
    from ..core.config import settings
    return f"{settings.api_service_url}/api/self-media/automation/tasks"


# ---------------------------------------------------------------------------
# 截图工具(2026-07-22 新增,WorkPanel iframe 降级)
# 直接调本服务 Playwright headless 截图,不走 agent_control 转发
# ---------------------------------------------------------------------------


async def _tool_screenshot_url(arguments: dict[str, Any]) -> dict[str, Any]:
    """对指定 URL 截图(Playwright headless Chromium)。

    用于 WorkPanel iframe 降级:当目标站点禁止 iframe 嵌入(X-Frame-Options /
    CSP frame-ancestors)时,后端截图返回 base64 给前端展示。
    """
    url = arguments.get("url")
    if not url or not isinstance(url, str):
        return {"tool": "screenshot_url", "ok": False, "error": "缺少 url 参数"}

    width = int(arguments.get("width", 1280))
    height = int(arguments.get("height", 720))
    full_page = bool(arguments.get("full_page", False))
    wait_until = str(arguments.get("wait_until", "load"))
    timeout = int(arguments.get("timeout", 15000))

    try:
        from .screenshot_service import take_screenshot

        result = await take_screenshot(
            url,
            width=width,
            height=height,
            full_page=full_page,
            wait_until=wait_until,
            timeout=timeout,
        )
        return {
            "tool": "screenshot_url",
            "ok": True,
            "url": result["url"],
            "title": result["title"],
            "can_embed": result["can_embed"],
            "screenshot_length": len(result["screenshot"]),
            "captured_at": result["captured_at"],
            # 注意:不直接返回 base64(可能很大),客户端调 HTTP 端点获取
        }
    except Exception as e:
        err_type = type(e).__name__
        return {
            "tool": "screenshot_url",
            "ok": False,
            "error": str(e)[:200],
            "errorCode": "SCREENSHOT_FAILED",
            "message": f"截图失败: {err_type}",
        }


# 自动化任务配置缓存(2026-07-24 立,configure_automation_task 配置记录 + 执行结果)
# key=config_id(uuid hex),value={task_id, action, execute, arguments, config_response}
_AUTOMATION_CONFIGS: dict[str, dict[str, Any]] = {}


async def _tool_configure_automation_task(arguments: dict[str, Any]) -> dict[str, Any]:
    """配置自媒体自动化定时任务并可选立即执行(对标 Trae Work Automations + Codex)。

    1. 配置阶段:转发到 api 层 config 端点(koubo_daily/wechat_daily),缓存到 _AUTOMATION_CONFIGS。
    2. 执行阶段(execute=True,默认):按 action 真实执行一次:
       - schedule → 调用 _tool_schedule_task 真实调度
       - dispatch_subagent → 调用 _tool_dispatch_subagent 派发子智能体
       - webhook → httpx POST 到 arguments.webhook_url
    """
    import httpx
    import uuid

    task_id = arguments.get("task_id", "wechat_daily")
    execute = bool(arguments.get("execute", True))
    action = arguments.get("action", "")

    # ===== 配置阶段(保留原有 koubo_daily/wechat_daily config 路径)=====
    config_ok = False
    config_resp: dict[str, Any] = {}
    if task_id in ("koubo_daily", "wechat_daily"):
        hour = int(arguments.get("hour", 9))
        minute = int(arguments.get("minute", 0))
        dry_run = bool(arguments.get("dry_run", True))
        enabled = bool(arguments.get("enabled", True))
        title_template = arguments.get("title_template")
        config_body: dict[str, Any] = {
            "hour": hour, "minute": minute,
            "dry_run": dry_run, "enabled": enabled,
        }
        if title_template:
            config_body["title_template"] = str(title_template)
        url = f"{_get_automation_api_base()}/{task_id}/config"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=config_body)
                if resp.status_code < 400:
                    data = resp.json()
                    config_resp = data.get("data", data) if isinstance(data, dict) else data
                    config_ok = True
                else:
                    config_resp = {"error": f"api 返回 {resp.status_code}: {resp.text[:200]}"}
        except Exception as e:
            config_resp = {"error": f"配置失败: {type(e).__name__}: {str(e)[:200]}"}
    # 非 koubo_daily/wechat_daily:跳过 api config(仅作为缓存,供 schedule/dispatch/webhook 执行)

    config_id = uuid.uuid4().hex
    _AUTOMATION_CONFIGS[config_id] = {
        "task_id": task_id, "action": action, "execute": execute,
        "arguments": arguments, "config_response": config_resp,
    }

    # ===== 执行阶段 =====
    executed = False
    execution_result: dict[str, Any] = {}
    if execute and action:
        try:
            if action == "schedule":
                execution_result = await _tool_schedule_task(arguments)
                executed = bool(execution_result.get("ok"))
            elif action == "dispatch_subagent":
                execution_result = await _tool_dispatch_subagent(arguments)
                executed = bool(execution_result.get("ok"))
            elif action == "webhook":
                webhook_url = arguments.get("webhook_url", "")
                if not webhook_url:
                    execution_result = {
                        "ok": False, "errorCode": "MISSING_PARAMS",
                        "error": "action=webhook 时 webhook_url 必填",
                    }
                else:
                    webhook_payload = arguments.get("webhook_payload", arguments)
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        wresp = await client.post(webhook_url, json=webhook_payload)
                        execution_result = {
                            "ok": wresp.status_code < 400,
                            "status_code": wresp.status_code,
                            "response": wresp.text[:500],
                        }
                        executed = wresp.status_code < 400
            else:
                execution_result = {
                    "ok": False, "errorCode": "INVALID_PARAMS",
                    "error": f"不支持的 action: {action}(schedule/dispatch_subagent/webhook)",
                }
        except Exception as e:
            execution_result = {
                "ok": False, "errorCode": "EXECUTION_EXCEPTION",
                "error": f"执行失败: {type(e).__name__}: {str(e)[:200]}",
            }

    # ok:执行模式下看 executed;纯配置模式看 config_ok(非 koubo/wechat 视为配置通过)
    if execute and action:
        overall_ok = executed
    else:
        overall_ok = config_ok or (task_id not in ("koubo_daily", "wechat_daily"))

    return {
        "ok": overall_ok,
        "configured": config_ok or (task_id not in ("koubo_daily", "wechat_daily")),
        "executed": executed,
        "execution_result": execution_result,
        "config_id": config_id,
        "task_id": task_id,
        "action": action,
    }


async def _tool_vision_analyze(arguments: dict[str, Any]) -> dict[str, Any]:
    """vision_analyze: 图像分析(支持本地文件路径、URL 和 base64)。

    参数优先级: image_path > image_base64 > image_url > image(legacy 兼容)。
    参数:
    - image_path: 本地图片绝对路径(可选,自动转 base64,需在工作区白名单内)
    - image_base64: base64 编码图片(可选)
    - image_url: 图片 URL(可选)
    - image: 图片 URL 或 base64(legacy 兼容,可选)
    - task: 分析任务描述(必填)
    - model: 期望模型(可选,缺省用支持视觉的模型)
    """
    import base64 as _b64
    from pathlib import Path

    from ..core.llm_gateway import llm_gateway

    task = arguments.get("task", "")
    model = arguments.get("model")
    image_path = arguments.get("image_path", "")
    image_base64 = arguments.get("image_base64", "")
    image_url = arguments.get("image_url", "")
    legacy_image = arguments.get("image", "")

    # 解析图片来源,构造 OpenAI vision image_url url
    source = ""
    file_path = ""

    if image_path:
        # 本地文件路径:校验工作区白名单(防 symlink 穿越)
        ok, info = _validate_path_in_workspace(str(image_path))
        if not ok:
            return {
                "tool": "vision_analyze", "ok": False,
                "error": info, "errorCode": "PATH_NOT_IN_WORKSPACE",
            }
        p = Path(info)
        if not p.exists():
            return {
                "tool": "vision_analyze", "ok": False,
                "error": f"文件不存在: {image_path}", "errorCode": "FILE_NOT_FOUND",
            }
        # 文件大小校验(>10MB 拒绝)
        try:
            file_size = p.stat().st_size
        except OSError as e:
            return {
                "tool": "vision_analyze", "ok": False,
                "error": f"读取文件大小失败: {e}", "errorCode": "FILE_NOT_FOUND",
            }
        if file_size > 10 * 1024 * 1024:
            return {
                "tool": "vision_analyze", "ok": False,
                "error": f"图片过大({file_size} bytes > 10MB)", "errorCode": "IMAGE_TOO_LARGE",
            }
        # MIME 推断
        ext = p.suffix.lower()
        mime_map = {
            ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".webp": "image/webp", ".gif": "image/gif",
        }
        mime = mime_map.get(ext)
        if not mime:
            return {
                "tool": "vision_analyze", "ok": False,
                "error": f"不支持的图片格式: {ext}(仅支持 png/jpg/jpeg/webp/gif)",
                "errorCode": "UNSUPPORTED_IMAGE_FORMAT",
            }
        try:
            raw_bytes = p.read_bytes()
        except OSError as e:
            return {
                "tool": "vision_analyze", "ok": False,
                "error": f"读取文件失败: {e}", "errorCode": "FILE_NOT_FOUND",
            }
        b64 = _b64.b64encode(raw_bytes).decode("ascii")
        image_url_value = f"data:{mime};base64,{b64}"
        source = "local_file"
        file_path = str(image_path)
    elif image_base64:
        image_url_value = (
            image_base64 if image_base64.startswith("data:")
            else f"data:image/png;base64,{image_base64}"
        )
        source = "base64"
    elif image_url:
        image_url_value = image_url
        source = "url"
    elif legacy_image:
        image_url_value = legacy_image
        source = "legacy"
    else:
        return {
            "tool": "vision_analyze", "ok": False,
            "error": "image_path / image_base64 / image_url / image 至少需要一个",
        }

    if not task:
        return {"tool": "vision_analyze", "ok": False, "error": "task is required"}

    # 构造 OpenAI vision 格式消息(text + image_url content block)
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": task},
                {"type": "image_url", "image_url": {"url": image_url_value}},
            ],
        }
    ]
    try:
        result = await llm_gateway.complete(messages, model=model)
        ret: dict[str, Any] = {
            "tool": "vision_analyze",
            "ok": not result.get("error"),
            "analysis": result.get("content", ""),
            "model": result.get("model", model or ""),
            "stub": result.get("stub", False),
            "error": result.get("error_message"),
            "source": source,
        }
        if file_path:
            ret["file_path"] = file_path
        return ret
    except Exception as e:
        return {
            "tool": "vision_analyze",
            "ok": False,
            "error": str(e)[:200],
            "message": f"vision analysis failed: {type(e).__name__}",
        }


# ---------------------------------------------------------------------------
# 子智能体派发工具(2026-07-24 新增)
# 让 LLM 在 tool loop 中能自主派发子智能体执行任务
# ---------------------------------------------------------------------------

# 模块级单例 + lazy init(避免循环依赖:agent_orchestrator.py 在模块加载时
# `from .mcp_server import mcp_server`,若本模块顶部反向 import 会触发循环导入)
_orchestrator: "AgentOrchestrator | None" = None


def _get_orchestrator() -> "AgentOrchestrator":
    """Lazy 获取 AgentOrchestrator 单例(避免模块加载时循环导入)。

    agent_orchestrator.py 模块加载时执行 `from .mcp_server import mcp_server`,
    若本模块在顶部反向 import agent_orchestrator 会触发循环导入 → 用 lazy init。
    复用 agent_orchestrator.py 模块级单例(已注册 5 个默认 agent)。
    """
    global _orchestrator
    if _orchestrator is None:
        from .agent_orchestrator import agent_orchestrator as _inst
        _orchestrator = _inst
    return _orchestrator  # type: ignore[return-value]


async def _tool_dispatch_subagent(arguments: dict[str, Any]) -> dict[str, Any]:
    """dispatch_subagent: 派发子智能体执行独立任务(单 agent 或并行多 agent)。

    双模式(对标 Trae Work subagent orchestration):
    - 单 agent 模式(兼容):{name, task, session_id?} → orchestrator.invoke
    - 并行模式:{tasks: [{name, task, context?}, ...], max_concurrency?} →
      orchestrator.invoke_parallel,真实并行派发,互不污染上下文。

    互斥:同时传 name/task 与 tasks → 报错 DUAL_MODE。
    """
    name = arguments.get("name", "")
    task = arguments.get("task", "")
    tasks = arguments.get("tasks")
    max_concurrency = arguments.get("max_concurrency", 5)

    has_single = bool(name) or bool(task)
    has_tasks = tasks is not None

    # 双模式互斥校验
    if has_single and has_tasks:
        return {
            "tool": "dispatch_subagent", "ok": False,
            "error": "不可同时传 name/task 与 tasks(单 agent 模式与并行模式互斥)",
            "errorCode": "DUAL_MODE",
        }

    # 并行模式:tasks 数组 → invoke_parallel
    if has_tasks:
        if not isinstance(tasks, list):
            return {
                "tool": "dispatch_subagent", "ok": False,
                "error": "tasks 必须为数组", "errorCode": "INVALID_PARAMS",
            }
        if not tasks:
            return {
                "tool": "dispatch_subagent", "ok": False,
                "error": "tasks 列表为空", "errorCode": "EMPTY_TASKS",
            }
        for i, t in enumerate(tasks):
            if not isinstance(t, dict) or not t.get("name") or not t.get("task"):
                return {
                    "tool": "dispatch_subagent", "ok": False,
                    "error": f"tasks[{i}] 缺少 name 或 task 字段",
                    "errorCode": "INVALID_PARAMS",
                }
        try:
            orchestrator = _get_orchestrator()
            result = await orchestrator.invoke_parallel(
                tasks=tasks, max_concurrency=max_concurrency
            )
            return {
                "tool": "dispatch_subagent", "mode": "parallel",
                "ok": result.get("ok", False),
                "total": result.get("total", 0),
                "succeeded": result.get("succeeded", 0),
                "failed": result.get("failed", 0),
                "results": result.get("results", []),
                "message": result.get("message", ""),
            }
        except Exception as e:
            return {
                "tool": "dispatch_subagent", "ok": False, "mode": "parallel",
                "error": str(e), "errorCode": "SUBAGENT_FAILED",
            }

    # 单 agent 模式(兼容)
    session_id = arguments.get("session_id")
    if not name or not task:
        return {
            "tool": "dispatch_subagent", "ok": False,
            "error": "name and task are required(或传 tasks 数组启用并行模式)",
            "errorCode": "MISSING_PARAMS",
        }
    try:
        orchestrator = _get_orchestrator()
        result = await orchestrator.invoke(
            agent_name=name,
            user_input=task,
            session_id=session_id,
        )
        return {
            "tool": "dispatch_subagent", "mode": "single",
            "agent": name,
            "task": task,
            "status": result.status,
            "output": result.output,
            "duration_ms": result.duration_ms,
            "iterations": result.iterations,
            "error": result.error,
            "ok": result.status == "completed",
        }
    except Exception as e:
        return {
            "tool": "dispatch_subagent", "ok": False, "mode": "single",
            "error": str(e), "errorCode": "SUBAGENT_FAILED",
        }


# ---------------------------------------------------------------------------
# 扩展工具(2026-07-24 新增,对标 Trae Work + Codex 核心能力缺口)
# 6 个工具:fetch_url / image_generation / review_pr /
#          summarize_artifacts / schedule_task / proactive_suggestion
# ---------------------------------------------------------------------------

# 会话 artifacts 持久化(Redis hash TTL 7d,进程重启不丢;Redis 不可用降级进程内)。
# _ARTIFACTS_CACHE 保留为 artifacts_store._fallback_cache 的别名引用,向后兼容现有测试
# (test_mcp_server.py 直接读写 _ARTIFACTS_CACHE);_tool_summarize_artifacts 改用 _load_artifacts。
from .artifacts_store import (  # noqa: E402
    _fallback_cache as _ARTIFACTS_CACHE,
    delete_artifacts as _delete_artifacts,
    load_artifacts as _load_artifacts,
    save_artifacts as _save_artifacts,
)

# 进程内调度任务列表(schedule_task 用,内存镜像;Redis 为持久化真相源)
_SCHEDULED_TASKS: list[dict] = []

# 调度任务 Redis 持久化层(2026-07-24 立,对标 Codex Automations)
# key 规范:mcp:schedule:<task_id> hash,字段见 _SCHEDULE_REDIS_FIELDS
import logging as _schedule_logging

logger = _schedule_logging.getLogger(__name__)
_SCHEDULE_REDIS_PREFIX = "mcp:schedule:"
_SCHEDULE_REDIS_FIELDS = (
    "task_id", "name", "prompt", "schedule", "run_at", "cron",
    "interval_seconds", "agent_tools", "next_run_at", "status",
    "created_at", "last_run_at", "last_result", "webhook_url",
)
# 进程内 Redis 客户端单例(同步,线程安全;None 表示 Redis 不可用,降级内存)
_SCHEDULE_REDIS: Any = None
_SCHEDULE_REDIS_CHECKED = False


def _get_schedule_redis() -> Any:
    """返回调度任务 Redis 同步客户端,不可用返回 None(降级内存模式)。"""
    global _SCHEDULE_REDIS, _SCHEDULE_REDIS_CHECKED
    if _SCHEDULE_REDIS_CHECKED:
        return _SCHEDULE_REDIS
    _SCHEDULE_REDIS_CHECKED = True
    from app.core.config import settings

    url = settings.schedule_redis_url or settings.redis_url
    try:
        import redis  # type: ignore[import-not-found]

        client = redis.Redis.from_url(url, decode_responses=True)
        client.ping()
        _SCHEDULE_REDIS = client
        logger.info("[schedule_task] Redis 连接成功: %s", url)
    except Exception as e:
        _SCHEDULE_REDIS = None
        logger.warning("[schedule_task] Redis 不可用,降级内存模式: %s", e)
    return _SCHEDULE_REDIS


def _serialize_task_field(key: str, value: Any) -> str:
    """序列化任务字段为 Redis hash 字符串(list/dict/数字 → JSON,字符串原样)。"""
    if key in ("agent_tools", "interval_seconds"):
        import json as _json

        return _json.dumps(value)
    return str(value) if value is not None else ""


def _deserialize_task(data: dict[str, str]) -> dict[str, Any]:
    """反序列化 Redis hash → task dict(agent_tools/interval_seconds 还原为原类型)。"""
    import json as _json

    task: dict[str, Any] = {}
    for key, raw in data.items():
        if key in ("agent_tools", "interval_seconds"):
            try:
                task[key] = _json.loads(raw)
            except (TypeError, ValueError):
                task[key] = raw
        else:
            task[key] = raw
    return task


def _persist_task_to_redis(task: dict[str, Any]) -> bool:
    """持久化任务到 Redis hash,成功返回 True;Redis 不可用返回 False(调用方降级内存)。"""
    client = _get_schedule_redis()
    tid = task.get("task_id", "")
    if not tid or client is None:
        return False
    mapping = {
        k: _serialize_task_field(k, task.get(k, "" if k != "agent_tools" else []))
        for k in _SCHEDULE_REDIS_FIELDS
        if k in task or k in ("agent_tools",)
    }
    try:
        client.hset(_SCHEDULE_REDIS_PREFIX + tid, mapping=mapping)
        return True
    except Exception as e:
        logger.warning("[schedule_task] Redis 持久化失败: %s", e)
        return False


def _load_task_from_redis(task_id: str) -> dict[str, Any] | None:
    """从 Redis 加载单个任务,不存在或 Redis 不可用返回 None。"""
    client = _get_schedule_redis()
    if client is None:
        return None
    try:
        data = client.hgetall(_SCHEDULE_REDIS_PREFIX + task_id)
    except Exception as e:
        logger.warning("[schedule_task] Redis 读取失败: %s", e)
        return None
    return _deserialize_task(data) if data else None


def _load_pending_tasks_from_redis() -> list[dict[str, Any]]:
    """扫描所有 mcp:schedule:* 任务记录(供 ai-service 启动时重新注册)。"""
    client = _get_schedule_redis()
    if client is None:
        return []
    tasks: list[dict[str, Any]] = []
    try:
        for key in client.scan_iter(_SCHEDULE_REDIS_PREFIX + "*"):
            data = client.hgetall(key)
            if data:
                tasks.append(_deserialize_task(data))
    except Exception as e:
        logger.warning("[schedule_task] Redis 扫描失败: %s", e)
    return tasks


def _update_schedule_task_status(
    task_id: str, status: str, **fields: Any
) -> bool:
    """局部更新任务状态字段,成功返回 True;Redis 不可用返回 False(调用方降级内存)。"""
    client = _get_schedule_redis()
    if client is None:
        return False
    mapping = {"status": status}
    for k, v in fields.items():
        mapping[k] = _serialize_task_field(k, v) if k in ("agent_tools", "interval_seconds") else (str(v) if v is not None else "")
    try:
        client.hset(_SCHEDULE_REDIS_PREFIX + task_id, mapping=mapping)
        return True
    except Exception as e:
        logger.warning("[schedule_task] Redis 状态更新失败: %s", e)
        return False


async def _tool_fetch_url(arguments: dict[str, Any]) -> dict[str, Any]:
    """fetch_url: 抓取 URL 内容,返回 markdown/text/html/metadata(对标 #Web + Codex in-app browser)。

    SSRF 防护:复用 screenshot_service._validate_url_ssrf,禁止内网/保留/回环地址。
    """
    import html as _html
    import json as _json
    from datetime import datetime, timezone

    url = arguments.get("url", "")
    mode = arguments.get("mode", "text")
    max_chars = int(arguments.get("max_chars", 8000))

    if not url or not isinstance(url, str):
        return {
            "tool": "fetch_url", "ok": False,
            "error": "缺少 url 参数", "errorCode": "MISSING_PARAMS",
        }
    if mode not in ("text", "html", "metadata"):
        return {
            "tool": "fetch_url", "ok": False, "url": url,
            "error": f"无效 mode: {mode}(允许 text/html/metadata)",
            "errorCode": "INVALID_PARAMS",
        }

    # SSRF 校验(复用 screenshot_service 实现,防 127.0.0.1/10.*/169.254.* 云元数据等)
    from .screenshot_service import _validate_url_ssrf
    ok_ssrf, reason = _validate_url_ssrf(url)
    if not ok_ssrf:
        return {
            "tool": "fetch_url", "ok": False, "url": url,
            "error": reason, "errorCode": "SSRF_BLOCKED",
            "message": f"SSRF 校验失败: {reason}",
        }

    try:
        import httpx
    except ImportError:
        return {
            "tool": "fetch_url", "ok": False, "url": url,
            "error": "httpx 未安装", "errorCode": "DEP_MISSING",
        }

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(
                url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    ),
                },
            )
        content_type = resp.headers.get("content-type", "")
        body = resp.text
        title = ""
        truncated = False

        # title(所有模式都尝试提取)
        _TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
        m_title = _TITLE_RE.search(body)
        if m_title:
            title = _html.unescape(m_title.group(1).strip())

        if mode == "html":
            content = body
        elif mode == "metadata":
            _DESC_RE = re.compile(
                r"""<meta\s+name=["']description["']\s+content=["']([^"']*)["']""",
                re.IGNORECASE,
            )
            _OG_RE = re.compile(
                r"""<meta\s+property=["']og:([^"']+)["']\s+content=["']([^"']*)["']""",
                re.IGNORECASE,
            )
            desc = ""
            dm = _DESC_RE.search(body)
            if dm:
                desc = _html.unescape(dm.group(1))
            og = {prop: _html.unescape(val) for prop, val in _OG_RE.findall(body)}
            content = _json.dumps(
                {"title": title, "description": desc, "og": og},
                ensure_ascii=False,
            )
        else:  # text 模式:简单 HTML→text
            text = re.sub(
                r"<script[^>]*>.*?</script>", "", body, flags=re.IGNORECASE | re.DOTALL
            )
            text = re.sub(
                r"<style[^>]*>.*?</style>", "", text, flags=re.IGNORECASE | re.DOTALL
            )
            text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
            text = re.sub(r"</p\s*>", "\n\n", text, flags=re.IGNORECASE)
            text = re.sub(r"<[^>]+>", "", text)
            content = _html.unescape(text)
            content = re.sub(r"[ \t]+\n", "\n", content)
            content = re.sub(r"\n{3,}", "\n\n", content)
            content = content.strip()

        if len(content) > max_chars:
            content = content[:max_chars]
            truncated = True

        return {
            "tool": "fetch_url",
            "ok": True,
            "url": str(resp.url),
            "title": title,
            "content": content,
            "content_type": content_type,
            "status_code": resp.status_code,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "truncated": truncated,
            "message": f"抓取成功(mode={mode}, {len(content)} 字符)",
        }
    except Exception as e:
        return {
            "tool": "fetch_url", "ok": False, "url": url,
            "error": str(e)[:200], "errorCode": "FETCH_FAILED",
            "message": f"抓取失败: {type(e).__name__}",
        }


# 图片落地约束(2026-07-24 save_path 升级)
_MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5MB
_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")


def _validate_image_save_path(save_path: str) -> tuple[bool, str, str | None]:
    """校验 save_path:工作区白名单 + 后缀(.png/.jpg/.jpeg/.webp)。

    Returns:
        (ok, resolved_path, error_code)
    """
    if not save_path or not isinstance(save_path, str):
        return False, "", "MISSING_PARAMS"
    ext = os.path.splitext(save_path)[1].lower()
    if ext not in _IMAGE_EXTENSIONS:
        return False, "", "INVALID_EXTENSION"
    ok, info = _validate_path_in_workspace(save_path)
    if not ok:
        return False, info, "PATH_NOT_ALLOWED"
    return True, info, None


async def _persist_image_to_disk(
    image_bytes: bytes, save_path: str
) -> tuple[bool, str, int, str | None]:
    """将图片字节写入磁盘 save_path(覆盖已存在文件,父目录自动 mkdir)。

    Returns:
        (ok, saved_path, file_size_bytes, error_code)
    """
    if len(image_bytes) > _MAX_IMAGE_BYTES:
        return False, "", 0, "IMAGE_TOO_LARGE"
    try:
        from pathlib import Path

        path_obj = Path(save_path)
        path_obj.parent.mkdir(parents=True, exist_ok=True)
        with open(path_obj, "wb") as f:
            f.write(image_bytes)
        return True, str(path_obj), len(image_bytes), None
    except OSError:
        return False, "", 0, "WRITE_FAILED"


async def _tool_image_generation(arguments: dict[str, Any]) -> dict[str, Any]:
    """image_generation: 生成图片(stepfun/agnes provider,对标 Codex gpt-image-1.5)。

    2026-07-24 升级:支持 save_path 参数落地文件系统(b64_json decode 或 URL 下载)。
    """
    from datetime import datetime, timezone

    from ..core.config import settings

    prompt = arguments.get("prompt", "")
    size = arguments.get("size", "1024x1024")
    quality = arguments.get("quality", "standard")
    style = arguments.get("style", "natural")
    provider = arguments.get("provider", "stepfun")
    save_path = arguments.get("save_path")

    if not prompt or not isinstance(prompt, str):
        return {
            "tool": "image_generation", "ok": False,
            "error": "缺少 prompt 参数", "errorCode": "MISSING_PARAMS",
            "saved_path": None,
        }
    if provider not in ("stepfun", "agnes"):
        return {
            "tool": "image_generation", "ok": False,
            "error": f"未知 provider: {provider}(允许 stepfun/agnes)",
            "errorCode": "INVALID_PROVIDER", "saved_path": None,
        }

    # 选 provider(优先用户指定;若未配置 api_key 则降级尝试另一个)
    if provider == "stepfun":
        api_key, api_base, model = settings.stepfun_api_key, settings.stepfun_api_base, "step-1v-8k"
    else:
        api_key, api_base, model = settings.agnes_api_key, settings.agnes_api_base, "agnes-image-v1"

    if not api_key:
        if provider == "stepfun" and settings.agnes_api_key:
            api_key, api_base, model = settings.agnes_api_key, settings.agnes_api_base, "agnes-image-v1"
            provider = "agnes"
        elif provider == "agnes" and settings.stepfun_api_key:
            api_key, api_base, model = settings.stepfun_api_key, settings.stepfun_api_base, "step-1v-8k"
            provider = "stepfun"
        else:
            return {
                "tool": "image_generation", "ok": False,
                "errorCode": "PROVIDER_NOT_CONFIGURED", "saved_path": None,
                "message": "未配置图片生成 provider,请在 .env 设置 STEPFUN_API_KEY 或 AGNES_API_KEY",
            }

    try:
        import httpx
    except ImportError:
        return {
            "tool": "image_generation", "ok": False,
            "error": "httpx 未安装", "errorCode": "DEP_MISSING",
            "saved_path": None,
        }

    endpoint = f"{api_base}/images/generations"
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                endpoint,
                json={"prompt": prompt, "model": model, "size": size, "n": 1},
                headers={"Authorization": f"Bearer {api_key}"},
            )
        if resp.status_code >= 400:
            return {
                "tool": "image_generation", "ok": False, "prompt": prompt,
                "provider": provider, "saved_path": None,
                "error": f"provider 返回 {resp.status_code}: {resp.text[:200]}",
                "errorCode": "PROVIDER_ERROR",
            }
        data = resp.json()
        items = data.get("data") or []
        if not items:
            return {
                "tool": "image_generation", "ok": False, "prompt": prompt,
                "provider": provider, "saved_path": None,
                "error": "provider 返回空 data", "errorCode": "EMPTY_RESULT",
            }
        item = items[0]
        if item.get("b64_json"):
            image_url = f"data:image/png;base64,{item['b64_json']}"
        else:
            image_url = item.get("url", "")
        if not image_url:
            return {
                "tool": "image_generation", "ok": False, "prompt": prompt,
                "provider": provider, "saved_path": None,
                "error": "provider 响应缺少 url/b64_json", "errorCode": "EMPTY_RESULT",
            }

        # save_path 落地:校验 → 取字节 → 写入磁盘
        saved_path: str | None = None
        file_size_bytes: int = 0
        if save_path:
            ok_path, resolved, err_code = _validate_image_save_path(save_path)
            if not ok_path:
                return {
                    "tool": "image_generation", "ok": False, "prompt": prompt,
                    "provider": provider, "saved_path": None,
                    "errorCode": err_code,
                    "message": f"save_path 校验失败: {err_code}",
                }
            img_bytes = await _fetch_image_bytes(item, image_url, httpx)
            if img_bytes is None:
                return {
                    "tool": "image_generation", "ok": False, "prompt": prompt,
                    "provider": provider, "saved_path": None,
                    "errorCode": "IMAGE_FETCH_FAILED",
                    "message": "无法获取图片字节(b64 解码 / URL 下载均失败)",
                }
            ok_w, sp, sz, werr = await _persist_image_to_disk(img_bytes, resolved)
            if not ok_w:
                return {
                    "tool": "image_generation", "ok": False, "prompt": prompt,
                    "provider": provider, "saved_path": None,
                    "errorCode": werr,
                    "message": f"图片写入磁盘失败: {werr}",
                }
            saved_path = sp
            file_size_bytes = sz

        return {
            "tool": "image_generation", "ok": True, "prompt": prompt,
            "image_url": image_url, "size": size, "quality": quality, "style": style,
            "provider": provider, "model": model,
            "saved_path": saved_path, "file_size_bytes": file_size_bytes,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "message": f"图片已生成(provider={provider}, model={model}"
                       + (f", saved={saved_path}" if saved_path else "") + ")",
        }
    except Exception as e:
        return {
            "tool": "image_generation", "ok": False, "prompt": prompt,
            "provider": provider, "saved_path": None,
            "error": str(e)[:200], "errorCode": "GENERATION_FAILED",
            "message": f"图片生成失败: {type(e).__name__}",
        }


async def _fetch_image_bytes(
    item: dict, image_url: str, httpx_mod
) -> bytes | None:
    """从 provider 响应提取图片字节:优先 b64_json,降级 URL 下载。"""
    b64 = item.get("b64_json")
    if b64:
        try:
            import base64

            return base64.b64decode(b64)
        except Exception:
            return None
    if image_url and not image_url.startswith("data:"):
        try:
            async with httpx_mod.AsyncClient(timeout=60.0) as dl:
                dl_resp = await dl.get(image_url)
            if dl_resp.status_code < 400:
                return dl_resp.content
        except Exception:
            return None
    return None


def _scan_pr_files_for_findings(
    files: list[dict], focus: str
) -> list[dict[str, Any]]:
    """扫描 PR 文件 diff,用正则模式匹配潜在问题(零 LLM)。"""
    findings: list[dict[str, Any]] = []
    # (regex, category, severity, comment)
    _PATTERNS = [
        (r"\beval\s*\(", "security", "high", "使用 eval() 有代码注入风险"),
        (r"\bexec\s*\(", "security", "high", "使用 exec() 有代码注入风险"),
        (r"new\s+Function\s*\(", "security", "high", "new Function() 有代码注入风险"),
        (r"os\.system\s*\(", "security", "high", "os.system() 有命令注入风险"),
        (
            r"subprocess\.(?:run|call|Popen)\s*\([^)]*shell\s*=\s*True",
            "security", "high", "subprocess shell=True 有命令注入风险",
        ),
        (
            r"""(?:api[_-]?key|secret|token|password)\s*=\s*["'][^"']{8,}["']""",
            "security", "high", "疑似硬编码凭证",
        ),
        (
            r"for\s+[^:]+:\s*\n[+\-\s]*for\s+[^:]+:",
            "performance", "medium", "嵌套循环可能 O(n²)",
        ),
        (
            r"for\s+\w+\s+in\s+.*:\s*\n[+\-\s]*.*\.execute\s*\(",
            "performance", "medium", "疑似 N+1 查询模式",
        ),
    ]
    for f in files:
        filename = f.get("filename", "")
        patch = f.get("patch", "")
        if not patch:
            continue
        for rgx, cat, sev, comment in _PATTERNS:
            if focus not in ("all", cat):
                continue
            m = re.search(rgx, patch, re.IGNORECASE)
            if m:
                line_no = patch[: m.start()].count("\n") + 1
                findings.append({
                    "severity": sev, "file": filename,
                    "line": line_no, "category": cat, "comment": comment,
                })
        # readability: 大函数检测(新增行 > 500)
        added_count = sum(
            1 for ln in patch.splitlines()
            if ln.startswith("+") and not ln.startswith("+++")
        )
        if focus in ("readability", "all") and added_count > 500:
            findings.append({
                "severity": "low", "file": filename, "line": 1,
                "category": "readability",
                "comment": f"新增 {added_count} 行,可能函数过长",
            })
    return findings


# PR diff 缓存(进程内,TTL 1h,2026-07-24 review_pr 升级)
_PR_DIFF_CACHE: dict[str, tuple[str, float]] = {}
_PR_DIFF_CACHE_TTL = 3600.0  # 1 hour


def _get_cached_pr_diff(key: str) -> str | None:
    """读 PR diff 缓存:命中且未过期返回 diff 文本,否则 None。"""
    if key not in _PR_DIFF_CACHE:
        return None
    diff_text, ts = _PR_DIFF_CACHE[key]
    if time.time() - ts > _PR_DIFF_CACHE_TTL:
        del _PR_DIFF_CACHE[key]
        return None
    return diff_text


def _set_cached_pr_diff(key: str, diff_text: str) -> None:
    """写 PR diff 缓存(TTL 在读时检查)。"""
    _PR_DIFF_CACHE[key] = (diff_text, time.time())


def _parse_unified_diff(diff_text: str) -> list[dict]:
    """解析 unified diff 文本为文件列表。

    每项: {filename, patch(原始 diff 行), additions, deletions}
    以 '+++ b/<path>' 行作为文件边界。
    """
    files: list[dict] = []
    current: dict | None = None
    for line in diff_text.splitlines():
        m = re.match(r"^\+\+\+ b/(.+?)(?:\s|$)", line)
        if m:
            if current:
                files.append(current)
            current = {
                "filename": m.group(1).strip(),
                "patch": "",
                "additions": 0,
                "deletions": 0,
            }
            current["patch"] += line + "\n"
            continue
        if current is None:
            continue
        current["patch"] += line + "\n"
        if line.startswith("+") and not line.startswith("+++"):
            current["additions"] += 1
        elif line.startswith("-") and not line.startswith("---"):
            current["deletions"] += 1
    if current:
        files.append(current)
    return files


def _compute_diff_stats(files: list[dict]) -> dict[str, Any]:
    """从解析后的文件列表计算 files_changed/added_lines/removed_lines/complexity/risk。"""
    files_changed = len(files)
    added = sum(f.get("additions", 0) for f in files)
    removed = sum(f.get("deletions", 0) for f in files)
    complexity = added + 2 * removed + 10 * files_changed
    if complexity < 50:
        risk = "low"
    elif complexity < 300:
        risk = "medium"
    else:
        risk = "high"
    return {
        "files_changed": files_changed,
        "added_lines": added,
        "removed_lines": removed,
        "complexity_score": complexity,
        "risk_assessment": risk,
    }


def _gh_error_for_status(status: int) -> str:
    """GitHub API 状态码 → errorCode 映射(2026-07-24 spec)。"""
    if status in (401, 403):
        return "GITHUB_AUTH_FAILED"
    if status in (404, 422):
        return "PR_NOT_FOUND"
    return "GITHUB_API_ERROR"


async def _tool_review_pr(arguments: dict[str, Any]) -> dict[str, Any]:
    """review_pr: GitHub PR 审查(正则模式匹配,零 LLM,对标 Codex GitHub PR Reviews)。

    2026-07-24 升级:
    - 新增 diff 参数(字符串),与 repo+pr_number 互斥(优先 repo+pr_number)
    - repo+pr_number 时调 GitHub API 获取真实 diff(Accept: application/vnd.github.v3.diff)
    - Authorization: Bearer(GITHUB_TOKEN 可空,空则匿名限速 60/h)
    - 新增 source / pr_url / files_changed / added_lines / removed_lines / complexity_score / risk_assessment
    - 进程内 cache 1h(key=github:pr:{repo}:{pr_number}:diff)
    """
    repo = arguments.get("repo", "")
    pr_number = arguments.get("pr_number")
    diff_arg = arguments.get("diff", "")
    focus = arguments.get("focus", "all")
    max_files = int(arguments.get("max_files", 20))

    if focus not in ("security", "performance", "readability", "all"):
        return {
            "tool": "review_pr", "ok": False,
            "error": f"无效 focus: {focus}", "errorCode": "INVALID_PARAMS",
        }

    use_github = bool(repo and "/" in repo and pr_number is not None)
    if not use_github and not diff_arg:
        return {
            "tool": "review_pr", "ok": False,
            "error": "缺少 repo+pr_number 或 diff 参数", "errorCode": "MISSING_PARAMS",
        }

    # 分支 1:diff 字符串(无 GitHub API 调用)
    if not use_github:
        files = _parse_unified_diff(diff_arg)[:max_files]
        findings = _scan_pr_files_for_findings(files, focus)
        stats = _compute_diff_stats(files)
        return _build_review_result(
            repo="", pr_number=None, source="diff_string", pr_url=None,
            title="", author="", additions=0, deletions=0,
            files_reviewed=len(files), findings=findings, stats=stats, focus=focus,
        )

    # 分支 2:GitHub API(repo + pr_number)
    try:
        pr_number = int(pr_number)
    except (TypeError, ValueError):
        return {
            "tool": "review_pr", "ok": False,
            "error": "pr_number 必须是正整数", "errorCode": "INVALID_PARAMS",
        }
    if pr_number <= 0:
        return {
            "tool": "review_pr", "ok": False,
            "error": "pr_number 必须是正整数", "errorCode": "INVALID_PARAMS",
        }

    try:
        import httpx
    except ImportError:
        return {
            "tool": "review_pr", "ok": False,
            "error": "httpx 未安装", "errorCode": "DEP_MISSING",
        }

    gh_token = os.environ.get("GITHUB_TOKEN", "")
    auth_hdr = f"Bearer {gh_token}" if gh_token else None
    headers_json = {"Accept": "application/vnd.github+json"}
    headers_diff = {"Accept": "application/vnd.github.v3.diff"}
    if auth_hdr:
        headers_json["Authorization"] = auth_hdr
        headers_diff["Authorization"] = auth_hdr

    cache_key = f"github:pr:{repo}:{pr_number}:diff"
    cached_diff = _get_cached_pr_diff(cache_key)
    base = f"https://api.github.com/repos/{repo}/pulls/{pr_number}"

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            # 1) JSON metadata(title/author/additions/deletions,向后兼容)
            pr_resp = await client.get(base, headers=headers_json)
            if pr_resp.status_code >= 400:
                return {
                    "tool": "review_pr", "ok": False, "repo": repo,
                    "pr_number": pr_number,
                    "error": f"GitHub API 返回 {pr_resp.status_code}",
                    "errorCode": _gh_error_for_status(pr_resp.status_code),
                }
            pr_data = pr_resp.json()

            # 2) Raw diff via Accept: application/vnd.github.v3.diff(新)
            if cached_diff is None:
                diff_resp = await client.get(base, headers=headers_diff)
                if diff_resp.status_code >= 400:
                    return {
                        "tool": "review_pr", "ok": False, "repo": repo,
                        "pr_number": pr_number,
                        "error": f"GitHub API (diff) 返回 {diff_resp.status_code}",
                        "errorCode": _gh_error_for_status(diff_resp.status_code),
                    }
                cached_diff = diff_resp.text
                _set_cached_pr_diff(cache_key, cached_diff)

            # 3) /files endpoint(向后兼容:findings 走 file list + patch)
            files_resp = await client.get(f"{base}/files", headers=headers_json)
            files_data = files_resp.json() if files_resp.status_code < 400 else []
    except Exception as e:
        return {
            "tool": "review_pr", "ok": False, "repo": repo,
            "pr_number": pr_number,
            "error": str(e)[:200], "errorCode": "GITHUB_API_ERROR",
            "message": f"PR 审查失败: {type(e).__name__}",
        }

    files_to_scan = files_data[:max_files] if isinstance(files_data, list) else []
    findings = _scan_pr_files_for_findings(files_to_scan, focus)
    parsed_files = _parse_unified_diff(cached_diff)
    stats = _compute_diff_stats(parsed_files)

    return _build_review_result(
        repo=repo, pr_number=pr_number, source="github_api",
        pr_url=f"https://github.com/{repo}/pull/{pr_number}",
        title=pr_data.get("title", ""),
        author=(pr_data.get("user") or {}).get("login", ""),
        additions=pr_data.get("additions", 0),
        deletions=pr_data.get("deletions", 0),
        files_reviewed=len(files_to_scan),
        findings=findings, stats=stats, focus=focus,
    )


def _build_review_result(
    repo: str, pr_number: int | None, source: str, pr_url: str | None,
    title: str, author: str, additions: int, deletions: int,
    files_reviewed: int, findings: list, stats: dict, focus: str,
) -> dict[str, Any]:
    """组装 review_pr 返回结构(避免主函数超 80 行)。"""
    high = sum(1 for f in findings if f["severity"] == "high")
    med = sum(1 for f in findings if f["severity"] == "medium")
    low = sum(1 for f in findings if f["severity"] == "low")
    result: dict[str, Any] = {
        "tool": "review_pr", "ok": True, "repo": repo,
        "pr_number": pr_number,
        "source": source,
        "pr_url": pr_url,
        "title": title,
        "author": author,
        "files_reviewed": files_reviewed,
        "additions": additions,
        "deletions": deletions,
        "files_changed": stats["files_changed"],
        "added_lines": stats["added_lines"],
        "removed_lines": stats["removed_lines"],
        "complexity_score": stats["complexity_score"],
        "risk_assessment": stats["risk_assessment"],
        "findings": findings,
        "summary": (
            f"审查 {files_reviewed} 个文件,发现 {high} 个 high / "
            f"{med} 个 medium / {low} 个 low 问题"
        ),
        "message": f"PR 审查完成(focus={focus}, {len(findings)} 个 finding, source={source})",
    }
    return result


async def _tool_summarize_artifacts(arguments: dict[str, Any]) -> dict[str, Any]:
    """summarize_artifacts: 聚合当前会话的 plans/sources/artifacts(对标 Codex Summary pane)。

    通过 artifacts_store 读取(Redis hash 持久化,进程重启不丢;Redis 不可用降级进程内)。
    纯本地读取,不调外部 API(零算力)。
    """
    conversation_id = arguments.get("conversation_id", "")
    include = arguments.get("include") or ["plans", "sources", "artifacts", "tool_calls"]
    max_items = int(arguments.get("max_items", 20))

    result: dict[str, Any] = {
        "tool": "summarize_artifacts", "ok": True,
        "conversation_id": conversation_id,
        "plans": [], "sources": [], "artifacts": [],
        "tool_calls_summary": {"total": 0, "by_tool": {}},
        "message": "",
    }

    if not conversation_id:
        result["message"] = "未提供 conversation_id,返回空 artifacts"
        return result

    cached = _load_artifacts(conversation_id)
    if not cached:
        result["message"] = "无会话 artifacts 记录(可能为新会话或 Redis 未命中)"
        return result

    def _clip(items: Any) -> Any:
        return items[:max_items] if isinstance(items, list) else items

    if "plans" in include:
        result["plans"] = _clip(cached.get("plans", []))
    if "sources" in include:
        result["sources"] = _clip(cached.get("sources", []))
    if "artifacts" in include:
        result["artifacts"] = _clip(cached.get("artifacts", []))
    if "tool_calls" in include:
        tc = cached.get("tool_calls", [])
        by_tool: dict[str, int] = {}
        for call in tc:
            name = call.get("tool", "unknown") if isinstance(call, dict) else "unknown"
            by_tool[name] = by_tool.get(name, 0) + 1
        result["tool_calls_summary"] = {"total": len(tc), "by_tool": by_tool}
    result["message"] = f"聚合 {conversation_id} 的 artifacts 完成"
    return result


def _parse_simple_cron(cron: str) -> str | None:
    """降级解析简单 cron 表达式(croniter 未安装时,仅支持 'M H * * *' 形式)。"""
    parts = cron.split()
    if len(parts) != 5:
        return None
    minute, hour, *_rest = parts
    try:
        m = int(minute)
        h = int(hour)
    except ValueError:
        return None
    return f"{h:02d}:{m:02d} daily (cron: {cron})"


def _build_scheduler_params(
    task: dict[str, Any],
) -> tuple[str, dict[str, Any], dict[str, Any]]:
    """将 schedule_task 任务字典映射为 task_scheduler 的 (trigger_type, trigger_config, callback)。

    - once → date trigger(run_date=run_at)
    - recurring + cron → cron trigger(解析 crontab 5 字段 → APScheduler kwargs)
    - recurring + interval_seconds → interval trigger
    callback:webhook_url 存在 → http_webhook,否则 mcp_tool(dispatch_subagent)。
    """
    schedule = task.get("schedule", "once")
    webhook_url = task.get("webhook_url", "")
    prompt = task.get("prompt", "")
    task_id = task.get("task_id", "")

    if schedule == "once":
        trigger_type = "date"
        trigger_config = {"run_date": task.get("run_at", "")}
    elif task.get("cron"):
        trigger_type = "cron"
        parts = str(task.get("cron", "")).split()
        if len(parts) != 5:
            raise ValueError(f"cron 表达式必须是 5 字段: {task.get('cron')}")
        trigger_config = {
            "minute": parts[0], "hour": parts[1], "day": parts[2],
            "month": parts[3], "day_of_week": parts[4],
        }
    else:
        trigger_type = "interval"
        trigger_config = {"seconds": int(task.get("interval_seconds") or 0)}

    if webhook_url:
        callback = {
            "type": "http_webhook", "url": webhook_url,
            "payload": {"prompt": prompt, "task_id": task_id},
        }
    else:
        callback = {
            "type": "mcp_tool", "tool_name": "dispatch_subagent",
            "args": {"name": "feature-planner", "task": prompt},
        }
    return trigger_type, trigger_config, callback


async def _tool_schedule_task(arguments: dict[str, Any]) -> dict[str, Any]:
    """schedule_task: 调度定时任务(对标 Codex Automations)。

    支持 cron / date / interval 三种 trigger,任务记录持久化到 Redis
    (key: mcp:schedule:<task_id> 详细记录 + task_scheduler 内部 mcp:scheduled_task: 调度态),
    由 task_scheduler(AsyncIOScheduler)后台执行 worker(派发 dispatch_subagent 或 POST webhook_url)。
    """
    import uuid
    from datetime import datetime, timezone, timedelta

    name = arguments.get("name", "")
    prompt = arguments.get("prompt", "")
    schedule = arguments.get("schedule", "once")
    run_at = arguments.get("run_at", "")
    cron = arguments.get("cron", "")
    interval_seconds = arguments.get("interval_seconds")
    webhook_url = arguments.get("webhook_url", "")
    agent_tools = (
        arguments.get("agent_tools")
        or ["search_codebase", "read_file", "web_search"]
    )

    if not name:
        return {
            "tool": "schedule_task", "ok": False,
            "error": "缺少 name 参数", "errorCode": "MISSING_PARAMS",
        }
    if not prompt:
        return {
            "tool": "schedule_task", "ok": False,
            "error": "缺少 prompt 参数", "errorCode": "MISSING_PARAMS",
        }
    if schedule not in ("once", "recurring"):
        return {
            "tool": "schedule_task", "ok": False,
            "error": f"无效 schedule: {schedule}", "errorCode": "INVALID_PARAMS",
        }
    if schedule == "once" and not run_at:
        return {
            "tool": "schedule_task", "ok": False,
            "error": "schedule=once 时 run_at 必填", "errorCode": "MISSING_PARAMS",
        }
    if schedule == "recurring" and not cron and not interval_seconds:
        return {
            "tool": "schedule_task", "ok": False,
            "error": "schedule=recurring 时 cron 或 interval_seconds 至少一个必填",
            "errorCode": "MISSING_PARAMS",
        }

    next_run_at = ""
    if schedule == "once":
        next_run_at = run_at
    elif cron:
        # recurring + cron:优先用 croniter 计算 next_run
        try:
            from croniter import croniter  # type: ignore[import-not-found]

            cron_iter = croniter(cron, datetime.now(timezone.utc))
            next_run_at = cron_iter.get_next(datetime).isoformat()
        except ImportError:
            parsed = _parse_simple_cron(cron)
            if parsed is None:
                return {
                    "tool": "schedule_task", "ok": False,
                    "errorCode": "CRON_NOT_SUPPORTED",
                    "message": "croniter 未安装,无法解析复杂 cron 表达式",
                }
            next_run_at = parsed
    else:
        # recurring + interval_seconds
        try:
            int(interval_seconds)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return {
                "tool": "schedule_task", "ok": False,
                "error": "interval_seconds 必须为正整数",
                "errorCode": "INVALID_PARAMS",
            }
        next_run_at = (
            datetime.now(timezone.utc) + timedelta(seconds=int(interval_seconds))
        ).isoformat()

    task_id = uuid.uuid4().hex
    task = {
        "task_id": task_id, "name": name, "prompt": prompt,
        "schedule": schedule, "run_at": run_at, "cron": cron,
        "interval_seconds": interval_seconds, "agent_tools": agent_tools,
        "next_run_at": next_run_at, "status": "scheduled",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "webhook_url": webhook_url,
    }
    _SCHEDULED_TASKS.append(task)
    # 持久化到 Redis(失败降级内存,不阻塞调度)
    _persist_task_to_redis(task)
    # 注册到后台调度器(task_scheduler 单例:AsyncIOScheduler + cron/date/interval + worker 回调)
    # scheduler 未启动或 stub 模式时 add_task 内部降级,不抛异常
    try:
        from app.services.scheduler_service import task_scheduler

        trigger_type, trigger_config, callback = _build_scheduler_params(task)
        sched_result = await task_scheduler.add_task(
            task_id, trigger_type, trigger_config, callback,
            conversation_id=name,
        )
        if sched_result.get("next_run_at"):
            task["next_run_at"] = sched_result["next_run_at"]
            _persist_task_to_redis(task)
    except Exception as e:
        logger.warning("[schedule_task] 注册到 task_scheduler 失败(仅持久化): %s", e)
    return {
        "tool": "schedule_task", "ok": True, "task_id": task_id,
        "name": name, "schedule": schedule, "next_run_at": next_run_at,
        "status": "scheduled",
        "message": "任务已调度,后台 worker 将按计划自动执行",
    }


async def _tool_proactive_suggestion(arguments: dict[str, Any]) -> dict[str, Any]:
    """proactive_suggestion: 基于当前会话上下文主动建议后续工作(对标 Codex Proactive work proposals)。

    纯本地规则匹配(零算力,不调 LLM)。
    """
    ctx = arguments.get("conversation_context", "") or ""
    recent_files = arguments.get("recent_files") or []
    recent_tool_calls = arguments.get("recent_tool_calls") or []

    suggestions: list[dict[str, Any]] = []
    ctx_lower = ctx.lower()

    if "write_file" in recent_tool_calls:
        suggestions.append({
            "type": "follow_up", "title": "为新代码添加单元测试",
            "description": "检测到 write_file 调用,建议为新代码补充对应单元测试",
            "priority": "high", "estimated_steps": 2,
            "related_files": recent_files,
        })
    if "edit_file" in recent_tool_calls and "search_codebase" not in recent_tool_calls:
        suggestions.append({
            "type": "explore", "title": "先搜索是否有类似实现可复用",
            "description": "检测到 edit_file 但未先 search_codebase,建议先搜索可复用代码",
            "priority": "medium", "estimated_steps": 1,
            "related_files": [],
        })
    _TEST_SUFFIXES = (".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")
    if any(
        isinstance(f, str) and f.endswith(_TEST_SUFFIXES) for f in recent_files
    ):
        suggestions.append({
            "type": "test", "title": "运行测试验证改动",
            "description": "检测到测试文件改动,建议运行测试确保通过",
            "priority": "high", "estimated_steps": 1,
            "related_files": [
                f for f in recent_files
                if isinstance(f, str) and (".test." in f or ".spec." in f)
            ],
        })
    if "fix" in ctx_lower or "bug" in ctx_lower:
        suggestions.append({
            "type": "test", "title": "添加回归测试覆盖 bug 场景",
            "description": "检测到 bug 修复上下文,建议添加回归测试防止复发",
            "priority": "high", "estimated_steps": 2,
            "related_files": recent_files,
        })
    if "refactor" in ctx_lower:
        suggestions.append({
            "type": "improve", "title": "审查重构影响范围",
            "description": "检测到重构上下文,建议审查影响范围与兼容性",
            "priority": "medium", "estimated_steps": 2,
            "related_files": recent_files,
        })
    if "new feature" in ctx_lower or "新增" in ctx:
        suggestions.append({
            "type": "follow_up", "title": "同步更新 README + 守门脚本",
            "description": "检测到新功能上下文,建议同步更新 README 与守门脚本",
            "priority": "medium", "estimated_steps": 2,
            "related_files": [],
        })

    if not suggestions:
        return {
            "tool": "proactive_suggestion", "ok": True,
            "suggestions": [],
            "message": "上下文不足,无法生成建议",
        }
    return {
        "tool": "proactive_suggestion", "ok": True,
        "suggestions": suggestions,
        "message": f"生成 {len(suggestions)} 条建议",
    }


# 工具注册表
_TOOLS: list[MCPTool] = [
    MCPTool(
        name="search_codebase",
        description="代码符号搜索(真实文件系统,支持 def/class/func/function/interface/type 符号 + 引用匹配)",
        input_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "符号名或关键词(函数名/类名等)"},
                "path": {"type": "string", "description": "搜索路径(默认当前目录)"},
                "pattern": {"type": "string", "description": "文件名 glob 限定(逗号分隔,默认按代码扩展名过滤)"},
                "symbol_type": {"type": "string", "description": "符号类型过滤(def/class/func/function/interface/type,默认空=全部)"},
                "max_results": {"type": "integer", "description": "最大返回数", "default": 50},
                "use_semantic": {"type": "boolean", "description": "是否使用语义搜索(pgvector ANN,默认 True;失败/无结果时自动 fallback 到 regex)", "default": True},
            },
            "required": ["query"],
        },
    ),
    MCPTool(
        name="read_file",
        description="读取本地文件内容",
        input_schema={
            "type": "object",
            "properties": {"path": {"type": "string", "description": "文件绝对或相对路径"}},
            "required": ["path"],
        },
    ),
    MCPTool(
        name="write_file",
        description="写入内容到本地文件",
        input_schema={
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {"type": "string"},
            },
            "required": ["path", "content"],
        },
    ),
    MCPTool(
        name="file_edit",
        description="精细编辑文件:精确替换 old_string 为 new_string,带 conflict 检测",
        input_schema={
            "type": "object",
            "required": ["file_path", "old_string", "new_string"],
            "properties": {
                "file_path": {"type": "string", "description": "文件绝对路径,必须在工作区白名单内"},
                "old_string": {"type": "string", "minLength": 1, "description": "要替换的字符串(不能为空)"},
                "new_string": {"type": "string", "description": "替换后的字符串(可为空=删除)"},
                "replace_all": {"type": "boolean", "default": False, "description": "true 替换所有匹配;false 必须唯一匹配,多个报 AMBIGUOUS_MATCH"},
            },
        },
    ),
    MCPTool(
        name="run_command",
        description="运行 shell 命令(asyncio.subprocess 流式读取 stdout/stderr,白名单: git/ls/cat/echo/python/node/npm/pnpm/ruff/mypy/pytest 等,禁止 rm/mv/cp/curl/重定向/管道)。支持 sandbox_backend 切换 local/docker/ssh,支持 env 透传(禁止覆盖 PATH/HOME),cwd 校验工作区,超时 kill 进程并返回 partial_output",
        input_schema={
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "命令字符串(如 git status, python --version)"},
                "cwd": {"type": "string", "description": "工作目录(默认当前目录,非 . 时需在工作区白名单内)", "default": "."},
                "timeout": {"type": "integer", "description": "超时秒数(默认 60,不超过 max_timeout)", "default": 60},
                "max_timeout": {"type": "integer", "description": "超时上限(默认 600,timeout 不超过此值)", "default": 600},
                "env": {
                    "type": "object",
                    "description": "环境变量 dict(透传到 subprocess,不允许覆盖 PATH/HOME/USERPROFILE)",
                    "additionalProperties": {"type": "string"},
                },
                "sandbox_backend": {
                    "type": "string",
                    "enum": ["local", "docker", "ssh", "modal", "daytona", "singularity"],
                    "description": "沙箱后端(默认 local,modal/daytona/singularity 预留未实现)",
                    "default": "local",
                },
                "docker_image": {
                    "type": "string",
                    "description": "Docker 镜像(backend=docker 时,默认 python:3.12-slim)",
                    "default": "python:3.12-slim",
                },
                "ssh_host": {"type": "string", "description": "SSH 主机(backend=ssh 时必填)"},
                "ssh_user": {"type": "string", "description": "SSH 用户名(backend=ssh 时,默认 root)", "default": "root"},
            },
            "required": ["command"],
        },
    ),
    MCPTool(
        name="web_search",
        description="网页搜索(复用 DuckDuckGo Lite HTML,无 API key)",
        input_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索关键词"},
                "max_results": {"type": "integer", "description": "最大返回数", "default": 5},
            },
            "required": ["query"],
        },
    ),
    MCPTool(
        name="search_web",
        description="DuckDuckGo Lite 搜索",
        input_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "max_results": {"type": "integer", "default": 5},
            },
            "required": ["query"],
        },
    ),
    MCPTool(
        name="analyze_code",
        description="代码静态分析(行数、注释、空行等)",
        input_schema={
            "type": "object",
            "properties": {
                "code": {"type": "string"},
                "language": {"type": "string", "default": "text"},
            },
            "required": ["code"],
        },
    ),
    MCPTool(
        name="generate_test",
        description="为代码生成测试模板",
        input_schema={
            "type": "object",
            "properties": {
                "code": {"type": "string"},
                "language": {"type": "string", "default": "python"},
                "framework": {"type": "string", "default": "pytest"},
            },
            "required": ["code"],
        },
    ),
    MCPTool(
        name="file_search",
        description="搜索文件内容(真实文件系统搜索,支持文件名 glob + 内容关键词)",
        input_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索关键词(为空则仅按文件名匹配)"},
                "path": {"type": "string", "description": "搜索路径(默认当前目录)"},
                "pattern": {"type": "string", "description": "文件名 glob 匹配模式", "default": "*"},
                "max_results": {"type": "integer", "description": "最大返回数", "default": 50},
            },
            "required": [],
        },
    ),
    MCPTool(
        name="git_operations",
        description=(
            "Git 操作(真实 git 命令)。只读(所有用户): status/diff/log/branch/show/stash/list; "
            "写操作(需 admin): branch_create/branch_switch/branch_delete/merge/rebase/"
            "stash_push/stash_pop/tag_create/tag_list"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "description": (
                        "git 操作。只读: status/diff/log/branch/show/stash/list; "
                        "写(admin): branch_create/branch_switch/branch_delete/merge/rebase/"
                        "stash_push/stash_pop/tag_create/tag_list"
                    ),
                    "default": "status",
                },
                "repo": {"type": "string", "description": "仓库路径(默认当前目录)", "default": "."},
                "ref": {"type": "string", "description": "git 引用(仅 show 操作使用,默认 HEAD)", "default": "HEAD"},
                "name": {"type": "string", "description": "分支名/标签名(branch_create/branch_switch/branch_delete/tag_create 必填)"},
                "from": {"type": "string", "description": "起点引用(branch_create,默认 HEAD)"},
                "create": {"type": "boolean", "description": "不存在时创建(branch_switch)"},
                "force": {"type": "boolean", "description": "强制删除未合并分支(branch_delete,-D)"},
                "branch": {"type": "string", "description": "要合并的分支(merge)或变基目标分支(rebase)"},
                "upstream": {"type": "string", "description": "上游分支(rebase 必填,如 origin/main)"},
                "no_ff": {"type": "boolean", "description": "禁用 fast-forward(merge,--no-ff)"},
                "squash": {"type": "boolean", "description": "压缩合并(merge,--squash)"},
                "message": {"type": "string", "description": "提交信息(merge/tag_create/stash_push)"},
                "include_untracked": {"type": "boolean", "description": "包含未跟踪文件(stash_push,-u)"},
                "index": {"type": "integer", "description": "暂存索引(stash_pop,默认 0)", "default": 0},
                "apply": {"type": "boolean", "description": "仅应用不删除(stash_pop,--apply)"},
                "annotated": {"type": "boolean", "description": "创建附注标签(tag_create,-a)"},
                "pattern": {"type": "string", "description": "glob 匹配模式(tag_list,如 v*)"},
            },
            "required": [],
        },
    ),
    MCPTool(
        name="db_query",
        description="数据库只读查询(真实 postgres,仅允许 SELECT/WITH,参数化 + 超时 + 行数限制)",
        input_schema={
            "type": "object",
            "properties": {
                "sql": {"type": "string", "description": "SQL 查询语句(仅 SELECT/WITH)"},
                "params": {"type": "array", "description": "参数化查询参数($1,$2... 占位符)", "default": []},
                "max_rows": {"type": "integer", "description": "最大返回行数(默认 100,上限 1000)", "default": 100},
            },
            "required": ["sql"],
        },
    ),
    # ===== AI 自动控制浏览器(12 个,由 extension 端执行)=====
    MCPTool(
        name="browser_screenshot",
        description="浏览器截图(chrome.tabs.captureVisibleTab,返回 base64 PNG)",
        input_schema={
            "type": "object",
            "properties": {
                "area": {"type": "string", "enum": ["viewport", "fullpage", "element"], "default": "viewport"},
                "selector": {"type": "string", "description": "area='element' 时的 CSS 选择器"},
            },
        },
    ),
    MCPTool(
        name="browser_click_element",
        description="点击浏览器页面元素(CSS 选择器定位)",
        input_schema={
            "type": "object",
            "properties": {
                "selector": {"type": "string", "description": "CSS 选择器"},
                "button": {"type": "string", "enum": ["left", "right", "middle"], "default": "left"},
                "count": {"type": "integer", "default": 1},
            },
            "required": ["selector"],
        },
    ),
    MCPTool(
        name="browser_type_text",
        description="在浏览器输入框输入文本(CSS 选择器定位)",
        input_schema={
            "type": "object",
            "properties": {
                "selector": {"type": "string"},
                "text": {"type": "string"},
                "clear": {"type": "boolean", "default": True},
                "delay": {"type": "integer", "default": 0},
            },
            "required": ["selector", "text"],
        },
    ),
    MCPTool(
        name="browser_scroll",
        description="浏览器页面滚动(上下左右)",
        input_schema={
            "type": "object",
            "properties": {
                "direction": {"type": "string", "enum": ["up", "down", "left", "right"]},
                "amount": {"type": "integer", "default": 300},
                "selector": {"type": "string", "description": "作用于指定元素,默认 window"},
            },
            "required": ["direction"],
        },
    ),
    MCPTool(
        name="browser_extract_dom",
        description="提取浏览器页面 DOM 信息(文本/属性/节点结构)",
        input_schema={
            "type": "object",
            "properties": {
                "selector": {"type": "string", "description": "空=visible;'all'=全文档;其他=选择器"},
                "attributes": {"type": "array", "items": {"type": "string"}, "default": ["text", "href", "src", "value"]},
                "maxNodes": {"type": "integer", "default": 100},
            },
        },
    ),
    MCPTool(
        name="browser_navigate",
        description="浏览器导航到指定 URL",
        input_schema={
            "type": "object",
            "properties": {
                "url": {"type": "string"},
                "waitUntil": {"type": "string", "enum": ["load", "domcontentloaded", "networkidle0", "networkidle2"], "default": "load"},
                "timeout": {"type": "integer", "default": 30000},
            },
            "required": ["url"],
        },
    ),
    MCPTool(
        name="browser_wait_for_element",
        description="等待浏览器页面元素出现/消失",
        input_schema={
            "type": "object",
            "properties": {
                "selector": {"type": "string"},
                "state": {"type": "string", "enum": ["attached", "detached", "visible", "hidden"], "default": "visible"},
                "timeout": {"type": "integer", "default": 30000},
            },
            "required": ["selector"],
        },
    ),
    MCPTool(
        name="browser_get_attribute",
        description="获取浏览器页面元素属性值",
        input_schema={
            "type": "object",
            "properties": {
                "selector": {"type": "string"},
                "attribute": {"type": "string"},
            },
            "required": ["selector", "attribute"],
        },
    ),
    MCPTool(
        name="browser_hover",
        description="鼠标悬停在浏览器页面元素上",
        input_schema={
            "type": "object",
            "properties": {"selector": {"type": "string"}},
            "required": ["selector"],
        },
    ),
    MCPTool(
        name="browser_select_option",
        description="选择浏览器页面 select 下拉选项",
        input_schema={
            "type": "object",
            "properties": {
                "selector": {"type": "string"},
                "value": {"type": "string", "description": "选项值或文本"},
            },
            "required": ["selector", "value"],
        },
    ),
    MCPTool(
        name="browser_switch_tab",
        description="切换浏览器标签页(按索引)",
        input_schema={
            "type": "object",
            "properties": {"index": {"type": "integer", "description": "0-based 标签页索引"}},
            "required": ["index"],
        },
    ),
    MCPTool(
        name="browser_close_tab",
        description="关闭当前浏览器标签页",
        input_schema={"type": "object", "properties": {}},
    ),
    # ===== AI 自动控制电脑(10 个,由 desktop 端 Tauri 执行)=====
    MCPTool(
        name="computer_screenshot_screen",
        description="电脑截屏(返回 base64 PNG,支持多显示器 + 区域截取)",
        input_schema={
            "type": "object",
            "properties": {
                "displayIndex": {"type": "integer", "default": 0, "description": "显示器索引,默认 0(主屏)"},
                "region": {"type": "array", "items": {"type": "number"}, "description": "[x, y, w, h] 截取区域,默认全屏"},
            },
        },
    ),
    MCPTool(
        name="computer_mouse_move",
        description="移动电脑鼠标(绝对坐标)",
        input_schema={
            "type": "object",
            "properties": {
                "x": {"type": "number"},
                "y": {"type": "number"},
                "absolute": {"type": "boolean", "default": True},
            },
            "required": ["x", "y"],
        },
    ),
    MCPTool(
        name="computer_mouse_click",
        description="点击电脑鼠标(支持左/右/中键 + 单/双击)",
        input_schema={
            "type": "object",
            "properties": {
                "x": {"type": "number"},
                "y": {"type": "number"},
                "button": {"type": "string", "enum": ["left", "right", "middle"], "default": "left"},
                "count": {"type": "integer", "default": 1},
            },
            "required": ["x", "y"],
        },
    ),
    MCPTool(
        name="computer_keyboard_type",
        description="电脑键盘输入文本(逐字符)",
        input_schema={
            "type": "object",
            "properties": {
                "text": {"type": "string"},
                "delay": {"type": "integer", "default": 0},
            },
            "required": ["text"],
        },
    ),
    MCPTool(
        name="computer_mouse_scroll",
        description="电脑鼠标滚轮(正数向上,负数向下)",
        input_schema={
            "type": "object",
            "properties": {
                "deltaY": {"type": "integer"},
                "x": {"type": "number"},
                "y": {"type": "number"},
            },
            "required": ["deltaY"],
        },
    ),
    MCPTool(
        name="computer_keyboard_press",
        description="电脑键盘按单个键(如 Enter/Tab/Escape)",
        input_schema={
            "type": "object",
            "properties": {"key": {"type": "string"}},
            "required": ["key"],
        },
    ),
    MCPTool(
        name="computer_keyboard_hotkey",
        description="电脑键盘组合键(如 Ctrl+Shift+A)",
        input_schema={
            "type": "object",
            "properties": {
                "keys": {"type": "array", "items": {"type": "string"}, "description": "如 ['Control','Shift','A']"},
            },
            "required": ["keys"],
        },
    ),
    MCPTool(
        name="computer_active_window",
        description="获取电脑当前活动窗口信息(标题/应用名/边界)",
        input_schema={"type": "object", "properties": {}},
    ),
    MCPTool(
        name="computer_clipboard_get",
        description="读取电脑剪贴板内容(文本/图片)",
        input_schema={
            "type": "object",
            "properties": {"format": {"type": "string", "enum": ["text", "image"], "default": "text"}},
        },
    ),
    MCPTool(
        name="computer_clipboard_set",
        description="写入电脑剪贴板内容(文本/图片)",
        input_schema={
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "文本内容或 base64 image dataURL"},
                "format": {"type": "string", "enum": ["text", "image"], "default": "text"},
            },
            "required": ["content"],
        },
    ),
    # ===== 自动化任务配置工具(2026-07-22 新增)=====
    MCPTool(
        name="configure_automation_task",
        description=(
            "配置自媒体自动化定时任务(支持 koubo_daily / wechat_daily 两个内置任务)。"
            "可修改执行时间、dry-run 模式、启用状态、标题模板。"
            "适用于用户说'帮我设置每天 9 点生成公众号文章'等场景。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "string",
                    "enum": ["koubo_daily", "wechat_daily"],
                    "description": "任务 ID:koubo_daily=每日口播稿生成,wechat_daily=每日公众号文章生成",
                },
                "hour": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 23,
                    "description": "执行小时(0-23,24 小时制)",
                },
                "minute": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 59,
                    "description": "执行分钟(0-59)",
                },
                "dry_run": {
                    "type": "boolean",
                    "description": "是否 dry-run 模式(默认 true,只生成不发布)",
                },
                "enabled": {
                    "type": "boolean",
                    "description": "是否启用任务(默认 true)",
                },
                "title_template": {
                    "type": "string",
                    "description": "标题模板(仅 wechat_daily 用,支持 {date} 占位符)",
                },
            },
            "required": ["task_id", "hour", "minute"],
        },
    ),
    # ===== 截图工具(2026-07-22 新增,WorkPanel iframe 降级)=====
    MCPTool(
        name="screenshot_url",
        description=(
            "对指定 URL 截图(Playwright headless Chromium),返回 base64 PNG。"
            "适用于:目标站点禁止 iframe 嵌入时,后端截图供前端展示。"
            "注意:本工具返回截图元数据(不含 base64 全文),如需获取 base64 数据请调 HTTP 端点 /api/screenshot/take。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "目标 URL(http/https)"},
                "width": {"type": "integer", "description": "视口宽度(默认 1280)", "default": 1280},
                "height": {"type": "integer", "description": "视口高度(默认 720)", "default": 720},
                "full_page": {"type": "boolean", "description": "是否全页面截图(默认 false)", "default": False},
                "wait_until": {
                    "type": "string",
                    "enum": ["none", "dom", "load", "networkidle"],
                    "description": "等待策略(默认 load)",
                    "default": "load",
                },
                "timeout": {"type": "integer", "description": "超时 ms(默认 15000)", "default": 15000},
            },
            "required": ["url"],
        },
    ),
    # ===== 图像分析工具(P2-3,对标 Hermes 多模态输入)=====
    MCPTool(
        name="vision_analyze",
        description=(
            "图像分析(支持 URL 和 base64)。传入图片 + 分析任务描述,"
            "调用支持视觉的 LLM 模型返回分析结果。"
            "适用于'描述这张图片的内容'/'识别图中的文字'/'分析 UI 截图'等场景。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "image": {
                    "type": "string",
                    "description": "图片 URL(http/https)或 base64 编码(如 data:image/png;base64,...)",
                },
                "task": {
                    "type": "string",
                    "description": "分析任务描述(如'描述这张图片的内容')",
                },
                "model": {
                    "type": "string",
                    "description": "期望模型(可选,缺省用支持视觉的模型,如 gpt-4o)",
                },
            },
            "required": ["image", "task"],
        },
    ),
    # ===== 子智能体派发工具(2026-07-24 新增)=====
    MCPTool(
        name="dispatch_subagent",
        description=(
            "派发子智能体执行独立任务(子任务分解 / 多视角审查 / 并行执行)。"
            "可用 agent 名称:code-reviewer(代码审查)、bug-fixer(Bug 修复)、"
            "feature-planner(功能规划)、test-writer(测试编写)、refactorer(重构建议)。"
            "调用后子智能体独立执行并返回结果,不污染主对话上下文。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "单 agent 模式:要派发的子智能体名称(如 code-reviewer / bug-fixer)",
                },
                "task": {
                    "type": "string",
                    "description": "单 agent 模式:交给子智能体执行的任务描述",
                },
                "session_id": {
                    "type": "string",
                    "description": "会话 ID(可选,单 agent 模式用于上下文复用)",
                },
                "tasks": {
                    "type": "array",
                    "description": (
                        "并行模式:任务数组,每项 {name, task, context?}。"
                        "传 tasks 时不可同时传 name/task(互斥,DUAL_MODE)。"
                    ),
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "task": {"type": "string"},
                            "context": {"type": "object"},
                        },
                        "required": ["name", "task"],
                    },
                },
                "max_concurrency": {
                    "type": "integer",
                    "description": "并行模式最大并发数(默认 5)",
                    "default": 5,
                },
            },
        },
    ),
    # ===== 扩展工具(2026-07-24 新增,对标 Trae Work + Codex)=====
    MCPTool(
        name="fetch_url",
        description=(
            "抓取 URL 内容,返回 markdown/text/html/metadata。"
            "用于获取网页正文、提取页面元数据(title/description/og 标签)。"
            "SSRF 防护:禁止内网/保留/回环地址。admin 专属工具。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "目标 URL(http/https,必填)"},
                "mode": {
                    "type": "string",
                    "enum": ["text", "html", "metadata"],
                    "description": "返回模式:text(默认,纯文本/markdown)/html(原始 HTML)/metadata(仅 title/description/og)",
                    "default": "text",
                },
                "max_chars": {
                    "type": "integer",
                    "description": "最大返回字符数(默认 8000,避免上下文爆炸)",
                    "default": 8000,
                },
            },
            "required": ["url"],
        },
    ),
    MCPTool(
        name="image_generation",
        description=(
            "生成图片,返回图片 URL 或 base64 data URI。"
            "支持 stepfun(默认)/agnes provider,需在 .env 配置对应 API key。"
            "2026-07-24 升级:支持 save_path 落地文件系统(b64_json 解码或 URL 下载),"
            "校验后缀(.png/.jpg/.jpeg/.webp)+ 工作区白名单,5MB 上限。"
            "admin 专属工具(外部 API 调用 + 计费)。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "图片描述(必填)"},
                "size": {
                    "type": "string",
                    "description": "图片尺寸(默认 1024x1024)",
                    "default": "1024x1024",
                },
                "quality": {
                    "type": "string",
                    "enum": ["standard", "hd"],
                    "default": "standard",
                },
                "style": {
                    "type": "string",
                    "enum": ["natural", "vivid"],
                    "default": "natural",
                },
                "provider": {
                    "type": "string",
                    "enum": ["stepfun", "agnes"],
                    "default": "stepfun",
                },
                "save_path": {
                    "type": "string",
                    "description": "可选,绝对路径,落地图片到文件系统(需工作区白名单内,后缀 .png/.jpg/.jpeg/.webp,5MB 上限)",
                },
            },
            "required": ["prompt"],
        },
    ),
    MCPTool(
        name="review_pr",
        description=(
            "审查 GitHub PR,返回结构化审查报告。"
            "用正则模式匹配(security/performance/readability),零 LLM 调用。"
            "2026-07-24 升级:支持 diff 字符串参数(与 repo+pr_number 互斥);"
            "repo+pr_number 时调 GitHub API(Accept: application/vnd.github.v3.diff)获取真实 diff,"
            "Bearer 鉴权(GITHUB_TOKEN 可空),进程内 cache 1h。"
            "admin 专属工具(可能暴露源代码)。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "repo": {"type": "string", "description": "owner/repo 格式(与 diff 二选一,优先 repo+pr_number)"},
                "pr_number": {"type": "integer", "description": "PR 编号(正整数,与 diff 二选一)"},
                "diff": {
                    "type": "string",
                    "description": "可选,直接传入 unified diff 字符串(无 GitHub API 调用,source=diff_string)",
                },
                "focus": {
                    "type": "string",
                    "enum": ["security", "performance", "readability", "all"],
                    "default": "all",
                },
                "max_files": {
                    "type": "integer",
                    "description": "最多审查的文件数(默认 20)",
                    "default": 20,
                },
            },
            "required": [],
        },
    ),
    MCPTool(
        name="summarize_artifacts",
        description=(
            "聚合当前会话的 plans/sources/artifacts/tool_calls。"
            "纯本地缓存读取(进程内,重启即丢),不调外部 API。所有用户可用。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "conversation_id": {"type": "string", "description": "会话 ID(可选)"},
                "include": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "包含的类别(默认全部)",
                    "default": ["plans", "sources", "artifacts", "tool_calls"],
                },
                "max_items": {
                    "type": "integer",
                    "description": "每类最大返回数(默认 20)",
                    "default": 20,
                },
            },
        },
    ),
    MCPTool(
        name="schedule_task",
        description=(
            "调度定时任务(once/recurring)。"
            "仅记录到进程内任务列表,需 ai-service 后台 worker 启动才会自动执行。"
            "admin 专属工具。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "任务名(必填)"},
                "prompt": {"type": "string", "description": "任务提示词(必填)"},
                "schedule": {
                    "type": "string",
                    "enum": ["once", "recurring"],
                    "default": "once",
                },
                "run_at": {"type": "string", "description": "ISO 时间戳(schedule=once 时必填)"},
                "cron": {"type": "string", "description": "cron 表达式(schedule=recurring 时必填)"},
                "agent_tools": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "任务可用工具列表",
                    "default": ["search_codebase", "read_file", "web_search"],
                },
            },
            "required": ["name", "prompt"],
        },
    ),
    MCPTool(
        name="proactive_suggestion",
        description=(
            "基于当前会话上下文,主动建议后续工作(follow_up/refactor/test/improve/explore)。"
            "纯本地规则匹配(零算力,不调 LLM)。所有用户可用。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "conversation_context": {"type": "string", "description": "当前对话最近消息摘要(可选)"},
                "recent_files": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "最近修改的文件列表(可选)",
                },
                "recent_tool_calls": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "最近工具调用列表(可选)",
                },
            },
        },
    ),
]

_TOOL_HANDLERS: dict[str, Any] = {
    "search_codebase": _tool_search_codebase,
    "read_file": _tool_read_file,
    "write_file": _tool_write_file,
    "file_edit": _tool_file_edit,
    "run_command": _tool_run_command,
    "web_search": _tool_web_search,
    "search_web": _tool_search_web,
    "analyze_code": _tool_analyze_code,
    "generate_test": _tool_generate_test,
    "file_search": _tool_file_search,
    "git_operations": _tool_git_operations,
    "db_query": _tool_db_query,
    # ===== AI 自动控制浏览器(12 个)=====
    "browser_screenshot": _make_agent_control_handler("browser", "screenshot"),
    "browser_click_element": _make_agent_control_handler("browser", "click_element"),
    "browser_type_text": _make_agent_control_handler("browser", "type_text"),
    "browser_scroll": _make_agent_control_handler("browser", "scroll"),
    "browser_extract_dom": _make_agent_control_handler("browser", "extract_dom"),
    "browser_navigate": _make_agent_control_handler("browser", "navigate"),
    "browser_wait_for_element": _make_agent_control_handler("browser", "wait_for_element"),
    "browser_get_attribute": _make_agent_control_handler("browser", "get_attribute"),
    "browser_hover": _make_agent_control_handler("browser", "hover"),
    "browser_select_option": _make_agent_control_handler("browser", "select_option"),
    "browser_switch_tab": _make_agent_control_handler("browser", "switch_tab"),
    "browser_close_tab": _make_agent_control_handler("browser", "close_tab"),
    # ===== AI 自动控制电脑(10 个)=====
    "computer_screenshot_screen": _make_agent_control_handler("computer", "screenshot_screen"),
    "computer_mouse_move": _make_agent_control_handler("computer", "mouse_move"),
    "computer_mouse_click": _make_agent_control_handler("computer", "mouse_click"),
    "computer_keyboard_type": _make_agent_control_handler("computer", "keyboard_type"),
    "computer_mouse_scroll": _make_agent_control_handler("computer", "mouse_scroll"),
    "computer_keyboard_press": _make_agent_control_handler("computer", "keyboard_press"),
    "computer_keyboard_hotkey": _make_agent_control_handler("computer", "keyboard_hotkey"),
    "computer_active_window": _make_agent_control_handler("computer", "active_window"),
    "computer_clipboard_get": _make_agent_control_handler("computer", "clipboard_get"),
    "computer_clipboard_set": _make_agent_control_handler("computer", "clipboard_set"),
    # ===== 自动化任务配置(2026-07-22 新增)=====
    "configure_automation_task": _tool_configure_automation_task,
    # ===== 截图工具(2026-07-22 新增,WorkPanel iframe 降级)=====
    "screenshot_url": _tool_screenshot_url,
    # ===== 图像分析(P2-3,对标 Hermes 多模态输入)=====
    "vision_analyze": _tool_vision_analyze,
    # ===== 子智能体派发(2026-07-24 新增)=====
    "dispatch_subagent": _tool_dispatch_subagent,
    # ===== 扩展工具(2026-07-24 新增,对标 Trae Work + Codex)=====
    "fetch_url": _tool_fetch_url,
    "image_generation": _tool_image_generation,
    "review_pr": _tool_review_pr,
    "summarize_artifacts": _tool_summarize_artifacts,
    "schedule_task": _tool_schedule_task,
    "proactive_suggestion": _tool_proactive_suggestion,
}


# ---------------------------------------------------------------------------
# 资源(3 个)
# ---------------------------------------------------------------------------

_RESOURCES: list[MCPResource] = [
    MCPResource(
        uri="memory://current",
        name="current_memory",
        description="当前会话记忆",
    ),
    MCPResource(
        uri="skills://available",
        name="available_skills",
        description="可用 skill 列表",
    ),
    MCPResource(
        uri="config://agent",
        name="agent_config",
        description="agent 配置",
    ),
]


# ---------------------------------------------------------------------------
# 提示词(3 个)
# ---------------------------------------------------------------------------

_PROMPTS: list[MCPPrompt] = [
    MCPPrompt(
        name="code_review",
        description="代码审查提示词",
        arguments=[
            {"name": "code", "description": "待审查的代码", "required": True},
            {"name": "language", "description": "代码语言", "required": False},
        ],
    ),
    MCPPrompt(
        name="bug_fix",
        description="Bug 修复提示词",
        arguments=[
            {"name": "error", "description": "错误信息", "required": True},
            {"name": "code", "description": "相关代码", "required": True},
            {"name": "language", "description": "代码语言", "required": False},
        ],
    ),
    MCPPrompt(
        name="feature_plan",
        description="功能规划提示词",
        arguments=[
            {"name": "feature", "description": "功能描述", "required": True},
            {"name": "requirements", "description": "详细需求", "required": False},
        ],
    ),
]


def _render_prompt(name: str, arguments: dict[str, Any]) -> str:
    """根据 name 和 arguments 渲染提示词模板。"""
    language = arguments.get("language", "未指定")
    if name == "code_review":
        return (
            "请审查以下代码,关注质量、bug、安全与最佳实践:\n\n"
            f"语言: {language}\n代码:\n```\n{arguments.get('code', '')}\n```"
        )
    if name == "bug_fix":
        return (
            "请根据错误信息修复代码:\n\n"
            f"语言: {language}\n错误:\n{arguments.get('error', '')}\n\n"
            f"代码:\n```\n{arguments.get('code', '')}\n```\n"
            "输出: 根因分析 + 修复方案 + 修复后代码"
        )
    if name == "feature_plan":
        return (
            "请规划以下功能的实现方案:\n\n"
            f"功能: {arguments.get('feature', '')}\n"
            f"需求: {arguments.get('requirements', '(无)')}\n\n"
            "输出: 技术方案、任务拆解、风险点、验收标准"
        )
    return f"未知提示词: {name}"


# ---------------------------------------------------------------------------
# MCPServer
# ---------------------------------------------------------------------------


class MCPServer:
    """MCP 服务端,统一管理工具/资源/提示词的查询与调用。"""

    def list_tools(self) -> list[MCPTool]:
        """列出全部工具。"""
        return list(_TOOLS)

    async def call_tool(
        self,
        name: str,
        arguments: dict[str, Any] | None = None,
        *,
        user_role: int = 0,
    ) -> dict[str, Any]:
        """调用指定工具(带权限矩阵校验)。

        Args:
            name: 工具名
            arguments: 工具参数
            user_role: 调用者角色 ID(0=普通用户,>=1=admin)。admin 专属工具
                       需 user_role >= 1,其他工具所有用户可用。
        """
        handler = _TOOL_HANDLERS.get(name)
        if not handler:
            available = ", ".join(_TOOL_HANDLERS.keys())
            return {"ok": False, "error": f"未知工具: {name}。可用: {available}"}
        # 权限矩阵:admin 专属工具(write_file/run_command/db_query/computer_* 等)
        # 普通用户(user_role < 1)调用 → 直接拒绝,不执行 handler
        if name in _ADMIN_ONLY_TOOLS and user_role < 1:
            return {
                "ok": False,
                "error": f"工具 '{name}' 需要 admin 权限(role >= 1),当前 role={user_role}",
                "errorCode": "PERMISSION_DENIED",
            }
        try:
            # Wave 8:注入 __user_role 供 handler 内的写操作权限校验使用
            # (git_operations 写操作在 handler 内部做 defense-in-depth 校验)
            args_with_role = dict(arguments or {})
            args_with_role["__user_role"] = user_role
            # 2026-07-22 P1 鲁棒性加固:全局超时,防 handler 无限挂起
            return await asyncio.wait_for(handler(args_with_role), timeout=MCP_GLOBAL_TIMEOUT)
        except asyncio.TimeoutError:
            return {"ok": False, "error": f"工具 {name} 执行超时({MCP_GLOBAL_TIMEOUT}s)"}
        except Exception as e:
            return {"ok": False, "error": f"工具 {name} 执行失败: {e}"}

    def list_resources(self) -> list[MCPResource]:
        """列出全部资源。"""
        return list(_RESOURCES)

    async def read_resource(self, uri: str) -> dict[str, Any]:
        """读取指定 URI 的资源内容。"""
        if uri == "memory://current":
            from .memory import memory_store

            sessions = await memory_store.list_sessions()
            data: dict[str, Any] = {"sessions": sessions}
            for sid in sessions[:5]:
                data[sid] = await memory_store.get(sid, limit=10)
            return {"uri": uri, "content": data, "ok": True}
        if uri == "skills://available":
            skills = skill_registry.list()
            return {
                "uri": uri,
                "content": [
                    {"name": s.name, "description": s.description} for s in skills
                ],
                "ok": True,
            }
        if uri == "config://agent":
            from ..core.config import settings

            return {
                "uri": uri,
                "content": {
                    "app_name": settings.app_name,
                    "litellm_model": settings.litellm_model,
                    "max_agent_iterations": settings.max_agent_iterations,
                    "debug": settings.debug,
                },
                "ok": True,
            }
        if uri == "sampling://handler":
            return {
                "uri": uri,
                "content": sampling_handler.get_stats(),
                "ok": True,
            }
        return {"uri": uri, "content": None, "ok": False, "error": f"未知资源 URI: {uri}"}

    def list_prompts(self) -> list[MCPPrompt]:
        """列出全部提示词。"""
        return list(_PROMPTS)

    def invoke_prompt(self, name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
        """调用指定提示词,返回渲染后的 prompt 文本。"""
        prompt_names = {p.name for p in _PROMPTS}
        if name not in prompt_names:
            return {"ok": False, "error": f"未知提示词: {name}。可用: {', '.join(prompt_names)}"}
        return {"name": name, "prompt": _render_prompt(name, arguments or {}), "ok": True}

    # =========================================================================
    # Sampling(反向调用 LLM,P1-3)
    # =========================================================================

    def list_sampling_capabilities(self) -> dict[str, Any]:
        """列出 Sampling 能力(供 MCP 客户端发现 sampling/createMessage)。"""
        return {
            "uri": "sampling://handler",
            "name": "sampling_handler",
            "description": (
                "MCP Sampling 反向调用:让 MCP 工具请求 LLM 推理(createMessage)。"
                "5 层护栏:速率限制 / 模型白名单 / 工具调用轮数 / 超时 / 审计日志。"
            ),
            "guardrails": sampling_handler.get_stats()["guardrails"],
        }

    async def call_sampling(self, request: dict[str, Any]) -> dict[str, Any]:
        """处理 MCP Sampling 请求(反向让 MCP 工具调用 LLM)。

        Args:
            request: McpSamplingRequest 字典(callerTool/messages/model/maxTokens/
                     temperature/context)。

        Returns:
            McpSamplingResponse 字典(content/model/usage/blocked/blockedReason)。
        """
        return await sampling_handler.handle_sampling(request)


mcp_server = MCPServer()


# ---------------------------------------------------------------------------
# SamplingHandler — MCP Sampling 反向调用处理器(5 层护栏,P1-3)
# ---------------------------------------------------------------------------


class SamplingHandler:
    """MCP Sampling 反向调用处理器(5 层护栏)。

    让 MCP 工具能反向请求 LLM 推理(sampling/createMessage)。
    对齐 packages/types 的 McpSamplingRequest/Response/Guardrails 契约。
    """

    # 默认护栏配置(对齐 McpSamplingGuardrails 类型)
    DEFAULT_GUARDRAILS: dict[str, Any] = {
        "rate_limit_rpm": 10,       # 速率限制 10 RPM
        "model_whitelist": [],      # 空白名单=允许所有(非空时只允许白名单内模型)
        "max_tool_rounds": 5,       # 单个 callerTool 最大调用轮数
        "timeout_seconds": 30,      # LLM 调用超时
        "audit_log": True,          # 审计日志
    }

    def __init__(self, guardrails: dict[str, Any] | None = None) -> None:
        self._guardrails: dict[str, Any] = {
            **self.DEFAULT_GUARDRAILS, **(guardrails or {})
        }
        self._call_timestamps: list[float] = []  # 滑动窗口速率限制
        self._audit_logs: list[dict[str, Any]] = []

    async def handle_sampling(self, request: dict[str, Any]) -> dict[str, Any]:
        """处理 MCP Sampling 请求。

        Args:
            request: McpSamplingRequest 字典(callerTool/messages/model/maxTokens/
                     temperature/context)。

        Returns:
            McpSamplingResponse 字典(content/model/usage/blocked/blockedReason)。

        5 层护栏:
        1. 速率限制:滑动窗口检查 RPM
        2. 模型白名单:request.model 非空且白名单非空时校验
        3. 工具调用轮数:记录每个 callerTool 的成功调用次数,超限拦截
        4. 超时:asyncio.wait_for 包装 llm_gateway.complete
        5. 审计日志:记录每次调用(callerTool/model/timestamp/blocked)
        """
        import asyncio
        import time
        from datetime import datetime

        from ..core.llm_gateway import llm_gateway

        # 1. 速率限制(滑动窗口 60s)
        now = time.monotonic()
        self._call_timestamps = [t for t in self._call_timestamps if now - t < 60]
        if len(self._call_timestamps) >= self._guardrails["rate_limit_rpm"]:
            return {
                "content": "", "model": "", "usage": None,
                "blocked": True, "blockedReason": "rate_limit_exceeded",
            }

        # 2. 模型白名单
        model = request.get("model")
        whitelist = self._guardrails["model_whitelist"]
        if model and whitelist and model not in whitelist:
            return {
                "content": "", "model": model or "", "usage": None,
                "blocked": True, "blockedReason": "model_not_whitelisted",
            }

        # 3. 工具调用轮数(用 audit_logs 统计每个 callerTool 的成功次数)
        caller = request.get("callerTool", "unknown")
        caller_count = sum(
            1 for log in self._audit_logs
            if log.get("callerTool") == caller and not log.get("blocked")
        )
        if caller_count >= self._guardrails["max_tool_rounds"]:
            return {
                "content": "", "model": model or "", "usage": None,
                "blocked": True, "blockedReason": "max_tool_rounds_exceeded",
            }

        # 记录时间戳(通过速率检查后才记录)
        self._call_timestamps.append(now)

        # 4. 超时调用 LLM
        messages = request.get("messages", [])
        try:
            result = await asyncio.wait_for(
                llm_gateway.complete(messages, model=model),
                timeout=self._guardrails["timeout_seconds"],
            )
            content = str(result.get("content", "") or "")
            used_model = str(result.get("model", model or "") or "")
            usage = result.get("usage")

            # 5. 审计日志
            if self._guardrails["audit_log"]:
                self._audit_logs.append({
                    "callerTool": caller,
                    "model": used_model,
                    "timestamp": datetime.utcnow().isoformat(),
                    "blocked": False,
                    "context": str(request.get("context", ""))[:200],
                })
            return {
                "content": content,
                "model": used_model,
                "usage": usage,
                "blocked": False,
            }
        except asyncio.TimeoutError:
            if self._guardrails["audit_log"]:
                self._audit_logs.append({
                    "callerTool": caller,
                    "model": model or "",
                    "timestamp": datetime.utcnow().isoformat(),
                    "blocked": True,
                    "blockedReason": "timeout",
                })
            return {
                "content": "", "model": model or "", "usage": None,
                "blocked": True, "blockedReason": "timeout",
            }
        except Exception as e:
            return {
                "content": "", "model": model or "", "usage": None,
                "blocked": True, "blockedReason": f"error: {e}",
            }

    def get_audit_logs(self) -> list[dict[str, Any]]:
        """获取审计日志。"""
        return list(self._audit_logs)

    def get_stats(self) -> dict[str, Any]:
        """获取统计信息。"""
        return {
            "total_calls": len(self._audit_logs),
            "blocked_calls": sum(1 for log in self._audit_logs if log.get("blocked")),
            "guardrails": dict(self._guardrails),
        }


sampling_handler = SamplingHandler()
