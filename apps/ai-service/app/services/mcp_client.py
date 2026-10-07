# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP Client — 连接外部 MCP Server，发现并调用工具。

支持三种传输模式:
1. stdio: 子进程标准输入/输出传输
2. SSE: Server-Sent Events 传输
3. streamable-http: MCP Streamable HTTP(JSON-RPC over HTTP + SSE)

设计:
- MCPClient 类管理单个外部 MCP Server 连接
- MCPClientManager 管理多个 MCP Client 实例
- 所有操作异步，超时控制
- 自动重连（指数退避）
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import time
import urllib.parse
from collections.abc import Callable
from contextvars import ContextVar, Token
from dataclasses import dataclass, field
from typing import Any, cast

import httpx

from app.core.exec_env import resolve_stdio_command
from app.core.tunables import DEFAULT_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS
from app.services import mcp_quality, mcp_status
from app.services.command_streamer import (
    FRAME_READ_LINE,
    FRAME_READ_TOO_LARGE,
    PROTOCOL_FRAME_LIMIT_BYTES,
    read_protocol_frame,
)
from app.services.mcp_oauth import MCPOAuthClient, MCPOAuthConfig

logger = logging.getLogger(__name__)

# 传输模式
TRANSPORT_STDIO = "stdio"
TRANSPORT_SSE = "sse"
TRANSPORT_STREAMABLE_HTTP = "streamable-http"

# 默认超时
DEFAULT_TIMEOUT = 30.0
DEFAULT_RECONNECT_DELAY = 1.0
MAX_RECONNECT_DELAY = 30.0


@dataclass
class MCPClientTool:
    """外部 MCP Server 的工具定义。"""
    name: str
    description: str
    input_schema: dict[str, Any]
    server_name: str = ""
    # 批 39 接线:MCP 工具注解原样透传(tools/list 返回的 annotations 对象,
    # 含 readOnlyHint/destructiveHint/openWorldHint;None = server 未提供)。
    # 语义判定交给 app/core/mcp_tool_approval(批 31 移植的 Codex 保守内核)。
    annotations: dict[str, Any] | None = None


@dataclass
class MCPClientConfig:
    """MCP Client 配置。"""
    name: str
    transport: str  # "stdio" | "sse" | "streamable-http"
    command: str = ""
    args: list[str] = field(default_factory=list)
    url: str = ""
    timeout: float = DEFAULT_TIMEOUT
    reconnect: bool = True
    max_reconnect_attempts: int = 3
    env: dict[str, str] = field(default_factory=dict)
    # streamable-http 可选的 OAuth 配置(或已实例化的 MCPOAuthClient)
    oauth: MCPOAuthConfig | MCPOAuthClient | None = None
    # streamable-http initialize 握手打招呼携带的协议版本(默认旧兼容版;
    # 可覆盖为更高版本以协商到更新协议)
    protocol_version: str = DEFAULT_PROTOCOL_VERSION


def _canonical_auth_scheme(token_type: str | None) -> str:
    """规范化 OAuth auth scheme 为标准大小写 Bearer。

    RFC 7235 定义 scheme 大小写不敏感,但 Linear MCP 等真实资源服务器严格
    匹配标准形态 —— 上游返回小写 "bearer" 时原样透传会 401 invalid_token
    (2026-09-07 真网实测)。非 bearer scheme 原样保留。
    """
    scheme = (token_type or "Bearer").strip() or "Bearer"
    if scheme.lower() == "bearer":
        return "Bearer"
    return scheme


class MCPClient:
    """管理单个外部 MCP Server 连接。"""

    def __init__(self, config: MCPClientConfig) -> None:
        self._config = config
        self._process: asyncio.subprocess.Process | None = None
        self._reader: asyncio.StreamReader | None = None
        self._writer: asyncio.StreamWriter | None = None
        self._connected = False
        self._request_id = 0
        self._pending: dict[int, asyncio.Future[dict[str, Any]]] = {}
        self._read_task: asyncio.Task[None] | None = None
        self._reconnect_attempts = 0
        self._sse_buffer = b""
        self._session_id = ""
        # 超限帧计数(第三十三批):丢弃必须留计数,不得静默变短。
        self._dropped_frames = 0
        self._dropped_frame_bytes = 0
        # streamable-http 状态
        self._http_headers: dict[str, str] = {}
        self._http_mode = "post"
        self._http_client: httpx.AsyncClient | None = None
        self._http_sse_task: asyncio.Task[None] | None = None
        self._oauth_client: MCPOAuthClient | None = None
        self._oauth_client_owned = False
        # 协议版本协商 + 服务器能力/身份探测结果(connect 成功后填充)
        self._negotiated_protocol = ""
        self._server_info: dict[str, Any] = {}
        self._capabilities: dict[str, Any] = {}
        # D154(2026-09-30 立)连接状态观察者:由 `MCPClientManager.register` 在注册时挂上
        # —— 只有 manager 知道这台 server 的**注册者**是谁(主体来自注册事实,不来自发帧方)。
        # 默认 None ⇒ 没有观察者时本类行为与改动前逐字相同。
        self._on_status: Callable[[str, dict[str, Any]], None] | None = None

    def set_status_hook(self, hook: Callable[[str, dict[str, Any]], None] | None) -> None:
        """挂/摘状态观察者(生产面唯一入口是 `MCPClientManager.register`)。"""
        self._on_status = hook

    def _emit_status(self, state: str, **extra: Any) -> None:
        """把一次连接状态变更交给观察者。

        观察者任何异常都**不得**穿透:MCP 连不上已经够糟了,不能再因为"提示发不出去"
        把连接流程本身弄炸(那会把票要修的"看不出来"升级成"连不上还崩")。
        异常一律 warn(§5e「失败必须响」),不改控制流。
        """
        hook = self._on_status
        if hook is None:
            return
        try:
            hook(state, extra)
        except Exception as e:
            logger.warning("MCP %s 状态观察者异常(%s %s): %s", self._config.name, state, extra, e)

    @property
    def config(self) -> MCPClientConfig:
        return self._config

    def is_connected(self) -> bool:
        return self._connected

    def dropped_frames(self) -> int:
        """因**单帧超过帧预算**而被丢弃的帧数(第三十三批新增)。

        这是"这个 MCP 连不上"与"这个 MCP 结果太大"的分界线:超限帧不重连,
        只计数 + 写日志。排查时先看这里,而不是只看 is_connected()。
        """
        return self._dropped_frames

    def negotiated_protocol(self) -> str:
        """connect 后与服务器协商确定的 MCP 协议版本(未连接为空串)。"""
        return self._negotiated_protocol

    def server_info(self) -> dict[str, Any]:
        """服务器在 initialize result 返回的 serverInfo({name, version, ...})。"""
        return self._server_info

    def capabilities(self) -> dict[str, Any]:
        """服务器在 initialize result 返回的 capabilities(tools/prompts/resources/...)。"""
        return self._capabilities

    async def connect(self) -> None:
        """连接外部 MCP Server。"""
        if self._connected:
            return
        # D154:三条出口都要有帧 —— connecting / connected / failed。
        # 整段包一层 try 是为了"抛异常的那一型也得上屏":原先异常直接冒到调用方,
        # 端上看到的表现是"某个工具调用失败了",而真实原因是这台 server 根本连不上。
        self._emit_status("connecting")
        try:
            if self._config.transport == TRANSPORT_STDIO:
                ok = await self._stdio_connect()
            elif self._config.transport == TRANSPORT_SSE:
                ok = await self._sse_connect()
            elif self._config.transport == TRANSPORT_STREAMABLE_HTTP:
                ok = await self._http_connect()
            else:
                logger.error("未知传输模式: %s", self._config.transport)
                ok = False
            if ok:
                await self._send_notification("notifications/initialized")
                logger.info("MCP Client 已连接: %s[%s]", self._config.name, self._config.transport)
                self._emit_status("connected")
            else:
                self._emit_status("failed", reason=f"{self._config.transport} 连接未建立")
        except Exception as e:
            self._emit_status("failed", reason=f"{type(e).__name__}: {e}")
            raise

    async def disconnect(self) -> None:
        """断开连接，清理资源。"""
        self._connected = False
        # streamable-http 资源:SSE 流 + HTTP 客户端 + 自建 OAuth 客户端
        if self._http_sse_task is not None:
            self._http_sse_task.cancel()
            try:
                await self._http_sse_task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass
            self._http_sse_task = None
        if self._http_client is not None:
            with contextlib.suppress(Exception):
                await self._http_client.aclose()
            self._http_client = None
        if self._oauth_client is not None and self._oauth_client_owned:
            with contextlib.suppress(Exception):
                await self._oauth_client.close()
            self._oauth_client = None
        if self._read_task is not None:
            self._read_task.cancel()
            self._read_task = None
        if self._writer is not None:
            try:
                self._writer.close()
                if hasattr(self._writer, "wait_closed"):
                    await self._writer.wait_closed()
            except Exception:
                pass
            self._writer = None
        if self._process is not None:
            try:
                self._process.terminate()
                await asyncio.wait_for(self._process.wait(), timeout=5.0)
            except Exception:
                try:
                    self._process.kill()
                    await asyncio.wait_for(self._process.wait(), timeout=2.0)
                except Exception:
                    pass
            self._process = None
        self._reader = None
        # 拒绝所有挂起的请求
        for fut in self._pending.values():
            if not fut.done():
                fut.set_exception(ConnectionError("连接已断开"))
        self._pending.clear()

    async def ping(self) -> bool:
        """健康检查。"""
        try:
            resp = await self._send_request("ping", timeout=10.0)
            return resp.get("result") is not None
        except Exception:
            return False

    async def list_tools(self) -> list[MCPClientTool]:
        """发现工具列表。"""
        resp = await self._send_request("tools/list")
        if "result" in resp and isinstance(resp["result"], dict):
            tools_raw = resp["result"].get("tools", [])
            return [
                MCPClientTool(
                    name=t["name"],
                    description=t.get("description", ""),
                    input_schema=t.get("inputSchema", t.get("input_schema", {})),
                    server_name=self._config.name,
                    annotations=t.get("annotations"),
                )
                for t in tools_raw
            ]
        error = resp.get("error", {})
        logger.error("list_tools 失败: %s", error.get("message", "未知错误"))
        return []

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        """调用工具。"""
        resp = await self._send_request("tools/call", {"name": name, "arguments": arguments})
        if "result" in resp:
            return resp["result"]
        error = resp.get("error", {})
        return {
            "ok": False,
            "error": error.get("message", "未知错误"),
            "code": error.get("code"),
        }

    # =========================================================================
    # 内部方法
    # =========================================================================

    def _next_id(self) -> int:
        self._request_id += 1
        return self._request_id

    async def _send_request(
        self, method: str, params: dict[str, Any] | None = None, timeout: float | None = None,
    ) -> dict[str, Any]:
        if not self._connected:
            return {"error": {"code": -32000, "message": "未连接"}}
        req_id = self._next_id()
        msg: dict[str, Any] = {"jsonrpc": "2.0", "id": req_id, "method": method}
        if params is not None:
            msg["params"] = params
        if self._config.transport == TRANSPORT_STREAMABLE_HTTP:
            # streamable-http:响应随 HTTP 调用同步返回,不走内部 pending 队列
            try:
                result = await asyncio.wait_for(
                    self._http_send(msg), timeout=timeout or self._config.timeout,
                )
                return result
            except TimeoutError:
                logger.error("请求超时(%.1fs): %s", timeout or self._config.timeout, method)
                return {"error": {"code": -32001, "message": f"请求超时({method})"}}
            except Exception as e:
                logger.error("请求异常: %s", e)
                return {"error": {"code": -32002, "message": str(e)}}
        loop = asyncio.get_running_loop()
        fut: asyncio.Future[dict[str, Any]] = loop.create_future()
        self._pending[req_id] = fut
        try:
            data = json.dumps(msg, ensure_ascii=False)
            if self._config.transport == TRANSPORT_STDIO and self._writer is not None:
                self._writer.write((data + "\n").encode("utf-8"))
                await self._writer.drain()
            elif self._config.transport == TRANSPORT_SSE:
                await self._sse_post_message(data)
            result = await asyncio.wait_for(fut, timeout=timeout or self._config.timeout)
            return result
        except TimeoutError:
            logger.error("请求超时(%.1fs): %s", timeout or self._config.timeout, method)
            self._pending.pop(req_id, None)
            return {"error": {"code": -32001, "message": f"请求超时({method})"}}
        except Exception as e:
            self._pending.pop(req_id, None)
            logger.error("请求异常: %s", e)
            return {"error": {"code": -32002, "message": str(e)}}
        finally:
            self._pending.pop(req_id, None)

    async def _send_notification(self, method: str, params: dict[str, Any] | None = None) -> None:
        msg: dict[str, Any] = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            msg["params"] = params
        try:
            data = json.dumps(msg, ensure_ascii=False)
            if self._config.transport == TRANSPORT_STDIO and self._writer is not None:
                self._writer.write((data + "\n").encode("utf-8"))
                await self._writer.drain()
            elif self._config.transport == TRANSPORT_SSE:
                await self._sse_post_message(data)
            elif self._config.transport == TRANSPORT_STREAMABLE_HTTP:
                if self._http_client is not None:
                    await self._http_send(msg)
        except Exception as e:
            logger.warning("发送通知失败: %s", e)

    def _handle_message(self, raw: str) -> None:
        """处理收到的 JSON-RPC 消息。"""
        raw = raw.strip()
        if not raw:
            return
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("收到无效 JSON: %s", raw[:200])
            return
        # 处理响应(id 匹配)
        if isinstance(msg, dict) and "id" in msg:
            req_id = msg["id"]
            fut = self._pending.pop(req_id, None)
            if fut is not None and not fut.done():
                fut.set_result(msg)
            else:
                logger.debug("收到未知请求 ID 的响应: %s", req_id)
        # 处理通知(无 id)
        elif isinstance(msg, dict) and "method" in msg:
            logger.debug("收到通知: %s", msg.get("method"))

    # =========================================================================
    # stdio 传输
    # =========================================================================

    async def _stdio_connect(self) -> bool:
        if not self._config.command:
            logger.error("stdio 模式缺少 command")
            return False
        try:
            proc_env = dict(os.environ)
            proc_env.update(self._config.env)
            # G-998139(拍板:要):stdio 命令显式候选序解析 + 找不到大声喊 ——
            # 不拿裸名直接 spawn 冒充"已解析"。上游同型事故:服务由非交互 shell 启动,
            # PATH 只剩系统目录 ⇒ spawn("npx") 找不到 Homebrew/NVM 里的入口,只剩一句
            # FileNotFoundError;解析器找不到时带回完整"试过候选"列表,报错可定位。
            resolution = resolve_stdio_command(self._config.command, proc_env)
            if not resolution.ok:
                logger.error(
                    "stdio 连接失败:命令解析不到(%s),试过候选:%s",
                    self._config.command,
                    ", ".join(resolution.tried) or "(无候选)",
                )
                self._connected = False
                return False
            self._process = await asyncio.create_subprocess_exec(
                resolution.resolved,
                *self._config.args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=proc_env,
                # 第三十三批(病灶):此处不声明 limit 时,stdout/stderr 的
                # StreamReader 用 asyncio 默认 65536。MCP 的 tools/call 结果是
                # **一行 JSON**,内含 base64 图档时单帧可达数 MB,于是
                # _stdio_read_loop 的 readline() 必抛 LimitOverrunError ——
                # 而它被 `except Exception` 兜住后走 finally 触发重连,表现成
                # "这个 MCP 永远连不上"。预算依据见 command_streamer 顶部。
                limit=PROTOCOL_FRAME_LIMIT_BYTES,
            )
            # 类型安全: create_subprocess_exec 返回 Process,stdout 是 StreamReader
            self._reader = self._process.stdout
            self._writer = self._process.stdin
            self._connected = True
            self._reconnect_attempts = 0
            self._read_task = asyncio.create_task(self._stdio_read_loop())
            # 启动 stderr 日志读取(不阻塞)
            if self._process.stderr is not None:
                asyncio.create_task(self._stderr_reader(self._process.stderr))
            return True
        except Exception as e:
            logger.error("stdio 连接失败(%s): %s", self._config.command, e)
            self._connected = False
            return False

    async def _stdio_read_loop(self) -> None:
        """读 stdout 的 JSONL 帧并分发。

        第三十三批改写:原先的 `await reader.readline()` 把三类结局压成两类 ——
        正常行 / 其余一切走 `except Exception`(含帧超限),而 except 之后必然
        落到 finally 里的"断线 + 重连"。于是对端只要**恒定**吐一条超预算的行,
        本进程就无限重连,现象写成"这个 MCP 永远连不上",真因(结果太大)
        在任何一行日志里都读不到。现在三类显式分开:
          - FRAME_READ_LINE      → 交 _handle_message(原行为)
          - FRAME_READ_TOO_LARGE → 计数 + warning,**不**断开、**不**重连,
                                   残余已读到行尾 ⇒ 下一帧照常解析
          - FRAME_READ_EOF       → 才是对端真的关了,走原有 reconnect 语义
        """
        reader = self._reader
        if reader is None:
            return
        try:
            while self._connected:
                frame = await asyncio.wait_for(
                    read_protocol_frame(reader),
                    timeout=self._config.timeout * 2,
                )
                if frame.kind == FRAME_READ_LINE:
                    raw = frame.data.decode("utf-8", errors="replace").strip()
                    if raw:
                        self._handle_message(raw)
                    continue
                if frame.kind == FRAME_READ_TOO_LARGE:
                    self._dropped_frames += 1
                    self._dropped_frame_bytes += frame.dropped_bytes
                    logger.warning(
                        "MCP %s 单帧超过帧预算 %d 字节(实读 %d 字节,累计丢弃 %d 帧),"
                        "该帧已丢弃、连接保持 —— 这不是断线,不要按重连排查",
                        self._config.name,
                        PROTOCOL_FRAME_LIMIT_BYTES,
                        frame.dropped_bytes,
                        self._dropped_frames,
                    )
                    if not frame.resynced:
                        # 残余没能对齐行尾:再读下去只会拿到半行。如实按失步
                        # 断开,但原因写清是"超限失步",不是"对端关闭"。
                        logger.warning(
                            "MCP %s 超限帧残余未能对齐行尾,主动断开以防帧粘连",
                            self._config.name,
                        )
                        break
                    continue
                # FRAME_READ_EOF(或未预期的 kind)才是"连接结束"
                break
        except TimeoutError:
            logger.warning("stdio 读取超时(%s)", self._config.name)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("stdio 读取异常(%s): %s", self._config.name, e)
        finally:
            was_connected = self._connected
            self._connected = False
            if was_connected and self._config.reconnect:
                asyncio.create_task(self._reconnect())

    @staticmethod
    async def _stderr_reader(stderr: asyncio.StreamReader) -> None:
        """读取子进程 stderr 并以 debug 级别记录。

        非协议流:这里**不需要**区分三类结局,但同样不能因为一条超长行就炸掉
        采集循环(原实现 `except Exception: pass` 会静默停止整个 stderr 采集,
        之后该子进程的所有诊断输出都消失得无声无息)。超限 ⇒ 标注截断、继续读。
        """
        try:
            while True:
                frame = await read_protocol_frame(stderr)
                if frame.kind == FRAME_READ_LINE:
                    text = frame.data.decode("utf-8", errors="replace").strip()
                    if text:
                        logger.debug("MCP subprocess stderr: %s", text)
                    continue
                if frame.kind == FRAME_READ_TOO_LARGE:
                    logger.warning(
                        "MCP subprocess stderr 单行超 %d 字节已截断(丢弃 %d 字节)",
                        PROTOCOL_FRAME_LIMIT_BYTES, frame.dropped_bytes,
                    )
                    if not frame.resynced:
                        break
                    continue
                break
        except Exception as e:  # 不静默:采集停止是可观察事件
            logger.debug("MCP subprocess stderr 采集结束: %s", e)

    # =========================================================================
    # SSE 传输
    # =========================================================================

    async def _sse_connect(self) -> bool:
        if not self._config.url:
            logger.error("SSE 模式缺少 url")
            return False
        parsed = urllib.parse.urlparse(self._config.url)
        host = parsed.hostname or "localhost"
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        path = parsed.path or "/sse"
        use_ssl = parsed.scheme == "https"
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port, ssl=use_ssl),
                timeout=self._config.timeout,
            )
            request = (
                f"GET {path} HTTP/1.1\r\n"
                f"Host: {host}:{port}\r\n"
                f"Accept: text/event-stream\r\n"
                f"Cache-Control: no-cache\r\n"
                f"\r\n"
            )
            writer.write(request.encode("utf-8"))
            await writer.drain()
            # 读取 HTTP 响应头
            header_bytes = b""
            while b"\r\n\r\n" not in header_bytes:
                chunk = await asyncio.wait_for(reader.read(4096), timeout=self._config.timeout)
                if not chunk:
                    raise ConnectionError("SSE 连接被关闭")
                header_bytes += chunk
            header_text = header_bytes.split(b"\r\n\r\n")[0].decode("utf-8", errors="replace")
            status_line = header_text.split("\r\n")[0] if header_text else ""
            if "200" not in status_line and "201" not in status_line:
                raise ConnectionError(f"SSE 连接失败: {status_line}")
            self._reader = reader
            self._writer = writer
            self._connected = True
            self._reconnect_attempts = 0
            # 处理响应头中已附带的数据
            remaining = (
                header_bytes.split(b"\r\n\r\n", 1)[1]
                if b"\r\n\r\n" in header_bytes
                else b""
            )
            if remaining:
                self._sse_feed_data(remaining)
            self._read_task = asyncio.create_task(self._sse_read_loop())
            return True
        except Exception as e:
            logger.error("SSE 连接失败(%s): %s", self._config.url, e)
            self._connected = False
            return False

    async def _sse_read_loop(self) -> None:
        reader = self._reader
        if reader is None:
            return
        try:
            while self._connected:
                chunk = await asyncio.wait_for(
                    reader.read(4096), timeout=self._config.timeout * 2,
                )
                if not chunk:
                    break
                self._sse_feed_data(chunk)
        except TimeoutError:
            logger.warning("SSE 读取超时(%s)", self._config.name)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("SSE 读取异常(%s): %s", self._config.name, e)
        finally:
            was_connected = self._connected
            self._connected = False
            if was_connected and self._config.reconnect:
                asyncio.create_task(self._reconnect())

    def _sse_feed_data(self, data: bytes) -> None:
        """解析 SSE 数据块。"""
        self._sse_buffer += data
        while b"\n\n" in self._sse_buffer:
            event_bytes, self._sse_buffer = self._sse_buffer.split(b"\n\n", 1)
            self._sse_parse_event(event_bytes)

    def _sse_parse_event(self, event_bytes: bytes) -> None:
        """解析单个 SSE 事件。"""
        event_type = "message"
        data_lines: list[str] = []
        for line in event_bytes.decode("utf-8", errors="replace").split("\n"):
            line = line.strip()
            if line.startswith("event:"):
                event_type = line[6:].strip()
            elif line.startswith("data:"):
                data_lines.append(line[5:].strip())
            elif line.startswith("id:"):
                self._session_id = line[3:].strip()
        if event_type == "endpoint" and data_lines:
            # endpoint 事件包含 POST URL
            self._sse_post_url = data_lines[0]
            logger.info("SSE 收到 endpoint: %s", self._sse_post_url)
        if data_lines and event_type != "endpoint":
            data_str = "\n".join(data_lines)
            self._handle_message(data_str)

    async def _sse_post_message(self, data: str) -> None:
        """通过 SSE 传输发送消息(POST 到 messages 端点)。"""
        if self._sse_post_url:
            post_url = self._sse_post_url
        else:
            # 默认拼接到相同 base URL
            parsed = urllib.parse.urlparse(self._config.url)
            base = f"{parsed.scheme}://{parsed.netloc}"
            post_url = f"{base}/messages/"
        parsed = urllib.parse.urlparse(post_url)
        host = parsed.hostname or "localhost"
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        post_path = parsed.path or "/messages/"
        if parsed.query:
            post_path += f"?{parsed.query}"
        elif self._session_id:
            post_path += f"?sessionId={self._session_id}"
        use_ssl = parsed.scheme == "https"
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port, ssl=use_ssl),
                timeout=self._config.timeout,
            )
            body = data.encode("utf-8")
            request = (
                f"POST {post_path} HTTP/1.1\r\n"
                f"Host: {host}:{port}\r\n"
                f"Content-Type: application/json\r\n"
                f"Content-Length: {len(body)}\r\n"
                f"\r\n"
            )
            writer.write(request.encode("utf-8") + body)
            await writer.drain()
            # 消费响应(不关心内容)
            response = b""
            while b"\r\n\r\n" not in response:
                chunk = await asyncio.wait_for(reader.read(4096), timeout=self._config.timeout)
                if not chunk:
                    break
                response += chunk
            writer.close()
            await writer.wait_closed()
        except Exception as e:
            logger.error("SSE POST 失败: %s", e)
            raise

    # =========================================================================
    # Streamable HTTP 传输(JSON-RPC over HTTP + SSE)
    # =========================================================================

    @staticmethod
    def _compare_protocol_versions(a: str, b: str) -> int:
        """按 YYYY-MM-DD 语义比较两个协议版本;无法解析的串按\"最旧\"处理。"""
        def key(v: str) -> tuple[int, int, int]:
            parts = v.strip().split("-")
            if len(parts) == 3 and all(p.isdigit() for p in parts):
                return (int(parts[0]), int(parts[1]), int(parts[2]))
            return (-1, -1, -1)

        a_key = key(a)
        b_key = key(b)
        if a_key < b_key:
            return -1
        if a_key > b_key:
            return 1
        return 0

    def _negotiate_protocol(self, offered: str, server_version: str | None) -> str:
        """依据服务器 initialize result 回告的 protocolVersion 确定最终协商版本。

        规则(确保不静默错发/静默降级,均有明确日志):
        - server_version 为空或等于 offered:直接采用 offered;
        - server_version 在客户端已知受支持列表中(无论新旧):采纳服务器版本;
        - server_version 比本地最高支持版本更新(未知新协议):客户端无法执行该
          版本,保持本地最高支持版本,并 warning 记录服务器想要的版本;
        - 其余(无法解析/未知旧值):warning 并降级回退到 offered。
        """
        if not server_version or server_version == offered:
            return offered
        if server_version in SUPPORTED_PROTOCOL_VERSIONS:
            logger.info("MCP 协议协商成功: 使用服务器版本 %s", server_version)
            return server_version
        latest = SUPPORTED_PROTOCOL_VERSIONS[-1]
        if self._compare_protocol_versions(server_version, latest) > 0:
            logger.warning(
                "MCP 服务器要求未知新版协议 %s,客户端无法执行;保持在本地最高支持版本 %s",
                server_version, latest,
            )
            return latest
        logger.warning(
            "MCP 服务器回告未知协议版本 %s,已降级回退到 %s", server_version, offered,
        )
        return offered

    async def _http_connect(self) -> bool:
        """连接 streamable-http MCP Server。

        1. 若有 OAuth 配置,先取 token 并注入 Bearer 头
        2. POST initialize 握手,从响应头解析 Mcp-Session-Id,并据 content-type 判定模式
           (application/json -> post;text/event-stream -> stream)
        3. stream 模式下额外拉起 GET SSE 长连接(保持连接/keepalive)
        """
        if not self._config.url:
            logger.error("streamable-http 模式缺少 url")
            return False
        self._http_client = httpx.AsyncClient(timeout=httpx.Timeout(self._config.timeout))
        headers: dict[str, str] = {"Accept": "application/json, text/event-stream"}
        # OAuth:连接前先取 token,注入 Authorization: Bearer <token>
        self._oauth_client_owned = False
        self._oauth_client = None
        oauth = self._config.oauth
        if oauth is not None:
            if isinstance(oauth, MCPOAuthConfig):
                self._oauth_client = MCPOAuthClient(oauth)
                self._oauth_client_owned = True
            else:
                self._oauth_client = oauth  # 外部传入的 MCPOAuthClient 实例
            try:
                token = await self._oauth_client.get_token()
                headers["Authorization"] = (
                    f"{_canonical_auth_scheme(token.token_type)} {token.access_token}"
                )
            except Exception as e:  # noqa: BLE001 - OAuth 失败则无鉴权头继续
                logger.error("OAuth 获取 token 失败(%s): %s", self._config.name, e)
                headers.pop("Authorization", None)
        self._http_headers = headers
        try:
            offered = self._config.protocol_version or DEFAULT_PROTOCOL_VERSION
            init_msg: dict[str, Any] = {
                "jsonrpc": "2.0",
                "id": self._next_id(),
                "method": "initialize",
                "params": {
                    "protocolVersion": offered,
                    "capabilities": {},
                    "clientInfo": {"name": "ihui-ai", "version": "1.0.0"},
                },
            }
            resp = await self._http_send(init_msg)
            result = resp.get("result")
            if result is None:
                raise ConnectionError(f"initialize 失败: {resp.get('error', resp)}")
            # 协议版本协商 + 服务器能力/身份探测
            self._negotiated_protocol = self._negotiate_protocol(
                offered, result.get("protocolVersion")
            )
            self._server_info = result.get("serverInfo") or {}
            self._capabilities = result.get("capabilities") or {}
            self._connected = True
            self._reconnect_attempts = 0
            if self._http_mode == "stream":
                self._http_sse_task = asyncio.create_task(self._http_sse_loop())
            return True
        except Exception as e:
            logger.error("streamable-http 连接失败(%s): %s", self._config.url, e)
            if self._http_client is not None:
                with contextlib.suppress(Exception):
                    await self._http_client.aclose()
                self._http_client = None
            self._connected = False
            return False

    async def _http_send(
        self, msg: dict[str, Any], *, timeout: float | None = None,
    ) -> dict[str, Any]:
        """发送 JSON-RPC(POST);据 content-type 判定 post/stream 模式。"""
        if self._http_client is None:
            return {"error": {"code": -32002, "message": "HTTP 客户端未就绪"}}
        headers = dict(self._http_headers)
        headers["Content-Type"] = "application/json"
        if self._session_id:
            headers["Mcp-Session-Id"] = self._session_id
        try:
            resp = await self._http_client.post(
                self._config.url,
                headers=headers,
                json=msg,
                timeout=httpx.Timeout(timeout or self._config.timeout),
            )
        except Exception as e:
            logger.error("streamable-http 请求失败: %s", e)
            return {"error": {"code": -32002, "message": str(e)}}
        sid = resp.headers.get("Mcp-Session-Id")
        if sid:
            self._session_id = sid
        ctype = resp.headers.get("Content-Type", "").lower()
        if "text/event-stream" in ctype:
            self._http_mode = "stream"
            return self._parse_sse_response(resp)
        self._http_mode = "post"
        try:
            data = resp.json()
        except Exception:  # noqa: BLE001
            return {"error": {"code": -32005, "message": "HTTP 响应非 JSON"}}
        if not isinstance(data, dict):
            return {"error": {"code": -32005, "message": "HTTP 响应非法"}}
        return data

    @staticmethod
    def _parse_sse_response(resp: httpx.Response) -> dict[str, Any]:
        """从 SSE 响应体解析 JSON-RPC 消息(兼容 event: message / data: {...} 格式)。"""
        data_lines: list[str] = []
        for line in resp.text.splitlines():
            line = line.strip()
            if line.startswith("data:"):
                data_lines.append(line[5:].strip())
        data_str = "\n".join(data_lines).strip()
        if not data_str:
            return {"error": {"code": -32002, "message": "SSE 响应无 data"}}
        try:
            data = json.loads(data_str)
        except json.JSONDecodeError:
            logger.warning("SSE data 非 JSON: %s", data_str[:200])
            return {"error": {"code": -32002, "message": "SSE data 非 JSON"}}
        if not isinstance(data, dict):
            return {"error": {"code": -32002, "message": "SSE data 非对象"}}
        return data

    async def _http_sse_loop(self) -> None:
        """stream 模式:维持 GET SSE 长连接(keepalive 等),响应随 POST 返回,此处仅维持。"""
        if self._http_client is None:
            return
        stream_headers = dict(self._http_headers)
        if self._session_id:
            stream_headers["Mcp-Session-Id"] = self._session_id
        try:
            timeout = httpx.Timeout(self._config.timeout * 2, connect=self._config.timeout)
            async with self._http_client.stream(
                "GET", self._config.url, headers=stream_headers, timeout=timeout,
            ) as resp:
                ctype = resp.headers.get("Content-Type", "").lower()
                if "text/event-stream" not in ctype:
                    return
                self._http_mode = "stream"
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if line.startswith(":"):
                        continue  # keepalive 注释行
                    if line.startswith("data:"):
                        self._handle_message(line[5:].strip())
        except asyncio.CancelledError:
            pass
        except Exception as e:  # noqa: BLE001 - 流中断属正常,记录后静默退出
            logger.debug("streamable-http GET SSE 流结束(%s): %s", self._config.name, e)

    # =========================================================================
    # 重连
    # =========================================================================

    async def _reconnect(self) -> None:
        """指数退避重连。"""
        if self._reconnect_attempts >= self._config.max_reconnect_attempts:
            logger.warning(
                "重连已达上限(%d),放弃: %s",
                self._config.max_reconnect_attempts,
                self._config.name,
            )
            # D154:放弃的那一格才是用户要看到的"连不上"。此前它只进服务端日志,
            # 端上的表现是"某个工具调用失败了"—— 修复方向因此被指错(去查工具,而不是去查连接)。
            self._emit_status("failed", reason=f"重连已达上限({self._config.max_reconnect_attempts})")
            return
        self._reconnect_attempts += 1
        delay = min(
            DEFAULT_RECONNECT_DELAY * (2 ** (self._reconnect_attempts - 1)),
            MAX_RECONNECT_DELAY,
        )
        logger.info(
            "重连 %s (第 %d 次, %.1fs 后)...",
            self._config.name,
            self._reconnect_attempts,
            delay,
        )
        # attempt/maxAttempts 成对(票第 3 栏的形状;词表 `chat.mcp.state.reconnecting`
        # 要两格 —— 只发分子会渲染成"第 2/ 次重连",半句话比不发帧更糟)。
        self._emit_status(
            "reconnecting",
            attempt=self._reconnect_attempts,
            max_attempts=self._config.max_reconnect_attempts,
        )
        await asyncio.sleep(delay)
        try:
            await self.connect()
        except Exception as e:
            logger.error("重连失败(%s): %s", self._config.name, e)


# ---------------------------------------------------------------------------
# 无参回调的"当前连接主体"作用域(G-371 格①,机主 2026-09-29 拍"隔离")
# ---------------------------------------------------------------------------
#
# 为什么要有这一格而不是给回调加形参:`AgentEngine` 的 `tool_lister` 契约是**无参**回调,而
# 它挂在模块级单例 `ENGINE` 上(不是每连接一个实例),没有形参通道;改签名要动
# `agent_engine.py`。但工具清单**必须**按主体收窄 —— 按空主体取等于"谁都只看得到部署级",
# 那会把用户自己注册的外部 server 从他的会话里静默抹掉(过度收窄同样是行为变更,而且是
# 机主明确不要的那一种)。
#
# 语义与 `network_guard._current_policy` / `mcp_server._terminal_stream_ctx` 同形:**承载层**
# 在派生任务前把已验证的主体放进上下文,回调读它;读不到 ⇒ 空串 ⇒ 只看得到部署级
# (fail-closed)。这里的值只可能来自 `_bind_principal` 写入的 `params.userId` —— 那一个已被
# 令牌主体覆盖过客户端自述值,所以是宿主事实,不是请求体里谁都能写的字段。
_mcp_principal_scope: ContextVar[str] = ContextVar("ihui_mcp_principal", default="")


def bind_mcp_principal(user_id: str) -> Token[str]:
    """绑定当前作用域的连接主体,返回 token(必须交回 `reset_mcp_principal`)。"""
    return _mcp_principal_scope.set(user_id or "")


def reset_mcp_principal(token: Token[str]) -> None:
    """恢复上一层作用域。"""
    _mcp_principal_scope.reset(token)


def current_mcp_principal() -> str:
    """当前作用域的主体;未绑定 ⇒ 空串(= 只看得到部署级),不是"没有限制"。"""
    return _mcp_principal_scope.get()


class MCPClientManager:
    """管理多个 MCP Client 实例。"""

    def __init__(self) -> None:
        self._clients: dict[str, MCPClient] = {}
        # 注册者身份(name -> user_id;"" = 部署级,由 main.py 启动时注入)
        self._owners: dict[str, str] = {}

    def register(self, config: MCPClientConfig, *, owner_user_id: str = "") -> str:
        """注册一个外部 MCP Server 配置,并盖章注册者。

        `owner_user_id=""` 是**部署级**(启动时由 main.py 注入):它对任何已登录主体
        都可见,但**谁都注销不了**(否则一个成员就能摘掉平台配的 server)。
        用户自己注册的必须带身份 —— 端点侧的属主来自 `require_request_user_id`,
        不接受请求体自报(AGENTS §5"认证不等于授权")。
        名字仍是全站共享命名空间:跨用户同名会被 409 挡下而不是覆盖别人的配置,
        代价是"这个名字存在"可被探测(见 routers/mcp.py 的登记注释)。
        """
        name = config.name
        if name in self._clients:
            logger.warning("MCP Client 已存在，覆盖: %s", name)
        self._owners[name] = owner_user_id
        client = MCPClient(config)
        # D154(2026-09-30 立)连接状态下行:钩子只能挂在这里 —— **收信人取自注册事实**
        # (`owner_user_id`,由端点侧 `require_request_user_id` 盖章),连接自己不知道也不该知道
        # "该通知谁";把主体交给发帧方 = §5「认证不等于授权」那条禁令。
        # 部署级(owner 为空串)照挂:`report_mcp_status` 按"无主体"拒发并计数,
        # 不在这里开第二条分支 —— 分支一多,"谁收到了这一帧"就没人说得清了。
        owner = owner_user_id

        def _hook(state: str, extra: dict[str, Any]) -> None:
            # 返回值刻意丢掉:观察者只负责"把这一帧发出去",派发成功与否都不改注册流程
            mcp_status.report_mcp_status(owner, name, state, **extra)

        client.set_status_hook(_hook)
        self._clients[name] = client
        logger.info("MCP Client 已注册: %s[%s]", name, config.transport)
        return name

    def owner_of(self, name: str) -> str | None:
        """该 server 的注册者;"" 表示部署级;未注册返回 None。"""
        if name not in self._clients:
            return None
        return self._owners.get(name, "")

    def can_mutate(self, name: str, caller_user_id: str) -> bool:
        """当前主体能否注销/改连这台 server —— **唯一一份判据**,端点不得各写一遍。"""
        owner = self.owner_of(name)
        return owner is not None and owner != "" and owner == caller_user_id

    def is_visible(self, name: str, caller_user_id: str) -> bool:
        """当前主体**看得见**这台 server 吗 —— 读侧的唯一判据(与 `can_mutate` 同住本类)。

        可见集 = 自己注册的 + 部署级(owner 为空串,由 `main.py` 启动期按配置播种的共享
        基础设施)。未注册的 name 一律不可见 ⇒ 调用方拿到的形态与"没这条"相同,
        端点不会变成存在性预言机。**不得在端点里再抄一份 `owner_of(...) in ("", uid)`** ——
        两处算同一件事必漂移(本仓记过多次)。
        """
        owner = self.owner_of(name)
        return owner is not None and (owner == "" or owner == caller_user_id)

    def unregister(self, name: str) -> None:
        """注销并断开指定 Client。"""
        self._owners.pop(name, None)
        client = self._clients.pop(name, None)
        if client is not None:
            try:
                asyncio.get_running_loop()
                asyncio.create_task(client.disconnect())
            except RuntimeError:
                # 无运行中的事件循环(同步上下文),不触发 disconnect
                pass
            logger.info("MCP Client 已注销: %s", name)

    async def unregister_async(self, name: str) -> None:
        """注销并等待断开完成(异步上下文,如 HTTP 端点)。"""
        self._owners.pop(name, None)
        client = self._clients.pop(name, None)
        if client is not None:
            try:
                await client.disconnect()
            except Exception as e:
                logger.warning("注销 %s 时断开失败: %s", name, e)
            logger.info("MCP Client 已注销: %s", name)

    def client_status(self, name: str) -> dict[str, Any] | None:
        """返回单个已注册 Client 的完整摘要(含协商能力/协议/身份),不存在返回 None。

        增量字段(2026-09-03 立,可观测闭环:上层/前端可展示某个 MCP Server
        实际协商到的协议版本与能力,不含 env 等敏感字段):
        - negotiatedProtocol: connect 后与服务器协商确定的 MCP 协议版本(未连接为空串)
        - serverInfo: initialize result 回告的服务器身份 {name, version, ...}
        - capabilities: initialize result 回告的能力声明(tools/prompts/resources/...)
        """
        client = self._clients.get(name)
        if client is None:
            return None
        cfg = client.config
        return {
            "name": cfg.name,
            "transport": cfg.transport,
            "command": cfg.command,
            "args": list(cfg.args),
            "url": cfg.url,
            "timeout": cfg.timeout,
            "reconnect": cfg.reconnect,
            "max_reconnect_attempts": cfg.max_reconnect_attempts,
            "connected": client.is_connected(),
            "negotiatedProtocol": client.negotiated_protocol(),
            "serverInfo": client.server_info(),
            "capabilities": client.capabilities(),
        }

    def list_registered(self, caller_user_id: str) -> list[dict[str, Any]]:
        """列出该主体**看得见**的 Server 摘要(含连接状态,不含 env 等敏感字段)。

        可见集 = 自己注册的 + 部署级(owner 为空串)的。别人的用户级 server 不列 ——
        这才是 `connectors:read` 敢被放开的唯一前提;属主判据与 `can_mutate` 同住在
        本类,端点侧不得再抄一份(两处算同一件事必漂移)。
        """
        return [
            status
            for name in self._clients
            if self.is_visible(name, caller_user_id)
            and (status := self.client_status(name)) is not None
        ]

    def client_status_visible(
        self, name: str, caller_user_id: str
    ) -> dict[str, Any] | None:
        """按主体取单台 Server 摘要;**看不见就返回 None**。

        返回 None(而不是抛 403)是刻意的:详情端点与"这台不存在"必须是同一模板(只差调用方自己提交的那段名字,
        否则它变成存在性预言机 —— 清单端点已经收窄,再让详情端点区分"有但不是你的",
        等于把清单省掉的泄露从另一头放回来。
        """
        if not self.is_visible(name, caller_user_id):
            return None
        return self.client_status(name)

    async def connect_all(self) -> None:
        """连接所有已注册的 Server。"""
        tasks = [client.connect() for client in self._clients.values()]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def disconnect_all(self) -> None:
        """断开所有连接。"""
        tasks = [client.disconnect() for client in self._clients.values()]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self._clients.clear()

    def get_client(self, name: str) -> MCPClient | None:
        """获取指定 Client。"""
        return self._clients.get(name)

    def list_available_tools(self) -> list[MCPClientTool]:
        """列出所有可用的外部工具。"""
        tools: list[MCPClientTool] = []
        for client in self._clients.values():
            if client.is_connected():
                # list_tools 是异步的，这里只返回已缓存的工具
                pass
        return tools

    async def list_available_tools_async(self, caller_user_id: str) -> list[MCPClientTool]:
        """异步列出该主体**看得见**的已连接 Client 的工具(自己的 + 部署级)。

        与 `list_registered` 共用 `is_visible` 这一份判据:工具清单不能比 server 清单更宽,
        否则"看不见那台 server"只是修辞 —— 工具名/描述/input_schema 本身就是配置内容。
        """
        return await self._collect_tools(
            [
                client
                for name, client in self._clients.items()
                if self.is_visible(name, caller_user_id)
            ]
        )

    async def _collect_tools(self, clients: list[MCPClient]) -> list[MCPClientTool]:
        """枚举给定 client 集合的工具(遍历面由调用方决定 —— 只有一处传"可见集")。"""
        tools: list[MCPClientTool] = []
        for client in clients:
            if client.is_connected():
                try:
                    client_tools = await client.list_tools()
                    tools.extend(client_tools)
                except Exception as e:
                    logger.warning("获取 %s 工具列表失败: %s", client.config.name, e)
        return tools

    async def call_external_tool(
        self, server_name: str, tool_name: str, args: dict[str, Any], *, caller_user_id: str
    ) -> dict[str, Any]:
        """按主体调用外部工具:看不见那台 server ⇒ 返回与"没这台 server"同模板的结果(名字回显来自请求,不构成泄露)。

        刻意不回 403:调用外部工具是**用别人的配置往出站发进程/请求**,而"这条 id 是真的"
        本身就是要保护的信息。错误文本走未知 server 那同一个字符串出口,
        端点侧也就无从把两者区分成不同状态码。
        """
        if not self.is_visible(server_name, caller_user_id):
            return {"ok": False, "error": f"未知 MCP Server: {server_name}"}
        return await self._call_tool(server_name, tool_name, args)

    async def _call_tool(
        self, server_name: str, tool_name: str, args: dict[str, Any]
    ) -> dict[str, Any]:
        """调用指定 Server 的工具(2026-09-12 起附带质量指标采集,1-4)。"""
        client = self._clients.get(server_name)
        if client is None:
            return {"ok": False, "error": f"未知 MCP Server: {server_name}"}
        if not client.is_connected():
            return {"ok": False, "error": f"MCP Server 未连接: {server_name}"}
        start = time.perf_counter()
        result = cast(dict[str, Any], await client.call_tool(tool_name, args))
        # 出站调用无 input_schema 缓存,schema_valid 默认 True(仅采集延迟/成败)
        mcp_quality.record_tool_call(
            server_name,
            tool_name,
            time.perf_counter() - start,
            success=bool(result.get("ok")) if isinstance(result, dict) else True,
        )
        return result


# =========================================================================
# 模块级单例(进程内共享,仿照 services/memory.py / hook_engine.py 模式)
# =========================================================================

_mcp_client_manager: MCPClientManager | None = None


def get_mcp_client_manager() -> MCPClientManager:
    """返回进程级 MCPClientManager 单例(懒加载)。"""
    global _mcp_client_manager
    if _mcp_client_manager is None:
        _mcp_client_manager = MCPClientManager()
    return _mcp_client_manager
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
