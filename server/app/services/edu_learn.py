"""edu_learn service - Course learning (migrated from ihui-ai-edu-learn-service).

Source: G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-learn-service\\
Original package: com.yjs.cloud.learning.learn
Controllers: CourseController, ChapterController, SectionController, LearnRecordController,
             HomeworkController, CertificateController
"""

from __future__ import annotations

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


# ============================================================================
# Course CRUD (迁移自 CourseController)
# ============================================================================

def create_course(
    db: Session, teacher_id: int, title: str, **fields
) -> EduCourse:
    """Create a new course."""
    if not title or len(title) > 256:
        raise EduValidationError("title must be 1-256 chars")
    course = EduCourse(
        teacher_id=teacher_id, title=title,
        subtitle=fields.get("subtitle"),
        cover=fields.get("cover"),
        description=fields.get("description"),
        category_id=fields.get("category_id"),
        price=fields.get("price", 0),
        original_price=fields.get("original_price"),
        difficulty=fields.get("difficulty", "beginner"),
        is_free=fields.get("is_free", False),
        is_published=False,
        student_count=0,
        lesson_count=0,
        duration_minutes=0,
        rating=0,
    )
    db.add(course)
    db.flush()
    db.refresh(course)
    return course


def update_course(db: Session, course_id: int, teacher_id: int, **fields) -> EduCourse:
    """Update course (teacher only)."""
    c = get_or_404(db, EduCourse, course_id, "course")
    if c.teacher_id != teacher_id:
        raise EduPermissionError("only the teacher can update the course")
    allowed = {"title", "subtitle", "description", "cover", "price",
               "original_price", "difficulty", "is_free", "is_published", "category_id"}
    for k, v in fields.items():
        if k in allowed and v is not None:
            setattr(c, k, v)
    if fields.get("is_published") and not c.published_at:
        c.published_at = utcnow()
    db.flush()
    db.refresh(c)
    return c


def delete_course(db: Session, course_id: int, teacher_id: int) -> bool:
    c = get_or_404(db, EduCourse, course_id, "course")
    if c.teacher_id != teacher_id:
        raise EduPermissionError("only the teacher can delete the course")
    c.is_deleted = True
    c.deleted_at = utcnow()
    db.flush()
    return True


def get_course(db: Session, course_id: int) -> EduCourse:
    return get_or_404(db, EduCourse, course_id, "course")


def increment_student_count(db: Session, course_id: int) -> EduCourse:
    """Increment student_count when a new enrollment happens."""
    c = get_or_404(db, EduCourse, course_id, "course")
    c.student_count = (c.student_count or 0) + 1
    db.flush()
    db.refresh(c)
    return c


def list_courses(
    db: Session, page: int = 1, size: int = 20,
    category_id: Optional[int] = None, teacher_id: Optional[int] = None,
    is_free: Optional[bool] = None, is_published: Optional[bool] = None,
    keyword: Optional[str] = None, order_by: str = "latest",
) -> Tuple[List[EduCourse], int]:
    filters = []
    if category_id is not None:
        filters.append(EduCourse.category_id == category_id)
    if teacher_id is not None:
        filters.append(EduCourse.teacher_id == teacher_id)
    if is_free is not None:
        filters.append(EduCourse.is_free == is_free)
    if is_published is not None:
        filters.append(EduCourse.is_published == is_published)
    if keyword:
        kw = f"%{keyword}%"
        filters.append(or_(EduCourse.title.ilike(kw), EduCourse.subtitle.ilike(kw), EduCourse.description.ilike(kw)))
    if order_by == "hot":
        order = desc(EduCourse.student_count)
    elif order_by == "rating":
        order = desc(EduCourse.rating)
    else:
        order = desc(EduCourse.created_at)
    return paginate(db, EduCourse, page=page, size=size, filters=filters, order_by=order)


# ============================================================================
# Chapter CRUD (迁移自 ChapterController)
# ============================================================================

def create_chapter(db: Session, course_id: int, title: str, **fields) -> EduCourseChapter:
    if not title:
        raise EduValidationError("title required")
    chapter = EduCourseChapter(
        course_id=course_id, parent_id=fields.get("parent_id"),
        title=title, sort_order=fields.get("sort_order", 0),
        description=fields.get("description"),
    )
    db.add(chapter)
    db.flush()
    db.refresh(chapter)
    return chapter


def list_chapters(db: Session, course_id: int) -> List[EduCourseChapter]:
    return list(db.execute(
        select(EduCourseChapter).where(EduCourseChapter.course_id == course_id)
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
    if not title:
        raise EduValidationError("title required")
    # Look up course_id from chapter
    ch = get_or_404(db, EduCourseChapter, chapter_id, "chapter")
    section = EduCourseSection(
        chapter_id=chapter_id, course_id=ch.course_id, title=title,
        video_url=fields.get("video_url"),
        duration_seconds=fields.get("duration_seconds", 0),
        resource_url=fields.get("resource_url"),
        sort_order=fields.get("sort_order", 0),
        is_free_preview=fields.get("is_free_preview", False),
    )
    db.add(section)
    db.flush()
    db.refresh(section)
    # Update course totals
    course = db.get(EduCourse, ch.course_id)
    if course:
        course.lesson_count = (course.lesson_count or 0) + 1
        course.duration_minutes = (course.duration_minutes or 0) + section.duration_seconds // 60
    db.flush()
    db.refresh(section)
    return section


def list_sections(db: Session, chapter_id: int) -> List[EduCourseSection]:
    return list(db.execute(
        select(EduCourseSection).where(EduCourseSection.chapter_id == chapter_id)
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
    """Update learning progress for a user/course/section."""
    if total_seconds <= 0:
        raise EduValidationError("total_seconds must be > 0")
    progress_percent = min(100.0, (progress_seconds / total_seconds) * 100)
    is_completed = progress_percent >= 95.0  # 95% considered complete

    record = db.execute(
        select(EduLearnRecord).where(
            and_(
                EduLearnRecord.member_id == user_id,
                EduLearnRecord.course_id == course_id,
                EduLearnRecord.section_id == section_id,
            )
        )
    ).scalar_one_or_none()

    if not record:
        record = EduLearnRecord(
            user_id=user_id, course_id=course_id, section_id=section_id,
            progress_seconds=progress_seconds, total_seconds=total_seconds,
            progress_percent=progress_percent, is_completed=is_completed,
            last_position=last_position,
        )
        db.add(record)
    else:
        record.progress_seconds = max(record.progress_seconds or 0, progress_seconds)
        record.total_seconds = total_seconds
        record.progress_percent = progress_percent
        if is_completed and not record.is_completed:
            record.is_completed = True
            record.completed_at = utcnow()
        if last_position is not None:
            record.last_position = last_position
    db.flush()
    db.refresh(record)
    return record


def get_user_progress(db: Session, user_id: int, course_id: int) -> List[EduLearnRecord]:
    """Get all learn records for a user in a course."""
    return list(db.execute(
        select(EduLearnRecord).where(
            and_(EduLearnRecord.member_id == user_id, EduLearnRecord.course_id == course_id)
        ).order_by(EduLearnRecord.section_id)
    ).scalars().all())


def get_course_completion(
    db: Session, user_id: int, course_id: int
) -> dict:
    """Get course completion summary for a user."""
    total = db.execute(
        select(func.count(EduCourseSection.id)).where(EduCourseSection.course_id == course_id)
    ).scalar() or 0
    completed = db.execute(
        select(func.count(EduLearnRecord.id)).where(
            and_(
                EduLearnRecord.member_id == user_id,
                EduLearnRecord.course_id == course_id,
                EduLearnRecord.is_completed == True,
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
    if not title:
        raise EduValidationError("title required")
    hw = EduHomework(
        course_id=course_id, chapter_id=fields.get("chapter_id"),
        title=title, description=fields.get("description"),
        deadline=fields.get("deadline"),
        max_score=fields.get("max_score", 100),
    )
    db.add(hw)
    db.flush()
    db.refresh(hw)
    return hw


def submit_homework(
    db: Session, homework_id: int, user_id: int, content: Optional[str], attachment_url: Optional[str]
) -> EduHomeworkSubmission:
    hw = get_or_404(db, EduHomework, homework_id, "homework")
    if hw.deadline and hw.deadline < utcnow():
        raise EduValidationError("homework deadline passed")
    sub = EduHomeworkSubmission(
        homework_id=homework_id, user_id=user_id,
        content=content, attachment_url=attachment_url,
        submitted_at=utcnow(),
    )
    db.add(sub)
    db.flush()
    db.refresh(sub)
    return sub


def grade_submission(
    db: Session, submission_id: int, grader_id: int, score: int, comment: Optional[str] = None
) -> EduHomeworkSubmission:
    if score < 0 or score > 100:
        raise EduValidationError("score must be 0-100")
    sub = get_or_404(db, EduHomeworkSubmission, submission_id, "submission")
    sub.score = score
    sub.comment = comment
    sub.grader_id = grader_id
    sub.graded_at = utcnow()
    db.flush()
    db.refresh(sub)
    return sub


# ============================================================================
# Certificate (迁移自 CertificateController)
# ============================================================================

def issue_certificate(
    db: Session, user_id: int, course_id: int, title: str, score: Optional[float] = None
) -> EduCertificate:
    """Issue a certificate after course completion."""
    completion = get_course_completion(db, user_id, course_id)
    if completion["completion_percent"] < 100:
        raise EduValidationError("course not completed")
    existing = db.execute(
        select(EduCertificate).where(
            and_(EduCertificate.member_id == user_id, EduCertificate.course_id == course_id)
        )
    ).scalar_one_or_none()
    if existing:
        return existing
    cert = EduCertificate(
        user_id=user_id, course_id=course_id,
        certificate_no=f"CERT{datetime.now().strftime('%Y%m%d')}{secrets.token_hex(4).upper()}",
        title=title, issue_date=utcnow(), score=score,
    )
    db.add(cert)
    db.flush()
    db.refresh(cert)
    return cert


def list_user_certificates(db: Session, user_id: int = None, user_uuid: str = None) -> List[EduCertificate]:
    return list(db.execute(
        select(EduCertificate).where(EduCertificate.member_id == user_id)
        .order_by(desc(EduCertificate.issue_date))
    ).scalars().all())
