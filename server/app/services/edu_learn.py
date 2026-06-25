"""edu_learn service - Course learning (migrated from ihui-ai-edu-learn-service).

Source: G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-learn-service\\
Original package: com.yjs.cloud.learning.learn
Controllers: CourseController, ChapterController, SectionController, LearnRecordController,
             HomeworkController, CertificateController
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime
from typing import Optional, List, Dict, Tuple, Any

from app.utils.datetime_helper import utcnow

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import Session

from app.models.edu_models import (
    EduCourse, EduCourseChapter, EduCourseSection, EduLearnRecord,
    EduHomework, EduHomeworkSubmission, EduCertificate,
)
from app.services.edu_base import (
    EduPermissionError, EduValidationError,
    paginate, get_or_404,
)

logger = logging.getLogger(__name__)


# ============================================================================
# Course CRUD (迁移自 CourseController)
# ============================================================================

def create_course(
    db: Session, teacher_id: int, title: str, **fields
) -> EduCourse:
    """Create a new course.

    2026-06-25 字段对齐修复: teacher_id→create_user_id, title→name, subtitle→phrase,
    cover→image, description→introduction, is_published→status=1, 其余 Phase A 字段删除.
    """
    if not title or len(title) > 256:
        raise EduValidationError("title must be 1-256 chars")
    course = EduCourse(
        create_user_id=teacher_id,
        name=title,
        phrase=fields.get("subtitle"),
        image=fields.get("cover"),
        introduction=fields.get("description"),
        status=1,
    )
    db.add(course)
    db.flush()
    db.refresh(course)
    return course


def update_course(db: Session, course_id: int, teacher_id: int, **fields) -> EduCourse:
    """Update course (teacher only).

    2026-06-25 字段对齐修复: c.teacher_id→c.create_user_id; allowed 字段对齐真实列名;
    移除不存在的 published_at 逻辑.
    """
    c = get_or_404(db, EduCourse, course_id, "course")
    if c.create_user_id != teacher_id:
        raise EduPermissionError("only the teacher can update the course")
    allowed = {"name", "phrase", "introduction", "image"}
    for k, v in fields.items():
        if k in allowed and v is not None:
            setattr(c, k, v)
    db.flush()
    db.refresh(c)
    return c


def delete_course(db: Session, course_id: int, teacher_id: int) -> bool:
    """Delete course (soft delete via status=2).

    2026-06-25 字段对齐修复: c.is_deleted/c.deleted_at → c.status=2;
    权限检查 c.teacher_id→c.create_user_id (Lesson 无软删除列).
    """
    c = get_or_404(db, EduCourse, course_id, "course")
    if c.create_user_id != teacher_id:
        raise EduPermissionError("only the teacher can delete the course")
    c.status = 2
    db.flush()
    return True


def get_course(db: Session, course_id: int) -> EduCourse:
    return get_or_404(db, EduCourse, course_id, "course")


def increment_student_count(db: Session, course_id: int) -> EduCourse:
    """Increment student_count when a new enrollment happens.

    2026-06-25 字段对齐修复: Lesson 无 student_count 列, 函数改为 noop (pass + logger.warning).
    保留签名以兼容 edu/learn.py 路由调用.
    """
    logger.warning("increment_student_count noop: Lesson has no student_count column, course_id=%s", course_id)
    return None


def list_courses(
    db: Session, page: int = 1, size: int = 20,
    category_id: Optional[int] = None, teacher_id: Optional[int] = None,
    is_free: Optional[bool] = None, is_published: Optional[bool] = None,
    keyword: Optional[str] = None, order_by: str = "latest",
) -> Tuple[List[EduCourse], int]:
    """List courses with filters.

    2026-06-25 字段对齐修复 v2:
    - 过滤 teacher_id→create_user_id, is_published→status==1
    - 关键字 name/phrase/introduction
    - Lesson 表无 score/category_id 列:
      * category_id 过滤已删除 (业务上无对应列, 若需分类需走 LessonCategoryRelation 关联表)
      * rating 排序改用 sort_weight (真实存在的排序权重列)
    """
    filters = []
    # category_id: Lesson 无对应列, 忽略参数 (避免运行时 AttributeError)
    if teacher_id is not None:
        filters.append(EduCourse.create_user_id == teacher_id)
    if is_published is not None:
        filters.append(EduCourse.status == 1 if is_published else EduCourse.status != 1)
    if keyword:
        kw = f"%{keyword}%"
        filters.append(or_(EduCourse.name.ilike(kw), EduCourse.phrase.ilike(kw), EduCourse.introduction.ilike(kw)))
    if order_by == "rating":
        # Lesson 无 score 列, 改用 sort_weight 排序权重
        order = desc(EduCourse.sort_weight)
    else:
        order = desc(EduCourse.created_at)
    return paginate(db, EduCourse, page=page, size=size, filters=filters, order_by=order)


# ============================================================================
# Chapter CRUD (迁移自 ChapterController)
# ============================================================================

def create_chapter(db: Session, course_id: int, title: str, **fields) -> EduCourseChapter:
    """Create chapter.

    2026-06-25 字段对齐修复: course_id→lesson_id, description→phrase, 删除 parent_id.
    """
    if not title:
        raise EduValidationError("title required")
    chapter = EduCourseChapter(
        lesson_id=course_id,
        title=title,
        phrase=fields.get("description"),
        sort_order=fields.get("sort_order", 0),
    )
    db.add(chapter)
    db.flush()
    db.refresh(chapter)
    return chapter


def list_chapters(db: Session, course_id: int) -> List[EduCourseChapter]:
    """List chapters of a course.

    2026-06-25 字段对齐修复: course_id→lesson_id.
    """
    return list(db.execute(
        select(EduCourseChapter).where(EduCourseChapter.lesson_id == course_id)
        .order_by(EduCourseChapter.sort_order, EduCourseChapter.id)
    ).scalars().all())


def delete_chapter(db: Session, chapter_id: int) -> bool:
    ch = get_or_404(db, EduCourseChapter, chapter_id, "chapter")
    db.delete(ch)
    db.flush()
    return True


# ============================================================================
# Section CRUD (迁移自 SectionController)
# ============================================================================

def create_section(db: Session, chapter_id: int, title: str, **fields) -> EduCourseSection:
    """Create section.

    2026-06-25 字段对齐修复: chapter_id→lesson_chapter_id, video_url→url,
    duration_seconds→total_time, 删除 course_id/resource_url/is_free_preview;
    删除 course.lesson_count/duration_minutes 更新 (LessonChapter 无 course_id, Lesson 无相应列).
    """
    if not title:
        raise EduValidationError("title required")
    section = EduCourseSection(
        lesson_chapter_id=chapter_id,
        title=title,
        url=fields.get("video_url"),
        total_time=fields.get("duration_seconds", 0),
        sort_order=fields.get("sort_order", 0),
    )
    db.add(section)
    db.flush()
    db.refresh(section)
    return section


def list_sections(db: Session, chapter_id: int) -> List[EduCourseSection]:
    """List sections of a chapter.

    2026-06-25 字段对齐修复: chapter_id→lesson_chapter_id.
    """
    return list(db.execute(
        select(EduCourseSection).where(EduCourseSection.lesson_chapter_id == chapter_id)
        .order_by(EduCourseSection.sort_order, EduCourseSection.id)
    ).scalars().all())


# ============================================================================
# Learn Record (迁移自 LearnRecordController)
# ============================================================================

def update_progress(
    db: Session, user_id: int, course_id: int,
    section_id: Optional[int], progress_seconds: int, total_seconds: int,
    last_position: Optional[int] = None,
) -> EduLearnRecord:
    """Update learning progress for a user/course/section.

    2026-06-25 字段对齐修复: course_id→lesson_id, section_id→lesson_chapter_section_id,
    progress_seconds→learn_time, total_seconds→max_progress_time, progress_percent→progress,
    is_completed→status=1, last_position 删除, completed_at 删除 (无此列).
    """
    if total_seconds <= 0:
        raise EduValidationError("total_seconds must be > 0")
    progress_percent = min(100.0, (progress_seconds / total_seconds) * 100)
    is_completed = progress_percent >= 95.0  # 95% considered complete
    progress_val = int(round(progress_percent))

    record = db.execute(
        select(EduLearnRecord).where(
            and_(
                EduLearnRecord.member_id == user_id,
                EduLearnRecord.lesson_id == course_id,
                EduLearnRecord.lesson_chapter_section_id == section_id,
            )
        )
    ).scalar_one_or_none()

    if not record:
        record = EduLearnRecord(
            member_id=user_id,
            lesson_id=course_id,
            lesson_chapter_section_id=section_id,
            learn_time=progress_seconds,
            max_progress_time=total_seconds,
            progress=progress_val,
            status=1 if is_completed else 0,
        )
        db.add(record)
    else:
        record.learn_time = max(record.learn_time or 0, progress_seconds)
        record.max_progress_time = total_seconds
        record.progress = progress_val
        if is_completed and record.status != 1:
            record.status = 1
    db.flush()
    db.refresh(record)
    return record


def get_user_progress(db: Session, user_id: int, course_id: int) -> List[EduLearnRecord]:
    """Get all learn records for a user in a course.

    2026-06-25 字段对齐修复: course_id→lesson_id; 排序 section_id→lesson_chapter_section_id.
    """
    return list(db.execute(
        select(EduLearnRecord).where(
            and_(EduLearnRecord.member_id == user_id, EduLearnRecord.lesson_id == course_id)
        ).order_by(EduLearnRecord.lesson_chapter_section_id)
    ).scalars().all())


def get_course_completion(
    db: Session, user_id: int, course_id: int
) -> dict:
    """Get course completion summary for a user.

    2026-06-25 字段对齐修复: EduCourseSection 无 course_id, 改为通过 EduCourseChapter 反查;
    EduLearnRecord.course_id→lesson_id, is_completed→status==1.
    """
    chapter_ids_subq = select(EduCourseChapter.id).where(EduCourseChapter.lesson_id == course_id)
    total = db.execute(
        select(func.count(EduCourseSection.id)).where(
            EduCourseSection.lesson_chapter_id.in_(chapter_ids_subq)
        )
    ).scalar() or 0
    completed = db.execute(
        select(func.count(EduLearnRecord.id)).where(
            and_(
                EduLearnRecord.member_id == user_id,
                EduLearnRecord.lesson_id == course_id,
                EduLearnRecord.status == 1,
            )
        )
    ).scalar() or 0
    return {
        "user_id": user_id,
        "course_id": course_id,
        "total_sections": total,
        "completed_sections": completed,
        "completion_percent": (completed / total * 100) if total > 0 else 0,
    }


# ============================================================================
# Homework (迁移自 HomeworkController)
# ============================================================================

def create_homework(
    db: Session, course_id: int, title: str, **fields
) -> EduHomework:
    """创建作业.

    2026-06-25 字段对齐修复:
    Homework 真实字段仅为 lesson_id/content/url, 旧签名 course_id/title/description/deadline/max_score
    全部不存在. 修复策略: course_id→lesson_id, title→content, 其余字段忽略.
    """
    if not title:
        raise EduValidationError("title required")
    hw = EduHomework(
        lesson_id=course_id,
        content=title,
        url=fields.get("url"),
    )
    db.add(hw)
    db.flush()
    db.refresh(hw)
    return hw


def submit_homework(
    db: Session, homework_id: int, user_id: int, content: Optional[str], attachment_url: Optional[str]
) -> EduHomeworkSubmission:
    """提交作业.

    2026-06-25 字段对齐修复:
    HomeworkRecord (EduHomeworkSubmission) 真实字段为 lesson_id/member_id/url/sign_up_id/status.
    旧参数 homework_id→lesson_id (经 Homework 表反查), content 丢弃 (无对应列),
    attachment_url→url. sign_up_id 由 fields 调用时可选传入.
    """
    hw = get_or_404(db, EduHomework, homework_id, "homework")
    sub = EduHomeworkSubmission(
        lesson_id=hw.lesson_id,
        member_id=user_id,
        url=attachment_url,
        status=0,
    )
    db.add(sub)
    db.flush()
    db.refresh(sub)
    return sub


def grade_submission(
    db: Session, submission_id: int, grader_id: int, score: int, comment: Optional[str] = None
) -> EduHomeworkSubmission:
    """审批作业.

    2026-06-25 字段对齐修复:
    HomeworkRecord 仅有 status (0=待审批 1=通过 2=驳回), 没有 score/comment/grader_id/graded_at.
    修复策略: score>=60 视为通过 (status=1), 否则驳回 (status=2); comment/grader_id/graded_at 丢弃.
    """
    if score < 0 or score > 100:
        raise EduValidationError("score must be 0-100")
    sub = get_or_404(db, EduHomeworkSubmission, submission_id, "submission")
    sub.status = 1 if score >= 60 else 2
    db.flush()
    db.refresh(sub)
    return sub


# ============================================================================
# Certificate (迁移自 CertificateController)
# ============================================================================

def issue_certificate(
    db: Session, user_id: int, course_id: int, title: str, score: Optional[float] = None
) -> EduCertificate:
    """Issue a certificate after course completion.

    2026-06-25 字段对齐修复: course_id→lesson_id, certificate_no→code, title→name, issue_date→award_date.
    """
    completion = get_course_completion(db, user_id, course_id)
    if completion["completion_percent"] < 100:
        raise EduValidationError("course not completed")
    existing = db.execute(
        select(EduCertificate).where(
            and_(EduCertificate.member_id == user_id, EduCertificate.lesson_id == course_id)
        )
    ).scalar_one_or_none()
    if existing:
        return existing
    cert = EduCertificate(
        member_id=user_id,
        lesson_id=course_id,
        code=f"CERT{datetime.now().strftime('%Y%m%d')}{secrets.token_hex(4).upper()}",
        name=title,
        award_date=utcnow(),
        score=score,
    )
    db.add(cert)
    db.flush()
    db.refresh(cert)
    return cert


def list_user_certificates(db: Session, user_id: int = None, user_uuid: str = None) -> List[EduCertificate]:
    """List certificates of a user.

    2026-06-25 字段对齐修复: issue_date→award_date (排序字段).
    """
    return list(db.execute(
        select(EduCertificate).where(EduCertificate.member_id == user_id)
        .order_by(desc(EduCertificate.award_date))
    ).scalars().all())
