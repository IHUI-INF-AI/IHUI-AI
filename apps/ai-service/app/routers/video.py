# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""视频生成 HTTP 路由(ai-service,内网)。

- POST /api/video/generate     同步出片(测试/即时)
- POST /api/video/task         异步入队(video_generation_tasks,由后台 worker 消费)
- GET  /api/video/tasks/:id    查询任务
- GET  /api/video/providers    已配置视频厂商
"""
from __future__ import annotations

import contextlib
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.db import get_db_conn
from app.providers.base_provider import ProviderError
from app.services.video_generation import (
    _configured_providers,
    generate_video,
)

from .media_tasks import _scoped_user_uuid, _user_scope

router = APIRouter()
logger = logging.getLogger(__name__)


class GenRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="视频分镜/画面描述")
    duration: int = Field(
        default=5,
        ge=3,
        le=30,
        description="时长秒(MAGI-2 原生支持 30s;其他厂商通常 10~15s,超限由上游拒绝)",
    )
    image: str | None = Field(default=None, description="首帧图 URL(base64 可灵/即梦可用,混元必需图片)")
    provider: str | None = Field(default=None, description="指定厂商(kling/jimeng/wan/hunyuan)")


class TaskRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    user_uuid: str | None = Field(default="system")
    chat_id: str | None = Field(default=None)
    task_id: str | None = Field(default=None)


@router.post("/video/generate")
async def video_generate(req: GenRequest) -> dict[str, Any]:
    """同步调用已配置视频厂商出片(阻塞至出片完成)。"""
    try:
        result = await generate_video(
            req.prompt,
            duration=req.duration,
            image=req.image,
            provider=req.provider,
        )
        return {"ok": True, "data": result}
    except ProviderError as e:
        raise HTTPException(status_code=e.status_code or 502, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"视频生成异常: {e}") from e


@router.post("/video/task")
async def video_task(
    req: TaskRequest,
    scope: tuple[str, bool] = Depends(_user_scope),
) -> dict[str, Any]:
    """入队一个视频任务(accepted),由后台 worker 异步出片。

    2026-09-09 P0 越权收敛(与 media_tasks 同款):user_uuid 此前客户端可控
    (默认 "system",可冒充他人入队),现非 admin 强制取当前 JWT 用户。
    """
    import uuid as _uuid

    user_id, is_admin = scope
    effective_user = ((req.user_uuid or "").strip() or user_id) if is_admin else user_id
    task_id = req.task_id or str(_uuid.uuid4())
    conn = await get_db_conn()
    try:
        rows = await conn.fetch(
            "INSERT INTO video_generation_tasks "
            "(task_id, user_uuid, chat_id, status, message) "
            "VALUES ($1, $2, $3, 'accepted', $4) RETURNING id, status",
            task_id,
            effective_user,
            req.chat_id,
            req.prompt,
        )
    finally:
        await conn.close()
    row = rows[0]
    return {"ok": True, "data": {"id": row["id"], "task_id": task_id, "status": row["status"]}}


@router.get("/video/tasks/{task_id}")
async def video_task_status(
    task_id: str,
    scope: tuple[str, bool] = Depends(_user_scope),
) -> dict[str, Any]:
    """任务详情。2026-09-09 P0:此前无归属校验,任何登录用户可看他人任务(含产物 URL);
    现非 admin 只能看自己的,不归属 404 不泄露存在性(与 media_tasks 详情同策略)。"""
    conn = await get_db_conn()
    try:
        rows = await conn.fetch(
            "SELECT id, task_id, user_uuid, chat_id, status, message, result, updated_at "
            "FROM video_generation_tasks WHERE task_id=$1 ORDER BY id DESC LIMIT 1",
            task_id,
        )
    finally:
        await conn.close()
    if not rows:
        raise HTTPException(status_code=404, detail="任务不存在")
    row = dict(rows[0])
    user_id, is_admin = scope
    if not is_admin and (row.get("user_uuid") or "") != user_id:
        raise HTTPException(status_code=404, detail="任务不存在")
    result = row.get("result")
    if result:
        with contextlib.suppress(ValueError, TypeError):
            row["result"] = json.loads(result)
    return {"ok": True, "data": row}


@router.get("/video/tasks")
async def video_task_list(
    user_uuid: str | None = None,
    status: str | None = None,
    limit: int = 20,
    offset: int = 0,
    scope: tuple[str, bool] = Depends(_user_scope),
) -> dict[str, Any]:
    """媒体任务列表:按 user_uuid / status 过滤,倒序返回。

    - user_uuid 缺省查全部;status 逗号分隔多值(accepted/processing/succeeded/failed)
    - 用于"我的进行中媒体任务"一览与取消入口
    - 2026-09-09 P0 越权收敛:非 admin 强制按当前用户过滤(此前 user_uuid 可选、
      缺省查全平台,与 media_tasks 修复前同类 IDOR)
    """
    user_uuid = _scoped_user_uuid(user_uuid, scope)
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    where: list[str] = []
    params: list[Any] = []
    if user_uuid:
        params.append(user_uuid)
        where.append(f"user_uuid=${len(params)}")
    if status:
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        if statuses:
            params.append(statuses)
            where.append(f"status = ANY(${len(params)})")
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    conn = await get_db_conn()
    try:
        rows = await conn.fetch(
            f"SELECT id, task_id, user_uuid, chat_id, status, message, result, created_at, updated_at "
            f"FROM video_generation_tasks {where_sql} ORDER BY id DESC LIMIT $%d OFFSET $%d"
            % (len(params) + 1, len(params) + 2),
            *params,
            limit,
            offset,
        )
        total = await conn.fetchval(
            f"SELECT count(*) FROM video_generation_tasks {where_sql}", *params
        )
    finally:
        await conn.close()
    items: list[dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        result = d.get("result")
        if result:
            with contextlib.suppress(ValueError, TypeError):
                d["result"] = json.loads(result)
        items.append(d)
    return {
        "ok": True,
        "data": {"items": items, "total": total or 0, "limit": limit, "offset": offset},
    }


@router.get("/video/providers")
async def video_providers() -> dict[str, Any]:
    configured = [name for name, _ in _configured_providers()] or []
    return {
        "ok": True,
        "data": {
            "configured": configured,
            "available": ["agnes", "magi2", "kling", "jimeng", "wan", "hunyuan"],
            "kv": {
                "agnes": "LLM_PROVIDERS.agnes.api_key 或 AGNES_API_KEY",
                "magi2": "MAGI2_API_KEY 或 SAND_API_KEY(需在 Sand.ai 控制台申请开通)",
                "kling": "KLING_ACCESS_KEY + KLING_SECRET_KEY",
                "jimeng": "ARK_API_KEY 或 ARK_ACCESS_KEY + ARK_SECRET_KEY",
                "wan": "DASHSCOPE_API_KEY",
                "hunyuan": "TENCENT_SECRET_ID + TENCENT_SECRET_KEY",
            },
        },
    }
