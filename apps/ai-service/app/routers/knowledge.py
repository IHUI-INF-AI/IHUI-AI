# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G5 编译式知识引擎·HTTP 面(2026-10-30 立项)。

两端点(身份只从承载层 Depends(get_current_user_id) 进来,§5 纪律):

  POST /api/knowledge/compile  {project_id, dry_run?, workspace_path?, ttl_days?}
    → {code, message, data:{cards:N, wiki_files:M, rejected:[{reason}], source_hash}}
  GET  /api/knowledge/cards?project_id=&workspace_path=
    → data:{cards:[有效卡], total}(TTL 过期卡已在读取面过滤)

workspace_root 解析:显式 workspace_path 优先,否则取服务进程 cwd(CLI 在项目目录
内运行时由调用方显式传入 process.cwd())。编译本体全在
services/knowledge_compiler.py(确定性、零 LLM),本路由只做承载与落点解析。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.core.jwt_auth import get_current_user_id
from app.services.knowledge_compiler import compile_project, load_active_cards, slugify

router = APIRouter()


def _resolve_workspace_root(workspace_path: str | None) -> Path:
    """落点解析:显式路径优先(必须存在),缺省取进程 cwd。"""
    if workspace_path:
        p = Path(workspace_path).expanduser()
        if not p.is_dir():
            raise HTTPException(status_code=400, detail=f"workspace_path 不存在: {workspace_path}")
        return p
    return Path.cwd()


@router.post("/knowledge/compile")
async def knowledge_compile(
    payload: dict[str, Any] = Body(...),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """编译项目知识卡片 + wiki(dry_run=true 只算不写盘)。"""
    project_id = str(payload.get("project_id") or "").strip()
    if not project_id:
        raise HTTPException(status_code=400, detail="project_id 不能为空")
    workspace_root = _resolve_workspace_root(payload.get("workspace_path"))
    ttl_raw = payload.get("ttl_days")
    ttl_days = int(ttl_raw) if isinstance(ttl_raw, (int, float)) and ttl_raw > 0 else 30
    result = await compile_project(
        project_id,
        workspace_root,
        user_id=user_id,
        dry_run=bool(payload.get("dry_run")),
        ttl_days=ttl_days,
    )
    return {"code": 0, "message": "ok", "data": result}


@router.get("/knowledge/cards")
async def knowledge_cards(
    project_id: str = Query(..., min_length=1),
    workspace_path: str | None = Query(None),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """读取指定项目的有效知识卡片(TTL 过期已过滤)。"""
    workspace_root = _resolve_workspace_root(workspace_path)
    cards = load_active_cards(workspace_root, slugify(project_id))
    return {"code": 0, "message": "ok", "data": {"cards": cards, "total": len(cards)}}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
