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
- GET    /api/memory/working    辅助:查询 working memory(按条目属主过滤,2026-09-28 收口)
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
`/memory/working` 于 2026-09-28 收口(机主拍板"写侧补属主 + 回填再收紧"):该端点不收
user_id 参数,句柄是 session_id,所以对齐点是**条目自身的属主**而非请求参数 ——
写侧 `memory_service.add_working(owner=…)` 在锁内把属主烘进条目(旧实现是 `save()`
拿到返回值后在锁外补 `msg["userId"]`,而直接调 `add_working` 的写入路径根本没有属主参数),
读侧由 `entry_visible_to` 这一份判据逐条裁:有 owner ⇒ 必须等于令牌主体;
无 owner(收口前的存量)⇒ 维持改动前行为,由 `scripts/backfill_working_owner.py`
从 `agent_memory_episodic` 的 (session_id, user_id) 权威列幂等回填,推不出的保持无主。
"无主 ⇒ 照旧可读"这一格是**回退不是授权结论**,写在
`memory_service.entry_visible_to` 的分支注释里,不得读成"已收紧完成"。
"不是你的"与"不存在"**同形回包**(200 + 空桶),否则端点退化成存在性预言机。
现状钉桩(tests/test_memory_authz.py 的 test_working_* 一组与 WORKING_PENDING_LEDGER)
已随本票逐条改判为断言拒绝,台账须恒为空。
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
    principal: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """查询 working memory(当前会话内存缓冲)—— 2026-09-28 收口为"任何读取都与令牌主体对齐"。

    身份只从承载层进来:`require_request_user_id`(仓里现成出口,本票未改它)解析出的
    主体即归属,端点**不接受**任何自报的 user_id 参数 —— 句柄是 session_id,而"这个
    session 属于谁"由条目自身的属主记录决定,不由调用方声称。

    requester 的取值刻意经过一次"DEV 主体 → None"的翻译,理由是**行为不变优先于账面严格**:
    本进程根本没启用 JWT 校验时(`auth_globally_enforced()` 为假)主体是
    `DEV_ANONYMOUS_PRINCIPAL`,那是一个"无租户可保护"的哨兵值,把它当成真实属主去比对会
    让开发单机与所有以 ASGI in-process 跑的既有测试整片读不到自己的 working 记忆,
    而这不减少任何真实敞口(与本文件 `_resolve_owner` 的 DEV 分支是同一条判断)。
    ⇒ None 走的是服务层 `entry_visible_to` 的第 1 分支,那里写明"这是回退,不是授权结论"。

    两条同形口径(防存在性预言机,AGENTS §5):"这条 session 不是你的"与"这条 session
    不存在"**必须回同一个形状**(200 + `data: []`)。差别只在日志层面可谈:若改成
    一个回 403、一个回空桶,调用方就能拿这个端点枚举"哪些 session_id 真实存在且不属于我"。
    短路判据 `working_has_visible_entries()` 只回答"有没有可见条目"、**不返回任何内容**,
    且与 `get_working` 里的逐条过滤共用同一份 `entry_visible_to` —— 它是少发一次内容读取的
    优化,不是第二道判据(两处各写一道必然漂移,本仓记过太多次)。
    """
    requester: str | None = None if principal == DEV_ANONYMOUS_PRINCIPAL else principal
    if not await memory_service.working_has_visible_entries(session_id, requester):
        return {"code": 0, "message": "ok", "data": []}
    items = await memory_service.get_working(session_id, limit=limit, requester=requester)
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
