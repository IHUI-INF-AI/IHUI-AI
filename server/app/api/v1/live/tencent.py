"""直播功能 - 腾讯云直播流 (迁移自 edu server ihui-ai-edu-live-service)"""

from app.utils.datetime_helper import utcnow

from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel

from app.database import get_session
from app.models.live_models import LiveChannel, TencentCloudLiveStream
from app.schemas.common import error, success
from app.utils.tencent_live import TencentLiveClient

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
def create_stream(
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
def get_stream(channel_id: int = Query(...)):
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
def callback_templates():
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
def notify_stream_begin(body: StreamNotifyBody):
    with get_session() as db:
        try:
            c = db.query(LiveChannel).filter(LiveChannel.id == body.channel_id).first()
            if not c:
                return error("直播不存在", "404")
            c.status = 1
            c.start_time = utcnow()
            return success({"channel_id": c.id, "status": c.status})
        except Exception as e:
            logger.exception(f"tencent stream begin notify error: {e}")
            return error(str(e))


@router.post("/tencent/notify/stream/end", summary="直播流结束回调")
def notify_stream_end(body: StreamNotifyBody):
    with get_session() as db:
        try:
            c = db.query(LiveChannel).filter(LiveChannel.id == body.channel_id).first()
            if not c:
                return error("直播不存在", "404")
            c.status = 2
            c.end_time = utcnow()
            return success({"channel_id": c.id, "status": c.status})
        except Exception as e:
            logger.exception(f"tencent stream end notify error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 直播推流/拉流地址生成 + 直播流管理 (调用腾讯云直播 API)
# 迁移自 ihui-ai-edu-live-service, 使用 TencentLiveClient.
# ---------------------------------------------------------------------------


class CreateLiveBody(BaseModel):
    stream_name: str
    stream_alias: str | None = None


class StopLiveBody(BaseModel):
    stream_name: str


def _get_live_client() -> TencentLiveClient:
    """获取腾讯云直播客户端 (每次请求新建, 避免共享状态)."""
    return TencentLiveClient()


@router.get("/live/push-url", summary="生成直播推流地址(带鉴权签名)")
def get_push_url(
    stream_name: str = Query(..., description="流名称"),
    expire: int = Query(86400, ge=60, le=7 * 86400, description="地址有效期(秒)"),
):
    try:
        client = _get_live_client()
        push_url = client.create_push_url(stream_name, expire_seconds=expire)
        return success({
            "stream_name": stream_name,
            "push_url": push_url,
            "expire_seconds": expire,
        })
    except ValueError as e:
        return error(str(e), "400")
    except Exception as e:
        logger.exception(f"live push-url error: {e}")
        return error(str(e))


@router.get("/live/pull-url", summary="生成直播拉流地址(带鉴权签名)")
def get_pull_url(
    stream_name: str = Query(..., description="流名称"),
    expire: int = Query(86400, ge=60, le=7 * 86400, description="地址有效期(秒)"),
):
    try:
        client = _get_live_client()
        pull_urls = client.create_pull_urls(stream_name, expire_seconds=expire)
        return success({
            "stream_name": stream_name,
            "pull_urls": pull_urls,
            "expire_seconds": expire,
        })
    except ValueError as e:
        return error(str(e), "400")
    except Exception as e:
        logger.exception(f"live pull-url error: {e}")
        return error(str(e))


@router.post("/live/create", summary="创建直播流(返回推流/拉流地址)")
async def create_live(body: CreateLiveBody):
    try:
        client = _get_live_client()
        result = await client.create_live_stream(
            stream_name=body.stream_name,
            stream_alias=body.stream_alias,
        )
        return success(result)
    except ValueError as e:
        return error(str(e), "400")
    except Exception as e:
        logger.exception(f"live create error: {e}")
        return error(str(e))


@router.post("/live/stop", summary="停止(断开)直播流")
async def stop_live(body: StopLiveBody):
    try:
        client = _get_live_client()
        result = await client.stop_live_stream(stream_name=body.stream_name)
        return success(result)
    except ValueError as e:
        return error(str(e), "400")
    except Exception as e:
        logger.exception(f"live stop error: {e}")
        return error(str(e))


@router.get("/live/list", summary="查询在线直播流列表")
async def list_live(
    page_num: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(100, ge=1, le=1000, description="每页数量"),
    stream_name: str | None = Query(None, description="流名称(可选过滤)"),
):
    try:
        client = _get_live_client()
        result = await client.describe_live_streams(
            page_num=page_num,
            page_size=page_size,
            stream_name=stream_name,
        )
        return success(result)
    except ValueError as e:
        return error(str(e), "400")
    except Exception as e:
        logger.exception(f"live list error: {e}")
        return error(str(e))
