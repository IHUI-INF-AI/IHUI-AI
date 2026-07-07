"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC; 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取, 支持 ${VAR})
- oauth : OAuth 2.0 授权码流程 (简化版, 支持静态/缓存 token)

配置文件支持 ${VAR} 环境变量展开 (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 零额外依赖即可运行; stdio 走子进程。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from pathlib import Path
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPServerStatus,
    MCPTool,
)


# ---------------------------------------------------------------------------
# 环境变量展开 (对标 Claude Code 的 ${VAR} 展开)
# ---------------------------------------------------------------------------

_ENV_VAR_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")


def expand_env(value: Any) -> Any:
    """递归展开字符串中的 ${VAR} 环境变量 (对标 Claude Code)。

    未定义的变量展开为空字符串。仅处理 str / dict / list 结构。
    """
    if isinstance(value, str):
        return _ENV_VAR_RE.sub(lambda m: os.environ.get(m.group(1), ""), value)
    if isinstance(value, dict):
        return {k: expand_env(v) for k, v in value.items()}
    if isinstance(value, list):
        return [expand_env(v) for v in value]
    return value


def _expand_config(config: MCPServerConfig) -> MCPServerConfig:
    """对 MCPServerConfig 中所有字符串字段做 ${VAR} 展开, 返回新实例。"""
    data = expand_env(config.model_dump())
    return MCPServerConfig(**data)


# ---------------------------------------------------------------------------
# OAuth 2.0 简化版 (对标 Codex OAuth)
# ---------------------------------------------------------------------------

def make_oauth_manager(config: MCPServerConfig) -> Any | None:
    """根据 config.auth.oauth 创建 OAuthTokenManager (无 oauth 配置返回 None)。"""
    if not config.auth or config.auth.type != "oauth" or not config.auth.oauth:
        return None
    return OAuthTokenManager(config.auth.oauth)


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in and self._access_token:
            self._expires_at = time.time() + float(expires_in)

    def is_expired(self) -> bool:
        return bool(self._expires_at) and time.time() >= self._expires_at

    def build_auth_url(self, state: str = "ihui-oauth-state") -> str:
        """构造 OAuth 授权 URL (用户浏览器跳转)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": getattr(self.cfg, "client_id", ""),
            "redirect_uri": getattr(self.cfg, "redirect_uri", ""),
            "scope": " ".join(getattr(self.cfg, "scopes", []) or []),
            "state": state,
        }
        return f"{getattr(self.cfg, 'auth_url', '')}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 access_token。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(getattr(self.cfg, "token_url", ""), data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": getattr(self.cfg, "client_id", ""),
                    "client_secret": getattr(self.cfg, "client_secret", ""),
                    "redirect_uri": getattr(self.cfg, "redirect_uri", ""),
                })
                if resp.status_code == 200:
                    tok = resp.json()
                    self._access_token = tok.get("access_token")
                    self._refresh_token = tok.get("refresh_token", self._refresh_token)
                    if "expires_in" in tok:
                        self._expires_at = time.time() + float(tok["expires_in"])
                    return self._access_token
        except Exception as e:
            logger.error(f"OAuth exchange_code 异常: {e}")
        return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token。"""
        if not self._refresh_token:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(getattr(self.cfg, "token_url", ""), data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": getattr(self.cfg, "client_id", ""),
                    "client_secret": getattr(self.cfg, "client_secret", ""),
                })
                if resp.status_code == 200:
                    tok = resp.json()
                    self._access_token = tok.get("access_token", self._access_token)
                    self._refresh_token = tok.get("refresh_token", self._refresh_token)
                    if "expires_in" in tok:
                        self._expires_at = time.time() + float(tok["expires_in"])
                    return self._access_token
        except Exception as e:
            logger.error(f"OAuth refresh 异常: {e}")
        return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / api_key 构造 HTTP 认证 headers。

    优先级: auth.type=bearer > auth.type=oauth > api_key
    """
    headers: dict[str, str] = {}
    if config.auth:
        if config.auth.type == "bearer" and config.auth.token:
            headers["Authorization"] = f"Bearer {config.auth.token}"
        elif config.auth.type == "oauth" and config.auth.oauth:
            tok = config.auth.oauth.access_token
            if tok:
                ttype = config.auth.oauth.token_type or "Bearer"
                headers["Authorization"] = f"{ttype} {tok}"
    if config.api_key and "Authorization" not in headers:
        headers["Authorization"] = f"Bearer {config.api_key}"
    if config.headers:
        headers.update(config.headers)
    return headers


# ---------------------------------------------------------------------------
# MCP stdio 客户端 (JSON-RPC 2.0 over stdio)
# ---------------------------------------------------------------------------

class MCPStdioClient:
    """MCP stdio 客户端 — 通过子进程与 MCP server 通信。"""

    def __init__(self, config: MCPServerConfig):
        self.config = _expand_config(config)
        self.process: asyncio.subprocess.Process | None = None
        self._request_id = 0

    async def connect(self) -> bool:
        if not self.config.command:
            return False
        try:
            self.process = await asyncio.create_subprocess_exec(
                self.config.command,
                *self.config.args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**dict(os.environ), **self.config.env},
            )
            result = await self._request("initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "ihui-agent", "version": "1.0.0"},
            })
            if result:
                await self._notify("notifications/initialized", {})
                return True
            return False
        except Exception as e:
            logger.error(f"MCP stdio 连接失败 ({self.config.name}): {e}")
            return False

    async def list_tools(self) -> list[MCPTool]:
        result = await self._request("tools/list", {})
        return _parse_tools(result, self.config.name)

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> str:
        result = await self._request("tools/call", {"name": name, "arguments": arguments})
        if not result:
            return "MCP 工具调用失败"
        parts: list[str] = []
        for block in result.get("content", []):
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "\n".join(parts) or str(result)

    async def list_resources(self) -> list[dict[str, Any]]:
        result = await self._request("resources/list", {})
        return result.get("resources", []) if result else []

    async def read_resource(self, uri: str) -> str:
        result = await self._request("resources/read", {"uri": uri})
        if not result:
            return ""
        parts: list[str] = []
        for block in result.get("contents", []):
            if isinstance(block, dict) and block.get("text"):
                parts.append(block["text"])
        return "\n".join(parts)

    async def list_prompts(self) -> list[dict[str, Any]]:
        result = await self._request("prompts/list", {})
        return result.get("prompts", []) if result else []

    async def get_prompt(self, name: str, arguments: dict[str, Any] | None = None) -> str:
        result = await self._request("prompts/get", {"name": name, "arguments": arguments or {}})
        if not result:
            return ""
        parts: list[str] = []
        for msg in result.get("messages", []):
            content = msg.get("content", {})
            if isinstance(content, dict) and content.get("type") == "text":
                parts.append(content.get("text", ""))
        return "\n".join(parts)

    async def close(self) -> None:
        if self.process:
            self.process.terminate()
            try:
                await self.process.wait()
            except Exception:
                pass
            self.process = None

    async def _request(self, method: str, params: dict[str, Any]) -> dict[str, Any] | None:
        if not self.process or not self.process.stdin or not self.process.stdout:
            return None
        self._request_id += 1
        expected_id = self._request_id
        req = {
            "jsonrpc": "2.0",
            "id": expected_id,
            "method": method,
            "params": params,
        }
        try:
            data = json.dumps(req) + "\n"
            self.process.stdin.write(data.encode())
            await self.process.stdin.drain()
        except Exception as e:
            logger.error(f"MCP stdio write 失败: {e}")
            return None

        for _ in range(100):
            try:
                line = await self.process.stdout.readline()
            except Exception:
                return None
            if not line:
                return None
            try:
                msg = json.loads(line.decode())
            except json.JSONDecodeError:
                continue
            if "id" not in msg:
                continue
            if msg["id"] != expected_id:
                continue
            if "error" in msg:
                logger.error(f"MCP stdio 请求 {method} 错误: {msg['error']}")
                return None
            return msg.get("result")
        return None

    async def _notify(self, method: str, params: dict[str, Any]) -> None:
        if not self.process or not self.process.stdin:
            return
        req = {"jsonrpc": "2.0", "method": method, "params": params}
        try:
            self.process.stdin.write((json.dumps(req) + "\n").encode())
            await self.process.stdin.drain()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# MCP Streamable HTTP 客户端 (单端点 POST JSON-RPC, 响应 JSON 或 SSE)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输 — 单端点 POST JSON-RPC。

    对标 MCP 2025-03-26 Streamable HTTP 规范:
    - POST JSON-RPC 到单一端点
    - 响应可为 application/json 或 text/event-stream
    - 通过 Mcp-Session-Id header 维持会话
    """

    def __init__(self, config: MCPServerConfig):
        self.config = _expand_config(config)
        self._url = config.url or ""
        self._oauth = make_oauth_manager(config)
        self._session_id: str | None = None
        self._request_id = 0
        self._initialized = False
        self._client: Any = None

    def _build_headers(self) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "User-Agent": "IHUI-MCP/1.0",
        }
        headers.update(build_auth_headers(self.config))
        if self._session_id:
            headers["Mcp-Session-Id"] = self._session_id
        return headers

    async def _ensure_client(self) -> Any:
        if self._client is None:
            import httpx
            self._client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))
        return self._client

    async def connect(self) -> bool:
        if not self._url:
            logger.error(f"MCP HTTP 连接失败 ({self.config.name}): 缺少 url")
            return False
        try:
            if self._oauth:
                tok = await self._oauth.get_token()
                if tok and not self.config.headers.get("Authorization"):
                    self.config.headers["Authorization"] = f"Bearer {tok}"
            result = await self._request("initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "IHUI-Agent", "version": "1.0"},
            })
            if result:
                await self._notify("notifications/initialized", {})
                self._initialized = True
                return True
        except Exception as e:
            logger.error(f"MCP HTTP 连接失败 ({self.config.name}): {e}")
        return False

    async def list_tools(self) -> list[MCPTool]:
        result = await self._request("tools/list", {})
        return _parse_tools(result, self.config.name)

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> str:
        result = await self._request("tools/call", {"name": name, "arguments": arguments})
        if not result:
            return "(无结果)"
        contents = result.get("content", [])
        parts: list[str] = []
        for c in contents:
            if isinstance(c, dict):
                if c.get("type") == "text":
                    parts.append(c.get("text", ""))
                else:
                    parts.append(json.dumps(c, ensure_ascii=False))
            else:
                parts.append(str(c))
        return "\n".join(parts) if parts else "(无输出)"

    async def list_resources(self) -> list[dict[str, Any]]:
        result = await self._request("resources/list", {})
        return result.get("resources", []) if result else []

    async def read_resource(self, uri: str) -> str:
        result = await self._request("resources/read", {"uri": uri})
        if not result:
            return "(无内容)"
        contents = result.get("contents", [])
        return "\n".join(c.get("text", "") for c in contents if isinstance(c, dict))

    async def close(self) -> None:
        if self._client:
            try:
                await self._client.aclose()
            except Exception:
                pass
            self._client = None
        self._initialized = False

    async def _request(self, method: str, params: dict[str, Any]) -> dict[str, Any] | None:
        try:
            import httpx

            client = await self._ensure_client()
            self._request_id += 1
            payload = {
                "jsonrpc": "2.0",
                "id": self._request_id,
                "method": method,
                "params": params,
            }
            resp = await client.post(self._url, json=payload, headers=self._build_headers())
            if resp.status_code == 401 and self._oauth and self._oauth.is_expired():
                tok = await self._oauth.refresh()
                if tok:
                    self.config.headers["Authorization"] = f"Bearer {tok}"
                    resp = await client.post(self._url, json=payload, headers=self._build_headers())
            if resp.status_code not in (200, 201):
                logger.error(f"MCP HTTP 请求失败 ({method}): {resp.status_code}")
                return None
            sid = resp.headers.get("Mcp-Session-Id") or resp.headers.get("mcp-session-id")
            if sid:
                self._session_id = sid
            content_type = resp.headers.get("content-type", "")
            if "text/event-stream" in content_type:
                return _parse_sse_response(resp.text, self._request_id)
            msg = resp.json()
            if "error" in msg:
                logger.error(f"MCP HTTP 错误 ({method}): {msg['error']}")
                return None
            return msg.get("result")
        except Exception as e:
            logger.error(f"MCP HTTP 请求异常 ({method}): {e}")
            return None

    async def _notify(self, method: str, params: dict[str, Any]) -> None:
        try:
            import httpx

            client = await self._ensure_client()
            payload = {"jsonrpc": "2.0", "method": method, "params": params}
            await client.post(self._url, json=payload, headers=self._build_headers())
        except Exception:
            pass


def _parse_sse_response(text: str, expected_id: int) -> dict[str, Any] | None:
    """解析 text/event-stream 响应, 找到匹配 expected_id 的 message。"""
    current_event: str | None = None
    data_lines: list[str] = []
    for line in text.splitlines():
        if line.startswith("event:"):
            current_event = line.split(":", 1)[1].strip()
        elif line.startswith("data:"):
            data_lines.append(line.split(":", 1)[1].strip())
        elif not line:
            if not data_lines:
                continue
            data = "\n".join(data_lines)
            data_lines = []
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                continue
            if msg.get("id") == expected_id and "result" in msg:
                return msg["result"]
            current_event = None
    return None


def _parse_tools(result: dict[str, Any] | None, server_name: str) -> list[MCPTool]:
    if not result:
        return []
    tools: list[MCPTool] = []
    for t in result.get("tools", []):
        tools.append(MCPTool(
            name=t.get("name", ""),
            description=t.get("description", ""),
            input_schema=t.get("inputSchema", {}),
            server_name=server_name,
        ))
    return tools


# ---------------------------------------------------------------------------
# MCP SSE 传输客户端 (GET /sse 建立事件流, POST 发送请求)
# ---------------------------------------------------------------------------

class MCPSseClient:
    """MCP HTTP+SSE 传输 — 经典双向流式传输 (Claude Code 默认支持)。

    流程:
    1. GET /sse → server 返回 event: endpoint, data: <POST URL>
    2. POST 到该 URL 发送 JSON-RPC 请求
    3. server 通过 /sse 流返回响应 (event: message, data: {jsonrpc...})
    """

    def __init__(self, config: MCPServerConfig):
        self.config = _expand_config(config)
        self._url = config.url or ""
        self._post_url: str | None = None
        self._request_id = 0
        self._initialized = False
        self._client: Any = None
        self._response_event: asyncio.Event = asyncio.Event()
        self._response_result: dict[str, Any] | None = None
        self._response_error: dict[str, Any] | None = None
        self._sse_task: asyncio.Task | None = None

    async def connect(self) -> bool:
        if not self._url:
            return False
        try:
            import httpx

            self._client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))
            self._sse_task = asyncio.create_task(self._consume_sse())
            for _ in range(50):
                if self._post_url:
                    break
                await asyncio.sleep(0.1)
            if not self._post_url:
                return False
            result = await self._request("initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "IHUI-Agent", "version": "1.0"},
            })
            if result:
                await self._notify("notifications/initialized", {})
                self._initialized = True
                return True
        except Exception as e:
            logger.error(f"MCP SSE 连接失败 ({self.config.name}): {e}")
        return False

    async def _consume_sse(self) -> None:
        """后台消费 SSE 流, 解析 endpoint / message 事件。"""
        try:
            headers = {"Accept": "text/event-stream"}
            headers.update(build_auth_headers(self.config))
            async with self._client.stream("GET", self._url, headers=headers) as resp:
                current_event: str | None = None
                data_lines: list[str] = []
                async for line in resp.aiter_lines():
                    if line.startswith("event:"):
                        current_event = line.split(":", 1)[1].strip()
                    elif line.startswith("data:"):
                        data_lines.append(line.split(":", 1)[1].strip())
                    elif not line:
                        if not data_lines:
                            current_event = None
                            continue
                        data = "\n".join(data_lines)
                        data_lines = []
                        if current_event == "endpoint":
                            self._post_url = data.strip()
                        elif current_event == "message":
                            try:
                                msg = json.loads(data)
                            except json.JSONDecodeError:
                                current_event = None
                                continue
                            if "id" in msg and msg["id"] == self._request_id:
                                if "result" in msg:
                                    self._response_result = msg["result"]
                                elif "error" in msg:
                                    self._response_error = msg["error"]
                                self._response_event.set()
                        current_event = None
        except Exception as e:
            logger.error(f"MCP SSE 流异常: {e}")

    async def list_tools(self) -> list[MCPTool]:
        result = await self._request("tools/list", {})
        return _parse_tools(result, self.config.name)

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> str:
        result = await self._request("tools/call", {"name": name, "arguments": arguments})
        if not result:
            return "(无结果)"
        parts: list[str] = []
        for c in result.get("content", []):
            if isinstance(c, dict) and c.get("type") == "text":
                parts.append(c.get("text", ""))
        return "\n".join(parts) or "(无输出)"

    async def close(self) -> None:
        if self._sse_task:
            self._sse_task.cancel()
            self._sse_task = None
        if self._client:
            try:
                await self._client.aclose()
            except Exception:
                pass
            self._client = None
        self._initialized = False

    async def _request(self, method: str, params: dict[str, Any]) -> dict[str, Any] | None:
        if not self._post_url:
            return None
        self._request_id += 1
        self._response_event.clear()
        self._response_result = None
        self._response_error = None
        payload = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": method,
            "params": params,
        }
        try:
            resp = await self._client.post(self._post_url, json=payload, headers=build_auth_headers(self.config))
            if resp.status_code not in (200, 201, 202):
                logger.error(f"MCP SSE POST 失败 ({method}): {resp.status_code}")
                return None
        except Exception as e:
            logger.error(f"MCP SSE POST 异常 ({method}): {e}")
            return None
        try:
            await asyncio.wait_for(self._response_event.wait(), timeout=20.0)
        except asyncio.TimeoutError:
            logger.error(f"MCP SSE 响应超时 ({method})")
            return None
        if self._response_error:
            logger.error(f"MCP SSE 错误 ({method}): {self._response_error}")
            return None
        return self._response_result

    async def _notify(self, method: str, params: dict[str, Any]) -> None:
        if not self._post_url:
            return
        try:
            payload = {"jsonrpc": "2.0", "method": method, "params": params}
            await self._client.post(self._post_url, json=payload, headers=build_auth_headers(self.config))
        except Exception:
            pass


# ---------------------------------------------------------------------------
# MCP 服务器管理器 (单例)
# ---------------------------------------------------------------------------

class MCPManager:
    """管理多个 MCP 服务器的连接和工具聚合。"""

    def __init__(self) -> None:
        self._clients: dict[str, MCPStdioClient | MCPHttpClient | MCPSseClient] = {}
        self._statuses: dict[str, MCPServerStatus] = {}

    async def add_server(self, config: MCPServerConfig, transport: str | None = None) -> bool:
        """添加并连接 MCP 服务器。返回是否成功。

        向后兼容: transport 参数可选, 默认 None -> 用 config.transport (stdio)。
        显式传入可覆盖配置中的 transport (stdio|http|sse)。
        """
        config = _expand_config(config)
        client: MCPStdioClient | MCPHttpClient | MCPSseClient
        transport = (transport or config.transport or "stdio").lower()
        if transport == "stdio":
            client = MCPStdioClient(config)
        elif transport == "http":
            client = MCPHttpClient(config)
        elif transport == "sse":
            client = MCPSseClient(config)
        else:
            logger.error(f"MCP 不支持的传输: {transport}")
            return False
        try:
            ok = await client.connect()
        except Exception as e:
            logger.error(f"MCP 连接异常 ({config.name}): {e}")
            ok = False
        self._statuses[config.name] = MCPServerStatus(
            name=config.name,
            transport=transport,
            online=ok,
            tool_count=0,
            url=config.url,
            error=None if ok else "连接失败",
        )
        if ok:
            self._clients[config.name] = client
        return ok

    async def list_tools(self, server_name: str) -> list[MCPTool]:
        client = self._clients.get(server_name)
        if not client:
            return []
        try:
            tools = await client.list_tools()
        except Exception as e:
            logger.error(f"MCP list_tools 异常 ({server_name}): {e}")
            return []
        self._statuses[server_name].tool_count = len(tools)
        return tools

    async def list_all_tools(self) -> list[MCPTool]:
        all_tools: list[MCPTool] = []
        for name in list(self._clients.keys()):
            try:
                tools = await self.list_tools(name)
                all_tools.extend(tools)
            except Exception:
                continue
        return all_tools

    async def call_mcp_tool(self, server_name: str, tool_name: str, arguments: dict[str, Any]) -> str:
        client = self._clients.get(server_name)
        if not client:
            return f"MCP 服务器 {server_name} 未连接"
        try:
            return await client.call_tool(tool_name, arguments)
        except Exception as e:
            return f"MCP 工具调用失败: {e}"

    def list_servers(self) -> list[MCPServerStatus]:
        return list(self._statuses.values())

    def get_status(self, name: str) -> MCPServerStatus | None:
        return self._statuses.get(name)

    async def remove_server(self, name: str) -> None:
        client = self._clients.pop(name, None)
        if client:
            try:
                await client.close()
            except Exception:
                pass
        self._statuses.pop(name, None)

    async def close_all(self) -> None:
        for client in list(self._clients.values()):
            try:
                await client.close()
            except Exception:
                pass
        self._clients.clear()
        self._statuses.clear()


_mcp_manager: MCPManager | None = None


def get_mcp_manager() -> MCPManager:
    """获取 MCP 管理器单例。"""
    global _mcp_manager
    if _mcp_manager is None:
        _mcp_manager = MCPManager()
    return _mcp_manager


def load_mcp_config(workspace_path: str) -> list[MCPServerConfig]:
    """从工作区 .claude/settings.json 加载 MCP 服务器配置。

    对标 Claude Code 的 mcpServers 配置:
    {
        "mcpServers": {
            "weather": {
                "command": "npx",
                "args": ["-y", "@weather/mcp-server"],
                "env": {}
            }
        }
    }
    """
    workspace = Path(workspace_path).resolve()
    sf = workspace / ".claude" / "settings.json"
    if not sf.exists():
        return []
    try:
        settings = json.loads(sf.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"加载 .claude/settings.json 失败: {e}")
        return []
    servers = settings.get("mcpServers", {})
    result: list[MCPServerConfig] = []
    for name, cfg in servers.items():
        auth_cfg = cfg.get("auth")
        api_key = cfg.get("api_key")
        headers = cfg.get("headers", {})
        transport = cfg.get("transport", "stdio")
        if transport == "stdio" and not cfg.get("command"):
            continue
        if transport in ("http", "sse") and not cfg.get("url"):
            continue
        result.append(MCPServerConfig(
            name=name,
            command=cfg.get("command"),
            args=cfg.get("args", []),
            env=cfg.get("env", {}),
            url=cfg.get("url"),
            transport=transport,
            api_key=api_key,
            headers=headers,
            auth=auth_cfg,
        ))
    return result
