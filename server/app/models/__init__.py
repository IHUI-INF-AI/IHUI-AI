"""Models package."""

# 第三方模块导入
from app.models.activity_models import (
    Activity,
    AgentBuy,
    AgentCategory,
    AgentDeveloper,
    AgentExamine,
    AiModelInfo,
    DeveloperLink,
)
from app.models.agent_misc_models import AgentBillings, AgentBuyScheduledTask, AgentUpload
from app.models.agent_models import Agent, AgentCallback, AgentConfig, AgentHeatStats
from app.models.agent_rule_models import AgentCategoryLink, AgentNeedTask, AgentRule, AgentRuleParam
from app.models.agent_settlement import AgentSettlement, AgentWithdrawalDetail
from app.models.ai_gc_models import AiGc, AiGcUserLog
from app.models.app_content_models import (
    AiAboutUs,
    AiContact,
    AiFileStorage,
    AiNews,
    AiUserFeedback,
    AppContent,
    AppVersion,
    BannerCarousel,
    CategoryDictionary,
    ExchangeRate,
    Information,
    KnowledgePlanet,
    ProductIdentity,
    ZhsProduct,
)
from app.models.ask_models import (
    AskAnswer,
    AskCategory,
    AskComment,
    AskFavorite,
    AskLike,
    AskQuestion,
    AskQuestionCategory,
)
from app.models.behavior_models import (
    BehaviorComment,
    BehaviorFavorite,
    BehaviorFollow,
    BehaviorLike,
    BehaviorReport,
    BehaviorSensitive,
    BehaviorShare,
)
from app.models.circle_models import (
    Circle,
    CircleCategory,
    CircleMember,
    CirclePost,
    CirclePostComment,
    CirclePostLike,
)
from app.models.codegen_models import CodegenColumn, CodegenTable
from app.models.context_models import UserAgentAudio, UserAgentContext, UserAgentImage
from app.models.course_models import Course, CourseVideo, EducationalCourse, EducationPlatform
from app.models.education_ext_models import (
    ZhsCourseAudit,
    ZhsCoursePay,
    ZhsCoursePayLog,
    ZhsCoursePlatformLog,
    ZhsCourseTemp,
    ZhsCourseVideoTemp,
    ZhsUserCommentLog,
    ZhsUserPlatform,
    ZhsUserVideoComment,
    ZhsUserVideoLog,
)
from app.models.exam_models import (
    ExamCategory,
    ExamPaper,
    ExamQuestion,
    ExamRecord,
    ExamWrongQuestion,
)
from app.models.identity_models import OAuthPrivateKey, TboxBean, ZhsIdentity, ZhsOrganization
from app.models.java_missing_models import (
    AiBotSites,
    PaymentCallback,
    TransferInfo,
    UserAgentFreeTimes,
    WxPayNotification,
)

# learn 学习模块 (迁移自 ihui-ai-edu-learn-service, 18 张表)
from app.models.learn_models import (
    LearnCategory,
    LearnCategoryRelation,
    LearnHomework,
    LearnHomeworkRecord,
    LearnLearnMap,
    LearnLearnMapTopic,
    LearnLesson,
    LearnLessonCategoryRelation,
    LearnLessonChapter,
    LearnLessonChapterSection,
    LearnRecord,
    LearnRecordLog,
    LearnSignUp,
    LearnTopic,
    LearnTopicCategory,
    LearnTopicCategoryRelation,
    LearnTopicLesson,
    LearnTopicTopicCategoryRelation,
)
from app.models.live_models import (
    LiveChannel,
    LiveChannelCategory,
    LiveComment,
    LiveGift,
    LiveSubscribe,
)
from app.models.message_models import (
    Message,
    MessageAnnouncement,
    MessageReadLog,
    MessageTemplate,
)
from app.models.notification_models import (
    Notification,
    NotificationChannel,
    NotificationLog,
    NotificationSubscription,
)
from app.models.oauth_models import OAuthApp, OAuthSession, OAuthUser
from app.models.payment_models import CommissionFlow, OperateTokenFlow, Order, WithdrawalFlow
from app.models.point_models import (
    PointAccount,
    PointExchange,
    PointGoods,
    PointLog,
    PointRule,
)
from app.models.resource_models import (
    OfficialInformation,
    PopularCourse,
    Resource,
    ZhsExchangeRate,
    ZhsResources,
)
from app.models.search_models import SearchHotKeyword, SearchIndex, SearchLog
from app.models.sys_models import (
    SysConfig,
    SysDept,
    SysDictData,
    SysDictType,
    SysJob,
    SysJobLog,
    SysLoginInfo,
    SysMenu,
    SysNotice,
    SysOperLog,
    SysPost,
    SysRole,
    SysRoleDept,
    SysRoleMenu,
    SysUser,
    SysUserRole,
)
from app.models.token_models import UserSKInfo, VideoGenerationTask
from app.models.user_models import (
    User,
    UserAgentFreeTime,
    UserAuthInfo,
    UserMargin,
    UserThirdPartyAccount,
    UserVip,
)
from app.models.visit_models import (
    VisitLog,
    VisitPage,
    VisitSource,
    VisitStats,
)
