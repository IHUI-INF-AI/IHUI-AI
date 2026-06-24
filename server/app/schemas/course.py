"""Course schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class CourseCreate(BaseModel):
    title: str = Field(..., max_length=200)
    subtitle: str | None = None
    content: str | None = None
    stage: int | None = Field(default=0, ge=0, le=100)


class CourseUpdate(BaseModel):
    title: str | None = None
    subtitle: str | None = None
    content: str | None = None
    stage: int | None = None
    is_hidden: int | None = None
    audit_status: int | None = None


class CourseOut(BaseModel):
    id: int
    title: str | None = None
    subtitle: str | None = None
    stage: int | None = None
    is_hidden: int | None = None
    audit_status: int | None = None
    created_at: datetime | None = None
    model_config = {"from_attributes": True}


class CourseVideoOut(BaseModel):
    id: int
    course_id: int
    video_path: str | None = None
    title: str | None = None
    duration: int | None = None
    is_pay: int | None = None
    amount: int | None = None
    lecturer: str | None = None
    model_config = {"from_attributes": True}
