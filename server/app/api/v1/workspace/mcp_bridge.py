"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持两种传输:
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- sse/http: 远程服务器

对标 Anthropic MCP 开放标准 (JSON-RPC 2.0, 双向通信)。
"""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import MCPServerConfig, MCPTool


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输)
# ---------------------------------------------------------------------------

class MCPStdioClient:
    """MCP stdio 客户端 — 通过子进程与 MCP server 通信。

    协议: JSON-RPC 2.0 over stdio
    """

    def __init__(self, config: MCPServerConfig):
        self.config = config
        self.process: asyncio.subprocess.Process | None = None
        self._request_id = 0

    async def connect(self) -> bool:
        """启动 MCP server 子进程并初始化连接。"""
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
            # 发送 initialize 请求
            result = await self._request("initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "ihui-agent", "version": "1.0.0"},
            })
            if result:
                # 发送 initialized 通知
                await self._notify("notifications/initialized", {})
                return True
            return False
        except Exception:
            return False

    async def list_tools(self) -> list[MCPTool]:
        """列出 MCP server 提供的工具。"""
        result = await self._request("tools/list", {})
        if not result:
            return []
        tools: list[MCPTool] = []
        for t in result.get("tools", []):
            tools.append(MCPTool(
                name=t.get("name", ""),
                description=t.get("description", ""),
                input_schema=t.get("inputSchema", {}),
                server_name=self.config.name,
            ))
        return tools

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> str:
        """调用 MCP server 的工具。"""
        result = await self._request("tools/call", {"name": name, "arguments": arguments})
        if not result:
            return "MCP 工具调用失败"
        # result.content 是一个 content blocks 数组
        parts: list[str] = []
        for block in result.get("content", []):
            if block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "\n".join(parts) or str(result)

    async def list_resources(self) -> list[dict[str, Any]]:
        """列出 MCP server 提供的资源。"""
        result = await self._request("resources/list", {})
        return result.get("resources", []) if result else []

    async def read_resource(self, uri: str) -> str:
        """读取 MCP 资源。"""
        result = await self._request("resources/read", {"uri": uri})
        if not result:
            return ""
        parts: list[str] = []
        for block in result.get("contents", []):
            if block.get("text"):
                parts.append(block["text"])
        return "\n".join(parts)

    async def list_prompts(self) -> list[dict[str, Any]]:
        """列出 MCP server 提供的提示模板。"""
        result = await self._request("prompts/list", {})
        return result.get("prompts", []) if result else []

    async def get_prompt(self, name: str, arguments: dict[str, Any] | None = None) -> str:
        """获取 MCP 提示模板内容。"""
        result = await self._request("prompts/get", {"name": name, "arguments": arguments or {}})
        if not result:
            return ""
        parts: list[str] = []
        for msg in result.get("messages", []):
            content = msg.get("content", {})
            if content.get("type") == "text":
                parts.append(content.get("text", ""))
        return "\n".join(parts)

    async def close(self) -> None:
        """关闭连接。"""
        if self.process:
            self.process.terminate()
            await self.process.wait()
            self.process = None

    async def _request(self, method: str, params: dict[str, Any]) -> dict[str, Any] | None:
        """发送 JSON-RPC 请求并等待匹配的响应。

        处理通知交错: MCP 服务器可能在响应前后发送通知 (无 id 字段),
        需循环读取直到收到匹配 request_id 的响应。
        """
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
        data = json.dumps(req) + "\n"
        self.process.stdin.write(data.encode())
        await self.process.stdin.drain()

        # 循环读取行, 跳过通知 (无 id 字段), 等待匹配 expected_id 的响应
        max_attempts = 100  # 防止无限循环
        for _ in range(max_attempts):
            line = await self.process.stdout.readline()
            if not line:
                return None
            try:
                msg = json.loads(line.decode())
            except json.JSONDecodeError:
                continue  # 跳过无法解析的行

            # 通知 (无 id 字段) — 跳过
            if "id" not in msg:
                # 可在此处理通知回调 (如 resources/list_changed)
                continue

            # 响应 — 检查 id 是否匹配
            if msg["id"] != expected_id:
                continue  # 不匹配, 可能是其他请求的响应, 跳过

            if "error" in msg:
                logger.error(f"MCP 请求 {method} 错误: {msg['error']}")
                return None
            return msg.get("result")

        return None

    async def _notify(self, method: str, params: dict[str, Any]) -> None:
        """发送 JSON-RPC 通知 (无响应)。"""
        if not self.process or not self.process.stdin:
            return
        req = {"jsonrpc": "2.0", "method": method, "params": params}
        data = json.dumps(req) + "\n"
        self.process.stdin.write(data.encode())
        await self.process.stdin.drain()


# ---------------------------------------------------------------------------
# MCP HTTP 传输客户端 (对标 Claude Code 的 HTTP 传输, 推荐方式)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP HTTP 传输客户端 — 通过 HTTP POST 发送 JSON-RPC 请求。

    对标 Claude Code 的 HTTP 传输:
    - 单次 POST 请求/响应 (非流式)
    - 支持 Bearer Token 认证
    - 支持自定义 Headers
    """

    def __init__(self, config: MCPServerConfig):
        self.config = config
        self._url = config.url or ""
        self._headers = {
            "Content-Type": "application/json",
            "User-Agent": "IHUI-MCP/1.0",
        }
        if config.headers:
            self._headers.update(config.headers)
        if config.api_key:
            self._headers["Authorization"] = f"Bearer {config.api_key}"
        self._initialized = False

    async def connect(self) -> bool:
        """初始化 MCP HTTP 连接 (发送 initialize 请求)。"""
        try:
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

    async def _request(self, method: str, params: dict[str, Any]) -> dict[str, Any] | None:
        """发送 HTTP POST JSON-RPC 请求。"""
        try:
            import httpx

            req_id = id(method) % 100000  # 简单 ID 生成
            payload = {
                "jsonrpc": "2.0",
                "id": req_id,
                "method": method,
                "params": params,
            }
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self._url, json=payload, headers=self._headers)
                if resp.status_code != 200:
                    logger.error(f"MCP HTTP 请求失败 ({method}): {resp.status_code}")
                    return None
                msg = resp.json()
                if "error" in msg:
                    logger.error(f"MCP HTTP 错误 ({method}): {msg['error']}")
                    return None
                return msg.get("result")
        except Exception as e:
            logger.error(f"MCP HTTP 请求异常 ({method}): {e}")
            return None

    async def _notify(self, method: str, params: dict[str, Any]) -> None:
        """发送 JSON-RPC 通知 (无 id, 无响应)。"""
        try:
            import httpx

            payload = {"jsonrpc": "2.0", "method": method, "params": params}
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(self._url, json=payload, headers=self._headers)
        except Exception:
            pass

    async def list_tools(self) -> list[MCPTool]:
        """列出 MCP 服务器提供的工具。"""
        result = await self._request("tools/list", {})
        if not result:
            return []
        tools: list[MCPTool] = []
        for t in result.get("tools", []):
            tools.append(MCPTool(
                name=t.get("name", ""),
                description=t.get("description", ""),
                input_schema=t.get("inputSchema", {}),
            ))
        return tools

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> str:
        """调用 MCP 工具。"""
        result = await self._request("tools/call", {"name": name, "arguments": arguments})
        if not result:
            return "(无结果)"
        # MCP 返回 content 数组
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
        """列出 MCP 资源。"""
        result = await self._request("resources/list", {})
        return result.get("resources", []) if result else []

    async def read_resource(self, uri: str) -> str:
        """读取 MCP 资源。"""
        result = await self._request("resources/read", {"uri": uri})
        if not result:
            return "(无内容)"
        contents = result.get("contents", [])
        return "\n".join(c.get("text", "") for c in contents if isinstance(c, dict))

    async def close(self) -> None:
        """关闭连接 (HTTP 无持久连接)。"""
        self._initialized = False


# ---------------------------------------------------------------------------
# MCP 服务器管理器
# ---------------------------------------------------------------------------

class MCPManager:
    """管理多个 MCP 服务器的连接和工具聚合。"""

    def __init__(self):
        self._clients: dict[str, MCPStdioClient | MCPHttpClient] = {}

    async def add_server(self, config: MCPServerConfig) -> bool:
        """添加并连接 MCP 服务器。支持 stdio 和 HTTP 传输。"""
        if config.transport == "stdio":
            client = MCPStdioClient(config)
            if await client.connect():
                self._clients[config.name] = client
                return True
            return False
        elif config.transport in ("http", "sse"):
            # SSE 降级为 HTTP 轮询 (简化实现)
            client = MCPHttpClient(config)
            if await client.connect():
                self._clients[config.name] = client
                return True
            return False
        return False

    async def list_tools(self, server_name: str) -> list[MCPTool]:
        """列出指定服务器的工具。"""
        client = self._clients.get(server_name)
        if not client:
            return []
        return await client.list_tools()

    async def list_all_tools(self) -> list[MCPTool]:
        """聚合所有 MCP 服务器的工具。"""
        all_tools: list[MCPTool] = []
        for name, client in self._clients.items():
            tools = await client.list_tools()
            all_tools.extend(tools)
        return all_tools

    async def call_mcp_tool(self, server_name: str, tool_name: str, arguments: dict[str, Any]) -> str:
        """调用指定 MCP 服务器的工具。"""
        client = self._clients.get(server_name)
        if not client:
            return f"MCP 服务器 {server_name} 未连接"
        return await client.call_tool(tool_name, arguments)

    async def close_all(self) -> None:
        """关闭所有连接。"""
        for client in self._clients.values():
            await client.close()
        self._clients.clear()


# 全局单例
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
    import json as json_mod
    from pathlib import Path

    workspace = Path(workspace_path).resolve()
    sf = workspace / ".claude" / "settings.json"
    if not sf.exists():
        return []
    try:
        settings = json_mod.loads(sf.read_text(encoding="utf-8"))
        servers = settings.get("mcpServers", {})
        result: list[MCPServerConfig] = []
        for name, cfg in servers.items():
            result.append(MCPServerConfig(
                name=name,
                command=cfg.get("command"),
                args=cfg.get("args", []),
                env=cfg.get("env", {}),
                url=cfg.get("url"),
                transport=cfg.get("transport", "stdio"),
            ))
        return result
    except Exception:
        return []
