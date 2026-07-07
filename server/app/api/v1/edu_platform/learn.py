"""学习模块路由 - 迁移自旧 Java Spring Boot learn-service (2026-07-05).

包含: 课程分类/学习地图/课程/章节小节/作业/报名/报表/统计/专题/证书.
前端路由前缀: /learn
"""
from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models_ext import (
    EduCertificate,
    EduCertificateTemplate,
    EduLearnCategory,
    EduLearnMap,
    EduLesson,
    EduLessonChapter,
    EduLessonChapterSection,
    EduLessonHomework,
    EduLessonStudyRecord,
    EduLessonTopic,
    EduSignUp,
)
from app.schemas.common import error, success

router = APIRouter()


# ---------------------------------------------------------------------------
# 序列化辅助函数
# ---------------------------------------------------------------------------


def _category_to_dict(c: EduLearnCategory) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "pid": c.pid,
        "sort": c.sort,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _learn_map_to_dict(m: EduLearnMap) -> dict:
    return {
        "id": m.id,
        "name": m.name,
        "description": m.description,
        "is_published": m.is_published,
        "status": m.status,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


def _lesson_to_dict(l: EduLesson, with_intro: bool = True) -> dict:
    return {
        "id": l.id,
        "title": l.title,
        "cover_image": l.cover_image,
        "intro": l.intro if with_intro else None,
        "category_id": l.category_id,
        "lecturer_id": l.lecturer_id,
        "lecturer_name": l.lecturer_name,
        "price": l.price,
        "original_price": l.original_price,
        "is_free": l.is_free,
        "is_published": l.is_published,
        "sort": l.sort,
        "view_count": l.view_count,
        "signup_count": l.signup_count,
        "lesson_count": l.lesson_count,
        "exam_paper_id": l.exam_paper_id,
        "certificate_template_id": l.certificate_template_id,
        "status": l.status,
        "created_at": l.created_at.isoformat() if l.created_at else None,
        "updated_at": l.updated_at.isoformat() if l.updated_at else None,
    }


def _chapter_to_dict(c: EduLessonChapter) -> dict:
    return {
        "id": c.id,
        "lesson_id": c.lesson_id,
        "title": c.title,
        "sort_order": c.sort_order,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _section_to_dict(s: EduLessonChapterSection) -> dict:
    return {
        "id": s.id,
        "chapter_id": s.chapter_id,
        "lesson_id": s.lesson_id,
        "title": s.title,
        "video_url": s.video_url,
        "duration": s.duration,
        "content": s.content,
        "sort_order": s.sort_order,
        "is_free_preview": s.is_free_preview,
        "status": s.status,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _homework_to_dict(h: EduLessonHomework) -> dict:
    return {
        "id": h.id,
        "lesson_id": h.lesson_id,
        "title": h.title,
        "content": h.content,
        "deadline": h.deadline.isoformat() if h.deadline else None,
        "status": h.status,
        "created_at": h.created_at.isoformat() if h.created_at else None,
        "updated_at": h.updated_at.isoformat() if h.updated_at else None,
    }


def _sign_up_to_dict(s: EduSignUp) -> dict:
    return {
        "id": s.id,
        "member_id": s.member_id,
        "target_id": s.target_id,
        "target_type": s.target_type,
        "status": s.status,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _study_record_to_dict(r: EduLessonStudyRecord) -> dict:
    return {
        "id": r.id,
        "member_id": r.member_id,
        "lesson_id": r.lesson_id,
        "section_id": r.section_id,
        "study_duration": r.study_duration,
        "progress": r.progress,
        "last_position": r.last_position,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _topic_to_dict(t: EduLessonTopic) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "cover_image": t.cover_image,
        "description": t.description,
        "lesson_ids": t.lesson_ids,
        "is_published": t.is_published,
        "sort": t.sort,
        "status": t.status,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


def _certificate_to_dict(c: EduCertificate) -> dict:
    return {
        "id": c.id,
        "certificate_no": c.certificate_no,
        "member_id": c.member_id,
        "member_name": c.member_name,
        "lesson_id": c.lesson_id,
        "lesson_title": c.lesson_title,
        "template_id": c.template_id,
        "issue_date": c.issue_date.isoformat() if c.issue_date else None,
        "expire_date": c.expire_date.isoformat() if c.expire_date else None,
        "certificate_status": c.certificate_status,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _certificate_template_to_dict(t: EduCertificateTemplate) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "background_image": t.background_image,
        "template_config": t.template_config,
        "is_active": t.is_active,
        "status": t.status,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


# ---------------------------------------------------------------------------
# 课程分类 (category)
# ---------------------------------------------------------------------------


@router.get("/category/admin/list", summary="课程分类列表树", operation_id="edu_platform_learn_category_admin_list")
async def category_admin_list(
    id: int = Query(0, description="父分类id, 0=顶级"),
    fetchAll: bool = Query(False, description="是否获取全部"),
):
    with get_session() as db:
        try:
            q = db.query(EduLearnCategory)
            if not fetchAll:
                q = q.filter(EduLearnCategory.pid == id)
            items = q.order_by(EduLearnCategory.sort.asc(), EduLearnCategory.id.asc()).all()
            return success([_category_to_dict(c) for c in items])
        except Exception as e:
            logger.error(f"[edu learn] category admin list error: {e}")
            return error(str(e))


@router.get("/category/{category_id}", summary="课程分类详情", operation_id="edu_platform_learn_get_category")
async def get_category(category_id: int):
    with get_session() as db:
        try:
            c = db.query(EduLearnCategory).filter(EduLearnCategory.id == category_id).first()
            if not c:
                return error("分类不存在", "404")
            return success(_category_to_dict(c))
        except Exception as e:
            logger.error(f"[edu learn] get category error: {e}")
            return error(str(e))


@router.post("/category", summary="新建课程分类", operation_id="edu_platform_learn_create_category")
async def create_category(
    name: str = Body(..., min_length=1, max_length=100),
    pid: int = Body(0),
    sort: int = Body(0),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            c = EduLearnCategory(name=name, pid=pid, sort=sort, status=status)
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu learn] create category error: {e}")
            return error(str(e))


@router.put("/category", summary="更新课程分类", operation_id="edu_platform_learn_update_category")
async def update_category(
    id: int = Body(...),
    name: str | None = Body(None),
    pid: int | None = Body(None),
    sort: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            c = db.query(EduLearnCategory).filter(EduLearnCategory.id == id).first()
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
            logger.error(f"[edu learn] update category error: {e}")
            return error(str(e))


@router.delete("/category/{category_id}", summary="删除课程分类", operation_id="edu_platform_learn_delete_category")
async def delete_category(category_id: int):
    with get_session() as db:
        try:
            c = db.query(EduLearnCategory).filter(EduLearnCategory.id == category_id).first()
            if not c:
                return error("分类不存在", "404")
            db.delete(c)
            return success()
        except Exception as e:
            logger.error(f"[edu learn] delete category error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 学习地图 (learn-map)
# ---------------------------------------------------------------------------


@router.get("/learn-map/list", summary="学习地图列表")
async def learn_map_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    name: str | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduLearnMap)
            if name:
                q = q.filter(EduLearnMap.name.like(f"%{name}%"))
            if status is not None:
                q = q.filter(EduLearnMap.status == status)
            total = q.count()
            items = (
                q.order_by(EduLearnMap.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_learn_map_to_dict(m) for m in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu learn] learn-map list error: {e}")
            return error(str(e))


@router.post("/learn-map", summary="新建学习地图", operation_id="edu_platform_learn_create_learn_map")
async def create_learn_map(
    name: str = Body(..., min_length=1, max_length=200),
    description: str | None = Body(None),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            m = EduLearnMap(name=name, description=description, status=status)
            db.add(m)
            db.flush()
            return success({"id": m.id})
        except Exception as e:
            logger.error(f"[edu learn] create learn-map error: {e}")
            return error(str(e))


@router.put("/learn-map", summary="更新学习地图", operation_id="edu_platform_learn_update_learn_map")
async def update_learn_map(
    id: int = Body(...),
    name: str | None = Body(None),
    description: str | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            m = db.query(EduLearnMap).filter(EduLearnMap.id == id).first()
            if not m:
                return error("学习地图不存在", "404")
            if name is not None:
                m.name = name
            if description is not None:
                m.description = description
            if status is not None:
                m.status = status
            return success({"id": m.id})
        except Exception as e:
            logger.error(f"[edu learn] update learn-map error: {e}")
            return error(str(e))


@router.get("/learn-map", summary="学习地图详情", operation_id="edu_platform_learn_get_learn_map")
async def get_learn_map(id: int = Query(..., description="学习地图id")):
    with get_session() as db:
        try:
            m = db.query(EduLearnMap).filter(EduLearnMap.id == id).first()
            if not m:
                return error("学习地图不存在", "404")
            return success(_learn_map_to_dict(m))
        except Exception as e:
            logger.error(f"[edu learn] get learn-map error: {e}")
            return error(str(e))


@router.delete("/learn-map", summary="删除学习地图", operation_id="edu_platform_learn_delete_learn_map")
async def delete_learn_map(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            m = db.query(EduLearnMap).filter(EduLearnMap.id == id).first()
            if not m:
                return error("学习地图不存在", "404")
            db.delete(m)
            return success()
        except Exception as e:
            logger.error(f"[edu learn] delete learn-map error: {e}")
            return error(str(e))


@router.put("/learn-map/publish", summary="发布学习地图")
async def publish_learn_map(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            m = db.query(EduLearnMap).filter(EduLearnMap.id == id).first()
            if not m:
                return error("学习地图不存在", "404")
            m.is_published = True
            return success({"id": m.id, "is_published": m.is_published})
        except Exception as e:
            logger.error(f"[edu learn] publish learn-map error: {e}")
            return error(str(e))


@router.put("/learn-map/un-publish", summary="取消发布学习地图")
async def un_publish_learn_map(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            m = db.query(EduLearnMap).filter(EduLearnMap.id == id).first()
            if not m:
                return error("学习地图不存在", "404")
            m.is_published = False
            return success({"id": m.id, "is_published": m.is_published})
        except Exception as e:
            logger.error(f"[edu learn] un-publish learn-map error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 课程 (lesson)
# ---------------------------------------------------------------------------


@router.get("/lesson/list", summary="课程列表")
async def lesson_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    title: str | None = None,
    category_id: int | None = None,
    is_published: bool | None = None,
    status: int = Query(1, description="默认只查正常状态"),
):
    with get_session() as db:
        try:
            q = db.query(EduLesson).filter(EduLesson.status == status)
            if title:
                q = q.filter(EduLesson.title.like(f"%{title}%"))
            if category_id:
                q = q.filter(EduLesson.category_id == category_id)
            if is_published is not None:
                q = q.filter(EduLesson.is_published == is_published)
            total = q.count()
            items = (
                q.order_by(EduLesson.sort.desc(), EduLesson.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_lesson_to_dict(l, with_intro=False) for l in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu learn] lesson list error: {e}")
            return error(str(e))


@router.get("/public-api/lesson/list/by-ids", summary="按ID批量获取课程")
async def lesson_list_by_ids(ids: str = Query(..., description="逗号分隔的课程id列表")):
    with get_session() as db:
        try:
            id_list = [int(x.strip()) for x in ids.split(",") if x.strip().isdigit()]
            if not id_list:
                return success([])
            items = (
                db.query(EduLesson)
                .filter(EduLesson.id.in_(id_list), EduLesson.status == 1)
                .all()
            )
            return success([_lesson_to_dict(l, with_intro=False) for l in items])
        except Exception as e:
            logger.error(f"[edu learn] lesson list by ids error: {e}")
            return error(str(e))


@router.put("/lesson/exampaper", summary="课程关联试卷")
async def update_lesson_exam_paper(
    id: int = Body(..., embed=True),
    examPaperId: int | None = Body(None, embed=True),
):
    with get_session() as db:
        try:
            l = db.query(EduLesson).filter(EduLesson.id == id).first()
            if not l:
                return error("课程不存在", "404")
            l.exam_paper_id = examPaperId
            return success({"id": l.id, "exam_paper_id": l.exam_paper_id})
        except Exception as e:
            logger.error(f"[edu learn] update lesson exampaper error: {e}")
            return error(str(e))


@router.put("/lesson/certificate", summary="课程关联证书模板")
async def update_lesson_certificate(
    id: int = Body(..., embed=True),
    certificateTemplateId: int | None = Body(None, embed=True),
):
    with get_session() as db:
        try:
            l = db.query(EduLesson).filter(EduLesson.id == id).first()
            if not l:
                return error("课程不存在", "404")
            l.certificate_template_id = certificateTemplateId
            return success(
                {"id": l.id, "certificate_template_id": l.certificate_template_id}
            )
        except Exception as e:
            logger.error(f"[edu learn] update lesson certificate error: {e}")
            return error(str(e))


@router.delete("/lesson", summary="删除课程", operation_id="edu_platform_learn_delete_lesson")
async def delete_lesson(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            l = db.query(EduLesson).filter(EduLesson.id == id).first()
            if not l:
                return error("课程不存在", "404")
            l.status = 0
            return success({"id": l.id})
        except Exception as e:
            logger.error(f"[edu learn] delete lesson error: {e}")
            return error(str(e))


@router.put("/lesson/publish", summary="发布课程")
async def publish_lesson(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            l = db.query(EduLesson).filter(EduLesson.id == id).first()
            if not l:
                return error("课程不存在", "404")
            l.is_published = True
            return success({"id": l.id, "is_published": l.is_published})
        except Exception as e:
            logger.error(f"[edu learn] publish lesson error: {e}")
            return error(str(e))


@router.put("/lesson/un-publish", summary="取消发布课程")
async def un_publish_lesson(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            l = db.query(EduLesson).filter(EduLesson.id == id).first()
            if not l:
                return error("课程不存在", "404")
            l.is_published = False
            return success({"id": l.id, "is_published": l.is_published})
        except Exception as e:
            logger.error(f"[edu learn] un-publish lesson error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 章节小节 (chapter / section)
# ---------------------------------------------------------------------------


@router.post("/lesson/chapter", summary="新建章节")
async def create_lesson_chapter(
    lesson_id: int = Body(...),
    title: str = Body(..., min_length=1, max_length=200),
    sort_order: int = Body(0),
):
    with get_session() as db:
        try:
            c = EduLessonChapter(
                lesson_id=lesson_id, title=title, sort_order=sort_order
            )
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu learn] create chapter error: {e}")
            return error(str(e))


@router.put("/lesson/chapter", summary="更新章节")
async def update_lesson_chapter(
    id: int = Body(...),
    title: str | None = Body(None),
    sort_order: int | None = Body(None),
):
    with get_session() as db:
        try:
            c = db.query(EduLessonChapter).filter(EduLessonChapter.id == id).first()
            if not c:
                return error("章节不存在", "404")
            if title is not None:
                c.title = title
            if sort_order is not None:
                c.sort_order = sort_order
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu learn] update chapter error: {e}")
            return error(str(e))


@router.delete("/lesson/chapter", summary="删除章节")
async def delete_lesson_chapter(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            c = db.query(EduLessonChapter).filter(EduLessonChapter.id == id).first()
            if not c:
                return error("章节不存在", "404")
            db.delete(c)
            return success({"id": id})
        except Exception as e:
            logger.error(f"[edu learn] delete chapter error: {e}")
            return error(str(e))


@router.get("/lesson/chapter/list", summary="章节列表")
async def lesson_chapter_list(lesson_id: int = Query(..., description="课程id")):
    with get_session() as db:
        try:
            chapters = (
                db.query(EduLessonChapter)
                .filter(EduLessonChapter.lesson_id == lesson_id, EduLessonChapter.status == 1)
                .order_by(EduLessonChapter.sort_order.asc(), EduLessonChapter.id.asc())
                .all()
            )
            chapter_ids = [c.id for c in chapters]
            sections_map: dict[int, list] = {}
            if chapter_ids:
                sections = (
                    db.query(EduLessonChapterSection)
                    .filter(
                        EduLessonChapterSection.chapter_id.in_(chapter_ids),
                        EduLessonChapterSection.status == 1,
                    )
                    .order_by(
                        EduLessonChapterSection.sort_order.asc(),
                        EduLessonChapterSection.id.asc(),
                    )
                    .all()
                )
                for s in sections:
                    sections_map.setdefault(s.chapter_id, []).append(
                        _section_to_dict(s)
                    )
            result = []
            for c in chapters:
                d = _chapter_to_dict(c)
                d["sections"] = sections_map.get(c.id, [])
                result.append(d)
            return success(result)
        except Exception as e:
            logger.error(f"[edu learn] chapter list error: {e}")
            return error(str(e))


@router.put("/lesson/chapter/sort-order", summary="章节排序")
async def update_chapter_sort_order(data: list = Body(...)):
    with get_session() as db:
        try:
            for item in data:
                cid = item.get("id")
                sort_order = item.get("sort_order", 0)
                c = db.query(EduLessonChapter).filter(EduLessonChapter.id == cid).first()
                if c:
                    c.sort_order = sort_order
            return success()
        except Exception as e:
            logger.error(f"[edu learn] chapter sort-order error: {e}")
            return error(str(e))


@router.post("/lesson/chapter-section", summary="新建小节")
async def create_lesson_chapter_section(
    chapter_id: int = Body(...),
    lesson_id: int = Body(...),
    title: str = Body(..., min_length=1, max_length=200),
    video_url: str | None = Body(None),
    duration: int = Body(0),
    content: str | None = Body(None),
    sort_order: int = Body(0),
    is_free_preview: bool = Body(False),
):
    with get_session() as db:
        try:
            s = EduLessonChapterSection(
                chapter_id=chapter_id,
                lesson_id=lesson_id,
                title=title,
                video_url=video_url,
                duration=duration,
                content=content,
                sort_order=sort_order,
                is_free_preview=is_free_preview,
            )
            db.add(s)
            db.flush()
            return success({"id": s.id})
        except Exception as e:
            logger.error(f"[edu learn] create chapter-section error: {e}")
            return error(str(e))


@router.put("/lesson/chapter-section", summary="更新小节")
async def update_lesson_chapter_section(
    id: int = Body(...),
    title: str | None = Body(None),
    video_url: str | None = Body(None),
    duration: int | None = Body(None),
    content: str | None = Body(None),
    sort_order: int | None = Body(None),
    is_free_preview: bool | None = Body(None),
):
    with get_session() as db:
        try:
            s = (
                db.query(EduLessonChapterSection)
                .filter(EduLessonChapterSection.id == id)
                .first()
            )
            if not s:
                return error("小节不存在", "404")
            if title is not None:
                s.title = title
            if video_url is not None:
                s.video_url = video_url
            if duration is not None:
                s.duration = duration
            if content is not None:
                s.content = content
            if sort_order is not None:
                s.sort_order = sort_order
            if is_free_preview is not None:
                s.is_free_preview = is_free_preview
            return success({"id": s.id})
        except Exception as e:
            logger.error(f"[edu learn] update chapter-section error: {e}")
            return error(str(e))


@router.delete("/lesson/chapter-section", summary="删除小节")
async def delete_lesson_chapter_section(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            s = (
                db.query(EduLessonChapterSection)
                .filter(EduLessonChapterSection.id == id)
                .first()
            )
            if not s:
                return error("小节不存在", "404")
            db.delete(s)
            return success({"id": id})
        except Exception as e:
            logger.error(f"[edu learn] delete chapter-section error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 作业 (homework)
# ---------------------------------------------------------------------------


@router.post("/lesson/homework", summary="新建作业")
async def create_homework(
    lesson_id: int = Body(...),
    title: str = Body(..., min_length=1, max_length=200),
    content: str | None = Body(None),
    deadline: str | None = Body(None, description="截止时间 ISO 字符串"),
):
    with get_session() as db:
        try:
            from datetime import datetime

            dt = None
            if deadline:
                try:
                    dt = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
                except ValueError:
                    dt = None
            h = EduLessonHomework(
                lesson_id=lesson_id, title=title, content=content, deadline=dt
            )
            db.add(h)
            db.flush()
            return success({"id": h.id})
        except Exception as e:
            logger.error(f"[edu learn] create homework error: {e}")
            return error(str(e))


@router.put("/lesson/homework", summary="更新作业")
async def update_homework(
    id: int = Body(...),
    title: str | None = Body(None),
    content: str | None = Body(None),
    deadline: str | None = Body(None),
):
    with get_session() as db:
        try:
            from datetime import datetime

            h = db.query(EduLessonHomework).filter(EduLessonHomework.id == id).first()
            if not h:
                return error("作业不存在", "404")
            if title is not None:
                h.title = title
            if content is not None:
                h.content = content
            if deadline is not None:
                try:
                    h.deadline = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
                except ValueError:
                    pass
            return success({"id": h.id})
        except Exception as e:
            logger.error(f"[edu learn] update homework error: {e}")
            return error(str(e))


@router.get("/lesson/homework", summary="获取作业")
async def get_homework(lesson_id: int = Query(..., description="课程id")):
    with get_session() as db:
        try:
            h = (
                db.query(EduLessonHomework)
                .filter(EduLessonHomework.lesson_id == lesson_id, EduLessonHomework.status == 1)
                .first()
            )
            if not h:
                return success(None)
            return success(_homework_to_dict(h))
        except Exception as e:
            logger.error(f"[edu learn] get homework error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 报名 (sign-up)
# ---------------------------------------------------------------------------


@router.get("/sign-up/list", summary="报名列表", operation_id="edu_platform_learn_sign_up_list")
async def sign_up_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    target_id: int | None = None,
    target_type: str | None = None,
    member_id: int | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduSignUp)
            if target_id:
                q = q.filter(EduSignUp.target_id == target_id)
            if target_type:
                q = q.filter(EduSignUp.target_type == target_type)
            if member_id:
                q = q.filter(EduSignUp.member_id == member_id)
            if status is not None:
                q = q.filter(EduSignUp.status == status)
            total = q.count()
            items = (
                q.order_by(EduSignUp.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_sign_up_to_dict(s) for s in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu learn] sign-up list error: {e}")
            return error(str(e))


@router.post("/auth-api/sign-up/batch", summary="批量报名")
async def batch_sign_up(data: dict = Body(...)):
    with get_session() as db:
        try:
            member_ids = data.get("memberIds") or data.get("member_ids") or []
            target_id = data.get("targetId") or data.get("target_id")
            target_type = data.get("targetType") or data.get("target_type", "lesson")
            if not member_ids or not target_id:
                return error("缺少参数 memberIds/targetId", "400")
            created = 0
            for mid in member_ids:
                existing = (
                    db.query(EduSignUp)
                    .filter(
                        EduSignUp.member_id == mid,
                        EduSignUp.target_id == target_id,
                        EduSignUp.target_type == target_type,
                    )
                    .first()
                )
                if existing:
                    existing.status = 1
                    continue
                s = EduSignUp(
                    member_id=mid,
                    target_id=target_id,
                    target_type=target_type,
                    status=1,
                )
                db.add(s)
                created += 1
            db.flush()
            return success({"created": created, "total": len(member_ids)})
        except Exception as e:
            logger.error(f"[edu learn] batch sign-up error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 报表 (report)
# ---------------------------------------------------------------------------


@router.get("/report/lesson/sign", summary="课程报名报表")
async def report_lesson_sign(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    lesson_id: int | None = None,
):
    with get_session() as db:
        try:
            from sqlalchemy import func

            q = (
                db.query(
                    EduSignUp.target_id.label("lesson_id"),
                    func.count(EduSignUp.id).label("sign_count"),
                )
                .filter(EduSignUp.target_type == "lesson", EduSignUp.status == 1)
                .group_by(EduSignUp.target_id)
            )
            if lesson_id:
                q = q.filter(EduSignUp.target_id == lesson_id)
            rows = q.order_by(func.count(EduSignUp.id).desc()).all()
            total = len(rows)
            page_rows = rows[(page - 1) * limit: page * limit]
            result = []
            lesson_ids = [r.lesson_id for r in page_rows]
            lessons_map: dict[int, str] = {}
            if lesson_ids:
                lessons = db.query(EduLesson).filter(EduLesson.id.in_(lesson_ids)).all()
                lessons_map = {l.id: l.title for l in lessons}
            for r in page_rows:
                result.append(
                    {
                        "lesson_id": r.lesson_id,
                        "lesson_title": lessons_map.get(r.lesson_id, ""),
                        "sign_count": r.sign_count,
                    }
                )
            return success(result, total=total, page=page, page_size=limit)
        except Exception as e:
            logger.error(f"[edu learn] report lesson sign error: {e}")
            return error(str(e))


@router.get("/report/lesson/study", summary="课程学习报表")
async def report_lesson_study(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    lesson_id: int | None = None,
):
    with get_session() as db:
        try:
            from sqlalchemy import func

            q = (
                db.query(
                    EduLessonStudyRecord.lesson_id,
                    func.count(EduLessonStudyRecord.id).label("study_count"),
                    func.sum(EduLessonStudyRecord.study_duration).label("total_duration"),
                    func.avg(EduLessonStudyRecord.progress).label("avg_progress"),
                )
                .group_by(EduLessonStudyRecord.lesson_id)
            )
            if lesson_id:
                q = q.filter(EduLessonStudyRecord.lesson_id == lesson_id)
            rows = q.order_by(func.count(EduLessonStudyRecord.id).desc()).all()
            total = len(rows)
            page_rows = rows[(page - 1) * limit: page * limit]
            result = []
            lesson_ids = [r.lesson_id for r in page_rows]
            lessons_map: dict[int, str] = {}
            if lesson_ids:
                lessons = db.query(EduLesson).filter(EduLesson.id.in_(lesson_ids)).all()
                lessons_map = {l.id: l.title for l in lessons}
            for r in page_rows:
                result.append(
                    {
                        "lesson_id": r.lesson_id,
                        "lesson_title": lessons_map.get(r.lesson_id, ""),
                        "study_count": r.study_count,
                        "total_duration": int(r.total_duration or 0),
                        "avg_progress": round(float(r.avg_progress or 0), 2),
                    }
                )
            return success(result, total=total, page=page, page_size=limit)
        except Exception as e:
            logger.error(f"[edu learn] report lesson study error: {e}")
            return error(str(e))


@router.get("/report/member/study", summary="会员学习报表")
async def report_member_study(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    member_id: int | None = None,
):
    with get_session() as db:
        try:
            from sqlalchemy import func

            q = (
                db.query(
                    EduLessonStudyRecord.member_id,
                    func.count(EduLessonStudyRecord.id).label("study_count"),
                    func.sum(EduLessonStudyRecord.study_duration).label("total_duration"),
                    func.avg(EduLessonStudyRecord.progress).label("avg_progress"),
                )
                .group_by(EduLessonStudyRecord.member_id)
            )
            if member_id:
                q = q.filter(EduLessonStudyRecord.member_id == member_id)
            rows = q.order_by(func.sum(EduLessonStudyRecord.study_duration).desc()).all()
            total = len(rows)
            page_rows = rows[(page - 1) * limit: page * limit]
            result = []
            for r in page_rows:
                result.append(
                    {
                        "member_id": r.member_id,
                        "study_count": r.study_count,
                        "total_duration": int(r.total_duration or 0),
                        "avg_progress": round(float(r.avg_progress or 0), 2),
                    }
                )
            return success(result, total=total, page=page, page_size=limit)
        except Exception as e:
            logger.error(f"[edu learn] report member study error: {e}")
            return error(str(e))


@router.get("/report/company/member/signup", summary="企业会员报名报表")
async def report_company_member_signup(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            from sqlalchemy import func

            from app.models.edu_platform_models import EduMember

            q = (
                db.query(
                    EduMember.company_id,
                    func.count(EduSignUp.id).label("signup_count"),
                )
                .join(EduSignUp, EduSignUp.member_id == EduMember.id)
                .filter(EduMember.company_id.isnot(None), EduSignUp.status == 1)
                .group_by(EduMember.company_id)
            )
            rows = q.order_by(func.count(EduSignUp.id).desc()).all()
            total = len(rows)
            page_rows = rows[(page - 1) * limit: page * limit]
            result = [
                {
                    "company_id": r.company_id,
                    "signup_count": r.signup_count,
                }
                for r in page_rows
            ]
            return success(result, total=total, page=page, page_size=limit)
        except Exception as e:
            logger.error(f"[edu learn] report company member signup error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 统计 + 专题 (statistics / topic)
# ---------------------------------------------------------------------------


@router.get("/statistics", summary="学习统计", operation_id="edu_platform_learn_statistics")
async def learn_statistics():
    with get_session() as db:
        try:
            from sqlalchemy import func

            total_lessons = db.query(EduLesson).filter(EduLesson.status == 1).count()
            published_lessons = (
                db.query(EduLesson)
                .filter(EduLesson.status == 1, EduLesson.is_published == True)  # noqa: E712
                .count()
            )
            total_signups = (
                db.query(EduSignUp)
                .filter(EduSignUp.target_type == "lesson", EduSignUp.status == 1)
                .count()
            )
            total_study_records = db.query(EduLessonStudyRecord).count()
            total_duration = (
                db.query(func.sum(EduLessonStudyRecord.study_duration)).scalar() or 0
            )
            total_topics = db.query(EduLessonTopic).filter(EduLessonTopic.status == 1).count()
            return success(
                {
                    "total_lessons": total_lessons,
                    "published_lessons": published_lessons,
                    "total_signups": total_signups,
                    "total_study_records": total_study_records,
                    "total_study_duration": int(total_duration),
                    "total_topics": total_topics,
                }
            )
        except Exception as e:
            logger.error(f"[edu learn] statistics error: {e}")
            return error(str(e))


@router.delete("/topic", summary="删除专题", operation_id="edu_platform_learn_delete_topic")
async def delete_topic(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            t = db.query(EduLessonTopic).filter(EduLessonTopic.id == id).first()
            if not t:
                return error("专题不存在", "404")
            t.status = 0
            return success({"id": id})
        except Exception as e:
            logger.error(f"[edu learn] delete topic error: {e}")
            return error(str(e))


@router.put("/topic/publish", summary="发布专题")
async def publish_topic(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            t = db.query(EduLessonTopic).filter(EduLessonTopic.id == id).first()
            if not t:
                return error("专题不存在", "404")
            t.is_published = True
            return success({"id": t.id, "is_published": t.is_published})
        except Exception as e:
            logger.error(f"[edu learn] publish topic error: {e}")
            return error(str(e))


@router.put("/topic/un-publish", summary="取消发布专题")
async def un_publish_topic(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            t = db.query(EduLessonTopic).filter(EduLessonTopic.id == id).first()
            if not t:
                return error("专题不存在", "404")
            t.is_published = False
            return success({"id": t.id, "is_published": t.is_published})
        except Exception as e:
            logger.error(f"[edu learn] un-publish topic error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 证书 (certificate)
# ---------------------------------------------------------------------------


@router.get("/certificate/list", summary="证书列表")
async def certificate_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    member_id: int | None = None,
    lesson_id: int | None = None,
    certificate_status: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduCertificate).filter(EduCertificate.status == 1)
            if member_id:
                q = q.filter(EduCertificate.member_id == member_id)
            if lesson_id:
                q = q.filter(EduCertificate.lesson_id == lesson_id)
            if certificate_status:
                q = q.filter(EduCertificate.certificate_status == certificate_status)
            total = q.count()
            items = (
                q.order_by(EduCertificate.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_certificate_to_dict(c) for c in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu learn] certificate list error: {e}")
            return error(str(e))


@router.get("/certificate", summary="证书详情", operation_id="edu_platform_learn_get_certificate")
async def get_certificate(id: int = Query(..., description="证书id")):
    with get_session() as db:
        try:
            c = db.query(EduCertificate).filter(EduCertificate.id == id).first()
            if not c:
                return error("证书不存在", "404")
            return success(_certificate_to_dict(c))
        except Exception as e:
            logger.error(f"[edu learn] get certificate error: {e}")
            return error(str(e))


@router.put("/certificate/valid", summary="设为有效")
async def valid_certificate(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            c = db.query(EduCertificate).filter(EduCertificate.id == id).first()
            if not c:
                return error("证书不存在", "404")
            c.certificate_status = "valid"
            return success({"id": c.id, "certificate_status": c.certificate_status})
        except Exception as e:
            logger.error(f"[edu learn] valid certificate error: {e}")
            return error(str(e))


@router.put("/certificate/suspended", summary="暂停证书")
async def suspended_certificate(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            c = db.query(EduCertificate).filter(EduCertificate.id == id).first()
            if not c:
                return error("证书不存在", "404")
            c.certificate_status = "suspended"
            return success({"id": c.id, "certificate_status": c.certificate_status})
        except Exception as e:
            logger.error(f"[edu learn] suspended certificate error: {e}")
            return error(str(e))


@router.put("/certificate/cancelled", summary="取消证书")
async def cancelled_certificate(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            c = db.query(EduCertificate).filter(EduCertificate.id == id).first()
            if not c:
                return error("证书不存在", "404")
            c.certificate_status = "cancelled"
            return success({"id": c.id, "certificate_status": c.certificate_status})
        except Exception as e:
            logger.error(f"[edu learn] cancelled certificate error: {e}")
            return error(str(e))


@router.put("/certificate/expired", summary="过期证书")
async def expired_certificate(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            c = db.query(EduCertificate).filter(EduCertificate.id == id).first()
            if not c:
                return error("证书不存在", "404")
            c.certificate_status = "expired"
            return success({"id": c.id, "certificate_status": c.certificate_status})
        except Exception as e:
            logger.error(f"[edu learn] expired certificate error: {e}")
            return error(str(e))


@router.put("/certificate/revoked", summary="撤销证书")
async def revoked_certificate(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            c = db.query(EduCertificate).filter(EduCertificate.id == id).first()
            if not c:
                return error("证书不存在", "404")
            c.certificate_status = "revoked"
            return success({"id": c.id, "certificate_status": c.certificate_status})
        except Exception as e:
            logger.error(f"[edu learn] revoked certificate error: {e}")
            return error(str(e))


@router.delete("/certificate", summary="删除证书", operation_id="edu_platform_learn_delete_certificate")
async def delete_certificate(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            c = db.query(EduCertificate).filter(EduCertificate.id == id).first()
            if not c:
                return error("证书不存在", "404")
            c.status = 0
            return success({"id": id})
        except Exception as e:
            logger.error(f"[edu learn] delete certificate error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 证书模板 (certificate-template)
# ---------------------------------------------------------------------------


@router.get("/certificate-template/list", summary="证书模板列表")
async def certificate_template_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    name: str | None = None,
    is_active: bool | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduCertificateTemplate).filter(EduCertificateTemplate.status == 1)
            if name:
                q = q.filter(EduCertificateTemplate.name.like(f"%{name}%"))
            if is_active is not None:
                q = q.filter(EduCertificateTemplate.is_active == is_active)
            total = q.count()
            items = (
                q.order_by(EduCertificateTemplate.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_certificate_template_to_dict(t) for t in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu learn] certificate-template list error: {e}")
            return error(str(e))


@router.get("/certificate-template", summary="证书模板详情")
async def get_certificate_template(id: int = Query(..., description="模板id")):
    with get_session() as db:
        try:
            t = (
                db.query(EduCertificateTemplate)
                .filter(EduCertificateTemplate.id == id)
                .first()
            )
            if not t:
                return error("证书模板不存在", "404")
            return success(_certificate_template_to_dict(t))
        except Exception as e:
            logger.error(f"[edu learn] get certificate-template error: {e}")
            return error(str(e))


@router.put("/certificate-template", summary="更新证书模板")
async def update_certificate_template(
    id: int = Body(...),
    name: str | None = Body(None),
    background_image: str | None = Body(None),
    template_config: str | None = Body(None),
):
    with get_session() as db:
        try:
            t = (
                db.query(EduCertificateTemplate)
                .filter(EduCertificateTemplate.id == id)
                .first()
            )
            if not t:
                return error("证书模板不存在", "404")
            if name is not None:
                t.name = name
            if background_image is not None:
                t.background_image = background_image
            if template_config is not None:
                t.template_config = template_config
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"[edu learn] update certificate-template error: {e}")
            return error(str(e))


@router.post("/certificate-template", summary="新建证书模板")
async def create_certificate_template(
    name: str = Body(..., min_length=1, max_length=200),
    background_image: str | None = Body(None),
    template_config: str | None = Body(None),
    is_active: bool = Body(False),
):
    with get_session() as db:
        try:
            t = EduCertificateTemplate(
                name=name,
                background_image=background_image,
                template_config=template_config,
                is_active=is_active,
            )
            db.add(t)
            db.flush()
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"[edu learn] create certificate-template error: {e}")
            return error(str(e))


@router.delete("/certificate-template", summary="删除证书模板")
async def delete_certificate_template(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            t = (
                db.query(EduCertificateTemplate)
                .filter(EduCertificateTemplate.id == id)
                .first()
            )
            if not t:
                return error("证书模板不存在", "404")
            t.status = 0
            return success({"id": id})
        except Exception as e:
            logger.error(f"[edu learn] delete certificate-template error: {e}")
            return error(str(e))


@router.put("/certificate-template/active", summary="启用证书模板")
async def active_certificate_template(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            t = (
                db.query(EduCertificateTemplate)
                .filter(EduCertificateTemplate.id == id)
                .first()
            )
            if not t:
                return error("证书模板不存在", "404")
            t.is_active = True
            return success({"id": t.id, "is_active": t.is_active})
        except Exception as e:
            logger.error(f"[edu learn] active certificate-template error: {e}")
            return error(str(e))


@router.put("/certificate-template/inactive", summary="停用证书模板")
async def inactive_certificate_template(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            t = (
                db.query(EduCertificateTemplate)
                .filter(EduCertificateTemplate.id == id)
                .first()
            )
            if not t:
                return error("证书模板不存在", "404")
            t.is_active = False
            return success({"id": t.id, "is_active": t.is_active})
        except Exception as e:
            logger.error(f"[edu learn] inactive certificate-template error: {e}")
            return error(str(e))
