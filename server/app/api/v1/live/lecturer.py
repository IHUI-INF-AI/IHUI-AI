"""直播系统 - 独立讲师实体管理 (历史 t_lecturer)"""

from fastapi import APIRouter, Body, Depends, Query
from loguru import logger

from app.database import get_session
from app.models.live_ext_models import Lecturer
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


def _lecturer_to_dict(lecturer: Lecturer) -> dict:
    return {
        "id": lecturer.id,
        "user_id": lecturer.user_id,
        "title": lecturer.title,
        "introduction": lecturer.introduction,
        "create_time": lecturer.created_at.isoformat() if lecturer.created_at else None,
        "update_time": lecturer.updated_at.isoformat() if lecturer.updated_at else None,
    }


@router.get("/lecturer/list", summary="讲师列表")
async def list_lecturers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_id: int | None = None,
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            q = db.query(Lecturer)
            if user_id is not None:
                q = q.filter(Lecturer.user_id == user_id)
            total = q.count()
            items = (
                q.order_by(Lecturer.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success([_lecturer_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"lecturer list error: {e}")
            return error(str(e))


@router.get("/lecturer/{lid}", summary="讲师详情")
async def get_lecturer(lid: int, user_uuid: str = Depends(require_login)):
    with get_session() as db:
        try:
            lecturer = db.query(Lecturer).filter(Lecturer.id == lid).first()
            if not lecturer:
                return error("讲师不存在", "404")
            return success(_lecturer_to_dict(lecturer))
        except Exception as e:
            logger.error(f"lecturer get error: {e}")
            return error(str(e))


@router.post("/lecturer/create", summary="创建讲师")
async def create_lecturer(
    payload: dict = Body(...),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            user_id = payload.get("user_id")
            if user_id is None:
                return error("user_id 必填", "400")
            title = payload.get("title") or ""
            introduction = payload.get("introduction") or ""
            lecturer = Lecturer(
                user_id=int(user_id),
                title=str(title)[:100],
                introduction=str(introduction)[:2000],
            )
            db.add(lecturer)
            db.flush()
            return success(_lecturer_to_dict(lecturer))
        except Exception as e:
            logger.error(f"lecturer create error: {e}")
            return error(str(e))


@router.put("/lecturer/{lid}", summary="修改讲师")
async def update_lecturer(
    lid: int,
    payload: dict = Body(...),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            l = db.query(Lecturer).filter(Lecturer.id == lid).first()
            if not l:
                return error("讲师不存在", "404")
            if "user_id" in payload and payload["user_id"] is not None:
                l.user_id = int(payload["user_id"])
            if "title" in payload and payload["title"] is not None:
                l.title = str(payload["title"])[:100]
            if "introduction" in payload and payload["introduction"] is not None:
                l.introduction = str(payload["introduction"])[:2000]
            return success(_lecturer_to_dict(l))
        except Exception as e:
            logger.error(f"lecturer update error: {e}")
            return error(str(e))


@router.delete("/lecturer/{lid}", summary="删除讲师")
async def delete_lecturer(lid: int, user_uuid: str = Depends(require_login)):
    with get_session() as db:
        try:
            l = db.query(Lecturer).filter(Lecturer.id == lid).first()
            if not l:
                return error("讲师不存在", "404")
            db.delete(l)
            return success()
        except Exception as e:
            logger.error(f"lecturer delete error: {e}")
            return error(str(e))
