"""edu business domain Pydantic schemas.

Migrated from edu Java DTOs (storage/edu-assets/java-source/ihui-ai-edu-*-service/.../dto).
Provides request/response models for all 23 edu domains.

Phase A: skeleton with empty placeholder classes per domain.
Phase B: each domain fills in actual fields.

Conventions:
- snake_case naming (vs Java camelCase in original)
- Use Pydantic v2 BaseModel + ConfigDict(from_attributes=True)
- Common response wrapper: app.schemas.common.success/error/page_result
- Pagination: page (1-based) + size (default 20)
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class EduBase(BaseModel):
    """Common base for all edu schemas."""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ============================================================================
# P0: 基础层 (auth/member/usercenter/setting)
# ============================================================================

class EduAuthUserLoginReq(EduBase):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)


class EduAuthUserRegisterReq(EduBase):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)
    phone: Optional[str] = None
    email: Optional[str] = None
    nickname: Optional[str] = None
    invite_code: Optional[str] = None


class EduAuthUserOut(EduBase):
    id: int
    username: str
    nickname: Optional[str]
    avatar: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    gender: Optional[str]
    status: int
    created_at: datetime
    last_login_at: Optional[datetime]


class EduAuthSsoLoginReq(EduBase):
    """SSO login (client_id + signed JWT)."""
    client_id: str
    signed_jwt: str
    redirect_uri: Optional[str] = None


class EduAuthSsoLoginResp(EduBase):
    access_token: str
    refresh_token: str
    expires_in: int
    user: EduAuthUserOut


class EduAuthThirdPartyLoginReq(EduBase):
    """Third-party OAuth login callback."""
    platform: str  # wechat/dingtalk/feishu/wecom/qq
    code: str
    state: Optional[str] = None
    redirect_uri: Optional[str] = None


class EduMemberOut(EduBase):
    id: int
    user_id: int
    member_no: Optional[str]
    real_name: Optional[str]
    member_type: str
    school: Optional[str]
    grade: Optional[str]
    class_name: Optional[str]
    student_no: Optional[str]
    points: int
    level: int
    expire_at: Optional[datetime]


class EduMemberUpdateReq(EduBase):
    real_name: Optional[str] = None
    school: Optional[str] = None
    grade: Optional[str] = None
    class_name: Optional[str] = None
    student_no: Optional[str] = None


class EduUserProfileOut(EduBase):
    user_id: int
    bio: Optional[str]
    tags: Optional[str]
    preferences: Optional[str]
    timezone: str
    locale: str


# ============================================================================
# P0: 核心层 (content/learn/exam/resource)
# ============================================================================

class EduCourseCreateReq(EduBase):
    title: str = Field(..., max_length=256)
    subtitle: Optional[str] = None
    cover: Optional[str] = None
    description: Optional[str] = None
    teacher_id: int
    category_id: Optional[int] = None
    price: float = 0
    original_price: Optional[float] = None
    difficulty: str = "beginner"
    is_free: bool = False


class EduCourseUpdateReq(EduBase):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    cover: Optional[str] = None
    price: Optional[float] = None
    difficulty: Optional[str] = None
    is_published: Optional[bool] = None


class EduCourseOut(EduBase):
    id: int
    title: str
    subtitle: Optional[str]
    cover: Optional[str]
    description: Optional[str]
    teacher_id: int
    category_id: Optional[int]
    price: float
    original_price: Optional[float]
    student_count: int
    lesson_count: int
    duration_minutes: int
    difficulty: Optional[str]
    is_free: bool
    is_published: bool
    published_at: Optional[datetime]
    rating: Optional[float]
    created_at: datetime


class EduCourseChapterReq(EduBase):
    course_id: int
    parent_id: Optional[int] = None
    title: str
    sort_order: int = 0
    description: Optional[str] = None


class EduCourseChapterOut(EduBase):
    id: int
    course_id: int
    parent_id: Optional[int]
    title: str
    sort_order: int
    description: Optional[str]


class EduCourseSectionReq(EduBase):
    chapter_id: int
    course_id: int
    title: str
    video_url: Optional[str] = None
    duration_seconds: int = 0
    resource_url: Optional[str] = None
    sort_order: int = 0
    is_free_preview: bool = False


class EduLearnProgressUpdateReq(EduBase):
    course_id: int
    section_id: Optional[int] = None
    progress_seconds: int
    total_seconds: int
    last_position: Optional[int] = None


class EduLearnRecordOut(EduBase):
    id: int
    user_id: int
    course_id: int
    section_id: Optional[int]
    progress_percent: float
    is_completed: bool
    completed_at: Optional[datetime]


class EduHomeworkSubmitReq(EduBase):
    homework_id: int
    content: Optional[str] = None
    attachment_url: Optional[str] = None


class EduCertificateOut(EduBase):
    id: int
    certificate_no: str
    title: str
    issue_date: datetime
    expire_date: Optional[datetime]
    pdf_url: Optional[str]
    score: Optional[float]


class EduExamSubmitReq(EduBase):
    record_id: int
    answers: dict  # {question_id: answer}


class EduExamRecordOut(EduBase):
    id: int
    user_id: int
    paper_id: int
    start_at: datetime
    submit_at: Optional[datetime]
    duration_seconds: int
    score: Optional[float]
    is_passed: Optional[bool]
    status: str


class EduResourceUploadReq(EduBase):
    title: str
    description: Optional[str] = None
    category_id: Optional[int] = None
    file_type: str  # pdf/video/audio/doc/image
    file_size: int
    is_free: bool = True
    points_required: int = 0


# ============================================================================
# P1: 新增层 (ask/circle)
# ============================================================================

class EduAskQuestionCreateReq(EduBase):
    title: str = Field(..., max_length=256)
    content: str
    course_id: Optional[int] = None
    tags: Optional[str] = None


class EduAskQuestionOut(EduBase):
    id: int
    user_id: int
    title: str
    content: str
    course_id: Optional[int]
    tags: Optional[str]
    view_count: int
    answer_count: int
    is_resolved: bool
    best_answer_id: Optional[int]
    created_at: datetime


class EduAskAnswerCreateReq(EduBase):
    question_id: int
    content: str


class EduAskAnswerOut(EduBase):
    id: int
    question_id: int
    user_id: int
    content: str
    is_best: bool
    like_count: int
    adopted_at: Optional[datetime]
    created_at: datetime


class EduCircleCreateReq(EduBase):
    name: str = Field(..., max_length=128)
    description: Optional[str] = None
    cover: Optional[str] = None
    category: Optional[str] = None
    is_public: bool = True


class EduCirclePostCreateReq(EduBase):
    circle_id: int
    content: str
    images: Optional[List[str]] = None


class EduCirclePostOut(EduBase):
    id: int
    circle_id: int
    user_id: int
    content: str
    images: Optional[List[str]]
    like_count: int
    comment_count: int
    created_at: datetime


# ============================================================================
# P1: 交易/通知 (pay/order/point/message/notification)
# ============================================================================

class EduOrderCreateReq(EduBase):
    order_type: str  # course/card/package
    items: List[dict]  # [{entity_id, quantity, price}]
    coupon_id: Optional[int] = None
    remark: Optional[str] = None


class EduOrderOut(EduBase):
    id: int
    order_no: str
    user_id: int
    order_type: str
    total_amount: float
    paid_amount: float
    discount_amount: float
    status: str
    pay_method: Optional[str]
    paid_at: Optional[datetime]
    expire_at: Optional[datetime]
    created_at: datetime


class EduPayCreateReq(EduBase):
    order_id: int
    pay_channel: str  # wechat/alipay/installment
    installment_count: Optional[int] = None  # for installment


class EduPayOut(EduBase):
    id: int
    order_id: int
    pay_channel: str
    pay_amount: float
    pay_status: str
    transaction_id: Optional[str]
    paid_at: Optional[datetime]


class EduPointExchangeReq(EduBase):
    item_id: int
    quantity: int = 1


class EduPointAccountOut(EduBase):
    user_id: int
    balance: int
    frozen: int
    total_earned: int
    total_spent: int


class EduMessageSendReq(EduBase):
    receiver_id: int
    msg_type: str = "private"  # system/private/group
    title: Optional[str] = None
    content: str


class EduNotificationOut(EduBase):
    id: int
    user_id: int
    template_code: str
    channel: str
    title: str
    content: str
    is_sent: bool
    sent_at: Optional[datetime]


# ============================================================================
# P2: 支撑层 (live/oss/search/schedule/behavior/visit-tracking)
# ============================================================================

class EduLiveRoomCreateReq(EduBase):
    title: str
    teacher_id: int
    course_id: Optional[int] = None
    description: Optional[str] = None
    cover: Optional[str] = None
    scheduled_start: datetime
    scheduled_end: datetime
    max_attendees: int = 1000


class EduLiveRoomOut(EduBase):
    id: int
    title: str
    teacher_id: int
    course_id: Optional[int]
    scheduled_start: datetime
    scheduled_end: datetime
    status: str
    stream_url: Optional[str]
    playback_url: Optional[str]
    attendee_count: int
    max_attendees: int


class EduOssUploadInitReq(EduBase):
    file_name: str
    file_size: int
    content_type: Optional[str] = None
    total_parts: int


class EduOssUploadInitResp(EduBase):
    session_id: str
    file_key: str
    upload_id: str
    part_urls: List[str]  # pre-signed URLs for each part


class EduSearchQueryReq(EduBase):
    q: str
    entity_type: Optional[str] = None  # course/article/question
    page: int = 1
    size: int = 20
    filters: Optional[dict] = None


class EduSearchResult(EduBase, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int
    took_ms: int


class EduScheduleCreateReq(EduBase):
    course_id: int
    teacher_id: int
    classroom: Optional[str] = None
    week_day: int  # 1-7
    start_time: str  # HH:MM:SS
    end_time: str
    semester: Optional[str] = None
    effective_from: datetime
    effective_to: Optional[datetime] = None


class EduBehaviorTrackReq(EduBase):
    session_id: str
    entity_type: str
    entity_id: int
    event: str  # view/click/hover/scroll
    duration_ms: int = 0
    path: Optional[str] = None
    referrer: Optional[str] = None


class EduVisitOut(EduBase):
    id: int
    user_id: Optional[int]
    ip: Optional[str]
    path: str
    method: str
    status_code: int
    duration_ms: int
    created_at: datetime


# ============================================================================
# Pagination wrapper
# ============================================================================

class EduPageReq(EduBase):
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=100)
    keyword: Optional[str] = None
    order_by: Optional[str] = None
    order_dir: str = "desc"


class EduPageResp(EduBase, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int
    pages: int