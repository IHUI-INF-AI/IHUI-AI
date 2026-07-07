"""直播模块路由 - 迁移自旧 Java Spring Boot live-service (2026-07-05).

包含: 直播分类CRUD/直播频道CRUD/讲师CRUD/直播统计.
"""
from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models_ext import (
    EduLiveCategory,
    EduLiveChannel,
    EduLecturer,
)
from app.schemas.common import error, success

router = APIRouter()


# ---------------------------------------------------------------------------
# 直播分类
# ---------------------------------------------------------------------------


def _category_to_dict(c: EduLiveCategory) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "pid": c.pid,
        "sort": c.sort,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/category/admin/list", summary="直播分类树", operation_id="edu_platform_live_category_admin_list")
async def category_admin_list(
    id: int | None = None,
    fetchAll: bool | None = None,
    pid: int | None = None,
):
    """直播分类列表/树. id 指定时返回该分类子项, fetchAll=true 时返回全部."""
    with get_session() as db:
        try:
            q = db.query(EduLiveCategory)
            if fetchAll:
                pass
            elif id is not None:
                q = q.filter(EduLiveCategory.pid == id)
            elif pid is not None:
                q = q.filter(EduLiveCategory.pid == pid)
            items = q.order_by(EduLiveCategory.sort.asc(), EduLiveCategory.id.asc()).all()
            return success([_category_to_dict(c) for c in items])
        except Exception as e:
            logger.error(f"[edu live] category admin list error: {e}")
            return error(str(e))


@router.get("/category/{category_id}", summary="直播分类详情", operation_id="edu_platform_live_get_category_detail")
async def get_category_detail(category_id: int):
    with get_session() as db:
        try:
            c = db.query(EduLiveCategory).filter(EduLiveCategory.id == category_id).first()
            if not c:
                return error("分类不存在", "404")
            return success(_category_to_dict(c))
        except Exception as e:
            logger.error(f"[edu live] get category detail error: {e}")
            return error(str(e))


@router.post("/category", summary="新建直播分类", operation_id="edu_platform_live_create_category")
async def create_category(
    name: str = Body(..., min_length=1, max_length=100),
    pid: int = Body(0),
    sort: int = Body(0),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            c = EduLiveCategory(name=name, pid=pid, sort=sort, status=status)
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu live] create category error: {e}")
            return error(str(e))


@router.put("/category", summary="更新直播分类", operation_id="edu_platform_live_update_category")
async def update_category(
    id: int = Body(...),
    name: str | None = Body(None),
    pid: int | None = Body(None),
    sort: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            c = db.query(EduLiveCategory).filter(EduLiveCategory.id == id).first()
            if not c:
                return error("分类不存在", "404")
            if name is not None:
                c.name = name
            if pid is not None:
                c.pid = pid
            if sort is not None:
                c.sort = sort
            if status is not None:
                c.status = status
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu live] update category error: {e}")
            return error(str(e))


@router.delete("/category/{category_id}", summary="删除直播分类", operation_id="edu_platform_live_delete_category")
async def delete_category(category_id: int):
    with get_session() as db:
        try:
            c = db.query(EduLiveCategory).filter(EduLiveCategory.id == category_id).first()
            if not c:
                return error("分类不存在", "404")
            db.delete(c)
            return success()
        except Exception as e:
            logger.error(f"[edu live] delete category error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 直播频道
# ---------------------------------------------------------------------------


def _channel_to_dict(ch: EduLiveChannel) -> dict:
    return {
        "id": ch.id,
        "title": ch.title,
        "cover_image": ch.cover_image,
        "intro": ch.intro,
        "category_id": ch.category_id,
        "lecturer_id": ch.lecturer_id,
        "lecturer_name": ch.lecturer_name,
        "push_url": ch.push_url,
        "play_url": ch.play_url,
        "start_time": ch.start_time.isoformat() if ch.start_time else None,
        "end_time": ch.end_time.isoformat() if ch.end_time else None,
        "is_live": ch.is_live,
        "is_published": ch.is_published,
        "view_count": ch.view_count,
        "sort": ch.sort,
        "status": ch.status,
        "created_at": ch.created_at.isoformat() if ch.created_at else None,
    }


@router.get("/channel/list", summary="直播频道列表", operation_id="edu_platform_live_channel_list")
async def channel_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    title: str | None = None,
    category_id: int | None = None,
    lecturer_id: int | None = None,
    is_live: bool | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduLiveChannel)
            if title:
                q = q.filter(EduLiveChannel.title.like(f"%{title}%"))
            if category_id:
                q = q.filter(EduLiveChannel.category_id == category_id)
            if lecturer_id:
                q = q.filter(EduLiveChannel.lecturer_id == lecturer_id)
            if is_live is not None:
                q = q.filter(EduLiveChannel.is_live == is_live)
            if status is not None:
                q = q.filter(EduLiveChannel.status == status)
            total = q.count()
            items = (
                q.order_by(EduLiveChannel.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_channel_to_dict(c) for c in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu live] channel list error: {e}")
            return error(str(e))


@router.get("/channel/{channel_id}", summary="直播频道详情")
async def get_channel_detail(channel_id: int):
    with get_session() as db:
        try:
            ch = db.query(EduLiveChannel).filter(EduLiveChannel.id == channel_id).first()
            if not ch:
                return error("频道不存在", "404")
            return success(_channel_to_dict(ch))
        except Exception as e:
            logger.error(f"[edu live] get channel detail error: {e}")
            return error(str(e))


@router.post("/channel", summary="新建直播频道", operation_id="edu_platform_live_create_channel")
async def create_channel(
    title: str = Body(..., min_length=1, max_length=200),
    cover_image: str | None = Body(None, max_length=500),
    intro: str | None = Body(None),
    category_id: int | None = Body(None),
    lecturer_id: int | None = Body(None),
    lecturer_name: str | None = Body(None, max_length=100),
    push_url: str | None = Body(None, max_length=500),
    play_url: str | None = Body(None, max_length=500),
    start_time: str | None = Body(None),
    end_time: str | None = Body(None),
    is_live: bool = Body(False),
    is_published: bool = Body(False),
    sort: int = Body(0),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            ch = EduLiveChannel(
                title=title,
                cover_image=cover_image,
                intro=intro,
                category_id=category_id,
                lecturer_id=lecturer_id,
                lecturer_name=lecturer_name,
                push_url=push_url,
                play_url=play_url,
                is_live=is_live,
                is_published=is_published,
                sort=sort,
                status=status,
            )
            db.add(ch)
            db.flush()
            return success({"id": ch.id})
        except Exception as e:
            logger.error(f"[edu live] create channel error: {e}")
            return error(str(e))


@router.put("/channel", summary="更新直播频道", operation_id="edu_platform_live_update_channel")
async def update_channel(
    id: int = Body(...),
    title: str | None = Body(None),
    cover_image: str | None = Body(None),
    intro: str | None = Body(None),
    category_id: int | None = Body(None),
    lecturer_id: int | None = Body(None),
    lecturer_name: str | None = Body(None),
    push_url: str | None = Body(None),
    play_url: str | None = Body(None),
    is_live: bool | None = Body(None),
    is_published: bool | None = Body(None),
    sort: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            ch = db.query(EduLiveChannel).filter(EduLiveChannel.id == id).first()
            if not ch:
                return error("频道不存在", "404")
            if title is not None:
                ch.title = title
            if cover_image is not None:
                ch.cover_image = cover_image
            if intro is not None:
                ch.intro = intro
            if category_id is not None:
                ch.category_id = category_id
            if lecturer_id is not None:
                ch.lecturer_id = lecturer_id
            if lecturer_name is not None:
                ch.lecturer_name = lecturer_name
            if push_url is not None:
                ch.push_url = push_url
            if play_url is not None:
                ch.play_url = play_url
            if is_live is not None:
                ch.is_live = is_live
            if is_published is not None:
                ch.is_published = is_published
            if sort is not None:
                ch.sort = sort
            if status is not None:
                ch.status = status
            return success({"id": ch.id})
        except Exception as e:
            logger.error(f"[edu live] update channel error: {e}")
            return error(str(e))


@router.delete("/channel", summary="删除直播频道", operation_id="edu_platform_live_delete_channel")
async def delete_channel(id: int = Query(..., description="频道id")):
    with get_session() as db:
        try:
            ch = db.query(EduLiveChannel).filter(EduLiveChannel.id == id).first()
            if not ch:
                return error("频道不存在", "404")
            db.delete(ch)
            return success()
        except Exception as e:
            logger.error(f"[edu live] delete channel error: {e}")
            return error(str(e))


@router.get("/public-api/channel/list/by-ids", summary="批量获取频道")
async def channel_list_by_ids(ids: str = Query(..., description="逗号分隔的id列表")):
    with get_session() as db:
        try:
            id_list = [int(i.strip()) for i in ids.split(",") if i.strip().isdigit()]
            if not id_list:
                return success([])
            items = (
                db.query(EduLiveChannel)
                .filter(EduLiveChannel.id.in_(id_list), EduLiveChannel.status == 1)
                .order_by(EduLiveChannel.id.desc())
                .all()
            )
            return success([_channel_to_dict(c) for c in items])
        except Exception as e:
            logger.error(f"[edu live] channel list by ids error: {e}")
            return error(str(e))


@router.get("/statistics", summary="直播统计", operation_id="edu_platform_live_statistics")
async def live_statistics():
    with get_session() as db:
        try:
            total = db.query(EduLiveChannel).count()
            living = (
                db.query(EduLiveChannel)
                .filter(EduLiveChannel.is_live == True, EduLiveChannel.status == 1)  # noqa: E712
                .count()
            )
            published = (
                db.query(EduLiveChannel)
                .filter(EduLiveChannel.is_published == True, EduLiveChannel.status == 1)  # noqa: E712
                .count()
            )
            total_views = (
                db.query(EduLiveChannel)
                .filter(EduLiveChannel.status == 1)
                .with_entities(EduLiveChannel.view_count)
                .all()
            )
            view_sum = sum((v[0] or 0) for v in total_views)
            return success(
                {
                    "total": total,
                    "living": living,
                    "published": published,
                    "view_sum": view_sum,
                }
            )
        except Exception as e:
            logger.error(f"[edu live] statistics error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 讲师
# ---------------------------------------------------------------------------


def _lecturer_to_dict(l: EduLecturer) -> dict:
    return {
        "id": l.id,
        "name": l.name,
        "avatar": l.avatar,
        "title": l.title,
        "intro": l.intro,
        "sort": l.sort,
        "status": l.status,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    }


@router.get("/lecturer/list", summary="讲师列表")
async def lecturer_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    name: str | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduLecturer)
            if name:
                q = q.filter(EduLecturer.name.like(f"%{name}%"))
            if status is not None:
                q = q.filter(EduLecturer.status == status)
            total = q.count()
            items = (
                q.order_by(EduLecturer.sort.asc(), EduLecturer.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_lecturer_to_dict(l) for l in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu live] lecturer list error: {e}")
            return error(str(e))


@router.get("/lecturer/{lecturer_id}", summary="讲师详情")
async def get_lecturer_detail(lecturer_id: int):
    with get_session() as db:
        try:
            l = db.query(EduLecturer).filter(EduLecturer.id == lecturer_id).first()
            if not l:
                return error("讲师不存在", "404")
            return success(_lecturer_to_dict(l))
        except Exception as e:
            logger.error(f"[edu live] get lecturer detail error: {e}")
            return error(str(e))


@router.post("/lecturer", summary="新建讲师", operation_id="edu_platform_live_create_lecturer")
async def create_lecturer(
    name: str = Body(..., min_length=1, max_length=100),
    avatar: str | None = Body(None, max_length=500),
    title: str | None = Body(None, max_length=200),
    intro: str | None = Body(None),
    sort: int = Body(0),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            l = EduLecturer(
                name=name,
                avatar=avatar,
                title=title,
                intro=intro,
                sort=sort,
                status=status,
            )
            db.add(l)
            db.flush()
            return success({"id": l.id})
        except Exception as e:
            logger.error(f"[edu live] create lecturer error: {e}")
            return error(str(e))


@router.put("/lecturer", summary="更新讲师", operation_id="edu_platform_live_update_lecturer")
async def update_lecturer(
    id: int = Body(...),
    name: str | None = Body(None),
    avatar: str | None = Body(None),
    title: str | None = Body(None),
    intro: str | None = Body(None),
    sort: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            l = db.query(EduLecturer).filter(EduLecturer.id == id).first()
            if not l:
                return error("讲师不存在", "404")
            if name is not None:
                l.name = name
            if avatar is not None:
                l.avatar = avatar
            if title is not None:
                l.title = title
            if intro is not None:
                l.intro = intro
            if sort is not None:
                l.sort = sort
            if status is not None:
                l.status = status
            return success({"id": l.id})
        except Exception as e:
            logger.error(f"[edu live] update lecturer error: {e}")
            return error(str(e))


@router.delete("/lecturer", summary="删除讲师", operation_id="edu_platform_live_delete_lecturer")
async def delete_lecturer(id: int = Query(..., description="讲师id")):
    with get_session() as db:
        try:
            l = db.query(EduLecturer).filter(EduLecturer.id == id).first()
            if not l:
                return error("讲师不存在", "404")
            db.delete(l)
            return success()
        except Exception as e:
            logger.error(f"[edu live] delete lecturer error: {e}")
            return error(str(e))
