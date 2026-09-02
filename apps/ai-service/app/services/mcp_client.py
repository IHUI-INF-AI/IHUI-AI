# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP Client — 连接外部 MCP Server，发现并调用工具。

支持三种传输模式:
1. stdio: 子进程标准输入/输出传输
2. SSE: Server-Sent Events 传输
3. streamable_http: 新版 MCP Streamable HTTP 传输(单 POST / 单 GET SSE 流, 可选 OAuth)

设计:
- MCPClient 类管理单个外部 MCP Server 连接
- MCPClientManager 管理多个 MCP Client 实例
- 所有操作异步，超时控制
- 自动重连（指数退避）
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import urllib.parse

from dataclasses import dataclass, field
from typing import Any, cast

import httpx

from app.services.mcp_oauth import MCPOAuthClient, MCPOAuthConfig

logger = logging.getLogger(__name__)

# 传输模式
TRANSPORT_STDIO = "stdio"
TRANSPORT_SSE = "sse"
TRANSPORT_STREAMABLE_HTTP = "streamable_http"

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


@dataclass
class MCPClientConfig:
    """MCP Client 配置。"""
    name: str
    transport: str  # "stdio" | "sse" | "streamable_http"
    command: str = ""
    args: list[str] = field(default_factory=list)
    url: str = ""
    timeout: float = DEFAULT_TIMEOUT
    reconnect: bool = True
    max_reconnect_attempts: int = 3
    env: dict[str, str] = field(default_factory=dict)
    # 附加 HTTP 头(streamable_http 时并入;自定义 Bearer 可直接在此给)
    headers: dict[str, str] = field(default_factory=dict)
    # 可选 OAuth 配置(streamable_http 时, connect 前先获取/刷新 token)
    oauth: MCPOAuthConfig | None = None


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
        # streamable_http 相关
        self._http_client: httpx.AsyncClient | None = None
        self._oauth_client: MCPOAuthClient | None = None
        self._http_mode = ""  # "stream"(SSE 流) | "post"(单 POST 无状态)
        self._http_headers: dict[str, str] = {}
        self._stream_task: asyncio.Task[None] | None = None

    @property
    def config(self) -> MCPClientConfig:
        return self._config

    def is_connected(self) -> bool:
        return self._connected

    async def connect(self) -> None:
        """连接外部 MCP Server。"""
        if self._connected:
            return
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

    async def disconnect(self) -> None:
        """断开连接，清理资源。"""
        self._connected = False
        # 停止 GET SSE 流与 OAuth 连接(streamable_http)
        if self._stream_task is not None:
            self._stream_task.cancel()
            self._stream_task = None
        if self._oauth_client is not None:
            try:
                await self._oauth_client.close()
            except Exception:
                pass
            self._oauth_client = None
        if self._http_client is not None:
            try:
                await self._http_client.aclose()
            except Exception:
                pass
            self._http_client = None
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
            elif self._config.transport == TRANSPORT_STREAMABLE_HTTP:
                await self._http_post_message(data)
            result = await asyncio.wait_for(fut, timeout=timeout or self._config.timeout)
            return result
        except asyncio.TimeoutError:
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
                await self._http_post_message(data)
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
            self._process = await asyncio.create_subprocess_exec(
                self._config.command,
                *self._config.args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=proc_env,
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
        reader = self._reader
        if reader is None:
            return
        try:
            while self._connected:
                line = await asyncio.wait_for(
                    reader.readline(), timeout=self._config.timeout * 2,
                )
                if not line:
                    break
                raw = line.decode("utf-8", errors="replace").strip()
                if raw:
                    self._handle_message(raw)
        except asyncio.TimeoutError:
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
        """读取子进程 stderr 并以 debug 级别记录。"""
        try:
            while True:
                line = await stderr.readline()
                if not line:
                    break
                text = line.decode("utf-8", errors="replace").strip()
                if text:
                    logger.debug("MCP subprocess stderr: %s", text)
        except Exception:
            pass

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
            remaining = header_bytes.split(b"\r\n\r\n", 1)[1] if b"\r\n\r\n" in header_bytes else b""
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
        except asyncio.TimeoutError:
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
    # Streamable HTTP 传输(新版 MCP;单 POST / 单 GET SSE 流, 可选 OAuth)
    # =========================================================================

    async def _http_connect(self) -> bool:
        """建立 Streamable HTTP 连接。

        流程:
        1. (可选)OAuth:先获取/刷新 token 并生成 Authorization 头
        2. POST JSON-RPC initialize(带 protocolVersion/clientInfo/capabilities)
        3. 依据响应 Content-Type 自动探测传输模式:
           - `text/event-stream` → stream 模式(SSE 流,GET 长连接 + POST 下发)
           - `application/json`  → post 模式(无状态,每次 POST 返回单个 JSON-RPC 响应)
        4. 处理 `Mcp-Session-Id` 响应头(存下并在后续请求回传)
        """
        if not self._config.url:
            logger.error("streamable_http 模式缺少 url")
            return False
        try:
            self._http_client = httpx.AsyncClient(timeout=self._config.timeout)
            base_headers: dict[str, str] = dict(self._config.headers)
            # OAuth:先保证拿到有效 token 再注入 Authorization
            if self._config.oauth is not None:
                self._oauth_client = MCPOAuthClient(self._config.oauth)
                try:
                    token = await self._oauth_client.get_token()
                    base_headers["Authorization"] = f"Bearer {token.access_token}"
                except Exception as e:
                    logger.error("OAuth 获取 token 失败(%s): %s", self._config.name, e)
                    self._connected = False
                    return False
            self._http_headers = base_headers
            # 先占位为已连接,以便复用 _send_request 完成 initialize
            self._connected = True
            self._reconnect_attempts = 0
            init_msg = {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "ihui-ai-mcp-client", "version": "0.0.1"},
            }
            init_resp = await self._send_request("initialize", init_msg)
            error = init_resp.get("error")
            if error is not None or "result" not in init_resp:
                self._connected = False
                logger.error(
                    "initialize 失败(%s): %s",
                    self._config.name,
                    error.get("message", "未知错误") if isinstance(error, dict) else error,
                )
                return False
            # 依据 initialize POST 的响应类型决定是否启动 GET SSE 流
            if self._http_mode == "stream":
                self._stream_task = asyncio.create_task(self._http_stream_loop())
            logger.info("streamable_http 握手成功(%s): 模式=%s", self._config.name, self._http_mode)
            return True
        except Exception as e:
            logger.error("streamable_http 连接失败(%s): %s", self._config.url, e)
            self._connected = False
            return False

    async def _http_post_message(self, data: str) -> None:
        """通过 POST 发送一条 JSON-RPC 消息。

        核心自动探测:
        - 响应 Content-Type 若为 `text/event-stream` → stream 模式,把 SSE 内容喂给缓冲区
          (响应经 GET 流或 SSE POST 体回到 _handle_message 并 resolve 对应的 future)
        - 否则视为"单 POST 无状态"响应 → 直接把单个 JSON-RPC 响应交给 _handle_message
        """
        if self._http_client is None:
            raise ConnectionError("streamable_http 未初始化 HTTP 客户端")
        headers = dict(self._http_headers)
        headers["Content-Type"] = "application/json"
        headers["Accept"] = "application/json, text/event-stream"
        if self._session_id:
            headers["Mcp-Session-Id"] = self._session_id
        resp = await self._http_client.post(
            self._config.url, headers=headers, content=data
        )
        # 处理响应中的 Mcp-Session-Id(握手时可能下发)
        sid = resp.headers.get("Mcp-Session-Id")
        if sid:
            self._session_id = sid
        ctype = resp.headers.get("Content-Type", "") or ""
        if "text/event-stream" in ctype:
            self._http_mode = "stream"
            if resp.content:
                self._sse_feed_data(resp.content)
        else:
            body = resp.content.strip()
            if body:
                self._http_mode = "post"
                self._handle_message(body.decode("utf-8", errors="replace"))
            # 202/空体(stream 模式典型的 POST 确认):响应经由 GET 流到达

    async def _http_stream_loop(self) -> None:
        """单 GET SSE 流读取循环(stream 模式)。

        用于接收 server 推送的消息/通知;结束或异常只记录状态,不强断连接——
        单 POST 模式下的请求/响应仍由 POST 直接完成,故 EOF 不触发强制重连。
        """
        if self._http_client is None:
            return
        headers = dict(self._http_headers)
        headers["Accept"] = "text/event-stream"
        if self._session_id:
            headers["Mcp-Session-Id"] = self._session_id
        try:
            async with self._http_client.stream(
                "GET", self._config.url, headers=headers
            ) as resp:
                async for chunk in resp.aiter_bytes():
                    if not self._connected:
                        break
                    self._sse_feed_data(chunk)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error("HTTP GET 流异常(%s): %s", self._config.name, e)
        logger.debug("HTTP GET SSE 流已结束(%s)", self._config.name)

    # =========================================================================
    # 重连
    # =========================================================================

    async def _reconnect(self) -> None:
        """指数退避重连。"""
        if self._reconnect_attempts >= self._config.max_reconnect_attempts:
            logger.warning("重连已达上限(%d),放弃: %s", self._config.max_reconnect_attempts, self._config.name)
            return
        self._reconnect_attempts += 1
        delay = min(
            DEFAULT_RECONNECT_DELAY * (2 ** (self._reconnect_attempts - 1)),
            MAX_RECONNECT_DELAY,
        )
        logger.info("重连 %s (第 %d 次, %.1fs 后)...", self._config.name, self._reconnect_attempts, delay)
        await asyncio.sleep(delay)
        try:
            await self.connect()
        except Exception as e:
            logger.error("重连失败(%s): %s", self._config.name, e)


class MCPClientManager:
    """管理多个 MCP Client 实例。"""

    def __init__(self) -> None:
        self._clients: dict[str, MCPClient] = {}

    def register(self, config: MCPClientConfig) -> str:
        """注册一个外部 MCP Server 配置。"""
        name = config.name
        if name in self._clients:
            logger.warning("MCP Client 已存在，覆盖: %s", name)
        self._clients[name] = MCPClient(config)
        logger.info("MCP Client 已注册: %s[%s]", name, config.transport)
        return name

    def unregister(self, name: str) -> None:
        """注销并断开指定 Client。"""
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
        client = self._clients.pop(name, None)
        if client is not None:
            try:
                await client.disconnect()
            except Exception as e:
                logger.warning("注销 %s 时断开失败: %s", name, e)
            logger.info("MCP Client 已注销: %s", name)

    def list_registered(self) -> list[dict[str, Any]]:
        """列出所有已注册 Server 的摘要信息(含连接状态,不含 env 等敏感字段)。"""
        servers: list[dict[str, Any]] = []
        for client in self._clients.values():
            cfg = client.config
            servers.append({
                "name": cfg.name,
                "transport": cfg.transport,
                "command": cfg.command,
                "args": list(cfg.args),
                "url": cfg.url,
                "timeout": cfg.timeout,
                "reconnect": cfg.reconnect,
                "max_reconnect_attempts": cfg.max_reconnect_attempts,
                "connected": client.is_connected(),
            })
        return servers

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

    async def list_available_tools_async(self) -> list[MCPClientTool]:
        """异步列出所有已连接 Client 的工具。"""
        tools: list[MCPClientTool] = []
        for client in self._clients.values():
            if client.is_connected():
                try:
                    client_tools = await client.list_tools()
                    tools.extend(client_tools)
                except Exception as e:
                    logger.warning("获取 %s 工具列表失败: %s", client.config.name, e)
        return tools

    async def call_external_tool(self, server_name: str, tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
        """调用指定 Server 的工具。"""
        client = self._clients.get(server_name)
        if client is None:
            return {"ok": False, "error": f"未知 MCP Server: {server_name}"}
        if not client.is_connected():
            return {"ok": False, "error": f"MCP Server 未连接: {server_name}"}
        return cast(dict[str, Any], await client.call_tool(tool_name, args))


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
