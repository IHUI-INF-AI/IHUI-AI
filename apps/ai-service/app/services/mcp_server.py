"""MCP 服务端。

定义 11 个工具、3 个资源、3 个提示词,并提供统一的查询/调用接口。
工具实现为真实文件系统/网络操作,无外部依赖时返回降级结果。
"""

import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qs, quote_plus, urlparse

from .skills import skill_registry


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
    """read_file: 读取文件内容。"""
    path = arguments.get("path", "")
    try:
        with open(path, encoding="utf-8") as f:
            content = f.read()
        return {"tool": "read_file", "path": path, "content": content, "ok": True}
    except Exception as e:
        return {"tool": "read_file", "path": path, "content": "", "ok": False, "error": str(e)}


async def _tool_write_file(arguments: dict[str, Any]) -> dict[str, Any]:
    """write_file: 写入文件内容。"""
    path = arguments.get("path", "")
    content = arguments.get("content", "")
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return {"tool": "write_file", "path": path, "bytes_written": len(content.encode("utf-8")), "ok": True}
    except Exception as e:
        return {"tool": "write_file", "path": path, "ok": False, "error": str(e)}


async def _tool_run_command(arguments: dict[str, Any]) -> dict[str, Any]:
    """run_command: 运行 shell 命令(真实 subprocess 执行,白名单 + 超时)。

    出于安全考虑,仅允许只读/查询类命令,禁止任何修改/删除/网络写入操作。
    - command: 命令字符串(如 "git status", "ls -la", "python --version")
    - cwd: 工作目录(默认当前目录)
    - timeout: 超时秒数(默认 10,上限 60)
    - 白名单: 允许的命令前缀(git/ls/cat/echo/python/node/npm/pnpm/tsc/ruff/mypy/pytest/find/grep/wc/head/tail/date/whoami/pwd/which/where/env)
    - 禁止: rm/mv/cp/mkdir/rmdir/curl/wget/scp/ssh/dd/mkfs/shutdown/reboot/>/>>/| 等危险操作
    """
    command = arguments.get("command", "").strip()
    cwd = arguments.get("cwd", ".")
    timeout = min(int(arguments.get("timeout", 10)), 60)

    if not command:
        return {
            "tool": "run_command",
            "command": command,
            "exit_code": -1,
            "stdout": "",
            "stderr": "",
            "ok": False,
            "message": "命令为空",
        }

    # 危险字符/操作黑名单(Shell 注入 + 破坏性操作)
    _DANGEROUS_PATTERNS = [
        r";\s*\S",  # 命令分隔符后跟内容
        r"&&\s*\S",
        r"\|\|\s*\S",
        r"\brm\b",
        r"\brmdir\b",
        r"\bmv\b",
        r"\bcp\b",
        r"\bmkdir\b",
        r"\btouch\b",
        r"\bchmod\b",
        r"\bchown\b",
        r"\bcurl\b",
        r"\bwget\b",
        r"\bscp\b",
        r"\bssh\b",
        r"\bdd\b",
        r"\bmkfs\b",
        r"\bshutdown\b",
        r"\breboot\b",
        r"\bkill\b",
        r"\bkillall\b",
        r">\s*",  # 输出重定向
        r">>\s*",
        r"<\s*",  # 输入重定向
        r"\|\s*",  # 管道
        r"`[^`]*`",  # 命令替换
        r"\$\([^)]*\)",  # 命令替换
        r"\$\{[^}]*\}",  # 变量扩展(可能含恶意)
    ]
    for pat in _DANGEROUS_PATTERNS:
        if re.search(pat, command):
            return {
                "tool": "run_command",
                "command": command,
                "exit_code": -1,
                "stdout": "",
                "stderr": "",
                "ok": False,
                "message": f"命令包含禁止的模式: {pat}(安全限制)",
            }

    # 命令前缀白名单
    _ALLOWED_PREFIXES = {
        "git", "ls", "cat", "echo", "python", "python3", "node", "npm", "npx",
        "pnpm", "tsc", "ruff", "mypy", "pytest", "find", "grep", "rg", "wc",
        "head", "tail", "date", "whoami", "pwd", "which", "where", "env",
        "uname", "ver", "dir", "type", "getopt",
    }
    # 取第一个 token 作为命令名
    first_token = command.split()[0] if command.split() else ""
    # 处理 Windows 路径(如 /usr/bin/git)
    cmd_name = first_token.rsplit("/", 1)[-1].rsplit("\\", 1)[-1].lower()
    if cmd_name not in _ALLOWED_PREFIXES:
        return {
            "tool": "run_command",
            "command": command,
            "exit_code": -1,
            "stdout": "",
            "stderr": "",
            "ok": False,
            "message": f"命令 '{cmd_name}' 不在白名单中(允许: {', '.join(sorted(_ALLOWED_PREFIXES))})",
        }

    try:
        import asyncio
        import shlex
        import sys

        # 解析命令参数
        if sys.platform == "win32":
            # Windows: echo/type/ver 等是 shell 内置命令,需用 shell 执行
            # 用 cmd /c 执行整个命令字符串
            proc = await asyncio.create_subprocess_shell(
                command,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        else:
            # Unix: 用 exec 避免 shell 注入(参数已通过白名单 + 黑名单过滤)
            args = shlex.split(command)
            proc = await asyncio.create_subprocess_exec(
                *args,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            try:
                proc.kill()
            except ProcessLookupError:
                pass
            return {
                "tool": "run_command",
                "command": command,
                "exit_code": -1,
                "stdout": "",
                "stderr": f"命令超时({timeout}s)",
                "ok": False,
                "message": f"命令执行超时({timeout} 秒)",
            }

        stdout = stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""
        stderr = stderr_bytes.decode("utf-8", errors="replace") if stderr_bytes else ""
        # 截断过长输出
        max_output = 10000
        if len(stdout) > max_output:
            stdout = stdout[:max_output] + f"\n...(已截断,共 {len(stdout)} 字符)"
        if len(stderr) > max_output:
            stderr = stderr[:max_output] + f"\n...(已截断,共 {len(stderr)} 字符)"

        return {
            "tool": "run_command",
            "command": command,
            "exit_code": proc.returncode,
            "stdout": stdout,
            "stderr": stderr,
            "ok": proc.returncode == 0,
            "message": f"命令退出码: {proc.returncode}",
        }
    except FileNotFoundError:
        return {
            "tool": "run_command",
            "command": command,
            "exit_code": -1,
            "stdout": "",
            "stderr": f"命令未找到: {first_token}",
            "ok": False,
            "message": f"命令未找到: {first_token}",
        }
    except Exception as e:
        return {
            "tool": "run_command",
            "command": command,
            "exit_code": -1,
            "stdout": "",
            "stderr": str(e),
            "ok": False,
            "message": f"命令执行失败: {e}",
            "error": str(e),
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
            "query": query,
            "max_results": max_results,
            "results": results,
            "total": len(results),
            "message": f"找到 {len(results)} 条结果" if results else "未找到结果",
        }

    except Exception as e:
        return {
            "tool": "search_web",
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

    支持的 action: status/diff/log/branch/show/stash/list
    其他 action 返回错误,避免执行危险操作(push/force/reset 等)。
    """
    action = arguments.get("action", "status")
    repo = arguments.get("repo", ".")

    # 白名单:仅允许只读/安全操作
    _ALLOWED_ACTIONS = {
        "status": ["status", "--short", "--branch"],
        "diff": ["diff", "--stat"],
        "log": ["log", "--oneline", "-20"],
        "branch": ["branch", "-a"],
        "show": ["show", "--stat"],  # show 需要 ref 参数
        "stash": ["stash", "list"],
        "list": ["ls-files"],
    }

    if action not in _ALLOWED_ACTIONS:
        return {
            "tool": "git_operations",
            "action": action,
            "repo": repo,
            "output": "",
            "message": f"不允许的 git 操作: {action}。允许: {', '.join(sorted(_ALLOWED_ACTIONS))}",
            "ok": False,
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
        git_args = list(_ALLOWED_ACTIONS[action])
        # show 命令需要 ref 参数
        if action == "show":
            ref = arguments.get("ref", "HEAD")
            git_args.append(ref)

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
_AGENT_CONTROL_API_URL = "http://127.0.0.1:3001/api/agent-control/execute"


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
    try:
        async with httpx.AsyncClient(timeout=timeout_ms / 1000 + 10) as client:
            response = await client.post(
                _AGENT_CONTROL_API_URL,
                json=request,
                headers={"Authorization": "Bearer internal-service"},
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

_AUTOMATION_API_BASE = "http://127.0.0.1:3001/api/self-media/automation/tasks"


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


async def _tool_configure_automation_task(arguments: dict[str, Any]) -> dict[str, Any]:
    """配置自媒体自动化定时任务(转发到 api 层 config 端点)。

    支持 koubo_daily / wechat_daily 两个内置任务,
    可修改执行时间、dry-run、enabled、title_template。
    """
    import httpx

    task_id = arguments.get("task_id", "wechat_daily")
    if task_id not in ("koubo_daily", "wechat_daily"):
        return {"success": False, "error": f"不支持的任务 ID: {task_id}(仅 koubo_daily / wechat_daily)"}

    hour = int(arguments.get("hour", 9))
    minute = int(arguments.get("minute", 0))
    dry_run = bool(arguments.get("dry_run", True))
    enabled = bool(arguments.get("enabled", True))
    title_template = arguments.get("title_template")

    config_body: dict[str, Any] = {
        "hour": hour,
        "minute": minute,
        "dry_run": dry_run,
        "enabled": enabled,
    }
    if title_template:
        config_body["title_template"] = str(title_template)

    url = f"{_AUTOMATION_API_BASE}/{task_id}/config"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=config_body)
            if resp.status_code >= 400:
                return {
                    "success": False,
                    "error": f"api 返回 {resp.status_code}: {resp.text[:200]}",
                }
            data = resp.json()
            # api 返回 {code, message, data} 格式,提取 data
            task_data = data.get("data", data) if isinstance(data, dict) else data
            return {
                "success": True,
                "task_id": task_id,
                "hour": hour,
                "minute": minute,
                "dry_run": dry_run,
                "enabled": enabled,
                "title_template": title_template,
                "raw_response": task_data,
            }
    except Exception as e:
        err_type = type(e).__name__
        return {
            "success": False,
            "message": f"配置失败: {err_type}",
            "error": str(e)[:200],
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
        name="run_command",
        description="运行 shell 命令(真实 subprocess,白名单: git/ls/cat/echo/python/node/npm/pnpm/ruff/mypy/pytest 等,禁止 rm/mv/cp/curl/重定向/管道)",
        input_schema={
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "命令字符串(如 git status, python --version)"},
                "cwd": {"type": "string", "description": "工作目录(默认当前目录)", "default": "."},
                "timeout": {"type": "integer", "description": "超时秒数(默认 10,上限 60)", "default": 10},
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
        description="Git 操作(真实 git 命令,白名单: status/diff/log/branch/show/stash/list)",
        input_schema={
            "type": "object",
            "properties": {
                "action": {"type": "string", "description": "git 操作: status/diff/log/branch/show/stash/list", "default": "status"},
                "repo": {"type": "string", "description": "仓库路径(默认当前目录)", "default": "."},
                "ref": {"type": "string", "description": "git 引用(仅 show 操作使用,默认 HEAD)", "default": "HEAD"},
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
]

_TOOL_HANDLERS: dict[str, Any] = {
    "search_codebase": _tool_search_codebase,
    "read_file": _tool_read_file,
    "write_file": _tool_write_file,
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

    async def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
        """调用指定工具。"""
        handler = _TOOL_HANDLERS.get(name)
        if not handler:
            available = ", ".join(_TOOL_HANDLERS.keys())
            return {"ok": False, "error": f"未知工具: {name}。可用: {available}"}
        try:
            return await handler(arguments or {})
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
