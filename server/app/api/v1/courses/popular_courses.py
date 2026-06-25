"""Popular courses recommendation API - 热门课程推荐

迁移自 Java ai-smart-society-java: ZhsPopularCoursesController (6 端点)
对应模型: app.models.resource_models.PopularCourse (zhs_popular_courses)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import get_session
from app.models.resource_models import PopularCourse
from app.security import require_login


def _get_db():
    with get_session() as db:
        yield db


router = APIRouter(prefix="/popular-courses", tags=["PopularCourses"])


class PopularCourseReq(BaseModel):
    course_id: int
    sort_order: int = 0
    status: int = 1


def _to_dict(obj: PopularCourse) -> dict:
    return {
        "id": obj.id,
        "course_id": obj.course_id,
        "sort_order": obj.sort_order,
        "status": obj.status,
        "create_time": obj.create_time.isoformat() if obj.create_time else None,
    }


@router.get("/list", summary="热门课程列表")
def list_popular_courses(
    status: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(PopularCourse)
    if status is not None:
        q = q.filter(PopularCourse.status == status)
    total = q.count()
    items = q.order_by(PopularCourse.sort_order.asc(), PopularCourse.id.desc()).offset((page - 1) * size).limit(size).all()
    return {"code": 0, "data": {"list": [_to_dict(i) for i in items], "total": total}, "msg": "ok"}


@router.get("/{item_id}", summary="热门课程详情")
def get_popular_course(item_id: int, db=Depends(_get_db)):
    item = db.query(PopularCourse).filter(PopularCourse.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="热门课程不存在")
    return {"code": 0, "data": _to_dict(item), "msg": "ok"}


@router.post("", summary="新增热门课程")
def create_popular_course(req: PopularCourseReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = PopularCourse(course_id=req.course_id, sort_order=req.sort_order, status=req.status)
    db.add(item)
    db.flush()
    return {"code": 0, "data": _to_dict(item), "msg": "ok"}


@router.put("/{item_id}", summary="更新热门课程")
def update_popular_course(item_id: int, req: PopularCourseReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(PopularCourse).filter(PopularCourse.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="热门课程不存在")
    item.course_id = req.course_id
    item.sort_order = req.sort_order
    item.status = req.status
    return {"code": 0, "data": _to_dict(item), "msg": "ok"}


@router.delete("/{item_id}", summary="删除热门课程")
def delete_popular_course(item_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(PopularCourse).filter(PopularCourse.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="热门课程不存在")
    db.delete(item)
    return {"code": 0, "msg": "ok"}


@router.put("/{item_id}/status", summary="更新热门课程状态")
def update_status(item_id: int, payload: dict = {}, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(PopularCourse).filter(PopularCourse.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="热门课程不存在")
    item.status = payload.get("status", item.status)
    return {"code": 0, "data": _to_dict(item), "msg": "ok"}
