import type { RouteRecordRaw } from 'vue-router'
import { safeImport } from '../utils/componentLoader'

export const adminRoutes: Array<RouteRecordRaw> = [
  {
    path: '/admin/gray-release',
    name: 'grayRelease',
    component: safeImport(
      () => import(/* webpackChunkName: "gray-release" */ '@/views/admin/GrayRelease.vue'),
      'GrayRelease'
    ),
    meta: {
      title: 'routes.adminGrayRelease',
      description: 'seo.adminGrayRelease.desc',
      keywords: 'seo.adminGrayRelease.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/dependency-manager',
    name: 'dependencyManager',
    component: safeImport(
      () => import(/* webpackChunkName: "dependency-manager" */ '@/views/admin/DependencyManager.vue'),
      'DependencyManager'
    ),
    meta: {
      title: 'routes.adminDependencyManager',
      description: 'seo.adminDependencyManager.desc',
      keywords: 'seo.adminDependencyManager.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/event-bus-monitor',
    name: 'eventBusMonitor',
    component: safeImport(
      () => import(/* webpackChunkName: "event-bus-monitor" */ '@/views/admin/EventBusMonitor.vue'),
      'EventBusMonitor'
    ),
    meta: {
      title: 'routes.adminEventBusMonitor',
      description: 'seo.adminEventBusMonitor.desc',
      keywords: 'seo.adminEventBusMonitor.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/monitoring-dashboard',
    name: 'monitoringDashboard',
    component: safeImport(
      () => import(/* webpackChunkName: "monitoring-dashboard" */ '@/views/admin/MonitoringDashboard.vue'),
      'MonitoringDashboard'
    ),
    meta: {
      title: 'routes.adminMonitoringDashboard',
      description: 'seo.adminMonitoringDashboard.desc',
      keywords: 'seo.adminMonitoringDashboard.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/backend-health',
    name: 'backendHealth',
    component: safeImport(
      () => import(/* webpackChunkName: "backend-health" */ '@/views/admin/BackendHealth.vue'),
      'BackendHealth'
    ),
    meta: {
      title: 'routes.adminBackendHealth',
      description: 'seo.adminBackendHealth.desc',
      keywords: 'seo.adminBackendHealth.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/mobile-dashboard',
    name: 'mobileDashboard',
    component: safeImport(
      () => import(/* webpackChunkName: "mobile-dashboard" */ '@/views/MobileDashboard.vue'),
      'MobileDashboard'
    ),
    meta: {
      title: 'routes.adminMobileDashboard',
      description: 'seo.adminMobileDashboard.desc',
      keywords: 'seo.adminMobileDashboard.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/errors',
    name: 'errorDashboard',
    component: safeImport(
      () => import(/* webpackChunkName: "error-dashboard" */ '@/views/admin/ErrorDashboard.vue'),
      'ErrorDashboard'
    ),
    meta: {
      title: 'routes.adminErrorDashboard',
      description: 'seo.adminErrorDashboard.desc',
      keywords: 'seo.adminErrorDashboard.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/performance',
    name: 'performanceDashboard',
    component: safeImport(
      () => import(/* webpackChunkName: "performance-dashboard" */ '@/views/admin/PerformanceDashboard.vue'),
      'PerformanceDashboard'
    ),
    meta: {
      title: 'routes.adminPerformanceDashboard',
      description: 'seo.adminPerformanceDashboard.desc',
      keywords: 'seo.adminPerformanceDashboard.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/mobile-adapter',
    name: 'mobileAdapter',
    component: safeImport(
      () => import(/* webpackChunkName: "mobile-adapter" */ '@/views/admin/MobileAdapter.vue'),
      'MobileAdapter'
    ),
    meta: {
      title: 'routes.adminMobileAdapter',
      description: 'seo.adminMobileAdapter.desc',
      keywords: 'seo.adminMobileAdapter.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/recommendation-config',
    name: 'recommendationConfig',
    component: safeImport(
      () => import(/* webpackChunkName: "recommendation-config" */ '@/views/admin/RecommendationConfig.vue'),
      'RecommendationConfig'
    ),
    meta: {
      title: 'routes.adminRecommendationConfig',
      description: 'seo.adminRecommendationConfig.desc',
      keywords: 'seo.adminRecommendationConfig.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/database-optimization',
    name: 'databaseOptimization',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "database-optimization" */ '@/views/admin/DatabaseOptimization.vue'
        ),
      'DatabaseOptimization'
    ),
    meta: {
      title: 'routes.adminDatabaseOptimization',
      description: 'seo.adminDatabaseOptimization.desc',
      keywords: 'seo.adminDatabaseOptimization.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/user-management',
    name: 'userManagement',
    component: safeImport(
      () => import(/* webpackChunkName: "user-management" */ '@/views/admin/UserManagement.vue'),
      'UserManagement'
    ),
    meta: {
      title: 'routes.adminUserManagement',
      description: 'seo.adminUserManagement.desc',
      keywords: 'seo.adminUserManagement.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/refund-audit',
    name: 'refundAudit',
    component: safeImport(
      () => import(/* webpackChunkName: "refund-audit" */ '@/views/admin/RefundAudit.vue'),
      'RefundAudit'
    ),
    meta: {
      title: 'routes.adminRefundAudit',
      description: 'seo.adminRefundAudit.desc',
      keywords: 'seo.adminRefundAudit.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/product-management',
    name: 'productManagement',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "product-management" */ '@/views/admin/components/ProductList.vue'
        ),
      'ProductList'
    ),
    meta: {
      title: 'routes.adminProductManagement',
      description: 'seo.adminProductManagement.desc',
      keywords: 'seo.adminProductManagement.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/activity-management',
    name: 'activityManagement',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "activity-management" */ '@/views/admin/components/ActivityList.vue'
        ),
      'ActivityList'
    ),
    meta: {
      title: 'routes.adminActivityManagement',
      description: 'seo.adminActivityManagement.desc',
      keywords: 'seo.adminActivityManagement.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/course-management',
    name: 'courseManagement',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "course-management" */ '@/views/admin/components/CourseList.vue'
        ),
      'CourseList'
    ),
    meta: {
      title: 'routes.adminCourseManagement',
      description: 'seo.adminCourseManagement.desc',
      keywords: 'seo.adminCourseManagement.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/agent-management',
    name: 'agentManagement',
    component: safeImport(
      () =>
        import(/* webpackChunkName: "agent-management" */ '@/views/admin/components/AgentList.vue'),
      'AgentList'
    ),
    meta: {
      title: 'routes.adminAgentManagement',
      description: 'seo.adminAgentManagement.desc',
      keywords: 'seo.adminAgentManagement.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/payment-management',
    name: 'paymentManagement',
    component: safeImport(
      () =>
        import(/* webpackChunkName: "payment-management" */ '@/views/admin/components/OrderList.vue'),
      'OrderList'
    ),
    meta: {
      title: 'routes.adminPaymentManagement',
      description: 'seo.adminPaymentManagement.desc',
      keywords: 'seo.adminPaymentManagement.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/withdrawal-management',
    name: 'withdrawalManagement',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "withdrawal-management" */ '@/views/admin/components/WithdrawalList.vue'
        ),
      'WithdrawalList'
    ),
    meta: {
      title: 'routes.adminWithdrawalManagement',
      description: 'seo.adminWithdrawalManagement.desc',
      keywords: 'seo.adminWithdrawalManagement.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/fund-management',
    name: 'fundManagement',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "fund-management" */ '@/views/admin/components/UserMarginList.vue'
        ),
      'UserMarginList'
    ),
    meta: {
      title: 'routes.adminFundManagement',
      description: 'seo.adminFundManagement.desc',
      keywords: 'seo.adminFundManagement.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/feedback-management',
    name: 'feedbackManagement',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "feedback-management" */ '@/views/admin/components/FeedbackList.vue'
        ),
      'FeedbackList'
    ),
    meta: {
      title: 'routes.adminFeedbackManagement',
      description: 'seo.adminFeedbackManagement.desc',
      keywords: 'seo.adminFeedbackManagement.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/faq-management',
    name: 'faqManagement',
    component: safeImport(
      () =>
        import(/* webpackChunkName: "faq-management" */ '@/views/admin/components/FAQList.vue'),
      'FAQList'
    ),
    meta: {
      title: 'routes.adminFaqManagement',
      description: 'seo.adminFaqManagement.desc',
      keywords: 'seo.adminFaqManagement.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/webhook-management',
    name: 'webhookManagement',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "webhook-management" */ '@/views/admin/components/WebhookList.vue'
        ),
      'WebhookList'
    ),
    meta: {
      title: 'routes.adminWebhookManagement',
      description: 'seo.adminWebhookManagement.desc',
      keywords: 'seo.adminWebhookManagement.keywords',
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: safeImport(
      () => import(/* webpackChunkName: "dashboard" */ '@/views/Dashboard.vue'),
      'Dashboard'
    ),
    meta: {
      title: 'routes.dataDashboard',
      description: 'seo.dataDashboard.desc',
      keywords: 'seo.dataDashboard.keywords',
      requiresAuth: true,
    },
  },
  {
    path: '/settlement-management',
    name: 'settlementManagement',
    component: safeImport(
      () =>
        import(/* webpackChunkName: "settlement-management" */ '@/views/SettlementManager.vue'),
      'SettlementManager'
    ),
    meta: {
      title: 'routes.adminSettlementManagement',
      description: 'seo.adminSettlementManagement.desc',
      keywords: 'seo.adminSettlementManagement.keywords',
      requiresAuth: true,
    },
  },
  {
    path: '/agent-category-management',
    name: 'agentCategoryManagement',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "agent-category-management" */ '@/views/AgentCategoryManager.vue'
        ),
      'AgentCategoryManager'
    ),
    meta: {
      title: 'routes.adminAgentPricingConfig',
      description: 'seo.adminAgentPricingConfig.desc',
      keywords: 'seo.adminAgentPricingConfig.keywords',
      requiresAuth: true,
    },
  },
  {
    path: '/agent-examine-management',
    name: 'agentExamineManagement',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "agent-examine-management" */ '@/views/AgentExamineManager.vue'
        ),
      'AgentExamineManager'
    ),
    meta: {
      title: 'routes.adminAgentAudit',
      description: 'seo.adminAgentAudit.desc',
      keywords: 'seo.adminAgentAudit.keywords',
      requiresAuth: true,
    },
  },
  // P12 admin 后台迁移
  {
    path: '/admin',
    component: safeImport(() => import(/* webpackChunkName: "admin-layout" */ '@/components/admin/Layout.vue'), 'AdminLayout'),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: '', redirect: '/admin/home' },
      { path: 'home', name: 'adminHome', component: safeImport(() => import('@/views/admin/home/Index.vue'), 'adminHome'), meta: { title: 'routes.adminHome' } },
      { path: 'migration', name: 'adminMigration', component: safeImport(() => import('@/views/admin/MigrationAdmin.vue'), 'adminMigration'), meta: { title: 'routes.adminMigration' } },
      { path: 'notification', name: 'adminNotification', component: safeImport(() => import('@/views/admin/NotificationCenter.vue'), 'adminNotification'), meta: { title: 'routes.adminNotification' } },
      { path: 'member/list', name: 'adminMemberList', component: safeImport(() => import('@/views/admin/member/List.vue'), 'adminMemberList'), meta: { title: 'routes.adminMemberList' } },
      { path: 'member/unaudited', name: 'adminMemberUnaudited', component: safeImport(() => import('@/views/admin/member/Unaudited.vue'), 'adminMemberUnaudited'), meta: { title: 'routes.adminMemberUnaudited' } },
      { path: 'member/group', name: 'adminMemberGroup', component: safeImport(() => import('@/views/admin/member/Group.vue'), 'adminMemberGroup'), meta: { title: 'routes.adminMemberGroup' } },
      { path: 'member/level', name: 'adminMemberLevel', component: safeImport(() => import('@/views/admin/member/Level.vue'), 'adminMemberLevel'), meta: { title: 'routes.adminMemberLevel' } },
      { path: 'member/post', name: 'adminMemberPost', component: safeImport(() => import('@/views/admin/member/Post.vue'), 'adminMemberPost'), meta: { title: 'routes.adminMemberPost' } },
      { path: 'member/tag', name: 'adminMemberTag', component: safeImport(() => import('@/views/admin/member/Tag.vue'), 'adminMemberTag'), meta: { title: 'routes.adminMemberTag' } },
      { path: 'member/company', name: 'adminMemberCompany', component: safeImport(() => import('@/views/admin/member/Company.vue'), 'adminMemberCompany'), meta: { title: 'routes.adminMemberCompany' } },
      { path: 'account', name: 'adminAccount', component: safeImport(() => import('@/views/admin/account/Index.vue'), 'adminAccount'), meta: { title: 'routes.adminAccount' } },
      { path: 'account/security', name: 'adminAccountSecurity', component: safeImport(() => import('@/views/admin/account/Security.vue'), 'adminAccountSecurity'), meta: { title: 'routes.adminAccountSecurity' } },
      { path: 'org/user', name: 'adminOrgUser', component: safeImport(() => import('@/views/admin/org/User.vue'), 'adminOrgUser'), meta: { title: 'routes.adminOrgUser' } },
      { path: 'org/department', name: 'adminOrgDepartment', component: safeImport(() => import('@/views/admin/org/Department.vue'), 'adminOrgDepartment'), meta: { title: 'routes.adminOrgDepartment' } },
      { path: 'learn/lesson', name: 'adminLearnLesson', component: safeImport(() => import('@/views/admin/learn/Lesson.vue'), 'adminLearnLesson'), meta: { title: 'routes.adminLearnLesson' } },
      { path: 'learn/lesson-trash', name: 'adminLearnLessonTrash', component: safeImport(() => import('@/views/admin/learn/LessonTrash.vue'), 'adminLearnLessonTrash'), meta: { title: 'routes.adminLearnLessonTrash' } },
      { path: 'learn/category', name: 'adminLearnCategory', component: safeImport(() => import('@/views/admin/learn/Category.vue'), 'adminLearnCategory'), meta: { title: 'routes.adminLearnCategory' } },
      { path: 'learn/map', name: 'adminLearnMap', component: safeImport(() => import('@/views/admin/learn/Map.vue'), 'adminLearnMap'), meta: { title: 'routes.adminLearnMap' } },
      { path: 'learn/topic', name: 'adminLearnTopic', component: safeImport(() => import('@/views/admin/learn/Topic.vue'), 'adminLearnTopic'), meta: { title: 'routes.adminLearnTopic' } },
      { path: 'learn/topic-category', name: 'adminLearnTopicCategory', component: safeImport(() => import('@/views/admin/learn/TopicCategory.vue'), 'adminLearnTopicCategory'), meta: { title: 'routes.adminLearnTopicCategory' } },
      { path: 'learn/order', name: 'adminLearnOrder', component: safeImport(() => import('@/views/admin/learn/Order.vue'), 'adminLearnOrder'), meta: { title: 'routes.adminLearnOrder' } },
      { path: 'learn/order-invoice-title', name: 'adminLearnOrderInvoiceTitle', component: safeImport(() => import('@/views/admin/learn/OrderInvoiceTitle.vue'), 'adminLearnOrderInvoiceTitle'), meta: { title: 'routes.adminLearnOrderInvoiceTitle' } },
      { path: 'learn/order-invoice-application', name: 'adminLearnOrderInvoiceApplication', component: safeImport(() => import('@/views/admin/learn/OrderInvoiceApplication.vue'), 'adminLearnOrderInvoiceApplication'), meta: { title: 'routes.adminLearnOrderInvoiceApplication' } },
      { path: 'learn/signup', name: 'adminLearnSignup', component: safeImport(() => import('@/views/admin/learn/Signup.vue'), 'adminLearnSignup'), meta: { title: 'routes.adminLearnSignup' } },
      { path: 'learn/report', name: 'adminLearnReport', component: safeImport(() => import('@/views/admin/learn/Report.vue'), 'adminLearnReport'), meta: { title: 'routes.adminLearnReport' } },
      { path: 'exam/list', name: 'adminExamList', component: safeImport(() => import('@/views/admin/exam/List.vue'), 'adminExamList'), meta: { title: 'routes.adminExamList' } },
      { path: 'exam/paper', name: 'adminExamPaper', component: safeImport(() => import('@/views/admin/exam/Paper.vue'), 'adminExamPaper'), meta: { title: 'routes.adminExamPaper' } },
      { path: 'exam/paper-mock', name: 'adminExamPaperMock', component: safeImport(() => import('@/views/admin/exam/PaperMock.vue'), 'adminExamPaperMock'), meta: { title: 'routes.adminExamPaperMock' } },
      { path: 'exam/paper-normal', name: 'adminExamPaperNormal', component: safeImport(() => import('@/views/admin/exam/PaperNormal.vue'), 'adminExamPaperNormal'), meta: { title: 'routes.adminExamPaperNormal' } },
      { path: 'exam/paper-random', name: 'adminExamPaperRandom', component: safeImport(() => import('@/views/admin/exam/PaperRandom.vue'), 'adminExamPaperRandom'), meta: { title: 'routes.adminExamPaperRandom' } },
      { path: 'exam/paper-category', name: 'adminExamPaperCategory', component: safeImport(() => import('@/views/admin/exam/PaperCategory.vue'), 'adminExamPaperCategory'), meta: { title: 'routes.adminExamPaperCategory' } },
      { path: 'exam/question', name: 'adminExamQuestion', component: safeImport(() => import('@/views/admin/exam/Question.vue'), 'adminExamQuestion'), meta: { title: 'routes.adminExamQuestion' } },
      { path: 'exam/question-category', name: 'adminExamQuestionCategory', component: safeImport(() => import('@/views/admin/exam/QuestionCategory.vue'), 'adminExamQuestionCategory'), meta: { title: 'routes.adminExamQuestionCategory' } },
      { path: 'exam/question-single', name: 'adminExamQuestionSingle', component: safeImport(() => import('@/views/admin/exam/QuestionSingle.vue'), 'adminExamQuestionSingle'), meta: { title: 'routes.adminExamQuestionSingle' } },
      { path: 'exam/question-multi', name: 'adminExamQuestionMulti', component: safeImport(() => import('@/views/admin/exam/QuestionMulti.vue'), 'adminExamQuestionMulti'), meta: { title: 'routes.adminExamQuestionMulti' } },
      { path: 'exam/question-judgment', name: 'adminExamQuestionJudgment', component: safeImport(() => import('@/views/admin/exam/QuestionJudgment.vue'), 'adminExamQuestionJudgment'), meta: { title: 'routes.adminExamQuestionJudgment' } },
      { path: 'exam/question-fill', name: 'adminExamQuestionFill', component: safeImport(() => import('@/views/admin/exam/QuestionFill.vue'), 'adminExamQuestionFill'), meta: { title: 'routes.adminExamQuestionFill' } },
      { path: 'exam/question-subjective', name: 'adminExamQuestionSubjective', component: safeImport(() => import('@/views/admin/exam/QuestionSubjective.vue'), 'adminExamQuestionSubjective'), meta: { title: 'routes.adminExamQuestionSubjective' } },
      { path: 'exam/answer', name: 'adminExamAnswer', component: safeImport(() => import('@/views/admin/exam/Answer.vue'), 'adminExamAnswer'), meta: { title: 'routes.adminExamAnswer' } },
      { path: 'exam/answer-detail', name: 'adminExamAnswerDetail', component: safeImport(() => import('@/views/admin/exam/AnswerDetail.vue'), 'adminExamAnswerDetail'), meta: { title: 'routes.adminExamAnswerDetail' } },
      { path: 'live/channel', name: 'adminLiveChannel', component: safeImport(() => import('@/views/admin/live/Channel.vue'), 'adminLiveChannel'), meta: { title: 'routes.adminLiveChannel' } },
      { path: 'live/lecturer', name: 'adminLiveLecturer', component: safeImport(() => import('@/views/admin/live/Lecturer.vue'), 'adminLiveLecturer'), meta: { title: 'routes.adminLiveLecturer' } },
      { path: 'live/category', name: 'adminLiveCategory', component: safeImport(() => import('@/views/admin/live/Category.vue'), 'adminLiveCategory'), meta: { title: 'routes.adminLiveCategory' } },
      { path: 'ask/question', name: 'adminAskQuestion', component: safeImport(() => import('@/views/admin/ask/Question.vue'), 'adminAskQuestion'), meta: { title: 'routes.adminAskQuestion' } },
      { path: 'ask/category', name: 'adminAskCategory', component: safeImport(() => import('@/views/admin/ask/Category.vue'), 'adminAskCategory'), meta: { title: 'routes.adminAskCategory' } },
      { path: 'circle/list', name: 'adminCircleList', component: safeImport(() => import('@/views/admin/circle/List.vue'), 'adminCircleList'), meta: { title: 'routes.adminCircleList' } },
      { path: 'circle/dynamic', name: 'adminCircleDynamic', component: safeImport(() => import('@/views/admin/circle/Dynamic.vue'), 'adminCircleDynamic'), meta: { title: 'routes.adminCircleDynamic' } },
      { path: 'circle/category', name: 'adminCircleCategory', component: safeImport(() => import('@/views/admin/circle/Category.vue'), 'adminCircleCategory'), meta: { title: 'routes.adminCircleCategory' } },
      { path: 'article/content', name: 'adminArticleContent', component: safeImport(() => import('@/views/admin/article/Content.vue'), 'adminArticleContent'), meta: { title: 'routes.adminArticleContent' } },
      { path: 'article/category', name: 'adminArticleCategory', component: safeImport(() => import('@/views/admin/article/Category.vue'), 'adminArticleCategory'), meta: { title: 'routes.adminArticleCategory' } },
      { path: 'comment/list', name: 'adminCommentList', component: safeImport(() => import('@/views/admin/comment/List.vue'), 'adminCommentList'), meta: { title: 'routes.adminCommentList' } },
      { path: 'comment/sensitive', name: 'adminCommentSensitive', component: safeImport(() => import('@/views/admin/comment/Sensitive.vue'), 'adminCommentSensitive'), meta: { title: 'routes.adminCommentSensitive' } },
      { path: 'news/content', name: 'adminNewsContent', component: safeImport(() => import('@/views/admin/news/Content.vue'), 'adminNewsContent'), meta: { title: 'routes.adminNewsContent' } },
      { path: 'resource/list', name: 'adminResourceList', component: safeImport(() => import('@/views/admin/resource/List.vue'), 'adminResourceList'), meta: { title: 'routes.adminResourceList' } },
      { path: 'resource/category', name: 'adminResourceCategory', component: safeImport(() => import('@/views/admin/resource/Category.vue'), 'adminResourceCategory'), meta: { title: 'routes.adminResourceCategory' } },
      { path: 'resource/tag', name: 'adminResourceTag', component: safeImport(() => import('@/views/admin/resource/Tag.vue'), 'adminResourceTag'), meta: { title: 'routes.adminResourceTag' } },
      { path: 'point/list', name: 'adminPointList', component: safeImport(() => import('@/views/admin/point/List.vue'), 'adminPointList'), meta: { title: 'routes.adminPointList' } },
      { path: 'point/channel', name: 'adminPointChannel', component: safeImport(() => import('@/views/admin/point/Channel.vue'), 'adminPointChannel'), meta: { title: 'routes.adminPointChannel' } },
      { path: 'point/record', name: 'adminPointRecord', component: safeImport(() => import('@/views/admin/point/Record.vue'), 'adminPointRecord'), meta: { title: 'routes.adminPointRecord' } },
      { path: 'certificate/template', name: 'adminCertificateTemplate', component: safeImport(() => import('@/views/admin/certificate/Template.vue'), 'adminCertificateTemplate'), meta: { title: 'routes.adminCertificateTemplate' } },
      { path: 'message/announcement', name: 'adminMessageAnnouncement', component: safeImport(() => import('@/views/admin/message/Announcement.vue'), 'adminMessageAnnouncement'), meta: { title: 'routes.adminMessageAnnouncement' } },
      { path: 'auth/role', name: 'adminAuthRole', component: safeImport(() => import('@/views/admin/auth/Role.vue'), 'adminAuthRole'), meta: { title: 'routes.adminAuthRole' } },
      { path: 'auth/authority', name: 'adminAuthAuthority', component: safeImport(() => import('@/views/admin/auth/Authority.vue'), 'adminAuthAuthority'), meta: { title: 'routes.adminAuthAuthority' } },
      { path: 'setting', name: 'adminSetting', component: safeImport(() => import('@/views/admin/setting/Index.vue'), 'adminSetting'), meta: { title: 'routes.adminSetting' } },
      { path: 'setting/carousel', name: 'adminSettingCarousel', component: safeImport(() => import('@/views/admin/setting/Carousel.vue'), 'adminSettingCarousel'), meta: { title: 'routes.adminSettingCarousel' } },
      { path: 'setting/agreement', name: 'adminSettingAgreement', component: safeImport(() => import('@/views/admin/setting/Agreement.vue'), 'adminSettingAgreement'), meta: { title: 'routes.adminSettingAgreement' } },
      { path: 'search/hot', name: 'adminSearchHot', component: safeImport(() => import('@/views/admin/search/Hot.vue'), 'adminSearchHot'), meta: { title: 'routes.adminSearchHot' } },
      { path: 'aiworld/site', name: 'adminAiworldSite', component: safeImport(() => import('@/views/admin/aiworld/Site.vue'), 'adminAiworldSite'), meta: { title: 'routes.adminAiworldSite' } },
      { path: 'sms/template', name: 'adminSmsTemplate', component: safeImport(() => import('@/views/admin/sms/Template.vue'), 'adminSmsTemplate'), meta: { title: 'routes.adminSmsTemplate' } },
    ],
  },
]
