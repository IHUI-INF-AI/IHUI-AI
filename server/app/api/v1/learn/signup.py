"""学习模块 - 课程报名"""
from datetime import datetime

from fastapi import APIRouter, Body, Depends, Query
from loguru import logger

from app.core.admin_auth import admin_required
from app.core.current_user import get_member_id_int
from app.database import get_session
from app.models.learn_models import LearnSignUp
from app.schemas.common import error, success

router = APIRouter()


@router.get("/sign-up/list", summary="报名列表")
async def list_signups(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    member_id: int | None = None,
    lesson_id: int | None = None,
    status: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(LearnSignUp)
            if member_id:
                q = q.filter(LearnSignUp.member_id == member_id)
            if lesson_id:
                q = q.filter(LearnSignUp.lesson_id == lesson_id)
            if status:
                q = q.filter(LearnSignUp.status == status)
            total = q.count()
            items = q.order_by(LearnSignUp.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": s.id,
                        "member_id": s.member_id,
                        "lesson_id": s.lesson_id,
                        "status": s.status,
                        "completed_time": s.completed_time.isoformat() if s.completed_time else None,
                        "created_at": s.created_at.isoformat() if s.created_at else None,
                    }
                    for s in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"learn sign up list error: {e}")
            return error(str(e))


@router.post("/sign-up", summary="报名课程")
async def create_signup(lesson_id: int = Query(...), member_id: int = Depends(get_member_id_int)):
    with get_session() as db:
        try:
            existing = (
                db.query(LearnSignUp)
                .filter(LearnSignUp.member_id == member_id, LearnSignUp.lesson_id == lesson_id)
                .first()
            )
            if existing:
                return success({"id": existing.id, "exists": True})
            s = LearnSignUp(member_id=member_id, lesson_id=lesson_id, status="enrolled")
            db.add(s)
            db.flush()
            return success({"id": s.id})
        except Exception as e:
            logger.error(f"learn sign up create error: {e}")
            return error(str(e))


@router.put("/sign-up/{sid}/complete", summary="完成课程")
async def complete_signup(sid: int):
    with get_session() as db:
        try:
            s = db.query(LearnSignUp).filter(LearnSignUp.id == sid).first()
            if not s:
                return error("报名记录不存在", "404")
            s.status = "completed"
            s.completed_time = datetime.utcnow()
            return success({"id": s.id})
        except Exception as e:
            logger.error(f"learn sign up complete error: {e}")
            return error(str(e))


@router.put("/sign-up/{sid}/cancel", summary="取消报名")
async def cancel_signup(sid: int):
    with get_session() as db:
        try:
            s = db.query(LearnSignUp).filter(LearnSignUp.id == sid).first()
            if not s:
                return error("报名记录不存在", "404")
            s.status = "cancelled"
            return success({"id": s.id})
        except Exception as e:
            logger.error(f"learn sign up cancel error: {e}")
            return error(str(e))


@router.get("/sign-up/check", summary="检查是否已报名")
async def check_signup(lesson_id: int = Query(...), member_id: int = Depends(get_member_id_int)):
    with get_session() as db:
        try:
            existing = (
                db.query(LearnSignUp)
                .filter(LearnSignUp.member_id == member_id, LearnSignUp.lesson_id == lesson_id)
                .first()
            )
            return success(
                {
                    "signed_up": existing is not None,
                    "status": existing.status if existing else None,
                    "id": existing.id if existing else None,
                }
            )
        except Exception as e:
            logger.error(f"learn sign up check error: {e}")
            return error(str(e))


@router.post("/sign-up/batch-delete", summary="批量删除报名记录", dependencies=[Depends(admin_required)])
async def batch_delete_signups(ids: list[int] = Body(..., embed=True)):
    with get_session() as db:
        try:
            if not ids:
                return error("ids 不能为空", "400")
            id_list = [int(i) for i in ids if i is not None]
            db.query(LearnSignUp).filter(LearnSignUp.id.in_(id_list)).delete(synchronize_session=False)
            return success({"success": len(id_list), "failed": 0})
        except Exception as e:
            logger.error(f"learn sign up batch delete error: {e}")
            return error(str(e))
