# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具路由(4 端点)。

提供工具的直接调用入口(绕过 MCP 协议)。
"""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from ..services.mcp_server import mcp_server

router = APIRouter()


class SearchCodebaseRequest(BaseModel):
    """代码库搜索请求。"""

    query: str = Field(..., description="搜索关键词或语义查询")
    path: str = Field(".", description="搜索路径")


class SearchWebRequest(BaseModel):
    """网页搜索请求。"""

    query: str = Field(..., description="搜索关键词")
    max_results: int = Field(5, description="最大结果数")


class AnalyzeCodeRequest(BaseModel):
    """代码分析请求。"""

    code: str = Field(..., description="待分析代码")
    language: str = Field("text", description="代码语言")


class InitAgentsMdRequest(BaseModel):
    """AGENTS.md 草稿生成请求。

    刻意**没有** output_path 字段:本端点只回传草稿,写盘由人工在 web 侧二次确认后
    经浏览器 File System Access 链完成,不存在静默写盘入口。
    """

    model_config = ConfigDict(extra="forbid")

    workspace_root: str = Field(
        "", description="待扫描的工作区根(须在 MCP_WORKSPACE_ROOTS 白名单内)"
    )


@router.post("/tools/search-codebase")
async def search_codebase(req: SearchCodebaseRequest) -> dict[str, Any]:
    """搜索代码库。"""
    return await mcp_server.call_tool(
        "search_codebase", {"query": req.query, "path": req.path}
    )


@router.post("/tools/search-web")
async def search_web(req: SearchWebRequest) -> dict[str, Any]:
    """网页搜索(DuckDuckGo Lite)。"""
    return await mcp_server.call_tool(
        "search_web", {"query": req.query, "max_results": req.max_results}
    )


@router.post("/tools/analyze-code")
async def analyze_code(req: AnalyzeCodeRequest) -> dict[str, Any]:
    """代码静态分析。"""
    return await mcp_server.call_tool(
        "analyze_code", {"code": req.code, "language": req.language}
    )


@router.post("/tools/init-agents-md")
async def init_agents_md_draft(req: InitAgentsMdRequest) -> dict[str, Any]:
    """生成 AGENTS.md 草稿文本(只回传,永不落盘)—— D118 落点②的 HTTP 出口。

    web「空 AGENTS.md 工作区」的一键生成入口经此端点取草稿,进可编辑文本域由用户
    确认后,再由浏览器 File System Access 链写盘;请求模型刻意不含 output_path,
    因此本端点没有静默写盘路径。

    准入复用 MCP 面同一守卫:`call_tool` → `_init_agents_md_guarded`
    (MCP_WORKSPACE_ROOTS 白名单根 + `path_guard` 敏感目录黑名单),不新造第二套判定。
    """
    return await mcp_server.call_tool(
        "init_agents_md", {"workspace_root": req.workspace_root}
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
