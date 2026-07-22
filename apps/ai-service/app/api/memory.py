"""四层记忆 + Dream 梦境 API 路由(挂载在 /api 前缀)。

端点(5 个核心 + 3 个辅助查询):
- POST   /api/memory/save       保存记忆到指定层(working/episodic/semantic/procedural)
- GET    /api/memory/recall     语义检索 semantic_memory(cosine similarity)
- POST   /api/memory/dream      触发梦境固化(consolidate:episodic → semantic + procedural)
- GET    /api/memory/topics     查询梦境主题(LLM 总结最近 10 条 semantic)
- DELETE /api/memory/forget     触发遗忘曲线衰减(episodic importance < threshold 删除)
- GET    /api/memory/working    辅助:查询 working memory
- GET    /api/memory/episodic   辅助:查询 episodic memory
- GET    /api/memory/procedural 辅助:查询 procedural memory

响应统一 {code, message, data} 格式(code=0 成功,500 失败)。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..services.dream_service import dream_service
from ..services.memory_service import memory_service

router = APIRouter()


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class MemorySaveRequest(BaseModel):
    """保存记忆请求。"""

    user_id: str = Field(..., description="用户 ID(UUID)")
    content: str = Field(..., description="记忆内容")
    layer: str = Field(
        ...,
        description="记忆层:working / episodic / semantic / procedural",
    )
    session_id: str | None = Field(None, description="会话 ID(working/episodic 必填)")
    summary: str | None = Field(None, description="摘要(episodic 用)")
    importance_score: float | None = Field(
        None, ge=0.0, le=1.0, description="重要性评分 0-1(默认 0.5)"
    )
    metadata: dict[str, Any] | None = Field(None, description="元数据")


class DreamRequest(BaseModel):
    """梦境固化请求。"""

    user_id: str = Field(..., description="用户 ID(UUID)")


# ---------------------------------------------------------------------------
# 核心端点
# ---------------------------------------------------------------------------


@router.post("/memory/save")
async def save_memory(req: MemorySaveRequest) -> dict[str, Any]:
    """保存记忆到指定层。"""
    try:
        result = await memory_service.save(
            user_id=req.user_id,
            content=req.content,
            layer=req.layer,
            session_id=req.session_id,
            summary=req.summary,
            importance_score=req.importance_score,
            metadata=req.metadata,
        )
        return {"code": 0, "message": "ok", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        return {"code": 500, "message": f"保存失败: {e}", "data": None}


@router.get("/memory/recall")
async def recall_memory(
    user_id: str = Query(..., description="用户 ID(UUID)"),
    query: str = Query(..., description="语义检索查询文本"),
    top_k: int = Query(5, ge=1, le=50, description="返回 top-k 条"),
) -> dict[str, Any]:
    """语义检索 semantic_memory(cosine similarity)。"""
    try:
        results = await memory_service.recall(user_id, query, top_k=top_k)
        return {"code": 0, "message": "ok", "data": results}
    except Exception as e:
        return {"code": 500, "message": f"检索失败: {e}", "data": None}


@router.post("/memory/dream")
async def dream(req: DreamRequest) -> dict[str, Any]:
    """触发梦境固化(consolidate:episodic → semantic + procedural)。"""
    try:
        result = await dream_service.consolidate(req.user_id)
        return {"code": 0, "message": "ok", "data": result}
    except Exception as e:
        return {"code": 500, "message": f"梦境固化失败: {e}", "data": None}


@router.get("/memory/topics")
async def dream_topics(
    user_id: str = Query(..., description="用户 ID(UUID)"),
) -> dict[str, Any]:
    """查询最近梦境主题(LLM 总结最近 10 条 semantic_memory)。"""
    try:
        result = await dream_service.dream_topic(user_id)
        return {"code": 0, "message": "ok", "data": result}
    except Exception as e:
        return {"code": 500, "message": f"主题生成失败: {e}", "data": None}


@router.delete("/memory/forget")
async def forget_memory(
    user_id: str = Query(..., description="用户 ID(UUID)"),
    threshold: float = Query(0.1, ge=0.0, le=1.0, description="遗忘阈值"),
) -> dict[str, Any]:
    """触发遗忘曲线衰减(episodic importance < threshold 删除)。"""
    try:
        result = await dream_service.forget(user_id, threshold=threshold)
        return {"code": 0, "message": "ok", "data": result}
    except Exception as e:
        return {"code": 500, "message": f"遗忘失败: {e}", "data": None}


# ---------------------------------------------------------------------------
# 辅助查询端点
# ---------------------------------------------------------------------------


@router.get("/memory/working")
async def get_working(
    session_id: str = Query(..., description="会话 ID"),
    limit: int = Query(50, ge=1, le=200, description="返回条数上限"),
) -> dict[str, Any]:
    """查询 working memory(当前会话内存缓冲)。"""
    items = await memory_service.get_working(session_id, limit=limit)
    return {"code": 0, "message": "ok", "data": items}


@router.get("/memory/episodic")
async def list_episodic(
    user_id: str = Query(..., description="用户 ID(UUID)"),
    session_id: str | None = Query(None, description="会话 ID(可选过滤)"),
    limit: int = Query(100, ge=1, le=500, description="返回条数上限"),
) -> dict[str, Any]:
    """查询 episodic memory(历史会话片段)。"""
    items = await memory_service.list_episodic(
        user_id, session_id=session_id, limit=limit
    )
    return {"code": 0, "message": "ok", "data": items}


@router.get("/memory/procedural")
async def list_procedural(
    user_id: str = Query(..., description="用户 ID(UUID)"),
    limit: int = Query(100, ge=1, le=500, description="返回条数上限"),
) -> dict[str, Any]:
    """查询 procedural memory(技能/工具用法模式)。"""
    items = await memory_service.list_procedural(user_id, limit=limit)
    return {"code": 0, "message": "ok", "data": items}
