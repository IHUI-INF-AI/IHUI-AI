"""Category Legacy Routes - 1:1 兼容 Java 历史项目 7 个 CategoryController.

完整迁移自 H:\\ihui-ai-edu-*-service 7 个 CategoryController:
  - CategoryController (content-service) - /category/* 路径
  - CategoryController (exam-service)    - /category/* 路径
  - CategoryController (learn-service)   - /category/* 路径
  - CategoryController (ask-service)     - /category/* 路径
  - PaperCategoryController (exam)       - /paper/category/* 路径
  - QuestionCategoryController (exam)    - /question-lib/category/* 路径
  - TopicCategoryController (learn)      - /topic/category/* 路径

合计 ~47 个端点.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.security import get_current_user_id_flexible, require_login
from app.services import category_business

router = APIRouter(prefix="", tags=["Category-Legacy"])


def _ok(data: Any = None, msg: str = "ok") -> dict[str, Any]:
    return {"code": 0, "data": data, "msg": msg}


def _err(status: int, msg: str) -> HTTPException:
    return HTTPException(status_code=status, detail=msg)


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class CategoryCreateReq(BaseModel):
    name: str
    sortOrder: int = 0
    isShow: int | bool = 1
    isShowIndex: int | bool = 0
    image: str | None = None
    level: int = 1
    parentId: int | None = None


class CategoryUpdateReq(BaseModel):
    id: int
    name: str | None = None
    sortOrder: int | None = None
    isShow: int | bool | None = None
    isShowIndex: int | bool | None = None
    image: str | None = None
    level: int | None = None


class CategoryShowReq(BaseModel):
    id: int
    isShow: int | bool


class CategoryShowIndexReq(BaseModel):
    id: int
    isShowIndex: int | bool


class CategoryImageUploadReq(BaseModel):
    file: str | None = None
    url: str | None = None


# ===========================================================================
# Learn CategoryController (t_category) - /category/* 7 端点
# ===========================================================================

@router.get("/category/admin/list", summary="[Learn]获取分类列表(管理端)")
def learn_category_admin_list(
    name: str | None = None,
    isShow: int | None = None,
    isShowIndex: int | None = None,
    parentId: int | None = None,
):
    return _ok(category_business.list_learn_categories_admin(
        name=name, is_show=isShow, is_show_index=isShowIndex, parent_id=parentId,
    ))


@router.get("/category/{id}", summary="[Learn]获取分类详情")
def learn_category_get(id: int):
    return _ok(category_business.get_learn_category(id))


@router.post("/category", summary="[Learn]添加分类")
def learn_category_create(req: CategoryCreateReq):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(category_business.create_learn_category(
            name=req.name,
            sort_order=req.sortOrder,
            is_show=int(req.isShow) if isinstance(req.isShow, int) else (1 if req.isShow else 0),
            is_show_index=int(req.isShowIndex) if isinstance(req.isShowIndex, int) else (1 if req.isShowIndex else 0),
            image=req.image,
            level=req.level,
            create_user_id=member_id,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/category", summary="[Learn]修改分类")
def learn_category_update(req: CategoryUpdateReq):
    if req.id <= 0:
        raise _err(400, "分类id需大于0")
    return _ok(category_business.update_learn_category(
        cat_id=req.id,
        name=req.name,
        sort_order=req.sortOrder,
        is_show=int(req.isShow) if isinstance(req.isShow, int) and req.isShow is not None else None,
        is_show_index=int(req.isShowIndex) if isinstance(req.isShowIndex, int) and req.isShowIndex is not None else None,
        image=req.image,
        level=req.level,
    ))


@router.delete("/category/{id}", summary="[Learn]删除分类")
def learn_category_delete(id: int):
    category_business.delete_learn_category(id)
    return _ok()


@router.put("/category/is-show", summary="[Learn]修改分类显示状态")
def learn_category_update_show(req: CategoryShowReq):
    if req.id is None:
        raise _err(400, "id不能为空")
    if req.isShow is None:
        raise _err(400, "显示状态不能为空")
    category_business.update_learn_category_show(req.id, int(req.isShow))
    return _ok()


@router.put("/category/is-show-index", summary="[Learn]修改分类首页显示状态")
def learn_category_update_show_index(req: CategoryShowIndexReq):
    if req.id is None:
        raise _err(400, "id不能为空")
    if req.isShowIndex is None:
        raise _err(400, "显示状态不能为空")
    category_business.update_learn_category_show_index(req.id, int(req.isShowIndex))
    return _ok()


@router.get("/public-api/category/list", summary="[Learn]获取分类列表(公开)")
def learn_category_public_list(
    name: str | None = None,
    isShow: int | None = 1,
):
    return _ok(category_business.list_learn_categories_admin(name=name, is_show=isShow))


# ===========================================================================
# TopicCategoryController (learn) - /topic/category/* 7 端点
# ===========================================================================

@router.get("/topic/category/admin/list", summary="[Topic]获取分类列表(管理端)")
def topic_category_admin_list(
    name: str | None = None,
    isShow: int | None = None,
    isShowIndex: int | None = None,
):
    return _ok(category_business.list_topic_categories(
        name=name, is_show=isShow, is_show_index=isShowIndex,
    ))


@router.get("/topic/category/{id}", summary="[Topic]获取分类详情")
def topic_category_get(id: int):
    return _ok(category_business.get_topic_category(id))


@router.post("/topic/category", summary="[Topic]添加分类")
def topic_category_create(req: CategoryCreateReq):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(category_business.create_topic_category(
            name=req.name,
            sort_order=req.sortOrder,
            is_show=int(req.isShow) if isinstance(req.isShow, int) else (1 if req.isShow else 0),
            is_show_index=int(req.isShowIndex) if isinstance(req.isShowIndex, int) else (1 if req.isShowIndex else 0),
            image=req.image,
            level=req.level,
            create_user_id=member_id,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/topic/category", summary="[Topic]修改分类")
def topic_category_update(req: CategoryUpdateReq):
    if req.id <= 0:
        raise _err(400, "分类id需大于0")
    return _ok(category_business.update_topic_category(
        cat_id=req.id, name=req.name, sort_order=req.sortOrder,
        is_show=req.isShow, is_show_index=req.isShowIndex,
        image=req.image, level=req.level,
    ))


@router.delete("/topic/category/{id}", summary="[Topic]删除分类")
def topic_category_delete(id: int):
    category_business.delete_topic_category(id)
    return _ok()


@router.put("/topic/category/is-show", summary="[Topic]修改分类显示状态")
def topic_category_update_show(req: CategoryShowReq):
    if req.id is None:
        raise _err(400, "id不能为空")
    if req.isShow is None:
        raise _err(400, "显示状态不能为空")
    category_business.update_topic_category_show(req.id, int(req.isShow))
    return _ok()


@router.put("/topic/category/is-show-index", summary="[Topic]修改分类首页显示状态")
def topic_category_update_show_index(req: CategoryShowIndexReq):
    if req.id is None:
        raise _err(400, "id不能为空")
    if req.isShowIndex is None:
        raise _err(400, "显示状态不能为空")
    category_business.update_topic_category_show_index(req.id, int(req.isShowIndex))
    return _ok()


# ===========================================================================
# PaperCategoryController (exam) - /paper/category/* 6 端点
# ===========================================================================

@router.get("/paper/category/admin/list", summary="[Paper]获取分类列表(管理端)")
def paper_category_admin_list(
    name: str | None = None,
    isShow: bool | None = None,
    isShowIndex: bool | None = None,
):
    return _ok(category_business.list_paper_categories_admin(
        name=name, is_show=isShow, is_show_index=isShowIndex,
    ))


@router.get("/paper/category/{id}", summary="[Paper]获取分类详情")
def paper_category_get(id: int):
    return _ok(category_business.get_paper_category(id))


@router.post("/paper/category", summary="[Paper]添加分类", operation_id="category_legacy_paper_category_create")
def paper_category_create(req: CategoryCreateReq):
    try:
        return _ok(category_business.create_paper_category(
            name=req.name,
            sort_order=req.sortOrder,
            is_show=bool(req.isShow) if not isinstance(req.isShow, int) else bool(req.isShow),
            is_show_index=bool(req.isShowIndex) if not isinstance(req.isShowIndex, int) else bool(req.isShowIndex),
            image=req.image,
            level=req.level,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/paper/category", summary="[Paper]修改分类")
def paper_category_update(req: CategoryUpdateReq):
    if req.id <= 0:
        raise _err(400, "分类id需大于0")
    return _ok(category_business.update_paper_category(
        cat_id=req.id, name=req.name, sort_order=req.sortOrder,
        is_show=req.isShow, is_show_index=req.isShowIndex,
        image=req.image, level=req.level,
    ))


@router.delete("/paper/category/{id}", summary="[Paper]删除分类")
def paper_category_delete(id: int):
    category_business.delete_paper_category(id)
    return _ok()


@router.put("/paper/category/is-show", summary="[Paper]修改分类显示状态")
def paper_category_update_show(req: CategoryShowReq):
    if req.id is None:
        raise _err(400, "id不能为空")
    if req.isShow is None:
        raise _err(400, "显示状态不能为空")
    category_business.update_paper_category_show(req.id, bool(req.isShow))
    return _ok()


@router.put("/paper/category/is-show-index", summary="[Paper]修改分类首页显示状态")
def paper_category_update_show_index(req: CategoryShowIndexReq):
    if req.id is None:
        raise _err(400, "id不能为空")
    if req.isShowIndex is None:
        raise _err(400, "显示状态不能为空")
    category_business.update_paper_category_show_index(req.id, bool(req.isShowIndex))
    return _ok()


@router.get("/paper/category/list", summary="[Paper]获取分类列表(公开)")
def paper_category_public_list(
    name: str | None = None,
    isShow: bool | None = True,
):
    return _ok(category_business.list_paper_categories(name=name, is_show=isShow))


# ===========================================================================
# QuestionCategoryController (exam) - /question-lib/category/* 6 端点
# ===========================================================================

@router.get("/question-lib/category/admin/list", summary="[Question]获取分类列表(管理端)")
def question_category_admin_list(
    name: str | None = None,
    isShow: bool | None = None,
    isShowIndex: bool | None = None,
):
    return _ok(category_business.list_question_categories_admin(
        name=name, is_show=isShow, is_show_index=isShowIndex,
    ))


@router.get("/question-lib/category/{id}", summary="[Question]获取分类详情")
def question_category_get(id: int):
    return _ok(category_business.get_question_category(id))


@router.post("/question-lib/category", summary="[Question]添加分类")
def question_category_create(req: CategoryCreateReq):
    try:
        return _ok(category_business.create_question_category(
            name=req.name,
            sort_order=req.sortOrder,
            is_show=bool(req.isShow) if not isinstance(req.isShow, int) else bool(req.isShow),
            is_show_index=bool(req.isShowIndex) if not isinstance(req.isShowIndex, int) else bool(req.isShowIndex),
            image=req.image,
            level=req.level,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/question-lib/category", summary="[Question]修改分类")
def question_category_update(req: CategoryUpdateReq):
    if req.id <= 0:
        raise _err(400, "分类id需大于0")
    return _ok(category_business.update_question_category(
        cat_id=req.id, name=req.name, sort_order=req.sortOrder,
        is_show=req.isShow, is_show_index=req.isShowIndex,
        image=req.image, level=req.level,
    ))


@router.delete("/question-lib/category/{id}", summary="[Question]删除分类")
def question_category_delete(id: int):
    category_business.delete_question_category(id)
    return _ok()


@router.put("/question-lib/category/is-show", summary="[Question]修改分类显示状态")
def question_category_update_show(req: CategoryShowReq):
    if req.id is None:
        raise _err(400, "id不能为空")
    if req.isShow is None:
        raise _err(400, "显示状态不能为空")
    category_business.update_question_category_show(req.id, bool(req.isShow))
    return _ok()


@router.put("/question-lib/category/is-show-index", summary="[Question]修改分类首页显示状态")
def question_category_update_show_index(req: CategoryShowIndexReq):
    if req.id is None:
        raise _err(400, "id不能为空")
    if req.isShowIndex is None:
        raise _err(400, "显示状态不能为空")
    category_business.update_question_category_show_index(req.id, bool(req.isShowIndex))
    return _ok()


@router.get("/question-lib/category/list", summary="[Question]获取分类列表(公开)")
def question_category_public_list(
    name: str | None = None,
    isShow: bool | None = True,
):
    return _ok(category_business.list_question_categories(name=name, is_show=isShow))
