"""API v2 演进路径 (实验性).

v1 → v2 迁移策略:
  - v1 保持 100% 兼容 (永不删除)
  - v2 用白名单方式引入新接口 (e.g. /api/v2/auth/...)
  - v1 调用方无需修改 (header 协商 Accept: application/vnd.zhs.v2+json)

v2 已实现:
  - 暂无 (仅占位)

v2 计划:
  - 统一 GraphQL 入口 (单 endpoint 查所有数据)
  - 强化权限 (OAuth2 + Scope)
  - 字段级脱敏 (在 schema 层做)
  - 全量 OpenAPI 规范生成
"""

from fastapi import APIRouter, Request

# v2 暂未实现具体业务, 仅提供元数据
router = APIRouter(tags=["API v2 (Experimental)"])


@router.get("/api/v2/info", summary="v2 API 元数据")
async def v2_info(request: Request):
    """返回 v2 API 元信息 (供客户端探测)."""
    return {
        "version": "v2",
        "status": "experimental",
        "compatible_from": "v1",
        "endpoints": [],  # 待补充
        "docs_url": "/openapi/tag/API v2 (Experimental)",
    }


@router.get("/api/v2/ping", summary="v2 API ping")
async def v2_ping():
    return {"code": "0", "msg": "pong", "data": {"version": "v2"}}
