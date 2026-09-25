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

from app.core.jwt_auth import require_request_user_id
from app.services.llm_usage_service import usage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai/usage", tags=["ai-usage"])

#: 与 AGENTS.md §5"admin 路由用 preHandler 统一校验(roleId >= 1)"同一条口径。
ADMIN_ROLE_ID = 1


async def _scope_user_id(request: Request, user_id: str | None) -> str:
    """属主口径:一律以**令牌主体**为准;只有管理员(roleId ≥ 1)可以代表他人查询。

    立项事实(2026-09-25,守门 117 正则补宽后才看得见):这些端点原本写的是
    `uid = user_id or request.state.user_id` —— 自报的 user_id **优先于**令牌主体,
    而注释里的"(管理员用)"在本文件内没有任何对应校验。于是任何已登录用户带上
    `?user_id=<别人的 UUID>` 就能读到别人的用量与配额(认证 ≠ 授权)。
    仓内现有调用方(`apps/web` 的两处页面)都不传 user_id,只传 days ⇒ 收紧不影响正常路径。
    """
    caller = await require_request_user_id(request)
    if not user_id or user_id == caller:
        return caller
    role_id = getattr(request.state, "role_id", 0) or 0
    if int(role_id) >= ADMIN_ROLE_ID:
        return user_id
    raise HTTPException(status_code=403, detail="仅管理员可查询他人用量")


@router.get("/stats")
async def get_usage_stats(
    request: Request,
    days: int = Query(7, ge=1, le=365, description="统计天数范围"),
    user_id: str | None = Query(None, description="指定用户 ID(管理员用)"),
) -> dict[str, Any]:
    """获取用户用量统计。"""
    uid = await _scope_user_id(request, user_id)
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
    uid = await _scope_user_id(request, user_id)
    return {"code": 0, "message": "ok", "data": usage_service.get_quota_info(uid)}


@router.post("/record")
async def record_usage(
    request: Request,
    body: dict[str, Any],
) -> dict[str, Any]:
    """记录一次 LLM 调用用量(供 llm_gateway 调用)。

    同 /stats 与 /quota:自报的 body.user_id 不得覆盖令牌主体。实测本路由**在仓内零调用方**
    (`git grep "usage/record"` 全仓 0 命中,进程内路径直接调 `usage_service`),所以这次收紧
    不影响任何在跑的链路;留接口是给外部/将来经鉴权网关转发的调用方用的。
    """
    provider = body.get("provider", "")
    model = body.get("model", "")
    user_id = await _scope_user_id(request, body.get("user_id"))
    input_tokens = int(body.get("input_tokens", 0))
    output_tokens = int(body.get("output_tokens", 0))
    session_id = body.get("session_id", "")

    if not provider or not model:
        raise HTTPException(status_code=400, detail="缺少 provider 或 model 参数")
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


@router.get("/budget-events")
async def get_budget_events(
    limit: int = Query(50, ge=1, le=200, description="返回条数(最新在前)"),
    event_type: str | None = Query(
        None,
        description="按事件类型过滤(budget.warning/budget.critical/budget.degrade/budget.degrade_reset)",
    ),
) -> dict[str, Any]:
    """最近预算超支/预警事件(预算看板数据端点)。

    数据源:budget governor 进程级环形缓冲(_record_budget_event),
    含 usage_percent/pillar/时间戳;进程重启即清空,仅供看板展示。
    """
    try:
        from app.services.llm_budget_governor import llm_budget_governor

        events = llm_budget_governor.get_budget_events(limit=limit, event_type=event_type)
    except Exception as e:
        logger.warning("budget events 获取失败(降级): %s", e)
        return {"code": 0, "message": "ok", "data": {"events": [], "error": str(e)}}
    return {"code": 0, "message": "ok", "data": {"events": events}}


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
