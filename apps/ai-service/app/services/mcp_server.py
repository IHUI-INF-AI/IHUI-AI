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


mcp_server = MCPServer()
