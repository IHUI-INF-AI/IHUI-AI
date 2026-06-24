"""课程管理 API (含章节/节点/分类关系)

迁移自 edu server ihui-ai-edu-learn-service 的 lesson 模块.
提供课程 CRUD、发布/取消发布、推荐/最热/最新列表、章节与节点管理、课程分类关系管理.
"""

from datetime import datetime

from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import func

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.learn_models import (
    Lesson,
    LessonCategoryRelation,
    LessonChapter,
    LessonChapterSection,
    SignUp,
)
from app.schemas.common import error, page_result, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()


def _lesson_to_dict(item: Lesson) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "code": item.code,
        "start_time": item.start_time.isoformat() if item.start_time else None,
        "end_time": item.end_time.isoformat() if item.end_time else None,
        "image": item.image,
        "status": item.status,
        "phrase": item.phrase,
        "introduction": item.introduction,
        "price": item.price,
        "original_price": item.original_price,
        "create_user_id": item.create_user_id,
        "company_id": item.company_id,
        "department_id": item.department_id,
        "certificate_id": item.certificate_id,
        "exam_paper_id": item.exam_paper_id,
        "sort_weight": item.sort_weight,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _chapter_to_dict(item: LessonChapter) -> dict:
    return {
        "id": item.id,
        "lesson_id": item.lesson_id,
        "title": item.title,
        "phrase": item.phrase,
        "sort_order": item.sort_order,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _section_to_dict(item: LessonChapterSection) -> dict:
    return {
        "id": item.id,
        "lesson_chapter_id": item.lesson_chapter_id,
        "title": item.title,
        "type": item.type,
        "url": item.url,
        "phrase": item.phrase,
        "total_time": item.total_time,
        "sort_order": item.sort_order,
        "content": item.content,
        "content_type": item.content_type,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class LessonCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    code: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    image: str | None = None
    status: int = 0
    phrase: str | None = None
    introduction: str | None = None
    price: int = 0
    original_price: int = 0
    company_id: int | None = None
    department_id: int | None = None
    certificate_id: int | None = None
    exam_paper_id: int | None = None
    sort_weight: int = 0


class LessonUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    code: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    image: str | None = None
    status: int | None = None
    phrase: str | None = None
    introduction: str | None = None
    price: int | None = None
    original_price: int | None = None
    company_id: int | None = None
    department_id: int | None = None
    certificate_id: int | None = None
    exam_paper_id: int | None = None
    sort_weight: int | None = None


class ChapterCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    phrase: str | None = None
    sort_order: int = 0


class ChapterUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    phrase: str | None = None
    sort_order: int | None = None


class ChapterSortItem(BaseModel):
    id: int
    sort_order: int


class ChapterSortRequest(BaseModel):
    items: list[ChapterSortItem]


class SectionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    type: str | None = None
    url: str | None = None
    phrase: str | None = None
    total_time: int = 0
    sort_order: int = 0
    content: str | None = None
    content_type: str | None = None


class SectionUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    type: str | None = None
    url: str | None = None
    phrase: str | None = None
    total_time: int | None = None
    sort_order: int | None = None
    content: str | None = None
    content_type: str | None = None


class CategoryRelationRequest(BaseModel):
    category_ids: list[int] = []


# ---------------------------------------------------------------------------
# 课程列表 / 推荐 / 最热 / 最新
# ---------------------------------------------------------------------------


@router.get("/list", summary="课程列表")
async def list_lessons(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int | None = None,
    keyword: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(Lesson).filter(Lesson.status != 2)
            if status is not None:
                q = q.filter(Lesson.status == status)
            if keyword:
                q = q.filter(Lesson.name.like(f"%{keyword}%"))
            total = q.count()
            items = (
                q.order_by(Lesson.sort_weight.desc(), Lesson.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result([_lesson_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception("list_lessons error")
            return error(str(e))


@router.get("/recommend/list", summary="推荐课程列表")
async def list_recommend_lessons(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(Lesson).filter(Lesson.status == 1)
            total = q.count()
            items = (
                q.order_by(Lesson.sort_weight.desc(), Lesson.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result([_lesson_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception("list_recommend_lessons error")
            return error(str(e))


@router.get("/hot/list", summary="最热课程列表")
async def list_hot_lessons(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            signup_subq = (
                db.query(func.count(SignUp.id))
                .filter(SignUp.lesson_id == Lesson.id, SignUp.status != 2)
                .correlate(Lesson)
                .scalar_subquery()
            )
            q = db.query(Lesson, signup_subq.label("signup_count")).filter(
                Lesson.status == 1
            )
            total = q.count()
            rows = (
                q.order_by(
                    signup_subq.desc(), Lesson.sort_weight.desc(), Lesson.id.desc()
                )
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            result = []
            for lesson, cnt in rows:
                d = _lesson_to_dict(lesson)
                d["signup_count"] = cnt or 0
                result.append(d)
            return page_result(result, total, page, limit)
        except Exception as e:
            logger.exception("list_hot_lessons error")
            return error(str(e))


@router.get("/new/list", summary="最新课程列表")
async def list_new_lessons(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(Lesson).filter(Lesson.status == 1)
            total = q.count()
            items = (
                q.order_by(Lesson.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result([_lesson_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception("list_new_lessons error")
            return error(str(e))


# ---------------------------------------------------------------------------
# 课程 CRUD
# ---------------------------------------------------------------------------


@router.get("/{lesson_id}", summary="课程详情")
async def get_lesson(lesson_id: int):
    with get_session() as db:
        try:
            lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
            if not lesson:
                return error("课程不存在")
            chapters = (
                db.query(LessonChapter)
                .filter(LessonChapter.lesson_id == lesson_id)
                .order_by(LessonChapter.sort_order.asc(), LessonChapter.id.asc())
                .all()
            )
            chapter_list = []
            for ch in chapters:
                sections = (
                    db.query(LessonChapterSection)
                    .filter(LessonChapterSection.lesson_chapter_id == ch.id)
                    .order_by(
                        LessonChapterSection.sort_order.asc(),
                        LessonChapterSection.id.asc(),
                    )
                    .all()
                )
                ch_dict = _chapter_to_dict(ch)
                ch_dict["sections"] = [_section_to_dict(s) for s in sections]
                chapter_list.append(ch_dict)
            data = _lesson_to_dict(lesson)
            data["chapters"] = chapter_list
            return success(data)
        except Exception as e:
            logger.exception("get_lesson error")
            return error(str(e))


@router.post("", summary="创建课程")
async def create_lesson(body: LessonCreate):
    with get_session() as db:
        try:
            lesson = Lesson(
                name=body.name,
                code=body.code,
                start_time=body.start_time,
                end_time=body.end_time,
                image=body.image,
                status=body.status,
                phrase=body.phrase,
                introduction=body.introduction,
                price=body.price,
                original_price=body.original_price,
                create_user_id=_uid(),
                company_id=body.company_id,
                department_id=body.department_id,
                certificate_id=body.certificate_id,
                exam_paper_id=body.exam_paper_id,
                sort_weight=body.sort_weight,
            )
            db.add(lesson)
            db.flush()
            return success(_lesson_to_dict(lesson))
        except Exception as e:
            logger.exception("create_lesson error")
            return error(str(e))


@router.put("/{lesson_id}", summary="更新课程")
async def update_lesson(lesson_id: int, body: LessonUpdate):
    with get_session() as db:
        try:
            lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
            if not lesson:
                return error("课程不存在")
            update_data = body.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(lesson, key, value)
            db.flush()
            return success(_lesson_to_dict(lesson))
        except Exception as e:
            logger.exception("update_lesson error")
            return error(str(e))


@router.delete("/{lesson_id}", summary="删除课程")
async def delete_lesson(lesson_id: int):
    with get_session() as db:
        try:
            lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
            if not lesson:
                return error("课程不存在")
            lesson.status = 2
            db.flush()
            return success({"id": lesson_id})
        except Exception as e:
            logger.exception("delete_lesson error")
            return error(str(e))


@router.put("/{lesson_id}/publish", summary="发布课程")
async def publish_lesson(lesson_id: int):
    with get_session() as db:
        try:
            lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
            if not lesson:
                return error("课程不存在")
            lesson.status = 1
            db.flush()
            return success(_lesson_to_dict(lesson))
        except Exception as e:
            logger.exception("publish_lesson error")
            return error(str(e))


@router.put("/{lesson_id}/unpublish", summary="取消发布课程")
async def unpublish_lesson(lesson_id: int):
    with get_session() as db:
        try:
            lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
            if not lesson:
                return error("课程不存在")
            lesson.status = 0
            db.flush()
            return success(_lesson_to_dict(lesson))
        except Exception as e:
            logger.exception("unpublish_lesson error")
            return error(str(e))


# ---------------------------------------------------------------------------
# 课程分类关系
# ---------------------------------------------------------------------------


@router.get("/{lesson_id}/categories", summary="获取课程分类")
async def get_lesson_categories(lesson_id: int):
    with get_session() as db:
        try:
            relations = (
                db.query(LessonCategoryRelation)
                .filter(LessonCategoryRelation.lesson_id == lesson_id)
                .all()
            )
            return success(
                [
                    {
                        "id": r.id,
                        "lesson_id": r.lesson_id,
                        "category_id": r.category_id,
                    }
                    for r in relations
                ]
            )
        except Exception as e:
            logger.exception("get_lesson_categories error")
            return error(str(e))


@router.post("/{lesson_id}/categories", summary="设置课程分类关系")
async def set_lesson_categories(lesson_id: int, body: CategoryRelationRequest):
    with get_session() as db:
        try:
            lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
            if not lesson:
                return error("课程不存在")
            db.query(LessonCategoryRelation).filter(
                LessonCategoryRelation.lesson_id == lesson_id
            ).delete(synchronize_session=False)
            for cid in body.category_ids:
                db.add(LessonCategoryRelation(lesson_id=lesson_id, category_id=cid))
            db.flush()
            return success(
                {"lesson_id": lesson_id, "category_ids": body.category_ids}
            )
        except Exception as e:
            logger.exception("set_lesson_categories error")
            return error(str(e))


# ---------------------------------------------------------------------------
# 章节管理
# ---------------------------------------------------------------------------


@router.get("/{lesson_id}/chapters", summary="课程章节列表")
async def list_chapters(lesson_id: int):
    with get_session() as db:
        try:
            chapters = (
                db.query(LessonChapter)
                .filter(LessonChapter.lesson_id == lesson_id)
                .order_by(LessonChapter.sort_order.asc(), LessonChapter.id.asc())
                .all()
            )
            return success([_chapter_to_dict(c) for c in chapters])
        except Exception as e:
            logger.exception("list_chapters error")
            return error(str(e))


@router.post("/{lesson_id}/chapters", summary="创建章节")
async def create_chapter(lesson_id: int, body: ChapterCreate):
    with get_session() as db:
        try:
            lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
            if not lesson:
                return error("课程不存在")
            chapter = LessonChapter(
                lesson_id=lesson_id,
                title=body.title,
                phrase=body.phrase,
                sort_order=body.sort_order,
            )
            db.add(chapter)
            db.flush()
            return success(_chapter_to_dict(chapter))
        except Exception as e:
            logger.exception("create_chapter error")
            return error(str(e))


@router.put("/chapters/sort", summary="章节排序")
async def sort_chapters(body: ChapterSortRequest):
    with get_session() as db:
        try:
            for item in body.items:
                chapter = (
                    db.query(LessonChapter).filter(LessonChapter.id == item.id).first()
                )
                if chapter:
                    chapter.sort_order = item.sort_order
            db.flush()
            return success({"updated": len(body.items)})
        except Exception as e:
            logger.exception("sort_chapters error")
            return error(str(e))


@router.put("/chapters/{chapter_id}", summary="更新章节")
async def update_chapter(chapter_id: int, body: ChapterUpdate):
    with get_session() as db:
        try:
            chapter = (
                db.query(LessonChapter).filter(LessonChapter.id == chapter_id).first()
            )
            if not chapter:
                return error("章节不存在")
            update_data = body.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(chapter, key, value)
            db.flush()
            return success(_chapter_to_dict(chapter))
        except Exception as e:
            logger.exception("update_chapter error")
            return error(str(e))


@router.delete("/chapters/{chapter_id}", summary="删除章节")
async def delete_chapter(chapter_id: int):
    with get_session() as db:
        try:
            chapter = (
                db.query(LessonChapter).filter(LessonChapter.id == chapter_id).first()
            )
            if not chapter:
                return error("章节不存在")
            db.query(LessonChapterSection).filter(
                LessonChapterSection.lesson_chapter_id == chapter_id
            ).delete(synchronize_session=False)
            db.delete(chapter)
            db.flush()
            return success({"id": chapter_id})
        except Exception as e:
            logger.exception("delete_chapter error")
            return error(str(e))


# ---------------------------------------------------------------------------
# 节点管理
# ---------------------------------------------------------------------------


@router.get("/chapters/{chapter_id}/sections", summary="章节节点列表")
async def list_sections(chapter_id: int):
    with get_session() as db:
        try:
            sections = (
                db.query(LessonChapterSection)
                .filter(LessonChapterSection.lesson_chapter_id == chapter_id)
                .order_by(
                    LessonChapterSection.sort_order.asc(),
                    LessonChapterSection.id.asc(),
                )
                .all()
            )
            return success([_section_to_dict(s) for s in sections])
        except Exception as e:
            logger.exception("list_sections error")
            return error(str(e))


@router.post("/chapters/{chapter_id}/sections", summary="创建节点")
async def create_section(chapter_id: int, body: SectionCreate):
    with get_session() as db:
        try:
            chapter = (
                db.query(LessonChapter).filter(LessonChapter.id == chapter_id).first()
            )
            if not chapter:
                return error("章节不存在")
            section = LessonChapterSection(
                lesson_chapter_id=chapter_id,
                title=body.title,
                type=body.type,
                url=body.url,
                phrase=body.phrase,
                total_time=body.total_time,
                sort_order=body.sort_order,
                content=body.content,
                content_type=body.content_type,
            )
            db.add(section)
            db.flush()
            return success(_section_to_dict(section))
        except Exception as e:
            logger.exception("create_section error")
            return error(str(e))


@router.put("/sections/{section_id}", summary="更新节点")
async def update_section(section_id: int, body: SectionUpdate):
    with get_session() as db:
        try:
            section = (
                db.query(LessonChapterSection)
                .filter(LessonChapterSection.id == section_id)
                .first()
            )
            if not section:
                return error("节点不存在")
            update_data = body.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(section, key, value)
            db.flush()
            return success(_section_to_dict(section))
        except Exception as e:
            logger.exception("update_section error")
            return error(str(e))


@router.delete("/sections/{section_id}", summary="删除节点")
async def delete_section(section_id: int):
    with get_session() as db:
        try:
            section = (
                db.query(LessonChapterSection)
                .filter(LessonChapterSection.id == section_id)
                .first()
            )
            if not section:
                return error("节点不存在")
            db.delete(section)
            db.flush()
            return success({"id": section_id})
        except Exception as e:
            logger.exception("delete_section error")
            return error(str(e))
