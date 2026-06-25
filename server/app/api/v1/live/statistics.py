"""直播功能 - 统计 (迁移自 edu server ihui-ai-edu-live-service)"""

from datetime import datetime

from fastapi import APIRouter
from loguru import logger
from sqlalchemy import func

from app.database import get_session
from app.models.live_models import LiveChannel, LiveComment, LiveGift, LiveSubscribe
from app.schemas.common import error, success
from app.utils.datetime_helper import utcnow

router = APIRouter()


@router.get("/statistics", summary="获取直播统计数据")
def get_statistics():
    with get_session() as db:
        try:
            now = utcnow()
            today_start = datetime(now.year, now.month, now.day)

            total_channels = (
                db.query(func.count(LiveChannel.id))
                .filter(LiveChannel.deleted == False)
                .scalar()
                or 0
            )
            living_channels = (
                db.query(func.count(LiveChannel.id))
                .filter(LiveChannel.status == 1, LiveChannel.deleted == False)
                .scalar()
                or 0
            )
            total_subscribes = db.query(func.count(LiveSubscribe.id)).scalar() or 0
            total_comments = db.query(func.count(LiveComment.id)).scalar() or 0
            total_gifts = db.query(func.count(LiveGift.id)).scalar() or 0
            total_gift_amount = (
                db.query(func.coalesce(func.sum(LiveGift.total_price), 0)).scalar() or 0
            )
            today_channels = (
                db.query(func.count(LiveChannel.id))
                .filter(LiveChannel.created_at >= today_start, LiveChannel.deleted == False)
                .scalar()
                or 0
            )
            today_living = (
                db.query(func.count(LiveChannel.id))
                .filter(LiveChannel.start_time >= today_start, LiveChannel.deleted == False)
                .scalar()
                or 0
            )

            return success(
                {
                    "total_channels": total_channels,
                    "living_channels": living_channels,
                    "total_subscribes": total_subscribes,
                    "total_comments": total_comments,
                    "total_gifts": total_gifts,
                    "total_gift_amount": total_gift_amount,
                    "today_channels": today_channels,
                    "today_living": today_living,
                }
            )
        except Exception as e:
            logger.exception(f"live statistics error: {e}")
            return error(str(e))
