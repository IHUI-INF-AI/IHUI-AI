"""Course temporary/staging API - 课程临时表

迁移自 Java ai-smart-society-java: ZhsCourseTempController (6 端点)
对应模型: app.models.education_ext_models.ZhsCourseTemp (zhs_course_temp)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import get_session
from app.models.education_ext_models import ZhsCourseTemp
from app.security import require_login


def _get_db():
    with get_session() as db:
        yield db


router = APIRouter(prefix="/course-temp", tags=["CourseTemp"])


class CourseTempReq(BaseModel):
    course_name: str
    status: int = 0


def _to_dict(obj: ZhsCourseTemp) -> dict:
    return {
        "id": obj.id,
        "course_name": obj.course_name,
        "status": obj.status,
        "create_time": obj.create_time.isoformat() if obj.create_time else None,
    }


@router.get("/list", summary="临时课程列表")
def list_course_temp(
    status: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(ZhsCourseTemp)
    if status is not None:
        q = q.filter(ZhsCourseTemp.status == status)
    total = q.count()
    items = q.order_by(ZhsCourseTemp.id.desc()).offset((page - 1) * size).limit(size).all()
    return {"code": 0, "data": {"list": [_to_dict(i) for i in items], "total": total}, "msg": "ok"}


@router.get("/{item_id}", summary="临时课程详情")
def get_course_temp(item_id: int, db=Depends(_get_db)):
    item = db.query(ZhsCourseTemp).filter(ZhsCourseTemp.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="临时课程不存在")
    return {"code": 0, "data": _to_dict(item), "msg": "ok"}


@router.post("", summary="新增临时课程")
def create_course_temp(req: CourseTempReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = ZhsCourseTemp(course_name=req.course_name, status=req.status)
    db.add(item)
    db.flush()
    return {"code": 0, "data": _to_dict(item), "msg": "ok"}


@router.put("/{item_id}", summary="更新临时课程")
def update_course_temp(item_id: int, req: CourseTempReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(ZhsCourseTemp).filter(ZhsCourseTemp.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="临时课程不存在")
    item.course_name = req.course_name
    item.status = req.status
    return {"code": 0, "data": _to_dict(item), "msg": "ok"}


@router.delete("/{item_id}", summary="删除临时课程")
def delete_course_temp(item_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(ZhsCourseTemp).filter(ZhsCourseTemp.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="临时课程不存在")
    db.delete(item)
    return {"code": 0, "msg": "ok"}


@router.put("/{item_id}/submit", summary="提交临时课程（标记为已提交）")
def submit_course_temp(item_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(ZhsCourseTemp).filter(ZhsCourseTemp.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="临时课程不存在")
    item.status = 1
    return {"code": 0, "data": _to_dict(item), "msg": "ok"}
