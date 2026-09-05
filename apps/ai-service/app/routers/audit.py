# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""操作审计日志查询路由(企业级补齐,2026-09-06 立)。

挂载方式(main.py):app.include_router(audit.router, prefix="/api", tags=["audit-log"])
端点:
  GET /api/audit/logs → 分页查询(新→旧),支持 actor / action 过滤

权限示例接入:依赖 require_permission(Permission.AUDIT_READ),
即仅 admin/owner(role_id >= 1)可读,member/viewer → 403。
响应统一信封 {code:0,message,data},对齐项目 router 惯例。
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends

from app.core.rbac import Principal, Permission, require_permission
from app.services.audit_log import audit_log_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit", tags=["audit-log"])


@router.get("/logs")
async def list_audit_logs(
    page: int = 1,
    page_size: int = 20,
    actor: str | None = None,
    action: str | None = None,
    principal: Principal = Depends(require_permission(Permission.AUDIT_READ)),
) -> dict[str, Any]:
    """审计日志列表(分页 + 按 actor/action 过滤,需 audit:read 权限)。"""
    data = audit_log_store.query(page=page, page_size=page_size, actor=actor, action=action)
    logger.info(
        "audit-log list actor=%s=%s page=%s total=%s",
        "filter", actor or "-", page, data["total"],
    )
    return {"code": 0, "message": "ok", "data": data}
