"""Canary 阶段化门控 HTTP API (建议 128).

端点 (所有端点需 admin 权限 - 建议 133: 接入 require_role("admin") 鉴权):
  GET    /canary/stage             - 拿当前阶段状态 (含 ratio / cooldown / failures / history)
  POST   /canary/promote           - 提升到下一阶段 (cooldown 中会拒绝)
  POST   /canary/rollback          - 回滚到上一阶段 (不受 cooldown 限制)
  POST   /canary/reset             - 重置到 STAGE_0
  POST   /canary/failure           - 标记一次失败 (阈值触发自动回滚)
  POST   /canary/traffic           - 报告阶段内流量数 (用于审计)

响应格式:
    {
        "ok": true,
        "data": {
            "current_stage": "1%",
            "ratio": 0.01,
            "cooldown_remaining": 0.0,
            "failures": 0,
            "traffic": 0,
            "last_event": {...},
            "history": [...]
        }
    }

状态文件:
    默认持久化到 /tmp/zhs_canary_state.json (可由 ZHS_CANARY_STATE_FILE env 覆盖)

建议 133 - Canary admin 鉴权:
    所有 canary 端点 (除 /stage 只读) 接入 require_role("admin") 鉴权,
    拿不到 admin 角色返回 403, 跟项目其他 admin 端点 (margin, admin_admin) 一致.
    /canary/stage 保留只读权限 (登录即可), 方便 Grafana/Prometheus 抓取.
"""

from __future__ import annotations

import os
import tempfile
import threading

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from pydantic import BaseModel, Field

from app.canary_stages import (
    CanaryStageController,
    StageCooldownError,
    StageError,
)
from app.security import require_role

# ---------------------------------------------------------------------------
# 路由 + 单例 controller
# ---------------------------------------------------------------------------

router = APIRouter()
_LOCK = threading.Lock()
_CTRL: CanaryStageController | None = None

# 建议 133: admin 角色依赖 (复用项目现有角色体系)
_admin_dep = require_role("admin")


def _get_controller() -> CanaryStageController:
    global _CTRL
    with _LOCK:
        if _CTRL is None:
            # 2026-06-25 修复: 原硬编码 /tmp/zhs_canary_state.json 在 Windows 上会创建到当前盘根 (G:\tmp\...)
            # 改用 tempfile.gettempdir() 跨平台; 仍可由环境变量 ZHS_CANARY_STATE_FILE 覆盖
            default_state = os.path.join(tempfile.gettempdir(), "zhs_canary_state.json")
            state_file = os.environ.get("ZHS_CANARY_STATE_FILE", default_state)
            _CTRL = CanaryStageController(state_file=state_file)
        return _CTRL


def _state_to_dict(ctrl: CanaryStageController) -> dict:
    s = ctrl.state()
    return {
        "current_stage": s.current_stage,
        "ratio": ctrl.current_ratio(),
        "cooldown_remaining": round(ctrl.cooldown_remaining(), 2),
        "is_in_cooldown": ctrl.is_in_cooldown(),
        "failures": s.failures_in_stage,
        "traffic": s.total_traffic_in_stage,
        "last_event": s.last_event,
        "history": s.history[-20:],  # 最近 20 条
    }


def _event_to_dict(ev) -> dict:
    return {
        "ts": ev.ts,
        "from_stage": ev.from_stage,
        "to_stage": ev.to_stage,
        "actor": ev.actor,
        "reason": ev.reason,
        "event_type": ev.event_type,
    }


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class PromoteRequest(BaseModel):
    actor: str = Field("api", description="操作者")
    reason: str = Field("", description="原因")


class RollbackRequest(BaseModel):
    actor: str = Field("api", description="操作者")
    reason: str = Field("", description="原因")
    auto: bool = Field(False, description="是否自动回滚")


class ResetRequest(BaseModel):
    actor: str = Field("api", description="操作者")
    reason: str = Field("API 重置", description="原因")


class FailureRequest(BaseModel):
    reason: str = Field("", description="失败原因")
    actor: str = Field("api", description="报告者")


class TrafficRequest(BaseModel):
    count: int = Field(1, ge=1, description="流量数")


class CanaryResponse(BaseModel):
    ok: bool = True
    data: dict = {}


class ErrorResponse(BaseModel):
    ok: bool = False
    error: str
    detail: str | None = None


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.get("/canary/stage", response_model=CanaryResponse, tags=["Canary"])
def get_canary_stage(_admin: str = Depends(_admin_dep)):
    """查询当前 canary 阶段状态 (建议 133: 需 admin 角色)."""
    ctrl = _get_controller()
    return CanaryResponse(ok=True, data=_state_to_dict(ctrl))


@router.post("/canary/promote", response_model=CanaryResponse, tags=["Canary"])
def post_canary_promote(req: PromoteRequest, _admin: str = Depends(_admin_dep)):
    """提升到下一阶段 (受 cooldown 约束, 建议 133: 需 admin 角色)."""
    ctrl = _get_controller()
    try:
        ev = ctrl.promote(actor=req.actor, reason=req.reason)
    except StageCooldownError as e:
        logger.error("Canary promote cooldown: %s", e)
        raise HTTPException(status_code=429, detail="操作过于频繁,请稍后重试") from e
    except StageError as e:
        logger.error("Canary promote stage error: %s", e)
        raise HTTPException(status_code=400, detail="阶段操作失败") from e
    return CanaryResponse(
        ok=True,
        data={
            "event": _event_to_dict(ev),
            "state": _state_to_dict(ctrl),
        },
    )


@router.post("/canary/rollback", response_model=CanaryResponse, tags=["Canary"])
def post_canary_rollback(req: RollbackRequest, _admin: str = Depends(_admin_dep)):
    """回滚到上一阶段 (不受 cooldown 限制, 建议 133: 需 admin 角色)."""
    ctrl = _get_controller()
    try:
        ev = ctrl.rollback(actor=req.actor, reason=req.reason, auto=req.auto)
    except StageError as e:
        logger.error("Canary rollback stage error: %s", e)
        raise HTTPException(status_code=400, detail="阶段操作失败") from e
    except HTTPException:
        raise
    return CanaryResponse(
        ok=True,
        data={
            "event": _event_to_dict(ev),
            "state": _state_to_dict(ctrl),
        },
    )


@router.post("/canary/reset", response_model=CanaryResponse, tags=["Canary"])
def post_canary_reset(req: ResetRequest, _admin: str = Depends(_admin_dep)):
    """重置到 STAGE_0 (新灰度周期, 建议 133: 需 admin 角色)."""
    ctrl = _get_controller()
    ev = ctrl.reset(actor=req.actor, reason=req.reason)
    return CanaryResponse(
        ok=True,
        data={
            "event": _event_to_dict(ev),
            "state": _state_to_dict(ctrl),
        },
    )


@router.post("/canary/failure", response_model=CanaryResponse, tags=["Canary"])
def post_canary_failure(req: FailureRequest, _admin: str = Depends(_admin_dep)):
    """标记一次失败 (累计达阈值自动回滚, 建议 133: 需 admin 角色)."""
    ctrl = _get_controller()
    ev = ctrl.mark_failure(reason=req.reason)
    return CanaryResponse(
        ok=True,
        data={
            "event": _event_to_dict(ev),
            "state": _state_to_dict(ctrl),
        },
    )


@router.post("/canary/traffic", response_model=CanaryResponse, tags=["Canary"])
def post_canary_traffic(req: TrafficRequest, _admin: str = Depends(_admin_dep)):
    """报告阶段内流量数 (建议 133: 需 admin 角色)."""
    ctrl = _get_controller()
    ctrl.mark_traffic(req.count)
    return CanaryResponse(ok=True, data=_state_to_dict(ctrl))
