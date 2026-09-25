# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

端点级属主校验(2026-09-25 P0 水平越权收口):本文件此前把 user_id 当**请求参数**收,
从不与全局 JWT 中间件注入的主体(request.state.user_id)比对 —— 任何已登录用户填别人的
UUID 就能读/改/删别人的记忆(认证 ≠ 授权)。现每个带 user_id 的端点都经
`require_request_user_id`(`app/core/jwt_auth.py`,与 O19 agents 面同一份实现,不新造
第二套身份判定)解析令牌主体并强制对齐:
- 主体缺失 → 401(生产态;中间件/白名单配错也漏不出去);
- 主体与请求 user_id 不一致 → 403;
- **请求未带 user_id → 归属即令牌主体**(参数被丢弃,不参与"是谁"的决定);
- 仅当本进程根本没启用 JWT 校验(auth_globally_enforced() 为假)时依赖回落
  DEV_ANONYMOUS_PRINCIPAL,此时才放行请求参数(开发单机无租户可保护,非放宽)。
归属判定只有一个出口 `_resolve_owner`,它**返回**最终归属而不只是"校验通过与否" ——
调用方一律用返回值喂服务层,杜绝"校验了 A、却仍拿参数里的 B 去查库"的两张皮。
`/memory/working` 无 user_id 参数(仅 session_id 句柄),不在本票对齐面内
(session_id 归属另记,见交付报告"同型面")。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..core.jwt_auth import DEV_ANONYMOUS_PRINCIPAL, require_request_user_id
from ..services.dream_service import dream_service
from ..services.memory_service import memory_service

router = APIRouter()


def _resolve_owner(principal: str, user_id: str | None) -> str:
    """定归属:只从令牌主体取;请求参数最多是一次一致性校验(见模块 docstring)。

    必须在各端点 try 块**之前**调用 —— HTTPException 若被 `except Exception`
    吞掉会变成 {"code":500},403 结论就丢了,而且 403 判定不得先查库(避免
    存在性预言机:让攻击者用状态码区分"这个 UUID 存不存在")。

    返回**最终归属**,调用方必须用返回值喂服务层。
    """
    if user_id is None:
        # 参数缺席 ⇒ 以令牌主体为准(开发降级态即 DEV 单一租户,不引入新身份)。
        return principal
    if principal == DEV_ANONYMOUS_PRINCIPAL:
        return user_id
    if user_id != principal:
        raise HTTPException(
            status_code=403,
            detail="user_id 与令牌主体不一致(禁止读写他人记忆)",
        )
    return principal


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class MemorySaveRequest(BaseModel):
    """保存记忆请求。"""

    user_id: str | None = Field(
        None, description="用户 ID(UUID);可省略 —— 省略即以令牌主体为准"
    )
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

    user_id: str | None = Field(
        None, description="用户 ID(UUID);可省略 —— 省略即以令牌主体为准"
    )


class ProceduralSaveRequest(BaseModel):
    """L1-4(2026-07-25 立):工具用法模式保存请求(doom_loop 反思沉淀 / 工具调用结果记录)。"""

    user_id: str | None = Field(
        None, description="用户 ID(UUID);可省略 —— 省略即以令牌主体为准"
    )
    pattern: str = Field(..., description="工具用法模式标识(如 doom_loop:read:hash)")
    tool_name: str | None = Field(None, description="工具名")
    success: bool = Field(True, description="是否成功(失败模式传 False)")
    metadata: dict[str, Any] | None = Field(None, description="元数据(失败原因/建议等)")


# ---------------------------------------------------------------------------
# 核心端点
# ---------------------------------------------------------------------------


@router.post("/memory/save")
async def save_memory(
    req: MemorySaveRequest,
    principal: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """保存记忆到指定层。"""
    owner = _resolve_owner(principal, req.user_id)
    try:
        result = await memory_service.save(
            user_id=owner,
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
    user_id: str | None = Query(None, description="用户 ID(UUID);省略即以令牌主体为准"),
    query: str = Query(..., description="语义检索查询文本"),
    top_k: int = Query(5, ge=1, le=50, description="返回 top-k 条"),
    principal: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """语义检索 semantic_memory(cosine similarity)。"""
    owner = _resolve_owner(principal, user_id)
    try:
        results = await memory_service.recall(owner, query, top_k=top_k)
        return {"code": 0, "message": "ok", "data": results}
    except Exception as e:
        return {"code": 500, "message": f"检索失败: {e}", "data": None}


@router.post("/memory/dream")
async def dream(
    req: DreamRequest,
    principal: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """触发梦境固化(consolidate:episodic → semantic + procedural)。"""
    owner = _resolve_owner(principal, req.user_id)
    try:
        result = await dream_service.consolidate(owner)
        return {"code": 0, "message": "ok", "data": result}
    except Exception as e:
        return {"code": 500, "message": f"梦境固化失败: {e}", "data": None}


@router.get("/memory/topics")
async def dream_topics(
    user_id: str | None = Query(None, description="用户 ID(UUID);省略即以令牌主体为准"),
    principal: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """查询最近梦境主题(LLM 总结最近 10 条 semantic_memory)。"""
    owner = _resolve_owner(principal, user_id)
    try:
        result = await dream_service.dream_topic(owner)
        return {"code": 0, "message": "ok", "data": result}
    except Exception as e:
        return {"code": 500, "message": f"主题生成失败: {e}", "data": None}


@router.delete("/memory/forget")
async def forget_memory(
    user_id: str | None = Query(None, description="用户 ID(UUID);省略即以令牌主体为准"),
    threshold: float = Query(0.1, ge=0.0, le=1.0, description="遗忘阈值"),
    principal: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """触发遗忘曲线衰减(episodic importance < threshold 删除)。"""
    owner = _resolve_owner(principal, user_id)
    try:
        result = await dream_service.forget(owner, threshold=threshold)
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
    user_id: str | None = Query(None, description="用户 ID(UUID);省略即以令牌主体为准"),
    session_id: str | None = Query(None, description="会话 ID(可选过滤)"),
    limit: int = Query(100, ge=1, le=500, description="返回条数上限"),
    principal: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """查询 episodic memory(历史会话片段)。"""
    owner = _resolve_owner(principal, user_id)
    items = await memory_service.list_episodic(
        owner, session_id=session_id, limit=limit
    )
    return {"code": 0, "message": "ok", "data": items}


@router.get("/memory/procedural")
async def list_procedural(
    user_id: str | None = Query(None, description="用户 ID(UUID);省略即以令牌主体为准"),
    limit: int = Query(100, ge=1, le=500, description="返回条数上限"),
    principal: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """查询 procedural memory(技能/工具用法模式)。"""
    owner = _resolve_owner(principal, user_id)
    items = await memory_service.list_procedural(owner, limit=limit)
    return {"code": 0, "message": "ok", "data": items}


@router.post("/memory/procedural")
async def save_procedural(
    req: ProceduralSaveRequest,
    principal: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """L1-4(2026-07-25 立):保存工具用法模式(供 cli doom_loop 反思沉淀 / 工具调用结果记录)。

    失败模式(success=False)用于让 agent 未来规避相同陷阱;
    成功模式(success=True)用于让 agent 重复有效工具组合。
    """
    owner = _resolve_owner(principal, req.user_id)
    try:
        result = await memory_service.add_procedural(
            user_id=owner,
            pattern=req.pattern,
            tool_name=req.tool_name,
            success=req.success,
            metadata=req.metadata,
        )
        return {"code": 0, "message": "ok", "data": result}
    except Exception as e:
        return {"code": 500, "message": f"procedural 保存失败: {e}", "data": None}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
