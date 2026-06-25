"""Dual-write / Dual-read / Reconcile management endpoints.

接入 dual_write service, 提供:
- 双写配置查询/切换
- 手动触发全量对账
- 对账报告查询
"""
from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.security import require_login
from app.services.dual_write import (
    DUAL_WRITE_ENABLED,
    DUAL_WRITE_PRIMARY,
    DUAL_WRITE_READ_FROM,
    DUAL_WRITE_RECONCILE,
    SourceDisk,
    full_reconcile,
    reconcile_table,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dual-write", tags=["Dual-Write Management"])


# ---------------------------------------------------------------------------
# Pydantic
# ---------------------------------------------------------------------------

class DualWriteConfig(BaseModel):
    enabled: bool
    primary: str
    read_from: str
    reconcile: bool


class ConfigUpdateReq(BaseModel):
    enabled: bool | None = None
    primary: str | None = None
    read_from: str | None = None
    reconcile: bool | None = None


class ReconcileTableReq(BaseModel):
    table: str
    pk_field: str = "id"


# ---------------------------------------------------------------------------
# 配置查询 / 更新
# ---------------------------------------------------------------------------

@router.get("/config", summary="查询双写配置")
def get_config(_user: str = Depends(require_login)) -> DualWriteConfig:
    return DualWriteConfig(
        enabled=DUAL_WRITE_ENABLED,
        primary=DUAL_WRITE_PRIMARY,
        read_from=DUAL_WRITE_READ_FROM,
        reconcile=DUAL_WRITE_RECONCILE,
    )


@router.put("/config", summary="更新双写配置 (运行时切换)")
async def update_config(req: ConfigUpdateReq, _user: str = Depends(require_login)) -> DualWriteConfig:
    """运行时修改双写配置, 仅修改环境变量, 重启进程后失效.

    注: 这是为运维调试提供的便利接口, 生产环境应通过 K8s configmap 更新.
    """
    if req.enabled is not None:
        os.environ["DUAL_WRITE_ENABLED"] = "true" if req.enabled else "false"
    if req.primary is not None:
        if req.primary not in ("H", "G"):
            raise HTTPException(status_code=400, detail="primary 必须是 H 或 G")
        os.environ["DUAL_WRITE_PRIMARY"] = req.primary
    if req.read_from is not None:
        if req.read_from not in ("H", "G", "BOTH"):
            raise HTTPException(status_code=400, detail="read_from 必须是 H/G/BOTH")
        os.environ["DUAL_WRITE_READ_FROM"] = req.read_from
    if req.reconcile is not None:
        os.environ["DUAL_WRITE_RECONCILE"] = "true" if req.reconcile else "false"

    return await get_config(_user)


# ---------------------------------------------------------------------------
# 对账
# ---------------------------------------------------------------------------

@router.post("/reconcile/table", summary="对单表对账")
def reconcile_one_table(
    req: ReconcileTableReq,
    _user: str = Depends(require_login),
):
    """对账: 对比 H 盘 vs G 盘某张表的行差异."""
    report = reconcile_table(req.table, req.pk_field)
    return {
        "code": 0,
        "data": {
            "table": report.table,
            "h_count": report.h_count,
            "g_count": report.g_count,
            "only_in_h": report.only_in_h[:100],
            "only_in_g": report.only_in_g[:100],
            "diff_count": len(report.only_in_h) + len(report.only_in_g),
        },
        "msg": "ok",
    }


@router.post("/reconcile/full", summary="全量对账 (所有核心表)")
def reconcile_all(_user: str = Depends(require_login)):
    """对所有核心表执行对账, 返回报告列表."""
    reports = full_reconcile()
    return {
        "code": 0,
        "data": {
            "total": len(reports),
            "reports": [
                {
                    "table": r.table,
                    "h_count": r.h_count,
                    "g_count": r.g_count,
                    "diff_count": len(r.only_in_h) + len(r.only_in_g),
                }
                for r in reports
            ],
        },
        "msg": "ok",
    }


# ---------------------------------------------------------------------------
# 读盘策略
# ---------------------------------------------------------------------------

@router.get("/source-disks", summary="可用读盘策略枚举")
def list_source_disks(_user: str = Depends(require_login)):
    return {
        "code": 0,
        "data": [{"value": d.value, "label": d.name} for d in SourceDisk],
        "msg": "ok",
    }
