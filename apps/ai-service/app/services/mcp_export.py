# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌​​‌‌‌‌​‌​‍​‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌‌​‌​​‌‌‌​‍​‌‌​​‌‌​​​‌​​‌​‌‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌​​‌​​‌​​​‌‌​​​‌​​‍​​‌​‌‌‌​‍​‌​​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍​‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​​​​‌​‍​‌​​‌‌‌‌‍​‌​‌​​‌​​​​‍​​​​​​‍​‌‌​‌‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌‌​‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠

"""IHUI 作为 MCP **服务端**对外开放工具能力。

对标产品往往只做 MCP 客户端(消费外部工具),本模块把 ihui 自身能力
反转为 MCP Server,供任何外部 LLM Host(Claude Desktop / Cursor / 自研 agent)
连接发现与调用。支持三种 transport:

- stdio:           command: <python> -m app.services.mcp_export_run
                   本地拉起(MCP over stdin/stdout),见 handler_stdio / generate_client_config
- SSE:            GET  /api/mcp/export/sse      建立 SSE 长连接(事件流)
                  POST /api/mcp/export/messages/ 发 JSON-RPC 请求
- Streamable HTTP: POST /api/mcp/export/streamable 统一 JSON-RPC 端点
                   (同时支持 GET SSE 流式响应)

对外暴露时的 host/DNS-rebinding 防护见 validate_request_host / compute_external_url。

能力声明: serverInfo.name=ihui-ai, capabilities.tools=true;
协议协商由官方 mcp SDK(MCPServer)内部完成,最低兼容 2025-03-26。
协议版本常量复用 app/services/mcp_client.py(见 EXPORT_PROTOCOL_VERSIONS),单源去重。

开关: 环境变量 ENABLE_MCP_EXPORT=true 才挂载(默认关闭,不影响现有服务);
stdio 拉起入口(app.services.mcp_export_run)独立于该开关。
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
from datetime import UTC, datetime
from typing import Any, Callable

from mcp.server.mcpserver import MCPServer
from starlette.responses import JSONResponse

from app import __version__
from app.core.tunables import SUPPORTED_PROTOCOL_VERSIONS as _TUN_SPV
from app.services import mcp_client as _mcp_client

logger = logging.getLogger(__name__)

# 服务端信息: 版本从版本常量读取(与全项目一致)
SERVER_NAME = "ihui-ai"
SERVER_VERSION = __version__
SERVER_TITLE = "IHUI AI Service (MCP Export)"

# 默认/最低兼容协议版本(协商到更高版本由 SDK 自动处理)
# 协议版本单一来源: 复用 app/core/tunables.py 的常量,消除双轨漂移风险。
SUPPORTED_PROTOCOL_VERSIONS: tuple[str, ...] = _TUN_SPV
# 对外公开别名: 宿主/外部按"导出侧"语义引用,恒与客户端常量同源(见 task: 协议常量去重)。
EXPORT_PROTOCOL_VERSIONS = SUPPORTED_PROTOCOL_VERSIONS
# 本服务端自述可回告的最高协议版本(实际握手回告由 mcp SDK 内部按客户端请求值处理)。
LATEST_INTERNAL_VERSION = _TUN_SPV[-1]

# stdio / URL 形态的接入配置常量(供 generate_client_config / compute_external_url 使用)
MCP_SERVER_CLIENT_NAME = "ihui-ai-mcp"
MCP_EXPORT_RUN_MODULE = "app.services.mcp_export_run"
TRANSPORT_STDIO = _mcp_client.TRANSPORT_STDIO  # "stdio"
TRANSPORT_SSE = _mcp_client.TRANSPORT_SSE  # "sse"
TRANSPORT_STREAMABLE_HTTP = _mcp_client.TRANSPORT_STREAMABLE_HTTP  # "streamable-http"
# 未显式提供 base_url 时的默认对外基础地址(仅示意,实际按部署环境替换)
DEFAULT_EXTERNAL_BASE_URL = "http://127.0.0.1:8000"

# host/DNS-rebinding 校验: 默认放行的回环主机(仅本机)与视为不安全的目标值
LOOPBACK_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", "[::1]"})
UNSAFE_HOST_SENTINELS = frozenset({"", "0.0.0.0", "*", "::", "[::]"})


def _protocol_version() -> str:
    """本服务端可用于回告/自述的协议版本(取受支持的最高版本)。

    实际 MCP 握手时,服务端回告客户端请求的 protocolVersion(mcp SDK 内部处理);
    本函数供不需要协商上下文的静态回告场景(如工具/能力自述)使用。
    """
    return LATEST_INTERNAL_VERSION

# 对外挂载路径(前缀 /api/mcp/export/*)
MCP_EXPORT_PREFIX = "/api/mcp/export"
ENDPOINT_SSE = "/sse"
ENDPOINT_MESSAGES = "/messages/"
ENDPOINT_STREAMABLE = "/streamable"

# 环境变量开关(默认关闭,避免影响现有服务;显式 true 才挂载)
ENABLE_MCP_EXPORT_ENV = "ENABLE_MCP_EXPORT"


# =========================================================================
# 工具集定义
# =========================================================================

def _build_mcp_server() -> MCPServer:
    """构造并注册工具集的 MCPServer 实例。

    工具命名约定: 用 ``ihui.<tool>`` 前缀,清晰标识归属;每个工具带
    clear_name + description + typed input_schema(由函数签名自动推导)。
    """
    mcp = MCPServer(
        name=SERVER_NAME,
        version=SERVER_VERSION,
        title=SERVER_TITLE,
        description="IHUI AI 对外暴露的工具能力(SSE + Streamable HTTP)",
    )

    # 1) ihui.echo —— 连通性自检,原样回显
    async def ihui_echo(message: str) -> str:
        """原样回显输入文本(连接/MCP 协议链路自检)。"""
        return message

    mcp.add_tool(ihui_echo, name="ihui.echo", description="原样回显输入文本,用于连通/协议自检")

    # 2) ihui.now_utc —— 只读工具,返回当前 UTC 时间
    async def ihui_now_utc() -> dict[str, Any]:
        """返回当前 UTC 时间(时间戳 + ISO)。"""

        now = time.time()
        iso = datetime.fromtimestamp(now, tz=UTC).isoformat()
        return {"timestamp": now, "iso_utc": iso}

    mcp.add_tool(ihui_now_utc, name="ihui.now_utc", description="返回当前 UTC 时间戳与 ISO 字符串")

    # 3) ihui.capabilities —— 只读业务工具,静态返回本实例能力清单
    async def ihui_capabilities() -> dict[str, Any]:
        """返回本 MCP 服务器实例的 negotiated 能力/工具清单。"""
        return {
            "server": {
                "name": SERVER_NAME,
                "version": SERVER_VERSION,
            },
            "protocol_versions_supported": list(SUPPORTED_PROTOCOL_VERSIONS),
            "capabilities": {"tools": True, "prompts": False, "resources": False},
            "tools": ["ihui.echo", "ihui.now_utc", "ihui.capabilities"],
            "transports": ["sse", "streamable-http", "stdio"],
        }

    mcp.add_tool(
        ihui_capabilities,
        name="ihui.capabilities",
        description="返回本 MCP 服务器实例的能力与工具清单(只读)",
    )

    return mcp


# 模块级单例(仿 services/memory.py 懒加载模式)
_mcp_server_instance: MCPServer | None = None


def get_mcp_server() -> MCPServer:
    """返回模块级 MCPServer 单例(懒加载)。"""
    global _mcp_server_instance
    if _mcp_server_instance is None:
        _mcp_server_instance = _build_mcp_server()
    return _mcp_server_instance


# =========================================================================
# Transport handlers(返回 ASGI 可挂载入口;无副作用,惰性构建)
# =========================================================================

def handler_sse(server: MCPServer | None = None) -> Any:
    """SSE transport 的 ASGI 入口。挂载路径前缀自带 /sse 与 /messages/。"""
    srv = server or get_mcp_server()
    return srv.sse_app(
        sse_path=ENDPOINT_SSE,
        message_path=ENDPOINT_MESSAGES,
        host="0.0.0.0",
    )


def handler_streamable_http(server: MCPServer | None = None) -> Any:
    """Streamable HTTP transport 的 ASGI 入口(单端点 /streamable)。"""
    srv = server or get_mcp_server()
    return srv.streamable_http_app(
        streamable_http_path=ENDPOINT_STREAMABLE,
        host="0.0.0.0",
        json_response=False,  # 发送方为外部 LLM Host,倾向事件流;客户端按 Accept 自适应
    )


def handler_stdio(server: MCPServer | None = None) -> Any:
    """stdio transport 处理器(供 Claude Desktop / Cursor 等本地拉起)。

    stdio 无法像 SSE / Streamable 那样返回可挂载的 ASGI app —— 它必须阻塞式
    占用进程的标准输入/输出(MCP over stdin/stdout),直到宿主关闭子进程。
    故返回一个无参 callable,调用即同步阻塞运行 stdio transport
    (等价于 ``MCPServer.run(transport="stdio")``)。

    对外接入形态(claude_desktop_config.json 片段,见 generate_client_config):
      command: <python>   args: ["-m", "app.services.mcp_export_run"]
    """
    srv = server or get_mcp_server()

    def _run_stdio(*_a: Any, **_k: Any) -> None:
        srv.run(transport="stdio")

    return _run_stdio


# =========================================================================
# 一键接入配置 + host/DNS-rebinding 校验(供对外暴露时粘贴即用与防护)
# =========================================================================

def generate_client_config(
    transport: str = TRANSPORT_STDIO,
    base_url: str | None = None,
) -> dict[str, Any]:
    """生成可直接粘贴的一键接入配置。

    - transport="stdio":         返回 Claude Desktop 的 ``claude_desktop_config.json``
                                 ``mcpServers`` 片段(command + args,以当前解释器拉起
                                 ``app.services.mcp_export_run``);
    - transport="sse"/"streamable-http": 返回 URL 形态接入(base_url + 端点路径),
                                 适用于 Cursor / Claude Code 等的 mcp.json 或自研宿主。

    Args:
        transport: "stdio" | "sse" | "streamable-http"
        base_url:  对外暴露的 HTTP 基础地址,如 "http://127.0.0.1:8000" 或
                   "https://mcp.example.com" ;缺省用 DEFAULT_EXTERNAL_BASE_URL。
    """
    transport = (transport or TRANSPORT_STDIO).strip().lower()
    if transport == TRANSPORT_STDIO:
        entry: dict[str, Any] = {
            "command": sys.executable,
            "args": ["-m", MCP_EXPORT_RUN_MODULE],
        }
    elif transport in (TRANSPORT_SSE, TRANSPORT_STREAMABLE_HTTP):
        endpoint = ENDPOINT_SSE if transport == TRANSPORT_SSE else ENDPOINT_STREAMABLE
        base = (base_url or DEFAULT_EXTERNAL_BASE_URL).rstrip("/")
        entry = {"url": f"{base}{MCP_EXPORT_PREFIX}{endpoint}"}
    else:
        raise ValueError(
            f"不支持的 transport: {transport!r}(支持 stdio|sse|streamable-http)"
        )
    return {"mcpServers": {MCP_SERVER_CLIENT_NAME: entry}}


def validate_request_host(
    host: str,
    allowed_devices: list[str] | set[str] | tuple[str, ...] | None = None,
) -> bool:
    """校验进入对外 HTTP transport 的请求 Host,防 host 头 / DNS-rebinding 攻击。

    规则:
      - 回环主机(localhost / 127.0.0.1 / ::1)默认放行(仅本机可连);
      - ``0.0.0.0`` / ``*`` / 空 / 通配地址视为不安全,一律拒绝;
      - 回环之外的任意主机必须显式出现在 ``allowed_devices`` 白名单中,否则拒绝。

    这是**可注入的校验函数**: 把 ``_ExportDispatcher.__call__`` 入口处的 scope
    解析出的 host 交给它,拒绝时返回 403。仅新增本函数不改变现有挂载行为——
    是否接入由宿主决定(默认不接入即不影响 mcp_export 现有行为)。

    Args:
        host: 请求 Host 头的主机部分(已去掉端口 / 方括号),可为空串。
        allowed_devices: 额外放行的白名单(域名或 IP);缺省为空(仅回环)。
            list/set/tuple 均可;内部会做小写归一化比对。
    """
    h = (host or "").strip().lower().rstrip(".").strip()
    if h in UNSAFE_HOST_SENTINELS:
        return False
    if h in LOOPBACK_HOSTS:
        return True
    allow = {
        (str(x) or "").strip().lower().rstrip(".").strip()
        for x in (allowed_devices or ())
    }
    return h in allow


def compute_external_url(config: dict[str, Any]) -> str:
    """依据宿主配置计算最终对外暴露的 MCP 端点 URL。

    Args:
        config: 至少含 host / port / scheme / transport 的字典;可选 prefix。
            其中 transport 仅支持 "sse" 或 "streamable-http"(stdio 无对外 URL)。
            例: {"scheme":"https","host":"mcp.example.com","port":443,
                 "transport":"streamable-http"}
    """
    transport = (config.get("transport") or TRANSPORT_STREAMABLE_HTTP).strip().lower()
    if transport == TRANSPORT_STDIO:
        raise ValueError("stdio transport 无对外 URL,无需 compute_external_url")
    scheme = (config.get("scheme") or "http").rstrip(":").lower()
    host = str(config.get("host") or "127.0.0.1")
    port = config.get("port")
    prefix = str(config.get("prefix") or MCP_EXPORT_PREFIX).rstrip("/") or "/"

    if transport == TRANSPORT_SSE:
        endpoint = ENDPOINT_SSE
    elif transport == TRANSPORT_STREAMABLE_HTTP:
        endpoint = ENDPOINT_STREAMABLE
    else:
        raise ValueError(f"compute_external_url 不支持 transport: {transport!r}")

    # IPv6 字面量需加方括号(选项含普通域名/IPv4/已带括号的 IPv6)
    netloc_host = host if (host.startswith("[") or ":" not in host) else f"[{host}]"
    netloc = netloc_host if not port else f"{netloc_host}:{port}"
    return f"{scheme}://{netloc}{prefix}{endpoint}"


class _ExportDispatcher:
    """按路径把请求分发给 SSE / Streamable 两个 transport 子应用。

    挂载在 ``/api/mcp/export`` 下,由 FastAPI/Starlette 裁剪前缀后,
    这里按剩余 path 分派:
      /sse        -> SSE 事件流 GET
      /messages/  -> SSE POST
      /streamable -> Streamable HTTP POST/GET
    """

    def __init__(self, server: MCPServer | None = None) -> None:
        self._server = server or get_mcp_server()
        self._sse = handler_sse(self._server)
        self._streamable = handler_streamable_http(self._server)
        # StreamableHTTP 的 session manager 需在其 Starlette app 的 lifespan 中
        # 调 run() 才会初始化 task group。我们绕过 Starlette Mount 直接调用子应用,
        # 故在此手动持有其生命周期(惰性、单例、持续到进程结束)。
        self._streamable_manager = getattr(
            self._server._lowlevel_server, "_session_manager", None
        )
        self._manager_lock: Any = None
        self._manager_task: Any = None

    async def _ensure_manager_running(self) -> None:
        """确保 StreamableHTTP session manager 已运行(幂等),失败则任其报错走框架异常。"""
        mgr = self._streamable_manager
        if mgr is None or getattr(mgr, "_task_group", None) is not None:
            return
        if self._manager_lock is None:
            self._manager_lock = asyncio.Lock()
        async with self._manager_lock:
            if getattr(mgr, "_task_group", None) is not None:
                return
            if self._manager_task is None or self._manager_task.done():

                async def _hold() -> None:
                    async with mgr.run():
                        await asyncio.Event().wait()  # 长期持有至进程退出

                self._manager_task = asyncio.create_task(_hold())
        # 等待就绪(首个请求与 run() 进入之间可能竞争)
        for _ in range(500):
            if getattr(mgr, "_task_group", None) is not None:
                return
            await asyncio.sleep(0.01)

    async def __call__(
        self,
        scope: dict[str, Any],
        receive: Callable[..., Any],
        send: Callable[..., Any],
    ) -> None:
        if scope.get("type") != "http":
            await self._streamable(scope, receive, send)
            return
        # Starlette Mount 对纯 ASGI callable 不会裁剪前缀,这里自行按 MCP_EXPORT_PREFIX
        # 计算子路径,并把前缀写入 child root_path(供 SSE 端点事件回告正确的消息 URL)。
        rel = scope.get("path", "")
        prefix = MCP_EXPORT_PREFIX
        if rel.startswith(prefix):
            rel = rel[len(prefix):] or "/"
        rel = rel or "/"

        child = dict(scope)
        child["path"] = rel
        child["root_path"] = prefix

        if rel == ENDPOINT_SSE or rel.startswith(ENDPOINT_SSE + "/"):
            await self._sse(child, receive, send)
            return
        if rel == ENDPOINT_MESSAGES or rel.startswith(ENDPOINT_MESSAGES):
            # SSE 消息端点(POST 的 JSON-RPC 请求),交给 SSE transport 子应用
            await self._sse(child, receive, send)
            return
        if rel == ENDPOINT_STREAMABLE or rel.startswith(ENDPOINT_STREAMABLE + "/"):
            await self._ensure_manager_running()
            await self._streamable(child, receive, send)
            return
        resp = JSONResponse(
            {"error": "not_found", "message": f"未知 MCP export 端点: {rel}"},
            status_code=404,
        )
        await resp(scope, receive, send)

    def app(self) -> Any:
        return self


_export_app_instance: Any | None = None


def get_export_app() -> Any:
    """返回可挂载的 ASGI 应用(懒加载单例)。"""
    global _export_app_instance
    if _export_app_instance is None:
        _export_app_instance = _ExportDispatcher(get_mcp_server()).app()
    return _export_app_instance


def mount_to_app(app: Any, prefix: str = MCP_EXPORT_PREFIX) -> None:
    """把 MCP Export 子应用挂载到 FastAPI/ASGI 主应用。

    Args:
        app: 目标 FastAPI/Starlette 应用(需有 .mount 方法)
        prefix: 挂载路径前缀(默认 /api/mcp/export)
    """
    if not hasattr(app, "mount"):
        raise TypeError("mount_to_app 需要支持 .mount() 的 ASGI 应用(FastAPI/Starlette)")
    app.mount(prefix, app=get_export_app())
    logger.info("[mcp_export] 已挂载 MCP Server 到 %s", prefix)


def is_enabled() -> bool:
    """环境变量开关: ENABLE_MCP_EXPORT=true 才挂载(默认关闭)。"""
    val = (os.getenv(ENABLE_MCP_EXPORT_ENV) or "").strip().lower()
    return val in ("1", "true", "yes", "on")
# ⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌​​‌‌‌‌​‌​‍​‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌​‌‌​‌​​​‌‌​​​‌​​‍​​‌​‌‌​‌‍​‌​​‌​​​‍​‌‌​​‌‌​​‌​​‌​‌‌​​‌‌‌​​‍​‍​‌‌​​‌​​‌​‌​‌​‌‌​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌​​‌​‌​‌‌‌​‌‍​‌​​‌​​​‍​‌‌​​​​​‌‍​⁠