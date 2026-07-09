"""MCP 路由(10 端点)。

提供工具、资源、提示词、skill、slash 命令的查询与调用。
"""

from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.mcp_server import mcp_server
from ..services.skills import skill_registry
from ..services.slash_commands import slash_command_registry

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
# 工具端点
# ---------------------------------------------------------------------------


@router.get("/mcp/tools")
async def list_tools() -> dict[str, Any]:
    """列出全部 MCP 工具。"""
    tools = [asdict(t) for t in mcp_server.list_tools()]
    return {"tools": tools, "count": len(tools)}


@router.post("/mcp/tools/call")
async def call_tool(req: ToolCallRequest) -> dict[str, Any]:
    """调用指定 MCP 工具。"""
    result = await mcp_server.call_tool(req.name, req.arguments)
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
        for s in skill_registry.list()
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
    commands = [{"name": c.name, "description": c.description} for c in slash_command_registry.list()]
    return {"commands": commands, "count": len(commands)}


@router.post("/mcp/slash-commands")
async def execute_slash_command(req: SlashCommandRequest) -> dict[str, Any]:
    """执行 slash 命令。"""
    output = await slash_command_registry.execute(req.command, req.args, req.ctx)
    return {"command": req.command, "output": output}
