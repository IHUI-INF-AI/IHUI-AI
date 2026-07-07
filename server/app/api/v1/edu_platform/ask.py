"""问答模块路由 - 迁移自旧 Java Spring Boot ask-service (2026-07-05).

包含: 问答分类CRUD/问题CRUD/回答列表.
问题支持浏览量/点赞/采纳状态, 回答支持点赞与采纳标记.
"""
from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models_ext import (
    EduAnswer,
    EduAskCategory,
    EduQuestion,
)
from app.schemas.common import error, success

router = APIRouter()


# ---------------------------------------------------------------------------
# 问答分类
# ---------------------------------------------------------------------------


def _category_to_dict(c: EduAskCategory) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "pid": c.pid,
        "sort": c.sort,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.get("/category/admin/list", summary="问答分类树", operation_id="edu_platform_ask_category_admin_list")
async def category_admin_list(
    id: int | None = Query(None, description="父分类id, 不传则返回全部"),
    fetchAll: bool | None = Query(None, description="是否获取全部(含禁用)"),
):
    with get_session() as db:
        try:
            q = db.query(EduAskCategory)
            if id is not None:
                q = q.filter(EduAskCategory.pid == id)
            if not fetchAll:
                q = q.filter(EduAskCategory.status == 1)
            items = q.order_by(
                EduAskCategory.sort.asc(), EduAskCategory.id.asc()
            ).all()
            return success([_category_to_dict(c) for c in items])
        except Exception as e:
            logger.error(f"[edu ask] category admin list error: {e}")
            return error(str(e))


@router.get("/category/{category_id}", summary="问答分类详情", operation_id="edu_platform_ask_get_category_detail")
async def get_category_detail(category_id: int):
    with get_session() as db:
        try:
            c = db.query(EduAskCategory).filter(
                EduAskCategory.id == category_id
            ).first()
            if not c:
                return error("分类不存在", "404")
            return success(_category_to_dict(c))
        except Exception as e:
            logger.error(f"[edu ask] get category detail error: {e}")
            return error(str(e))


@router.post("/category", summary="新建问答分类", operation_id="edu_platform_ask_create_category")
async def create_category(
    name: str = Body(..., min_length=1, max_length=100),
    pid: int = Body(0),
    sort: int = Body(0),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            c = EduAskCategory(name=name, pid=pid, sort=sort, status=status)
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu ask] create category error: {e}")
            return error(str(e))


@router.put("/category", summary="更新问答分类", operation_id="edu_platform_ask_update_category")
async def update_category(
    id: int = Body(...),
    name: str | None = Body(None),
    pid: int | None = Body(None),
    sort: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            c = db.query(EduAskCategory).filter(EduAskCategory.id == id).first()
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
            logger.error(f"[edu ask] update category error: {e}")
            return error(str(e))


@router.delete("/category/{category_id}", summary="删除问答分类", operation_id="edu_platform_ask_delete_category")
async def delete_category(category_id: int):
    with get_session() as db:
        try:
            c = db.query(EduAskCategory).filter(
                EduAskCategory.id == category_id
            ).first()
            if not c:
                return error("分类不存在", "404")
            db.delete(c)
            return success()
        except Exception as e:
            logger.error(f"[edu ask] delete category error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 问题
# ---------------------------------------------------------------------------


def _question_to_dict(q: EduQuestion, with_content: bool = True) -> dict:
    return {
        "id": q.id,
        "title": q.title,
        "content": q.content if with_content else None,
        "category_id": q.category_id,
        "member_id": q.member_id,
        "member_name": q.member_name,
        "answer_count": q.answer_count,
        "view_count": q.view_count,
        "like_count": q.like_count,
        "is_solved": q.is_solved,
        "status": q.status,
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "updated_at": q.updated_at.isoformat() if q.updated_at else None,
    }


@router.get("/public-api/question", summary="问题详情(公开)")
async def get_question_public(id: int = Query(..., description="问题id")):
    with get_session() as db:
        try:
            q = db.query(EduQuestion).filter(EduQuestion.id == id).first()
            if not q:
                return error("问题不存在", "404")
            q.view_count = (q.view_count or 0) + 1
            db.flush()
            return success(_question_to_dict(q, with_content=True))
        except Exception as e:
            logger.error(f"[edu ask] get question public error: {e}")
            return error(str(e))


@router.post("/question", summary="新建问题", operation_id="edu_platform_ask_create_question")
async def create_question(
    title: str = Body(..., min_length=1, max_length=500),
    content: str | None = Body(None),
    category_id: int | None = Body(None),
    member_id: int = Body(...),
    member_name: str | None = Body(None, max_length=100),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            q = EduQuestion(
                title=title,
                content=content,
                category_id=category_id,
                member_id=member_id,
                member_name=member_name,
                status=status,
            )
            db.add(q)
            db.flush()
            return success({"id": q.id})
        except Exception as e:
            logger.error(f"[edu ask] create question error: {e}")
            return error(str(e))


@router.put("/question", summary="更新问题", operation_id="edu_platform_ask_update_question")
async def update_question(
    id: int = Body(...),
    title: str | None = Body(None),
    content: str | None = Body(None),
    category_id: int | None = Body(None),
    member_name: str | None = Body(None),
    is_solved: bool | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            q = db.query(EduQuestion).filter(EduQuestion.id == id).first()
            if not q:
                return error("问题不存在", "404")
            if title is not None:
                q.title = title
            if content is not None:
                q.content = content
            if category_id is not None:
                q.category_id = category_id
            if member_name is not None:
                q.member_name = member_name
            if is_solved is not None:
                q.is_solved = is_solved
            if status is not None:
                q.status = status
            return success({"id": q.id})
        except Exception as e:
            logger.error(f"[edu ask] update question error: {e}")
            return error(str(e))


@router.delete("/question", summary="删除问题", operation_id="edu_platform_ask_delete_question")
async def delete_question(id: int = Query(...)):
    with get_session() as db:
        try:
            q = db.query(EduQuestion).filter(EduQuestion.id == id).first()
            if not q:
                return error("问题不存在", "404")
            db.delete(q)
            return success()
        except Exception as e:
            logger.error(f"[edu ask] delete question error: {e}")
            return error(str(e))


@router.get("/public-api/question/list/by-ids", summary="批量获取问题")
async def question_list_by_ids(
    ids: str = Query(..., description="问题id列表, 逗号分隔"),
):
    with get_session() as db:
        try:
            id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
            items = (
                db.query(EduQuestion)
                .filter(EduQuestion.id.in_(id_list))
                .order_by(EduQuestion.id.desc())
                .all()
            )
            return success(
                [_question_to_dict(q, with_content=False) for q in items]
            )
        except Exception as e:
            logger.error(f"[edu ask] question list by ids error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 回答
# ---------------------------------------------------------------------------


def _answer_to_dict(a: EduAnswer) -> dict:
    return {
        "id": a.id,
        "question_id": a.question_id,
        "member_id": a.member_id,
        "member_name": a.member_name,
        "content": a.content,
        "like_count": a.like_count,
        "is_adopted": a.is_adopted,
        "status": a.status,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


@router.get("/answer/list", summary="回答列表")
async def answer_list(
    question_id: int | None = None,
    member_id: int | None = None,
    is_adopted: bool | None = None,
    status: int | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(EduAnswer)
            if question_id:
                q = q.filter(EduAnswer.question_id == question_id)
            if member_id:
                q = q.filter(EduAnswer.member_id == member_id)
            if is_adopted is not None:
                q = q.filter(EduAnswer.is_adopted == is_adopted)
            if status is not None:
                q = q.filter(EduAnswer.status == status)
            total = q.count()
            items = (
                q.order_by(
                    EduAnswer.is_adopted.desc(), EduAnswer.id.desc()
                )
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_answer_to_dict(a) for a in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu ask] answer list error: {e}")
            return error(str(e))


@router.get("/public-api/answer/list/by-ids", summary="批量获取回答")
async def answer_list_by_ids(
    ids: str = Query(..., description="回答id列表, 逗号分隔"),
):
    with get_session() as db:
        try:
            id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
            items = (
                db.query(EduAnswer)
                .filter(EduAnswer.id.in_(id_list))
                .order_by(EduAnswer.id.desc())
                .all()
            )
            return success([_answer_to_dict(a) for a in items])
        except Exception as e:
            logger.error(f"[edu ask] answer list by ids error: {e}")
            return error(str(e))
