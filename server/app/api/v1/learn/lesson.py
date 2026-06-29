"""学习模块 - 课程/章节/小节管理"""
from datetime import datetime

from fastapi import APIRouter, Body, Depends, Query
from loguru import logger

from app.core.admin_auth import admin_required
from app.database import get_session
from app.models.learn_models import (
    LearnLesson,
    LearnLessonCategoryRelation,
    LearnLessonChapter,
    LearnLessonChapterSection,
)
from app.schemas.common import error, success

router = APIRouter()


def _lesson_to_dict(l: LearnLesson) -> dict:
    return {
        "id": l.id,
        "name": l.name,
        "code": l.code,
        "start_time": l.start_time.isoformat() if l.start_time else None,
        "end_time": l.end_time.isoformat() if l.end_time else None,
        "image": l.image,
        "status": l.status,
        "phrase": l.phrase,
        "introduction": l.introduction,
        "company_id": l.company_id,
        "department_id": l.department_id,
        "create_user_id": l.create_user_id,
        "price": float(l.price) if l.price is not None else 0,
        "original_price": float(l.original_price) if l.original_price is not None else 0,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    }


# ============ 课程 ============


@router.get("/lesson/list", summary="课程列表")
async def list_lessons(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category_id: int | None = None,
    keyword: str | None = None,
    status: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(LearnLesson)
            if category_id:
                lesson_ids = [
                    r.lesson_id
                    for r in db.query(LearnLessonCategoryRelation)
                    .filter(LearnLessonCategoryRelation.category_id == category_id)
                    .all()
                ]
                q = q.filter(LearnLesson.id.in_(lesson_ids))
            if keyword:
                q = q.filter(LearnLesson.name.like(f"%{keyword}%"))
            if status:
                q = q.filter(LearnLesson.status == status)
            total = q.count()
            items = q.order_by(LearnLesson.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_lesson_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"learn lesson list error: {e}")
            return error(str(e))


@router.get("/lesson/trash", summary="课程回收站列表")
async def list_lesson_trash(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    keyword: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(LearnLesson).filter(LearnLesson.status == "trash")
            if keyword:
                q = q.filter(LearnLesson.name.like(f"%{keyword}%"))
            total = q.count()
            items = q.order_by(LearnLesson.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_lesson_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"learn lesson trash list error: {e}")
            return error(str(e))


@router.get("/lesson/{lid}", summary="课程详情")
async def get_lesson(lid: int):
    with get_session() as db:
        try:
            l = db.query(LearnLesson).filter(LearnLesson.id == lid).first()
            if not l:
                return error("课程不存在", "404")
            return success(_lesson_to_dict(l))
        except Exception as e:
            logger.error(f"learn lesson get error: {e}")
            return error(str(e))


@router.post("/lesson", summary="创建课程", dependencies=[Depends(admin_required)])
async def create_lesson(
    name: str = Body(..., min_length=1, max_length=100),
    code: str = Body(..., min_length=1, max_length=100),
    start_time: str = Body(..., description="ISO 日期"),
    end_time: str = Body(..., description="ISO 日期"),
    image: str = Body(..., max_length=1000),
    phrase: str = Body(""),
    introduction: str = Body(""),
    status: str = Body("draft"),
    price: float = Body(0),
    original_price: float = Body(0),
    company_id: int | None = Body(None),
    department_id: int | None = Body(None),
    create_user_id: int | None = Body(None),
):
    with get_session() as db:
        try:
            l = LearnLesson(
                name=name,
                code=code,
                start_time=datetime.fromisoformat(start_time),
                end_time=datetime.fromisoformat(end_time),
                image=image,
                phrase=phrase,
                introduction=introduction,
                status=status,
                price=price,
                original_price=original_price,
                company_id=company_id,
                department_id=department_id,
                create_user_id=create_user_id,
            )
            db.add(l)
            db.flush()
            return success({"id": l.id})
        except Exception as e:
            logger.error(f"learn lesson create error: {e}")
            return error(str(e))


@router.put("/lesson/{lid}", summary="修改课程", dependencies=[Depends(admin_required)])
async def update_lesson(
    lid: int,
    name: str | None = Body(None),
    image: str | None = Body(None),
    phrase: str | None = Body(None),
    introduction: str | None = Body(None),
    status: str | None = Body(None),
    price: float | None = Body(None),
    original_price: float | None = Body(None),
):
    with get_session() as db:
        try:
            l = db.query(LearnLesson).filter(LearnLesson.id == lid).first()
            if not l:
                return error("课程不存在", "404")
            if name is not None:
                l.name = name
            if image is not None:
                l.image = image
            if phrase is not None:
                l.phrase = phrase
            if introduction is not None:
                l.introduction = introduction
            if status is not None:
                l.status = status
            if price is not None:
                l.price = price
            if original_price is not None:
                l.original_price = original_price
            return success({"id": l.id})
        except Exception as e:
            logger.error(f"learn lesson update error: {e}")
            return error(str(e))


@router.delete("/lesson/{lid}", summary="删除课程", dependencies=[Depends(admin_required)])
async def delete_lesson(lid: int):
    with get_session() as db:
        try:
            l = db.query(LearnLesson).filter(LearnLesson.id == lid).first()
            if not l:
                return error("课程不存在", "404")
            db.delete(l)
            db.query(LearnLessonCategoryRelation).filter(LearnLessonCategoryRelation.lesson_id == lid).delete()
            return success()
        except Exception as e:
            logger.error(f"learn lesson delete error: {e}")
            return error(str(e))


@router.post("/lesson/batch-delete", summary="批量删除课程", dependencies=[Depends(admin_required)])
async def batch_delete_lessons(ids: list[int] = Body(..., embed=True)):
    with get_session() as db:
        try:
            if not ids:
                return error("ids 不能为空", "400")
            id_list = [int(i) for i in ids if i is not None]
            db.query(LearnLesson).filter(LearnLesson.id.in_(id_list)).delete(synchronize_session=False)
            db.query(LearnLessonCategoryRelation).filter(
                LearnLessonCategoryRelation.lesson_id.in_(id_list)
            ).delete(synchronize_session=False)
            return success({"success": len(id_list), "failed": 0})
        except Exception as e:
            logger.error(f"learn lesson batch delete error: {e}")
            return error(str(e))


# ============ 章 ============


@router.get("/lesson/{lesson_id}/chapter/list", summary="课程章列表")
async def list_chapters(lesson_id: int):
    with get_session() as db:
        try:
            items = (
                db.query(LearnLessonChapter)
                .filter(LearnLessonChapter.lesson_id == lesson_id)
                .order_by(LearnLessonChapter.sort_order.asc())
                .all()
            )
            return success(
                [
                    {
                        "id": c.id,
                        "lesson_id": c.lesson_id,
                        "title": c.title,
                        "phrase": c.phrase,
                        "sort_order": c.sort_order,
                    }
                    for c in items
                ]
            )
        except Exception as e:
            logger.error(f"learn chapter list error: {e}")
            return error(str(e))


@router.post("/lesson/{lesson_id}/chapter", summary="创建章", dependencies=[Depends(admin_required)])
async def create_chapter(
    lesson_id: int,
    title: str = Query(..., min_length=1, max_length=100),
    phrase: str = "",
    sort_order: int = 0,
):
    with get_session() as db:
        try:
            c = LearnLessonChapter(lesson_id=lesson_id, title=title, phrase=phrase, sort_order=sort_order)
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"learn chapter create error: {e}")
            return error(str(e))


@router.put("/chapter/{cid}", summary="修改章", dependencies=[Depends(admin_required)])
async def update_chapter(
    cid: int,
    title: str | None = None,
    phrase: str | None = None,
    sort_order: int | None = None,
):
    with get_session() as db:
        try:
            c = db.query(LearnLessonChapter).filter(LearnLessonChapter.id == cid).first()
            if not c:
                return error("章不存在", "404")
            if title is not None:
                c.title = title
            if phrase is not None:
                c.phrase = phrase
            if sort_order is not None:
                c.sort_order = sort_order
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"learn chapter update error: {e}")
            return error(str(e))


@router.delete("/chapter/{cid}", summary="删除章", dependencies=[Depends(admin_required)])
async def delete_chapter(cid: int):
    with get_session() as db:
        try:
            c = db.query(LearnLessonChapter).filter(LearnLessonChapter.id == cid).first()
            if not c:
                return error("章不存在", "404")
            db.delete(c)
            db.query(LearnLessonChapterSection).filter(LearnLessonChapterSection.lesson_chapter_id == cid).delete()
            return success()
        except Exception as e:
            logger.error(f"learn chapter delete error: {e}")
            return error(str(e))


# ============ 小节 ============


@router.get("/chapter/{chapter_id}/section/list", summary="章节小节列表")
async def list_sections(chapter_id: int):
    with get_session() as db:
        try:
            items = (
                db.query(LearnLessonChapterSection)
                .filter(LearnLessonChapterSection.lesson_chapter_id == chapter_id)
                .order_by(LearnLessonChapterSection.sort_order.asc())
                .all()
            )
            return success(
                [
                    {
                        "id": s.id,
                        "lesson_chapter_id": s.lesson_chapter_id,
                        "title": s.title,
                        "url": s.url,
                        "phrase": s.phrase,
                        "total_time": s.total_time,
                        "sort_order": s.sort_order,
                        "type": s.type,
                    }
                    for s in items
                ]
            )
        except Exception as e:
            logger.error(f"learn section list error: {e}")
            return error(str(e))


@router.post("/chapter/{chapter_id}/section", summary="创建小节", dependencies=[Depends(admin_required)])
async def create_section(
    chapter_id: int,
    title: str = Query(..., min_length=1, max_length=100),
    url: str = Query(..., max_length=1000),
    phrase: str = "",
    total_time: int = 0,
    sort_order: int = 0,
    type: str = "upload",
):
    with get_session() as db:
        try:
            s = LearnLessonChapterSection(
                lesson_chapter_id=chapter_id,
                title=title,
                url=url,
                phrase=phrase,
                total_time=total_time,
                sort_order=sort_order,
                type=type,
            )
            db.add(s)
            db.flush()
            return success({"id": s.id})
        except Exception as e:
            logger.error(f"learn section create error: {e}")
            return error(str(e))


@router.put("/section/{sid}", summary="修改小节", dependencies=[Depends(admin_required)])
async def update_section(
    sid: int,
    title: str | None = None,
    url: str | None = None,
    phrase: str | None = None,
    total_time: int | None = None,
    sort_order: int | None = None,
    type: str | None = None,
):
    with get_session() as db:
        try:
            s = db.query(LearnLessonChapterSection).filter(LearnLessonChapterSection.id == sid).first()
            if not s:
                return error("小节不存在", "404")
            if title is not None:
                s.title = title
            if url is not None:
                s.url = url
            if phrase is not None:
                s.phrase = phrase
            if total_time is not None:
                s.total_time = total_time
            if sort_order is not None:
                s.sort_order = sort_order
            if type is not None:
                s.type = type
            return success({"id": s.id})
        except Exception as e:
            logger.error(f"learn section update error: {e}")
            return error(str(e))


@router.delete("/section/{sid}", summary="删除小节", dependencies=[Depends(admin_required)])
async def delete_section(sid: int):
    with get_session() as db:
        try:
            s = db.query(LearnLessonChapterSection).filter(LearnLessonChapterSection.id == sid).first()
            if not s:
                return error("小节不存在", "404")
            db.delete(s)
            return success()
        except Exception as e:
            logger.error(f"learn section delete error: {e}")
            return error(str(e))
