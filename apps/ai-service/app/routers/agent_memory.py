# Agent long-term memory management router (frontend-visible CRUD).
#
# Mounting: this module only exports `router: APIRouter(prefix="/memory")`. The
# master mounts it in main.py as:
#   app.include_router(agent_memory_router.router, prefix="/api", tags=["memory"])
# yielding the final endpoints:
#   GET  /api/memory/entries                          list + filter + paginate
#   POST /api/memory/entries                          manually add one entry
#   PUT  /api/memory/entries/{memory_id}              update content/type/tags/importance
#   DELETE /api/memory/entries/{memory_id}            remove own entry
#   POST /api/memory/entries/{memory_id}/important    bump importance (+1, capped 5)
#   GET  /api/memory/recall                           preview recall context block + hits
#   POST /api/memory/extract                          auto-extract candidates and import
#
# Storage: reuses AgentLongTermMemory (in-process dict + data JSON persistence).
# Auth: reuse get_current_user_id; every entry is isolated/filtered by user_id.
# Response: unified envelope {code, message, data} aligned with the web api-client.

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..core.jwt_auth import get_current_user_id
from ..services.agent_longterm_memory import (
    IMPORTANCE_MAX,
    IMPORTANCE_MIN,
    MEMORY_TYPES,
    agent_longterm_memory,
    extract_candidates_from_session,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/longterm-memory", tags=["memory"])

_MAX_PAGE_SIZE = 100
_MAX_RECALL_K = 20

# ---------------------------------------------------------------------------
# request models
# ---------------------------------------------------------------------------


class CreateMemoryRequest(BaseModel):
    type: str = "lesson_learned"
    content: str = ""
    keywords: list[str] = []
    tags: list[str] = []


class UpdateMemoryRequest(BaseModel):
    content: str | None = None
    type: str | None = None
    tags: list[str] | None = None
    importance: int | None = None


class ExtractMemoryRequest(BaseModel):
    messages: list[dict[str, Any]] = []
    source_session_id: str | None = None


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _field_update(entry: dict[str, Any], req: UpdateMemoryRequest) -> dict[str, Any]:
    """Apply validated field updates onto one in-memory record (caller holds lock)."""
    if req.content is not None:
        entry["content"] = req.content.strip()
    if req.type is not None:
        entry["type"] = req.type
    if req.tags is not None:
        entry["tags"] = sorted(set(req.tags))
    if req.importance is not None:
        entry["importance"] = req.importance
    entry["updated_at"] = _now_iso()
    return entry


def _update_owned(memory_id: str, user_id: str, req: UpdateMemoryRequest) -> dict[str, Any]:
    """Update a memory record but only when it exists and belongs to the user.

    - memory_id not found -> raise 404
    - record owned by another user -> raise 403
    Returns the updated record copy.
    """
    existing = agent_longterm_memory.get(memory_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"记忆不存在: {memory_id}")
    if existing.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="无权操作该记忆")
    with agent_longterm_memory._lock:  # noqa: SLF001 - update not exposed by service
        agent_longterm_memory._load()  # noqa: SLF001
        record = agent_longterm_memory._data.get(memory_id)  # noqa: SLF001
        if record is None:
            raise HTTPException(status_code=404, detail=f"记忆不存在: {memory_id}")
        _field_update(record, req)
        agent_longterm_memory._persist()  # noqa: SLF001
    return dict(record)


# ---------------------------------------------------------------------------
# GET /memory/entries
# ---------------------------------------------------------------------------


@router.get("/entries")
async def list_entries(
    type: str = "",
    importance_min: int = 0,
    q: str = "",
    page: int = 1,
    page_size: int = 20,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """当前用户全部长期记忆(可选 type/importance_min/q 过滤),分页返回。"""
    page = max(1, page) if page else 1
    page_size = min(max(1, page_size) if page_size else 20, _MAX_PAGE_SIZE)
    entries = agent_longterm_memory.search(user_id, query=q, limit=100000)
    if type:
        entries = [e for e in entries if e.get("type") == type]
    if importance_min:
        entries = [e for e in entries if int(e.get("importance", 3)) >= importance_min]
    total = len(entries)
    start = (page - 1) * page_size
    items = entries[start : start + page_size]
    logger.info("memory list user=%s type=%s q=%r total=%s", user_id, type, q, total)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": items,
        },
    }


# ---------------------------------------------------------------------------
# POST /memory/entries
# ---------------------------------------------------------------------------


@router.post("/entries")
async def create_entry(
    req: CreateMemoryRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """手动新增一条记忆;校验必填,返回 memory_id。"""
    content = (req.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="记忆内容不能为空")
    if req.type not in MEMORY_TYPES:
        raise HTTPException(status_code=400, detail=f"非法记忆类型: {req.type}")
    entry = agent_longterm_memory.add(
        content,
        user_id=user_id,
        type=req.type,
        keywords=req.keywords,
        tags=req.tags,
        importance=3,
    )
    logger.info(
        "memory create user=%s type=%s id=%s",
        user_id,
        entry.get("type"),
        entry.get("memory_id"),
    )
    return {"code": 0, "message": "ok", "data": {"memory_id": entry["memory_id"], "entry": entry}}


# ---------------------------------------------------------------------------
# PUT /memory/entries/{memory_id}
# ---------------------------------------------------------------------------


@router.put("/entries/{memory_id}")
async def update_entry(
    memory_id: str,
    req: UpdateMemoryRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """更新 content/tags/type/importance;仅允许操作本用户条目。"""
    if req.content is not None and not req.content.strip():
        raise HTTPException(status_code=400, detail="记忆内容不能为空")
    if req.type is not None and req.type not in MEMORY_TYPES:
        raise HTTPException(status_code=400, detail=f"非法记忆类型: {req.type}")
    if req.importance is not None and not (IMPORTANCE_MIN <= req.importance <= IMPORTANCE_MAX):
        raise HTTPException(
            status_code=400,
            detail=f"importance 需在 {IMPORTANCE_MIN}-{IMPORTANCE_MAX} 之间",
        )
    entry = _update_owned(memory_id, user_id, req)
    logger.info("memory update user=%s id=%s", user_id, memory_id)
    return {"code": 0, "message": "ok", "data": entry}


# ---------------------------------------------------------------------------
# DELETE /memory/entries/{memory_id}
# ---------------------------------------------------------------------------


@router.delete("/entries/{memory_id}")
async def delete_entry(
    memory_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """删除本用户一条记忆;不存在 404,越权 403。"""
    existing = agent_longterm_memory.get(memory_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"记忆不存在: {memory_id}")
    if existing.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="无权操作该记忆")
    agent_longterm_memory.remove(memory_id)
    logger.info("memory delete user=%s id=%s", user_id, memory_id)
    return {"code": 0, "message": "ok", "data": {"deleted": memory_id}}


# ---------------------------------------------------------------------------
# POST /memory/entries/{memory_id}/important
# ---------------------------------------------------------------------------


@router.post("/entries/{memory_id}/important")
async def mark_important(
    memory_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """提升 importance(+1,封顶 IMPORTANCE_MAX)。"""
    existing = agent_longterm_memory.get(memory_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"记忆不存在: {memory_id}")
    if existing.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="无权操作该记忆")
    new_imp = min(IMPORTANCE_MAX, int(existing.get("importance", 3)) + 1)
    entry = _update_owned(memory_id, user_id, UpdateMemoryRequest(importance=new_imp))
    logger.info("memory important user=%s id=%s importance=%s", user_id, memory_id, new_imp)
    return {"code": 0, "message": "ok", "data": entry}


# ---------------------------------------------------------------------------
# GET /memory/recall
# ---------------------------------------------------------------------------


@router.get("/recall")
async def recall(
    q: str = "",
    top_k: int = 5,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """检索并按 recall_for_context 格式化摘要块,返回命中条目供预览。"""
    if not q or not q.strip():
        raise HTTPException(status_code=400, detail="缺少查询参数 q")
    k = min(max(1, top_k) if top_k else 5, _MAX_RECALL_K)
    hits = agent_longterm_memory.search(user_id, query=q, limit=k)
    block = agent_longterm_memory.recall_for_context(user_id, query=q, top_k=k)
    logger.info("memory recall user=%s top_k=%s hits=%s", user_id, k, len(hits))
    return {
        "code": 0,
        "message": "ok",
        "data": {"top_k": k, "context_block": block, "hits": hits},
    }


# ---------------------------------------------------------------------------
# POST /memory/extract
# ---------------------------------------------------------------------------


@router.post("/extract")
async def extract_import(
    req: ExtractMemoryRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """从会话消息抽取候选记忆并批量导入。"""
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages 不能为空")
    candidates = extract_candidates_from_session(
        req.messages, session_id=req.source_session_id or "", user_id=user_id
    )
    result = agent_longterm_memory.bulk_import_from_extract(
        candidates, user_id=user_id, session_id=req.source_session_id
    )
    imported = result["added"] + result["merged"]
    logger.info(
        "memory extract user=%s total=%s added=%s merged=%s skipped=%s",
        user_id, result["total"], result["added"], result["merged"], result["skipped"],
    )
    return {
        "code": 0,
        "message": "ok",
        "data": {"imported": imported, "candidates": candidates, "stats": result},
    }