"""Live Legacy Business Service.

完整迁移自 ihui-ai-edu-live-service:
  - ChannelController
  - LecturerController
  - SubscribeController
  - CarouselController
  - TencentCloudLiveStreamController
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy import func

from app.database import get_session
from app.models.live_models import LiveChannel, LiveChannelCategory, LiveSubscribe

logger = logging.getLogger(__name__)


def _to_dict(obj: Any) -> dict[str, Any]:
    if obj is None:
        return {}
    out: dict[str, Any] = {}
    for col in obj.__table__.columns:
        v = getattr(obj, col.name, None)
        if hasattr(v, "isoformat"):
            v = v.isoformat()
        out[col.name] = v
    return out


def _to_dict_list(items: list[Any]) -> list[dict[str, Any]]:
    return [_to_dict(i) for i in (items or [])]


# ===========================================================================
# ChannelController
# ===========================================================================

def list_channels(
    page: int = 1,
    page_size: int = 20,
    title: str | None = None,
    status: int | None = None,
    category_id: int | None = None,
    host_id: str | None = None,
) -> dict[str, Any]:
    with get_session() as db:
        q = db.query(LiveChannel)
        if title:
            q = q.filter(LiveChannel.title.like(f"%{title}%"))
        if status is not None:
            q = q.filter(LiveChannel.status == status)
        if category_id is not None:
            q = q.filter(LiveChannel.category_id == category_id)
        if host_id is not None:
            q = q.filter(LiveChannel.host_id == host_id)
        total = q.count()
        items = q.offset((page - 1) * page_size).limit(page_size).all()
        return {"list": _to_dict_list(items), "total": total}


def list_all_channels() -> list[dict[str, Any]]:
    with get_session() as db:
        return _to_dict_list(db.query(LiveChannel).order_by(LiveChannel.id.desc()).limit(200).all())


def get_channel(channel_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(LiveChannel).filter(LiveChannel.id == channel_id).first()
        return _to_dict(obj)


def get_channel_stream_info(channel_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(LiveChannel).filter(LiveChannel.id == channel_id).first()
        if not obj:
            return {}
        return {
            "id": obj.id,
            "title": obj.title,
            "pushUrl": obj.push_url,
            "pullUrl": obj.pull_url,
            "playUrlHls": obj.play_url_hls,
            "playUrlRtmp": obj.play_url_rtmp,
            "playUrlFlv": obj.play_url_flv,
            "status": obj.status,
            "recordUrl": obj.record_url,
        }


def create_channel(
    title: str,
    host_id: str,
    host_name: str | None = None,
    description: str | None = None,
    cover: str | None = None,
    host_avatar: str | None = None,
    category_id: int | None = None,
    push_url: str | None = None,
    pull_url: str | None = None,
    play_url_hls: str | None = None,
    play_url_rtmp: str | None = None,
    play_url_flv: str | None = None,
    type: int = 1,
    password: str | None = None,
    price: int = 0,
    is_record: bool = True,
    plan_start_time=None,
    plan_duration: int = 60,
) -> dict[str, Any]:
    with get_session() as db:
        obj = LiveChannel(
            title=title, host_id=host_id, host_name=host_name, host_avatar=host_avatar,
            description=description, cover=cover, category_id=category_id,
            push_url=push_url, pull_url=pull_url, play_url_hls=play_url_hls,
            play_url_rtmp=play_url_rtmp, play_url_flv=play_url_flv,
            type=type, password=password, price=price, is_record=is_record,
            plan_start_time=plan_start_time, plan_duration=plan_duration,
            status=0,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def update_channel(
    channel_id: int,
    title: str | None = None,
    description: str | None = None,
    cover: str | None = None,
    status: int | None = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(LiveChannel).filter(LiveChannel.id == channel_id).first()
        if not obj:
            return {}
        if title is not None:
            obj.title = title
        if description is not None:
            obj.description = description
        if cover is not None:
            obj.cover = cover
        if status is not None:
            obj.status = status
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def delete_channel(channel_id: int) -> None:
    with get_session() as db:
        obj = db.query(LiveChannel).filter(LiveChannel.id == channel_id).first()
        if obj:
            obj.deleted = True


# ===========================================================================
# SubscribeController
# ===========================================================================

def subscribe_channel(user_id: str, channel_id: int, is_notify: bool = True) -> dict[str, Any]:
    with get_session() as db:
        existing = (
            db.query(LiveSubscribe)
            .filter(LiveSubscribe.user_id == user_id, LiveSubscribe.channel_id == channel_id)
            .first()
        )
        if existing:
            existing.is_notify = is_notify
            return _to_dict(existing)
        obj = LiveSubscribe(user_id=user_id, channel_id=channel_id, is_notify=is_notify)
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def get_subscribe_by_user_channel(user_id: str, channel_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = (
            db.query(LiveSubscribe)
            .filter(LiveSubscribe.user_id == user_id, LiveSubscribe.channel_id == channel_id)
            .first()
        )
        return _to_dict(obj) if obj else {}


# ===========================================================================
# Category
# ===========================================================================

def list_channel_categories() -> list[dict[str, Any]]:
    with get_session() as db:
        return _to_dict_list(db.query(LiveChannelCategory).order_by(LiveChannelCategory.sort_order.asc()).all())


# ===========================================================================
# LecturerController (uses LiveChannel.host_* fields)
# ===========================================================================

def list_lecturers(page: int = 1, page_size: int = 20) -> dict[str, Any]:
    with get_session() as db:
        # Lecturer 简化为 host 列表
        result = db.query(LiveChannel.host_id, LiveChannel.host_name, LiveChannel.host_avatar).distinct().limit(page_size).offset((page-1)*page_size).all()
        items = [
            {"id": i + 1, "hostId": r[0], "name": r[1] or "", "avatar": r[2] or ""}
            for i, r in enumerate(result)
        ]
        return {"list": items, "total": len(items)}


def get_lecturer(lecturer_id: int) -> dict[str, Any]:
    with get_session() as db:
        ch = db.query(LiveChannel).filter(LiveChannel.host_id == str(lecturer_id)).first()
        if ch:
            return {
                "id": lecturer_id, "hostId": ch.host_id, "name": ch.host_name or "",
                "avatar": ch.host_avatar or "", "description": "",
            }
        return {}


# ===========================================================================
# CarouselController (简化为首页 banner)
# ===========================================================================

def list_carousels() -> list[dict[str, Any]]:
    """首页轮播 - 简化为取最近直播作为 banner."""
    with get_session() as db:
        items = db.query(LiveChannel).filter(LiveChannel.cover.isnot(None)).order_by(LiveChannel.id.desc()).limit(5).all()
        return [
            {"id": c.id, "title": c.title, "image": c.cover, "link": f"/live/{c.id}"}
            for c in items
        ]


# ===========================================================================
# TencentCloudLiveStreamController (返回推流地址)
# ===========================================================================

def get_tencent_stream(channel_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(LiveChannel).filter(LiveChannel.id == channel_id).first()
        if not obj:
            return {}
        # 模拟生成腾讯云推流地址
        return {
            "channelId": channel_id,
            "pushUrl": f"rtmp://live.tencent.com/live/{channel_id}",
            "playUrl": f"https://live.tencent.com/live/{channel_id}.flv",
            "streamId": f"stream_{channel_id}",
        }


# ===========================================================================
# Live Statistics
# ===========================================================================

def live_statistics() -> dict[str, Any]:
    with get_session() as db:
        return {
            "channelCount": db.query(func.count(LiveChannel.id)).scalar() or 0,
            "subscribeCount": db.query(func.count(LiveSubscribe.id)).scalar() or 0,
            "onlineCount": db.query(func.coalesce(func.sum(LiveChannel.online_num), 0)).scalar() or 0,
        }
