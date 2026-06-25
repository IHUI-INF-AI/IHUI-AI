"""Live Legacy Routes - 1:1 兼容 Java 历史项目.

完整迁移自 H:\\ihui-ai-edu-live-service:
  - ChannelController
  - LecturerController
  - SubscribeController
  - CarouselController
  - TencentCloudLiveStreamController
  - LiveCategoryController
  - LiveStatisticsController
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel

from app.security import get_current_user_id_flexible, require_login
from app.services import live_business

router = APIRouter(prefix="", tags=["Live-Legacy"])


def _ok(data: Any = None, msg: str = "ok") -> dict[str, Any]:
    return {"code": 0, "data": data, "msg": msg}


def _err(status: int, msg: str) -> HTTPException:
    return HTTPException(status_code=status, detail=msg)


class ChannelCreateReq(BaseModel):
    title: str
    hostId: str
    hostName: str | None = None
    description: str | None = None
    cover: str | None = None
    hostAvatar: str | None = None
    categoryId: int | None = None
    pushUrl: str | None = None
    pullUrl: str | None = None
    type: int = 1
    password: str | None = None
    price: int = 0
    isRecord: bool = True
    planDuration: int = 60


class ChannelUpdateReq(BaseModel):
    id: int
    title: str | None = None
    description: str | None = None
    cover: str | None = None
    status: int | None = None


class ChannelIdReq(BaseModel):
    id: int


class SubscribeReq(BaseModel):
    channelId: int
    isNotify: bool = True


# ===========================================================================
# ChannelController (5 端点)
# ===========================================================================

@router.get("/channel", summary="[Channel]获取频道详情")
def channel_get(id: int | None = None):
    if id is not None:
        return _ok(live_business.get_channel(id))
    return _ok({})


@router.get("/public-api/channel", summary="[Channel]获取频道详情(公开)")
def channel_get_public(id: int | None = None):
    if id is not None:
        return _ok(live_business.get_channel(id))
    return _ok({})


@router.get("/channel/all", summary="[Channel]获取所有频道")
def channel_all():
    return _ok(live_business.list_all_channels())


@router.get("/channel/{id}", summary="[Channel]获取频道详情(路径)")
def channel_get_path(id: int):
    return _ok(live_business.get_channel(id))


@router.get("/channel/stream-info/{id}", summary="[Channel]获取流信息")
def channel_stream_info(id: int):
    return _ok(live_business.get_channel_stream_info(id))


@router.post("/channel", summary="[Channel]创建频道")
def channel_create(req: ChannelCreateReq):
    try:
        return _ok(live_business.create_channel(
            title=req.title, host_id=req.hostId, host_name=req.hostName,
            description=req.description, cover=req.cover, host_avatar=req.hostAvatar,
            category_id=req.categoryId, push_url=req.pushUrl, pull_url=req.pullUrl,
            type=req.type, password=req.password, price=req.price,
            is_record=req.isRecord, plan_duration=req.planDuration,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/channel", summary="[Channel]更新频道")
def channel_update(req: ChannelUpdateReq):
    return _ok(live_business.update_channel(
        channel_id=req.id, title=req.title, description=req.description,
        cover=req.cover, status=req.status,
    ))


@router.delete("/channel", summary="[Channel]删除频道")
def channel_delete(req: ChannelIdReq):
    live_business.delete_channel(req.id)
    return _ok()


# ===========================================================================
# LecturerController (2 端点)
# ===========================================================================

@router.get("/lecturer", summary="[Lecturer]获取讲师列表")
def lecturer_list(page: int = 1, pageSize: int = 20):
    return _ok(live_business.list_lecturers(page=page, page_size=pageSize))


@router.get("/public-api/lecturer", summary="[Lecturer]获取讲师列表(公开)")
def lecturer_public_list(page: int = 1, pageSize: int = 20):
    return _ok(live_business.list_lecturers(page=page, page_size=pageSize))


@router.get("/lecturer/{id}", summary="[Lecturer]获取讲师详情")
def lecturer_get(id: int):
    return _ok(live_business.get_lecturer(id))


# ===========================================================================
# SubscribeController (1 端点)
# ===========================================================================

@router.get("/auth-api/subscribe//by-channel-id-and-member-id", summary="[Sub]按频道+会员获取订阅")
def subscribe_get(channelId: int, _user: str = Depends(require_login)):
    member_id = str(get_current_user_id_flexible())
    return _ok(live_business.get_subscribe_by_user_channel(member_id, channelId))


@router.post("/auth-api/subscribe", summary="[Sub]订阅频道")
def subscribe_create(req: SubscribeReq, _user: str = Depends(require_login)):
    try:
        member_id = str(get_current_user_id_flexible())
        return _ok(live_business.subscribe_channel(
            user_id=member_id, channel_id=req.channelId, is_notify=req.isNotify,
        ))
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# CarouselController (2 端点)
# ===========================================================================

@router.get("/carousel", summary="[Carousel]获取轮播")
def carousel_list():
    return _ok({"list": live_business.list_carousels()})


@router.get("/public-api/carousel", summary="[Carousel]获取轮播(公开)")
def carousel_public_list():
    return _ok({"list": live_business.list_carousels()})


# ===========================================================================
# TencentCloudLiveStreamController (2 端点)
# ===========================================================================

@router.get("/tencent/cloud/live/stream", summary="[TCStream]获取推流地址")
def tc_stream_get(channelId: int | None = None):
    if channelId is not None:
        return _ok(live_business.get_tencent_stream(channelId))
    return _ok({})


@router.get("/tencent/cloud/live/stream/channel-id", summary="[TCStream]获取流 channel-id")
def tc_stream_channel_id(id: int | None = None):
    if id is not None:
        return _ok(live_business.get_tencent_stream(id))
    return _ok({})


# ===========================================================================
# Live Statistics
# ===========================================================================

@router.get("/statistics", summary="[LiveStat]直播统计")
def live_statistics():
    return _ok(live_business.live_statistics())
