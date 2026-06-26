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
    AskAnswerExt,
    AskCategory,
    AskCategoryRelation,
    AskComment,
    AskFavorite,
    AskLike,
    AskQuestion,
    AskQuestionCategory,
    AskQuestionExt,
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
from app.models.chat_room_models import ChatLetter, ChatRoom, ChatRoomUser
from app.models.circle_models import (
    Circle,
    CircleCategory,
    CircleCategoryBind,
    CircleCategoryRelation,
    CircleMember,
    CirclePost,
    CirclePostComment,
    CirclePostLike,
)
from app.models.codegen_models import CodegenColumn, CodegenTable
from app.models.context_models import UserAgentAudio, UserAgentContext, UserAgentImage
from app.models.course_models import Course, CourseVideo, EducationalCourse, EducationPlatform
from app.models.crew_models import CrewMessage, CrewSession, CrewTask
from app.models.knowledge_models import KnowledgeChunk, KnowledgeDoc
from app.models.learn_models import (
    Category,
    CategoryRelation,
    Certificate,
    CertificateSerialNumber,
    CertificateTemplate,
    ExamPaperRecord,
    Homework,
    HomeworkRecord,
    LearnMap,
    LearnMapTopic,
    Lesson,
    LessonAccess,
    LessonCategoryRelation,
    LessonChapter,
    LessonChapterSection,
    LessonTask,
    Rate,
    Record,
    RecordLog,
    ReplyComment,
    SignUp,
    Topic,
    TopicCategory,
    TopicCategoryRelation,
    TopicLesson,
    TopicTopicCategoryRelation,
    Watch,
)
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
    Exam,
    ExamCategory,
    ExamCategoryRelation,
    ExamChapter,
    ExamChapterSection,
    ExamPaper,
    ExamQuestion,
    ExamRecord,
    ExamSignUp,
    ExamWrongQuestion,
    PaperCategory,
    PaperCategoryRelation,
    PaperPaperCategoryRelation,
    PaperQuestion,
    PaperQuestionRule,
    Question,
    QuestionAndCategoryRelation,
    QuestionCategory,
    QuestionCategoryRelation,
)
from app.models.identity_models import OAuthPrivateKey, TboxBean, ZhsIdentity, ZhsOrganization
from app.models.id_mapping import IdMapping
from app.models.java_missing_models import (
    AiBotSites,
    PaymentCallback,
    TransferInfo,
    UserAgentFreeTimes,
    WxPayNotification,
)
from app.models.live_models import (
    ChannelLecturer,
    Lecturer,
    LiveChannel,
    LiveChannelCategory,
    LiveComment,
    LiveGift,
    LiveSubscribe,
    TencentCloudLiveStream,
)
from app.models.message_models import (
    Message,
    MessageAnnouncement,
    MessageReadLog,
    MessageTemplate,
)
from app.models.member_models import (
    EduCheckIn,
    EduCheckInRecord,
    EduFollow,
    EduMember,
    EduMemberCompany,
    EduMemberCompanyMemberRelation,
    EduMemberCompanyType,
    EduMemberGroup,
    EduMemberGroupMemberRelation,
    EduMemberLevel,
    EduMemberLevelRelation,
    EduMemberPost,
    EduMemberPostMemberRelation,
    EduMemberTag,
    EduMemberTagMemberRelation,
)
from app.models.notification_models import (
    Notification,
    NotificationChannel,
    NotificationLog,
    NotificationSubscription,
)
from app.models.oauth_models import OAuthApp, OAuthSession, OAuthUser
from app.models.payment_models import (
    CommissionFlow,
    IdentityProportion,
    InvoiceApplication,
    InvoiceTitle,
    OperateTokenFlow,
    Order,
    OrderItem,
    OrderPayment,
    Payment,
    PaymentConfig,
    Refund,
    RefundTimeline,
    WithdrawalFlow,
)
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
    ResourceProduct,
    ResourceTag,
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
    SysSmsTemplate,
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
