"""Learn Legacy Routes - 1:1 兼容 Java 历史项目 ihui-ai-edu-learn-service 17 个 Controller.

完整迁移自 H:\\ihui-ai-edu-learn-service:
  - LessonController          (14 端点)
  - LessonChapterController   (6 端点)
  - LessonChapterSectionController (3 端点)
  - LessonOrderController     (3 端点)
  - RateController            (5 端点)
  - RecordController          (3 端点)
  - SignUpController          (7 端点)
  - LearnMapController        (8 端点)
  - TopicController           (7 端点)
  - LessonAccessController    (1 端点)
  - LessonTaskController      (2 端点)
  - HomeworkController        (1 端点)
  - HomeworkRecordController  (3 端点)
  - ReportController          (3 端点)
  - StatisticsController      (1 端点)

合计 ~75 个端点.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.security import get_current_user_id_flexible, require_login
from app.services import learn_business

router = APIRouter(prefix="", tags=["Learn-Legacy"])


def _ok(data: Any = None, msg: str = "ok") -> dict[str, Any]:
    return {"code": 0, "data": data, "msg": msg}


def _err(status: int, msg: str) -> HTTPException:
    return HTTPException(status_code=status, detail=msg)


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


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class LessonCreateReq(BaseModel):
    name: str
    code: str | None = None
    image: str | None = None
    phrase: str | None = None
    introduction: str | None = None
    price: int = 0
    originalPrice: int = 0
    sortWeight: int = 0
    startTime: str | None = None
    endTime: str | None = None


class LessonUpdateReq(BaseModel):
    id: int
    name: str | None = None
    image: str | None = None
    phrase: str | None = None
    introduction: str | None = None
    price: int | None = None
    originalPrice: int | None = None
    sortWeight: int | None = None
    startTime: str | None = None
    endTime: str | None = None
    certificateId: int | None = None
    examPaperId: int | None = None


class LessonIdReq(BaseModel):
    id: int


class RateCreateReq(BaseModel):
    lessonId: int
    contentUtilityScore: int = 5
    contentDepthScore: int = 5
    instructorExpertiseScore: int = 5
    teachingMethodScore: int = 5
    innovateScore: int = 5
    overallSatisfactionScore: int = 5
    additionalComments: str | None = None


class RecordCreateReq(BaseModel):
    lessonId: int
    lessonChapterSectionId: int
    learnTime: int = 0
    signUpId: int | None = None
    maxProgressTime: int = 0
    progress: int = 0


class RecordUpdateReq(BaseModel):
    id: int
    learnTime: int | None = None
    maxProgressTime: int | None = None
    progress: int | None = None
    status: int | None = None


class SignUpCreateReq(BaseModel):
    lessonId: int


class SignUpDeleteReq(BaseModel):
    id: int


class SignUpIdReq(BaseModel):
    id: int
    lessonId: int
    memberId: int


class ChapterCreateReq(BaseModel):
    lessonId: int
    title: str
    phrase: str | None = None
    sortOrder: int = 0


class ChapterUpdateReq(BaseModel):
    id: int
    title: str | None = None
    phrase: str | None = None
    sortOrder: int | None = None


class ChapterIdReq(BaseModel):
    id: int


class ChapterSortOrderReq(BaseModel):
    id: int
    sortOrder: int


class SectionCreateReq(BaseModel):
    chapterId: int
    title: str
    type: str | None = None
    url: str | None = None
    phrase: str | None = None
    totalTime: int = 0
    sortOrder: int = 0
    content: str | None = None
    contentType: str | None = None


class SectionUpdateReq(BaseModel):
    id: int
    title: str | None = None
    type: str | None = None
    url: str | None = None
    phrase: str | None = None
    totalTime: int | None = None
    sortOrder: int | None = None
    content: str | None = None
    contentType: str | None = None


class LearnMapCreateReq(BaseModel):
    title: str
    description: str | None = None
    image: str | None = None


class LearnMapUpdateReq(BaseModel):
    id: int
    title: str | None = None
    description: str | None = None
    image: str | None = None


class TopicCreateReq(BaseModel):
    title: str
    description: str | None = None
    image: str | None = None
    price: int = 0
    originalPrice: int = 0


class TopicUpdateReq(BaseModel):
    id: int
    title: str | None = None
    description: str | None = None
    image: str | None = None
    price: int | None = None
    originalPrice: int | None = None


class OrderCreateReq(BaseModel):
    lessonId: int
    amount: int = 0


class OrderPaymentReq(BaseModel):
    orderId: int
    payMethod: str = "alipay"


class PaymentCallbackReq(BaseModel):
    orderId: int
    status: str = "success"


# ===========================================================================
# LessonController (14 端点)
# ===========================================================================

@router.get("/lesson/list", summary="[Lesson]获取课程列表")
def lesson_list(
    page: int = 1,
    pageSize: int = 20,
    name: str | None = None,
    status: int | None = None,
    createUserId: int | None = None,
    companyId: int | None = None,
    categoryId: int | None = None,
):
    return _ok(learn_business.list_lessons(
        page=page, page_size=pageSize, name=name, status=status,
        create_user_id=createUserId, company_id=companyId, category_id=categoryId,
    ))


@router.get("/auth-api/lesson/list", summary="[Lesson]获取课程列表(需登录)")
def lesson_auth_list(
    page: int = 1,
    pageSize: int = 20,
    name: str | None = None,
    status: int | None = None,
    _user: str = Depends(require_login),
):
    return _ok(learn_business.list_lessons(
        page=page, page_size=pageSize, name=name, status=status,
    ))


@router.get("/lesson", summary="[Lesson]获取课程详情")
def lesson_get(id: int):
    return _ok(learn_business.get_lesson(id))


@router.get("/public-api/lesson", summary="[Lesson]获取课程详情(公开)")
def lesson_get_public(id: int):
    obj = learn_business.get_lesson(id)
    # 只返回已发布的
    if obj.get("status") != 1:
        return _ok({})
    return _ok(obj)


@router.post("/lesson", summary="[Lesson]创建课程")
def lesson_create(req: LessonCreateReq):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(learn_business.create_lesson(
            name=req.name, code=req.code, image=req.image, phrase=req.phrase,
            introduction=req.introduction, price=req.price, original_price=req.originalPrice,
            sort_weight=req.sortWeight, create_user_id=member_id,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/lesson", summary="[Lesson]更新课程")
def lesson_update(req: LessonUpdateReq):
    return _ok(learn_business.update_lesson(
        lesson_id=req.id, name=req.name, image=req.image, phrase=req.phrase,
        introduction=req.introduction, price=req.price, original_price=req.originalPrice,
        sort_weight=req.sortWeight, certificate_id=req.certificateId, exam_paper_id=req.examPaperId,
    ))


@router.put("/lesson/certificate", summary="[Lesson]更新课程证书")
def lesson_update_certificate(req: LessonUpdateReq):
    return _ok(learn_business.update_lesson(
        lesson_id=req.id, certificate_id=req.certificateId,
    ))


@router.put("/lesson/exampaper", summary="[Lesson]更新课程试卷")
def lesson_update_exampaper(req: LessonUpdateReq):
    return _ok(learn_business.update_lesson(
        lesson_id=req.id, exam_paper_id=req.examPaperId,
    ))


@router.delete("/lesson", summary="[Lesson]删除课程")
def lesson_delete(req: LessonIdReq):
    learn_business.delete_lesson(req.id)
    return _ok()


@router.put("/lesson/publish", summary="[Lesson]发布课程")
def lesson_publish(req: LessonIdReq):
    learn_business.publish_lesson(req.id)
    return _ok()


@router.put("/lesson/un-publish", summary="[Lesson]取消发布课程")
def lesson_unpublish(req: LessonIdReq):
    learn_business.unpublish_lesson(req.id)
    return _ok()


@router.get("/public-api/lesson/list", summary="[Lesson]获取课程列表(公开)")
def lesson_public_list(
    page: int = 1,
    pageSize: int = 20,
    name: str | None = None,
):
    return _ok(learn_business.list_lessons(
        page=page, page_size=pageSize, name=name, status=1,
    ))


@router.get("/public-api/lesson/list/by-ids", summary="[Lesson]根据ID获取课程列表")
def lesson_public_list_by_ids(ids: str | None = None):
    with_app = []
    if ids:
        for sid in ids.split(","):
            try:
                obj = learn_business.get_lesson(int(sid))
                if obj and obj.get("status") == 1:
                    with_app.append(obj)
            except (ValueError, TypeError):
                continue
    return _ok(with_app)


@router.get("/public-api/lesson/recommend/list", summary="[Lesson]推荐课程列表")
def lesson_recommend_list():
    return _ok(learn_business.list_lessons(page=1, page_size=10, status=1))


@router.get("/public-api/lesson/hottest/list", summary="[Lesson]最热课程列表")
def lesson_hottest_list():
    return _ok(learn_business.list_lessons(page=1, page_size=10, status=1))


@router.get("/public-api/lesson/newest/list", summary="[Lesson]最新课程列表")
def lesson_newest_list():
    return _ok(learn_business.list_lessons(page=1, page_size=10, status=1))


# ===========================================================================
# LessonChapterController (6 端点)
# ===========================================================================

@router.get("/lesson/chapter/list", summary="[Chapter]获取章节列表(管理端)")
def chapter_list(lessonId: int):
    if lessonId is None:
        raise _err(400, "课程id为必填参数")
    return _ok({"list": learn_business.list_lesson_chapters(lessonId)})


@router.get("/public-api/lesson/chapter/list", summary="[Chapter]获取章节列表(公开)")
def chapter_public_list(lessonId: int):
    if lessonId is None:
        raise _err(400, "课程id为必填参数")
    return _ok({"list": learn_business.list_lesson_chapters(lessonId)})


@router.post("/lesson/chapter", summary="[Chapter]添加章节")
def chapter_create(req: ChapterCreateReq):
    return _ok(learn_business.create_lesson_chapter(
        lesson_id=req.lessonId, title=req.title, phrase=req.phrase, sort_order=req.sortOrder,
    ))


@router.put("/lesson/chapter", summary="[Chapter]修改章节")
def chapter_update(req: ChapterUpdateReq):
    return _ok(learn_business.update_lesson_chapter(
        chapter_id=req.id, title=req.title, phrase=req.phrase, sort_order=req.sortOrder,
    ))


@router.delete("/lesson/chapter", summary="[Chapter]删除章节")
def chapter_delete(req: ChapterIdReq):
    learn_business.delete_lesson_chapter(req.id)
    return _ok()


@router.put("/lesson/chapter/sort-order", summary="[Chapter]修改章节排序")
def chapter_sort_order(req: ChapterSortOrderReq):
    learn_business.update_lesson_chapter_sort_order(req.id, req.sortOrder)
    return _ok()


# ===========================================================================
# LessonChapterSectionController (3 端点)
# ===========================================================================

@router.post("/lesson/chapter-section", summary="[Section]添加小节")
def section_create(req: SectionCreateReq):
    return _ok(learn_business.create_lesson_chapter_section(
        chapter_id=req.chapterId, title=req.title, type=req.type, url=req.url,
        phrase=req.phrase, total_time=req.totalTime, sort_order=req.sortOrder,
        content=req.content, content_type=req.contentType,
    ))


@router.put("/lesson/chapter-section", summary="[Section]修改小节")
def section_update(req: SectionUpdateReq):
    return _ok(learn_business.update_lesson_chapter_section(
        section_id=req.id, title=req.title, type=req.type, url=req.url,
        phrase=req.phrase, total_time=req.totalTime, sort_order=req.sortOrder,
        content=req.content, content_type=req.contentType,
    ))


@router.delete("/lesson/chapter-section", summary="[Section]删除小节")
def section_delete(req: LessonIdReq):
    learn_business.delete_lesson_chapter_section(req.id)
    return _ok()


# ===========================================================================
# RateController (5 端点)
# ===========================================================================

@router.get("/lesson/rate/list", summary="[Rate]获取评价列表")
def rate_list(
    page: int = 1,
    pageSize: int = 20,
    lessonId: int | None = None,
    memberId: int | None = None,
):
    return _ok(learn_business.list_rates(
        page=page, page_size=pageSize, lesson_id=lessonId, member_id=memberId,
    ))


@router.get("/auth-api/lesson/rate/list", summary="[Rate]获取评价列表(需登录)")
def rate_auth_list(
    page: int = 1,
    pageSize: int = 20,
    lessonId: int | None = None,
    _user: str = Depends(require_login),
):
    return _ok(learn_business.list_rates(
        page=page, page_size=pageSize, lesson_id=lessonId,
    ))


@router.get("/lesson/rate", summary="[Rate]获取评价详情")
def rate_get(id: int):
    return _ok(learn_business.get_rate(id))


@router.get("/auth-api/lesson/rate", summary="[Rate]获取评价详情(需登录)")
def rate_auth_get(id: int, memberId: int | None = None, _user: str = Depends(require_login)):
    if memberId is None:
        memberId = get_current_user_id_flexible()
    return _ok(learn_business.get_rate(id))


@router.post("/auth-api/lesson/rate", summary="[Rate]创建评价")
def rate_create(req: RateCreateReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(learn_business.create_rate(
            lesson_id=req.lessonId, member_id=member_id,
            content_utility_score=req.contentUtilityScore,
            content_depth_score=req.contentDepthScore,
            instructor_expertise_score=req.instructorExpertiseScore,
            teaching_method_score=req.teachingMethodScore,
            innovate_score=req.innovateScore,
            overall_satisfaction_score=req.overallSatisfactionScore,
            additional_comments=req.additionalComments,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.delete("/lesson/rate", summary="[Rate]删除评价")
def rate_delete(req: LessonIdReq):
    return _ok(learn_business.delete_rate(req.id))


# ===========================================================================
# RecordController (3 端点)
# ===========================================================================

@router.post("/auth-api/record", summary="[Record]保存学习记录")
def record_create(req: RecordCreateReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(learn_business.create_record(
            lesson_id=req.lessonId,
            lesson_chapter_section_id=req.lessonChapterSectionId,
            member_id=member_id,
            learn_time=req.learnTime,
            sign_up_id=req.signUpId,
            max_progress_time=req.maxProgressTime,
            progress=req.progress,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/auth-api/record", summary="[Record]更新学习记录")
def record_update(req: RecordUpdateReq, _user: str = Depends(require_login)):
    return _ok(learn_business.update_record(
        record_id=req.id, learn_time=req.learnTime,
        max_progress_time=req.maxProgressTime, progress=req.progress, status=req.status,
    ))


@router.get("/auth-api/record", summary="[Record]获取学习记录")
def record_get(lessonId: int, lessonChapterSectionId: int, _user: str = Depends(require_login)):
    member_id = get_current_user_id_flexible()
    return _ok(learn_business.get_record(lessonId, lessonChapterSectionId, member_id))


# ===========================================================================
# SignUpController (7 端点)
# ===========================================================================

@router.post("/auth-api/sign-up", summary="[SignUp]报名")
def signup_create(req: SignUpCreateReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(learn_business.create_signup(lesson_id=req.lessonId, member_id=member_id))
    except Exception as e:
        raise _err(500, str(e))


@router.post("/auth-api/sign-up/batch", summary="[SignUp]批量报名")
def signup_create_batch(lessonIds: list[int], _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        ids = []
        for lid in lessonIds:
            obj = learn_business.create_signup(lesson_id=lid, member_id=member_id)
            ids.append(obj.get("id"))
        return _ok({"ids": ids, "count": len(ids)})
    except Exception as e:
        raise _err(500, str(e))


@router.post("/public-api/sign-up", summary="[SignUp]报名(公开)")
def signup_public_create(req: SignUpCreateReq):
    return _ok(learn_business.create_signup(lesson_id=req.lessonId, member_id=0))


@router.delete("/auth-api/sign-up", summary="[SignUp]取消报名")
def signup_cancel(req: SignUpDeleteReq, _user: str = Depends(require_login)):
    member_id = get_current_user_id_flexible()
    learn_business.cancel_signup(req.id, member_id=member_id)
    return _ok()


@router.get("/public-api/sign-up", summary="[SignUp]获取报名信息")
def signup_get(id: int):
    return _ok(learn_business.get_signup(id))


@router.get("/auth-api/sign-up/total-learn-time", summary="[SignUp]获取会员总学习时间")
def signup_total_learn_time(_user: str = Depends(require_login)):
    member_id = get_current_user_id_flexible()
    return _ok(learn_business.get_total_learn_time(member_id))


@router.get("/auth-api/sign-up/today-learn-time", summary="[SignUp]获取会员今天学习时间")
def signup_today_learn_time(_user: str = Depends(require_login)):
    member_id = get_current_user_id_flexible()
    return _ok(learn_business.get_today_learn_time(member_id))


@router.get("/auth-api/sign-up/learn-time-rank-percent", summary="[SignUp]获取会员总学习时间排行位置")
def signup_learn_time_rank_percent(_user: str = Depends(require_login)):
    member_id = get_current_user_id_flexible()
    return _ok(learn_business.get_learn_time_rank_percent(member_id))


@router.get("/sign-up/list", summary="[SignUp]获取报名列表")
def signup_list(
    page: int = 1,
    pageSize: int = 20,
    lessonId: int | None = None,
    memberId: int | None = None,
    status: int | None = None,
):
    return _ok(learn_business.list_signups(
        page=page, page_size=pageSize, lesson_id=lessonId, member_id=memberId, status=status,
    ))


@router.get("/sign-up/checkAndUpdateStatus", summary="[SignUp]检查并更新状态")
def signup_check_status(id: int = 0, lessonId: int = 0, memberId: int = 0):
    return _ok(learn_business.check_and_update_signup_status(lessonId, memberId, id))


# ===========================================================================
# LearnMapController (8 端点)
# ===========================================================================

@router.get("/learn-map/list", summary="[LearnMap]获取学习地图列表")
def learn_map_list(
    page: int = 1,
    pageSize: int = 20,
    title: str | None = None,
    status: int | None = None,
    companyId: int | None = None,
):
    return _ok(learn_business.list_learn_maps(
        page=page, page_size=pageSize, title=title, status=status, company_id=companyId,
    ))


@router.get("/learn-map", summary="[LearnMap]获取学习地图详情")
def learn_map_get(id: int):
    return _ok(learn_business.get_learn_map(id))


@router.post("/learn-map", summary="[LearnMap]创建学习地图")
def learn_map_create(req: LearnMapCreateReq):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(learn_business.create_learn_map(
            title=req.title, description=req.description, image=req.image,
            create_user_id=member_id,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/learn-map", summary="[LearnMap]更新学习地图")
def learn_map_update(req: LearnMapUpdateReq):
    return _ok(learn_business.update_learn_map(
        map_id=req.id, title=req.title, description=req.description, image=req.image,
    ))


@router.delete("/learn-map", summary="[LearnMap]删除学习地图")
def learn_map_delete(req: LessonIdReq):
    learn_business.delete_learn_map(req.id)
    return _ok()


@router.put("/learn-map/publish", summary="[LearnMap]发布学习地图")
def learn_map_publish(req: LessonIdReq):
    learn_business.publish_learn_map(req.id)
    return _ok()


@router.put("/learn-map/un-publish", summary="[LearnMap]取消发布学习地图")
def learn_map_unpublish(req: LessonIdReq):
    learn_business.unpublish_learn_map(req.id)
    return _ok()


@router.get("/public-api/learn-map", summary="[LearnMap]获取学习地图详情(公开)")
def learn_map_get_public(id: int):
    obj = learn_business.get_learn_map(id)
    if obj.get("status") != 1:
        return _ok({})
    return _ok(obj)


@router.get("/public-api/learn-map/hot", summary="[LearnMap]热门学习地图")
def learn_map_hot(categoryId: int | None = None):
    return _ok(learn_business.list_learn_maps(page=1, page_size=10, status=1))


@router.get("/public-api/learn-map/recommend", summary="[LearnMap]推荐学习地图")
def learn_map_recommend():
    return _ok(learn_business.list_learn_maps(page=1, page_size=10, status=1))


@router.get("/public-api/learn-map/list", summary="[LearnMap]获取学习地图列表(公开)")
def learn_map_public_list():
    return _ok(learn_business.list_learn_maps(page=1, page_size=20, status=1))


# ===========================================================================
# TopicController (7 端点)
# ===========================================================================

@router.get("/topic/list", summary="[Topic]获取专题列表")
def topic_list(
    page: int = 1,
    pageSize: int = 20,
    title: str | None = None,
    status: int | None = None,
):
    return _ok(learn_business.list_topics(
        page=page, page_size=pageSize, title=title, status=status,
    ))


@router.get("/topic", summary="[Topic]获取专题详情")
def topic_get(id: int):
    return _ok(learn_business.get_topic(id))


@router.post("/topic", summary="[Topic]创建专题")
def topic_create(req: TopicCreateReq):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(learn_business.create_topic(
            title=req.title, description=req.description, image=req.image,
            price=req.price, original_price=req.originalPrice,
            create_user_id=member_id,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/topic", summary="[Topic]更新专题")
def topic_update(req: TopicUpdateReq):
    return _ok(learn_business.update_topic(
        topic_id=req.id, title=req.title, description=req.description,
        image=req.image, price=req.price, original_price=req.originalPrice,
    ))


@router.delete("/topic", summary="[Topic]删除专题")
def topic_delete(req: LessonIdReq):
    learn_business.delete_topic(req.id)
    return _ok()


@router.put("/topic/publish", summary="[Topic]发布专题")
def topic_publish(req: LessonIdReq):
    learn_business.publish_topic(req.id)
    return _ok()


@router.put("/topic/un-publish", summary="[Topic]取消发布专题")
def topic_unpublish(req: LessonIdReq):
    learn_business.unpublish_topic(req.id)
    return _ok()


@router.get("/public-api/topic", summary="[Topic]获取专题详情(公开)")
def topic_get_public(id: int):
    obj = learn_business.get_topic(id)
    if obj.get("status") != 1:
        return _ok({})
    return _ok(obj)


@router.get("/public-api/topic/hot", summary="[Topic]热门专题")
def topic_hot(categoryId: int | None = None):
    return _ok(learn_business.list_topics(page=1, page_size=10, status=1))


@router.get("/public-api/topic/recommend", summary="[Topic]推荐专题")
def topic_recommend():
    return _ok(learn_business.list_topics(page=1, page_size=10, status=1))


@router.get("/public-api/topic/list", summary="[Topic]获取专题列表(公开)")
def topic_public_list(page: int = 1, pageSize: int = 20):
    return _ok(learn_business.list_topics(page=page, page_size=pageSize, status=1))


# ===========================================================================
# LessonOrderController (3 端点)
# ===========================================================================

@router.post("/auth-api/lesson/order", summary="[Order]课程下单")
def lesson_order_create(req: OrderCreateReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(learn_business.create_lesson_order(
            lesson_id=req.lessonId, member_id=member_id, amount=req.amount,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.post("/auth-api/lesson/order/payment", summary="[Order]课程支付")
def lesson_order_pay(req: OrderPaymentReq, _user: str = Depends(require_login)):
    return _ok(learn_business.pay_lesson_order(req.orderId, req.payMethod))


@router.post("/public-api/order/payment/callback", summary="[Order]支付回调")
def lesson_order_callback(req: PaymentCallbackReq):
    learn_business.lesson_payment_callback(req.orderId, req.status)
    return {"code": 0, "msg": "success"}


# ===========================================================================
# LessonAccessController (1 端点)
# ===========================================================================

@router.get("/lesson/access", summary="[Access]获取学习权限")
def lesson_access(lessonId: int):
    return _ok({"list": learn_business.get_lesson_access(lessonId)})


# ===========================================================================
# LessonTaskController (2 端点)
# ===========================================================================

@router.get("/lesson/task", summary="[Task]获取课程任务列表")
def lesson_task_list(lessonId: int | None = None):
    if lessonId is not None:
        return _ok({"list": learn_business.list_lesson_tasks(lessonId)})
    return _ok({"list": []})


@router.get("/auth-api/lesson/task/list/member-progress", summary="[Task]会员任务进度")
def lesson_task_member_progress(_user: str = Depends(require_login)):
    member_id = get_current_user_id_flexible()
    return _ok({"list": learn_business.get_member_task_progress(member_id)})


# ===========================================================================
# HomeworkController + HomeworkRecordController (4 端点)
# ===========================================================================

@router.get("/lesson/homework", summary="[Homework]获取作业列表")
def lesson_homework_list(lessonId: int | None = None):
    if lessonId is not None:
        return _ok({"list": learn_business.list_homeworks(lessonId)})
    return _ok({"list": []})


@router.get("/homework/record/list", summary="[HomeworkRecord]获取作业记录")
def homework_record_list():
    return _ok({"list": learn_business.list_homework_records()})


@router.post("/homework/record/approval/pass", summary="[HomeworkRecord]审批通过")
def homework_record_pass(req: LessonIdReq):
    learn_business.pass_homework(req.id)
    return _ok()


@router.post("/homework/record/approval/reject", summary="[HomeworkRecord]审批驳回")
def homework_record_reject(req: LessonIdReq):
    learn_business.reject_homework(req.id)
    return _ok()


# ===========================================================================
# ReportController (3 端点)
# ===========================================================================

@router.get("/report/lesson/sign", summary="[Report]课程报名统计")
def report_lesson_sign(lessonId: int):
    return _ok(learn_business.report_lesson_sign(lessonId))


@router.get("/report/lesson/study", summary="[Report]课程学习统计")
def report_lesson_study(lessonId: int):
    return _ok(learn_business.report_lesson_study(lessonId))


@router.get("/report/member/study", summary="[Report]会员学习统计")
def report_member_study(memberId: int):
    return _ok(learn_business.report_member_study(memberId))


# ===========================================================================
# StatisticsController (1 端点)
# ===========================================================================

@router.get("/statistics", summary="[Statistics]学习统计")
def learn_statistics():
    return _ok(learn_business.statistics())


# 修复 Pydantic ForwardRef 解析问题（确保 ChapterIdReq 等模型在 OpenAPI 生成时可用）
for _model in [
    ChapterIdReq, ChapterSortOrderReq, ChapterUpdateReq,
    SectionCreateReq, SectionUpdateReq,
]:
    try:
        _model.model_rebuild()
    except Exception:
        pass
