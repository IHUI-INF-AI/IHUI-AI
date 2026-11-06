# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""按轮变更集查询与回滚路由(批次 4,2026-11-06 立)。

- GET  /api/chat/changes?conversation_id=&turn_id=&limit=  → 列出该会话的变更集
- GET  /api/chat/changes/{id}                              → 变更集详情 + 文件明细
- POST /api/chat/changes/{id}/rewind                       → 预览/执行整轮回滚

鉴权:与 checkpoint_rewind 一致,走 JWT(get_current_user_id_sync)。
**这里不做归属/越权判断** —— 网关是唯一鉴权边界(与本次批次的分工一致),
服务内再叠一层会话归属只会引入第二套容易分叉的判据。
"""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..core.jwt_auth import get_current_user_id_sync
from ..services import change_set_store

router = APIRouter(prefix="/chat/changes", tags=["chat-changes"])
logger = logging.getLogger(__name__)

# DB 列名 → 对外 JSON 字段名(本服务对外一律 camelCase)
_SET_FIELDS = {
    "id": "id",
    "conversation_id": "conversationId",
    "user_id": "userId",
    "turn_id": "turnId",
    "session_id": "sessionId",
    "workspace_root": "workspaceRoot",
    "status": "status",
    "file_count": "fileCount",
    "additions": "additions",
    "deletions": "deletions",
    "rewind_status": "rewindStatus",
    "created_at": "createdAt",
    "updated_at": "updatedAt",
}

_FILE_FIELDS = {
    "id": "id",
    "change_set_id": "changeSetId",
    "path": "path",
    "operation": "operation",
    "before_sha256": "beforeSha256",
    "after_sha256": "afterSha256",
    "additions": "additions",
    "deletions": "deletions",
    "unified_diff": "unifiedDiff",
    "content_truncated": "contentTruncated",
    "rewind_tracked": "rewindTracked",
    "rewind_applied_at": "rewindAppliedAt",
    "created_at": "createdAt",
}


class RewindRequest(BaseModel):
    """rewind 请求体(dryRun 为对外字段,dry_run 为内部字段,两者都收)。"""

    model_config = ConfigDict(populate_by_name=True)

    dry_run: bool = Field(
        False,
        validation_alias="dryRun",
        description="true=只预览动作,不写磁盘、不改状态",
    )


class RewindResponse(BaseModel):
    dry_run: bool = Field(serialization_alias="dryRun")
    status: str
    actions: list[dict[str, Any]]
    conflicts: list[dict[str, Any]]
    applied: int


def _plain(value: Any) -> Any:
    """把 asyncpg 返回值里的 UUID/datetime 转成 JSON 可序列化的原始类型。"""
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _row(row: dict[str, Any], fields: dict[str, str]) -> dict[str, Any]:
    return {alias: _plain(row.get(column)) for column, alias in fields.items()}


def _require_user(request: Request) -> str:
    """JWT 鉴权(网关之外的最后一道服务内校验),不参与归属判断。"""
    return get_current_user_id_sync(request)


@router.get("")
async def list_changes(
    request: Request,
    conversation_id: str = Query(..., min_length=1, alias="conversation_id"),
    turn_id: str | None = Query(None, alias="turn_id"),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    """列出某会话的按轮变更集(可选按 turn_id 精确过滤)。"""
    _require_user(request)
    items = await change_set_store.list_change_sets(conversation_id, turn_id, limit)
    return {"items": [_row(item, _SET_FIELDS) for item in items]}


@router.get("/{change_set_id}")
async def get_change(
    request: Request, change_set_id: str
) -> dict[str, Any]:
    """变更集详情 + 文件明细(不返回 before_content 正文副本)。"""
    _require_user(request)
    payload = await change_set_store.get_change_set(change_set_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="变更集不存在")
    return {
        "changeSet": _row(payload["changeSet"], _SET_FIELDS),
        "files": [_row(f, _FILE_FIELDS) for f in payload["files"]],
    }


@router.post("/{change_set_id}/rewind", response_model=RewindResponse)
async def rewind(
    request: Request, change_set_id: str, body: RewindRequest
) -> RewindResponse:
    """预览(dry_run=true)或执行整轮回滚。

    冲突时服务端不写任何文件(全有全无),status 如实回答 conflict,
    actions/conflicts 逐文件点名原因,调用方无需自行推断。
    """
    _require_user(request)
    try:
        result = await change_set_store.rewind_change_set(change_set_id, body.dry_run)
    except change_set_store.ChangeSetNotFoundError:
        raise HTTPException(status_code=404, detail="变更集不存在")
    return RewindResponse(
        dry_run=body.dry_run,
        status=result["status"],
        actions=result["actions"],
        conflicts=result["conflicts"],
        applied=result["applied"],
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
