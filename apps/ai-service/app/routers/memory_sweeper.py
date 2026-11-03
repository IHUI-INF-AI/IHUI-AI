# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Memory Sweeper 路由 — 长期记忆存储 + 记忆清扫策略的 REST 出口。

对标 Codex / Claude Code 长期记忆衰减机制(2026-09-13 立)。

挂载说明:本模块导出 `router: APIRouter`(prefix="/memory-sweeper"),由 main.py 以
`app.include_router(memory_sweeper_router, prefix="/api", tags=["memory-sweeper"])`
方式挂载,最终端点路径:
  POST /api/memory-sweeper/create   → 写入一条长期记忆(content + importance + metadata)
  GET  /api/memory-sweeper/list     → 列出当前用户记忆(默认仅未 sweep 的,分页 +
                                       可选 includeSwept)
  POST /api/memory-sweeper/sweep    → 按策略清扫当前用户过期/低价值/超容量记忆
                                       (支持 dryRun 预演 + 覆盖默认策略参数)

存储:复用 services.memory_sweeper.MemorySweeper(纯 sqlite3,WAL + 事务 + 线程锁)。
认证:复用 get_current_user_id(记忆按 user_id 隔离,仅本人可见)。
响应统一信封 {code:0, message, data},对齐前端 api-client(api-client 以 code===0 判成功)。
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from ..core.jwt_auth import get_current_user_id
from ..services.memory_sweeper import get_memory_sweeper

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/memory-sweeper", tags=["memory-sweeper"])


class CreateMemoryRequest(BaseModel):
    """create 请求体(对外 camelCase,内部 snake_case)。"""

    model_config = ConfigDict(populate_by_name=True)

    content: str = Field(
        ...,
        min_length=1,
        validation_alias="content",
        description="记忆内容(非空)",
    )
    importance: float = Field(
        0.5,
        ge=0.0,
        le=1.0,
        validation_alias="importance",
        description="重要度权重 0~1(默认 0.5)",
    )
    metadata: dict[str, Any] | None = Field(
        None,
        validation_alias="metadata",
        description="可选结构化元数据",
    )


class SweepRequest(BaseModel):
    """sweep 请求体(可覆盖默认清扫策略参数;dryRun 只预演不落库)。"""

    model_config = ConfigDict(populate_by_name=True)

    max_age_days: int | None = Field(
        None,
        ge=1,
        validation_alias="maxAgeDays",
        description="记忆最大存活天数(缺省用服务默认 30)",
    )
    min_importance: float | None = Field(
        None,
        ge=0.0,
        le=1.0,
        validation_alias="minImportance",
        description="低价值阈值,importance 低于此值且过期才淘汰(缺省 0.2)",
    )
    max_memories_per_user: int | None = Field(
        None,
        ge=1,
        validation_alias="maxMemoriesPerUser",
        description="单用户未 sweep 记忆软上限(缺省 500)",
    )
    dry_run: bool = Field(
        False,
        validation_alias="dryRun",
        description="true 时只统计 would_sweep,不真正落库",
    )


@router.post("/create")
async def create_memory(
    body: CreateMemoryRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """写入当前用户的一条长期记忆。"""
    memory = get_memory_sweeper().add_memory(
        user_id,
        body.content,
        importance=body.importance,
        metadata=body.metadata,
    )
    logger.info(
        "memory-sweeper create user=%s memory=%s importance=%.2f",
        user_id, memory["memory_id"], memory["importance"],
    )
    return {"code": 0, "message": "ok", "data": memory}


@router.get("/list")
async def list_memories(
    include_swept: bool = Query(
        False,
        validation_alias="includeSwept",
        description="是否包含已被 sweep(软删除)的记忆",
    ),
    limit: int = Query(100, ge=1, le=500, description="分页大小"),
    offset: int = Query(0, ge=0, description="分页偏移"),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """列出当前用户的记忆(默认仅未 sweep,按最近访问倒序,分页)。"""
    data = get_memory_sweeper().list_memories(
        user_id,
        include_swept=include_swept,
        limit=limit,
        offset=offset,
    )
    logger.info(
        "memory-sweeper list user=%s total=%s include_swept=%s",
        user_id, data["total"], include_swept,
    )
    return {"code": 0, "message": "ok", "data": data}


@router.post("/sweep")
async def sweep_memories(
    body: SweepRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """按策略清扫当前用户的记忆(过期低价值 + 容量溢出;软删除可审计)。"""
    report = get_memory_sweeper().sweep(
        user_id,
        max_age_days=body.max_age_days,
        min_importance=body.min_importance,
        max_memories_per_user=body.max_memories_per_user,
        dry_run=body.dry_run,
    )
    logger.info(
        "memory-sweeper sweep user=%s dry_run=%s swept=%s would=%s",
        user_id, body.dry_run, report["swept"], report["would_sweep"],
    )
    return {"code": 0, "message": "ok", "data": report}


__all__ = ["router"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
