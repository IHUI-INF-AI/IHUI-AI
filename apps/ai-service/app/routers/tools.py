"""工具路由(3 端点)。

提供工具的直接调用入口(绕过 MCP 协议)。
"""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

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
