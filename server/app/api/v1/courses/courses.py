"""Course routes."""


from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.database import SessionFactory3
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CourseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    subtitle: str | None = None
    content: str | None = None
    remark: str | None = None
    remark_file: str | None = None
    binding: str | None = None
    stage: str | None = None
    label: str | None = None
    sort: int = 0
    is_hidden: int = 0


class CourseUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    subtitle: str | None = None
    content: str | None = None
    remark: str | None = None
    remark_file: str | None = None
    binding: str | None = None
    stage: str | None = None
    label: str | None = None
    sort: int | None = None
    is_hidden: int | None = None
    audit_status: int | None = None


# ---------------------------------------------------------------------------
# 1. List / Detail (existing)
# ---------------------------------------------------------------------------


@router.get("/list", summary="List courses")
async def list_courses(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    keyword: str = Query(None),
    stage: str = Query(None),
    is_hidden: int = Query(None),
    audit_status: int = Query(None),
):
    db = SessionFactory3()
    try:
        from app.models.course_models import Course

        q = db.query(Course).filter(Course.is_del == 0)
        if is_hidden is not None:
            q = q.filter(Course.is_hidden == is_hidden)
        if keyword:
            q = q.filter(Course.title.like(f"%{keyword}%"))
        if stage:
            q = q.filter(Course.stage == stage)
        if audit_status is not None:
            q = q.filter(Course.audit_status == audit_status)
        total = q.count()
        courses = q.order_by(Course.sort, Course.id.desc()).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": c.id,
                "title": c.title,
                "subtitle": c.subtitle,
                "stage": c.stage,
                "is_hidden": c.is_hidden,
                "audit_status": c.audit_status,
                "sort": c.sort,
                "label": c.label,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in courses
        ]
        return success(data, total=total)
    finally:
        db.close()


@router.get("/{course_id}", summary="Get course detail")
async def get_course(course_id: int):
    db = SessionFactory3()
    try:
        from app.models.course_models import Course, CourseVideo

        course = db.query(Course).filter(Course.id == course_id, Course.is_del == 0).first()
        if not course:
            return error("Course not found", "404")
        videos = db.query(CourseVideo).filter(CourseVideo.course_id == course_id).all()
        return success(
            {
                "id": course.id,
                "title": course.title,
                "subtitle": course.subtitle,
                "content": course.content,
                "stage": course.stage,
                "remark": course.remark,
                "remark_file": course.remark_file,
                "binding": course.binding,
                "label": course.label,
                "is_hidden": course.is_hidden,
                "sort": course.sort,
                "audit_status": course.audit_status,
                "creator": course.creator,
                "created_at": course.created_at.isoformat() if course.created_at else None,
                "updated_at": course.updated_at.isoformat() if course.updated_at else None,
                "videos": [
                    {
                        "id": v.id,
                        "title": v.title,
                        "video_path": v.video_path,
                        "duration": v.duration,
                        "is_pay": v.is_pay,
                        "amount": v.amount,
                        "lecturer": v.lecturer,
                    }
                    for v in videos
                ],
            }
        )
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 2. Create course
# ---------------------------------------------------------------------------


@router.post("/create", summary="Create course")
async def create_course(body: CourseCreate, user_uuid: str = Depends(require_login)):
    db = SessionFactory3()
    try:
        from app.models.course_models import Course

        course = Course(
            title=body.title,
            subtitle=body.subtitle,
            content=body.content,
            remark=body.remark,
            remark_file=body.remark_file,
            binding=body.binding,
            stage=body.stage,
            label=body.label,
            sort=body.sort,
            is_hidden=body.is_hidden,
            creator=user_uuid,
            is_del=0,
            audit_status=0,
        )
        db.add(course)
        db.commit()
        db.refresh(course)
        return success({"id": course.id, "title": course.title})
    except Exception as e:
        db.rollback()
        return error(str(e))
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 3. Update course
# ---------------------------------------------------------------------------


@router.put("/{course_id}", summary="Update course")
async def update_course(course_id: int, body: CourseUpdate, user_uuid: str = Depends(require_login)):
    db = SessionFactory3()
    try:
        from app.models.course_models import Course

        course = db.query(Course).filter(Course.id == course_id, Course.is_del == 0).first()
        if not course:
            return error("Course not found", "404")
        update_data = body.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(course, key, value)
        db.commit()
        return success({"id": course.id})
    except Exception as e:
        db.rollback()
        return error(str(e))
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 4. Delete course (soft delete)
# ---------------------------------------------------------------------------


@router.delete("/{course_id}", summary="Delete course (soft)")
async def delete_course(course_id: int, user_uuid: str = Depends(require_login)):
    db = SessionFactory3()
    try:
        from app.models.course_models import Course

        course = db.query(Course).filter(Course.id == course_id, Course.is_del == 0).first()
        if not course:
            return error("Course not found", "404")
        course.is_del = 1  # type: ignore[assignment]
        db.commit()
        return success({"id": course_id})
    except Exception as e:
        db.rollback()
        return error(str(e))
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 5. Delist / hide course
# ---------------------------------------------------------------------------


@router.post("/{course_id}/delist", summary="Delist (hide) course")
async def delist_course(course_id: int, user_uuid: str = Depends(require_login)):
    db = SessionFactory3()
    try:
        from app.models.course_models import Course

        course = db.query(Course).filter(Course.id == course_id, Course.is_del == 0).first()
        if not course:
            return error("Course not found", "404")
        course.is_hidden = 1 if course.is_hidden == 0 else 0  # type: ignore[assignment]
        db.commit()
        return success({"id": course_id, "is_hidden": course.is_hidden})
    except Exception as e:
        db.rollback()
        return error(str(e))
    finally:
        db.close()
