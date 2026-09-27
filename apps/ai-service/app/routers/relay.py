# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""跨会话接力摘要 HTTP 路由(P2-7 闭环的 API 出口)。

挂载方式(main.py):
    app.include_router(relay.router, prefix="/api", tags=["relay"])

端点族:
- POST   /api/relay/summary                 为某 thread 生成并持久化接力摘要(确定性;LLM 精炼 env 门控)
- GET    /api/relay/summary/{thread_id}     取某 thread 最新接力摘要(404 若无)
- GET    /api/relay/summaries               跨 thread 列出接力摘要(created_at 倒序,分页)
- POST   /api/relay/continue/{thread_id}    「继续上次」:建新 thread 并把来源摘要作为注入返回

存储复用 sessions 的 SessionStore 单例(get_session_store);返回遵循 {code,message,data} 契约。
恢复注入用清晰边界标记包裹(build_relay_injection),调用方将其作为 system 消息前置到新会话。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.jwt_auth import require_request_user_id
from app.routers.sessions import get_session_store
from app.services.session_relay import (
    RelaySummary,
    build_relay_injection,
    generate_relay_summary,
)
from app.services.session_store import (
    SessionStore,
    Thread,
    owner_scoped_allows,
    thread_owner,
)

router = APIRouter(prefix="/relay", tags=["relay"])


def _owned_thread(thread: Thread | None, thread_id: str, user_id: str) -> Thread:
    """校验"这一行存在且属于调用方",并把类型收窄成非 None 交回。

    别人的会话与"不存在"**同形**(404 + 同一句 detail 模板)。

    本模块四个端点此前**一个身份依赖都没挂** —— 既不是"取了身份没用"(那会被
    `scripts/audit_principal_consumed.py` 那把尺子看见),而是**根本不取**,所以尺子
    结构上判不到它(G-250 收尾时现读才暴露的尺子盲区,已登记进台账)。后果按端点
    分别成立:`GET /summary/{thread_id}` 凭 id 读别人的接力摘要(里面是对话内容的
    目标/已完成步骤/关键决定),`/summaries` 一次列出**全站**摘要(那一格要 store 层
    的属主参数才能真过滤,响应侧筛会让 `total` 与集合分叉,故另批处置),
    `POST /continue/{thread_id}` 凭 id 对别人的会话做摘要并派生新线程。
    判据复用 `owner_scoped_allows` 那一份实现,与 `list_threads(owner_user_id=…)` /
    引擎只读面同形 —— 两处算同一件事必漂移,是本仓记过最多次的失效型。
    """
    if thread is None or not owner_scoped_allows(user_id, thread_owner(thread)):
        raise HTTPException(status_code=404, detail=f"thread 不存在: {thread_id}")
    return thread


class _CreateSummaryBody(BaseModel):
    thread_id: str = Field(..., min_length=1)
    refine: bool = False


@router.post("/summary")
def create_relay_summary(
    body: _CreateSummaryBody,
    user_id: str = Depends(require_request_user_id),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """为某 thread 生成并持久化接力摘要,返回最新摘要(默认确定性;refine 受 env 门控)。"""
    _owned_thread(store.get_thread(body.thread_id), body.thread_id, user_id)
    items = store.list_items(body.thread_id)
    summary = generate_relay_summary(
        items, thread_id=body.thread_id, llm_refine=body.refine
    )
    store.save_relay_summary(
        body.thread_id,
        objective=summary.objective,
        completed_steps=summary.completed_steps,
        key_decisions=summary.key_decisions,
        unfinished=summary.unfinished,
        files=summary.files,
        refined=summary.refined,
    )
    latest = store.get_relay_summary(body.thread_id)
    if latest is None:  # pragma: no cover - 上面刚写入,不应发生
        raise HTTPException(status_code=500, detail="接力摘要写入后无法读取")
    return {
        "code": 0,
        "message": "ok",
        "data": RelaySummary.from_store_row(latest).model_dump(mode="json"),
    }


@router.get("/summary/{thread_id}")
def get_relay_summary(
    thread_id: str,
    user_id: str = Depends(require_request_user_id),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """取某 thread 最新接力摘要;无则 404(别人的同样 404,不做存在性区分)。"""
    _owned_thread(store.get_thread(thread_id), thread_id, user_id)
    row = store.get_relay_summary(thread_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"thread 无接力摘要: {thread_id}")
    return {
        "code": 0,
        "message": "ok",
        "data": RelaySummary.from_store_row(row).model_dump(mode="json"),
    }


@router.get("/summaries")
def list_relay_summaries(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """跨 thread 列出接力摘要(created_at 倒序)。"""
    rows = store.list_relay_summaries(limit=limit, offset=offset)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "summaries": [
                RelaySummary.from_store_row(r).model_dump(mode="json") for r in rows
            ],
            "total": len(rows),
        },
    }


@router.post("/continue/{thread_id}")
def continue_thread(
    thread_id: str,
    user_id: str = Depends(require_request_user_id),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """「继续上次」:从来源 thread 生成摘要,建新 thread 持久化该摘要,并返回注入文本。

    新会话引导层把返回 ``injection`` 作为首条 system 消息前置,即完成接力恢复。
    LLM 精炼默认关闭(env 门控);本路径绝不依赖 LLM。
    """
    source = _owned_thread(store.get_thread(thread_id), thread_id, user_id)
    items = store.list_items(thread_id)
    summary = generate_relay_summary(items, thread_id=thread_id, prev_thread_id=thread_id)
    new_thread = store.create_thread(
        title=f"继续: {source.title}" if source.title else "继续上次会话",
        parent_thread_id=thread_id,
        # 接力线程继承来源的属主/角色(批 60 / G-249)。不传就等于每次"继续上次会话"
        # 都新造一条**无属主**的线程 —— 而按 `_principal_allows` ②,"没有属主"不是
        # 受限而是"无从对账",任何已登录连接都能接着用它对话。
        # (本路由此前"凭 id 就能续别人的会话"那一格由 `_owned_thread` 收掉:先验归属
        #  再派生,继承下来的那份属主必然是调用人自己。)
        user_id=source.metadata.get("userId")
        if isinstance(source.metadata.get("userId"), str)
        else None,
        role_id=source.metadata.get("roleId")
        if isinstance(source.metadata.get("roleId"), int)
        else None,
    )
    store.save_relay_summary(
        new_thread.thread_id,
        objective=summary.objective,
        completed_steps=summary.completed_steps,
        key_decisions=summary.key_decisions,
        unfinished=summary.unfinished,
        files=summary.files,
        refined=summary.refined,
        prev_thread_id=thread_id,
    )
    injection = build_relay_injection(summary)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "thread": new_thread.model_dump(mode="json"),
            "summary": RelaySummary.from_store_row(
                store.get_relay_summary(new_thread.thread_id) or {}
            ).model_dump(mode="json"),
            "injection": injection,
        },
    }


__all__ = ["router"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
