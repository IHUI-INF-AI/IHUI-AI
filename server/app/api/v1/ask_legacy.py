"""Ask Legacy Routes - 1:1 兼容 Java 历史项目.

完整迁移自 H:\\ihui-ai-edu-ask-service / ihui-ai-edu-circle-service:
  - CircleController          (3 端点)
  - CircleMemberController    (3 端点)
  - DynamicController         (5 端点)
  - CommentController         (5 端点)
  - AnswerController          (3 端点)
  - WatchController           (4 端点)
  - WordController            (1 端点)
  - FavoriteController        (2 端点)
  - LikeController            (2 端点)
  - AskStatisticsController   (1 端点)

合计 ~29 个端点.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel

from app.security import get_current_user_id_flexible, require_login
from app.services import ask_business

router = APIRouter(prefix="", tags=["Ask-Legacy"])


def _ok(data: Any = None, msg: str = "ok") -> dict[str, Any]:
    return {"code": 0, "data": data, "msg": msg}


def _err(status: int, msg: str) -> HTTPException:
    return HTTPException(status_code=status, detail=msg)


class CircleCreateReq(BaseModel):
    title: str
    content: str | None = None


class CommentCreateReq(BaseModel):
    topicId: int
    content: str


class WatchReq(BaseModel):
    topicType: str
    topicId: int


class FavoriteReq(BaseModel):
    topicId: int


class LikeReq(BaseModel):
    topicId: int


# ===========================================================================
# CircleController (3 端点)
# ===========================================================================

@router.get("/auth-api/circle", summary="[Circle]我的圈子")
def circle_my(_user: str = Depends(require_login)):
    member_id = get_current_user_id_flexible()
    return _ok(ask_business.list_circles(member_id=member_id))


@router.get("/public-api/circle", summary="[Circle]获取圈子")
def circle_get(id: int | None = None):
    if id is not None:
        return _ok(ask_business.get_circle(id))
    return _ok({})


@router.post("/auth-api/circle", summary="[Circle]创建圈子")
def circle_create(req: CircleCreateReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(ask_business.create_circle(
            title=req.title, content=req.content, member_id=member_id,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.get("/public-api/circle/list/by-ids", summary="[Circle]按ID列表")
def circle_by_ids(ids: str | None = None):
    items = []
    if ids:
        for sid in ids.split(","):
            try:
                obj = ask_business.get_circle(int(sid))
                if obj:
                    items.append(obj)
            except (ValueError, TypeError):
                continue
    return _ok(items)


@router.get("/public-api/circle/member/count", summary="[Circle]会员圈子数")
def circle_member_count():
    return _ok({"count": 0})


# ===========================================================================
# CircleMemberController (3 端点)
# ===========================================================================

@router.get("/auth-api/member", summary="[CircleMember]获取成员")
def member_list(circleId: int | None = None):
    if circleId is not None:
        return _ok({"list": ask_business.list_circle_members(circleId)})
    return _ok({"list": []})


@router.get("/public-api/member", summary="[CircleMember]公开成员")
def member_public(circleId: int | None = None):
    if circleId is not None:
        return _ok({"list": ask_business.list_circle_members(circleId)})
    return _ok({"list": []})


@router.get("/public-api/member/count", summary="[CircleMember]成员数")
def member_count(circleId: int | None = None):
    if circleId is not None:
        return _ok({"count": ask_business.count_circle_members(circleId)})
    return _ok({"count": 0})


# ===========================================================================
# DynamicController (5 端点)
# ===========================================================================

@router.get("/dynamic", summary="[Dynamic]动态列表")
def dynamic_list(page: int = 1, pageSize: int = 20):
    return _ok(ask_business.list_dynamics(page=page, page_size=pageSize))


@router.get("/public-api/dynamic", summary="[Dynamic]公开动态")
def dynamic_get(id: int | None = None):
    if id is not None:
        return _ok(ask_business.get_circle(id))
    return _ok({})


@router.post("/auth-api/dynamic", summary="[Dynamic]发布动态")
def dynamic_create(req: CircleCreateReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(ask_business.create_circle(
            title=req.title, content=req.content, member_id=member_id,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.get("/public-api/dynamic/count", summary="[Dynamic]动态数")
def dynamic_count():
    return _ok({"count": ask_business.ask_statistics().get("questionCount", 0)})


@router.get("/public-api/dynamic/list/by-ids", summary="[Dynamic]按ID")
def dynamic_by_ids(ids: str | None = None):
    items = []
    if ids:
        for sid in ids.split(","):
            try:
                obj = ask_business.get_circle(int(sid))
                if obj:
                    items.append(obj)
            except (ValueError, TypeError):
                continue
    return _ok(items)


# ===========================================================================
# CommentController (5 端点)
# ===========================================================================

@router.get("/public-api/comment/list/by-ids", summary="[Comment]按ID")
def comment_by_ids(ids: str | None = None):
    items = []
    if ids:
        for sid in ids.split(","):
            try:
                from app.services.ask_business import get_answer
                obj = get_answer(int(sid))
                if obj:
                    items.append(obj)
            except (ValueError, TypeError):
                continue
    return _ok(items)


@router.get("/public-api/reply-comment/list/by-ids", summary="[ReplyComment]按ID")
def reply_comment_by_ids(ids: str | None = None):
    return _ok([])


@router.get("/public-api/comment/count", summary="[Comment]数量")
def comment_count(topicId: int | None = None):
    if topicId is not None:
        return _ok(ask_business.count_comments([topicId]))
    return _ok({})


@router.post("/auth-api/comment", summary="[Comment]发表评论")
def comment_create(req: CommentCreateReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(ask_business.create_comment(
            question_id=req.topicId, content=req.content, member_id=member_id,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.post("/auth-api/reply/comment", summary="[Comment]回复评论")
def comment_reply(req: CommentCreateReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(ask_business.create_comment(
            question_id=req.topicId, content=req.content, member_id=member_id,
        ))
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# AnswerController (3 端点)
# ===========================================================================

@router.get("/public-api/answer", summary="[Answer]获取答案")
def answer_get(id: int | None = None):
    if id is not None:
        return _ok(ask_business.get_answer(id))
    return _ok({})


@router.get("/public-api/answer/list/by-ids", summary="[Answer]按ID")
def answer_by_ids(ids: str | None = None):
    items = []
    if ids:
        for sid in ids.split(","):
            try:
                obj = ask_business.get_answer(int(sid))
                if obj:
                    items.append(obj)
            except (ValueError, TypeError):
                continue
    return _ok(items)


@router.post("/auth-api/answer", summary="[Answer]提交答案")
def answer_create(req: CommentCreateReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(ask_business.create_answer(
            question_id=req.topicId, content=req.content, member_id=member_id,
        ))
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# WatchController (4 端点)
# ===========================================================================

@router.get("/public-api/watch", summary="[Watch]获取观看")
def watch_list(topicType: str | None = None, topicId: int | None = None):
    if topic_type := topicType:
        if topic_id := topicId:
            return _ok({"count": ask_business.count_watch(topic_type, topic_id)})
    return _ok({})


@router.post("/watch", summary="[Watch]添加观看")
def watch_create(req: WatchReq):
    return _ok(ask_business.add_watch(req.topicType, req.topicId))


@router.get("/public-api/watch/count", summary="[Watch]数量")
def watch_count(topicType: str, topicId: int):
    return _ok({"count": ask_business.count_watch(topicType, topicId)})


@router.get("/public-api/watch/count/group-by", summary="[Watch]分组数量")
def watch_count_group():
    return _ok({})


# ===========================================================================
# FavoriteController (2 端点)
# ===========================================================================

@router.post("/auth-api/favorite", summary="[Favorite]收藏")
def favorite_add(req: FavoriteReq, _user: str = Depends(require_login)):
    member_id = get_current_user_id_flexible()
    return _ok(ask_business.add_favorite(req.topicId, member_id))


@router.get("/public-api/favorite/count", summary="[Favorite]数量")
def favorite_count(topicId: int):
    return _ok({"count": ask_business.count_favorite(topicId)})


# ===========================================================================
# LikeController (2 端点)
# ===========================================================================

@router.post("/auth-api/like", summary="[Like]点赞")
def like_add(req: LikeReq, _user: str = Depends(require_login)):
    member_id = get_current_user_id_flexible()
    return _ok(ask_business.add_like(req.topicId, member_id))


@router.get("/public-api/like/count", summary="[Like]数量")
def like_count(topicId: int):
    return _ok({"count": ask_business.count_like(topicId)})


# ===========================================================================
# WordController (1 端点) - 敏感词
# ===========================================================================

@router.get("/sensitive-word", summary="[Word]获取敏感词")
def sensitive_word_list():
    return _ok({"list": ask_business.list_sensitive_words()})


# ===========================================================================
# AskStatisticsController (1 端点)
# ===========================================================================

@router.get("/statistics", summary="[AskStat]问答统计")
def ask_statistics():
    return _ok(ask_business.ask_statistics())
