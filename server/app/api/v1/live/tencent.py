"""直播功能 - 腾讯云直播流 (迁移自 edu server ihui-ai-edu-live-service)"""

from datetime import datetime

from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel

from app.database import get_session
from app.models.live_models import LiveChannel, TencentCloudLiveStream
from app.schemas.common import error, success

router = APIRouter()


class StreamNotifyBody(BaseModel):
    channel_id: int
    stream_name: str | None = None


def _stream_to_dict(s: TencentCloudLiveStream) -> dict:
    return {
        "id": s.id,
        "channel_id": s.channel_id,
        "stream_name": s.stream_name,
        "app_name": s.app_name,
        "create_time": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("/tencent/stream/create", summary="创建直播流频道")
async def create_stream(
    channel_id: int = Query(...),
    stream_name: str = Query(...),
):
    with get_session() as db:
        try:
            existing = (
                db.query(TencentCloudLiveStream)
                .filter(TencentCloudLiveStream.channel_id == channel_id)
                .first()
            )
            if existing:
                return success(_stream_to_dict(existing))
            stream = TencentCloudLiveStream(
                channel_id=channel_id,
                stream_name=stream_name,
                app_name="live",
            )
            db.add(stream)
            db.flush()
            return success(_stream_to_dict(stream))
        except Exception as e:
            logger.exception(f"tencent stream create error: {e}")
            return error(str(e))


@router.get("/tencent/stream/get", summary="获取直播流频道")
async def get_stream(channel_id: int = Query(...)):
    with get_session() as db:
        try:
            stream = (
                db.query(TencentCloudLiveStream)
                .filter(TencentCloudLiveStream.channel_id == channel_id)
                .first()
            )
            if not stream:
                return error("直播流不存在", "404")
            return success(_stream_to_dict(stream))
        except Exception as e:
            logger.exception(f"tencent stream get error: {e}")
            return error(str(e))


@router.get("/tencent/callback/templates", summary="获取回调模板")
async def callback_templates():
    try:
        templates = [
            {
                "template_id": "0",
                "template_name": "默认模板",
                "description": "不携带任何回调",
            },
            {
                "template_id": "1",
                "template_name": "全量回调",
                "description": "流开始/断开/混流/录制回调",
            },
        ]
        return success(templates)
    except Exception as e:
        logger.exception(f"tencent callback templates error: {e}")
        return error(str(e))


@router.post("/tencent/notify/stream/begin", summary="直播流开始回调")
async def notify_stream_begin(body: StreamNotifyBody):
    with get_session() as db:
        try:
            c = db.query(LiveChannel).filter(LiveChannel.id == body.channel_id).first()
            if not c:
                return error("直播不存在", "404")
            c.status = 1
            c.start_time = datetime.utcnow()
            return success({"channel_id": c.id, "status": c.status})
        except Exception as e:
            logger.exception(f"tencent stream begin notify error: {e}")
            return error(str(e))


@router.post("/tencent/notify/stream/end", summary="直播流结束回调")
async def notify_stream_end(body: StreamNotifyBody):
    with get_session() as db:
        try:
            c = db.query(LiveChannel).filter(LiveChannel.id == body.channel_id).first()
            if not c:
                return error("直播不存在", "404")
            c.status = 2
            c.end_time = datetime.utcnow()
            return success({"channel_id": c.id, "status": c.status})
        except Exception as e:
            logger.exception(f"tencent stream end notify error: {e}")
            return error(str(e))
