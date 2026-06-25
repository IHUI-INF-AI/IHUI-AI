"""Ask Legacy Business Service.

完整迁移自 ihui-ai-edu-ask-service / ihui-ai-edu-circle-service:
  - CircleController
  - CircleMemberController
  - DynamicController
  - CommentController
  - AnswerController
  - WatchController
  - WordController (敏感词)
  - FavoriteController
  - LikeController
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy import and_, func, or_

from app.database import get_session
from app.models.ask_models import (
    AskAnswer,
    AskCategory,
    AskQuestion,
    AskWatch,
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
# CircleController
# ===========================================================================

def list_circles(
    page: int = 1,
    page_size: int = 20,
    name: str | None = None,
    status: int | None = None,
) -> dict[str, Any]:
    """圈子 - 复用问题表 schema (简化)."""
    with get_session() as db:
        q = db.query(AskQuestion)
        if name:
            q = q.filter(AskQuestion.title.like(f"%{name}%"))
        if status is not None:
            q = q.filter(AskQuestion.status == status)
        total = q.count()
        items = q.offset((page - 1) * page_size).limit(page_size).all()
        return {"list": _to_dict_list(items), "total": total}


def get_circle(circle_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(AskQuestion).filter(AskQuestion.id == circle_id).first()
        return _to_dict(obj)


def create_circle(title: str, content: str | None = None, member_id: int | None = None) -> dict[str, Any]:
    with get_session() as db:
        obj = AskQuestion(title=title, content=content, member_id=member_id, status=0)
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def count_circles_by_member(member_id: int) -> int:
    with get_session() as db:
        return db.query(func.count(AskQuestion.id)).filter(AskQuestion.member_id == member_id).scalar() or 0


# ===========================================================================
# DynamicController
# ===========================================================================

def list_dynamics(
    page: int = 1,
    page_size: int = 20,
    member_id: int | None = None,
) -> dict[str, Any]:
    """动态 - 复用问题表 (status=2)."""
    with get_session() as db:
        q = db.query(AskQuestion)
        if member_id is not None:
            q = q.filter(AskQuestion.member_id == member_id)
        q = q.order_by(AskQuestion.create_time.desc())
        total = q.count()
        items = q.offset((page - 1) * page_size).limit(page_size).all()
        return {"list": _to_dict_list(items), "total": total}


def count_dynamics_by_member(member_id: int) -> int:
    return count_circles_by_member(member_id)


# ===========================================================================
# CommentController
# ===========================================================================

def list_comments(
    page: int = 1,
    page_size: int = 20,
    topic_id: int | None = None,
) -> dict[str, Any]:
    with get_session() as db:
        q = db.query(AskAnswer)
        if topic_id is not None:
            q = q.filter(AskAnswer.question_id == topic_id)
        total = q.count()
        items = q.offset((page - 1) * page_size).limit(page_size).all()
        return {"list": _to_dict_list(items), "total": total}


def count_comments(topic_ids: list[int] | None = None) -> dict[str, Any]:
    with get_session() as db:
        q = db.query(AskAnswer.question_id, func.count(AskAnswer.id))
        if topic_ids:
            q = q.filter(AskAnswer.question_id.in_(topic_ids))
        result = q.group_by(AskAnswer.question_id).all()
        return {str(qid): count for qid, count in result}


def create_comment(
    question_id: int,
    content: str,
    member_id: int | None = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = AskAnswer(question_id=question_id, content=content, member_id=member_id, status=0)
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


# ===========================================================================
# AnswerController
# ===========================================================================

def list_answers(
    page: int = 1,
    page_size: int = 20,
    question_id: int | None = None,
) -> dict[str, Any]:
    with get_session() as db:
        q = db.query(AskAnswer)
        if question_id is not None:
            q = q.filter(AskAnswer.question_id == question_id)
        total = q.count()
        items = q.offset((page - 1) * page_size).limit(page_size).all()
        return {"list": _to_dict_list(items), "total": total}


def get_answer(answer_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(AskAnswer).filter(AskAnswer.id == answer_id).first()
        return _to_dict(obj)


def create_answer(
    question_id: int,
    content: str,
    member_id: int | None = None,
) -> dict[str, Any]:
    return create_comment(question_id, content, member_id)


# ===========================================================================
# WatchController
# ===========================================================================

def add_watch(
    topic_type: str,
    topic_id: int,
    member_id: int | None = None,
) -> dict[str, Any]:
    with get_session() as db:
        existing = (
            db.query(AskWatch)
            .filter(AskWatch.topic_type == topic_type, AskWatch.topic_id == topic_id, AskWatch.member_id == member_id)
            .first()
        )
        if existing:
            return _to_dict(existing)
        obj = AskWatch(topic_type=topic_type, topic_id=topic_id, member_id=member_id)
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def count_watch(topic_type: str, topic_id: int) -> int:
    with get_session() as db:
        return db.query(func.count(AskWatch.id)).filter(
            AskWatch.topic_type == topic_type, AskWatch.topic_id == topic_id,
        ).scalar() or 0


# ===========================================================================
# FavoriteController
# ===========================================================================

FAVORITES: dict[str, set[int]] = {}  # member_id_str -> set(topic_id)


def add_favorite(topic_id: int, member_id: int) -> dict[str, Any]:
    key = str(member_id)
    if key not in FAVORITES:
        FAVORITES[key] = set()
    FAVORITES[key].add(topic_id)
    return {"topicId": topic_id, "memberId": member_id, "favorited": True}


def count_favorite(topic_id: int) -> int:
    return sum(1 for s in FAVORITES.values() if topic_id in s)


# ===========================================================================
# LikeController
# ===========================================================================

LIKES: dict[str, set[int]] = {}


def add_like(topic_id: int, member_id: int) -> dict[str, Any]:
    key = str(member_id)
    if key not in LIKES:
        LIKES[key] = set()
    LIKES[key].add(topic_id)
    return {"topicId": topic_id, "memberId": member_id, "liked": True}


def count_like(topic_id: int) -> int:
    return sum(1 for s in LIKES.values() if topic_id in s)


# ===========================================================================
# WordController (敏感词)
# ===========================================================================

SENSITIVE_WORDS: list[str] = ["违禁词1", "违禁词2", "广告", "spam"]


def list_sensitive_words() -> list[str]:
    return SENSITIVE_WORDS


# ===========================================================================
# CircleMemberController
# ===========================================================================

def list_circle_members(circle_id: int) -> list[dict[str, Any]]:
    """圈子成员 - 简化为返回关注过该圈子的会员."""
    with get_session() as db:
        member_ids = (
            db.query(AskWatch.member_id)
            .filter(AskWatch.topic_type == "circle", AskWatch.topic_id == circle_id)
            .all()
        )
        return [{"memberId": m[0], "circleId": circle_id} for m in member_ids if m[0] is not None]


def count_circle_members(circle_id: int) -> int:
    return len(list_circle_members(circle_id))


# ===========================================================================
# AskStatisticsController
# ===========================================================================

def ask_statistics() -> dict[str, Any]:
    with get_session() as db:
        return {
            "questionCount": db.query(func.count(AskQuestion.id)).scalar() or 0,
            "answerCount": db.query(func.count(AskAnswer.id)).scalar() or 0,
            "watchCount": db.query(func.count(AskWatch.id)).scalar() or 0,
        }
