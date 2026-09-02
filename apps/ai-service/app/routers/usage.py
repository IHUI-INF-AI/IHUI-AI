# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""LLM 用量统计路由。

提供 Token 用量查询、成本统计、配额管理接口。
"""
from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from app.services.llm_usage_service import usage_service

logger = logging.getLogger(__name__)

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
    return {"code": 0, "message": "ok", "data": usage_service.get_user_stats(uid, days=days)}


@router.get("/global")
async def get_global_stats(
    days: int = Query(7, ge=1, le=365, description="统计天数范围"),
) -> dict[str, Any]:
    """获取全局用量统计。"""
    return {"code": 0, "message": "ok", "data": usage_service.get_global_stats(days=days)}


@router.get("/quota")
async def get_quota_info(
    request: Request,
    user_id: str | None = Query(None, description="指定用户 ID(管理员用)"),
) -> dict[str, Any]:
    """获取用户配额信息。"""
    uid = user_id or getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=400, detail="缺少 user_id 参数或 JWT 未登录")
    return {"code": 0, "message": "ok", "data": usage_service.get_quota_info(uid)}


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
        "code": 0,
        "message": "ok",
        "data": {
            "id": record.id,
            "estimated_cost": record.estimated_cost,
        },
    }


@router.get("/agent")
async def get_agent_budget_usage() -> dict[str, Any]:
    """Agent 主循环预算治理摘要(供 web 面板未来接入)。

    数据源:budget governor 全局单例(LLM 成本预算 + 6 大支柱分配 + 趋势)。
    返回 {enabled, pillar, usage_percent, today_tokens, pillar_usage_percent,
          remaining_tokens, degraded_model, trend}。
    """
    enabled = os.environ.get("AGENT_BUDGET_ENABLED", "false").strip().lower() in (
        "on", "1", "true", "yes",
    )
    pillar = os.environ.get("AGENT_BUDGET_PILLAR", "terminal").strip().lower() or "terminal"
    try:
        from app.services.llm_budget_governor import llm_budget_governor

        summary = await llm_budget_governor.get_usage_summary("today")
        pillar_budget = await llm_budget_governor.get_pillar_budget(pillar)
        trend = await llm_budget_governor.get_usage_trend(7)
    except Exception as e:
        logger.warning("budget governor 摘要获取失败(降级): %s", e)
        return {
            "code": 0,
            "message": "ok",
            "data": {"enabled": enabled, "pillar": pillar, "error": str(e)},
        }
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "enabled": enabled,
            "pillar": pillar,
            "usage_percent": summary["usage_percent"],
            "today_tokens": summary["total_tokens"],
            "pillar_usage_percent": pillar_budget["usage_percent"],
            "remaining_tokens": pillar_budget["remaining"]["tokens"],
            "degraded_model": pillar_budget.get("degraded_model"),
            "trend": trend,
        },
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
