"""Audit log routes (legacy /api/audit/ paths)."""

from fastapi import APIRouter, Query
from loguru import logger

from app.schemas.common import success

router = APIRouter()


@router.get("/logs", summary="查询审计日志列表")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    module: str = Query("", description="模块过滤"),
):
    """查询审计日志列表 (分页)."""
    return success({"items": [], "total": 0, "page": page, "limit": limit})


@router.get("/log", summary="查询单条审计日志")
async def get_audit_log(id: int = Query(..., description="日志ID")):
    """查询单条审计日志详情."""
    return success(None)


@router.get("/stats", summary="审计日志统计")
async def audit_stats():
    """审计日志统计信息."""
    return success({"total": 0, "today": 0, "modules": {}})


@router.post("/cleanup", summary="清理过期审计日志")
async def cleanup_audit_logs(
    days: int = Query(90, description="保留天数"),
):
    """清理超过指定天数的审计日志."""
    logger.info(f"Audit log cleanup requested, days={days}")
    return success({"deleted": 0})
