"""Category Legacy Business Service - 完整迁移自 ihui-ai-edu-*-service 6 个 CategoryController.

Controller 列表:
  - CategoryController (content-service)  7 端点
  - CategoryController (exam-service)     7 端点
  - CategoryController (learn-service)    7 端点
  - CategoryController (ask-service)      5 端点
  - PaperCategoryController (exam)        7 端点
  - QuestionCategoryController (exam)     7 端点
  - TopicCategoryController (learn)       7 端点

合计 ~47 个端点.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy import or_

from app.database import get_session
from app.models.exam_models import (
    PaperCategory,
    PaperCategoryRelation,
    QuestionCategory,
    QuestionCategoryRelation,
)
from app.models.learn_models import (
    Category,
    CategoryRelation,
    TopicCategory,
    TopicCategoryRelation,
)

logger = logging.getLogger(__name__)


def _to_dict(obj: Any) -> dict[str, Any]:
    if obj is None:
        return {}
    out: dict[str, Any] = {}
    for col in obj.__table__.columns:
        v = getattr(obj, col.name, None)
        if hasattr(v, "isoformat"):
            v = v.isoformat()
        out[col.name] = v
    return out


def _to_dict_list(items: list[Any]) -> list[dict[str, Any]]:
    return [_to_dict(i) for i in (items or [])]


# ===========================================================================
# Learn CategoryController (t_category)
# ===========================================================================

def list_learn_categories_admin(
    name: Optional[str] = None,
    is_show: Optional[int] = None,
    is_show_index: Optional[int] = None,
    parent_id: Optional[int] = None,
) -> list[dict[str, Any]]:
    with get_session() as db:
        q = db.query(Category)
        if name:
            q = q.filter(Category.name.like(f"%{name}%"))
        if is_show is not None:
            q = q.filter(Category.is_show == is_show)
        if is_show_index is not None:
            q = q.filter(Category.is_show_index == is_show_index)
        if parent_id is not None:
            q = q.join(CategoryRelation, CategoryRelation.child_category_id == Category.id).filter(
                CategoryRelation.father_category_id == parent_id
            )
        return _to_dict_list(q.order_by(Category.sort_order.asc()).all())


def get_learn_category(cat_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(Category).filter(Category.id == cat_id).first()
        return _to_dict(obj)


def create_learn_category(
    name: str,
    sort_order: int = 0,
    is_show: int = 1,
    is_show_index: int = 0,
    image: Optional[str] = None,
    level: int = 1,
    create_user_id: Optional[int] = None,
    company_id: Optional[int] = None,
    department_id: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = Category(
            name=name,
            sort_order=sort_order,
            is_show=is_show,
            is_show_index=is_show_index,
            image=image,
            level=level,
            create_user_id=create_user_id,
            company_id=company_id,
            department_id=department_id,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def update_learn_category(
    cat_id: int,
    name: Optional[str] = None,
    sort_order: Optional[int] = None,
    is_show: Optional[int] = None,
    is_show_index: Optional[int] = None,
    image: Optional[str] = None,
    level: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(Category).filter(Category.id == cat_id).first()
        if not obj:
            return {}
        if name is not None:
            obj.name = name
        if sort_order is not None:
            obj.sort_order = sort_order
        if is_show is not None:
            obj.is_show = is_show
        if is_show_index is not None:
            obj.is_show_index = is_show_index
        if image is not None:
            obj.image = image
        if level is not None:
            obj.level = level
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def delete_learn_category(cat_id: int) -> None:
    with get_session() as db:
        obj = db.query(Category).filter(Category.id == cat_id).first()
        if obj:
            db.delete(obj)


def update_learn_category_show(cat_id: int, is_show: int) -> None:
    with get_session() as db:
        obj = db.query(Category).filter(Category.id == cat_id).first()
        if obj:
            obj.is_show = is_show


def update_learn_category_show_index(cat_id: int, is_show_index: int) -> None:
    with get_session() as db:
        obj = db.query(Category).filter(Category.id == cat_id).first()
        if obj:
            obj.is_show_index = is_show_index


# ===========================================================================
# TopicCategoryController (learn) - t_topic_category
# ===========================================================================

def list_topic_categories(
    name: Optional[str] = None,
    is_show: Optional[int] = None,
    is_show_index: Optional[int] = None,
) -> list[dict[str, Any]]:
    with get_session() as db:
        q = db.query(TopicCategory)
        if name:
            q = q.filter(TopicCategory.name.like(f"%{name}%"))
        if is_show is not None:
            q = q.filter(TopicCategory.is_show == is_show)
        if is_show_index is not None:
            q = q.filter(TopicCategory.is_show_index == is_show_index)
        return _to_dict_list(q.order_by(TopicCategory.sort_order.asc()).all())


def get_topic_category(cat_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(TopicCategory).filter(TopicCategory.id == cat_id).first()
        return _to_dict(obj)


def create_topic_category(
    name: str,
    sort_order: int = 0,
    is_show: int = 1,
    is_show_index: int = 0,
    image: Optional[str] = None,
    level: int = 1,
    create_user_id: Optional[int] = None,
    company_id: Optional[int] = None,
    department_id: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = TopicCategory(
            name=name,
            sort_order=sort_order,
            is_show=is_show,
            is_show_index=is_show_index,
            image=image,
            level=level,
            create_user_id=create_user_id,
            company_id=company_id,
            department_id=department_id,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def update_topic_category(
    cat_id: int,
    name: Optional[str] = None,
    sort_order: Optional[int] = None,
    is_show: Optional[int] = None,
    is_show_index: Optional[int] = None,
    image: Optional[str] = None,
    level: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(TopicCategory).filter(TopicCategory.id == cat_id).first()
        if not obj:
            return {}
        if name is not None:
            obj.name = name
        if sort_order is not None:
            obj.sort_order = sort_order
        if is_show is not None:
            obj.is_show = is_show
        if is_show_index is not None:
            obj.is_show_index = is_show_index
        if image is not None:
            obj.image = image
        if level is not None:
            obj.level = level
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def delete_topic_category(cat_id: int) -> None:
    with get_session() as db:
        obj = db.query(TopicCategory).filter(TopicCategory.id == cat_id).first()
        if obj:
            db.delete(obj)


def update_topic_category_show(cat_id: int, is_show: int) -> None:
    with get_session() as db:
        obj = db.query(TopicCategory).filter(TopicCategory.id == cat_id).first()
        if obj:
            obj.is_show = is_show


def update_topic_category_show_index(cat_id: int, is_show_index: int) -> None:
    with get_session() as db:
        obj = db.query(TopicCategory).filter(TopicCategory.id == cat_id).first()
        if obj:
            obj.is_show_index = is_show_index


# ===========================================================================
# PaperCategoryController (exam) - paper_category
# ===========================================================================

def list_paper_categories_admin(
    name: Optional[str] = None,
    is_show: Optional[bool] = None,
    is_show_index: Optional[bool] = None,
) -> list[dict[str, Any]]:
    with get_session() as db:
        q = db.query(PaperCategory)
        if name:
            q = q.filter(PaperCategory.name.like(f"%{name}%"))
        if is_show is not None:
            q = q.filter(PaperCategory.is_show == is_show)
        if is_show_index is not None:
            q = q.filter(PaperCategory.is_show_index == is_show_index)
        return _to_dict_list(q.order_by(PaperCategory.sort_order.asc()).all())


def get_paper_category(cat_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(PaperCategory).filter(PaperCategory.id == cat_id).first()
        return _to_dict(obj)


def create_paper_category(
    name: str,
    sort_order: int = 0,
    is_show: bool = True,
    is_show_index: bool = False,
    image: Optional[str] = None,
    level: int = 1,
) -> dict[str, Any]:
    with get_session() as db:
        obj = PaperCategory(
            name=name,
            sort_order=sort_order,
            is_show=is_show,
            is_show_index=is_show_index,
            image=image,
            level=level,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def update_paper_category(
    cat_id: int,
    name: Optional[str] = None,
    sort_order: Optional[int] = None,
    is_show: Optional[bool] = None,
    is_show_index: Optional[bool] = None,
    image: Optional[str] = None,
    level: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(PaperCategory).filter(PaperCategory.id == cat_id).first()
        if not obj:
            return {}
        if name is not None:
            obj.name = name
        if sort_order is not None:
            obj.sort_order = sort_order
        if is_show is not None:
            obj.is_show = is_show
        if is_show_index is not None:
            obj.is_show_index = is_show_index
        if image is not None:
            obj.image = image
        if level is not None:
            obj.level = level
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def delete_paper_category(cat_id: int) -> None:
    with get_session() as db:
        obj = db.query(PaperCategory).filter(PaperCategory.id == cat_id).first()
        if obj:
            db.delete(obj)


def update_paper_category_show(cat_id: int, is_show: bool) -> None:
    with get_session() as db:
        obj = db.query(PaperCategory).filter(PaperCategory.id == cat_id).first()
        if obj:
            obj.is_show = is_show


def update_paper_category_show_index(cat_id: int, is_show_index: bool) -> None:
    with get_session() as db:
        obj = db.query(PaperCategory).filter(PaperCategory.id == cat_id).first()
        if obj:
            obj.is_show_index = is_show_index


def list_paper_categories(
    name: Optional[str] = None,
    is_show: Optional[bool] = True,
) -> list[dict[str, Any]]:
    return list_paper_categories_admin(name=name, is_show=is_show)


# ===========================================================================
# QuestionCategoryController (exam) - question_category
# ===========================================================================

def list_question_categories_admin(
    name: Optional[str] = None,
    is_show: Optional[bool] = None,
    is_show_index: Optional[bool] = None,
) -> list[dict[str, Any]]:
    with get_session() as db:
        q = db.query(QuestionCategory)
        if name:
            q = q.filter(QuestionCategory.name.like(f"%{name}%"))
        if is_show is not None:
            q = q.filter(QuestionCategory.is_show == is_show)
        if is_show_index is not None:
            q = q.filter(QuestionCategory.is_show_index == is_show_index)
        return _to_dict_list(q.order_by(QuestionCategory.sort_order.asc()).all())


def get_question_category(cat_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(QuestionCategory).filter(QuestionCategory.id == cat_id).first()
        return _to_dict(obj)


def create_question_category(
    name: str,
    sort_order: int = 0,
    is_show: bool = True,
    is_show_index: bool = False,
    image: Optional[str] = None,
    level: int = 1,
) -> dict[str, Any]:
    with get_session() as db:
        obj = QuestionCategory(
            name=name,
            sort_order=sort_order,
            is_show=is_show,
            is_show_index=is_show_index,
            image=image,
            level=level,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def update_question_category(
    cat_id: int,
    name: Optional[str] = None,
    sort_order: Optional[int] = None,
    is_show: Optional[bool] = None,
    is_show_index: Optional[bool] = None,
    image: Optional[str] = None,
    level: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(QuestionCategory).filter(QuestionCategory.id == cat_id).first()
        if not obj:
            return {}
        if name is not None:
            obj.name = name
        if sort_order is not None:
            obj.sort_order = sort_order
        if is_show is not None:
            obj.is_show = is_show
        if is_show_index is not None:
            obj.is_show_index = is_show_index
        if image is not None:
            obj.image = image
        if level is not None:
            obj.level = level
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def delete_question_category(cat_id: int) -> None:
    with get_session() as db:
        obj = db.query(QuestionCategory).filter(QuestionCategory.id == cat_id).first()
        if obj:
            db.delete(obj)


def update_question_category_show(cat_id: int, is_show: bool) -> None:
    with get_session() as db:
        obj = db.query(QuestionCategory).filter(QuestionCategory.id == cat_id).first()
        if obj:
            obj.is_show = is_show


def update_question_category_show_index(cat_id: int, is_show_index: bool) -> None:
    with get_session() as db:
        obj = db.query(QuestionCategory).filter(QuestionCategory.id == cat_id).first()
        if obj:
            obj.is_show_index = is_show_index


def list_question_categories(
    name: Optional[str] = None,
    is_show: Optional[bool] = True,
) -> list[dict[str, Any]]:
    return list_question_categories_admin(name=name, is_show=is_show)
