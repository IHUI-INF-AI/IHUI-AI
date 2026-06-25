"""
Java 历史项目 API 兼容层 (Legacy Compatibility Layer) - STUB
============================================================

为 Java 旧 API 路径提供 URL 1:1 兼容, 内部实现状态:
- alias 路由: 调用现有 Python handler (URL 重写, 0 业务代码重复)
- stub 路由: 抛 NotImplementedError, 业务实现标记为 TODO

生成时间: 2026-06-26
总路由数: 488
  - alias 路由 (复用现有): 0
  - stub 路由 (待实现): 488
目标 Java 服务: 22 个

后续迭代计划:
- 按 Controller 优先级分批实现 stub 路由的真实业务逻辑
- 每个 Controller 实现完成后, 移除其 stub, 改为真实 handler
"""
from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException
from loguru import logger

router = APIRouter(prefix="", tags=["legacy-compat"], include_in_schema=False)


def _not_implemented(java_path: str, controller: str):
    """Stub handler - 标记待实现."""
    logger.warning(f"[legacy-stub] Not implemented: {java_path} ({controller})")
    raise HTTPException(
        status_code=501,
        detail=f"Legacy endpoint not yet implemented: {java_path} ({controller})"
    )


# 导入目标 handler (alias 路由使用)


