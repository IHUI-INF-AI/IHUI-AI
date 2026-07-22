"""LSP 转发路由 — 封装 cli 的 LSP 能力为 HTTP 端点。

提供 4 个端点(对齐 cli/src/tools/lsp.ts 的 4 个工具):
- POST /api/v1/lsp/definition   转到定义(lsp_goto_definition)
- POST /api/v1/lsp/references    查找引用(lsp_find_references)
- POST /api/v1/lsp/diagnostics   文件诊断(lsp_diagnostics)
- POST /api/v1/lsp/hover         符号 hover(lsp_hover)

底层通过 subprocess 启动 `typescript-language-server --stdio`,
按 LSP JSON-RPC over stdio 协议交互。
未安装时返回 HTTP 503 + 降级提示(对齐 cli 的 lsp-unavailable 行为)。

注:cli 是 TypeScript 实现,ai-service(Python)无法直接 import,
故在此用 subprocess + Content-Length 帧协议复刻一份最小可用 LSP 客户端。
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse
from urllib.request import pathname2url, url2pathname

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lsp", tags=["lsp"])

LSP_BIN = "typescript-language-server"
LSP_INIT_TIMEOUT_S = 15.0
LSP_REQUEST_TIMEOUT_S = 10.0
DIAGNOSTICS_POLL_S = 0.1
DIAGNOSTICS_MAX_POLLS = 10


# ==================== Request models(camelCase 对齐前端)====================


class LspPositionRequest(BaseModel):
    """带位置参数的 LSP 请求(file + line + column)。"""

    workspacePath: str = Field(..., description="工作区绝对路径")
    file: str = Field(..., description="文件路径(相对 workspacePath 或绝对)")
    line: int = Field(..., ge=1, description="行号(1-based)")
    column: int = Field(..., ge=1, description="列号(1-based)")


class LspFileRequest(BaseModel):
    """仅文件维度的 LSP 请求(如 diagnostics)。"""

    workspacePath: str = Field(..., description="工作区绝对路径")
    file: str = Field(..., description="文件路径(相对 workspacePath 或绝对)")


class LspReferencesRequest(LspPositionRequest):
    """查找引用 — 比 LspPositionRequest 多一个 includeDeclaration。"""

    includeDeclaration: Optional[bool] = Field(
        True, description="是否包含定义声明(默认 true)"
    )


# ==================== LSP 可用性 / 路径 / URI 工具函数 ====================


def _check_lsp_available() -> None:
    """检查 typescript-language-server 是否在 PATH 中,否则抛 HTTP 503。"""
    if not shutil.which(LSP_BIN):
        raise HTTPException(
            status_code=503,
            detail={
                "error": "LSP service unavailable",
                "detail": (
                    f"{LSP_BIN} not installed. "
                    "Install: npm i -g typescript-language-server typescript"
                ),
            },
        )


def _to_uri(file_path: str) -> str:
    """绝对路径 → file:// URI(跨平台)。"""
    abs_path = os.path.abspath(file_path)
    # pathname2url 处理 Windows 反斜杠 / 空格 / 中文
    return "file:///" + pathname2url(abs_path).lstrip("/")


def _from_uri(uri: str) -> str:
    """file:// URI → 绝对路径。"""
    parsed = urlparse(uri)
    return url2pathname(parsed.path)


def _detect_language_id(file_path: str) -> str:
    """根据扩展名推断 languageId(对齐 lsp.ts detectLanguageId)。"""
    ext = Path(file_path).suffix.lstrip(".").lower()
    return {
        "ts": "typescript",
        "tsx": "typescriptreact",
        "js": "javascript",
        "jsx": "javascriptreact",
        "mjs": "javascript",
        "cjs": "javascript",
        "json": "json",
        "css": "css",
        "html": "html",
        "md": "markdown",
    }.get(ext, ext or "plaintext")


def _resolve_file(file: str, workspace_path: str) -> str:
    """file 参数 → 绝对路径,并校验存在。"""
    abs_path = file if os.path.isabs(file) else os.path.join(workspace_path, file)
    if not os.path.isfile(abs_path):
        raise HTTPException(status_code=404, detail=f"文件不存在: {file}")
    return abs_path


def _normalize_locations(result: Any) -> list[dict]:
    """LSP Location | Location[] | LocationLink[] | null → 统一 list[{uri, range}]。"""
    if not result:
        return []
    items = result if isinstance(result, list) else [result]
    out: list[dict] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        if "targetUri" in it:  # LocationLink
            out.append({"uri": it["targetUri"], "range": it.get("targetRange")})
        elif "uri" in it:  # Location
            out.append({"uri": it["uri"], "range": it.get("range")})
    return out


def _format_location(loc: dict, workspace_path: str) -> dict:
    """对外暴露的 Location 结构(relpath + 1-based line/col)。"""
    try:
        abs_path = _from_uri(loc.get("uri", ""))
        rel = os.path.relpath(abs_path, workspace_path).replace(os.sep, "/")
    except Exception:
        rel = loc.get("uri", "")
    start = (loc.get("range") or {}).get("start", {})
    return {
        "file": rel,
        "line": start.get("line", 0) + 1,
        "column": start.get("character", 0) + 1,
    }


def _format_diagnostic(d: dict) -> dict:
    """对外暴露的 Diagnostic 结构(对齐 lsp.ts formatDiagnostic)。"""
    sev = d.get("severity")
    severity = {1: "Error", 2: "Warning", 3: "Info", 4: "Hint"}.get(sev, "Unknown")
    start = (d.get("range") or {}).get("start", {})
    return {
        "severity": severity,
        "line": start.get("line", 0) + 1,
        "column": start.get("character", 0) + 1,
        "source": d.get("source", ""),
        "code": d.get("code"),
        "message": d.get("message", ""),
    }


def _format_hover(hover: dict | None) -> str:
    """对外暴露的 hover 字符串(对齐 lsp.ts formatHover)。"""
    if not hover:
        return "(无 hover 信息)"
    contents = hover.get("contents")
    if isinstance(contents, str):
        return contents
    if isinstance(contents, list):
        parts: list[str] = []
        for c in contents:
            if isinstance(c, str):
                parts.append(c)
            elif isinstance(c, dict) and "value" in c:
                parts.append(str(c["value"]))
            else:
                parts.append(str(c))
        return "\n\n".join(p for p in parts if p and p.strip())
    if isinstance(contents, dict) and "value" in contents:
        return str(contents["value"])
    return "(无 hover 内容)"


# ==================== 轻量 LSP 客户端(JSON-RPC over stdio,per workspace 单例)====================


class LspClient:
    """最小可用 typescript-language-server 客户端。

    策略(对齐 cli/src/tools/lsp.ts LspClient):
    - 懒启动:首次调用时 spawn 子进程,后续复用(单例 per workspace)
    - Content-Length 帧协议直接写 stdin / 读 stdout
    - publishDiagnostics 通知缓存到 _diagnostics
    - 任何启动 / 请求失败 → 抛异常给上层转 503
    """

    _instances: dict[str, "LspClient"] = {}

    def __init__(self, workspace_path: str):
        self.workspace_path = workspace_path
        self.proc: asyncio.subprocess.Process | None = None
        self._next_id = 1
        self._responses: dict[int, asyncio.Future] = {}
        self._diagnostics: dict[str, list] = {}
        self._opened: set[str] = set()
        self._reader_task: asyncio.Task | None = None
        self._init_lock = asyncio.Lock()
        self._initialized = False

    @classmethod
    def get(cls, workspace_path: str) -> "LspClient":
        """按 workspacePath 复用单例(对齐 cli getLspClient)。"""
        if workspace_path not in cls._instances:
            cls._instances[workspace_path] = cls(workspace_path)
        return cls._instances[workspace_path]

    async def _ensure_started(self) -> None:
        """首次请求时启动 LSP 进程并发送 initialize。"""
        async with self._init_lock:
            if self._initialized and self.proc and self.proc.returncode is None:
                return
            _check_lsp_available()
            self.proc = await asyncio.create_subprocess_exec(
                LSP_BIN,
                "--stdio",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.workspace_path,
            )
            self._reader_task = asyncio.create_task(self._read_loop())
            await self._request(
                "initialize",
                {
                    "processId": os.getpid(),
                    "rootUri": _to_uri(self.workspace_path),
                    "capabilities": {},
                },
                timeout=LSP_INIT_TIMEOUT_S,
            )
            await self._notify("initialized", {})
            self._initialized = True

    async def _read_loop(self) -> None:
        """读取 stdout,按 Content-Length 帧解析,分发响应 / 通知。"""
        assert self.proc and self.proc.stdout
        try:
            while True:
                headers: dict[str, str] = {}
                while True:
                    line = await self.proc.stdout.readline()
                    if not line:
                        return
                    line_str = line.decode("utf-8", errors="replace").rstrip("\r\n")
                    if line_str == "":
                        break
                    if ":" in line_str:
                        k, v = line_str.split(":", 1)
                        headers[k.strip().lower()] = v.strip()
                content_length = int(headers.get("content-length", "0"))
                if content_length <= 0:
                    continue
                body = await self.proc.stdout.readexactly(content_length)
                msg = json.loads(body.decode("utf-8"))
                if "id" in msg:
                    fut = self._responses.pop(msg["id"], None)
                    if fut and not fut.done():
                        if "error" in msg:
                            fut.set_exception(
                                RuntimeError(f"LSP error: {msg['error']}")
                            )
                        else:
                            fut.set_result(msg.get("result"))
                elif msg.get("method") == "textDocument/publishDiagnostics":
                    params = msg.get("params", {})
                    self._diagnostics[params.get("uri", "")] = params.get(
                        "diagnostics", []
                    )
        except Exception as e:
            logger.warning("[lsp] reader loop exit: %s", e)

    async def _send(self, payload: dict) -> None:
        assert self.proc and self.proc.stdin
        body = json.dumps(payload).encode("utf-8")
        header = f"Content-Length: {len(body)}\r\n\r\n".encode("ascii")
        self.proc.stdin.write(header + body)
        await self.proc.stdin.drain()

    async def _request(self, method: str, params: dict, timeout: float) -> Any:
        msg_id = self._next_id
        self._next_id += 1
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        self._responses[msg_id] = fut
        await self._send(
            {"jsonrpc": "2.0", "id": msg_id, "method": method, "params": params}
        )
        try:
            return await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError:
            self._responses.pop(msg_id, None)
            raise RuntimeError(f"LSP request {method} 超时")

    async def _notify(self, method: str, params: dict) -> None:
        await self._send({"jsonrpc": "2.0", "method": method, "params": params})

    async def _ensure_open(self, file_path: str) -> str:
        """首次访问该文件时发 textDocument/didOpen(对齐 cli ensureOpen)。"""
        uri = _to_uri(file_path)
        if uri in self._opened:
            return uri
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
        except OSError as e:
            raise HTTPException(status_code=500, detail=f"读取文件失败: {e}")
        await self._notify(
            "textDocument/didOpen",
            {
                "textDocument": {
                    "uri": uri,
                    "languageId": _detect_language_id(file_path),
                    "version": 1,
                    "text": content,
                }
            },
        )
        self._opened.add(uri)
        await asyncio.sleep(0.2)  # 等 server 索引 / 推 diagnostics
        return uri

    async def goto_definition(self, file_path: str, line: int, col: int) -> list[dict]:
        uri = await self._ensure_open(file_path)
        result = await self._request(
            "textDocument/definition",
            {
                "textDocument": {"uri": uri},
                "position": {"line": line - 1, "character": col - 1},
            },
            LSP_REQUEST_TIMEOUT_S,
        )
        return _normalize_locations(result)

    async def find_references(
        self, file_path: str, line: int, col: int, include_declaration: bool
    ) -> list[dict]:
        uri = await self._ensure_open(file_path)
        result = await self._request(
            "textDocument/references",
            {
                "textDocument": {"uri": uri},
                "position": {"line": line - 1, "character": col - 1},
                "context": {"includeDeclaration": include_declaration},
            },
            LSP_REQUEST_TIMEOUT_S,
        )
        return _normalize_locations(result)

    async def get_diagnostics(self, file_path: str) -> list[dict]:
        uri = await self._ensure_open(file_path)
        # 轮询等 publishDiagnostics 通知到达(对齐 cli 轮询逻辑)
        for _ in range(DIAGNOSTICS_MAX_POLLS):
            if uri in self._diagnostics:
                return self._diagnostics[uri]
            await asyncio.sleep(DIAGNOSTICS_POLL_S)
        return self._diagnostics.get(uri, [])

    async def hover(self, file_path: str, line: int, col: int) -> dict | None:
        uri = await self._ensure_open(file_path)
        return await self._request(
            "textDocument/hover",
            {
                "textDocument": {"uri": uri},
                "position": {"line": line - 1, "character": col - 1},
            },
            LSP_REQUEST_TIMEOUT_S,
        )

    async def dispose(self) -> None:
        if self._reader_task:
            self._reader_task.cancel()
        if self.proc and self.proc.returncode is None:
            try:
                self.proc.terminate()
                await asyncio.wait_for(self.proc.wait(), timeout=2)
            except Exception:
                try:
                    self.proc.kill()
                except Exception:
                    pass
        self._initialized = False


# ==================== 端点 ====================


def _lsp_unavailable_body(e: Exception) -> dict[str, Any]:
    """LSP 运行时失败 → 503 响应体(对齐 cli lspUnavailableResult 语义)。"""
    return {
        "code": 503,
        "message": f"LSP 不可用: {e}",
        "data": {
            "errorType": "lsp-unavailable",
            "hint": "建议改用 codegraph/goto_definition 或 codegraph/find_references 作为离线兜底",
        },
    }


@router.post("/definition")
async def goto_definition(req: LspPositionRequest) -> dict[str, Any]:
    """POST /api/v1/lsp/definition — 转到定义。"""
    _check_lsp_available()
    file_path = _resolve_file(req.file, req.workspacePath)
    client = LspClient.get(req.workspacePath)
    try:
        await client._ensure_started()
        locations = await client.goto_definition(file_path, req.line, req.column)
    except HTTPException:
        raise
    except Exception as e:
        return _lsp_unavailable_body(e)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "count": len(locations),
            "locations": [_format_location(loc, req.workspacePath) for loc in locations],
        },
    }


@router.post("/references")
async def find_references(req: LspReferencesRequest) -> dict[str, Any]:
    """POST /api/v1/lsp/references — 查找引用。"""
    _check_lsp_available()
    file_path = _resolve_file(req.file, req.workspacePath)
    client = LspClient.get(req.workspacePath)
    include_decl = req.includeDeclaration is not False
    try:
        await client._ensure_started()
        locations = await client.find_references(
            file_path, req.line, req.column, include_decl
        )
    except HTTPException:
        raise
    except Exception as e:
        return _lsp_unavailable_body(e)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "count": len(locations),
            "locations": [_format_location(loc, req.workspacePath) for loc in locations],
            "includeDeclaration": include_decl,
        },
    }


@router.post("/diagnostics")
async def get_diagnostics(req: LspFileRequest) -> dict[str, Any]:
    """POST /api/v1/lsp/diagnostics — 文件诊断。"""
    _check_lsp_available()
    file_path = _resolve_file(req.file, req.workspacePath)
    client = LspClient.get(req.workspacePath)
    try:
        await client._ensure_started()
        diagnostics = await client.get_diagnostics(file_path)
    except HTTPException:
        raise
    except Exception as e:
        return _lsp_unavailable_body(e)
    formatted = [_format_diagnostic(d) for d in diagnostics]
    errors = sum(1 for d in formatted if d["severity"] == "Error")
    warnings = sum(1 for d in formatted if d["severity"] == "Warning")
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "count": len(formatted),
            "errors": errors,
            "warnings": warnings,
            "diagnostics": formatted,
        },
    }


@router.post("/hover")
async def get_hover(req: LspPositionRequest) -> dict[str, Any]:
    """POST /api/v1/lsp/hover — 符号 hover 信息。"""
    _check_lsp_available()
    file_path = _resolve_file(req.file, req.workspacePath)
    client = LspClient.get(req.workspacePath)
    try:
        await client._ensure_started()
        hover = await client.hover(file_path, req.line, req.column)
    except HTTPException:
        raise
    except Exception as e:
        return _lsp_unavailable_body(e)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "hover": _format_hover(hover),
            "raw": hover,
        },
    }
