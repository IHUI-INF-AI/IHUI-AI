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
"""
MCP (Model Context Protocol)"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
-"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
# ---------------------------------------------------------------------------

_ENV_VAR"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
# ---------------------------------------------------------------------------

_ENV_VAR_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
# ---------------------------------------------------------------------------

_ENV_VAR_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")


def expand_env(value:"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
# ---------------------------------------------------------------------------

_ENV_VAR_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")


def expand_env(value: Any) -> Any:
    """递归展开字符串中的 ${VAR} 环境变量 (对标 Claude Code)。

    未定义的变量展开为空字符串。仅处理 str / dict"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
# ---------------------------------------------------------------------------

_ENV_VAR_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")


def expand_env(value: Any) -> Any:
    """递归展开字符串中的 ${VAR} 环境变量 (对标 Claude Code)。

    未定义的变量展开为空字符串。仅处理 str / dict / list 结构。
    """
    if isinstance(value, str):
        return _ENV_VAR_RE.sub(lambda m: os.environ.get(m.group(1"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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
    if"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


def _expand_config(config: MCPServer"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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
    """对 MCPServerConfig 中所有字符串字段做"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 ("""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token ("""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg ="""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", """"
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type","""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time()"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers:"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers[""""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPS"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth,"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuth"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
# ----------------------------------------------------------------"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
# ---------------------------------------------------------------------------

class MCPStdioClient:
    """MCP stdio 客户端 — 通过子进程与 MCP server 通信。

    协"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
# ---------------------------------------------------------------------------

class MCPStdioClient:
    """MCP stdio 客户端 — 通过子进程与 MCP server 通信。

    协议: JSON-RPC 2.0 over stdio
    """

    def __init__(self, config: MCPServerConfig):
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
        if"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
                *"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
                stderr=asyncio.subprocess.PIPE"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
            result = await self._"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
                "clientInfo": {"name"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
            if"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
            return"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
                server_name=self.config"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
        parts:"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
                parts.append"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
        return "\n"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
        return result.get"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
        result = await self._request("resources"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
        return"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
        """列出 MCP server 提供"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
        return result.get("prompts", []) if result else"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
        """获取"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
        result = await self._request("prompts/get", {"name": name, "arguments": arguments or"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
        return"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
            self.process.terminate"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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

    async def _request(self, method: str, params: dict[str, Any"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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

"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
        max_attempts"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
            except"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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

            # 通知 (无 id 字段) — 跳"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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

            #"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
                logger.error(f"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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

        return"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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

    async def _notify(self, method"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
        req = {"jsonrpc": "2."""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
        data = json.dumps(req) +"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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


#"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端点 POST JSON-RPC。

    对标 MCP "Streamable HTTP" 传输 (2025"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端点 POST JSON-RPC。

    对标 MCP "Streamable HTTP" 传输 (2025-03-26 规范):
    - POST JSON-RPC 请求到单一端点"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端点 POST JSON-RPC。

    对标 MCP "Streamable HTTP" 传输 (2025-03-26 规范):
    - POST JSON-RPC 请求到单一端点
    - 响应可为 application/json ("""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端点 POST JSON-RPC。

    对标 MCP "Streamable HTTP" 传输 (2025-03-26 规范):
    - POST JSON-RPC 请求到单一端点
    - 响应可为 application/json (非流式) 或 text/event-stream (流式)
    - 通过 Mcp-Session-"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端点 POST JSON-RPC。

    对标 MCP "Streamable HTTP" 传输 (2025-03-26 规范):
    - POST JSON-RPC 请求到单一端点
    - 响应可为 application/json (非流式) 或 text/event-stream (流式)
    - 通过 Mcp-Session-Id header 维持会话
    - 支持 Bearer Token / OAuth / 自定义 Headers 认证

    实现: 优先尝试非流式 POST; 若响应是 SSE 流,"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端点 POST JSON-RPC。

    对标 MCP "Streamable HTTP" 传输 (2025-03-26 规范):
    - POST JSON-RPC 请求到单一端点
    - 响应可为 application/json (非流式) 或 text/event-stream (流式)
    - 通过 Mcp-Session-Id header 维持会话
    - 支持 Bearer Token / OAuth / 自定义 Headers 认证

    实现: 优先尝试非流式 POST; 若响应是 SSE 流, 解析首个 data 事件为结果。
    """

    def __init__(self, config:"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端点 POST JSON-RPC。

    对标 MCP "Streamable HTTP" 传输 (2025-03-26 规范):
    - POST JSON-RPC 请求到单一端点
    - 响应可为 application/json (非流式) 或 text/event-stream (流式)
    - 通过 Mcp-Session-Id header 维持会话
    - 支持 Bearer Token / OAuth / 自定义 Headers 认证

    实现: 优先尝试非流式 POST; 若响应是 SSE 流, 解析首个 data 事件为结果。
    """

    def __init__(self, config: MCPServerConfig):
        self.config = config
        self._url = config.url or ""
        self._oauth = make_oauth_manager(config)
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端点 POST JSON-RPC。

    对标 MCP "Streamable HTTP" 传输 (2025-03-26 规范):
    - POST JSON-RPC 请求到单一端点
    - 响应可为 application/json (非流式) 或 text/event-stream (流式)
    - 通过 Mcp-Session-Id header 维持会话
    - 支持 Bearer Token / OAuth / 自定义 Headers 认证

    实现: 优先尝试非流式 POST; 若响应是 SSE 流, 解析首个 data 事件为结果。
    """

    def __init__(self, config: MCPServerConfig):
        self.config = config
        self._url = config.url or ""
        self._oauth = make_oauth_manager(config)
        self._session_id: str | None = None
        self._request_id = 0"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端点 POST JSON-RPC。

    对标 MCP "Streamable HTTP" 传输 (2025-03-26 规范):
    - POST JSON-RPC 请求到单一端点
    - 响应可为 application/json (非流式) 或 text/event-stream (流式)
    - 通过 Mcp-Session-Id header 维持会话
    - 支持 Bearer Token / OAuth / 自定义 Headers 认证

    实现: 优先尝试非流式 POST; 若响应是 SSE 流, 解析首个 data 事件为结果。
    """

    def __init__(self, config: MCPServerConfig):
        self.config = config
        self._url = config.url or ""
        self._oauth = make_oauth_manager(config)
        self._session_id: str | None = None
        self._request_id = 0
        self._initialized = False
        self._client: Any = None  # 复用 httpx.AsyncClient

    def _build_headers(self) -> dict[str, str]:
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端点 POST JSON-RPC。

    对标 MCP "Streamable HTTP" 传输 (2025-03-26 规范):
    - POST JSON-RPC 请求到单一端点
    - 响应可为 application/json (非流式) 或 text/event-stream (流式)
    - 通过 Mcp-Session-Id header 维持会话
    - 支持 Bearer Token / OAuth / 自定义 Headers 认证

    实现: 优先尝试非流式 POST; 若响应是 SSE 流, 解析首个 data 事件为结果。
    """

    def __init__(self, config: MCPServerConfig):
        self.config = config
        self._url = config.url or ""
        self._oauth = make_oauth_manager(config)
        self._session_id: str | None = None
        self._request_id = 0
        self._initialized = False
        self._client: Any = None  # 复用 httpx.AsyncClient

    def _build_headers(self) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json,"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端点 POST JSON-RPC。

    对标 MCP "Streamable HTTP" 传输 (2025-03-26 规范):
    - POST JSON-RPC 请求到单一端点
    - 响应可为 application/json (非流式) 或 text/event-stream (流式)
    - 通过 Mcp-Session-Id header 维持会话
    - 支持 Bearer Token / OAuth / 自定义 Headers 认证

    实现: 优先尝试非流式 POST; 若响应是 SSE 流, 解析首个 data 事件为结果。
    """

    def __init__(self, config: MCPServerConfig):
        self.config = config
        self._url = config.url or ""
        self._oauth = make_oauth_manager(config)
        self._session_id: str | None = None
        self._request_id = 0
        self._initialized = False
        self._client: Any = None  # 复用 httpx.AsyncClient

    def _build_headers(self) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "User-Agent": "IHUI-MCP/1.0",
"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端点 POST JSON-RPC。

    对标 MCP "Streamable HTTP" 传输 (2025-03-26 规范):
    - POST JSON-RPC 请求到单一端点
    - 响应可为 application/json (非流式) 或 text/event-stream (流式)
    - 通过 Mcp-Session-Id header 维持会话
    - 支持 Bearer Token / OAuth / 自定义 Headers 认证

    实现: 优先尝试非流式 POST; 若响应是 SSE 流, 解析首个 data 事件为结果。
    """

    def __init__(self, config: MCPServerConfig):
        self.config = config
        self._url = config.url or ""
        self._oauth = make_oauth_manager(config)
        self._session_id: str | None = None
        self._request_id = 0
        self._initialized = False
        self._client: Any = None  # 复用 httpx.AsyncClient

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
        if"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端点 POST JSON-RPC。

    对标 MCP "Streamable HTTP" 传输 (2025-03-26 规范):
    - POST JSON-RPC 请求到单一端点
    - 响应可为 application/json (非流式) 或 text/event-stream (流式)
    - 通过 Mcp-Session-Id header 维持会话
    - 支持 Bearer Token / OAuth / 自定义 Headers 认证

    实现: 优先尝试非流式 POST; 若响应是 SSE 流, 解析首个 data 事件为结果。
    """

    def __init__(self, config: MCPServerConfig):
        self.config = config
        self._url = config.url or ""
        self._oauth = make_oauth_manager(config)
        self._session_id: str | None = None
        self._request_id = 0
        self._initialized = False
        self._client: Any = None  # 复用 httpx.AsyncClient

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

            self._client = httpx.AsyncClient"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端点 POST JSON-RPC。

    对标 MCP "Streamable HTTP" 传输 (2025-03-26 规范):
    - POST JSON-RPC 请求到单一端点
    - 响应可为 application/json (非流式) 或 text/event-stream (流式)
    - 通过 Mcp-Session-Id header 维持会话
    - 支持 Bearer Token / OAuth / 自定义 Headers 认证

    实现: 优先尝试非流式 POST; 若响应是 SSE 流, 解析首个 data 事件为结果。
    """

    def __init__(self, config: MCPServerConfig):
        self.config = config
        self._url = config.url or ""
        self._oauth = make_oauth_manager(config)
        self._session_id: str | None = None
        self._request_id = 0
        self._initialized = False
        self._client: Any = None  # 复用 httpx.AsyncClient

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

            self._client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端点 POST JSON-RPC。

    对标 MCP "Streamable HTTP" 传输 (2025-03-26 规范):
    - POST JSON-RPC 请求到单一端点
    - 响应可为 application/json (非流式) 或 text/event-stream (流式)
    - 通过 Mcp-Session-Id header 维持会话
    - 支持 Bearer Token / OAuth / 自定义 Headers 认证

    实现: 优先尝试非流式 POST; 若响应是 SSE 流, 解析首个 data 事件为结果。
    """

    def __init__(self, config: MCPServerConfig):
        self.config = config
        self._url = config.url or ""
        self._oauth = make_oauth_manager(config)
        self._session_id: str | None = None
        self._request_id = 0
        self._initialized = False
        self._client: Any = None  # 复用 httpx.AsyncClient

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
        """初始化 MCP HTTP 连接 (发送 initialize 请求)。"""
        if not self._url"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端点 POST JSON-RPC。

    对标 MCP "Streamable HTTP" 传输 (2025-03-26 规范):
    - POST JSON-RPC 请求到单一端点
    - 响应可为 application/json (非流式) 或 text/event-stream (流式)
    - 通过 Mcp-Session-Id header 维持会话
    - 支持 Bearer Token / OAuth / 自定义 Headers 认证

    实现: 优先尝试非流式 POST; 若响应是 SSE 流, 解析首个 data 事件为结果。
    """

    def __init__(self, config: MCPServerConfig):
        self.config = config
        self._url = config.url or ""
        self._oauth = make_oauth_manager(config)
        self._session_id: str | None = None
        self._request_id = 0
        self._initialized = False
        self._client: Any = None  # 复用 httpx.AsyncClient

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
        """初始化 MCP HTTP 连接 (发送 initialize 请求)。"""
        if not self._url:
            logger.error(f"MCP HTTP 连接失败 ({self.config.name}): 缺少 url"""
MCP (Model Context Protocol) 桥接 — 对标 Claude Code / Codex 的 MCP 支持。

MCP 三大原语:
1. Tools    — 工具 (模型可调用的函数)
2. Resources — 资源 (模型可读取的数据)
3. Prompts   — 提示模板

支持三种传输 (对标 Claude Code 三传输):
- stdio: 本地子进程 (MCP server 是一个 CLI 程序)
- http : Streamable HTTP 传输 (单端点 POST JSON-RPC, 响应可为 JSON 或 SSE 流)
- sse  : HTTP+SSE 传输 (GET /sse 建立事件流, POST 到端点发送请求, 响应经事件流回传)

认证 (对标 Codex OAuth + Claude Code):
- bearer: 静态 Bearer Token (从配置或环境变量读取)
- oauth : OAuth 2.0 授权码流程 (简化版: 支持静态/缓存 token + 预留完整流程接口)

配置文件支持环境变量展开 ${VAR} (对标 Claude Code)。

实现说明: 项目 venv 未安装 `mcp` 官方包, 故采用 `httpx` 手动实现 MCP
JSON-RPC 2.0 协议 (HTTP/SSE), 保证零额外依赖即可运行; stdio 保持原样。
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any

from loguru import logger

from app.api.v1.workspace.schemas import (
    MCPServerConfig,
    MCPTool,
    MCPServerStatus,
)


# ---------------------------------------------------------------------------
# 环境变量展开 + 认证工具 (对标 Claude Code 的 ${VAR} 展开)
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


class OAuthTokenManager:
    """OAuth token 管理 (简化版, 对标 Codex OAuth)。

    - 优先使用配置中已存在的 access_token (静态/缓存)
    - 提供 build_auth_url() / exchange_code() / refresh() 作为完整授权码流程接口
    - refresh(): 用 refresh_token 换取新 token (httpx async)
    """

    def __init__(self, oauth_config: Any) -> None:
        # oauth_config: MCPOAuthConfig (已展开环境变量)
        self.cfg = oauth_config
        self._access_token: str | None = getattr(self.cfg, "access_token", None)
        self._refresh_token: str | None = getattr(self.cfg, "refresh_token", None)
        self._token_type: str = getattr(self.cfg, "token_type", "Bearer") or "Bearer"
        self._expires_at: float = 0.0
        expires_in = getattr(self.cfg, "expires_in", None)
        if expires_in:
            self._expires_at = time.time() + float(expires_in)

    @property
    def access_token(self) -> str | None:
        return self._access_token

    def is_expired(self) -> bool:
        if not self._access_token:
            return True
        if self._expires_at and time.time() >= self._expires_at - 30:
            return True
        return False

    def build_auth_url(self) -> str:
        """构造授权码请求 URL (用户浏览器跳转, 预留接口)。"""
        from urllib.parse import urlencode

        params = {
            "response_type": "code",
            "client_id": self.cfg.client_id,
            "redirect_uri": self.cfg.redirect_uri,
            "scope": " ".join(self.cfg.scopes),
        }
        sep = "&" if "?" in self.cfg.auth_url else "?"
        return f"{self.cfg.auth_url}{sep}{urlencode(params)}"

    async def exchange_code(self, code: str) -> str | None:
        """用授权码换取 token (预留接口, 完整 OAuth 流程)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.cfg.redirect_uri,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth exchange_code 失败: {resp.status_code}")
                    return None
                tok = resp.json()
                self._access_token = tok.get("access_token")
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                self._token_type = tok.get("token_type", "Bearer")
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth exchange_code 异常: {e}")
            return None

    async def refresh(self) -> str | None:
        """用 refresh_token 刷新 access_token (过期时自动调用)。"""
        if not self._refresh_token or not self.cfg.token_url:
            return self._access_token
        try:
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self.cfg.token_url, data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._refresh_token,
                    "client_id": self.cfg.client_id,
                    "client_secret": self.cfg.client_secret,
                })
                if resp.status_code != 200:
                    logger.error(f"MCP OAuth refresh 失败: {resp.status_code}")
                    return self._access_token
                tok = resp.json()
                self._access_token = tok.get("access_token", self._access_token)
                self._refresh_token = tok.get("refresh_token", self._refresh_token)
                if tok.get("expires_in"):
                    self._expires_at = time.time() + float(tok["expires_in"])
                return self._access_token
        except Exception as e:
            logger.error(f"MCP OAuth refresh 异常: {e}")
            return self._access_token

    async def get_token(self) -> str | None:
        """获取可用 token, 过期则尝试刷新。"""
        if self._access_token and not self.is_expired():
            return self._access_token
        if self._refresh_token:
            return await self.refresh()
        return self._access_token


def build_auth_headers(config: MCPServerConfig) -> dict[str, str]:
    """根据 config.auth / config.api_key 解析认证 headers (http/sse 共用)。

    优先级: auth (bearer/oauth) > api_key (兼容字段)。
    返回的 headers 已合并自定义 headers, 但不含 Content-Type (由调用方补)。
    """
    headers: dict[str, str] = {}
    auth = config.auth
    if auth and auth.type == "bearer" and auth.token:
        headers["Authorization"] = f"Bearer {auth.token}"
    elif auth and auth.type == "oauth" and auth.oauth:
        # 简化版: 仅使用静态/缓存 token; 完整流程由 OAuthTokenManager 驱动
        token = auth.oauth.access_token
        if token:
            tt = auth.oauth.token_type or "Bearer"
            headers["Authorization"] = f"{tt} {token}"
    elif config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    # 合并自定义 headers (可覆盖 Authorization)
    if config.headers:
        headers.update(config.headers)
    return headers


def make_oauth_manager(config: MCPServerConfig) -> OAuthTokenManager | None:
    """若 config 启用 oauth, 返回 OAuthTokenManager; 否则 None。"""
    if config.auth and config.auth.type == "oauth" and config.auth.oauth:
        return OAuthTokenManager(config.auth.oauth)
    return None


# ---------------------------------------------------------------------------
# MCP 客户端 (stdio 传输) — 保持原有实现
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
# MCP HTTP 传输客户端 (Streamable HTTP, 对标 Claude Code HTTP 传输)
# ---------------------------------------------------------------------------

class MCPHttpClient:
    """MCP Streamable HTTP 传输客户端 — 单端点 POST JSON-RPC。

    对标 MCP "Streamable HTTP" 传输 (2025-03-26 规范):
    - POST JSON-RPC 请求到单一端点
    - 响应可为 application/json (非流式) 或 text/event-stream (流式)
    - 通过 Mcp-Session-Id header 维持会话
    - 支持 Bearer Token / OAuth / 自定义 Headers 认证

    实现: 优先尝试非流式 POST; 若响应是 SSE 流, 解析首个 data 事件为结果。
    """

    def __init__(self, config: MCPServerConfig):
        self.config = config
        self._url = config.url or ""
        self._oauth = make_oauth_manager(config)
        self._session_id: str | None = None
        self._request_id = 0
        self._initialized = False
        self._client: Any = None  # 复用 httpx.AsyncClient

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
        """初始化 MCP HTTP 连接 (发送 initialize 请求)。"""
        if not self._url:
            logger.error(f"MCP HTTP 连接失败 ({self.config.name}): 缺少 url")
            return False
        try:
            # OAuth: 若启用且 token 过期, 尝试刷新
            if self._oauth:
