"""问答 / 圈子扩展 service - 5 个新 model."""
from __future__ import annotations

import logging
from typing import Any

from app.database import get_session
from app.models.ask_models import (
    AskAnswerExt,
    AskCategoryRelation,
    AskQuestionExt,
)
from app.models.circle_models import (
    CircleCategoryBind,
    CircleCategoryRelation,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Ask 分类关系 + 扩展
# ---------------------------------------------------------------------------

def bind_ask_category_relation(
    child_id: str, father_id: str, direct_father_id: int = 0
) -> AskCategoryRelation:
    with get_session() as db:
        r = AskCategoryRelation(
            child_category_id=child_id,
            father_category_id=father_id,
            direct_father_category_id=direct_father_id,
            is_sub=1 if direct_father_id else 0,
        )
        db.add(r)
        return r


def create_ask_answer_ext(
    answer_id: str,
    member_id: int | None = None,
    favorite_num: int = 0,
    like_num: int = 0,
    comment_num: int = 0,
    is_adopted: bool = False,
    is_top: bool = False,
) -> AskAnswerExt:
    """创建 H 盘兼容字段冗余表记录."""
    with get_session() as db:
        existing = (
            db.query(AskAnswerExt).filter(AskAnswerExt.answer_id == answer_id).first()
        )
        if existing:
            existing.favorite_num = favorite_num
            existing.like_num = like_num
            existing.comment_num = comment_num
            existing.is_adopted = is_adopted
            existing.is_top = is_top
            return existing
        ext = AskAnswerExt(
            answer_id=answer_id,
            member_id=member_id,
            favorite_num=favorite_num,
            like_num=like_num,
            comment_num=comment_num,
            is_adopted=is_adopted,
            is_top=is_top,
        )
        db.add(ext)
        db.flush()
        db.refresh(ext)
        return ext


def create_ask_question_ext(
    question_id: str,
    member_id: int | None = None,
    view_num: int = 0,
    collect_num: int = 0,
    answer_num: int = 0,
    is_top: bool = False,
    is_essence: bool = False,
) -> AskQuestionExt:
    with get_session() as db:
        existing = (
            db.query(AskQuestionExt)
            .filter(AskQuestionExt.question_id == question_id)
            .first()
        )
        if existing:
            existing.view_num = view_num
            existing.collect_num = collect_num
            existing.answer_num = answer_num
            existing.is_top = is_top
            existing.is_essence = is_essence
            return existing
        ext = AskQuestionExt(
            question_id=question_id,
            member_id=member_id,
            view_num=view_num,
            collect_num=collect_num,
            answer_num=answer_num,
            is_top=is_top,
            is_essence=is_essence,
        )
        db.add(ext)
        db.flush()
        db.refresh(ext)
        return ext


# ---------------------------------------------------------------------------
# Circle 分类关系 + 多对多绑定
# ---------------------------------------------------------------------------

def bind_circle_category_relation(
    child_id: str, father_id: str, direct_father_id: int = 0
) -> CircleCategoryRelation:
    with get_session() as db:
        r = CircleCategoryRelation(
            child_category_id=child_id,
            father_category_id=father_id,
            direct_father_category_id=direct_father_id,
            is_sub=1 if direct_father_id else 0,
        )
        db.add(r)
        return r


def bind_circle_to_category(circle_id: str, category_id: str) -> CircleCategoryBind:
    with get_session() as db:
        r = CircleCategoryBind(circle_id=circle_id, category_id=category_id)
        db.add(r)
        return r


def list_circles_by_category(category_id: str) -> list[int]:
    """返回 category_id 下所有圈子 ID."""
    with get_session() as db:
        rows = (
            db.query(CircleCategoryBind.circle_id)
            .filter(CircleCategoryBind.category_id == category_id)
            .all()
        )
        return [r[0] for r in rows]
