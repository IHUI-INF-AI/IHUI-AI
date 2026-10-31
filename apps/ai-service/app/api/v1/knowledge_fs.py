# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""KnowledgeFS 路由(挂载在 /api/v1/ai/knowledge-fs 前缀;2026-10-31 G2 立)。

端点(全部只读,对齐 Trae ckg Cfs* 家族的读半边):
- GET /list?prefix=/repo/<repoId>[/<dir>/]   列目录(单层投影)
- GET /read?path=/repo/<repoId>/<file>[#<symbol>]  读内容(切片诚实拼接)
- GET /stat?path=...                          路径元数据(不回内容)
- POST /search {query, repoId?, topK?}        语义检索 → 路径投影

鉴权与身份(与 codebase 检索同一条纪律,不另设规则):
- X-User-Id 头(内部服务通道)或 Authorization Bearer(用户 JWT);
- 二者皆无 ⇒ 401,不冒 anonymous(对比 knowledge_graph 的 anonymous 缺省 ——
  代码明文面比图谱面更敏感,归属隔离不可缺省)。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header
from pydantic import BaseModel, Field

from ...services.knowledge_fs import knowledge_fs

router = APIRouter()


class SearchRequest(BaseModel):
    """语义检索请求。"""

    query: str = Field(..., min_length=1, max_length=2000)
    repoId: str | None = None
    topK: int = Field(default=8, ge=1, le=50)


def _identity(
    authorization: str | None,
    x_user_id: str | None,
) -> tuple[str | None, str | None]:
    """从请求头解析 (internal_user_id, api_token)。"""
    api_token = None
    if authorization and authorization.lower().startswith("bearer "):
        api_token = authorization[7:].strip() or None
    return x_user_id, api_token


@router.get("/list")
async def list_dir(
    prefix: str,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> dict[str, Any]:
    """列目录。"""
    user_id, api_token = _identity(authorization, x_user_id)
    if not user_id and not api_token:
        return {"code": 401, "message": "无法确定调用者身份:知识文件系统按归属隔离", "data": None}
    return {"code": 0, "message": "ok", "data": await knowledge_fs.list_dir(prefix, user_id, api_token)}


@router.get("/read")
async def read_path(
    path: str,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> dict[str, Any]:
    """读内容。"""
    user_id, api_token = _identity(authorization, x_user_id)
    if not user_id and not api_token:
        return {"code": 401, "message": "无法确定调用者身份:知识文件系统按归属隔离", "data": None}
    return {"code": 0, "message": "ok", "data": await knowledge_fs.read(path, user_id, api_token)}


@router.get("/stat")
async def stat_path(
    path: str,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> dict[str, Any]:
    """路径元数据。"""
    user_id, api_token = _identity(authorization, x_user_id)
    if not user_id and not api_token:
        return {"code": 401, "message": "无法确定调用者身份:知识文件系统按归属隔离", "data": None}
    return {"code": 0, "message": "ok", "data": await knowledge_fs.stat(path, user_id, api_token)}


@router.post("/search")
async def search(
    req: SearchRequest,
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> dict[str, Any]:
    """语义检索 → 虚拟路径投影。"""
    user_id, api_token = _identity(authorization, x_user_id)
    if not user_id and not api_token:
        return {"code": 401, "message": "无法确定调用者身份:知识文件系统按归属隔离", "data": None}
    return {
        "code": 0,
        "message": "ok",
        "data": await knowledge_fs.search(
            req.query, user_id, repo_id=req.repoId, top_k=req.topK, api_token=api_token
        ),
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
