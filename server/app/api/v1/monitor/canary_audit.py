"""Canary 阶段事件审计查询 API (建议 151) - app/api/v1/monitor/canary_audit.py.

端点:
  GET /monitor/canary-audit              - 查审计日志 (按时间倒序)
  GET /monitor/canary-audit/stats        - 审计统计 (按 source 分组)
  POST /monitor/canary-audit/cleanup     - 手动触发过期清理

请求参数 (query):
  limit: 最多返回条数 (默认 100, 最大 1000)
  source: controller / promoter / override (可选)
  action: promote / rollback / pause / resume / force_promote / ... (可选)
  since_ts: 起始时间戳 (可选)
  until_ts: 结束时间戳 (可选)

鉴权: admin 角色 (与 canary 其他端点一致)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.canary_audit_store import get_default_audit_store
from app.security import require_role

router = APIRouter()
_admin_dep = require_role("admin")


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class ApiResponse(BaseModel):
    ok: bool = True
    data: dict = {}


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.get("/canary-audit", response_model=ApiResponse, tags=["Monitor: Canary Audit"])
def query_canary_audit(
    limit: int = Query(100, ge=1, le=1000, description="返回条数限制"),
    source: str | None = Query(None, description="controller / promoter / override"),
    action: str | None = Query(None, description="事件类型过滤"),
    since_ts: float | None = Query(None, description="起始时间戳"),
    until_ts: float | None = Query(None, description="结束时间戳"),
    _admin: str = Depends(_admin_dep),
):
    """查 Canary 审计日志 (按时间倒序)."""
    store = get_default_audit_store()
    items = store.query(
        limit=limit,
        source=source,
        action=action,
        since_ts=since_ts,
        until_ts=until_ts,
    )
    return ApiResponse(
        ok=True,
        data={
            "count": len(items),
            "items": items,
        },
    )


@router.get("/canary-audit/stats", response_model=ApiResponse, tags=["Monitor: Canary Audit"])
def canary_audit_stats(_admin: str = Depends(_admin_dep)):
    """审计统计 (按 source 分组 + 总数)."""
    store = get_default_audit_store()
    return ApiResponse(
        ok=True,
        data={
            "total": store.count(),
            "controller": store.count(source="controller"),
            "promoter": store.count(source="promoter"),
            "override": store.count(source="override"),
        },
    )


@router.post("/canary-audit/cleanup", response_model=ApiResponse, tags=["Monitor: Canary Audit"])
def canary_audit_cleanup(_admin: str = Depends(_admin_dep)):
    """手动触发过期清理 (按 store._retention_days)."""
    store = get_default_audit_store()
    deleted = store.cleanup_expired()
    return ApiResponse(
        ok=True,
        data={
            "deleted": deleted,
            "retention_days": store._retention_days,
        },
    )
