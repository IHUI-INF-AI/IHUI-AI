# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP 路由(10 端点)。

提供工具、资源、提示词、skill、slash 命令的查询与调用。
"""

import logging
from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..services.mcp_server import mcp_server, sampling_handler
from ..services.skills import skill_registry
from ..services.slash_commands import slash_command_registry
from ..services.mcp_client import (
    DEFAULT_TIMEOUT,
    TRANSPORT_SSE,
    TRANSPORT_STDIO,
    MCPClientConfig,
    get_mcp_client_manager,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class ToolCallRequest(BaseModel):
    """工具调用请求。"""

    name: str = Field(..., description="工具名称")
    arguments: dict[str, Any] = Field(default_factory=dict, description="工具参数")


class PromptInvokeRequest(BaseModel):
    """提示词调用请求。"""

    name: str = Field(..., description="提示词名称")
    arguments: dict[str, Any] = Field(default_factory=dict, description="提示词参数")


class SlashCommandRequest(BaseModel):
    """Slash 命令执行请求。"""

    command: str = Field(..., description="命令名(不含 /)")
    args: list[str] = Field(default_factory=list, description="命令参数")
    ctx: dict[str, Any] = Field(default_factory=dict, description="上下文")


# ---------------------------------------------------------------------------
# 外部 MCP Server 管理请求模型(2026-08-30 立,外部 MCP 生态接线)
# ---------------------------------------------------------------------------


class ExternalServerRegisterRequest(BaseModel):
    """外部 MCP Server 注册请求。

    transport: stdio | sse
    - stdio 模式必须提供 command(可带 args/env)
    - sse 模式必须提供 url
    """

    name: str = Field("", description="Server 名称(唯一,1-100 字符)")
    transport: str = Field("", description="传输模式: stdio | sse")
    command: str = Field("", description="stdio 模式启动命令")
    args: list[str] = Field(default_factory=list, description="stdio 模式命令参数")
    env: dict[str, str] = Field(default_factory=dict, description="stdio 模式环境变量")
    url: str = Field("", description="sse 模式 URL")
    timeout: float = Field(DEFAULT_TIMEOUT, ge=1, le=30, description="调用超时(秒,上限 30)")
    reconnect: bool = Field(True, description="断线自动重连")
    max_reconnect_attempts: int = Field(3, ge=0, le=20, description="最大重连次数")


class ExternalToolCallRequest(BaseModel):
    """外部 MCP 工具调用请求。"""

    server: str = Field(..., min_length=1, description="外部 MCP Server 名称")
    tool: str = Field(..., min_length=1, description="工具名称")
    arguments: dict[str, Any] = Field(default_factory=dict, description="工具参数")


# ---------------------------------------------------------------------------
# 工具端点
# ---------------------------------------------------------------------------


@router.get("/mcp/tools")
async def list_tools() -> dict[str, Any]:
    """列出全部 MCP 工具。"""
    tools = [asdict(t) for t in mcp_server.list_tools()]
    return {"tools": tools, "count": len(tools)}


@router.post("/mcp/tools/call")
async def call_tool(req: ToolCallRequest, request: Request) -> dict[str, Any]:
    """调用指定 MCP 工具(带权限矩阵校验)。

    从 request.state 读取用户上下文(JWTAuthMiddleware 注入):
    - role_id: 传给 mcp_server.call_tool 做 admin 专属工具权限校验
    - user_id: G6(2026-07-26)透传给 knowledge_lookup 查 long_term_memory 源
    """
    user_role = getattr(request.state, "role_id", 0) or 0
    user_id = getattr(request.state, "user_id", None)
    result = await mcp_server.call_tool(
        req.name, req.arguments, user_role=user_role, user_id=user_id
    )
    return result


# ---------------------------------------------------------------------------
# 资源端点
# ---------------------------------------------------------------------------


@router.get("/mcp/resources")
async def list_resources() -> dict[str, Any]:
    """列出全部 MCP 资源。"""
    resources = [asdict(r) for r in mcp_server.list_resources()]
    return {"resources": resources, "count": len(resources)}


@router.get("/mcp/resources/{uri:path}")
async def read_resource(uri: str) -> dict[str, Any]:
    """读取指定 URI 的 MCP 资源。"""
    result = await mcp_server.read_resource(uri)
    return result


# ---------------------------------------------------------------------------
# 提示词端点
# ---------------------------------------------------------------------------


@router.get("/mcp/prompts")
async def list_prompts() -> dict[str, Any]:
    """列出全部 MCP 提示词。"""
    prompts = [asdict(p) for p in mcp_server.list_prompts()]
    return {"prompts": prompts, "count": len(prompts)}


@router.post("/mcp/prompts/invoke")
async def invoke_prompt(req: PromptInvokeRequest) -> dict[str, Any]:
    """调用指定 MCP 提示词。"""
    return mcp_server.invoke_prompt(req.name, req.arguments)


# ---------------------------------------------------------------------------
# Skill 端点
# ---------------------------------------------------------------------------


@router.get("/mcp/skills")
async def list_skills() -> dict[str, Any]:
    """列出全部预置 skill。"""
    skills = [
        {"name": s.name, "description": s.description, "prompt_template": s.prompt_template}
        for s in skill_registry.list_skills()
    ]
    return {"skills": skills, "count": len(skills)}


@router.get("/mcp/skills/{name}")
async def get_skill(name: str) -> dict[str, Any]:
    """获取指定 skill 详情。"""
    skill = skill_registry.get(name)
    if not skill:
        raise HTTPException(status_code=404, detail=f"skill 不存在: {name}")
    return {
        "name": skill.name,
        "description": skill.description,
        "prompt_template": skill.prompt_template,
    }


# ---------------------------------------------------------------------------
# Slash 命令端点
# ---------------------------------------------------------------------------


@router.get("/mcp/slash-commands")
async def list_slash_commands() -> dict[str, Any]:
    """列出全部 slash 命令。"""
    commands = [{"name": c.name, "description": c.description} for c in slash_command_registry.list_commands()]
    return {"commands": commands, "count": len(commands)}


@router.post("/mcp/slash-commands")
async def execute_slash_command(req: SlashCommandRequest) -> dict[str, Any]:
    """执行 slash 命令。"""
    output = await slash_command_registry.execute(req.command, req.args, req.ctx)
    return {"command": req.command, "output": output}


# ---------------------------------------------------------------------------
# Sampling 端点(MCP 反向调用 LLM,P1-3)
# ---------------------------------------------------------------------------


@router.post("/mcp/sampling")
async def mcp_sampling(request: Request) -> dict[str, Any]:
    """MCP Sampling 反向调用(让 MCP 工具请求 LLM 推理)。

    body: McpSamplingRequest 字典(callerTool/messages/model/maxTokens/
          temperature/context),经 5 层护栏(速率/白名单/轮数/超时/审计)后
          调用 llm_gateway.complete。
    """
    body = await request.json()
    result = await sampling_handler.handle_sampling(body)
    return {"code": 0, "message": "ok", "data": result}


@router.get("/mcp/sampling/stats")
async def mcp_sampling_stats() -> dict[str, Any]:
    """Sampling 审计统计(total_calls/blocked_calls/guardrails)。"""
    return {"code": 0, "message": "ok", "data": sampling_handler.get_stats()}


@router.get("/mcp/sampling/audit-logs")
async def mcp_sampling_audit_logs() -> dict[str, Any]:
    """Sampling 审计日志列表。"""
    return {"code": 0, "message": "ok", "data": sampling_handler.get_audit_logs()}


# ---------------------------------------------------------------------------
# 外部 MCP Server 管理端点(2026-08-30 立,外部 MCP 生态接线)
# 通过 MCPClientManager 单例管理 stdio/SSE 外部 MCP Server 的注册/连接/工具发现/调用。
# 所有端点 try/except 包裹,失败返回 {"error": ...} 而非抛 500。
# ---------------------------------------------------------------------------


def _server_info(manager: Any, name: str) -> dict[str, Any]:
    """构造单个已注册 Server 的摘要信息。"""
    client = manager.get_client(name)
    if client is None:
        return {}
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
    }


@router.get("/mcp/external/servers", response_model=None)
async def list_external_servers() -> dict[str, Any]:
    """列出所有已注册的外部 MCP Server(含连接状态)。"""
    try:
        manager = get_mcp_client_manager()
        servers = manager.list_registered()
        return {"servers": servers, "count": len(servers)}
    except Exception as e:
        logger.error("列出外部 MCP Server 失败: %s", e)
        return JSONResponse(status_code=500, content={"error": f"列出外部 MCP Server 失败: {e}"})


@router.post("/mcp/external/servers", response_model=None)
async def register_external_server(
    req: ExternalServerRegisterRequest,
) -> dict[str, Any] | JSONResponse:
    """注册外部 MCP Server 并连接。"""
    try:
        name = req.name.strip()
        if not name:
            return JSONResponse(status_code=400, content={"error": "name 为必填"})
        transport = req.transport.strip()
        if transport not in (TRANSPORT_STDIO, TRANSPORT_SSE):
            return JSONResponse(
                status_code=400,
                content={"error": f"transport 必须为 {TRANSPORT_STDIO} 或 {TRANSPORT_SSE}"},
            )
        if transport == TRANSPORT_STDIO and not req.command.strip():
            return JSONResponse(status_code=400, content={"error": "stdio 模式缺少 command"})
        if transport == TRANSPORT_SSE and not req.url.strip():
            return JSONResponse(status_code=400, content={"error": "sse 模式缺少 url"})

        manager = get_mcp_client_manager()
        if manager.get_client(name) is not None:
            return JSONResponse(status_code=409, content={"error": f"MCP Server 已存在: {name}"})

        cfg = MCPClientConfig(
            name=name,
            transport=transport,
            command=req.command,
            args=req.args or [],
            env=req.env or {},
            url=req.url,
            timeout=min(float(req.timeout or DEFAULT_TIMEOUT), 30.0),
            reconnect=req.reconnect,
            max_reconnect_attempts=req.max_reconnect_attempts,
        )
        manager.register(cfg)
        client = manager.get_client(name)
        if client is not None:
            try:
                await client.connect()
            except Exception as e:
                logger.warning("外部 MCP Server 连接失败(%s): %s", name, e)
        return JSONResponse(status_code=201, content=_server_info(manager, name))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("注册外部 MCP Server 失败: %s", e)
        return JSONResponse(status_code=500, content={"error": f"注册外部 MCP Server 失败: {e}"})


@router.delete("/mcp/external/servers/{name}", response_model=None)
async def unregister_external_server(name: str) -> dict[str, Any] | JSONResponse:
    """注销外部 MCP Server 并断开连接。"""
    try:
        manager = get_mcp_client_manager()
        if manager.get_client(name) is None:
            return JSONResponse(status_code=404, content={"error": f"MCP Server 不存在: {name}"})
        await manager.unregister_async(name)
        return {"deleted": name, "ok": True}
    except Exception as e:
        logger.error("注销外部 MCP Server 失败(%s): %s", name, e)
        return JSONResponse(status_code=500, content={"error": f"注销外部 MCP Server 失败: {e}"})


@router.post("/mcp/external/servers/{name}/connect", response_model=None)
async def connect_external_server(name: str) -> dict[str, Any] | JSONResponse:
    """(重)连接指定外部 MCP Server。"""
    try:
        manager = get_mcp_client_manager()
        client = manager.get_client(name)
        if client is None:
            return JSONResponse(status_code=404, content={"error": f"MCP Server 不存在: {name}"})
        await client.connect()
        return _server_info(manager, name)
    except Exception as e:
        logger.error("连接外部 MCP Server 失败(%s): %s", name, e)
        return JSONResponse(status_code=500, content={"error": f"连接外部 MCP Server 失败: {e}"})


@router.get("/mcp/external/tools", response_model=None)
async def list_external_tools() -> dict[str, Any]:
    """列出所有已连接外部 MCP Server 的工具。"""
    try:
        manager = get_mcp_client_manager()
        tools = await manager.list_available_tools_async()
        return {"tools": [asdict(t) for t in tools], "count": len(tools)}
    except Exception as e:
        logger.error("列出外部 MCP 工具失败: %s", e)
        return JSONResponse(status_code=500, content={"error": f"列出外部 MCP 工具失败: {e}"})


@router.post("/mcp/external/tools/call", response_model=None)
async def call_external_tool(req: ExternalToolCallRequest) -> dict[str, Any] | JSONResponse:
    """调用外部 MCP Server 的工具。"""
    try:
        manager = get_mcp_client_manager()
        result = await manager.call_external_tool(req.server, req.tool, req.arguments)
        if isinstance(result, dict) and result.get("ok") is False:
            return JSONResponse(status_code=400, content={"error": result.get("error", "调用失败")})
        return result
    except Exception as e:
        logger.error("调用外部 MCP 工具失败(%s/%s): %s", req.server, req.tool, e)
        return JSONResponse(status_code=500, content={"error": f"调用外部 MCP 工具失败: {e}"})
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
