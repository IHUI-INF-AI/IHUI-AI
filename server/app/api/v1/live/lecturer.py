"""直播功能 - 讲师管理 (迁移自 edu server ihui-ai-edu-live-service)"""

from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel

from app.database import get_session
from app.models.live_models import ChannelLecturer, LiveChannel
from app.schemas.common import error, success

router = APIRouter()


class LecturerBody(BaseModel):
    channel_id: int
    lecturer_id: int


def _lec_to_dict(l: ChannelLecturer) -> dict:
    return {
        "id": l.id,
        "lecturer_id": l.lecturer_id,
        "channel_id": l.channel_id,
        "create_time": l.created_at.isoformat() if l.created_at else None,
    }


@router.post("/lecturer", summary="添加频道讲师关联")
async def add_lecturer(body: LecturerBody):
    with get_session() as db:
        try:
            c = db.query(LiveChannel).filter(
                LiveChannel.id == body.channel_id, LiveChannel.deleted == False
            ).first()
            if not c:
                return error("直播不存在", "404")
            existing = (
                db.query(ChannelLecturer)
                .filter(
                    ChannelLecturer.channel_id == body.channel_id,
                    ChannelLecturer.lecturer_id == body.lecturer_id,
                )
                .first()
            )
            if existing:
                return success(_lec_to_dict(existing))
            lec = ChannelLecturer(channel_id=body.channel_id, lecturer_id=body.lecturer_id)
            db.add(lec)
            db.flush()
            return success(_lec_to_dict(lec))
        except Exception as e:
            logger.exception(f"live lecturer add error: {e}")
            return error(str(e))


@router.delete("/lecturer", summary="移除频道讲师关联")
async def remove_lecturer(
    channel_id: int = Query(...),
    lecturer_id: int = Query(...),
):
    with get_session() as db:
        try:
            lec = (
                db.query(ChannelLecturer)
                .filter(
                    ChannelLecturer.channel_id == channel_id,
                    ChannelLecturer.lecturer_id == lecturer_id,
                )
                .first()
            )
            if not lec:
                return error("讲师关联不存在", "404")
            db.delete(lec)
            return success()
        except Exception as e:
            logger.exception(f"live lecturer remove error: {e}")
            return error(str(e))


@router.get("/lecturer/list/by-channel", summary="频道讲师列表")
async def lecturer_list_by_channel(channel_id: int = Query(...)):
    with get_session() as db:
        try:
            items = (
                db.query(ChannelLecturer)
                .filter(ChannelLecturer.channel_id == channel_id)
                .order_by(ChannelLecturer.id.desc())
                .all()
            )
            return success([_lec_to_dict(i) for i in items], total=len(items))
        except Exception as e:
            logger.exception(f"live lecturer list by channel error: {e}")
            return error(str(e))


@router.get("/lecturer/list/by-lecturer", summary="讲师频道列表")
async def lecturer_list_by_lecturer(lecturer_id: int = Query(...)):
    with get_session() as db:
        try:
            items = (
                db.query(ChannelLecturer)
                .filter(ChannelLecturer.lecturer_id == lecturer_id)
                .order_by(ChannelLecturer.id.desc())
                .all()
            )
            return success([_lec_to_dict(i) for i in items], total=len(items))
        except Exception as e:
            logger.exception(f"live lecturer list by lecturer error: {e}")
            return error(str(e))


@router.get("/lecturer/check", summary="检查讲师是否关联频道")
async def check_lecturer(
    channel_id: int = Query(...),
    lecturer_id: int = Query(...),
):
    with get_session() as db:
        try:
            lec = (
                db.query(ChannelLecturer)
                .filter(
                    ChannelLecturer.channel_id == channel_id,
                    ChannelLecturer.lecturer_id == lecturer_id,
                )
                .first()
            )
            return success(
                {
                    "channel_id": channel_id,
                    "lecturer_id": lecturer_id,
                    "linked": lec is not None,
                }
            )
        except Exception as e:
            logger.exception(f"live lecturer check error: {e}")
            return error(str(e))


@router.get("/lecturer/count", summary="频道讲师数量")
async def lecturer_count(channel_id: int = Query(...)):
    with get_session() as db:
        try:
            total = (
                db.query(ChannelLecturer)
                .filter(ChannelLecturer.channel_id == channel_id)
                .count()
            )
            return success({"channel_id": channel_id, "count": total})
        except Exception as e:
            logger.exception(f"live lecturer count error: {e}")
            return error(str(e))
