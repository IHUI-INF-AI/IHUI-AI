# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import contextlib
import json
import logging
import os
import shutil
from collections.abc import Callable
from pathlib import Path
from typing import Any, cast
from urllib.parse import urlparse
from urllib.request import pathname2url, url2pathname

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.command_streamer import (
    FRAME_READ_EOF,
    FRAME_READ_LINE,
    FRAME_READ_TOO_LARGE,
    PROTOCOL_FRAME_LIMIT_BYTES,
    read_protocol_frame,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lsp", tags=["lsp"])

LSP_BIN = "typescript-language-server"
LSP_INIT_TIMEOUT_S = 15.0
LSP_REQUEST_TIMEOUT_S = 10.0
DIAGNOSTICS_POLL_S = 0.1
DIAGNOSTICS_MAX_POLLS = 10
# 跳过超预算响应体时的分块大小(与 command_streamer 的残余回收同量级,
# 太小会把一次丢弃变成上万次 await)
_LSP_SKIP_CHUNK_BYTES = 64 * 1024
# b76-08b 票2:同一方法连续超时达到该次数 ⇒ 判连接不可信,owner 淘汰该 client。
# 阈值取 2:单次抖动不得升级成回收,连续两次超时才视为协议 event loop 已无响应。
_REQUEST_TIMEOUT_EVICT_AFTER = 2


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

    includeDeclaration: bool | None = Field(
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


def _normalize_locations(result: Any) -> list[dict[str, Any]]:
    """LSP Location | Location[] | LocationLink[] | null → 统一 list[{uri, range}]。"""
    if not result:
        return []
    items = result if isinstance(result, list) else [result]
    out: list[dict[str, Any]] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        if "targetUri" in it:  # LocationLink
            out.append({"uri": it["targetUri"], "range": it.get("targetRange")})
        elif "uri" in it:  # Location
            out.append({"uri": it["uri"], "range": it.get("range")})
    return out


def _format_location(loc: dict[str, Any], workspace_path: str) -> dict[str, Any]:
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


def _format_diagnostic(d: dict[str, Any]) -> dict[str, Any]:
    """对外暴露的 Diagnostic 结构(对齐 lsp.ts formatDiagnostic)。"""
    sev = d.get("severity")
    severity = {1: "Error", 2: "Warning", 3: "Info", 4: "Hint"}.get(sev, "Unknown") if isinstance(sev, int) else "Unknown"
    start = (d.get("range") or {}).get("start", {})
    return {
        "severity": severity,
        "line": start.get("line", 0) + 1,
        "column": start.get("character", 0) + 1,
        "source": d.get("source", ""),
        "code": d.get("code"),
        "message": d.get("message", ""),
    }


def _format_hover(hover: dict[str, Any] | None) -> str:
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

    _instances: dict[str, LspClient] = {}

    def __init__(self, workspace_path: str):
        self.workspace_path = workspace_path
        self.proc: asyncio.subprocess.Process | None = None
        self._next_id = 1
        self._responses: dict[int, asyncio.Future[Any]] = {}
        self._diagnostics: dict[str, list[dict[str, Any]]] = {}
        self._opened: set[str] = set()
        self._reader_task: asyncio.Task[None] | None = None
        self._init_lock = asyncio.Lock()
        self._initialized = False
        # 第三十三批:超限帧 / 超预算响应体的计数(丢弃不得静默)
        self._dropped_frames = 0
        # b76-08b 票1:帧解析失败 ⇒ 整条连接判死的幂等闩(对齐上游 fireClose)
        self._unusable = False
        # b76-08b 票2:单次请求超时 ⇒ 上抛"连接不可信"事件;连续超时达到阈值
        # 由 owner(单例表)淘汰该 client。观测档超时不在此列 —— lsp.py 没有
        # 观测型请求(diagnostics 走本地缓存轮询,不占协议请求窗口),故未引入
        # 请求类别分流。
        self.onRequestTimeout: Callable[[str, int, float], None] | None = None
        self._timeout_streak: dict[str, int] = {}

    @classmethod
    def get(cls, workspace_path: str) -> LspClient:
        """按 workspacePath 复用单例(对齐 cli getLspClient)。"""
        if workspace_path not in cls._instances:
            cls._instances[workspace_path] = cls(workspace_path)
        return cls._instances[workspace_path]

    @property
    def is_unusable(self) -> bool:
        """帧流是否已判死(desync 后字节边界不再可信,send 直接抛 transport is closed)。"""
        return self._unusable

    def _mark_unusable(self, reason: str) -> None:
        """帧解析失败 ⇒ 判整条连接关闭(幂等闩,对齐上游 fireClose({reason}))。

        流一旦 desync,后续每一帧的字节边界都不再可信,"跳过该消息"继续读
        会让上层拿到语义错位的消息(b76-08b 票1)。判死后:
        - 读环立即退出,不再分发任何后续帧;
        - 等待中的请求 future 全部立刻以 transport is closed 失败(不再干等超时);
        - 此后 _send 直接抛 RuntimeError,上层按 LSP 不可用处理。
        """
        if self._unusable:
            return
        self._unusable = True
        logger.warning("[lsp] 帧流 desync,判整条连接关闭(%s)", reason)
        for fut in list(self._responses.values()):
            if not fut.done():
                fut.set_exception(
                    RuntimeError(f"LSP transport is closed (protocol desync): {reason}")
                )
        self._responses.clear()
        proc = self.proc
        if proc is not None and proc.returncode is None:
            with contextlib.suppress(ProcessLookupError):
                proc.terminate()

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
                # 第三十三批:不声明 limit 时 stdout 的 StreamReader 用默认
                # 65536,而 _read_loop 是按行读头部、再按 Content-Length 读体
                # —— 头部一行超限(服务器把非协议内容写到 stdout 上很常见)
                # 会抛 LimitOverrunError,被末尾的 `except Exception` 吞成
                # "reader loop exit",此后所有 LSP 请求只会在 10s 后超时,
                # 而日志里读不到真因。
                limit=PROTOCOL_FRAME_LIMIT_BYTES,
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
        """读取 stdout,按 Content-Length 帧解析,分发响应 / 通知。

        第三十三批(病灶):原来两处读取都没有字节上限声明 ——
          1. 头部 `await self.proc.stdout.readline()` 一旦抛 LimitOverrunError,
             就被末尾的 `except Exception` 吞成一句 "[lsp] reader loop exit",
             此后该 workspace 的单例客户端再无人读帧,所有请求只会 10s 超时,
             而真因(stdout 上出现了一条超预算的超长行)任何地方都读不到;
          2. 响应体 `readexactly(content_length)` 完全不设上限,服务器(或被
             污染的插件)回一个巨大的 Content-Length 就能把整块读进内存。
        现在两类都在帧预算内分流,并且各自留计数与日志。
        """
        proc = self.proc
        stdout = proc.stdout if proc is not None else None
        if stdout is None:
            logger.warning("[lsp] reader loop 未启动:子进程 stdout 不可用")
            return
        try:
            while True:
                headers: dict[str, str] = {}
                while True:
                    frame = await read_protocol_frame(stdout)
                    if frame.kind == FRAME_READ_LINE:
                        line_str = frame.data.decode("utf-8", errors="replace").rstrip("\r\n")
                        if line_str == "":
                            break
                        if ":" in line_str:
                            k, v = line_str.split(":", 1)
                            headers[k.strip().lower()] = v.strip()
                        continue
                    if frame.kind == FRAME_READ_TOO_LARGE:
                        self._dropped_frames += 1
                        logger.warning(
                            "[lsp] stdout 头部出现超预算单行(>%d 字节,实读 %d 字节,"
                            "累计 %d 次)—— 多半是语言服务器把日志写进了协议通道。"
                            "该行的残余已读到行尾,但本条消息的 Content-Length 已无从"
                            "确定 ⇒ 帧边界无法复原,只能停读该客户端;原因不是"
                            "\"服务器掉了\",排查请从这条日志起",
                            PROTOCOL_FRAME_LIMIT_BYTES,
                            frame.dropped_bytes,
                            self._dropped_frames,
                        )
                        return
                    if frame.kind == FRAME_READ_EOF:
                        return  # 对端真的关了
                    return  # 未预期的 kind:按结束保守处理
                raw_len = headers.get("content-length", "0")
                try:
                    content_length = int(raw_len)
                except ValueError:
                    # b76-08b 票1:header 已失步,后续每一帧的字节边界都不再可信,
                    # "跳过该消息"继续读会让上层拿到语义错位的消息 ⇒ 判整条连接关闭
                    # (对齐上游 zcodeStdioTransport 的 protocol_parse_error ⇒ fireClose)。
                    self._mark_unusable(f"Content-Length 无法解析: {raw_len!r}")
                    return
                if content_length <= 0:
                    continue
                if content_length > PROTOCOL_FRAME_LIMIT_BYTES:
                    # 体超预算:**连接仍然可用**(长度已知,能整块跳过),
                    # 所以这里绝不 return —— 那会被上层误读成"服务器掉了"。
                    self._dropped_frames += 1
                    logger.warning(
                        "[lsp] 响应体 %d 字节超过帧预算 %d 字节(累计丢弃 %d 帧),"
                        "整条已跳过、连接保持",
                        content_length,
                        PROTOCOL_FRAME_LIMIT_BYTES,
                        self._dropped_frames,
                    )
                    if not await self._skip_body(stdout, content_length):
                        logger.warning("[lsp] 跳过超预算响应体时对端提前关闭,停读")
                        return
                    continue
                body = await stdout.readexactly(content_length)
                try:
                    msg = json.loads(body.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError) as e:
                    # b76-08b 票1:body 不是合法 JSON ⇒ 流已 desync,判整条连接关闭
                    self._mark_unusable(f"响应体 JSON 解析失败: {e}")
                    return
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
            # b76-08b 票1:读环非正常退出(如半截响应体上对端 EOF)同样意味着
            # 这条连接没人读了 ⇒ 一并判死,防止单例继续被复用、每个请求白等超时。
            self._mark_unusable(f"reader loop exit: {e}")
            logger.warning("[lsp] reader loop exit: %s", e)

    @staticmethod
    async def _skip_body(stdout: asyncio.StreamReader, nbytes: int) -> bool:
        """按块丢弃 nbytes 的超预算响应体,返回帧边界是否仍然对齐。

        为什么必须"读完再丢":不读完就把它们留在缓冲区里,下一条消息的头部
        就会从上一体的中间开始解析 —— 那是比丢一条消息严重得多的帧粘连。
        """
        remaining = nbytes
        while remaining > 0:
            chunk = await stdout.read(min(remaining, _LSP_SKIP_CHUNK_BYTES))
            if not chunk:
                return False
            remaining -= len(chunk)
        return True

    async def _send(self, payload: dict[str, Any]) -> None:
        if self._unusable:
            # b76-08b 票1:连接判死后 send 直接抛(对齐上游 transport is closed)
            raise RuntimeError("LSP transport is closed (protocol desync)")
        assert self.proc and self.proc.stdin
        body = json.dumps(payload).encode("utf-8")
        header = f"Content-Length: {len(body)}\r\n\r\n".encode("ascii")
        self.proc.stdin.write(header + body)
        await self.proc.stdin.drain()

    async def _request(self, method: str, params: dict[str, Any], timeout: float) -> Any:
        msg_id = self._next_id
        self._next_id += 1
        fut: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
        self._responses[msg_id] = fut
        await self._send(
            {"jsonrpc": "2.0", "id": msg_id, "method": method, "params": params}
        )
        try:
            result = await asyncio.wait_for(fut, timeout=timeout)
        except TimeoutError:
            self._responses.pop(msg_id, None)
            self._on_request_timeout(method, msg_id, timeout * 1000.0)
            raise RuntimeError(f"LSP request {method} 超时") from None
        # 成功即清零该方法的连续超时计数(单次抖动不得升级成回收)
        self._timeout_streak.pop(method, None)
        return result

    def _on_request_timeout(self, method: str, request_id: int, timeout_ms: float) -> None:
        """单次请求超时 ⇒ 上抛"连接不可信"事件;连续超时达阈值 ⇒ owner 淘汰。

        故障形态(b76-08b 票2,对齐上游 zcodeProtocolClient 的
        onRequestTimeout{method,requestId,timeoutMs} 语义):子进程仍活着但
        协议 event loop 已无响应时,只让单次 request 超时不够 —— 单例会被
        继续复用,后续请求连续卡在超时窗口。故除 reject 本次外,还 fire
        onRequestTimeout 给 owner,并在连续超时达到阈值时把该 client 从
        _instances 淘汰,下次请求重新 spawn 新 client。
        """
        streak = self._timeout_streak.get(method, 0) + 1
        self._timeout_streak[method] = streak
        if self.onRequestTimeout is not None:
            self.onRequestTimeout(method, request_id, timeout_ms)
        if streak >= _REQUEST_TIMEOUT_EVICT_AFTER:
            self._evict_for_timeout(method, streak)

    def _evict_for_timeout(self, method: str, streak: int) -> None:
        """连续超时 ⇒ owner 把该 client 从 _instances 淘汰,下次重新 spawn。"""
        if LspClient._instances.get(self.workspace_path) is self:
            LspClient._instances.pop(self.workspace_path, None)
        logger.warning(
            "[lsp] 请求连续超时判连接不可信,淘汰实例: method=%s 连续超时=%d"
            "(阈值=%d) workspace=%s ⇒ 已从单例表移除,下次请求重新 spawn 新 client",
            method,
            streak,
            _REQUEST_TIMEOUT_EVICT_AFTER,
            self.workspace_path,
        )
        # 连接已不可信:判死并终止子进程,在途请求立刻失败,不再等超时
        self._mark_unusable(f"请求连续超时 {streak} 次(method={method})")

    async def _notify(self, method: str, params: dict[str, Any]) -> None:
        await self._send({"jsonrpc": "2.0", "method": method, "params": params})

    async def _ensure_open(self, file_path: str) -> str:
        """首次访问该文件时发 textDocument/didOpen(对齐 cli ensureOpen)。"""
        uri = _to_uri(file_path)
        if uri in self._opened:
            return uri
        try:
            with open(file_path, encoding="utf-8") as f:
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

    async def goto_definition(self, file_path: str, line: int, col: int) -> list[dict[str, Any]]:
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
    ) -> list[dict[str, Any]]:
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

    async def get_diagnostics(self, file_path: str) -> list[dict[str, Any]]:
        uri = await self._ensure_open(file_path)
        # 轮询等 publishDiagnostics 通知到达(对齐 cli 轮询逻辑)
        for _ in range(DIAGNOSTICS_MAX_POLLS):
            if uri in self._diagnostics:
                return self._diagnostics[uri]
            await asyncio.sleep(DIAGNOSTICS_POLL_S)
        return self._diagnostics.get(uri, [])

    async def hover(self, file_path: str, line: int, col: int) -> dict[str, Any] | None:
        uri = await self._ensure_open(file_path)
        result = await self._request(
            "textDocument/hover",
            {
                "textDocument": {"uri": uri},
                "position": {"line": line - 1, "character": col - 1},
            },
            LSP_REQUEST_TIMEOUT_S,
        )
        return cast(dict[str, Any] | None, result)

    async def dispose(self) -> None:
        if self._reader_task:
            self._reader_task.cancel()
        if self.proc and self.proc.returncode is None:
            try:
                self.proc.terminate()
                await asyncio.wait_for(self.proc.wait(), timeout=2)
            except Exception:
                with contextlib.suppress(Exception):
                    self.proc.kill()
        self._initialized = False

    # P1 修复(LSP _instances 全局 dict + reader_task + 子进程全部泄漏):
    # 原代码仅在单实例 dispose 时清理,应用 shutdown 时 _instances 全局 dict 仍持有
    # 所有 LspClient 引用 → typescript-language-server 子进程 + reader_task 永不退出,
    # 形成 zombie 进程。shutdown_all 在 app lifespan 关闭时统一回收所有实例。
    @classmethod
    async def shutdown_all(cls) -> None:
        """关闭所有 LSP 子进程 + reader_task,防止僵尸进程泄漏。"""
        instances = list(cls._instances.values())
        cls._instances.clear()
        for client in instances:
            await client._shutdown()

    async def _shutdown(self) -> None:
        """关闭单个 LSP client 子进程 + reader_task(供 shutdown_all 调用)。"""
        if self._reader_task and not self._reader_task.done():
            self._reader_task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self._reader_task
        if self.proc:
            try:
                self.proc.terminate()
                await asyncio.wait_for(self.proc.wait(), timeout=2.0)
            except (TimeoutError, ProcessLookupError, Exception):
                with contextlib.suppress(ProcessLookupError):
                    self.proc.kill()
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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
