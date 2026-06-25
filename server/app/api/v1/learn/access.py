"""学习权限 API (迁移自 ihui-ai-edu-learn-service access 模块)

管理课程的学习权限配置, 支持按权限类型批量设置与查询。
模型: LessonAccess
"""
from fastapi import APIRouter
from loguru import logger
from pydantic import BaseModel

from app.database import get_session
from app.models.learn_models import LessonAccess
from app.schemas.common import error, success

router = APIRouter()


def _to_dict(item: LessonAccess) -> dict:
    return {
        "id": item.id,
        "lesson_id": item.lesson_id,
        "access_type": item.access_type,
        "access_value": item.access_value,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


class AccessUpdate(BaseModel):
    access_type: str
    access_values: list[str]


@router.put("/{lesson_id}", summary="更新课程学习权限")
def update_access(lesson_id: int, body: AccessUpdate):
    with get_session() as db:
        try:
            # 删除该课程该类型下的旧权限
            db.query(LessonAccess).filter(
                LessonAccess.lesson_id == lesson_id,
                LessonAccess.access_type == body.access_type,
            ).delete()
            # 批量新增
            for value in body.access_values:
                db.add(
                    LessonAccess(
                        lesson_id=lesson_id,
                        access_type=body.access_type,
                        access_value=value,
                    )
                )
            db.flush()
            items = (
                db.query(LessonAccess)
                .filter(
                    LessonAccess.lesson_id == lesson_id,
                    LessonAccess.access_type == body.access_type,
                )
                .order_by(LessonAccess.id.asc())
                .all()
            )
            return success([_to_dict(i) for i in items])
        except Exception as e:
            logger.exception("update_access error")
            return error(str(e))


@router.get("/{lesson_id}", summary="查询课程学习权限列表")
def get_access(lesson_id: int):
    with get_session() as db:
        try:
            items = (
                db.query(LessonAccess)
                .filter(LessonAccess.lesson_id == lesson_id)
                .order_by(LessonAccess.id.asc())
                .all()
            )
            return success([_to_dict(i) for i in items])
        except Exception as e:
            logger.exception("get_access error")
            return error(str(e))
