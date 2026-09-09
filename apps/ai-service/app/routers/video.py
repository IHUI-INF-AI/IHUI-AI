# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""视频生成 HTTP 路由(ai-service,内网)。

- POST /api/video/generate     同步出片(测试/即时)
- POST /api/video/task         异步入队(video_generation_tasks,由后台 worker 消费)
- GET  /api/video/tasks/:id    查询任务
- GET  /api/video/providers    已配置视频厂商
- POST /api/video/token6688-callback  TokenGo 官方终态 webhook(验签 + 落终态)

TokenGo webhook 官方约定(2026-07-11 guide):
- 提交时带 callback_url(+callback_secret),终态平台主动 POST 任务快照
- X-TokenGo-Event: task.completed / task.failed
- X-TokenGo-Signature: sha256=HMAC_SHA256(callback_secret, 原始请求体)
- 投递 best-effort:2xx 即确认,否则 5s/30s/120s 重试 3 次;网关重启可能丢,
  保留 _poll_pending 低频轮询兜底
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.db import get_db_conn
from app.providers.base_provider import ProviderError
from app.services.video_generation import (
    _configured_providers,
    generate_video,
    handle_token6688_callback,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class GenRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="视频分镜/画面描述")
    duration: int = Field(default=5, ge=3, le=15, description="时长秒(接口上限通常 10~15s)")
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
async def video_task(req: TaskRequest) -> dict[str, Any]:
    """入队一个视频任务(accepted),由后台 worker 异步出片。"""
    import uuid as _uuid

    task_id = req.task_id or str(_uuid.uuid4())
    conn = await get_db_conn()
    try:
        rows = await conn.fetch(
            "INSERT INTO video_generation_tasks "
            "(task_id, user_uuid, chat_id, status, message) "
            "VALUES ($1, $2, $3, 'accepted', $4) RETURNING id, status",
            task_id,
            req.user_uuid or "system",
            req.chat_id,
            req.prompt,
        )
    finally:
        await conn.close()
    row = rows[0]
    return {"ok": True, "data": {"id": row["id"], "task_id": task_id, "status": row["status"]}}


@router.get("/video/tasks/{task_id}")
async def video_task_status(task_id: str) -> dict[str, Any]:
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
    result = row.get("result")
    if result:
        try:
            row["result"] = json.loads(result)
        except (ValueError, TypeError):
            pass
    return {"ok": True, "data": row}


@router.get("/video/providers")
async def video_providers() -> dict[str, Any]:
    configured = [name for name, _ in _configured_providers()] or []
    return {
        "ok": True,
        "data": {
            "configured": configured,
            "available": ["kling", "jimeng", "wan", "hunyuan"],
            "kv": {
                "kling": "KLING_ACCESS_KEY + KLING_SECRET_KEY",
                "jimeng": "ARK_API_KEY 或 ARK_ACCESS_KEY + ARK_SECRET_KEY",
                "wan": "DASHSCOPE_API_KEY",
                "hunyuan": "TENCENT_SECRET_ID + TENCENT_SECRET_KEY",
            },
        },
    }


@router.post("/video/token6688-callback")
async def token6688_callback(request: Request) -> dict[str, Any]:
    """TokenGo 官方终态 webhook 接收(POST 任务快照,形状同 GET /v1/tasks/{task_id})。

    官方约定(guide 2026-07-11):
    - X-TokenGo-Event: task.completed / task.failed
    - X-TokenGo-Signature: sha256=HMAC_SHA256(callback_secret, 原始请求体)
    - 2xx 即确认;非 2xx 平台按 5s/30s/120s 重试 3 次(best-effort,网关重启会丢,
      保留 _poll_pending 低频轮询兜底)。

    响应码语义:
    - 401:已配 TOKEN6688_CALLBACK_SECRET 但验签失败(平台重试 3 次后放弃)
    - 200 ok=false:解析失败/快照缺 task_id —— 重试同 body 无意义,直接确认
    - 200 ok=true:已落终态 / 无在途匹配(幂等静默)/ 中间态忽略
    - 500:瞬时内部错误(DB 等)—— 故意不上抛吞掉,让平台重试
    """
    body = await request.body()
    secret = os.environ.get("TOKEN6688_CALLBACK_SECRET", "").strip()
    if secret:
        sig = request.headers.get("X-TokenGo-Signature", "").strip()
        expected = "sha256=" + hmac.new(
            secret.encode("utf-8"), body, hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(sig, expected):
            logger.warning(
                "[video] token6688 回调验签失败: sig=%r event=%r",
                sig[:24], request.headers.get("X-TokenGo-Event", ""),
            )
            raise HTTPException(status_code=401, detail="签名校验失败")
    else:
        logger.warning(
            "[video] token6688 回调未配置 TOKEN6688_CALLBACK_SECRET,跳过验签(建议配置)",
        )
    event = request.headers.get("X-TokenGo-Event", "")
    try:
        snapshot = json.loads(body or b"{}")
        if not isinstance(snapshot, dict):
            raise ValueError("回调体非 JSON 对象")
    except ValueError as e:
        logger.warning("[video] token6688 回调体解析失败: %s", e)
        return {"ok": False, "error": f"回调体解析失败: {e}"}
    result = await handle_token6688_callback(snapshot)
    logger.info(
        "[video] token6688 回调处理: event=%s ok=%s matched=%s ignored=%s",
        event, result.get("ok"), result.get("matched"), result.get("ignored"),
    )
    return result
# ⁠​‌​​‌​​‌​‌​​‌‍‌‌​​‎​‌​​​​‌