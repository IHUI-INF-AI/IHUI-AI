"""CanaryAutoPromoter 人工 override HTTP API (建议 149) - app/api/v1/monitor/canary_promoter.py.

端点 (全部需 admin 角色 - 与 canary_routes 保持一致):
  GET    /monitor/canary-promoter/status         - 拿 promoter + override 状态
  POST   /monitor/canary-promoter/pause          - 人工暂停自动推进 (override)
  POST   /monitor/canary-promoter/resume         - 恢复自动推进
  POST   /monitor/canary-promoter/force-promote  - 强制推进 1 步 (忽略所有检查)
  POST   /monitor/canary-promoter/force-rollback - 强制回滚 (紧急, 不受 cooldown 约束)
  GET    /monitor/canary-promoter/override       - 拿 override 详细状态 + 日志
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.canary_auto_promoter import get_default_promoter
from app.security import require_role

router = APIRouter()
_admin_dep = require_role("admin")


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class OverridePauseRequest(BaseModel):
    actor: str = Field("api", description="操作者 (审计必填)")
    reason: str = Field(..., description="暂停原因 (审计必填)")
    until_ts: float = Field(0.0, description="自动恢复时间戳, 0 = 永久")


class OverrideResumeRequest(BaseModel):
    actor: str = Field("api", description="操作者")
    reason: str = Field("", description="恢复原因 (审计可选)")


class ForcePromoteRequest(BaseModel):
    actor: str = Field("api", description="操作者")
    reason: str = Field(..., description="强制推进原因 (审计必填)")


class ForceRollbackRequest(BaseModel):
    actor: str = Field("api", description="操作者")
    reason: str = Field(..., description="强制回滚原因 (审计必填)")


class ApiResponse(BaseModel):
    ok: bool = True
    data: dict = {}


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.get("/canary-promoter/status", response_model=ApiResponse, tags=["Monitor: Canary Promoter"])
def get_promoter_status(_admin: str = Depends(_admin_dep)):
    """拿 CanaryAutoPromoter 完整状态 (含 override)."""
    promoter = get_default_promoter()
    return ApiResponse(ok=True, data=promoter.get_status())


@router.get("/canary-promoter/override", response_model=ApiResponse, tags=["Monitor: Canary Promoter"])
def get_override(_admin: str = Depends(_admin_dep)):
    """拿 override 详细状态 + 日志."""
    promoter = get_default_promoter()
    return ApiResponse(ok=True, data=promoter.get_override_status())


@router.post("/canary-promoter/pause", response_model=ApiResponse, tags=["Monitor: Canary Promoter"])
def post_pause_override(req: OverridePauseRequest, _admin: str = Depends(_admin_dep)):
    """人工暂停自动推进 (override 模式).

    与 promoter.pause() 不同: pause_override 写入 override_log 审计,
    支持 until_ts 自动恢复, check_and_promote 会因 override_active 短路.
    """
    promoter = get_default_promoter()
    result = promoter.pause_override(actor=req.actor, reason=req.reason, until_ts=req.until_ts)
    return ApiResponse(
        ok=True,
        data={
            "override_pause": result,
            "promoter_status": promoter.get_status(),
        },
    )


@router.post("/canary-promoter/resume", response_model=ApiResponse, tags=["Monitor: Canary Promoter"])
def post_resume_override(req: OverrideResumeRequest, _admin: str = Depends(_admin_dep)):
    """解除 override 暂停, 恢复自动检查."""
    promoter = get_default_promoter()
    result = promoter.resume_override(actor=req.actor, reason=req.reason)
    return ApiResponse(
        ok=True,
        data={
            "override_resume": result,
            "promoter_status": promoter.get_status(),
        },
    )


@router.post("/canary-promoter/force-promote", response_model=ApiResponse, tags=["Monitor: Canary Promoter"])
def post_force_promote(req: ForcePromoteRequest, _admin: str = Depends(_admin_dep)):
    """强制推进 1 步 (忽略所有检查 + override 暂停)."""
    promoter = get_default_promoter()
    result = promoter.force_promote(actor=req.actor, reason=req.reason)
    if not result.get("promoted"):
        # 失败也返回 200, 通过 data.promoted 区分; 业务自行处理
        pass
    return ApiResponse(
        ok=True,
        data={
            "force_promote": result,
            "promoter_status": promoter.get_status(),
        },
    )


@router.post("/canary-promoter/force-rollback", response_model=ApiResponse, tags=["Monitor: Canary Promoter"])
def post_force_rollback(req: ForceRollbackRequest, _admin: str = Depends(_admin_dep)):
    """强制回滚 (紧急, 不受 cooldown 约束)."""
    promoter = get_default_promoter()
    result = promoter.force_rollback(actor=req.actor, reason=req.reason)
    return ApiResponse(
        ok=True,
        data={
            "force_rollback": result,
            "promoter_status": promoter.get_status(),
        },
    )
