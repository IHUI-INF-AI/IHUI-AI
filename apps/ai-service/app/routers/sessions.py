# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Codex 级会话持久化 HTTP 路由(深度引擎接线,2026-09-06 立)。

挂载方式(main.py):
    app.include_router(sessions.router, prefix="/api", tags=["sessions"])

端点族(三级会话模型 Thread / Turn / Item):
- POST   /api/sessions/threads                      创建 thread
- GET    /api/sessions/threads                      thread 分页列表
- GET    /api/sessions/threads/{thread_id}          thread 详情
- POST   /api/sessions/threads/{thread_id}/turns    开启 turn
- GET    /api/sessions/threads/{thread_id}/turns    turn 列表(可按状态过滤)
- GET    /api/sessions/turns/{turn_id}              turn 详情
- POST   /api/sessions/turns/{turn_id}/end          结束 turn(状态机迁移)
- POST   /api/sessions/turns/{turn_id}/items        追加 item(幂等去重)
- GET    /api/sessions/threads/{thread_id}/items    item 列表
- POST   /api/sessions/threads/{thread_id}/resume   重建消息历史(悬挂 tool_call 自动修复)
- POST   /api/sessions/threads/{thread_id}/fork     从某 item seq 分支新 thread
- POST   /api/sessions/threads/{thread_id}/rollback 软回滚到指定 turn
- POST   /api/sessions/threads/{thread_id}/compact  插入压缩边界
- GET    /api/sessions/search                       FTS5 全文检索(不可用自动降级 LIKE)

存储注入:所有端点经 `Depends(get_session_store)` 获取进程级单例(路径由
环境变量 SESSION_STORE_DB_PATH 控制,缺省 data/sessions.db);测试用
app.dependency_overrides 注入 tmp_path 私有库,互不串扰。

错误映射:
- 资源不存在(ThreadNotFoundError/TurnNotFoundError)→ 404
- 归属不符(TurnMismatchError)/非法 item 载荷 → 400
- 非法状态迁移(InvalidTurnTransitionError)/client_item_id 重复 → 409
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, ValidationError

from app.core.jwt_auth import get_current_user_id
from app.services.session_store import (
    ITEM_ADAPTER,
    CompactionBoundaryItem,
    DuplicateItemError,
    InvalidTurnTransitionError,
    ItemBase,
    ItemKind,
    SessionStore,
    ThreadNotFoundError,
    TurnMismatchError,
    TurnNotFoundError,
    TurnStatus,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])
logger = logging.getLogger(__name__)

# =============================================================================
# 存储单例(懒加载,线程安全;测试经 dependency_overrides 注入 tmp_path 私有库)
# =============================================================================

_store_lock = threading.Lock()
_store: SessionStore | None = None


def get_session_store() -> SessionStore:
    """返回进程级 SessionStore 单例(首次调用时按环境变量路径建库)。"""
    global _store
    with _store_lock:
        if _store is None:
            db_path = os.getenv("SESSION_STORE_DB_PATH", "data/sessions.db")
            _store = SessionStore(db_path)
        return _store


def reset_session_store() -> None:
    """关闭并清空单例(测试辅助/进程重启钩子)。"""
    global _store
    with _store_lock:
        if _store is not None:
            _store.close()
            _store = None


# =============================================================================
# 请求模型
# =============================================================================


class CreateThreadRequest(BaseModel):
    """创建 thread 请求体。"""

    title: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)
    thread_id: str | None = None


class CreateTurnRequest(BaseModel):
    """开启 turn 请求体。"""

    turn_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class EndTurnRequest(BaseModel):
    """结束 turn 请求体(status 受引擎状态机约束)。"""

    status: TurnStatus = "completed"
    error: str | None = None


class AppendItemRequest(BaseModel):
    """追加 item 请求体:payload 为具体 Item 的字段 dict(item_type 判别)。"""

    item: dict[str, Any]


class ForkRequest(BaseModel):
    """fork 请求体。"""

    at_response_id: int = Field(..., ge=1, description="分支点 item seq")
    title: str = ""


class RollbackRequest(BaseModel):
    """rollback 请求体。"""

    to_turn_id: str = Field(..., min_length=1)
    reason: str = ""


class CompactRequest(BaseModel):
    """compact 请求体(压缩边界摘要)。"""

    summary: str = Field(..., min_length=1)
    tokens_before: int = 0
    tokens_after: int = 0
    turn_id: str | None = None


# =============================================================================
# 内部工具
# =============================================================================


def _parse_item_or_400(data: dict[str, Any]) -> ItemBase:
    """用 ITEM_ADAPTER 判别联合解析 item;非法载荷 → 400。"""
    try:
        obj = ITEM_ADAPTER.validate_python(data)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=f"非法 item 载荷: {e}") from None
    if not isinstance(obj, ItemBase):  # pragma: no cover - 联合成员均为 ItemBase
        raise HTTPException(status_code=400, detail="非法 item 载荷: 缺少 item_type")
    return obj


def _item_to_dict(item: ItemBase) -> dict[str, Any]:
    """Item → JSON 可序列化 dict(含信封字段)。"""
    return item.model_dump(mode="json")


# =============================================================================
# Thread CRUD
# =============================================================================


@router.post("/threads")
def create_thread(
    body: CreateThreadRequest,
    user_id: str = Depends(get_current_user_id),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """创建新 thread。"""
    thread = store.create_thread(
        title=body.title,
        metadata=body.metadata,
        thread_id=body.thread_id,
    )
    return {"code": 0, "message": "ok", "data": thread.model_dump(mode="json")}


@router.get("/threads")
def list_threads(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    include_archived: bool = False,
    user_id: str = Depends(get_current_user_id),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """thread 分页列表(updated_at 倒序)。"""
    page = store.list_threads(limit=limit, offset=offset, include_archived=include_archived)
    return {"code": 0, "message": "ok", "data": page.model_dump(mode="json")}


@router.get("/threads/{thread_id}")
def get_thread(
    thread_id: str,
    user_id: str = Depends(get_current_user_id),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """thread 详情(含 item_count / last_seq)。"""
    thread = store.get_thread(thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail=f"thread 不存在: {thread_id}")
    return {"code": 0, "message": "ok", "data": thread.model_dump(mode="json")}


# =============================================================================
# Turn CRUD + 状态机
# =============================================================================


@router.post("/threads/{thread_id}/turns")
def start_turn(
    thread_id: str,
    body: CreateTurnRequest,
    user_id: str = Depends(get_current_user_id),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """在指定 thread 上开启新 turn(状态 running)。"""
    try:
        turn = store.start_turn(thread_id, turn_id=body.turn_id, metadata=body.metadata)
    except ThreadNotFoundError:
        raise HTTPException(status_code=404, detail=f"thread 不存在: {thread_id}") from None
    return {"code": 0, "message": "ok", "data": turn.model_dump(mode="json")}


@router.get("/threads/{thread_id}/turns")
def list_turns(
    thread_id: str,
    status: TurnStatus | None = Query(None),
    user_id: str = Depends(get_current_user_id),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """列出 thread 的 turns(turn_seq 升序,可按状态过滤)。"""
    turns = store.list_turns(thread_id, status=status)
    return {
        "code": 0,
        "message": "ok",
        "data": {"turns": [t.model_dump(mode="json") for t in turns], "total": len(turns)},
    }


@router.get("/turns/{turn_id}")
def get_turn(
    turn_id: str,
    user_id: str = Depends(get_current_user_id),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """turn 详情。"""
    turn = store.get_turn(turn_id)
    if turn is None:
        raise HTTPException(status_code=404, detail=f"turn 不存在: {turn_id}")
    return {"code": 0, "message": "ok", "data": turn.model_dump(mode="json")}


@router.post("/turns/{turn_id}/end")
def end_turn(
    turn_id: str,
    body: EndTurnRequest,
    user_id: str = Depends(get_current_user_id),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """结束 turn(running → completed/interrupted/failed;非法迁移 409)。"""
    try:
        turn = store.end_turn(turn_id, status=body.status, error=body.error)
    except TurnNotFoundError:
        raise HTTPException(status_code=404, detail=f"turn 不存在: {turn_id}") from None
    except InvalidTurnTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e)) from None
    return {"code": 0, "message": "ok", "data": turn.model_dump(mode="json")}


# =============================================================================
# Item 追加 / 列表
# =============================================================================


@router.post("/turns/{turn_id}/items")
def append_item(
    turn_id: str,
    body: AppendItemRequest,
    user_id: str = Depends(get_current_user_id),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """向 turn 追加 item(client_item_id 幂等去重,重复 409)。"""
    item = _parse_item_or_400(body.item)
    try:
        stored = store.append_item(turn_id, item)
    except TurnNotFoundError:
        raise HTTPException(status_code=404, detail=f"turn 不存在: {turn_id}") from None
    except DuplicateItemError as e:
        raise HTTPException(status_code=409, detail=str(e)) from None
    return {"code": 0, "message": "ok", "data": _item_to_dict(stored)}


@router.get("/threads/{thread_id}/items")
def list_items(
    thread_id: str,
    after_seq: int | None = Query(None, ge=0),
    upto_seq: int | None = Query(None, ge=1),
    kind: ItemKind | None = Query(None, description="按 item_type 过滤"),
    user_id: str = Depends(get_current_user_id),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """列出 thread 的 items(seq 升序,受 rollback 截断上界约束)。"""
    if store.get_thread(thread_id) is None:
        raise HTTPException(status_code=404, detail=f"thread 不存在: {thread_id}")
    kinds: list[ItemKind] | None = [kind] if kind else None
    items = store.list_items(thread_id, after_seq=after_seq, upto_seq=upto_seq, kinds=kinds)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "items": [_item_to_dict(i) for i in items],
            "total": len(items),
        },
    }


# =============================================================================
# Resume / Fork / Rollback / Compact
# =============================================================================


@router.post("/threads/{thread_id}/resume")
def resume_thread(
    thread_id: str,
    user_id: str = Depends(get_current_user_id),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """重建消息历史(OpenAI 风格;悬挂 tool_call 自动补 synthetic interrupted)。"""
    try:
        messages = store.resume(thread_id)
    except ThreadNotFoundError:
        raise HTTPException(status_code=404, detail=f"thread 不存在: {thread_id}") from None
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "thread_id": thread_id,
            "messages": [m.model_dump(mode="json", exclude_none=True) for m in messages],
        },
    }


@router.post("/threads/{thread_id}/fork")
def fork_thread(
    thread_id: str,
    body: ForkRequest,
    user_id: str = Depends(get_current_user_id),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """从指定 item seq 分支出新 thread(复制前缀)。"""
    try:
        new_thread = store.fork(thread_id, body.at_response_id, title=body.title)
    except ThreadNotFoundError:
        raise HTTPException(status_code=404, detail=f"thread 不存在: {thread_id}") from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
    return {"code": 0, "message": "ok", "data": new_thread.model_dump(mode="json")}


@router.post("/threads/{thread_id}/rollback")
def rollback_thread(
    thread_id: str,
    body: RollbackRequest,
    user_id: str = Depends(get_current_user_id),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """软回滚到指定 turn(保留审计;返回截断上界 seq)。"""
    try:
        to_seq = store.rollback(thread_id, body.to_turn_id, reason=body.reason)
    except ThreadNotFoundError:
        raise HTTPException(status_code=404, detail=f"thread 不存在: {thread_id}") from None
    except TurnNotFoundError:
        raise HTTPException(status_code=404, detail=f"turn 不存在: {body.to_turn_id}") from None
    except TurnMismatchError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
    return {"code": 0, "message": "ok", "data": {"thread_id": thread_id, "to_seq": to_seq}}


@router.post("/threads/{thread_id}/compact")
def compact_thread(
    thread_id: str,
    body: CompactRequest,
    user_id: str = Depends(get_current_user_id),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """插入压缩边界(此后 resume 只回放边界后内容 + 摘要)。"""
    boundary = CompactionBoundaryItem(
        summary=body.summary,
        tokens_before=body.tokens_before,
        tokens_after=body.tokens_after,
    )
    try:
        stored = store.compact(thread_id, boundary, turn_id=body.turn_id)
    except ThreadNotFoundError:
        raise HTTPException(status_code=404, detail=f"thread 不存在: {thread_id}") from None
    return {"code": 0, "message": "ok", "data": _item_to_dict(stored)}


# =============================================================================
# 全文检索
# =============================================================================


@router.get("/search")
def search_sessions(
    q: str = Query(..., min_length=1, max_length=256, description="检索词"),
    thread_id: str | None = Query(None, description="限定 thread 范围"),
    limit: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
    store: SessionStore = Depends(get_session_store),
) -> dict[str, Any]:
    """FTS5 全文检索(FTS 不可用时引擎自动降级 LIKE)。"""
    hits = store.full_text_search(q, thread_id=thread_id, limit=limit)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "query": q,
            "fts_enabled": store.fts_enabled,
            "hits": [h.model_dump(mode="json") for h in hits],
            "total": len(hits),
        },
    }


__all__ = ["router", "get_session_store", "reset_session_store"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
