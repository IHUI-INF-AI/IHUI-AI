"""edu business domain ORM models - re-export bridge.

Phase A initially created standalone ORM classes (EduAskQuestion, EduMember, etc.)
which CONFLICT with IHUI-AI existing app/models/{ask,member,...}_models.py tables.

Phase B fix: This module RE-EXPORTS existing IHUI-AI models under the names our
edu services expect. Allows alembic 017~044 to use Base.metadata.create_all() without conflict.
"""

from __future__ import annotations

# P0: 基础层
from app.models.user_models import User as EduAuthUser, UserAuthInfo as EduUserProfile
from app.models.identity_models import OAuthPrivateKey as EduAuthSsoKey
from app.models.oauth_models import OAuthApp as EduAuthThirdParty
from app.models.member_models import (
    EduMember,
    EduMemberGroup as EduMemberParent,
)
from app.models.member_models import EduMemberPost as EduUserAddress
from app.models.app_content_models import CategoryDictionary as EduSettingDict

# P0: 核心层
from app.models.app_content_models import AppContent as EduContentArticle
from app.models.learn_models import (
    Lesson as EduCourse,
    LessonChapter as EduCourseChapter,
    LessonChapterSection as EduCourseSection,
    Record as EduLearnRecord,
    Homework as EduHomework,
    HomeworkRecord as EduHomeworkSubmission,
    Certificate as EduCertificate,
)
from app.models.exam_models import (
    ExamPaper as EduPaper,
    Question as EduQuestion,
    ExamRecord as EduExamRecord,
    ExamWrongQuestion as EduWrongBook,
)

try:
    from app.models.resource_models import Resource as EduResource
except ImportError:
    EduResource = None

# P1: 新增层
from app.models.ask_models import (
    AskQuestion as EduAskQuestion,
    AskAnswer as EduAskAnswer,
    AskCategory as EduAskCategory,
)
from app.models.circle_models import (
    Circle as EduCircle,
    CirclePost as EduCirclePost,
    CircleMember as EduCircleMember,
)

# P1: 交易/通知
from app.models.education_ext_models import ZhsCoursePay as EduPayOrder
from app.models.payment_models import Order as EduOrder
from app.models.point_models import (
    PointAccount as EduPointAccount,
    PointLog as EduPointRecord,
)
from app.models.message_models import Message as EduMessage
from app.models.notification_models import Notification as EduNotification

# P2: 支撑层
from app.models.live_models import (
    LiveChannel as EduLiveRoom,
    LiveSubscribe as EduLiveAttendance,
)
try:
    from app.models.sys_models import SysFile as EduOssFile
except ImportError:
    EduOssFile = None
try:
    from app.models.sys_models import SysUploadSession as EduOssUploadSession
except ImportError:
    EduOssUploadSession = None
from app.models.search_models import SearchIndex as EduSearchIndex
from app.models.learn_models import LessonTask as EduScheduleCourse
from app.models.behavior_models import BehaviorLike as EduBehaviorView
from app.models.visit_models import VisitLog as EduVisitLog


EDU_MODELS = [
    EduAuthUser, EduAuthSsoKey, EduAuthThirdParty,
    EduMember, EduMemberParent,
    EduUserProfile, EduUserAddress, EduSettingDict,
    EduContentArticle,
    EduCourse, EduCourseChapter, EduCourseSection, EduLearnRecord,
    EduHomework, EduHomeworkSubmission, EduCertificate,
    EduPaper, EduQuestion, EduExamRecord, EduWrongBook,
]
if EduResource is not None:
    EDU_MODELS.append(EduResource)

EDU_MODELS.extend([
    EduAskQuestion, EduAskAnswer, EduAskCategory,
    EduCircle, EduCirclePost, EduCircleMember,
    EduPayOrder, EduOrder,
    EduPointAccount, EduPointRecord,
    EduMessage, EduNotification,
    EduLiveRoom, EduLiveAttendance,
])
if EduOssFile is not None:
    EDU_MODELS.append(EduOssFile)
if EduOssUploadSession is not None:
    EDU_MODELS.append(EduOssUploadSession)
EDU_MODELS.extend([
    EduSearchIndex, EduScheduleCourse,
    EduBehaviorView, EduVisitLog,
])
EDU_MODELS = [m for m in EDU_MODELS if m is not None]


__all__ = [
    "EduAuthUser", "EduAuthSsoKey", "EduAuthThirdParty",
    "EduMember", "EduMemberParent",
    "EduUserProfile", "EduUserAddress", "EduSettingDict",
    "EduContentArticle",
    "EduCourse", "EduCourseChapter", "EduCourseSection", "EduLearnRecord",
    "EduHomework", "EduHomeworkSubmission", "EduCertificate",
    "EduPaper", "EduQuestion", "EduExamRecord", "EduWrongBook",
    "EduResource",
    "EduAskQuestion", "EduAskAnswer", "EduAskCategory",
    "EduCircle", "EduCirclePost", "EduCircleMember",
    "EduPayOrder", "EduOrder",
    "EduPointAccount", "EduPointRecord",
    "EduMessage", "EduNotification",
    "EduLiveRoom", "EduLiveAttendance",
    "EduOssFile", "EduOssUploadSession",
    "EduSearchIndex", "EduScheduleCourse",
    "EduBehaviorView", "EduVisitLog",
    "EDU_MODELS",
]
