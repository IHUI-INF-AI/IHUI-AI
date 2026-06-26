"""Kling O1 omni-video 视频合成 -- 迁移自 coze_zhs_py/api/kling_video_synthesis.py

调用 Kling O1 模型 (kling-video-o1) 的 /v1/videos/omni-video 接口,
返回 SSE 流式任务状态 (每 5 秒轮询, 最长 5 分钟).

端点 (前缀 /api/v1/chat/kling-o1):
- POST /generate  调用 omni-video, SSE 流式返回任务状态
"""

import asyncio
import json
import time
import uuid
from typing import Any

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel, Field

from app.config import settings
from app.services.token_utils_service import (
    check_user_token_sufficient,
    encode_jwt_token,
)

router = APIRouter(prefix="/chat/kling-o1", tags=["Kling O1 omni-video"])

# Kling 模型常量
KLING_MODEL_O1 = "kling-video-o1"
KLING_O1_METHOD_URL = "/v1/videos/omni-video"
# 北京节点 (与 kling.py 保持一致; 兼容 settings.KLING_MODEL_DOMAIN 缺失)
KLING_BASE_URL = getattr(settings, "KLING_MODEL_DOMAIN", None) or "https://api-beijing.klingai.com"
# 轮询配置: 每 5 秒一次, 最长 5 分钟 (60 次)
POLL_INTERVAL_SEC = 5
MAX_POLL_RETRIES = 60

# 保留后台任务引用, 防止 GC 回收 (当前为 SSE 同步流, 预留扩展)
_pending_tasks: set = set()


class KlingImagesParameter(BaseModel):
    """图片/视频输入参数."""

    video_url: str | None = Field(None, description="视频路径")
    imgUrl: str | None = Field(None, description="图片路径")
    originalUrl: str | None = Field(None, description="来源路径")
    id: str | None = Field(None, description="唯一标识")
    width: int | None = Field(None, description="宽度")
    height: int | None = Field(None, description="高度")
    isVideo: bool | None = Field(None, description="是否是视频")


class KlingCustomParameter(BaseModel):
    """自定义参数 (first_frame/end_frame/mode/aspect_ratio/duration/refer_type/keep_original_sound 等)."""

    name: str = Field(..., description="参数名称")
    desc: str = Field(..., description="参数描述")
    type: str | None = Field(None, description="参数类型")
    value: Any = Field(..., description="参数值")


class KlingO1GenerateRequest(BaseModel):
    """Kling O1 omni-video 生成请求."""

    prompt: str = Field(..., description="视频生成的文本提示")
    user_uuid: str = Field(..., description="用户唯一标识")
    chat_id: str | None = Field(None, description="对话ID")
    images: list[KlingImagesParameter] | None = Field(None, description="视频/图片输入列表")
    zidingyican: list[KlingCustomParameter] = Field(..., description="自定义参数列表")


def _build_omni_params(req: KlingO1GenerateRequest) -> dict[str, Any]:
    """根据请求构建 Kling omni-video API 参数 (迁移自历史实现)."""
    api_params: dict[str, Any] = {
        "model_name": KLING_MODEL_O1,
        "prompt": req.prompt,
    }

    image_list: list[dict[str, Any]] = []
    video_list: list[dict[str, Any]] = []

    # 处理 images -- 仅提取视频 URL (与历史实现一致, 忽略纯图片)
    if req.images:
        for param2 in req.images:
            if param2.isVideo and param2.video_url:
                if not video_list:
                    video_list.append({})
                video_list[0]["video_url"] = param2.video_url

    # 处理自定义参数
    for param in req.zidingyican:
        if not param.value:
            continue
        if param.name == "first_frame":
            image_list.append({"image_url": param.value, "type": "first_frame"})
        elif param.name == "end_frame" and image_list:
            image_list.append({"image_url": param.value, "type": "end_frame"})
        elif param.name == "mode":
            api_params["mode"] = param.value
        elif param.name == "aspect_ratio":
            api_params["aspect_ratio"] = param.value
        elif param.name == "duration":
            api_params["duration"] = str(param.value)
        elif param.name == "refer_type":
            if not video_list:
                video_list.append({})
            video_list[0]["refer_type"] = param.value
        elif param.name == "keep_original_sound":
            if not video_list:
                video_list.append({})
            video_list[0]["keep_original_sound"] = param.value

    if image_list:
        api_params["image_list"] = image_list
    if video_list:
        api_params["video_list"] = video_list
    return api_params


def _extract_external_task_id(req: KlingO1GenerateRequest) -> str:
    """从自定义参数中提取 external_task_id."""
    for p in req.zidingyican:
        if p.name == "external_task_id":
            return str(p.value)
    return ""


def _sse(data: dict[str, Any]) -> str:
    """格式化 SSE data 行."""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/generate", summary="Kling O1 omni-video 生成 (SSE 流式)")
async def kling_o1_generate(req: KlingO1GenerateRequest):
    """调用 Kling O1 omni-video 接口, SSE 流式返回任务状态.

    流程: 余额校验 -> 生成 JWT -> 构建 omni-video 参数 -> 提交任务 ->
    SSE 流式轮询任务状态 (每 5 秒, 最长 5 分钟).
    """
    logger.info(
        f"Kling O1 生成开始 user={req.user_uuid} prompt={req.prompt[:100]}"
    )

    # 1. 余额校验 (check_user_token_sufficient 为同步函数, to_thread 包装)
    token_check = await asyncio.to_thread(check_user_token_sufficient, req.user_uuid)
    if not token_check.get("sufficient"):
        msg = token_check.get("reason") or token_check.get("error") or "余额不足"
        logger.warning(f"Kling O1 余额不足: {msg} user={req.user_uuid}")
        return StreamingResponse(
            iter([_sse({"code": "403", "message": msg, "data": {}})]),
            media_type="text/event-stream",
        )

    # 2. 生成 Kling JWT
    try:
        jwt_token = encode_jwt_token()
    except Exception as e:
        logger.debug(f"Kling JWT 生成失败: {e}")
        return StreamingResponse(
            iter([_sse({"code": "500", "message": "生成 API 签名失败", "data": {}})]),
            media_type="text/event-stream",
        )

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {jwt_token}",
    }

    # 3. 构建请求参数
    api_params = _build_omni_params(req)
    external_task_id = _extract_external_task_id(req)
    api_url = f"{KLING_BASE_URL}{KLING_O1_METHOD_URL}"
    logger.info(f"Kling O1 调用 {api_url} params={json.dumps(api_params, ensure_ascii=False)}")

    # 4. 提交任务
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(api_url, headers=headers, json=api_params)
    except Exception as e:
        logger.debug(f"Kling O1 提交异常: {e}")
        return StreamingResponse(
            iter(
                [
                    _sse(
                        {
                            "code": "500",
                            "message": f"调用 Kling API 异常: {e}",
                            "data": {},
                        }
                    )
                ]
            ),
            media_type="text/event-stream",
        )

    if resp.status_code != 200:
        err_msg = f"Kling API 调用失败: {resp.status_code}"
        try:
            err_detail = resp.json()
            err_msg += f", {err_detail.get('message', '')}"
        except Exception:
            err_msg += f", {resp.text[:300]}"
        logger.error(f"Kling O1 提交失败: {err_msg}")
        return StreamingResponse(
            iter([_sse({"code": resp.status_code, "message": err_msg, "data": {}})]),
            media_type="text/event-stream",
        )

    try:
        result = resp.json()
    except Exception as e:
        logger.debug(f"Kling O1 响应解析失败: {e}")
        return StreamingResponse(
            iter([_sse({"code": "500", "message": "Kling API 响应解析失败", "data": {}})]),
            media_type="text/event-stream",
        )

    task_id = result.get("task_id")
    if not task_id:
        return StreamingResponse(
            iter([_sse({"code": "500", "message": "未获取到任务ID", "data": {}})]),
            media_type="text/event-stream",
        )

    logger.info(f"Kling O1 任务已提交 task_id={task_id}")

    # 5. SSE 流式轮询
    status_api_url = f"{KLING_BASE_URL}/v1/videos/task/{task_id}"
    initial_status = result.get("task_status", "submitted")
    created_at = result.get("created_at", int(time.time() * 1000))
    updated_at = result.get("updated_at", int(time.time() * 1000))

    async def event_stream():
        # 首次推送初始状态
        initial = {
            "code": 0,
            "message": "success",
            "request_id": str(uuid.uuid4()),
            "data": {
                "task_id": task_id,
                "task_info": {"external_task_id": external_task_id},
                "task_status": initial_status,
                "created_at": created_at,
                "updated_at": updated_at,
            },
        }
        yield _sse(initial)

        retry_count = 0
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                while retry_count < MAX_POLL_RETRIES:
                    await asyncio.sleep(POLL_INTERVAL_SEC)
                    retry_count += 1
                    try:
                        status_resp = await client.get(status_api_url, headers=headers)
                        if status_resp.status_code != 200:
                            logger.debug(
                                f"Kling O1 状态查询 HTTP {status_resp.status_code}"
                            )
                            continue
                        status_result = status_resp.json()
                        task_status = status_result.get("task_status", "unknown")

                        status_data = {
                            "code": 0,
                            "message": "success",
                            "request_id": str(uuid.uuid4()),
                            "data": {
                                "task_id": task_id,
                                "task_info": status_result.get("task_info", {}),
                                "task_status": task_status,
                                "created_at": status_result.get(
                                    "created_at", int(time.time() * 1000)
                                ),
                                "updated_at": status_result.get(
                                    "updated_at", int(time.time() * 1000)
                                ),
                            },
                        }
                        if task_status == "succeed" and "data" in status_result:
                            status_data["data"]["task_result"] = status_result["data"]

                        yield _sse(status_data)

                        if task_status in ("succeed", "failed"):
                            break
                    except Exception as e:
                        logger.debug(f"Kling O1 状态查询异常: {e}")
        except Exception as e:
            logger.debug(f"Kling O1 轮询异常: {e}")

        # 超时
        if retry_count >= MAX_POLL_RETRIES:
            timeout_resp = {
                "code": 0,
                "message": "查询超时",
                "request_id": str(uuid.uuid4()),
                "data": {
                    "task_id": task_id,
                    "task_info": {"external_task_id": external_task_id},
                    "task_status": "timeout",
                    "created_at": int(time.time() * 1000),
                    "updated_at": int(time.time() * 1000),
                },
            }
            yield _sse(timeout_resp)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
