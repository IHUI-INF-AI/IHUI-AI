"""WebSocket 自动恢复监控路由 (2026-06-26 新增).

端点:
  - GET /api/v1/system/auto-recovery/metrics
        Prometheus 文本格式 metrics, 便于 Prometheus / Grafana 抓取
  - GET /api/v1/system/auto-recovery/status
        JSON 状态报告 (与 /cozeZhsApi/ws/websocket/auto-recovery-status 互补)
  - GET /api/v1/system/auto-recovery/history
        恢复历史记录 (最近 50 条)

设计原则:
- 复用 prometheus_client 全局 registry, 不新建 registry
- 鉴权: 内部监控端点, 暂不加 admin_required (与 /metrics 端点策略一致)
  如需鉴权, 可通过反向代理 / 网关层处理
"""
from __future__ import annotations

import time

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from loguru import logger

router = APIRouter()


# ---------------------------------------------------------------------------
# GET /api/v1/system/auto-recovery/metrics  Prometheus 文本格式
# ---------------------------------------------------------------------------
@router.get(
    "/auto-recovery/metrics",
    summary="WebSocket auto-recovery Prometheus metrics",
    include_in_schema=False,
)
async def get_auto_recovery_metrics() -> Response:
    """返回 Prometheus 文本格式的 auto-recovery 指标.

    包含:
      - zhs_ws_auto_recovery_* 所有 Counter / Gauge / Histogram
      - 标准 prometheus_client 输出 (HELP + TYPE 行)
    """
    try:
        # 拉取最新一次状态后再生成输出
        from app.ws.auto_recovery import _auto_recovery_manager
        from app.ws.auto_recovery_metrics import update_gauges

        if update_gauges is not None:
            try:
                update_gauges(_auto_recovery_manager)
            except Exception:
                logger.debug("[auto_recovery_routes] update_gauges 失败", exc_info=False)

        body = generate_latest()
        return Response(content=body, media_type=CONTENT_TYPE_LATEST)
    except Exception as e:
        logger.error(f"生成 auto-recovery metrics 失败: {e}")
        return PlainTextResponse(
            content=f"# generation failed: {e}\n",
            status_code=500,
            media_type="text/plain; charset=utf-8",
        )


# ---------------------------------------------------------------------------
# GET /api/v1/system/auto-recovery/status  JSON 格式
# ---------------------------------------------------------------------------
@router.get(
    "/auto-recovery/status",
    summary="WebSocket auto-recovery status (JSON)",
)
async def get_auto_recovery_status_json() -> dict:
    """返回 JSON 格式的恢复状态.

    与 /cozeZhsApi/ws/websocket/auto-recovery-status 内容一致,
    但路径在 system 命名空间下, 便于运维工具统一拉取.
    """
    try:
        from app.ws.auto_recovery import get_recovery_status

        return {
            "success": True,
            "data": get_recovery_status(),
            "timestamp": time.time(),
        }
    except Exception as e:
        logger.error(f"获取 auto-recovery 状态失败: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": time.time(),
        }


# ---------------------------------------------------------------------------
# GET /api/v1/system/auto-recovery/history  恢复历史
# ---------------------------------------------------------------------------
@router.get(
    "/auto-recovery/history",
    summary="WebSocket auto-recovery history",
)
async def get_auto_recovery_history(limit: int = 50) -> dict:
    """返回最近的恢复历史 (默认 50 条, 可配置).

    Args:
        limit: 返回条数上限, 范围 1-50, 超过截断到 50.
    """
    limit = max(1, min(int(limit), 50))
    try:
        from app.ws.auto_recovery import _auto_recovery_manager

        if _auto_recovery_manager is None:
            return {
                "success": True,
                "data": {"history": [], "count": 0},
                "timestamp": time.time(),
            }
        history = list(_auto_recovery_manager.recovery_history or [])
        return {
            "success": True,
            "data": {
                "history": history[-limit:],
                "count": len(history),
                "recovery_count": _auto_recovery_manager.recovery_count,
            },
            "timestamp": time.time(),
        }
    except Exception as e:
        logger.error(f"获取 auto-recovery history 失败: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": time.time(),
        }
