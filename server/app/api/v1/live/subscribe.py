"""直播功能 - 订阅管理 (迁移自 edu server ihui-ai-edu-live-service)"""

from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.live_models import LiveChannel, LiveSubscribe
from app.schemas.common import error, page_result, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()


class SubscribeBody(BaseModel):
    channel_id: int
    is_notify: bool = True


def _sub_to_dict(s: LiveSubscribe) -> dict:
    return {
        "id": s.id,
        "user_id": s.user_id,
        "channel_id": s.channel_id,
        "is_notify": s.is_notify,
        "create_time": s.created_at.isoformat() if s.created_at else None,
    }


@router.post("/subscribe", summary="订阅频道")
async def subscribe(body: SubscribeBody):
    with get_session() as db:
        try:
            c = db.query(LiveChannel).filter(LiveChannel.id == body.channel_id, LiveChannel.deleted == False).first()
            if not c:
                return error("直播不存在", "404")
            uid = _uid()
            existing = (
                db.query(LiveSubscribe)
                .filter(LiveSubscribe.user_id == uid, LiveSubscribe.channel_id == body.channel_id)
                .first()
            )
            if existing:
                existing.is_notify = body.is_notify
                return success(_sub_to_dict(existing))
            sub = LiveSubscribe(user_id=uid, channel_id=body.channel_id, is_notify=body.is_notify)
            db.add(sub)
            db.flush()
            return success(_sub_to_dict(sub))
        except Exception as e:
            logger.exception(f"live subscribe error: {e}")
            return error(str(e))


@router.delete("/subscribe", summary="取消订阅")
async def unsubscribe(channel_id: int = Query(...)):
    with get_session() as db:
        try:
            uid = _uid()
            sub = (
                db.query(LiveSubscribe)
                .filter(LiveSubscribe.user_id == uid, LiveSubscribe.channel_id == channel_id)
                .first()
            )
            if not sub:
                return error("订阅记录不存在", "404")
            db.delete(sub)
            return success()
        except Exception as e:
            logger.exception(f"live unsubscribe error: {e}")
            return error(str(e))


@router.get("/subscribe/count", summary="频道订阅人数统计")
async def subscribe_count(channel_id: int = Query(...)):
    with get_session() as db:
        try:
            total = (
                db.query(LiveSubscribe)
                .filter(LiveSubscribe.channel_id == channel_id)
                .count()
            )
            return success({"channel_id": channel_id, "count": total})
        except Exception as e:
            logger.exception(f"live subscribe count error: {e}")
            return error(str(e))


@router.get("/subscribe/list/by-channel-id", summary="频道订阅列表")
async def subscribe_list_by_channel(
    channel_id: int = Query(...),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(LiveSubscribe).filter(LiveSubscribe.channel_id == channel_id)
            total = q.count()
            items = (
                q.order_by(LiveSubscribe.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result([_sub_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception(f"live subscribe list error: {e}")
            return error(str(e))


@router.get("/subscribe/by-channel-and-member", summary="根据会员和频道获取订阅记录")
async def subscribe_by_channel_and_member(channel_id: int = Query(...)):
    with get_session() as db:
        try:
            uid = _uid()
            sub = (
                db.query(LiveSubscribe)
                .filter(LiveSubscribe.user_id == uid, LiveSubscribe.channel_id == channel_id)
                .first()
            )
            return success(_sub_to_dict(sub) if sub else None)
        except Exception as e:
            logger.exception(f"live subscribe by channel and member error: {e}")
            return error(str(e))
