"""直播功能 - 频道管理"""

from datetime import datetime

from fastapi import APIRouter, Query
from loguru import logger

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.live_models import (
    LiveChannel,
    LiveChannelCategory,
    LiveComment,
    LiveSubscribe,
)
from app.schemas.common import error, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

def _c_to_dict(c: LiveChannel) -> dict:
    return {
        "id": c.id,
        "title": c.title,
        "description": c.description,
        "cover": c.cover,
        "host_id": c.host_id,
        "host_name": c.host_name,
        "host_avatar": c.host_avatar,
        "category_id": c.category_id,
        "pull_url": c.pull_url,
        "play_url_hls": c.play_url_hls,
        "play_url_rtmp": c.play_url_rtmp,
        "play_url_flv": c.play_url_flv,
        "status": c.status,
        "type": c.type,
        "price": c.price,
        "is_record": c.is_record,
        "record_url": c.record_url,
        "start_time": c.start_time.isoformat() if c.start_time else None,
        "end_time": c.end_time.isoformat() if c.end_time else None,
        "plan_start_time": c.plan_start_time.isoformat() if c.plan_start_time else None,
        "plan_duration": c.plan_duration,
        "online_num": c.online_num,
        "view_num": c.view_num,
        "like_num": c.like_num,
        "comment_num": c.comment_num,
        "is_top": c.is_top,
        "is_essence": c.is_essence,
    }


@router.get("/channel/list", summary="直播列表")
async def list_channels(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int | None = None,
    category_id: int | None = None,
    host_id: str | None = None,
    keyword: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(LiveChannel).filter(not LiveChannel.deleted)
            if status is not None:
                q = q.filter(LiveChannel.status == status)
            if category_id:
                q = q.filter(LiveChannel.category_id == category_id)
            if host_id:
                q = q.filter(LiveChannel.host_id == host_id)
            if keyword:
                q = q.filter(LiveChannel.title.like(f"%{keyword}%"))
            total = q.count()
            items = (
                q.order_by(LiveChannel.is_top.desc(), LiveChannel.start_time.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success([_c_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"live channel list error: {e}")
            return error(str(e))


@router.get("/channel/{cid}", summary="直播详情")
async def get_channel(cid: int):
    with get_session() as db:
        try:
            c = db.query(LiveChannel).filter(LiveChannel.id == cid, not LiveChannel.deleted).first()
            if not c:
                return error("直播不存在", "404")
            c.view_num = (c.view_num or 0) + 1
            data = _c_to_dict(c)
            uid = _uid()
            data["is_subscribed"] = (
                db.query(LiveSubscribe).filter(LiveSubscribe.user_id == uid, LiveSubscribe.channel_id == cid).first()
                is not None
            )
            return success(data)
        except Exception as e:
            logger.error(f"live channel get error: {e}")
            return error(str(e))


@router.post("/channel", operation_id="live_create_channel", summary="创建直播")
async def create_channel(
    title: str = Query(..., min_length=1, max_length=200),
    description: str | None = None,
    cover: str | None = None,
    category_id: int | None = None,
    type: int = 1,
    price: int = 0,
    plan_start_time: datetime | None = None,
    plan_duration: int = 60,
):
    with get_session() as db:
        try:
            uid = _uid()
            import uuid as _uuid

            push_url = f"rtmp://live.example.com/live/{_uuid.uuid4().hex}"
            c = LiveChannel(
                title=title,
                description=description,
                cover=cover,
                category_id=category_id,
                host_id=uid,
                host_name="匿名用户",
                push_url=push_url,
                status=0,
                type=type,
                price=price,
                plan_start_time=plan_start_time,
                plan_duration=plan_duration,
            )
            db.add(c)
            db.flush()
            return success({**_c_to_dict(c), "push_url": push_url})
        except Exception as e:
            logger.error(f"live channel create error: {e}")
            return error(str(e))


@router.put("/channel/{cid}", operation_id="live_update_channel", summary="修改直播")
async def update_channel(
    cid: int,
    title: str | None = None,
    description: str | None = None,
    cover: str | None = None,
    plan_start_time: datetime | None = None,
):
    with get_session() as db:
        try:
            c = db.query(LiveChannel).filter(LiveChannel.id == cid).first()
            if not c:
                return error("直播不存在", "404")
            if title:
                c.title = title
            if description is not None:
                c.description = description
            if cover:
                c.cover = cover
            if plan_start_time:
                c.plan_start_time = plan_start_time
            return success(_c_to_dict(c))
        except Exception as e:
            logger.error(f"live channel update error: {e}")
            return error(str(e))


@router.delete("/channel/{cid}", operation_id="live_delete_channel", summary="删除直播")
async def delete_channel(cid: int):
    with get_session() as db:
        try:
            c = db.query(LiveChannel).filter(LiveChannel.id == cid).first()
            if not c:
                return error("直播不存在", "404")
            c.deleted = True
            c.status = 3
            return success()
        except Exception as e:
            logger.error(f"live channel delete error: {e}")
            return error(str(e))


@router.post("/channel/{cid}/start", summary="开始直播")
async def start_live(cid: int):
    with get_session() as db:
        try:
            c = db.query(LiveChannel).filter(LiveChannel.id == cid).first()
            if not c:
                return error("直播不存在", "404")
            c.status = 1
            c.start_time = datetime.utcnow()
            if not c.pull_url and c.push_url:
                c.pull_url = c.push_url.replace("rtmp://", "http://").replace("live", "pull/live")
                c.play_url_flv = c.pull_url + ".flv"
                c.play_url_hls = c.pull_url + ".m3u8"
                c.play_url_rtmp = c.pull_url
            return success(_c_to_dict(c))
        except Exception as e:
            logger.error(f"live start error: {e}")
            return error(str(e))


@router.post("/channel/{cid}/stop", summary="结束直播")
async def stop_live(cid: int):
    with get_session() as db:
        try:
            c = db.query(LiveChannel).filter(LiveChannel.id == cid).first()
            if not c:
                return error("直播不存在", "404")
            c.status = 2
            c.end_time = datetime.utcnow()
            return success(_c_to_dict(c))
        except Exception as e:
            logger.error(f"live stop error: {e}")
            return error(str(e))


@router.post("/channel/{cid}/subscribe", summary="订阅/取消订阅")
async def toggle_subscribe(cid: int):
    with get_session() as db:
        try:
            c = db.query(LiveChannel).filter(LiveChannel.id == cid).first()
            if not c:
                return error("直播不存在", "404")
            uid = _uid()
            sub = db.query(LiveSubscribe).filter(LiveSubscribe.user_id == uid, LiveSubscribe.channel_id == cid).first()
            if sub:
                db.delete(sub)
                return success({"subscribed": False})
            db.add(LiveSubscribe(user_id=uid, channel_id=cid, is_notify=True))
            return success({"subscribed": True})
        except Exception as e:
            logger.error(f"live subscribe error: {e}")
            return error(str(e))


@router.get("/channel/{cid}/comments", summary="评论列表")
async def list_comments(cid: int, page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=200)):
    with get_session() as db:
        try:
            q = db.query(LiveComment).filter(LiveComment.channel_id == cid)
            total = q.count()
            items = q.order_by(LiveComment.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": c.id,
                        "user_id": c.user_id,
                        "user_name": c.user_name,
                        "user_avatar": c.user_avatar,
                        "content": c.content,
                        "type": c.type,
                        "create_time": c.created_at.isoformat() if c.created_at else None,
                    }
                    for c in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"live comments error: {e}")
            return error(str(e))


@router.post("/channel/{cid}/comment", summary="发表评论")
async def add_comment(cid: int, content: str = Query(..., min_length=1), type: int = 1):
    with get_session() as db:
        try:
            c = db.query(LiveChannel).filter(LiveChannel.id == cid).first()
            if not c:
                return error("直播不存在", "404")
            cm = LiveComment(
                channel_id=cid,
                user_id=_uid(),
                user_name="匿名用户",
                content=content,
                type=type,
            )
            db.add(cm)
            db.flush()
            c.comment_num = (c.comment_num or 0) + 1
            return success({"id": cm.id})
        except Exception as e:
            logger.error(f"live add comment error: {e}")
            return error(str(e))


@router.get("/category/list", operation_id="live_channel_category_list", summary="直播分类")
async def category_list():
    with get_session() as db:
        try:
            items = (
                db.query(LiveChannelCategory)
                .filter(LiveChannelCategory.is_show)
                .order_by(LiveChannelCategory.sort_order.asc())
                .all()
            )
            return success([{"id": c.id, "name": c.name, "icon": c.icon, "sort_order": c.sort_order} for c in items])
        except Exception as e:
            logger.error(f"live category list error: {e}")
            return error(str(e))
