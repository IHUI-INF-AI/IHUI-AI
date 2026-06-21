"""TBox 智能体发布通知 API.

迁移自 ZHS_Server_java/mcp/controller/TBoxController.java.
"""


from fastapi import APIRouter, Body, Header
from loguru import logger

from app.models.tbox_models import TBoxBean, get_tbox_event_log

router = APIRouter(prefix="/api/tbox", tags=["TBox 智能体发布"])


@router.post("/notify", summary="接收 TBox 事件通知")
async def receive_notify(
    payload: TBoxBean = Body(...),
    x_signature: str | None = Header(None, alias="X-Signature"),
    x_timestamp: str | None = Header(None, alias="X-Timestamp"),
):
    """接收百宝箱事件通知(已迁移核心数据模型)."""
    try:
        log = get_tbox_event_log()
        log.add(payload)
        logger.info(f"TBox 事件: {payload.event}, robot_id={payload.robot_id}")
        return {"code": 0, "message": "ok", "data": {"event_id": payload.event_id or ""}}
    except Exception as e:
        logger.error(f"TBox 通知处理失败: {e}")
        return {"code": 500, "message": str(e), "data": None}


@router.get("/events", summary="查询最近 TBox 事件")
async def recent_events(limit: int = 50):
    """查询最近接收的 TBox 事件."""
    log = get_tbox_event_log()
    return {"code": 0, "message": "ok", "data": log.recent(limit)}
