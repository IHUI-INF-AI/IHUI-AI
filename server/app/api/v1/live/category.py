"""直播系统 - 分类与讲师管理"""

from fastapi import APIRouter, Query
from loguru import logger

from app.database import get_session
from app.models.live_ext_models import LiveCategory, LiveChannelLecturer
from app.schemas.common import error, success

router = APIRouter()


def _category_to_dict(c: LiveCategory) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "sort_order": c.sort_order,
        "is_show": c.is_show,
        "is_show_index": c.is_show_index,
        "level": c.level,
        "image": c.image,
        "create_time": c.created_at.isoformat() if c.created_at else None,
    }


def _lecturer_to_dict(l: LiveChannelLecturer) -> dict:
    return {
        "id": l.id,
        "lecturer_id": l.lecturer_id,
        "channel_id": l.channel_id,
        "create_time": l.created_at.isoformat() if l.created_at else None,
    }


# ============ Live category ============


@router.get("/category/list", summary="直播分类列表")
async def list_categories(
    is_show: int | None = None,
    level: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(LiveCategory)
            if is_show is not None:
                q = q.filter(LiveCategory.is_show == is_show)
            if level is not None:
                q = q.filter(LiveCategory.level == level)
            items = q.order_by(LiveCategory.sort_order.asc(), LiveCategory.id.asc()).all()
            return success([_category_to_dict(i) for i in items], total=len(items))
        except Exception as e:
            logger.error(f"live category list error: {e}")
            return error(str(e))


@router.get("/category/{cid}", summary="直播分类详情")
async def get_category(cid: int):
    with get_session() as db:
        try:
            c = db.query(LiveCategory).filter(LiveCategory.id == cid).first()
            if not c:
                return error("分类不存在", "404")
            return success(_category_to_dict(c))
        except Exception as e:
            logger.error(f"live category get error: {e}")
            return error(str(e))


@router.post("/category", summary="创建直播分类")
async def create_category(
    name: str = Query(..., min_length=1, max_length=50),
    level: int = Query(...),
    image: str = Query(..., min_length=1),
    sort_order: int = 1,
    is_show: int = 1,
    is_show_index: int = 1,
):
    with get_session() as db:
        try:
            c = LiveCategory(
                name=name,
                sort_order=sort_order,
                is_show=is_show,
                is_show_index=is_show_index,
                level=level,
                image=image,
            )
            db.add(c)
            db.flush()
            return success(_category_to_dict(c))
        except Exception as e:
            logger.error(f"live category create error: {e}")
            return error(str(e))


@router.put("/category/{cid}", summary="修改直播分类")
async def update_category(
    cid: int,
    name: str | None = None,
    level: int | None = None,
    image: str | None = None,
    sort_order: int | None = None,
    is_show: int | None = None,
    is_show_index: int | None = None,
):
    with get_session() as db:
        try:
            c = db.query(LiveCategory).filter(LiveCategory.id == cid).first()
            if not c:
                return error("分类不存在", "404")
            if name:
                c.name = name
            if level is not None:
                c.level = level
            if image:
                c.image = image
            if sort_order is not None:
                c.sort_order = sort_order
            if is_show is not None:
                c.is_show = is_show
            if is_show_index is not None:
                c.is_show_index = is_show_index
            return success(_category_to_dict(c))
        except Exception as e:
            logger.error(f"live category update error: {e}")
            return error(str(e))


@router.delete("/category/{cid}", summary="删除直播分类")
async def delete_category(cid: int):
    with get_session() as db:
        try:
            c = db.query(LiveCategory).filter(LiveCategory.id == cid).first()
            if not c:
                return error("分类不存在", "404")
            db.delete(c)
            return success()
        except Exception as e:
            logger.error(f"live category delete error: {e}")
            return error(str(e))


# ============ Channel lecturer ============


@router.get("/lecturer/list", summary="频道讲师列表")
async def list_lecturers(
    channel_id: int | None = None,
    lecturer_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(LiveChannelLecturer)
            if channel_id:
                q = q.filter(LiveChannelLecturer.channel_id == channel_id)
            if lecturer_id:
                q = q.filter(LiveChannelLecturer.lecturer_id == lecturer_id)
            items = q.order_by(LiveChannelLecturer.id.desc()).all()
            return success([_lecturer_to_dict(i) for i in items])
        except Exception as e:
            logger.error(f"live lecturer list error: {e}")
            return error(str(e))


@router.post("/lecturer", summary="绑定频道讲师")
async def bind_lecturer(
    lecturer_id: int = Query(...),
    channel_id: int = Query(...),
):
    with get_session() as db:
        try:
            exist = (
                db.query(LiveChannelLecturer)
                .filter(
                    LiveChannelLecturer.lecturer_id == lecturer_id,
                    LiveChannelLecturer.channel_id == channel_id,
                )
                .first()
            )
            if exist:
                return error("讲师已绑定该频道", "400")
            l = LiveChannelLecturer(lecturer_id=lecturer_id, channel_id=channel_id)
            db.add(l)
            db.flush()
            return success(_lecturer_to_dict(l))
        except Exception as e:
            logger.error(f"live lecturer bind error: {e}")
            return error(str(e))


@router.delete("/lecturer/{lid}", summary="解绑频道讲师")
async def unbind_lecturer(lid: int):
    with get_session() as db:
        try:
            l = db.query(LiveChannelLecturer).filter(LiveChannelLecturer.id == lid).first()
            if not l:
                return error("绑定记录不存在", "404")
            db.delete(l)
            return success()
        except Exception as e:
            logger.error(f"live lecturer unbind error: {e}")
            return error(str(e))
