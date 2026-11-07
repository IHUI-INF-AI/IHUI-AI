# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具路由(5 端点)。

提供工具的直接调用入口(绕过 MCP 协议)。
"""

import asyncio
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from ..services.codebase_index_status import check_freshness, ensure_fresh, resolve_repo_id
from ..services.codebase_indexer import codebase_indexer
from ..services.codebase_symbol_catalog import search_local_catalog
from ..services.mcp_server import _validate_path_in_workspace, mcp_server

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


class CodebaseIndexRequest(BaseModel):
    """代码库索引能力请求(2026-11-06)。

    `action` 三档:
      - `status`  : 判定索引相对盘上代码的新鲜度(fresh/stale/expired/unknown/absent);
      - `search`  : 在**本地目录**里按文件/符号名检索(零远端,带行区间正文);
      - `refresh` : 不新鲜时刷新(stale 只重算漂移文件;未同意出域则一次远端都不发)。
    """

    model_config = ConfigDict(extra="forbid")

    action: Literal["status", "search", "refresh"]
    workspace_path: str = Field(..., description="仓库根(须在 MCP_WORKSPACE_ROOTS 白名单内)")
    repo_id: str | None = Field(None, description="索引归属 id(缺省按仓库根反查)")
    query: str = Field("", description="search 用:符号名/文件名/关键词")
    top_k: int = Field(10, ge=1, le=50, description="search 命中上限")
    kind: str | None = Field(None, description="search 用:符号类型过滤(function/class/file…)")
    path_glob: str | None = Field(None, description="search 用:路径 glob 限定")
    user_id: str | None = Field(None, description="refresh 用:出域同意与归属主体")
    force: bool = Field(False, description="refresh 用:即使 fresh 也收敛一轮")


def _require_workspace(workspace_path: str) -> Path:
    ok, detail = _validate_path_in_workspace(workspace_path)
    if not ok:
        raise HTTPException(status_code=400, detail=f"工作区路径被拒绝: {detail}")
    return Path(detail).resolve()


@router.post("/tools/codebase-index")
async def codebase_index(req: CodebaseIndexRequest) -> dict[str, Any]:
    """文件/符号级代码库索引能力(status / search / refresh)。

    准入复用 MCP 面同一守卫(`_validate_path_in_workspace`:白名单根 + path_guard),
    不新造第二套判定。`refresh` 的出域同意闸在 `ensure_fresh` 内部,**未同意 ⇒
    一次远端调用都不发**,回执 action=`consent-required`。
    """
    root = _require_workspace(req.workspace_path)
    repo_id = req.repo_id or resolve_repo_id(root, codebase_indexer)
    if req.action == "status":
        report = await asyncio.to_thread(
            check_freshness, str(root), repo_id=repo_id, indexer=codebase_indexer
        )
        return {"ok": True, "action": "status", "freshness": report.to_dict()}
    if req.action == "search":
        if not req.query.strip():
            raise HTTPException(status_code=400, detail="search 需要非空 query")
        catalog = codebase_indexer.load_catalog(repo_id, root)
        if catalog is None:
            raise HTTPException(
                status_code=409,
                detail=f"该仓没有文件/符号目录(repo_id={repo_id});先 refresh 或 index_codebase",
            )
        hits = await asyncio.to_thread(
            search_local_catalog,
            root,
            catalog,
            req.query,
            top_k=req.top_k,
            kind=req.kind,
            path_glob=req.path_glob,
        )
        return {
            "ok": True,
            "action": "search",
            "repo_id": repo_id,
            "catalog_state": catalog.state,
            "catalog_files": len(catalog.files),
            "catalog_symbols": catalog.symbol_count,
            "hits": hits,
        }
    outcome = await ensure_fresh(
        str(root),
        repo_id=repo_id,
        user_id=req.user_id,
        force=req.force,
        indexer=codebase_indexer,
    )
    return {
        "ok": outcome.action != "consent-required",
        "action": "refresh",
        "outcome": outcome.to_dict(),
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
