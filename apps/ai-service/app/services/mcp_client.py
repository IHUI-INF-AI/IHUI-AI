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
import urllib.parse
from dataclasses import dataclass, field
from typing import Any, cast

import httpx

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

# MCP 协议版本协商:客户端支持的版本列表(旧→新,仅握手可达的版本)。
# initialize 握手的 params.protocolVersion 只携带单个值,这里默认先发
# 兼容旧端点的 "2025-03-26",连接成功后依据服务器 result.protocolVersion
# 协商并记录最终版本(见 _negotiate_protocol)。
DEFAULT_PROTOCOL_VERSION = "2025-03-26"
SUPPORTED_PROTOCOL_VERSIONS: tuple[str, ...] = (
    "2024-11-05",
    "2025-03-26",
    "2025-06-18",
    "2025-11-25",
)


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

    @property
    def config(self) -> MCPClientConfig:
        return self._config

    def is_connected(self) -> bool:
        return self._connected

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
                    f"{token.token_type or 'Bearer'} {token.access_token}"
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

    async def call_external_tool(
        self, server_name: str, tool_name: str, args: dict[str, Any]
    ) -> dict[str, Any]:
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
