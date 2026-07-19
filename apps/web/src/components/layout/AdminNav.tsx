'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  Users,
  FolderCog,
  ShoppingCart,
  ShieldCheck,
  Shield,
  Lock,
  Workflow,
  Tag,
  MessageSquare,
  Megaphone,
  FileText,
  HelpCircle,
  SlidersHorizontal,
  Plug,
  ScrollText,
  Activity,
  GraduationCap,
  BookOpen,
  UserCheck,
  Package,
  Radio,
  Newspaper,
  Award,
  Coins,
  Bot,
  Wallet,
  LayoutGrid,
  Server,
  Gauge,
  Database,
  GitBranch,
  Terminal,
  FolderTree,
  ListChecks,
  BarChart3,
  Code2,
  BookMarked,
  MessageSquareReply,
  Smartphone,
  AlertTriangle,
  MonitorCog,
  Receipt,
  Banknote,
  Ban,
  CreditCard,
  Filter,
  KeyRound,
  ShoppingBag,
  BadgeCheck,
  Images,
  Sparkles,
  Megaphone as AdIcon,
  Link2,
  Percent,
  Box,
  AudioLines,
  FileImage,
  Building2,
  School,
  UserSquare,
  IdCard,
  ClipboardCheck,
  CreditCard as PayIcon,
  ScrollText as LogIcon,
  UserCog,
  History,
  Hash,
  CalendarClock,
  Network,
  FileSearch,
  UserPlus,
  Files,
  Bell,
  BellRing,
  Eye,
  RotateCcw,
  Settings,
  ChevronDown,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAdminRouters } from '@/hooks/use-admin-routers'

interface AdminNavItem {
  href: string
  labelKey:
    | 'dashboard'
    | 'users'
    | 'projects'
    | 'settings'
    | 'orders'
    | 'roles'
    | 'permissions'
    | 'workflows'
    | 'tags'
    | 'feedbacks'
    | 'announcements'
    | 'docs'
    | 'help'
    | 'configs'
    | 'integrations'
    | 'logs'
    | 'events'
    | 'exam'
    | 'learn'
    | 'members'
    | 'resources'
    | 'live'
    | 'news'
    | 'certificate'
    | 'point'
    | 'agents'
    | 'agentCategories'
    | 'agentExamine'
    | 'agentSettlement'
    | 'demandSquare'
    | 'backendHealth'
    | 'performanceDashboard'
    | 'databaseOptimization'
    | 'eventBusMonitor'
    | 'grayRelease'
    | 'apiDebug'
    | 'apiGroups'
    | 'apiLogs'
    | 'apiUsage'
    | 'developer'
    | 'dict'
    | 'sms'
    | 'notificationChannels'
    | 'notificationPreferences'
    | 'notificationLogs'
    | 'recommendationConfig'
    | 'mobileAdapter'
    | 'oauthAuditDashboard'
    | 'errorDashboard'
    | 'monitoringDashboard'
    | 'refund'
    | 'apiPlatformApps'
    | 'apiPlatformPackages'
    | 'apiPlatformBilling'
    | 'apiPlatformUsage'
    | 'shopProducts'
    | 'shopPayments'
    | 'shopWithdrawals'
    | 'shopFunds'
    | 'oauthApps'
    | 'oauthAudit'
    | 'oauthTokens'
    | 'monitorDashboard'
    | 'monitorFunnel'
    | 'monitorAlerts'
    | 'memberUsers'
    | 'memberRoles'
    | 'memberPermissions'
    | 'memberLogs'
    | 'memberBlacklist'
    | 'systemMonitor'
    | 'systemConfig'
    | 'systemTasks'
    | 'realnameAudit'
    | 'agentRules'
    | 'taskDeveloper'
    | 'contact'
    | 'aboutUs'
    | 'aiGc'
    | 'advertise'
    | 'carousel'
    | 'zhsAgent'
    | 'zhsUser'
    | 'zhsActivity'
    | 'agentTask'
    | 'agentRule'
    | 'developerLink'
    | 'identityProportion'
    | 'productIdentity'
    | 'userAgentAudio'
    | 'userAgentContext'
    | 'userAgentImage'
    | 'authAccounts'
    | 'authDept'
    | 'authFindInfo'
    | 'authRole'
    | 'authUserVip'
    | 'authVeriCodes'
    | 'loginLogs'
    | 'userCenter'
    | 'eduOrganization'
    | 'eduPlatform'
    | 'eduUserPlatform'
    | 'eduZhsIdentity'
    | 'eduCourseAudit'
    | 'eduCoursePay'
    | 'eduCoursePlatformLog'
    | 'systemLoginLogs'
    | 'systemOperationLogs'
    | 'systemTasksLog'
    | 'rolesAuthUser'
    | 'rolesSelectUser'
    | 'ossFiles'
    | 'notificationDispatch'
    | 'messageOverview'
    | 'visitTracking'
    | 'examMarking'
    | 'crew'
    | 'knowledgeRag'
  icon: React.ComponentType<{ className?: string }>
  dynamicLabel?: string
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/admin/users', labelKey: 'users', icon: Users },
  { href: '/admin/members', labelKey: 'members', icon: UserCheck },
  { href: '/admin/projects', labelKey: 'projects', icon: FolderCog },
  { href: '/admin/orders', labelKey: 'orders', icon: ShoppingCart },
  { href: '/admin/refund', labelKey: 'refund', icon: Receipt },
  { href: '/admin/edu/exam', labelKey: 'exam', icon: GraduationCap },
  { href: '/admin/edu/learn', labelKey: 'learn', icon: BookOpen },
  { href: '/admin/resources', labelKey: 'resources', icon: Package },
  { href: '/admin/live', labelKey: 'live', icon: Radio },
  { href: '/admin/point', labelKey: 'point', icon: Coins },
  { href: '/admin/news', labelKey: 'news', icon: Newspaper },
  { href: '/admin/edu/certificate', labelKey: 'certificate', icon: Award },
  // R3: 智能体市场
  { href: '/admin/agents', labelKey: 'agents', icon: Bot },
  { href: '/admin/agents/categories', labelKey: 'agentCategories', icon: Tag },
  { href: '/admin/agents/examine', labelKey: 'agentExamine', icon: ShieldCheck },
  { href: '/admin/agents/settlement', labelKey: 'agentSettlement', icon: Wallet },
  { href: '/admin/agent-rules', labelKey: 'agentRules', icon: Shield },
  { href: '/admin/demand-square', labelKey: 'demandSquare', icon: LayoutGrid },
  // R6: 运维监控
  { href: '/admin/monitoring-dashboard', labelKey: 'monitoringDashboard', icon: MonitorCog },
  { href: '/admin/backend-health', labelKey: 'backendHealth', icon: Server },
  { href: '/admin/performance-dashboard', labelKey: 'performanceDashboard', icon: Gauge },
  { href: '/admin/error-dashboard', labelKey: 'errorDashboard', icon: AlertTriangle },
  { href: '/admin/database-optimization', labelKey: 'databaseOptimization', icon: Database },
  { href: '/admin/event-bus-monitor', labelKey: 'eventBusMonitor', icon: Activity },
  { href: '/admin/gray-release', labelKey: 'grayRelease', icon: GitBranch },
  // R6: API 管理
  { href: '/admin/api-debug', labelKey: 'apiDebug', icon: Terminal },
  { href: '/admin/api-groups', labelKey: 'apiGroups', icon: FolderTree },
  { href: '/admin/api-logs', labelKey: 'apiLogs', icon: ListChecks },
  { href: '/admin/api-usage', labelKey: 'apiUsage', icon: BarChart3 },
  // R6: 开发者工具
  { href: '/admin/developer', labelKey: 'developer', icon: Code2 },
  { href: '/admin/dict', labelKey: 'dict', icon: BookMarked },
  { href: '/admin/sms', labelKey: 'sms', icon: MessageSquareReply },
  { href: '/admin/notification-channels', labelKey: 'notificationChannels', icon: BellRing },
  {
    href: '/admin/notification-preferences',
    labelKey: 'notificationPreferences',
    icon: SlidersHorizontal,
  },
  { href: '/admin/notification-logs', labelKey: 'notificationLogs', icon: ScrollText },
  {
    href: '/admin/recommendation-config',
    labelKey: 'recommendationConfig',
    icon: SlidersHorizontal,
  },
  // R6: 其他工具
  { href: '/admin/mobile-adapter', labelKey: 'mobileAdapter', icon: Smartphone },
  { href: '/admin/oauth-audit-dashboard', labelKey: 'oauthAuditDashboard', icon: Shield },
  { href: '/admin/feedbacks', labelKey: 'feedbacks', icon: MessageSquare },
  { href: '/admin/announcements', labelKey: 'announcements', icon: Megaphone },
  { href: '/admin/docs', labelKey: 'docs', icon: FileText },
  { href: '/admin/help', labelKey: 'help', icon: HelpCircle },
  { href: '/admin/roles', labelKey: 'roles', icon: Shield },
  { href: '/admin/permissions', labelKey: 'permissions', icon: Lock },
  { href: '/admin/workflows', labelKey: 'workflows', icon: Workflow },
  { href: '/admin/tags', labelKey: 'tags', icon: Tag },
  { href: '/admin/configs', labelKey: 'configs', icon: SlidersHorizontal },
  { href: '/admin/integrations', labelKey: 'integrations', icon: Plug },
  { href: '/admin/logs', labelKey: 'logs', icon: ScrollText },
  { href: '/admin/events', labelKey: 'events', icon: Activity },
  // API 平台管理
  { href: '/admin/api-platform/apps', labelKey: 'apiPlatformApps', icon: Plug },
  { href: '/admin/api-platform/packages', labelKey: 'apiPlatformPackages', icon: Package },
  { href: '/admin/api-platform/billing', labelKey: 'apiPlatformBilling', icon: CreditCard },
  { href: '/admin/api-platform/usage', labelKey: 'apiPlatformUsage', icon: BarChart3 },
  // 商品管理
  { href: '/admin/shop/products', labelKey: 'shopProducts', icon: ShoppingBag },
  { href: '/admin/shop/payments', labelKey: 'shopPayments', icon: CreditCard },
  { href: '/admin/shop/withdrawals', labelKey: 'shopWithdrawals', icon: Banknote },
  { href: '/admin/shop/funds', labelKey: 'shopFunds', icon: Wallet },
  // OAuth 开放平台
  { href: '/admin/oauth/apps', labelKey: 'oauthApps', icon: Plug },
  { href: '/admin/oauth/audit', labelKey: 'oauthAudit', icon: Shield },
  { href: '/admin/oauth/tokens', labelKey: 'oauthTokens', icon: KeyRound },
  // 监控总仪表盘
  { href: '/admin/monitor/dashboard', labelKey: 'monitorDashboard', icon: MonitorCog },
  { href: '/admin/monitor/funnel', labelKey: 'monitorFunnel', icon: Filter },
  { href: '/admin/monitor/alerts', labelKey: 'monitorAlerts', icon: AlertTriangle },
  // 会员管理
  { href: '/admin/member/users', labelKey: 'memberUsers', icon: Users },
  { href: '/admin/member/roles', labelKey: 'memberRoles', icon: ShieldCheck },
  { href: '/admin/member/permissions', labelKey: 'memberPermissions', icon: Lock },
  { href: '/admin/member/logs', labelKey: 'memberLogs', icon: ScrollText },
  { href: '/admin/member/blacklist', labelKey: 'memberBlacklist', icon: Ban },
  // 系统管理
  { href: '/admin/system/monitor', labelKey: 'systemMonitor', icon: Activity },
  { href: '/admin/system/tasks', labelKey: 'systemTasks', icon: ListChecks },
  // R65: 实名认证审核
  { href: '/admin/realname-audit', labelKey: 'realnameAudit', icon: BadgeCheck },
  // P0/P1 补齐页面（2026-07-12）
  // AI 模块扩展
  { href: '/admin/task-developer', labelKey: 'taskDeveloper', icon: Terminal },
  { href: '/admin/agent-rule', labelKey: 'agentRule', icon: Shield },
  { href: '/admin/agent-task', labelKey: 'agentTask', icon: ClipboardCheck },
  { href: '/admin/advertise', labelKey: 'advertise', icon: AdIcon },
  { href: '/admin/carousel', labelKey: 'carousel', icon: Images },
  { href: '/admin/ai-gc', labelKey: 'aiGc', icon: Sparkles },
  // P3: 多智能体协作 + RAG 知识库
  { href: '/admin/crew', labelKey: 'crew', icon: Bot },
  { href: '/admin/knowledge-rag', labelKey: 'knowledgeRag', icon: BookOpen },
  { href: '/admin/developer-link', labelKey: 'developerLink', icon: Link2 },
  { href: '/admin/identity-proportion', labelKey: 'identityProportion', icon: Percent },
  { href: '/admin/product-identity', labelKey: 'productIdentity', icon: Box },
  { href: '/admin/user-agent-audio', labelKey: 'userAgentAudio', icon: AudioLines },
  { href: '/admin/user-agent-context', labelKey: 'userAgentContext', icon: FileText },
  { href: '/admin/user-agent-image', labelKey: 'userAgentImage', icon: FileImage },
  { href: '/admin/zhs-activity', labelKey: 'zhsActivity', icon: CalendarClock },
  { href: '/admin/zhs-agent', labelKey: 'zhsAgent', icon: Bot },
  { href: '/admin/zhs-user', labelKey: 'zhsUser', icon: Users },
  // Auth 模块扩展
  { href: '/admin/auth-accounts', labelKey: 'authAccounts', icon: Link2 },
  { href: '/admin/auth-dept', labelKey: 'authDept', icon: Network },
  { href: '/admin/auth-find-info', labelKey: 'authFindInfo', icon: HelpCircle },
  { href: '/admin/auth-role', labelKey: 'authRole', icon: Shield },
  { href: '/admin/auth-user-vip', labelKey: 'authUserVip', icon: BadgeCheck },
  { href: '/admin/auth-veri-codes', labelKey: 'authVeriCodes', icon: Hash },
  { href: '/admin/login-logs', labelKey: 'loginLogs', icon: History },
  { href: '/admin/user-center', labelKey: 'userCenter', icon: UserCog },
  // 教育模块扩展
  { href: '/admin/edu/organization', labelKey: 'eduOrganization', icon: Building2 },
  { href: '/admin/edu/platform', labelKey: 'eduPlatform', icon: School },
  { href: '/admin/edu/user-platform', labelKey: 'eduUserPlatform', icon: UserSquare },
  { href: '/admin/edu/zhs-identity', labelKey: 'eduZhsIdentity', icon: IdCard },
  { href: '/admin/edu/course/audit', labelKey: 'eduCourseAudit', icon: ClipboardCheck },
  { href: '/admin/edu/course/pay', labelKey: 'eduCoursePay', icon: PayIcon },
  { href: '/admin/edu/course/platform-log', labelKey: 'eduCoursePlatformLog', icon: LogIcon },
  // System 模块扩展
  { href: '/admin/system/login-logs', labelKey: 'systemLoginLogs', icon: History },
  { href: '/admin/system/operation-logs', labelKey: 'systemOperationLogs', icon: FileSearch },
  { href: '/admin/system/tasks/log', labelKey: 'systemTasksLog', icon: LogIcon },
  { href: '/admin/roles/auth-user', labelKey: 'rolesAuthUser', icon: UserCheck },
  { href: '/admin/roles/select-user', labelKey: 'rolesSelectUser', icon: UserPlus },
  // 文件管理
  { href: '/admin/oss/files', labelKey: 'ossFiles', icon: Files },
  // 定向通知派发
  { href: '/admin/notification-dispatch', labelKey: 'notificationDispatch', icon: Bell },
  // 官方页面
  { href: '/admin/contact', labelKey: 'contact', icon: MessageSquare },
  { href: '/admin/about-us', labelKey: 'aboutUs', icon: FileText },
  // R90: 运营监控 + 教育批阅
  { href: '/admin/message-overview', labelKey: 'messageOverview', icon: BarChart3 },
  { href: '/admin/visit-tracking', labelKey: 'visitTracking', icon: BarChart3 },
  { href: '/admin/exam-marking', labelKey: 'examMarking', icon: ClipboardCheck },
  // P1: 73 个运营域模块（audit 新增）
  // 运营管理
  { href: '/admin/operlog', labelKey: 'dashboard', icon: Activity, dynamicLabel: 'Operation Log' },
  { href: '/admin/logininfor', labelKey: 'dashboard', icon: History, dynamicLabel: 'Login Info' },
  { href: '/admin/online', labelKey: 'dashboard', icon: Users, dynamicLabel: 'Online Users' },
  { href: '/admin/notice', labelKey: 'dashboard', icon: Megaphone, dynamicLabel: 'Notice' },
  { href: '/admin/config', labelKey: 'dashboard', icon: SlidersHorizontal, dynamicLabel: 'Config' },
  { href: '/admin/job', labelKey: 'dashboard', icon: CalendarClock, dynamicLabel: 'Scheduled Job' },
  { href: '/admin/gen', labelKey: 'dashboard', icon: Code2, dynamicLabel: 'Code Generator' },
  // 内容审核
  { href: '/admin/article', labelKey: 'dashboard', icon: FileText, dynamicLabel: 'Article Review' },
  { href: '/admin/course', labelKey: 'dashboard', icon: GraduationCap, dynamicLabel: 'Course Review' },
  { href: '/admin/examPaper', labelKey: 'dashboard', icon: FileText, dynamicLabel: 'Exam Paper Review' },
  { href: '/admin/examQuestion', labelKey: 'dashboard', icon: HelpCircle, dynamicLabel: 'Exam Question Review' },
  { href: '/admin/liveChannel', labelKey: 'dashboard', icon: Radio, dynamicLabel: 'Live Channel Review' },
  { href: '/admin/sensitiveWord', labelKey: 'dashboard', icon: AlertTriangle, dynamicLabel: 'Sensitive Words' },
  { href: '/admin/feedbackMsg', labelKey: 'dashboard', icon: MessageSquare, dynamicLabel: 'Feedback Messages' },
  // 财务管理
  { href: '/admin/wallet', labelKey: 'dashboard', icon: Wallet, dynamicLabel: 'Wallet' },
  { href: '/admin/withdrawal', labelKey: 'dashboard', icon: Banknote, dynamicLabel: 'Withdrawal' },
  { href: '/admin/commission', labelKey: 'dashboard', icon: Percent, dynamicLabel: 'Commission' },
  { href: '/admin/invoice', labelKey: 'dashboard', icon: Receipt, dynamicLabel: 'Invoice' },
  { href: '/admin/tax', labelKey: 'dashboard', icon: FileText, dynamicLabel: 'Tax' },
  // AI 智能体
  { href: '/admin/agentCategory', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'Agent Category' },
  { href: '/admin/agentRule', labelKey: 'dashboard', icon: Shield, dynamicLabel: 'Agent Rule' },
  { href: '/admin/agentExamine', labelKey: 'dashboard', icon: ShieldCheck, dynamicLabel: 'Agent Examine' },
  { href: '/admin/llmConfig', labelKey: 'dashboard', icon: SlidersHorizontal, dynamicLabel: 'LLM Config' },
  // 营销直播
  { href: '/admin/activity', labelKey: 'dashboard', icon: Sparkles, dynamicLabel: 'Activity' },
  { href: '/admin/coupon', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'Coupon' },
  { href: '/admin/banner', labelKey: 'dashboard', icon: Images, dynamicLabel: 'Banner' },
  { href: '/admin/invitation', labelKey: 'dashboard', icon: UserPlus, dynamicLabel: 'Invitation' },
  { href: '/admin/signinRule', labelKey: 'dashboard', icon: CalendarClock, dynamicLabel: 'Sign-in Rule' },
  { href: '/admin/lecturer', labelKey: 'dashboard', icon: UserCheck, dynamicLabel: 'Lecturer' },
  { href: '/admin/liveRecord', labelKey: 'dashboard', icon: FileText, dynamicLabel: 'Live Record' },
  { href: '/admin/liveGift', labelKey: 'dashboard', icon: Award, dynamicLabel: 'Live Gift' },
  { href: '/admin/lecturerGrade', labelKey: 'dashboard', icon: Award, dynamicLabel: 'Lecturer Grade' },
  // 课程考试
  { href: '/admin/courseChapter', labelKey: 'dashboard', icon: BookOpen, dynamicLabel: 'Course Chapter' },
  { href: '/admin/courseSection', labelKey: 'dashboard', icon: ListChecks, dynamicLabel: 'Course Section' },
  { href: '/admin/learnMap', labelKey: 'dashboard', icon: Network, dynamicLabel: 'Learn Map' },
  { href: '/admin/certificate', labelKey: 'dashboard', icon: Award, dynamicLabel: 'Certificate' },
  { href: '/admin/examAnswer', labelKey: 'dashboard', icon: FileText, dynamicLabel: 'Exam Answer' },
  { href: '/admin/examCategory', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'Exam Category' },
  { href: '/admin/questionCategory', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'Question Category' },
  { href: '/admin/examRandomPaper', labelKey: 'dashboard', icon: LayoutGrid, dynamicLabel: 'Exam Random Paper' },
  { href: '/admin/examMockPaper', labelKey: 'dashboard', icon: FileText, dynamicLabel: 'Exam Mock Paper' },
  { href: '/admin/examRecord', labelKey: 'dashboard', icon: History, dynamicLabel: 'Exam Record' },
  { href: '/admin/questionImport', labelKey: 'dashboard', icon: FileText, dynamicLabel: 'Question Import' },
  { href: '/admin/paperTemplate', labelKey: 'dashboard', icon: LayoutGrid, dynamicLabel: 'Paper Template' },
  // 监控 BI
  { href: '/admin/dashboardStat', labelKey: 'dashboard', icon: BarChart3, dynamicLabel: 'Dashboard Stat' },
  { href: '/admin/userStat', labelKey: 'dashboard', icon: Users, dynamicLabel: 'User Stat' },
  { href: '/admin/revenueStat', labelKey: 'dashboard', icon: Banknote, dynamicLabel: 'Revenue Stat' },
  { href: '/admin/contentStat', labelKey: 'dashboard', icon: FileText, dynamicLabel: 'Content Stat' },
  { href: '/admin/cacheMonitor', labelKey: 'dashboard', icon: Server, dynamicLabel: 'Cache Monitor' },
  { href: '/admin/dbMonitor', labelKey: 'dashboard', icon: Database, dynamicLabel: 'DB Monitor' },
  { href: '/admin/visitTrend', labelKey: 'dashboard', icon: BarChart3, dynamicLabel: 'Visit Trend' },
  { href: '/admin/redisMonitor', labelKey: 'dashboard', icon: Server, dynamicLabel: 'Redis Monitor' },
  // 客服工单
  { href: '/admin/ticket', labelKey: 'dashboard', icon: MessageSquare, dynamicLabel: 'Ticket' },
  { href: '/admin/ticketReply', labelKey: 'dashboard', icon: MessageSquareReply, dynamicLabel: 'Ticket Reply' },
  { href: '/admin/fileTag', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'File Tag' },
  { href: '/admin/fileShare', labelKey: 'dashboard', icon: Link2, dynamicLabel: 'File Share' },
  { href: '/admin/fileRecycle', labelKey: 'dashboard', icon: RotateCcw, dynamicLabel: 'File Recycle' },
  { href: '/admin/filePreview', labelKey: 'dashboard', icon: Eye, dynamicLabel: 'File Preview' },
  { href: '/admin/ossConfig', labelKey: 'dashboard', icon: Server, dynamicLabel: 'OSS Config' },
  // 社区圈子
  { href: '/admin/circleCategory', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'Circle Category' },
  { href: '/admin/circleMember', labelKey: 'dashboard', icon: Users, dynamicLabel: 'Circle Member' },
  { href: '/admin/circleTopic', labelKey: 'dashboard', icon: MessageSquare, dynamicLabel: 'Circle Topic' },
  { href: '/admin/circleDynamic', labelKey: 'dashboard', icon: Activity, dynamicLabel: 'Circle Dynamic' },
  { href: '/admin/askCategory', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'Ask Category' },
  { href: '/admin/articleCategory', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'Article Category' },
  { href: '/admin/newsCategory', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'News Category' },
  // 资源中心
  { href: '/admin/resourceTag', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'Resource Tag' },
  { href: '/admin/resourceProduct', labelKey: 'dashboard', icon: Package, dynamicLabel: 'Resource Product' },
  // 开发者中心
  { href: '/admin/devFund', labelKey: 'dashboard', icon: Banknote, dynamicLabel: 'Dev Fund' },
  { href: '/admin/devProduct', labelKey: 'dashboard', icon: Code2, dynamicLabel: 'Dev Product' },
  { href: '/admin/commissionRule', labelKey: 'dashboard', icon: Percent, dynamicLabel: 'Commission Rule' },
  { href: '/admin/menuPermission', labelKey: 'dashboard', icon: Lock, dynamicLabel: 'Menu Permission' },
  { href: '/admin/dataScope', labelKey: 'dashboard', icon: Lock, dynamicLabel: 'Data Scope' },
]

/**
 * 11 大运营域可折叠分组
 * - 73 个 audit 新增 item 归属到对应分组
 * - 默认全部展开
 * - localStorage key `adminNav.collapsed` 记忆用户折叠偏好
 */
type AdminGroupKey =
  | 'operation'
  | 'moderation'
  | 'finance'
  | 'aiAgent'
  | 'marketing'
  | 'courseExam'
  | 'analytics'
  | 'support'
  | 'community'
  | 'resource'
  | 'developer'

export interface AdminNavGroup {
  groupKey: AdminGroupKey
  icon: React.ComponentType<{ className?: string }>
  items: AdminNavItem[]
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  // 运营管理
  {
    groupKey: 'operation',
    icon: Settings,
    items: [
      { href: '/admin/operlog', labelKey: 'dashboard', icon: Activity, dynamicLabel: 'Operation Log' },
      { href: '/admin/logininfor', labelKey: 'dashboard', icon: History, dynamicLabel: 'Login Info' },
      { href: '/admin/online', labelKey: 'dashboard', icon: Users, dynamicLabel: 'Online Users' },
      { href: '/admin/notice', labelKey: 'dashboard', icon: Megaphone, dynamicLabel: 'Notice' },
      { href: '/admin/config', labelKey: 'dashboard', icon: SlidersHorizontal, dynamicLabel: 'Config' },
      { href: '/admin/job', labelKey: 'dashboard', icon: CalendarClock, dynamicLabel: 'Scheduled Job' },
      { href: '/admin/gen', labelKey: 'dashboard', icon: Code2, dynamicLabel: 'Code Generator' },
    ],
  },
  // 内容审核
  {
    groupKey: 'moderation',
    icon: ShieldCheck,
    items: [
      { href: '/admin/article', labelKey: 'dashboard', icon: FileText, dynamicLabel: 'Article Review' },
      { href: '/admin/course', labelKey: 'dashboard', icon: GraduationCap, dynamicLabel: 'Course Review' },
      { href: '/admin/examPaper', labelKey: 'dashboard', icon: FileText, dynamicLabel: 'Exam Paper Review' },
      { href: '/admin/examQuestion', labelKey: 'dashboard', icon: HelpCircle, dynamicLabel: 'Exam Question Review' },
      { href: '/admin/liveChannel', labelKey: 'dashboard', icon: Radio, dynamicLabel: 'Live Channel Review' },
      { href: '/admin/sensitiveWord', labelKey: 'dashboard', icon: AlertTriangle, dynamicLabel: 'Sensitive Words' },
      { href: '/admin/feedbackMsg', labelKey: 'dashboard', icon: MessageSquare, dynamicLabel: 'Feedback Messages' },
    ],
  },
  // 财务管理
  {
    groupKey: 'finance',
    icon: Wallet,
    items: [
      { href: '/admin/wallet', labelKey: 'dashboard', icon: Wallet, dynamicLabel: 'Wallet' },
      { href: '/admin/withdrawal', labelKey: 'dashboard', icon: Banknote, dynamicLabel: 'Withdrawal' },
      { href: '/admin/commission', labelKey: 'dashboard', icon: Percent, dynamicLabel: 'Commission' },
      { href: '/admin/invoice', labelKey: 'dashboard', icon: Receipt, dynamicLabel: 'Invoice' },
      { href: '/admin/tax', labelKey: 'dashboard', icon: FileText, dynamicLabel: 'Tax' },
    ],
  },
  // AI 智能体
  {
    groupKey: 'aiAgent',
    icon: Bot,
    items: [
      { href: '/admin/agentCategory', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'Agent Category' },
      { href: '/admin/agentRule', labelKey: 'dashboard', icon: Shield, dynamicLabel: 'Agent Rule' },
      { href: '/admin/agentExamine', labelKey: 'dashboard', icon: ShieldCheck, dynamicLabel: 'Agent Examine' },
      { href: '/admin/llmConfig', labelKey: 'dashboard', icon: SlidersHorizontal, dynamicLabel: 'LLM Config' },
    ],
  },
  // 营销直播
  {
    groupKey: 'marketing',
    icon: Megaphone,
    items: [
      { href: '/admin/activity', labelKey: 'dashboard', icon: Sparkles, dynamicLabel: 'Activity' },
      { href: '/admin/coupon', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'Coupon' },
      { href: '/admin/banner', labelKey: 'dashboard', icon: Images, dynamicLabel: 'Banner' },
      { href: '/admin/invitation', labelKey: 'dashboard', icon: UserPlus, dynamicLabel: 'Invitation' },
      { href: '/admin/signinRule', labelKey: 'dashboard', icon: CalendarClock, dynamicLabel: 'Sign-in Rule' },
      { href: '/admin/lecturer', labelKey: 'dashboard', icon: UserCheck, dynamicLabel: 'Lecturer' },
      { href: '/admin/liveRecord', labelKey: 'dashboard', icon: FileText, dynamicLabel: 'Live Record' },
      { href: '/admin/liveGift', labelKey: 'dashboard', icon: Award, dynamicLabel: 'Live Gift' },
      { href: '/admin/lecturerGrade', labelKey: 'dashboard', icon: Award, dynamicLabel: 'Lecturer Grade' },
    ],
  },
  // 课程考试
  {
    groupKey: 'courseExam',
    icon: GraduationCap,
    items: [
      { href: '/admin/courseChapter', labelKey: 'dashboard', icon: BookOpen, dynamicLabel: 'Course Chapter' },
      { href: '/admin/courseSection', labelKey: 'dashboard', icon: ListChecks, dynamicLabel: 'Course Section' },
      { href: '/admin/learnMap', labelKey: 'dashboard', icon: Network, dynamicLabel: 'Learn Map' },
      { href: '/admin/certificate', labelKey: 'dashboard', icon: Award, dynamicLabel: 'Certificate' },
      { href: '/admin/examAnswer', labelKey: 'dashboard', icon: FileText, dynamicLabel: 'Exam Answer' },
      { href: '/admin/examCategory', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'Exam Category' },
      { href: '/admin/questionCategory', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'Question Category' },
      { href: '/admin/examRandomPaper', labelKey: 'dashboard', icon: LayoutGrid, dynamicLabel: 'Exam Random Paper' },
      { href: '/admin/examMockPaper', labelKey: 'dashboard', icon: FileText, dynamicLabel: 'Exam Mock Paper' },
      { href: '/admin/examRecord', labelKey: 'dashboard', icon: History, dynamicLabel: 'Exam Record' },
      { href: '/admin/questionImport', labelKey: 'dashboard', icon: FileText, dynamicLabel: 'Question Import' },
      { href: '/admin/paperTemplate', labelKey: 'dashboard', icon: LayoutGrid, dynamicLabel: 'Paper Template' },
    ],
  },
  // 监控 BI
  {
    groupKey: 'analytics',
    icon: BarChart3,
    items: [
      { href: '/admin/dashboardStat', labelKey: 'dashboard', icon: BarChart3, dynamicLabel: 'Dashboard Stat' },
      { href: '/admin/userStat', labelKey: 'dashboard', icon: Users, dynamicLabel: 'User Stat' },
      { href: '/admin/revenueStat', labelKey: 'dashboard', icon: Banknote, dynamicLabel: 'Revenue Stat' },
      { href: '/admin/contentStat', labelKey: 'dashboard', icon: FileText, dynamicLabel: 'Content Stat' },
      { href: '/admin/cacheMonitor', labelKey: 'dashboard', icon: Server, dynamicLabel: 'Cache Monitor' },
      { href: '/admin/dbMonitor', labelKey: 'dashboard', icon: Database, dynamicLabel: 'DB Monitor' },
      { href: '/admin/visitTrend', labelKey: 'dashboard', icon: BarChart3, dynamicLabel: 'Visit Trend' },
      { href: '/admin/redisMonitor', labelKey: 'dashboard', icon: Server, dynamicLabel: 'Redis Monitor' },
    ],
  },
  // 客服工单
  {
    groupKey: 'support',
    icon: MessageSquare,
    items: [
      { href: '/admin/ticket', labelKey: 'dashboard', icon: MessageSquare, dynamicLabel: 'Ticket' },
      { href: '/admin/ticketReply', labelKey: 'dashboard', icon: MessageSquareReply, dynamicLabel: 'Ticket Reply' },
      { href: '/admin/fileTag', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'File Tag' },
      { href: '/admin/fileShare', labelKey: 'dashboard', icon: Link2, dynamicLabel: 'File Share' },
      { href: '/admin/fileRecycle', labelKey: 'dashboard', icon: RotateCcw, dynamicLabel: 'File Recycle' },
      { href: '/admin/filePreview', labelKey: 'dashboard', icon: Eye, dynamicLabel: 'File Preview' },
      { href: '/admin/ossConfig', labelKey: 'dashboard', icon: Server, dynamicLabel: 'OSS Config' },
    ],
  },
  // 社区圈子
  {
    groupKey: 'community',
    icon: Users,
    items: [
      { href: '/admin/circleCategory', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'Circle Category' },
      { href: '/admin/circleMember', labelKey: 'dashboard', icon: Users, dynamicLabel: 'Circle Member' },
      { href: '/admin/circleTopic', labelKey: 'dashboard', icon: MessageSquare, dynamicLabel: 'Circle Topic' },
      { href: '/admin/circleDynamic', labelKey: 'dashboard', icon: Activity, dynamicLabel: 'Circle Dynamic' },
      { href: '/admin/askCategory', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'Ask Category' },
      { href: '/admin/articleCategory', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'Article Category' },
      { href: '/admin/newsCategory', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'News Category' },
    ],
  },
  // 资源中心
  {
    groupKey: 'resource',
    icon: Package,
    items: [
      { href: '/admin/resourceTag', labelKey: 'dashboard', icon: Tag, dynamicLabel: 'Resource Tag' },
      { href: '/admin/resourceProduct', labelKey: 'dashboard', icon: Package, dynamicLabel: 'Resource Product' },
    ],
  },
  // 开发者中心
  {
    groupKey: 'developer',
    icon: Code2,
    items: [
      { href: '/admin/devFund', labelKey: 'dashboard', icon: Banknote, dynamicLabel: 'Dev Fund' },
      { href: '/admin/devProduct', labelKey: 'dashboard', icon: Code2, dynamicLabel: 'Dev Product' },
      { href: '/admin/commissionRule', labelKey: 'dashboard', icon: Percent, dynamicLabel: 'Commission Rule' },
      { href: '/admin/menuPermission', labelKey: 'dashboard', icon: Lock, dynamicLabel: 'Menu Permission' },
      { href: '/admin/dataScope', labelKey: 'dashboard', icon: Lock, dynamicLabel: 'Data Scope' },
    ],
  },
]

const STORAGE_KEY = 'adminNav.collapsed'
const GROUPED_HREFS = new Set<string>(
  ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)),
)

function loadCollapsed(): Set<AdminGroupKey> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((v): v is AdminGroupKey => typeof v === 'string'))
  } catch {
    return new Set()
  }
}

export function AdminNav({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin')
  const pathname = usePathname()
  const { list: dynamicList, loaded } = useAdminRouters()
  const [collapsed, setCollapsed] = React.useState<Set<AdminGroupKey>>(() => new Set())

  React.useEffect(() => {
    setCollapsed(loadCollapsed())
  }, [])

  const toggleGroup = React.useCallback((key: AdminGroupKey) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // localStorage 写入失败时静默忽略(隐私模式 / 配额超限)
      }
      return next
    })
  }, [])

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  // 旧版扁平 nav items:仅保留未归入分组的条目
  const flatItems: AdminNavItem[] = React.useMemo(() => {
    if (loaded && dynamicList.length > 0) {
      const dynItems = dynamicList
        .filter((r) => r.visible !== 0 && r.path)
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
        .map((r) => ({
          href: r.path,
          labelKey: 'dashboard' as const,
          icon: LayoutDashboard,
          dynamicLabel: r.name,
        }))
        .filter((r) => !GROUPED_HREFS.has(r.href))
      return dynItems
    }
    return ADMIN_NAV.filter((n) => !GROUPED_HREFS.has(n.href))
  }, [loaded, dynamicList])

  const renderItem = (item: AdminNavItem, active: boolean, compact = false) => {
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-2.5 rounded-md font-medium transition-colors',
          compact ? 'px-3 py-1.5 text-xs' : 'px-3 py-2 text-sm',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{item.dynamicLabel ?? t(`nav.${item.labelKey}`)}</span>
      </Link>
    )
  }

  const renderGroup = (group: AdminNavGroup) => {
    const GroupIcon = group.icon
    const isCollapsed = collapsed.has(group.groupKey)
    const hasActive = group.items.some((i) => isActive(i.href))
    return (
      <div key={group.groupKey} className="space-y-1">
        <button
          type="button"
          aria-expanded={!isCollapsed}
          aria-controls={`admin-nav-group-${group.groupKey}`}
          onClick={() => toggleGroup(group.groupKey)}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
            hasActive
              ? 'text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          <GroupIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left">{t(`nav.group.${group.groupKey}`)}</span>
          <span className="text-[10px] tabular-nums text-muted-foreground/70">
            {group.items.length}
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
              isCollapsed && '-rotate-90',
            )}
          />
        </button>
        {!isCollapsed && (
          <div
            id={`admin-nav-group-${group.groupKey}`}
            className="ml-2 space-y-1 rounded-md bg-muted/30 p-1.5"
          >
            {group.items.map((item) => renderItem(item, isActive(item.href)))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="hidden w-52 shrink-0 self-start lg:sticky lg:top-4 lg:block">
        <div className="mb-4 flex items-center gap-2 px-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-base font-semibold tracking-tight">{t('title')}</span>
        </div>
        <nav className="space-y-3">
          <div className="space-y-1">
            {flatItems.map((item) => renderItem(item, isActive(item.href)))}
          </div>
          {ADMIN_NAV_GROUPS.map(renderGroup)}
        </nav>
      </aside>

      <nav className="flex flex-wrap gap-1 rounded-md bg-muted/40 p-2 pb-2 lg:hidden">
        {flatItems.map((item) => renderItem(item, isActive(item.href), true))}
        {ADMIN_NAV_GROUPS.flatMap((g) => g.items).map((item) =>
          renderItem(item, isActive(item.href), true),
        )}
      </nav>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export default AdminNav
