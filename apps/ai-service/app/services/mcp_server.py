# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP 服务端。

定义 11 个工具、3 个资源、3 个提示词,并提供统一的查询/调用接口。
工具实现为真实文件系统/网络操作,无外部依赖时返回降级结果。
"""

import asyncio
import contextvars
import difflib
import functools
import json
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any, Awaitable, Callable, Optional, cast
from urllib.parse import parse_qs, quote_plus, urlparse

if TYPE_CHECKING:
    from .agent_orchestrator import AgentOrchestrator

# 语义压缩回捞层(只读检索工具):复用 vector_memory 单例做语义回捞
from .context_recall import context_recall

# 2026-07-22 P1 鲁棒性加固:MCP tool 全局超时,防 handler 无限挂起
MCP_GLOBAL_TIMEOUT = 120

# ---------------------------------------------------------------------------
# 工具层安全护栏(Phase 0 · W2:确定性防御,非审批流)
# ---------------------------------------------------------------------------

# 0-2 call_tool 出口统一输出护栏:所有工具返回结果按 token 上限截断,
# 默认 8000 token,env TOOL_OUTPUT_MAX_TOKENS 可覆盖。
_TOOL_OUTPUT_TRUNCATE_MARKER = "…[已截断,共截断 {n} token,可用分页/范围参数获取更多]"
# 受保护 key:其字符串值不被截断,确保 ok/status/error 等控制字段完整
_TRUNCATION_PROTECTED_KEYS = frozenset(
    {"ok", "status", "error", "errorCode", "tool", "matched"}
)


def _get_tool_output_max_tokens() -> int:
    """工具输出 token 上限(env TOOL_OUTPUT_MAX_TOKENS,默认 8000)。"""
    try:
        return max(1, int(os.environ.get("TOOL_OUTPUT_MAX_TOKENS", "8000")))
    except (TypeError, ValueError):
        return 8000


def _estimate_tokens_len(text: str) -> int:
    """轻量 token 估算:len//4(无外部依赖,与 context_compaction 降级策略一致)。"""
    return len(text) // 4


def _tool_result_token_estimate(obj: object) -> int:
    """递归估算工具结果中所有字符串值的 token 总数(轻量 len//4)。"""
    if isinstance(obj, str):
        return _estimate_tokens_len(obj)
    total = 0
    if isinstance(obj, dict):
        for v in obj.values():
            total += _tool_result_token_estimate(v)
    elif isinstance(obj, (list, tuple, set)):
        for v in obj:
            total += _tool_result_token_estimate(v)
    return total


def _truncate_tool_output(result: dict[str, Any]) -> dict[str, Any]:
    """call_tool 出口统一输出护栏:将超 token 预算的字符串值截断。

    策略(确定性、保持 dict 结构与控制字段完整):
    - 总 token <= 预算 → 原样返回,不加 truncated 标志
    - 超限 → 收集全部字符串叶子(受保护 key 除外),按长度降序贪心截断,
      直到总 token <= 预算;每个被截断字符串追加标记,并置顶层 truncated=True

    注意:截断量为近似(标记本身占少量 token),已在边界内;目的是防上下文膨胀,
    不保证精确等于预算(误差 < 标记长度)。
    """
    if not isinstance(result, dict):
        return result
    max_tokens = _get_tool_output_max_tokens()
    total = _tool_result_token_estimate(result)
    if total <= max_tokens:
        return result

    # 收集 (parent_container, key, string) 引用(parent 为可变 dict/list)
    leaves: list[tuple[Any, Any, str]] = []

    def _collect(obj: Any, parent: Any, key: Any) -> None:
        if isinstance(obj, str):
            if isinstance(parent, dict) and key in _TRUNCATION_PROTECTED_KEYS:
                return
            leaves.append((parent, key, obj))
        elif isinstance(obj, dict):
            for k, v in obj.items():
                _collect(v, obj, k)
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                _collect(v, obj, i)

    _collect(result, None, None)
    # 按长度降序,优先截断最大块,最贴近原始信息分布
    leaves.sort(key=lambda item: len(item[2]), reverse=True)

    remaining = total - max_tokens
    plan: list[tuple[Any, Any, int]] = []
    truncated_tokens = 0
    for _parent, _key, s in leaves:
        if remaining <= 0:
            break
        t = _estimate_tokens_len(s)
        if t <= 0:
            continue
        need = min(remaining, t)
        allow = max(0, t - need)
        keep_chars = allow * 4
        # 占位估算:用单字符近似标记开销,真实标记在回填时写入
        new_t = _estimate_tokens_len(s[:keep_chars] + "X")
        delta = t - new_t
        truncated_tokens += delta
        remaining -= delta
        plan.append((_parent, _key, keep_chars))

    if not plan:
        return result  # 边界:所有字符串均为受保护 key 或空,无法截断
    marker = _TOOL_OUTPUT_TRUNCATE_MARKER.format(n=truncated_tokens)
    for parent, key, keep_chars in plan:
        parent[key] = parent[key][:keep_chars] + marker
    result["truncated"] = True
    return result


# 0-5 run_command 危险命令硬门(env DANGEROUS_COMMAND_BLOCKED 默认 true)
def _is_dangerous_command_blocked() -> bool:
    """危险命令拦截是否开启(env DANGEROUS_COMMAND_BLOCKED,默认 true)。"""
    val = os.environ.get("DANGEROUS_COMMAND_BLOCKED", "true").strip().lower()
    return val not in ("0", "false", "no", "off", "")


def _get_run_command_hard_timeout() -> int:
    """run_command 执行硬超时上限秒(env RUN_COMMAND_TIMEOUT_S,默认 120)。"""
    try:
        return max(1, int(os.environ.get("RUN_COMMAND_TIMEOUT_S", "120")))
    except (TypeError, ValueError):
        return 120


def _match_destructive_command(command: str) -> str | None:
    """确定性检测破坏性命令。命中返回模式名,未命中返回 None。

    覆盖 Windows(format/diskpart/reg delete/shutdown/bcdedit/vssadmin delete/
    cipher /w/rd /s/del /f /s /q 宽路径/Remove-Item -Recurse -Force 作用于根)
    与 Unix(rm -rf //~/rm -rf ~/mkfs/dd of=/dev//chmod -R 777 //fork bomb/shutdown)。
    """
    c = command or ""

    def _at_start(pat: str) -> bool:
        # 命令起始锚点:行首或空白/链分隔符(&|;`、左括号、空格)之后
        return bool(re.search(r"(?i)(?:^|[\s&|;`(])" + pat, c))

    # Windows
    if _at_start(r"(?:cmd\s+/[cC]\s+)?format\b"):
        return "win_format"
    if _at_start(r"diskpart\b"):
        return "win_diskpart"
    if _at_start(r"reg\s+delete\b"):
        return "win_reg_delete"
    if _at_start(r"(?:shutdown|shutdown\.exe|halt|poweroff|reboot)\b"):
        return "shutdown"
    if _at_start(r"bcdedit\b"):
        return "win_bcdedit"
    if re.search(r"(?i)(?:^|[\s&|;`])vssadmin\b[^|]*?delete\b", c):
        return "win_vssadmin_delete"
    if re.search(r"(?i)(?:^|[\s&|;`])cipher\b[^|]*?/w\b", c):
        return "win_cipher_w"
    if re.search(r"(?i)(?:^|[\s&|;`])(?:rd|rmdir)\b[^|]*?/s\b", c):
        return "win_rd_s"
    # del /f /s /q(顺序无关,宽路径)
    if _at_start(r"del\b") and all(f in c for f in ("/f", "/s", "/q")):
        return "win_del_fsq"
    # Remove-Item -Recurse -Force 作用于盘符/用户根/unix 根/家目录
    # 路径可出现在 flags 之前或之后,故拆为独立条件判断(更稳健)
    if _at_start(r"Remove-Item\b"):
        has_recurse = re.search(r"(?i)-Recurse\b", c) is not None
        has_force = re.search(r"(?i)-Force\b", c) is not None
        has_root = re.search(r"(?i)(?:[a-z]:\\|C:\\Users|/|~)", c) is not None
        if has_recurse and has_force and has_root:
            return "win_remove_item_root"
    # Unix
    if re.search(
        r"(?i)(?:^|[\s&|;`])(?:sudo\s+)?rm\b[^|]*?-[rR][fF]\b[^|]*?(?:\s/[^\s]*|\s~)",
        c,
    ):
        return "unix_rm_rf_root"
    if re.search(
        r"(?i)(?:^|[\s&|;`])(?:sudo\s+)?rm\b[^|]*?-[rR]\s+-[fF]\b[^|]*?(?:\s/[^\s]*|\s~)",
        c,
    ):
        return "unix_rm_rf_home"
    if _at_start(r"(?:mkfs|mkfs\.\w+)\b"):
        return "unix_mkfs"
    if re.search(r"(?i)(?:^|[\s&|;`])dd\b[^|]*?of=/dev/", c):
        return "unix_dd_dev"
    if re.search(r"(?i)(?:^|[\s&|;`])chmod\b[^|]*?-R\b[^|]*?777\b[^|]*?(?:\s/|/[^|]*$)", c):
        return "unix_chmod_777_root"
    if ":(){ :|:& };:" in c or re.search(
        r":\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:", c
    ):
        return "unix_fork_bomb"
    return None


# 0-6 dispatch_subagent 治理
# 全局并发上限(模块级 Semaphore,env SUBAGENT_MAX_CONCURRENT,默认 5)
_SUBAGENT_MAX_CONCURRENT = max(1, int(os.environ.get("SUBAGENT_MAX_CONCURRENT", "5")))
_SUBAGENT_SEMAPHORE = asyncio.Semaphore(_SUBAGENT_MAX_CONCURRENT)
# 嵌套深度上限(≤2):contextvar 记录当前深度,子代理执行时 +1,超限拒绝
_SUBAGENT_MAX_DEPTH = 2
_subagent_depth: contextvars.ContextVar[int] = contextvars.ContextVar(
    "subagent_depth", default=0
)


def _get_subagent_timeout() -> int:
    """单子代理超时秒(env SUBAGENT_TIMEOUT_S,默认 300)。"""
    try:
        return max(1, int(os.environ.get("SUBAGENT_TIMEOUT_S", "300")))
    except (TypeError, ValueError):
        return 300


from .skills import skill_registry


# ---------------------------------------------------------------------------
# 安全常量(2026-07-22 P0 Round 2 鲁棒性加固)
# ---------------------------------------------------------------------------

# 工作区根目录白名单:MCP read_file/write_file 只允许读写白名单内文件
# 从 env MCP_WORKSPACE_ROOTS 读取(分隔符 os.pathsep),默认当前工作目录
#
# 2026-07-27 修复:_WORKSPACE_ROOTS 原在模块加载时通过 os.environ.get 求值,
# 但 main.py 同步 settings → os.environ 在第 71-77 行(模块导入之后),
# 导致 MCP_WORKSPACE_ROOTS 永远读到 os.getcwd()=apps/ai-service/,
# 相对路径 apps/ai-service/pyproject.toml 被拼成 apps/ai-service/apps/ai-service/... 前缀重复。
# 修复:改为函数式延迟读取,在 _validate_path_in_workspace 调用时才求值,
# 此时 main.py 已完成 settings → os.environ 同步。


def _get_workspace_roots() -> list[str]:
    """工作区根目录白名单(延迟读取 os.environ,确保 main.py 已同步 .env)。"""
    raw = os.environ.get("MCP_WORKSPACE_ROOTS", os.getcwd())
    return [os.path.abspath(r) for r in raw.split(os.pathsep) if r.strip()]

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
        # 2026-07-27 修复路径重复拼接:ai-service 进程 cwd 通常是 apps/ai-service/,
        # 用户传相对路径 apps/ai-service/pyproject.toml 时 Path().resolve() 会拼成
        # apps/ai-service/apps/ai-service/pyproject.toml(前缀重复)。
        # 修复策略:相对路径优先在所有 _WORKSPACE_ROOTS 下查找存在的文件,
        # 命中即用;都找不到才退回到 cwd resolve(保留原行为兼容绝对路径)。
        p = Path(path)
        roots = _get_workspace_roots()
        if not p.is_absolute():
            for root in roots:
                candidate = (Path(root) / path).resolve(strict=False)
                if candidate.exists():
                    resolved_str = str(candidate)
                    return True, resolved_str
        # resolve(strict=False) 解析 symlink + .. ,但不要求路径存在
        resolved = Path(path).resolve(strict=False)
        resolved_str = str(resolved)
        # 检查 resolved 是否在任一白名单根目录下(防 symlink 穿越到 /etc/passwd 等)
        for root in roots:
            try:
                resolved.relative_to(root)
                return True, resolved_str
            except ValueError:
                continue
        return False, (
            f"路径不在工作区白名单内: {path}"
            f"(允许根目录: {roots})"
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
                semantic_matches: list[dict[str, Any]] = []
                for r in semantic_results[:max_results]:
                    content_preview = r.get("content", "")
                    if len(content_preview) > 500:
                        content_preview = content_preview[:500]
                    semantic_matches.append({
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
                    "matches": semantic_matches,
                    "total": len(semantic_matches),
                    "truncated": False,
                    "message": f"语义搜索找到 {len(semantic_matches)} 个匹配(pgvector ANN)",
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
                for i, line_text in enumerate(lines):
                    if query_lower in line_text.lower():
                        line_matches.append((i + 1, line_text))

                # 合并:符号匹配优先,再补通用行匹配(去重)
                seen_lines: set[int] = {ln_no for ln_no, _, _ in symbol_matches}
                for ln_no, ln_text in line_matches:
                    if ln_no not in seen_lines:
                        symbol_matches.append((ln_no, "reference", ln_text))
                        seen_lines.add(ln_no)

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


async def _tool_knowledge_lookup(arguments: dict[str, Any]) -> dict[str, Any]:
    """knowledge_lookup: 统一知识查询(三源并发,代码库 + RAG + 跨会话历史)。

    包装 app.services.knowledge_lookup.knowledge_lookup(),供 LLM 通过 MCP 协议
    查外部知识,减少 hallucination + 重复 token 消耗。

    LLM 可控参数:
    - query (required): 自然语言查询
    - top_k_per_source (optional): 每源 top-K,默认 5,1-20

    服务端注入(G6,2026-07-26,从 call_tool 的 user_id/session_id 透传,LLM 不可控):
    - __user_id: 从 FastAPI request.state.user_id 注入;非空时启用 long_term_memory 源
      (跨会话历史检索),None 时跳过 LTM(与 G5 旧行为一致,service 层无 request 上下文)
    - __session_id: 从 request 上下文注入;非空时限定 RAG 检索会话范围

    服务端固定(不暴露给 LLM,安全考虑):
    - repo_id/api_token/source_priority: None(用 knowledge_lookup 默认值)

    返回:
        {tool, query, hits, errors, duration_ms, ok}
        hits: list[{source, score, content}](不含 raw,避免 LLM 上下文冗长)
        空 query → ok=False
        三源全失败 → ok=False + errors(降级不抛异常)
    """
    query = str(arguments.get("query", "")).strip()
    if not query:
        return {
            "tool": "knowledge_lookup",
            "query": "",
            "hits": [],
            "errors": [],
            "duration_ms": 0.0,
            "ok": False,
            "message": "query 不能为空",
        }

    top_k = int(arguments.get("top_k_per_source", 5))
    # 防御性 clamp(1-20,即使 LLM 传越界值也安全)
    top_k = max(1, min(20, top_k))

    # G6(2026-07-26):从 arguments 提取 call_tool 注入的 session context
    # (LLM 不可控,从 FastAPI request 透传;None 时 knowledge_lookup 跳过 LTM 源)
    user_id = arguments.get("__user_id")
    session_id = arguments.get("__session_id")

    try:
        from .knowledge_lookup import knowledge_lookup
        result = await knowledge_lookup(
            query,
            user_id=user_id,  # G6:None 跳过 LTM,非空启用跨会话历史检索
            repo_id=None,
            session_id=session_id,  # G6:None 时 RAG 跨会话,非空限定会话范围
            top_k_per_source=top_k,
            source_priority=None,  # 用默认 [codebase, rag, long_term_memory]
            api_token=None,
        )
    except ValueError as e:
        # source_priority 不合法(理论上不会,因为没传,但防御性处理)
        return {
            "tool": "knowledge_lookup",
            "query": query,
            "hits": [],
            "errors": [{"source": "knowledge_lookup", "error": f"ValueError: {e}"}],
            "duration_ms": 0.0,
            "ok": False,
            "message": f"参数校验失败: {e}",
        }

    # 序列化 hits(不含 raw,避免 LLM 上下文冗长)
    hits_serialized = [
        {
            "source": h.source,
            "score": round(h.score, 4),
            "content": h.content,
        }
        for h in result.hits
    ]

    return {
        "tool": "knowledge_lookup",
        "query": result.query,
        "hits": hits_serialized,
        "errors": result.errors,
        "duration_ms": result.duration_ms,
        "total_hits": len(hits_serialized),
        "ok": len(hits_serialized) > 0 or len(result.errors) == 0,
        "message": (
            f"找到 {len(hits_serialized)} 条知识"
            if hits_serialized
            else (
                "三源全失败,无知识返回"
                if result.errors and not hits_serialized
                else "无匹配知识(各源空结果)"
            )
        ),
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
        # 2026-08-06 生产修复:目录路径显式报错。
        # Windows 上 open() 目录返回模糊的 PermissionError([Errno 13] Permission denied),
        # 用户/模型误以为是权限问题(实际是"把目录当文件读")。
        # 改为明确错误 + 引导使用 search_codebase 探索目录结构。
        import os as _os
        if _os.path.isdir(resolved_path):
            return {
                "tool": "read_file",
                "path": resolved_path,
                "content": "",
                "ok": False,
                "error": f"{resolved_path} 是一个目录,read_file 只能读取文件。请改用 search_codebase 探索目录结构。",
                "errorCode": "IS_A_DIRECTORY",
            }
        with open(resolved_path, encoding="utf-8") as f:
            content = f.read()
        return {"tool": "read_file", "path": resolved_path, "content": content, "ok": True}
    except Exception as e:
        return {"tool": "read_file", "path": resolved_path, "content": "", "ok": False, "error": str(e)}


async def _tool_list_files(arguments: dict[str, Any]) -> dict[str, Any]:
    """list_files: 列出目录内容(路径必须在工作区白名单内,防 symlink 穿越)。

    2026-08-06 立:LLM(stepfun step_plan 等)高频调用 list_files 列目录,
    此前无此工具导致"未知工具"工具执行失败(会话 83633a7c 实测)。
    只返回一层条目(name/type/size),超大目录截断 500 项,避免响应爆炸。
    """
    path = arguments.get("path", ".")
    ok, info = _validate_path_in_workspace(path)
    if not ok:
        return {"tool": "list_files", "path": path, "ok": False, "error": info}
    resolved = info
    import os as _os
    if not _os.path.isdir(resolved):
        return {
            "tool": "list_files", "path": resolved, "ok": False,
            "error": f"{resolved} 不是目录,list_files 只能列出目录。请用 read_file 读取文件。",
            "errorCode": "NOT_A_DIRECTORY",
        }
    try:
        names = sorted(_os.listdir(resolved))
        entries = []
        for name in names:
            full = _os.path.join(resolved, name)
            try:
                is_dir = _os.path.isdir(full)
                entries.append({
                    "name": name,
                    "type": "dir" if is_dir else "file",
                    "size": None if is_dir else _os.path.getsize(full),
                })
            except OSError:
                entries.append({"name": name, "type": "unknown", "size": None})
        return {
            "tool": "list_files",
            "path": resolved,
            "ok": True,
            "entries": entries[:500],
            "total": len(entries),
            "truncated": len(entries) > 500,
        }
    except Exception as e:
        return {"tool": "list_files", "path": resolved, "ok": False, "error": str(e)}


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
    def _err(code: str, msg: str, **extra: Any) -> dict[str, Any]:
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
        with open(backup_path, "wb") as bf:
            bf.write(raw)
        with open(resolved_path, "wb") as wf:
            wf.write(new_content.encode("utf-8"))
    except OSError as e:
        # 失败回滚:恢复原内容(raw),删除 .bak(不保留)
        try:
            with open(resolved_path, "wb") as rf:
                rf.write(raw)
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


async def _drain_stream(
    stream: Any, lines_list: list[str], max_output: int = 10000
) -> None:
    """逐行读取 asyncio subprocess stream,累积到 lines_list(防长命令一次性读阻塞)。

    P1 修复(mcp_server _tool_run_command 大输出全量累积后截断):
    原实现无大小上限,GB 级 stdout/stderr 会全量加载到内存 list,再在
    _tool_run_command 末尾截断到 max_output → 截断前 OOM 已发生。
    现在实时累计 total_size,超过 2 * max_output 硬上限立即停止读取,
    避免大输出全量加载到内存(截断点放宽到 2 倍是为了保留少量尾部上下文)。
    """
    total_size = 0
    size_limit = max_output * 2  # 2 倍 max_output 作为硬上限
    while True:
        line_bytes = await stream.readline()
        if not line_bytes:
            break
        decoded = line_bytes.decode("utf-8", errors="replace").rstrip("\r\n")
        lines_list.append(decoded)
        total_size += len(decoded)
        if total_size > size_limit:
            lines_list.append(f"\n...(输出超过 {size_limit} 字符,已截断)")
            break


def _build_subprocess_env(user_env: dict[str, Any] | None) -> dict[str, str]:
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


_COMMAND_POLICY_DEFAULT: dict[str, Any] = {
    # 与 app/data/command_policy.json 保持一致(文件加载失败时的回退兜底)
    "dangerous_patterns": [
        r";\s*\S", r"&&\s*\S", r"\|\|\s*\S",
        r"\brm\b", r"\brmdir\b", r"\bmv\b", r"\bcp\b", r"\bmkdir\b",
        r"\btouch\b", r"\bchmod\b", r"\bchown\b",
        r"\bcurl\b", r"\bwget\b", r"\bscp\b", r"\bssh\b",
        r"\bdd\b", r"\bmkfs\b", r"\bshutdown\b", r"\breboot\b",
        r"\bkill\b", r"\bkillall\b",
        r">\s*", r">>\s*", r"<\s*", r"\|\s*",
        r"`[^`]*`", r"\$\([^)]*\)", r"\$\{[^}]*\}",
    ],
    "allowed_prefixes": [
        "git", "ls", "cat", "echo", "python", "python3", "node", "npm", "npx",
        "pnpm", "tsc", "ruff", "mypy", "pytest", "find", "grep", "rg", "wc",
        "head", "tail", "date", "whoami", "pwd", "which", "where", "env",
        "uname", "ver", "dir", "type", "getopt",
    ],
    "sensitive_file_markers": [".env", ".pem", ".key", "credentials", "secret", "token"],
}


@functools.lru_cache(maxsize=1)
def _load_command_policy() -> dict[str, Any]:
    """读取命令安全策略单一权威源(app/data/command_policy.json)。

    统一安全 C4(2026-09-01):策略从函数内硬编码提取为 JSON 权威源,前后端共用
    (前端用 scripts/generate-command-policy-ts.mjs 生成 TS 常量)。文件缺失/
    解析失败回退 _COMMAND_POLICY_DEFAULT(与既有内联行为一致),绝不抛异常。
    """
    try:
        policy_path = Path(__file__).resolve().parent.parent / "data" / "command_policy.json"
        with open(policy_path, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError("command_policy.json 根必须是对象")
        return data
    except Exception as e:  # noqa: BLE001 - 策略加载失败回退默认,不阻塞工具
        logger.warning("command_policy.json 加载失败,回退默认策略: %s", e)
        return _COMMAND_POLICY_DEFAULT


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
    # 0-5 执行硬超时上限(env RUN_COMMAND_TIMEOUT_S,默认 120s):请求超时不得超过,
    # 防止调用方通过 timeout/max_timeout 把执行拖到失控时长
    timeout = min(timeout, _get_run_command_hard_timeout())

    if not command:
        return {
            "tool": "run_command", "command": command,
            "exit_code": -1, "stdout": "", "stderr": "",
            "ok": False, "streamed": True, "message": "命令为空",
        }

    # 0-5 确定性破坏性命令硬门(默认开启,env DANGEROUS_COMMAND_BLOCKED 可关)
    # 任何后端(local/sandbox)执行前一律拦截,命中即不执行
    if _is_dangerous_command_blocked():
        matched = _match_destructive_command(command)
        if matched:
            return {
                "ok": False, "tool": "run_command",
                "error": "dangerous_command_blocked",
                "errorCode": "DANGEROUS_COMMAND_BLOCKED",
                "matched": matched,
                "command": command,
                "message": (
                    f"命令被危险命令硬门拦截:命中破坏性模式 '{matched}'"
                    f"(安全限制,禁止执行)"
                ),
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

    # 危险字符/操作黑名单(Shell 注入 + 破坏性操作)—— 单一权威源 command_policy.json
    _policy = _load_command_policy()
    _DANGEROUS_PATTERNS: list[str] = list(_policy.get("dangerous_patterns") or [])
    for pat in _DANGEROUS_PATTERNS:
        if re.search(pat, command):
            return {
                "tool": "run_command", "command": command,
                "exit_code": -1, "stdout": "", "stderr": "",
                "ok": False, "streamed": True,
                "errorCode": "DANGEROUS_COMMAND",
                "message": f"命令包含禁止的模式: {pat}(安全限制)",
            }

    # 命令前缀白名单 —— 单一权威源 command_policy.json
    _ALLOWED_PREFIXES: set[str] = set(_policy.get("allowed_prefixes") or [])
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
            except Exception as e:
                logger.warning("mcp_server proc.wait 失败: %s", e, exc_info=True)

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
    \"\"\"测试模板占位:需根据源代码补充具体用例。\"\"\"
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
        git_args: list[str] | None
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
            ["git"] + (git_args or []),
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


def _make_agent_control_handler(category: str, action: str) -> Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]:
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
    return _orchestrator


async def _tool_dispatch_subagent(
    arguments: dict[str, Any],
    progress_callback: Optional[Callable[[dict[str, Any]], None]] = None,
) -> dict[str, Any]:
    """dispatch_subagent: 派发子智能体执行独立任务(单 agent 或并行多 agent)。

    双模式(对标 Trae Work subagent orchestration):
    - 单 agent 模式(兼容):{name, task, session_id?} → orchestrator.invoke
    - 并行模式:{tasks: [{name, task, context?}, ...], max_concurrency?} →
      orchestrator.invoke_parallel,真实并行派发,互不污染上下文。

    互斥:同时传 name/task 与 tasks → 报错 DUAL_MODE。

    2026-07-30 加固:新增 progress_callback 参数(可选),让调用方(llm.py router)
    能在子任务执行过程中实时推送 subagent_progress SSE 事件,而不是等任务全部完成
    才返回。callback 收到 {phase, agentName, iteration, tool, ok, output_preview}。
    """
    name = arguments.get("name", "")
    task = arguments.get("task", "")
    tasks = arguments.get("tasks")
    max_concurrency = arguments.get("max_concurrency", 5)

    def _emit(evt: dict[str, Any]) -> None:
        """统一进度事件出口(无 callback 时静默 no-op)"""
        if progress_callback is not None:
            try:
                progress_callback(evt)
            except Exception:  # noqa: BLE001
                # 回调失败不影响主任务执行
                pass

    # 0-6 嵌套深度护栏:顶层 depth=0 → 1(允许),子代理内 → 2(允许),
    # 再嵌套 → 3 拒绝(阻断无限递归派发链)。contextvar 保证跨协程上下文传递。
    current_depth = _subagent_depth.get()
    next_depth = current_depth + 1
    if next_depth > _SUBAGENT_MAX_DEPTH:
        return {
            "tool": "dispatch_subagent", "ok": False,
            "error": (
                f"子代理嵌套深度超过上限({_SUBAGENT_MAX_DEPTH}),"
                f"当前深度 {current_depth},拒绝派发以阻断无限递归"
            ),
            "errorCode": "NESTING_DEPTH_EXCEEDED",
        }
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
        _emit({"phase": "parallel_started", "total": len(tasks), "max_concurrency": max_concurrency})
        try:
            orchestrator = _get_orchestrator()
            if _SUBAGENT_SEMAPHORE.locked():
                return {
                    "tool": "dispatch_subagent", "ok": False, "mode": "parallel",
                    "error": f"子代理并发数已达上限({_SUBAGENT_MAX_CONCURRENT}),拒绝派发",
                    "errorCode": "CONCURRENCY_LIMIT_EXCEEDED",
                }
            async with _SUBAGENT_SEMAPHORE:
                # 0-6 进入嵌套层级:当前深度 +1,供子代理内再派发时检测
                _dtok = _subagent_depth.set(_subagent_depth.get() + 1)
                try:
                    result = await asyncio.wait_for(
                        orchestrator.invoke_parallel(
                            tasks=tasks, max_concurrency=max_concurrency
                        ),
                        timeout=_get_subagent_timeout(),
                    )
                finally:
                    _subagent_depth.reset(_dtok)
            _emit({
                "phase": "parallel_done",
                "total": result.get("total", 0),
                "succeeded": result.get("succeeded", 0),
                "failed": result.get("failed", 0),
            })
            _payload = {
                "tool": "dispatch_subagent", "mode": "parallel",
                "ok": result.get("ok", False),
                "total": result.get("total", 0),
                "succeeded": result.get("succeeded", 0),
                "failed": result.get("failed", 0),
                "results": result.get("results", []),
                "message": result.get("message", ""),
            }
            # 0-6 单子代理输出限额:复用 0-2 截断助手
            return _truncate_tool_output(_payload)
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
    _emit({"phase": "single_started", "agentName": name})
    try:
        orchestrator = _get_orchestrator()
        if _SUBAGENT_SEMAPHORE.locked():
            return {
                "tool": "dispatch_subagent", "ok": False, "mode": "single",
                "error": f"子代理并发数已达上限({_SUBAGENT_MAX_CONCURRENT}),拒绝派发",
                "errorCode": "CONCURRENCY_LIMIT_EXCEEDED",
            }
        async with _SUBAGENT_SEMAPHORE:
            # 0-6 进入嵌套层级:当前深度 +1,供子代理内再派发时检测
            _dtok = _subagent_depth.set(_subagent_depth.get() + 1)
            try:
                step_result = await asyncio.wait_for(
                    orchestrator.invoke(
                        agent_name=name,
                        user_input=task,
                        session_id=session_id,
                    ),
                    timeout=_get_subagent_timeout(),
                )
            finally:
                _subagent_depth.reset(_dtok)
        _emit({
            "phase": "single_done",
            "agentName": name,
            "iterations": step_result.iterations,
            "ok": step_result.status == "completed",
        })
        _payload = {
            "tool": "dispatch_subagent", "mode": "single",
            "agent": name,
            "task": task,
            "status": step_result.status,
            "output": step_result.output,
            "duration_ms": step_result.duration_ms,
            "iterations": step_result.iterations,
            "error": step_result.error,
            "ok": step_result.status == "completed",
        }
        # 0-6 单子代理输出限额:复用 0-2 截断助手
        return _truncate_tool_output(_payload)
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

# P0 新增工具(chart_tools / document_tools,零新依赖,2026-09-01 竞品对标补齐)
# 延迟导入避免启动期探测;工具内部异常已自兜底返回结构化错误,不抛给 MCP 层
from ..tools import (  # noqa: E402
    generate_chart as _generate_chart,
    parse_document as _parse_document,
)

# 进程内调度任务列表(schedule_task 用,内存镜像;Redis 为持久化真相源)
_SCHEDULED_TASKS: list[dict[str, Any]] = []

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
        import redis

        # protocol=2 强制 RESP2:redis-py 8.x 默认 RESP3(HELLO 3 协商),
        # 老 Redis/Memurai 4.x 不支持会 unknown command HELLO(同 im_bridge)
        client = redis.Redis.from_url(url, decode_responses=True, protocol=2)
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
# 2026-09-05 video_generation(可灵/即梦真实视频任务)落地支持
_VIDEO_EXTENSIONS = (".mp4",)
_MAX_VIDEO_BYTES = 200 * 1024 * 1024  # 200MB


def _validate_video_save_path(save_path: str) -> tuple[bool, str, str | None]:
    """校验视频 save_path:工作区白名单 + 后缀(.mp4)。"""
    if not save_path or not isinstance(save_path, str):
        return False, "", "MISSING_PARAMS"
    ext = os.path.splitext(save_path)[1].lower()
    if ext not in _VIDEO_EXTENSIONS:
        return False, "", "INVALID_EXTENSION"
    ok, info = _validate_path_in_workspace(save_path)
    if not ok:
        return False, info, "PATH_NOT_ALLOWED"
    return True, info, None


async def _persist_video_to_disk(
    video_bytes: bytes, save_path: str
) -> tuple[bool, str, int, str | None]:
    """将视频字节写入磁盘 save_path(200MB 上限,父目录自动 mkdir)。"""
    if len(video_bytes) > _MAX_VIDEO_BYTES:
        return False, "", 0, "VIDEO_TOO_LARGE"
    try:
        from pathlib import Path

        path_obj = Path(save_path)
        path_obj.parent.mkdir(parents=True, exist_ok=True)
        with open(path_obj, "wb") as f:
            f.write(video_bytes)
        return True, str(path_obj), len(video_bytes), None
    except OSError:
        return False, "", 0, "WRITE_FAILED"


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
    # 2026-09-05 真实化:kling/jimeng 走 providers 包原生真实适配器
    # (可灵 JWT / 即梦 Ark Bearer + 视觉服务 V4 签名),不走 OpenAI 风格 HTTP
    if provider in ("kling", "jimeng"):
        return await _tool_image_generation_native(prompt, provider, size, save_path, arguments)
    if provider not in ("stepfun", "agnes"):
        return {
            "tool": "image_generation", "ok": False,
            "error": f"未知 provider: {provider}(允许 stepfun/agnes/kling/jimeng)",
            "errorCode": "INVALID_PROVIDER", "saved_path": None,
        }

    # 选 provider(优先用户指定;若未配置 api_key 则降级尝试另一个)
    # 阶段 3 主体(2026-07-26):扁平字段已删除,统一走 get_provider_config
    stepfun_cfg = settings.get_provider_config("stepfun")
    agnes_cfg = settings.get_provider_config("agnes")
    if provider == "stepfun":
        api_key, api_base, model = stepfun_cfg.api_key, stepfun_cfg.api_base or "https://api.stepfun.com/step_plan/v1", "step-1v-8k"
    else:
        api_key, api_base, model = agnes_cfg.api_key, agnes_cfg.api_base or "https://apihub.agnes-ai.com/v1", "agnes-image-v1"

    if not api_key:
        if provider == "stepfun" and agnes_cfg.api_key:
            api_key, api_base, model = agnes_cfg.api_key, agnes_cfg.api_base or "https://apihub.agnes-ai.com/v1", "agnes-image-v1"
            provider = "agnes"
        elif provider == "agnes" and stepfun_cfg.api_key:
            api_key, api_base, model = stepfun_cfg.api_key, stepfun_cfg.api_base or "https://api.stepfun.com/step_plan/v1", "step-1v-8k"
            provider = "stepfun"
        else:
            return {
                "tool": "image_generation", "ok": False,
                "errorCode": "PROVIDER_NOT_CONFIGURED", "saved_path": None,
                "message": "未配置图片生成 provider,请在 .env 的 LLM_PROVIDERS JSON 配置 stepfun 或 agnes 的 api_key",
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
    item: dict[str, Any], image_url: str, httpx_mod: Any
) -> bytes | None:
    """从 provider 响应提取图片字节:优先 b64_json,降级 URL 下载。"""
    b64 = item.get("b64_json")
    if b64:
        try:
            import base64

            return base64.b64decode(b64)
        except Exception as e:
            logger.warning("mcp_server b64_json 解码失败: %s", e, exc_info=True)
            return None
    if image_url and not image_url.startswith("data:"):
        try:
            async with httpx_mod.AsyncClient(timeout=60.0) as dl:
                dl_resp = await dl.get(image_url)
            if dl_resp.status_code < 400:
                return cast(bytes, dl_resp.content)
        except Exception as e:
            logger.warning("mcp_server 图片 URL 下载失败: %s", e, exc_info=True)
            return None
    return None


async def _download_media_bytes(url: str, httpx_mod: Any) -> bytes | None:
    """下载媒体字节(图片/视频统一),失败返回 None。"""
    if not url or url.startswith("data:"):
        return None
    try:
        async with httpx_mod.AsyncClient(timeout=300.0, follow_redirects=True) as dl:
            resp = await dl.get(url)
        if resp.status_code < 400:
            return cast(bytes, resp.content)
    except Exception as e:
        logger.warning("mcp_server 媒体 URL 下载失败: %s", e, exc_info=True)
    return None


def _resolve_native_provider(provider: str) -> tuple[Any, str]:
    """实例化 kling/jimeng 原生真实适配器,返回 (impl, 默认 model)。"""
    from ..providers import JimengProvider, KlingProvider

    if provider == "kling":
        return KlingProvider(None), "kling-v1"
    return JimengProvider(None), "jimeng-video_generation"


async def _tool_image_generation_native(
    prompt: str, provider: str, size: str, save_path: str | None,
    arguments: dict[str, Any],
) -> dict[str, Any]:
    """image_generation 的 kling/jimeng 原生分支(2026-09-05 真实化)。

    复用 providers 包真实适配器(可灵 JWT HS256 / 即梦 Ark Bearer +
    视觉服务 V4 HMAC 签名),save_path 落地流程与主分支一致。
    """
    from datetime import datetime, timezone

    from ..providers.base_provider import ProviderError

    impl, default_model = _resolve_native_provider(provider)
    model = arguments.get("model") or default_model
    kwargs: dict[str, Any] = {
        k: arguments[k]
        for k in ("negative_prompt", "aspect_ratio", "image", "seed", "watermark")
        if k in arguments
    }
    try:
        result = await impl.generate_image(prompt, model, size=size, **kwargs)
    except ProviderError as e:
        return {
            "tool": "image_generation", "ok": False, "prompt": prompt,
            "provider": provider, "saved_path": None,
            "error": str(e)[:300], "errorCode": "PROVIDER_ERROR",
        }
    items = result.get("data") or []
    image_url = items[0].get("url", "") if items else ""
    if not image_url:
        return {
            "tool": "image_generation", "ok": False, "prompt": prompt,
            "provider": provider, "saved_path": None,
            "error": "provider 返回空 data", "errorCode": "EMPTY_RESULT",
        }

    # save_path 落地(与主分支一致:校验 → 下载 → 写盘)
    saved_path: str | None = None
    file_size_bytes: int = 0
    if save_path:
        import httpx

        ok_path, resolved, err_code = _validate_image_save_path(save_path)
        if not ok_path:
            return {
                "tool": "image_generation", "ok": False, "prompt": prompt,
                "provider": provider, "saved_path": None,
                "errorCode": err_code,
                "message": f"save_path 校验失败: {err_code}",
            }
        img_bytes = await _fetch_image_bytes({"url": image_url}, image_url, httpx)
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

    used_model = result.get("model", model)
    return {
        "tool": "image_generation", "ok": True, "prompt": prompt,
        "image_url": image_url, "size": size,
        "provider": provider, "model": used_model,
        "saved_path": saved_path, "file_size_bytes": file_size_bytes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "message": f"图片已生成(provider={provider}, model={used_model}"
                   + (f", saved={saved_path}" if saved_path else "") + ")",
    }


async def _tool_video_generation(arguments: dict[str, Any]) -> dict[str, Any]:
    """video_generation: 生成视频(2026-09-05 新增,真实异步任务)。

    支持 kling(快手可灵,JWT + text2video/image2video 任务轮询)与
    jimeng(字节即梦,Ark Seedance 任务 / 视觉服务 V4 签名任务)。
    提交任务后轮询至完成(最长 10 分钟),支持 save_path 下载落地(.mp4)。
    """
    from datetime import datetime, timezone

    from ..providers.base_provider import ProviderError

    prompt = arguments.get("prompt", "")
    provider = arguments.get("provider", "kling")
    duration = arguments.get("duration", 5)
    save_path = arguments.get("save_path")

    if not prompt or not isinstance(prompt, str):
        return {
            "tool": "video_generation", "ok": False,
            "error": "缺少 prompt 参数", "errorCode": "MISSING_PARAMS",
            "video_url": None,
        }
    if provider not in ("kling", "jimeng"):
        return {
            "tool": "video_generation", "ok": False,
            "error": f"未知 provider: {provider}(允许 kling/jimeng)",
            "errorCode": "INVALID_PROVIDER", "video_url": None,
        }
    if not isinstance(duration, int) or duration <= 0:
        duration = 5

    impl, default_model = _resolve_native_provider(provider)
    model = arguments.get("model") or default_model
    kwargs: dict[str, Any] = {
        k: arguments[k]
        for k in ("negative_prompt", "image", "aspect_ratio", "mode", "cfg_scale")
        if k in arguments
    }
    try:
        result = await impl.generate_video(prompt, model, duration=duration, **kwargs)
    except ProviderError as e:
        return {
            "tool": "video_generation", "ok": False, "prompt": prompt,
            "provider": provider, "video_url": None,
            "error": str(e)[:300], "errorCode": "PROVIDER_ERROR",
        }
    video_url = result.get("video_url", "")
    if not video_url:
        return {
            "tool": "video_generation", "ok": False, "prompt": prompt,
            "provider": provider, "video_url": None,
            "error": "provider 返回缺少 video_url", "errorCode": "EMPTY_RESULT",
        }

    saved_path: str | None = None
    file_size_bytes: int = 0
    if save_path:
        import httpx

        ok_path, resolved, err_code = _validate_video_save_path(save_path)
        if not ok_path:
            return {
                "tool": "video_generation", "ok": False, "prompt": prompt,
                "provider": provider, "video_url": None,
                "errorCode": err_code,
                "message": f"save_path 校验失败: {err_code}",
            }
        vid_bytes = await _download_media_bytes(video_url, httpx)
        if vid_bytes is None:
            return {
                "tool": "video_generation", "ok": False, "prompt": prompt,
                "provider": provider, "video_url": None,
                "errorCode": "VIDEO_FETCH_FAILED",
                "message": "视频下载失败",
            }
        ok_w, sp, sz, werr = await _persist_video_to_disk(vid_bytes, resolved)
        if not ok_w:
            return {
                "tool": "video_generation", "ok": False, "prompt": prompt,
                "provider": provider, "video_url": None,
                "errorCode": werr,
                "message": f"视频写入磁盘失败: {werr}",
            }
        saved_path = sp
        file_size_bytes = sz

    used_model = result.get("model", model)
    return {
        "tool": "video_generation", "ok": True, "prompt": prompt,
        "video_url": video_url, "task_id": result.get("task_id"),
        "provider": provider, "model": used_model, "duration": duration,
        "saved_path": saved_path, "file_size_bytes": file_size_bytes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "message": f"视频已生成(provider={provider}, model={used_model}"
                   + (f", saved={saved_path}" if saved_path else "") + ")",
    }


def _scan_pr_files_for_findings(
    files: list[dict[str, Any]], focus: str
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


def _parse_unified_diff(diff_text: str) -> list[dict[str, Any]]:
    """解析 unified diff 文本为文件列表。

    每项: {filename, patch(原始 diff 行), additions, deletions}
    以 '+++ b/<path>' 行作为文件边界。
    """
    files: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
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


def _compute_diff_stats(files: list[dict[str, Any]]) -> dict[str, Any]:
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
    # use_github=True 隐含 pr_number is not None(已在 line 2744 校验)
    if pr_number is None:
        return {
            "tool": "review_pr", "ok": False,
            "error": "pr_number 必须是正整数", "errorCode": "INVALID_PARAMS",
        }
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
    files_reviewed: int, findings: list[dict[str, Any]], stats: dict[str, Any], focus: str,
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
            from croniter import croniter

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
        if interval_seconds is None:
            return {
                "tool": "schedule_task", "ok": False,
                "error": "interval_seconds 必须为正整数",
                "errorCode": "INVALID_PARAMS",
            }
        try:
            int(interval_seconds)
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


# ---------------------------------------------------------------------------
# 后台任务工具(Phase 1 第 6 项 · 2026-09-02 立)
# ---------------------------------------------------------------------------
# run_in_background:立即返回 task_id,后台执行,完成后经 message_bus 推送 IM 通知;
# bg_task_status:查询单个任务状态或列出某用户任务。两工具只读/低危,不进 _ADMIN_ONLY_TOOLS。
#
# 内置任务实现注册表 _BG_TASK_IMPLS:task 名 → 接收参数字典、返回结果协程的异步函数。
# 扩展点:后续批次在此注册真实长任务(如 codebase_indexer / spec_generator / 长搜索),
# 仅需实现 async(args: dict) -> Any 并加入本字典,task 名即进入白名单。
async def _bg_impl_sleep(args: dict[str, Any]) -> Any:
    """演示实现:休眠指定秒数(测试 / 占位用)。"""
    seconds = float(args.get("seconds", 0))
    await asyncio.sleep(seconds)
    return {"slept_seconds": seconds}


async def _bg_impl_echo(args: dict[str, Any]) -> Any:
    """演示实现:回显消息(测试 / 占位用)。"""
    return {"echo": args.get("message", "")}


_BG_TASK_IMPLS: dict[str, Callable[[dict[str, Any]], Awaitable[Any]]] = {
    "sleep": _bg_impl_sleep,
    "echo": _bg_impl_echo,
}


async def _tool_run_in_background(arguments: dict[str, Any]) -> dict[str, Any]:
    """run_in_background:提交后台任务并立即返回 task_id(不阻塞当前循环)。

    仅接受 _BG_TASK_IMPLS 白名单内的 task 类型,防任意代码注入。
    完成后若 notify_on_done,经 message_bus 的 IM 通道给调用用户推送完成通知。
    """
    task = str(arguments.get("task", "")).strip()
    raw_args = arguments.get("arguments")
    task_args = raw_args if isinstance(raw_args, dict) else {}
    notify = bool(arguments.get("notify_on_done", True))
    timeout_s = arguments.get("timeout_s")
    timeout_s = max(1, int(timeout_s)) if timeout_s is not None else 300
    name = str(arguments.get("name") or task or "background_task")

    impl = _BG_TASK_IMPLS.get(task)
    if impl is None:
        return {
            "ok": False,
            "error": f"未知后台任务类型: {task}",
            "available": sorted(_BG_TASK_IMPLS.keys()),
        }

    # 调用者身份由 call_tool 注入(LLM 不可控),用于归属与通知推送
    user_id = arguments.get("__user_id")
    session_id = arguments.get("__session_id")

    from .background_tasks import background_task_manager

    def coro_factory() -> Awaitable[Any]:
        return impl(task_args)

    submit_result = await background_task_manager.submit(
        coro_factory,
        name=name,
        user_id=user_id,
        session_id=session_id,
        notify_on_done=notify,
        timeout_s=timeout_s,
    )
    if isinstance(submit_result, dict) and submit_result.get("error"):
        return {"ok": False, "tool": "run_in_background", **submit_result}
    return {
        "ok": True,
        "tool": "run_in_background",
        "task_id": submit_result,
        "name": name,
        "task_type": task,
        "notify_on_done": notify,
        "message": "后台任务已提交,用 bg_task_status 凭 task_id 查询结果",
    }


async def _tool_bg_task_status(arguments: dict[str, Any]) -> dict[str, Any]:
    """bg_task_status:查询单个后台任务状态,或不传 task_id 时列出某用户的任务。"""
    from .background_tasks import background_task_manager

    task_id = arguments.get("task_id")
    if task_id:
        status = await background_task_manager.get_status(str(task_id))
        if status is None:
            return {"ok": False, "error": f"任务不存在: {task_id}"}
        return {"ok": True, "task": status}

    # 列表模式:user_id 可选过滤(来自调用者身份,或显式传入)
    user_id = arguments.get("user_id") or arguments.get("__user_id")
    limit = int(arguments.get("limit", 20))
    tasks = await background_task_manager.list_tasks(user_id=user_id, limit=limit)
    return {"ok": True, "tasks": tasks, "count": len(tasks)}


# 工具注册表
async def _tool_context_recall(arguments: dict[str, Any]) -> dict[str, Any]:
    """context_recall: 语义检索回捞被压缩丢弃的旧消息(只读,不修改任何状态)。"""
    query = arguments.get("query", "")
    session_id = arguments.get("session_id")
    top_k = arguments.get("top_k", 8)
    if not isinstance(top_k, int) or top_k <= 0:
        top_k = 8
    try:
        return await context_recall.recall(
            session_id=session_id if isinstance(session_id, str) else None,
            query=query if isinstance(query, str) else "",
            top_k=top_k,
        )
    except Exception as e:
        logger.warning("context_recall 工具执行异常: %s", e)
        return {"ok": False, "error": str(e)}


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
        name="knowledge_lookup",
        description="统一知识查询(三源并发:代码库语义检索 + RAG 向量检索 + 跨会话历史摘要)。用于查找代码实现/历史对话/相关文档,减少 hallucination。返回 hits 列表,每个含 source/score/content。",
        input_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "自然语言查询,如 '用户认证逻辑实现' 或 'JWT 相关代码'"},
                "top_k_per_source": {"type": "integer", "description": "每个源返回 top-K,默认 5(范围 1-20)", "default": 5, "minimum": 1, "maximum": 20},
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    ),
    MCPTool(
        name="context_recall",
        description="语义回捞被上下文压缩丢弃的旧消息(只读)",
        input_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "自然语言查询,用于语义匹配被压缩丢弃的旧消息原文"},
                "session_id": {"type": "string", "description": "会话 id(可选,限定检索范围;为空则全库检索)"},
                "top_k": {"type": "integer", "description": "返回条数上限,默认 8", "default": 8, "minimum": 1, "maximum": 50},
            },
            "required": ["query"],
            "additionalProperties": False,
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
        name="list_files",
        description="列出目录内容(返回子项名称/类型/大小;路径必须在工作区白名单内)",
        input_schema={
            "type": "object",
            "properties": {"path": {"type": "string", "description": "目录绝对或相对路径,默认当前目录"}},
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
            "支持 stepfun(默认)/agnes/kling(快手可灵 Kolors)/jimeng(字节即梦)provider,"
            "需在 .env 配置对应 API key(KLING_ACCESS_KEY+KLING_SECRET_KEY 或 ARK_API_KEY)。"
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
                    "enum": ["stepfun", "agnes", "kling", "jimeng"],
                    "default": "stepfun",
                },
                "model": {
                    "type": "string",
                    "description": "可选,模型(如 kling-kolors / jimeng-high_aes_general_v21);kling/jimeng provider 用",
                },
                "negative_prompt": {
                    "type": "string",
                    "description": "可选,反向提示词(kling/jimeng provider 用)",
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
        name="video_generation",
        description=(
            "生成视频,返回视频 URL。2026-09-05 新增,真实异步任务实现:"
            "kling(快手可灵,JWT HS256 + text2video/image2video 任务轮询)与"
            "jimeng(字节即梦,方舟 Seedance 任务 / 视觉服务 V4 签名)。"
            "提交后轮询至完成(最长 10 分钟),支持 image 参数走图生视频、"
            "save_path 下载落地(.mp4,工作区白名单,200MB 上限)。"
            "需 .env 配置 KLING_ACCESS_KEY+KLING_SECRET_KEY 或 ARK_API_KEY。"
            "admin 专属工具(外部 API 调用 + 计费)。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "视频描述(必填)"},
                "provider": {
                    "type": "string",
                    "enum": ["kling", "jimeng"],
                    "default": "kling",
                },
                "model": {
                    "type": "string",
                    "description": "可选,模型(如 kling-v1 / jimeng-video_generation / doubao-seedance-1-0-pro)",
                },
                "duration": {
                    "type": "integer",
                    "description": "视频时长秒(默认 5)",
                    "default": 5,
                },
                "image": {
                    "type": "string",
                    "description": "可选,图生视频首帧图片(URL 或 base64)",
                },
                "negative_prompt": {
                    "type": "string",
                    "description": "可选,反向提示词",
                },
                "save_path": {
                    "type": "string",
                    "description": "可选,绝对路径,下载视频落地(需工作区白名单内,后缀 .mp4,200MB 上限)",
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
    MCPTool(
        name="generate_chart",
        description=(
            "生成数据图表(输出 ECharts 单文件 HTML,支持 line/bar/pie/scatter 四类,中文标题)。"
            "用于数据分析/报表/趋势可视化。data 参数为 JSON 字符串,按类型传结构。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "chart_type": {"type": "string", "description": "图表类型:line/bar/pie/scatter"},
                "title": {"type": "string", "description": "图表标题"},
                "data": {
                    "type": "string",
                    "description": "JSON 字符串。line/bar:{\"x\":[...],\"series\":[{\"name\":\"..\",\"values\":[...]}]};pie:[{\"name\":\"..\",\"value\":n}];scatter:{\"points\":[[x,y],...]} 或 {\"series\":[{\"name\":\"s1\",\"points\":[[x,y],...]}]}",
                },
                "output_dir": {"type": "string", "description": "输出目录(相对项目根,默认 tmp/charts)", "default": "tmp/charts"},
            },
            "required": ["chart_type", "title", "data"],
            "additionalProperties": False,
        },
    ),
    MCPTool(
        name="parse_document",
        description=(
            "解析本地文档为可注入上下文的文本(支持 txt/md/csv/json/pdf/docx/xlsx)。"
            "用于阅读上传文档、抽取表格、总结文件内容。仅限项目工作区内文件,敏感文件(密钥类)拒绝。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件绝对路径或相对项目根路径"},
                "max_chars": {"type": "integer", "description": "返回内容上限,默认 20000(500-100000)", "default": 20000},
            },
            "required": ["path"],
            "additionalProperties": False,
        },
    ),
    # ===== 工具定义 deferral 反查工具(2026-09-02 立)=====
    MCPTool(
        name="get_tool_schema",
        description=(
            "返回指定工具的完整参数 schema(name/description/input_schema),只读。"
            "当工具定义被 deferral 精简(上下文只放短描述+占位参数)后,模型用本工具"
            "按工具名取回完整参数,再决定是否调用该工具。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "要查询完整 schema 的工具名(可用 tools/list 获取全部工具名)",
                },
            },
            "required": ["name"],
        },
    ),
    # ===== 后台任务工具(Phase 1 第 6 项 · 2026-09-02 立)=====
    MCPTool(
        name="run_in_background",
        description=(
            "提交后台任务并立即返回 task_id(不阻塞循环),"
            "完成后经 IM 推送完成通知。支持 sleep/echo(可扩展)"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "后台任务类型(白名单:sleep/echo;后续批次扩展真实长任务)",
                },
                "arguments": {
                    "type": "object",
                    "description": "任务参数,如 sleep 的 {seconds:number},echo 的 {message:string}",
                },
                "name": {"type": "string", "description": "任务显示名(可选,默认=task)"},
                "notify_on_done": {
                    "type": "boolean",
                    "description": "完成后经 message_bus 推送 IM 通知(默认 true)",
                    "default": True,
                },
                "timeout_s": {
                    "type": "integer",
                    "description": "任务超时秒数(默认 300,最小 1)",
                    "default": 300,
                },
            },
            "required": ["task"],
            "additionalProperties": False,
        },
    ),
    MCPTool(
        name="bg_task_status",
        description="查询后台任务状态(凭 task_id)或列出某用户的任务;只读,不阻塞循环",
        input_schema={
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "string",
                    "description": "查询指定任务状态(不传则进入列表模式)",
                },
                "user_id": {
                    "type": "string",
                    "description": "列表模式下按用户过滤(可选,默认取调用者身份)",
                },
                "limit": {
                    "type": "integer",
                    "description": "列表返回上限(默认 20)",
                    "default": 20,
                },
            },
            "additionalProperties": False,
        },
    ),
]


def get_registered_tool_names() -> set[str]:
    """返回所有已注册工具的名字集合(只读 helper,2026-07-31 立)。

    供 llm.py 的 resolve_tool_source() 派生工具来源(serverSource)使用:
    - 工具名在本集合中且不属于 builtin/plugin → serverSource='mcp'
    - 当前所有工具均为本地实现(无外部 MCP server 注册),server_id/server_name 暂为 None
    - 未来接入外部 MCP server(如 context7/filesystem)后,扩展本函数返回 (name, server_id, server_name) 三元组
    """
    return {t.name for t in _TOOLS}


# 2026-08-06 生产修复:LLM 可能返回与注册工具不一致的别名(模型幻觉/跨平台命名),
# 统一映射到实际注册工具名,防止 call_tool 报"未知工具"。
_TOOL_ALIASES: dict[str, str] = {
    "execute_command": "run_command",  # Claude/Codex 风格 → 本项目 run_command
    "list_directory": "list_files",
}


def _normalize_tool_name(name: str) -> str:
    """工具名归一化:优先映射别名,否则原样返回。"""
    return _TOOL_ALIASES.get(name, name)


# ---------------------------------------------------------------------------
# 工具定义 deferral(瘦身)数据层(2026-09-02 立)
# ---------------------------------------------------------------------------
# 把"完整工具 schema"与"放进 LLM 上下文的精简定义"解耦:默认(TOOL_DEFERRAL=on)
# 下,agent loop 只把"短描述 + 占位参数"塞进上下文,模型需要完整参数时通过内置
# get_tool_schema 工具按需拉取,对标 Claude Code 的工具定义瘦身(上下文占比超阈值
# 自动 deferral)。本注册表是两来源(内置 _TOOLS / 外部 register_external_tool)的统一落点。
_DEFERRED_TOOL_SCHEMAS: dict[str, dict[str, Any]] = {}


def _register_deferred_schema(tool: MCPTool) -> None:
    """把单个工具的完整 schema 写入 deferral 注册表(name → 完整 schema)。"""
    _DEFERRED_TOOL_SCHEMAS[tool.name] = {
        "name": tool.name,
        "description": tool.description,
        "input_schema": tool.input_schema,
    }


def _populate_deferred_schemas() -> None:
    """把当前 _TOOLS 全部内置工具的完整 schema 批量灌入注册表(幂等)。

    在模块加载、_TOOLS 彻底构建完成后调用一次;外部工具走 register_external_tool
    各自增量写入,二者共同保证注册表覆盖两来源。重复调用安全(后者覆盖前者)。
    """
    for t in _TOOLS:
        _register_deferred_schema(t)


def get_full_tool_schema(name: str) -> dict[str, Any] | None:
    """返回 deferral 注册表中某工具的完整 schema(name/description/input_schema)。

    name 不存在返回 None。供内置 get_tool_schema 工具与 agent loop 的按需展开复用。
    """
    return _DEFERRED_TOOL_SCHEMAS.get(name)


def list_deferred_tool_names() -> list[str]:
    """返回当前已登记完整 schema 的工具名列表(排序,输出稳定)。"""
    return sorted(_DEFERRED_TOOL_SCHEMAS.keys())


async def _tool_get_tool_schema(arguments: dict[str, Any]) -> dict[str, Any]:
    """get_tool_schema: 返回指定工具的完整参数 schema(deferral 反查入口,只读)。

    模型在工具定义被 deferral 精简后,用本工具按 name 取回完整 input_schema/描述,
    再决定是否调用该工具。name 为空或不存在均返回 ok=False 并附带可用工具名清单。
    """
    name = str(arguments.get("name", "")).strip()
    if not name:
        return {"ok": False, "error": "name 不能为空(get_tool_schema 需要目标工具名)"}
    schema = get_full_tool_schema(name)
    if schema is None:
        return {
            "ok": False,
            "error": f"未找到工具: {name}",
            "available": list_deferred_tool_names(),
        }
    return {"ok": True, "tool": name, "schema": schema}


_TOOL_HANDLERS: dict[str, Any] = {
    # ===== 工具定义 deferral 反查工具(2026-09-02 立)=====
    "get_tool_schema": _tool_get_tool_schema,
    "search_codebase": _tool_search_codebase,
    "knowledge_lookup": _tool_knowledge_lookup,
    "context_recall": _tool_context_recall,
    "read_file": _tool_read_file,
    "list_files": _tool_list_files,
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
    # ===== P0 新增工具(2026-09-01,竞品对标:图表生成 + 文档解析)=====
    "generate_chart": _generate_chart,
    "parse_document": _parse_document,
    # ===== 后台任务工具(Phase 1 第 6 项 · 2026-09-02 立)=====
    "run_in_background": _tool_run_in_background,
    "bg_task_status": _tool_bg_task_status,
}


# 外部注入工具名单(2026-09-02 立,P2-1):register_external_tool 注册成功的工具名集合,
# 供卸载/停用时精确清理(_TOOLS/_TOOL_HANDLERS 还含大量本地工具,不能整表操作)。
# 同名工具已被占用时 register 返回 False,不进入本集合。
_EXTERNAL_TOOL_NAMES: set[str] = set()


def register_external_tool(tool: MCPTool, handler: Any) -> bool:
    """注册外部 MCP 工具(2026-09-01 立,stdio bridge 注入外部 server 工具用)。

    自研工具注册表(_TOOLS + _TOOL_HANDLERS)是唯一权威工具来源,LLM tool schema、
    mcp_official 协议层、agent loop 均从这里读取。外部 stdio MCP server 发现工具后,
    通过本函数把远程工具包装成内部 MCPTool + 转发 handler 注入注册表,复用既有
    权限矩阵与调用链,LLM 无需感知工具是本地实现还是外部子进程。

    幂等:同名工具已注册(handler 已存在)时返回 False 且不覆盖,防止多个 stdio
    server 或本地工具被外部工具同名覆盖。

    Args:
        tool: 待注册的 MCPTool(名称/描述/input_schema 来自外部 server 的 list_tools)
        handler: async (arguments: dict) -> dict 转发 handler,与本地工具 handler 同签名

    Returns:
        True=注册成功;False=同名工具已存在,跳过
    """
    if tool.name in _TOOL_HANDLERS:
        return False
    _TOOLS.append(tool)
    _TOOL_HANDLERS[tool.name] = handler
    _EXTERNAL_TOOL_NAMES.add(tool.name)
    # 同步写入 deferral 注册表:外部工具也需可被 get_tool_schema 反查完整 schema。
    _register_deferred_schema(tool)
    return True


def unregister_external_tools(names: list[str] | set[str] | tuple[str, ...]) -> list[str]:
    """按精确工具名批量移除外部注入的工具(2026-09-02 立,P2-1)。

    只清理由 register_external_tool 注入的工具(_EXTERNAL_TOOL_NAMES 名单内的),
    不触碰本地工具表;从 _TOOLS / _TOOL_HANDLERS / _EXTERNAL_TOOL_NAMES 三个容器
    同步移除。幂等:目标名不存在或非外部注入时静默跳过。

    Args:
        names: 待移除的外部工具名(可迭代;空集合/未安装名均安全)

    Returns:
        实际移除的工具名列表
    """
    target = {n for n in names if n}
    removed = sorted(n for n in target if n in _EXTERNAL_TOOL_NAMES)
    if not removed:
        return []
    for n in removed:
        _EXTERNAL_TOOL_NAMES.discard(n)
        _TOOL_HANDLERS.pop(n, None)
        _DEFERRED_TOOL_SCHEMAS.pop(n, None)
    _TOOLS[:] = [t for t in _TOOLS if t.name not in removed]
    return removed


def unregister_external_tool_by_prefix(prefix: str) -> list[str]:
    """按工具名前缀批量移除外部注入的工具(2026-09-02 立,P2-1,幂等)。

    供按 server 维度清理:外部 server 注入的工具名以统一前缀命名时,传前缀即可
    批量移除;否则调用方应改用 unregister_external_tools(精确名单)。

    Args:
        prefix: 工具名前缀(如 "mcp:filesystem__")

    Returns:
        实际移除的工具名列表
    """
    target = [n for n in _EXTERNAL_TOOL_NAMES if n.startswith(prefix)]
    return unregister_external_tools(target)


def list_external_tools_injected() -> list[str]:
    """返回当前由 register_external_tool 注入的外部工具名列表(2026-09-02 立,P2-1)。

    只含外部注入且注册成功的工具,不含本地工具;按名排序保证输出稳定。
    """
    return sorted(_EXTERNAL_TOOL_NAMES)


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
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """调用指定工具(带权限矩阵校验)。

        Args:
            name: 工具名
            arguments: 工具参数
            user_role: 调用者角色 ID(0=普通用户,>=1=admin)。admin 专属工具
                       需 user_role >= 1,其他工具所有用户可用。
            user_id: 调用者用户 ID(可选)。从 FastAPI request 上下文注入,
                     供 knowledge_lookup 查 long_term_memory 源(跨会话历史)。
                     service 层(agent_loop/orchestrator/conversation)无 request 上下文,
                     传 None 时 _tool_knowledge_lookup 跳过 LTM(与 G5 旧行为一致)。
            session_id: 会话 ID(可选)。供 knowledge_lookup 限定 RAG 检索会话范围。
        """
        handler = _TOOL_HANDLERS.get(name)
        if not handler:
            # 2026-08-06 修复:LLM 返回的别名工具名归一化后再查(execute_command → run_command)
            normalized = _normalize_tool_name(name)
            if normalized != name:
                handler = _TOOL_HANDLERS.get(normalized)
                name = normalized
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
            # G6(2026-07-26):同时注入 __user_id/__session_id 供 knowledge_lookup
            # 查 long_term_memory 源(从 FastAPI request 上下文透传,LLM 不可控)
            args_with_role = dict(arguments or {})
            args_with_role["__user_role"] = user_role
            args_with_role["__user_id"] = user_id
            args_with_role["__session_id"] = session_id
            # 2026-07-22 P1 鲁棒性加固:全局超时,防 handler 无限挂起
            result = await asyncio.wait_for(
                handler(args_with_role), timeout=MCP_GLOBAL_TIMEOUT
            )
            # 0-2 出口统一输出护栏:token 上限截断(保持结构与控制字段完整)
            return _truncate_tool_output(result)
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
            skills = skill_registry.list_skills()
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

# 模块加载末段:把全部内置工具(含本文件新增的 get_tool_schema)的完整 schema 灌入
# deferral 注册表。外部工具在 register_external_tool 时各自增量写入,二者共同覆盖两来源。
_populate_deferred_schemas()


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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
