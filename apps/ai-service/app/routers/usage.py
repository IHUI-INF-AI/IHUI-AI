"""LLM 用量统计路由。

提供 Token 用量查询、成本统计、配额管理接口。
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from app.services.llm_usage_service import usage_service

router = APIRouter(prefix="/api/v1/ai/usage", tags=["ai-usage"])


@router.get("/stats")
async def get_usage_stats(
    request: Request,
    days: int = Query(7, ge=1, le=365, description="统计天数范围"),
    user_id: str | None = Query(None, description="指定用户 ID(管理员用)"),
) -> dict[str, Any]:
    """获取用户用量统计。"""
    uid = user_id or getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=400, detail="缺少 user_id 参数或 JWT 未登录")
    return {"code": 200, "message": "ok", "data": usage_service.get_user_stats(uid, days=days)}


@router.get("/global")
async def get_global_stats(
    days: int = Query(7, ge=1, le=365, description="统计天数范围"),
) -> dict[str, Any]:
    """获取全局用量统计。"""
    return {"code": 200, "message": "ok", "data": usage_service.get_global_stats(days=days)}


@router.get("/quota")
async def get_quota_info(
    request: Request,
    user_id: str | None = Query(None, description="指定用户 ID(管理员用)"),
) -> dict[str, Any]:
    """获取用户配额信息。"""
    uid = user_id or getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=400, detail="缺少 user_id 参数或 JWT 未登录")
    return {"code": 200, "message": "ok", "data": usage_service.get_quota_info(uid)}


@router.post("/record")
async def record_usage(
    request: Request,
    body: dict[str, Any],
) -> dict[str, Any]:
    """记录一次 LLM 调用用量(供 llm_gateway 调用)。"""
    provider = body.get("provider", "")
    model = body.get("model", "")
    user_id = body.get("user_id") or getattr(request.state, "user_id", None)
    input_tokens = int(body.get("input_tokens", 0))
    output_tokens = int(body.get("output_tokens", 0))
    session_id = body.get("session_id", "")

    if not provider or not model:
        raise HTTPException(status_code=400, detail="缺少 provider 或 model 参数")
    if not user_id:
        raise HTTPException(status_code=400, detail="缺少 user_id 参数或 JWT 未登录")
    if input_tokens < 0 or output_tokens < 0:
        raise HTTPException(status_code=400, detail="token 数量不能为负数")

    record = usage_service.record_usage(
        provider=provider,
        model=model,
        user_id=user_id,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        session_id=session_id,
    )
    return {
        "code": 200,
        "message": "ok",
        "data": {
            "id": record.id,
            "estimated_cost": record.estimated_cost,
        },
    }