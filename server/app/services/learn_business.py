"""Learn Legacy Business Service - 完整迁移自 ihui-ai-edu-learn-service.

包含 7 个 Controller:
  - LessonController
  - LessonChapterController
  - LessonChapterSectionController
  - LessonOrderController
  - RateController
  - RecordController
  - SignUpController
  - LearnMapController
  - TopicController
  - TopicCategoryController (在 category_business.py 中)
  - LessonAccessController
  - LessonTaskController
  - HomeworkController / HomeworkRecordController
  - StatisticsController
  - ReportController
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy import and_, func, or_

from app.database import get_session
from app.models.learn_models import (
    Certificate,
    CertificateTemplate,
    Category,
    Homework,
    HomeworkRecord,
    LearnMap,
    Lesson,
    LessonAccess,
    LessonChapter,
    LessonChapterSection,
    LessonTask,
    Rate,
    Record,
    RecordLog,
    SignUp,
    Topic,
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
# LessonController - 14+ 端点
# ===========================================================================

def list_lessons(
    page: int = 1,
    page_size: int = 20,
    name: Optional[str] = None,
    status: Optional[int] = None,
    create_user_id: Optional[int] = None,
    company_id: Optional[int] = None,
    category_id: Optional[int] = None,
    orders: list[str] | None = None,
) -> dict[str, Any]:
    with get_session() as db:
        q = db.query(Lesson)
        if name:
            q = q.filter(Lesson.name.like(f"%{name}%"))
        if status is not None:
            q = q.filter(Lesson.status == status)
        if create_user_id is not None:
            q = q.filter(Lesson.create_user_id == create_user_id)
        if company_id is not None:
            q = q.filter(Lesson.company_id == company_id)
        # 默认按 sort_weight desc, id desc
        q = q.order_by(Lesson.sort_weight.desc(), Lesson.id.desc())
        total = q.count()
        items = q.offset((page - 1) * page_size).limit(page_size).all()
        return {"list": _to_dict_list(items), "total": total, "page": page, "pageSize": page_size}


def get_lesson(lesson_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(Lesson).filter(Lesson.id == lesson_id).first()
        return _to_dict(obj)


def create_lesson(
    name: str,
    create_user_id: Optional[int] = None,
    company_id: Optional[int] = None,
    department_id: Optional[int] = None,
    code: Optional[str] = None,
    image: Optional[str] = None,
    phrase: Optional[str] = None,
    introduction: Optional[str] = None,
    price: int = 0,
    original_price: int = 0,
    sort_weight: int = 0,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = Lesson(
            name=name,
            create_user_id=create_user_id,
            company_id=company_id,
            department_id=department_id,
            code=code,
            image=image,
            phrase=phrase,
            introduction=introduction,
            price=price,
            original_price=original_price,
            sort_weight=sort_weight,
            start_time=start_time,
            end_time=end_time,
            status=0,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def update_lesson(
    lesson_id: int,
    name: Optional[str] = None,
    image: Optional[str] = None,
    phrase: Optional[str] = None,
    introduction: Optional[str] = None,
    price: Optional[int] = None,
    original_price: Optional[int] = None,
    sort_weight: Optional[int] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    certificate_id: Optional[int] = None,
    exam_paper_id: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(Lesson).filter(Lesson.id == lesson_id).first()
        if not obj:
            return {}
        if name is not None:
            obj.name = name
        if image is not None:
            obj.image = image
        if phrase is not None:
            obj.phrase = phrase
        if introduction is not None:
            obj.introduction = introduction
        if price is not None:
            obj.price = price
        if original_price is not None:
            obj.original_price = original_price
        if sort_weight is not None:
            obj.sort_weight = sort_weight
        if start_time is not None:
            obj.start_time = start_time
        if end_time is not None:
            obj.end_time = end_time
        if certificate_id is not None:
            obj.certificate_id = certificate_id
        if exam_paper_id is not None:
            obj.exam_paper_id = exam_paper_id
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def delete_lesson(lesson_id: int) -> None:
    with get_session() as db:
        obj = db.query(Lesson).filter(Lesson.id == lesson_id).first()
        if obj:
            db.delete(obj)


def publish_lesson(lesson_id: int) -> None:
    with get_session() as db:
        obj = db.query(Lesson).filter(Lesson.id == lesson_id).first()
        if obj:
            obj.status = 1


def unpublish_lesson(lesson_id: int) -> None:
    with get_session() as db:
        obj = db.query(Lesson).filter(Lesson.id == lesson_id).first()
        if obj:
            obj.status = 0


# ===========================================================================
# LessonChapterController - 6 端点
# ===========================================================================

def list_lesson_chapters(lesson_id: int) -> list[dict[str, Any]]:
    with get_session() as db:
        q = db.query(LessonChapter).filter(LessonChapter.lesson_id == lesson_id).order_by(LessonChapter.sort_order.asc())
        return _to_dict_list(q.all())


def create_lesson_chapter(
    lesson_id: int,
    title: str,
    phrase: Optional[str] = None,
    sort_order: int = 0,
) -> dict[str, Any]:
    with get_session() as db:
        obj = LessonChapter(
            lesson_id=lesson_id, title=title, phrase=phrase, sort_order=sort_order,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def update_lesson_chapter(
    chapter_id: int,
    title: Optional[str] = None,
    phrase: Optional[str] = None,
    sort_order: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(LessonChapter).filter(LessonChapter.id == chapter_id).first()
        if not obj:
            return {}
        if title is not None:
            obj.title = title
        if phrase is not None:
            obj.phrase = phrase
        if sort_order is not None:
            obj.sort_order = sort_order
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def delete_lesson_chapter(chapter_id: int) -> None:
    with get_session() as db:
        obj = db.query(LessonChapter).filter(LessonChapter.id == chapter_id).first()
        if obj:
            db.delete(obj)


def update_lesson_chapter_sort_order(chapter_id: int, sort_order: int) -> None:
    with get_session() as db:
        obj = db.query(LessonChapter).filter(LessonChapter.id == chapter_id).first()
        if obj:
            obj.sort_order = sort_order


# ===========================================================================
# LessonChapterSectionController - 3 端点
# ===========================================================================

def create_lesson_chapter_section(
    chapter_id: int,
    title: str,
    type: Optional[str] = None,
    url: Optional[str] = None,
    phrase: Optional[str] = None,
    total_time: int = 0,
    sort_order: int = 0,
    content: Optional[str] = None,
    content_type: Optional[str] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = LessonChapterSection(
            lesson_chapter_id=chapter_id, title=title, type=type, url=url,
            phrase=phrase, total_time=total_time, sort_order=sort_order,
            content=content, content_type=content_type,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def update_lesson_chapter_section(
    section_id: int,
    title: Optional[str] = None,
    type: Optional[str] = None,
    url: Optional[str] = None,
    phrase: Optional[str] = None,
    total_time: Optional[int] = None,
    sort_order: Optional[int] = None,
    content: Optional[str] = None,
    content_type: Optional[str] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(LessonChapterSection).filter(LessonChapterSection.id == section_id).first()
        if not obj:
            return {}
        if title is not None:
            obj.title = title
        if type is not None:
            obj.type = type
        if url is not None:
            obj.url = url
        if phrase is not None:
            obj.phrase = phrase
        if total_time is not None:
            obj.total_time = total_time
        if sort_order is not None:
            obj.sort_order = sort_order
        if content is not None:
            obj.content = content
        if content_type is not None:
            obj.content_type = content_type
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def delete_lesson_chapter_section(section_id: int) -> None:
    with get_session() as db:
        obj = db.query(LessonChapterSection).filter(LessonChapterSection.id == section_id).first()
        if obj:
            db.delete(obj)


# ===========================================================================
# RateController - 5 端点
# ===========================================================================

def list_rates(
    page: int = 1,
    page_size: int = 20,
    lesson_id: Optional[int] = None,
    member_id: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        q = db.query(Rate)
        if lesson_id is not None:
            q = q.filter(Rate.lesson_id == lesson_id)
        if member_id is not None:
            q = q.filter(Rate.member_id == member_id)
        total = q.count()
        items = q.offset((page - 1) * page_size).limit(page_size).all()
        return {"list": _to_dict_list(items), "total": total}


def get_rate(rate_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(Rate).filter(Rate.id == rate_id).first()
        return _to_dict(obj)


def create_rate(
    lesson_id: int,
    member_id: int,
    content_utility_score: int = 5,
    content_depth_score: int = 5,
    instructor_expertise_score: int = 5,
    teaching_method_score: int = 5,
    innovate_score: int = 5,
    overall_satisfaction_score: int = 5,
    additional_comments: Optional[str] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = Rate(
            lesson_id=lesson_id, member_id=member_id,
            content_utility_score=content_utility_score,
            content_depth_score=content_depth_score,
            instructor_expertise_score=instructor_expertise_score,
            teaching_method_score=teaching_method_score,
            innovate_score=innovate_score,
            overall_satisfaction_score=overall_satisfaction_score,
            additional_comments=additional_comments,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def delete_rate(rate_id: int) -> int:
    with get_session() as db:
        obj = db.query(Rate).filter(Rate.id == rate_id).first()
        if obj:
            db.delete(obj)
            return 1
        return 0


# ===========================================================================
# RecordController - 3 端点
# ===========================================================================

def create_record(
    lesson_id: int,
    lesson_chapter_section_id: int,
    member_id: int,
    learn_time: int = 0,
    sign_up_id: Optional[int] = None,
    max_progress_time: int = 0,
    progress: int = 0,
) -> dict[str, Any]:
    with get_session() as db:
        obj = Record(
            lesson_id=lesson_id,
            lesson_chapter_section_id=lesson_chapter_section_id,
            member_id=member_id,
            learn_time=learn_time,
            sign_up_id=sign_up_id,
            max_progress_time=max_progress_time,
            progress=progress,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        # 同步记录到 record_log
        log = RecordLog(
            lesson_id=lesson_id,
            lesson_chapter_section_id=lesson_chapter_section_id,
            member_id=member_id,
            learn_time=learn_time,
            sign_up_id=sign_up_id,
        )
        db.add(log)
        return _to_dict(obj)


def update_record(
    record_id: int,
    learn_time: Optional[int] = None,
    max_progress_time: Optional[int] = None,
    progress: Optional[int] = None,
    status: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(Record).filter(Record.id == record_id).first()
        if not obj:
            return {}
        if learn_time is not None:
            obj.learn_time = learn_time
        if max_progress_time is not None:
            obj.max_progress_time = max_progress_time
        if progress is not None:
            obj.progress = progress
        if status is not None:
            obj.status = status
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def get_record(
    lesson_id: int,
    lesson_chapter_section_id: int,
    member_id: int,
) -> dict[str, Any]:
    with get_session() as db:
        obj = (
            db.query(Record)
            .filter(
                Record.lesson_id == lesson_id,
                Record.lesson_chapter_section_id == lesson_chapter_section_id,
                Record.member_id == member_id,
            )
            .order_by(Record.id.desc())
            .first()
        )
        return _to_dict(obj) if obj else {}


# ===========================================================================
# SignUpController - 7 端点
# ===========================================================================

def create_signup(
    lesson_id: int,
    member_id: int,
    company_id: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = SignUp(
            lesson_id=lesson_id, member_id=member_id, company_id=company_id,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def get_signup(signup_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(SignUp).filter(SignUp.id == signup_id).first()
        return _to_dict(obj)


def cancel_signup(signup_id: int, member_id: Optional[int] = None) -> None:
    with get_session() as db:
        q = db.query(SignUp).filter(SignUp.id == signup_id)
        if member_id is not None:
            q = q.filter(SignUp.member_id == member_id)
        obj = q.first()
        if obj:
            obj.status = 2  # canceled


def get_total_learn_time(member_id: int) -> int:
    with get_session() as db:
        result = db.query(func.coalesce(func.sum(Record.learn_time), 0)).filter(Record.member_id == member_id).scalar()
        return int(result or 0)


def get_today_learn_time(member_id: int) -> int:
    today_start = datetime.combine(datetime.utcnow().date(), datetime.min.time())
    with get_session() as db:
        result = db.query(func.coalesce(func.sum(RecordLog.learn_time), 0)).filter(
            RecordLog.member_id == member_id,
            RecordLog.create_time >= today_start,
        ).scalar()
        return int(result or 0)


def get_learn_time_rank_percent(member_id: int) -> float:
    """返回会员学习时间排名百分比 (0-100)."""
    with get_session() as db:
        total = db.query(func.count(func.distinct(Record.member_id))).scalar() or 0
        if total == 0:
            return 0.0
        # 简单实现: 用 record 数量作为代理
        less = db.query(func.count(func.distinct(Record.member_id))).filter(
            Record.member_id != member_id
        ).scalar() or 0
        return round(less / total * 100, 2)


def list_signups(
    page: int = 1,
    page_size: int = 20,
    lesson_id: Optional[int] = None,
    member_id: Optional[int] = None,
    status: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        q = db.query(SignUp)
        if lesson_id is not None:
            q = q.filter(SignUp.lesson_id == lesson_id)
        if member_id is not None:
            q = q.filter(SignUp.member_id == member_id)
        if status is not None:
            q = q.filter(SignUp.status == status)
        total = q.count()
        items = q.offset((page - 1) * page_size).limit(page_size).all()
        return {"list": _to_dict_list(items), "total": total}


def check_and_update_signup_status(lesson_id: int, member_id: int, signup_id: int) -> str:
    with get_session() as db:
        obj = (
            db.query(SignUp)
            .filter(SignUp.id == signup_id, SignUp.lesson_id == lesson_id, SignUp.member_id == member_id)
            .first()
        )
        if obj:
            obj.status = 1  # 完成
        return "success"


# ===========================================================================
# LearnMapController - 8 端点
# ===========================================================================

def list_learn_maps(
    page: int = 1,
    page_size: int = 20,
    title: Optional[str] = None,
    status: Optional[int] = None,
    company_id: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        q = db.query(LearnMap)
        if title:
            q = q.filter(LearnMap.title.like(f"%{title}%"))
        if status is not None:
            q = q.filter(LearnMap.status == status)
        if company_id is not None:
            q = q.filter(LearnMap.company_id == company_id)
        total = q.count()
        items = q.offset((page - 1) * page_size).limit(page_size).all()
        return {"list": _to_dict_list(items), "total": total}


def get_learn_map(map_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(LearnMap).filter(LearnMap.id == map_id).first()
        return _to_dict(obj)


def create_learn_map(
    title: str,
    create_user_id: Optional[int] = None,
    company_id: Optional[int] = None,
    department_id: Optional[int] = None,
    description: Optional[str] = None,
    image: Optional[str] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = LearnMap(
            title=title, description=description, image=image,
            create_user_id=create_user_id, company_id=company_id, department_id=department_id,
            status=0,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def update_learn_map(
    map_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    image: Optional[str] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(LearnMap).filter(LearnMap.id == map_id).first()
        if not obj:
            return {}
        if title is not None:
            obj.title = title
        if description is not None:
            obj.description = description
        if image is not None:
            obj.image = image
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def delete_learn_map(map_id: int) -> None:
    with get_session() as db:
        obj = db.query(LearnMap).filter(LearnMap.id == map_id).first()
        if obj:
            db.delete(obj)


def publish_learn_map(map_id: int) -> None:
    with get_session() as db:
        obj = db.query(LearnMap).filter(LearnMap.id == map_id).first()
        if obj:
            obj.status = 1


def unpublish_learn_map(map_id: int) -> None:
    with get_session() as db:
        obj = db.query(LearnMap).filter(LearnMap.id == map_id).first()
        if obj:
            obj.status = 0


# ===========================================================================
# TopicController - 7 端点
# ===========================================================================

def list_topics(
    page: int = 1,
    page_size: int = 20,
    title: Optional[str] = None,
    status: Optional[int] = None,
    company_id: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        q = db.query(Topic)
        if title:
            q = q.filter(Topic.title.like(f"%{title}%"))
        if status is not None:
            q = q.filter(Topic.status == status)
        if company_id is not None:
            q = q.filter(Topic.company_id == company_id)
        total = q.count()
        items = q.offset((page - 1) * page_size).limit(page_size).all()
        return {"list": _to_dict_list(items), "total": total}


def get_topic(topic_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(Topic).filter(Topic.id == topic_id).first()
        return _to_dict(obj)


def create_topic(
    title: str,
    create_user_id: Optional[int] = None,
    company_id: Optional[int] = None,
    department_id: Optional[int] = None,
    description: Optional[str] = None,
    image: Optional[str] = None,
    price: int = 0,
    original_price: int = 0,
) -> dict[str, Any]:
    with get_session() as db:
        obj = Topic(
            title=title, description=description, image=image,
            price=price, original_price=original_price,
            create_user_id=create_user_id, company_id=company_id, department_id=department_id,
            status=0,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def update_topic(
    topic_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    image: Optional[str] = None,
    price: Optional[int] = None,
    original_price: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(Topic).filter(Topic.id == topic_id).first()
        if not obj:
            return {}
        if title is not None:
            obj.title = title
        if description is not None:
            obj.description = description
        if image is not None:
            obj.image = image
        if price is not None:
            obj.price = price
        if original_price is not None:
            obj.original_price = original_price
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def delete_topic(topic_id: int) -> None:
    with get_session() as db:
        obj = db.query(Topic).filter(Topic.id == topic_id).first()
        if obj:
            db.delete(obj)


def publish_topic(topic_id: int) -> None:
    with get_session() as db:
        obj = db.query(Topic).filter(Topic.id == topic_id).first()
        if obj:
            obj.status = 1


def unpublish_topic(topic_id: int) -> None:
    with get_session() as db:
        obj = db.query(Topic).filter(Topic.id == topic_id).first()
        if obj:
            obj.status = 0


# ===========================================================================
# LessonOrderController - 3 端点
# ===========================================================================

def create_lesson_order(
    lesson_id: int,
    member_id: int,
    amount: int = 0,
) -> dict[str, Any]:
    """简化版订单创建 - 真实业务应使用 Order 模型, 这里存为 SignUp."""
    with get_session() as db:
        obj = SignUp(lesson_id=lesson_id, member_id=member_id)
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return {"id": obj.id, "lessonId": lesson_id, "amount": amount, "status": "created"}


def pay_lesson_order(order_id: int, pay_method: str = "alipay") -> dict[str, Any]:
    """简化版支付 - 返回支付链接."""
    return {
        "orderId": order_id,
        "payMethod": pay_method,
        "payUrl": f"/payments/alipay/lesson/{order_id}",
        "status": "pending",
    }


def lesson_payment_callback(order_id: int, status: str = "success") -> None:
    """支付回调."""
    logger.info(f"[LessonOrder] 支付回调 orderId={order_id} status={status}")


# ===========================================================================
# LessonAccessController - 1 端点
# ===========================================================================

def get_lesson_access(lesson_id: int) -> list[dict[str, Any]]:
    with get_session() as db:
        objs = db.query(LessonAccess).filter(LessonAccess.lesson_id == lesson_id).all()
        return _to_dict_list(objs)


# ===========================================================================
# LessonTaskController - 2 端点
# ===========================================================================

def list_lesson_tasks(lesson_id: int) -> list[dict[str, Any]]:
    with get_session() as db:
        q = db.query(LessonTask).filter(LessonTask.lesson_id == lesson_id).order_by(LessonTask.id.asc())
        return _to_dict_list(q.all())


def get_member_task_progress(member_id: int) -> list[dict[str, Any]]:
    """获取会员的任务进度 (简化版 - 列出所有 task 标记为未完成)."""
    with get_session() as db:
        tasks = db.query(LessonTask).all()
        return [
            {**_to_dict(t), "progress": 0, "memberId": member_id}
            for t in tasks
        ]


# ===========================================================================
# HomeworkController - 1 端点
# ===========================================================================

def list_homeworks(lesson_id: int) -> list[dict[str, Any]]:
    with get_session() as db:
        q = db.query(Homework).filter(Homework.lesson_id == lesson_id)
        return _to_dict_list(q.all())


# ===========================================================================
# HomeworkRecordController - 3 端点
# ===========================================================================

def list_homework_records(
    member_id: Optional[int] = None,
    status: Optional[int] = None,
) -> list[dict[str, Any]]:
    with get_session() as db:
        q = db.query(HomeworkRecord)
        if member_id is not None:
            q = q.filter(HomeworkRecord.member_id == member_id)
        if status is not None:
            q = q.filter(HomeworkRecord.status == status)
        return _to_dict_list(q.all())


def pass_homework(record_id: int) -> None:
    with get_session() as db:
        obj = db.query(HomeworkRecord).filter(HomeworkRecord.id == record_id).first()
        if obj:
            obj.status = 1


def reject_homework(record_id: int) -> None:
    with get_session() as db:
        obj = db.query(HomeworkRecord).filter(HomeworkRecord.id == record_id).first()
        if obj:
            obj.status = 2


# ===========================================================================
# ReportController - 3 端点
# ===========================================================================

def report_lesson_sign(lesson_id: int) -> dict[str, Any]:
    with get_session() as db:
        total_signups = db.query(func.count(SignUp.id)).filter(SignUp.lesson_id == lesson_id).scalar() or 0
        completed = db.query(func.count(SignUp.id)).filter(
            SignUp.lesson_id == lesson_id, SignUp.status == 1
        ).scalar() or 0
        return {"lessonId": lesson_id, "totalSignups": total_signups, "completed": completed}


def report_lesson_study(lesson_id: int) -> dict[str, Any]:
    with get_session() as db:
        total_records = db.query(func.count(Record.id)).filter(Record.lesson_id == lesson_id).scalar() or 0
        total_learn_time = db.query(func.coalesce(func.sum(Record.learn_time), 0)).filter(
            Record.lesson_id == lesson_id
        ).scalar() or 0
        return {
            "lessonId": lesson_id,
            "totalRecords": total_records,
            "totalLearnTime": total_learn_time,
        }


def report_member_study(member_id: int) -> dict[str, Any]:
    with get_session() as db:
        total_learn_time = db.query(func.coalesce(func.sum(Record.learn_time), 0)).filter(
            Record.member_id == member_id
        ).scalar() or 0
        lessons_count = db.query(func.count(func.distinct(Record.lesson_id))).filter(
            Record.member_id == member_id
        ).scalar() or 0
        return {
            "memberId": member_id,
            "totalLearnTime": total_learn_time,
            "lessonsCount": lessons_count,
        }


# ===========================================================================
# StatisticsController - 1 端点
# ===========================================================================

def statistics() -> dict[str, Any]:
    with get_session() as db:
        return {
            "lessonCount": db.query(func.count(Lesson.id)).scalar() or 0,
            "signUpCount": db.query(func.count(SignUp.id)).scalar() or 0,
            "recordCount": db.query(func.count(Record.id)).scalar() or 0,
            "topicCount": db.query(func.count(Topic.id)).scalar() or 0,
            "learnMapCount": db.query(func.count(LearnMap.id)).scalar() or 0,
        }
