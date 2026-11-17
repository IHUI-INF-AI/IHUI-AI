// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 纯数据模块(无 "use client"):ADMIN 导航分组清单与类型。
// 拆出原因(2026-11-17):原定义住在 AdminNav.tsx('use client'),服务端(nav-data.ts → 页面)
// 导入它时拿到的是 client reference,运行期 `ADMIN_NAV_GROUPS.map is not a function`,
// 使 /n8n-agents 等页面在 "collect page data" 阶段构建失败。数据与组件分层后两侧都能拿到真实值。

import * as React from 'react'
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
  Boxes,
  BadgeDollarSign,
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
  MousePointerClick,
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
  Blocks,
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
  BrainCircuit,
  Settings,
  ChevronDown,
  Layers,
  Zap,
  Shuffle,
  TrendingUp,
  Download,
  Clock,
  ShieldAlert,
  ScanSearch,
  Tags,
  HardDriveDownload,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { TruncatedText } from '@/components/common'
import { useAdminRouters } from '@/hooks/use-admin-routers'

export interface AdminNavItem {
  href: string
  labelKey:
    | 'dashboard'
    | 'users'
    | 'projects'
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
    | 'monitorWallboard'
    | 'monitorFunnel'
    | 'monitorAlerts'
    | 'memberUsers'
    | 'memberRoles'
    | 'memberPermissions'
    | 'memberLogs'
    | 'memberBlacklist'
    | 'systemMonitor'
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
    | 'eduScheduleMgr'
    | 'eduFinanceMgr'
    | 'student'
    | 'systemLoginLogs'
    | 'systemOperationLogs'
    | 'systemTasksLog'
    | 'rolesAuthUser'
    | 'rolesSelectUser'
    | 'ossFiles'
    | 'notificationDispatch'
    | 'messageOverview'
    | 'visitTracking'
    | 'behaviorAnalytics'
    | 'examMarking'
    | 'crew'
    | 'knowledgeRag'
    | 'saasTenants'
    | 'saasCertificates'
    | 'pluginsStats'
    | 'aiCost'
    | 'pricing'
    | 'agentGovernance'
    | 'orgGovernance'
    | 'adminRelayOverview'
    | 'adminRelayModels'
    | 'adminRelayKeyPool'
    | 'adminRelayDiscovery'
    | 'adminRelayLogs'
    | 'adminRelayModelMappings'
    | 'imChannels'
    | 'topupConfig'
    | 'relayParamOps'
    | 'adminRelayAlertRules'
    | 'adminRelayCapacity'
    | 'adminRelayInsights'
    | 'adminRelayEnterprise'
    | 'adminRelayPlugins'
    | 'adminRelayPeakPricing'
    | 'adminRelayKeyScheduling'
    | 'adminRelayErrorRules'
    | 'adminRelayPromptAudit'
    | 'adminRelayUserAttributes'
    | 'adminRelayDataManagement'
    | 'adminBackupJobs'
    | 'adminSkills'
    | 'adminSkillCategories'
    | 'adminSkillStats'
    | 'adminSkillVersions'
    | 'adminSkillBatch'
    | 'deployDiagnosis'
    | 'githubApp'
    | 'smsReceive'
    | 'financeAi'
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
  { href: '/admin/ai-cost', labelKey: 'aiCost', icon: Coins },
  // P3-9 模型定价看板(labelKey 复用 web nav.pricing 存量键,清孤儿键)
  { href: '/admin/model-pricing', labelKey: 'pricing', icon: BadgeDollarSign },
  { href: '/admin/agents', labelKey: 'agentGovernance', icon: Gauge },
  // G6 企业治理控制台(2026-10-30 立):组织统账 + 策略编辑/留痕(/api/org/*)
  { href: '/admin/org-governance', labelKey: 'orgGovernance', icon: Building2 },
  // [2026-10-17 收敛] monitoring-dashboard / backend-health 与 Grafana monitor_health
  // 重复约 85%(三胞胎:monitor/dashboard、monitoring-dashboard、backend-health),
  // 观察期隐藏;恢复 = 取消注释。裁决依据:.ihui-agent/tmp/ai-monitor/web-wallboard-brief.md
  // { href: '/admin/monitoring-dashboard', labelKey: 'monitoringDashboard', icon: MonitorCog },
  // { href: '/admin/backend-health', labelKey: 'backendHealth', icon: Server },
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
  // 2026-10-08 管理员短信接码(d1jiema 平台对接)
  { href: '/admin/sms-receive', labelKey: 'smsReceive', icon: Smartphone },
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
  // 人事部(HR,2026-11-09 立):部门/员工/考勤/请假独立板块,复用 @ihui/attendance-core 判定内核
  { href: '/admin/hr-attendance', labelKey: 'dashboard', icon: Users, dynamicLabel: '人事部' },
  // 财务部(RP-46,2026-11-12 立):AI 一键代账 / AI 一键报税板块;
  // 功能以 MCP 插件形态(ai_bookkeeping/ai_tax_filing)接进对话,页面只做发起与进度落点
  { href: '/admin/finance-ai', labelKey: 'financeAi', icon: Wallet },
  { href: '/admin/tags', labelKey: 'tags', icon: Tag },
  { href: '/admin/skills', labelKey: 'adminSkills', icon: Sparkles },
  { href: '/admin/skill-categories', labelKey: 'adminSkillCategories', icon: Tag },
  { href: '/admin/skill-stats', labelKey: 'adminSkillStats', icon: BarChart3 },
  { href: '/admin/skill-versions', labelKey: 'adminSkillVersions', icon: GitBranch },
  { href: '/admin/skill-batch', labelKey: 'adminSkillBatch', icon: Download },
  { href: '/admin/configs', labelKey: 'configs', icon: SlidersHorizontal },
  { href: '/admin/home-schema', labelKey: 'dashboard', icon: LayoutGrid, dynamicLabel: '首页布局' },
  { href: '/admin/integrations', labelKey: 'integrations', icon: Plug },
  // D15④: GitHub App 安装台账 + webhook 配置状态(2026-09-26 立)
  { href: '/admin/github-app', labelKey: 'githubApp', icon: GitBranch },
  { href: '/admin/deploy-diagnosis', labelKey: 'deployDiagnosis', icon: Gauge },
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
  // [2026-10-17 收敛] monitor/dashboard 与 Grafana monitor_health/ihui-ai-overview 重复
  // 约 85%(三胞胎之一),观察期隐藏;恢复 = 取消注释。
  // { href: '/admin/monitor/dashboard', labelKey: 'monitorDashboard', icon: MonitorCog },
  { href: '/admin/monitor/wallboard', labelKey: 'monitorWallboard', icon: MonitorCog },
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
  // 这三页早已实现、接口也在,但从未挂进这份静态清单 ⇒ 管理员只能手敲 URL 才进得去
  // (本仓反复出现的"造好没装车"型:守门 64 / 115 同族)。
  { href: '/admin/edu/class/schedule', labelKey: 'eduScheduleMgr', icon: School },
  { href: '/admin/edu/student', labelKey: 'student', icon: UserSquare },
  { href: '/admin/edu/finance', labelKey: 'eduFinanceMgr', icon: PayIcon },
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
  { href: '/admin/behavior-analytics', labelKey: 'behaviorAnalytics', icon: MousePointerClick },
  {
    href: '/admin/plugins-stats',
    labelKey: 'pluginsStats',
    icon: Boxes,
    dynamicLabel: '插件统计',
  },
  { href: '/admin/exam-marking', labelKey: 'examMarking', icon: ClipboardCheck },
  // P1 audit 遗留:试卷管理(未归入分组,保留为扁平 item,路径已修正)
  {
    href: '/admin/edu/exam/papers-random',
    labelKey: 'dashboard',
    icon: LayoutGrid,
    dynamicLabel: '随机试卷',
  },
  {
    href: '/admin/edu/exam/papers-manual',
    labelKey: 'dashboard',
    icon: FileText,
    dynamicLabel: '模拟试卷',
  },
  {
    href: '/admin/edu/exam/papers-template',
    labelKey: 'dashboard',
    icon: LayoutGrid,
    dynamicLabel: '试卷模板',
  },
]

export type AdminGroupKey =
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
  | 'saas'

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
      {
        href: '/admin/operlog',
        labelKey: 'dashboard',
        icon: Activity,
        dynamicLabel: '操作日志',
      },
      {
        href: '/admin/login-logs',
        labelKey: 'dashboard',
        icon: History,
        dynamicLabel: '登录信息',
      },
      {
        href: '/admin/online-users',
        labelKey: 'dashboard',
        icon: Users,
        dynamicLabel: '在线用户',
      },
      {
        href: '/admin/announcements',
        labelKey: 'dashboard',
        icon: Megaphone,
        dynamicLabel: '公告通知',
      },
      {
        href: '/admin/configs',
        labelKey: 'dashboard',
        icon: SlidersHorizontal,
        dynamicLabel: '系统配置',
      },
      {
        href: '/admin/schedule',
        labelKey: 'dashboard',
        icon: CalendarClock,
        dynamicLabel: '定时任务',
      },
      {
        href: '/admin/tool/gen',
        labelKey: 'dashboard',
        icon: Code2,
        dynamicLabel: '代码生成器',
      },
    ],
  },
  // 内容审核
  {
    groupKey: 'moderation',
    icon: ShieldCheck,
    items: [
      {
        href: '/admin/articles',
        labelKey: 'dashboard',
        icon: FileText,
        dynamicLabel: '文章审核',
      },
      {
        href: '/admin/edu/course',
        labelKey: 'dashboard',
        icon: GraduationCap,
        dynamicLabel: '课程审核',
      },
      {
        href: '/admin/edu/exam',
        labelKey: 'dashboard',
        icon: FileText,
        dynamicLabel: '试卷审核',
      },
      {
        href: '/admin/exam/questions',
        labelKey: 'dashboard',
        icon: HelpCircle,
        dynamicLabel: '试题审核',
      },
      {
        href: '/admin/live/categories',
        labelKey: 'dashboard',
        icon: Radio,
        dynamicLabel: '直播审核',
      },
      {
        href: '/admin/sensitive-word',
        labelKey: 'dashboard',
        icon: AlertTriangle,
        dynamicLabel: '敏感词',
      },
      {
        href: '/admin/feedbacks',
        labelKey: 'dashboard',
        icon: MessageSquare,
        dynamicLabel: '用户反馈',
      },
    ],
  },
  // 财务管理
  {
    groupKey: 'finance',
    icon: Wallet,
    items: [
      { href: '/admin/wallet', labelKey: 'dashboard', icon: Wallet, dynamicLabel: '钱包' },
      {
        href: '/admin/withdrawal',
        labelKey: 'dashboard',
        icon: Banknote,
        dynamicLabel: '提现管理',
      },
      { href: '/admin/invoices', labelKey: 'dashboard', icon: Receipt, dynamicLabel: '发票管理' },
      { href: '/admin/tax', labelKey: 'dashboard', icon: FileText, dynamicLabel: '税务管理' },
    ],
  },
  // AI 智能体
  {
    groupKey: 'aiAgent',
    icon: Bot,
    items: [
      {
        href: '/admin/agents/categories',
        labelKey: 'dashboard',
        icon: Tag,
        dynamicLabel: '智能体分类',
      },
      {
        href: '/admin/agent-rule',
        labelKey: 'dashboard',
        icon: Shield,
        dynamicLabel: '智能体规则',
      },
      {
        href: '/admin/agents/examine',
        labelKey: 'dashboard',
        icon: ShieldCheck,
        dynamicLabel: '智能体审核',
      },
      {
        href: '/admin/ai-models',
        labelKey: 'dashboard',
        icon: SlidersHorizontal,
        dynamicLabel: '大模型配置',
      },
      // P0-5 模型 API 中转站(2026-07-29 立,5 个入口)
      { href: '/admin/relay', labelKey: 'adminRelayOverview', icon: Zap },
      { href: '/admin/relay/models', labelKey: 'adminRelayModels', icon: Package },
      { href: '/admin/relay/key-pool', labelKey: 'adminRelayKeyPool', icon: KeyRound },
      // 第三方 AI IDE 账号池(2026-10-22 立,trae/workbuddy/codearts 账号导入与调度)
      {
        href: '/admin/relay/account-pool',
        labelKey: 'dashboard',
        icon: IdCard,
        dynamicLabel: '账号池',
      },
      // 号池自助授权会话(2026-11-17 立):免客户端 OAuth 设备授权 / PAT 直贴入池
      // dynamicLabel 沿用同组账号池惯例 ⇒ 不新增 i18n 键(避开他席在途的五语改动)
      {
        href: '/admin/relay/auth-sessions',
        labelKey: 'dashboard',
        icon: IdCard,
        dynamicLabel: '授权会话',
      },
      // 账号代理(2026-10-27 立,账号级 proxyUrl 的独立管理入口)
      {
        href: '/admin/relay/account-proxy',
        labelKey: 'dashboard',
        icon: ShieldCheck,
        dynamicLabel: '账号代理',
      },
      // 号池任务中心(2026-10-27 立,缺口④:四载体周期任务观测+手动触发)
      {
        href: '/admin/relay/tasks',
        labelKey: 'dashboard',
        icon: ListChecks,
        dynamicLabel: '号池任务中心',
      },
      { href: '/admin/relay/discovery', labelKey: 'adminRelayDiscovery', icon: Activity },
      { href: '/admin/relay/logs', labelKey: 'adminRelayLogs', icon: Coins },
      { href: '/admin/relay/alert-rules', labelKey: 'adminRelayAlertRules', icon: BellRing },
      { href: '/admin/relay/capacity', labelKey: 'adminRelayCapacity', icon: TrendingUp },
      { href: '/admin/relay/insights', labelKey: 'adminRelayInsights', icon: BrainCircuit },
      // 企业合规(2026-09-17,补强 61,差异化:认证/发票/合同/对公结算)
      { href: '/admin/relay/enterprise', labelKey: 'adminRelayEnterprise', icon: Building2 },
      // 插件系统(2026-09-17,补强 59,声明式插件零代码执行)
      { href: '/admin/relay/plugins', labelKey: 'adminRelayPlugins', icon: Blocks },
      // 分时高峰倍率(2026-09-17,4-1 条目 7 管理端补齐)
      { href: '/admin/relay/peak-pricing', labelKey: 'adminRelayPeakPricing', icon: Clock },
      // 号池调度精细控制(2026-09-17,4-2 条目 51 管理端补齐)
      {
        href: '/admin/relay/key-scheduling',
        labelKey: 'adminRelayKeyScheduling',
        icon: Gauge,
      },
      // 上游错误透传规则(2026-09-17,4-3 条目 53 管理端补齐)
      {
        href: '/admin/relay/error-rules',
        labelKey: 'adminRelayErrorRules',
        icon: ShieldAlert,
      },
      // 提示词审计(2026-09-17,4-3 条目 54 管理端补齐)
      {
        href: '/admin/relay/prompt-audit',
        labelKey: 'adminRelayPromptAudit',
        icon: ScanSearch,
      },
      // 用户自定义属性(2026-09-17,4-3 条目 55 管理端补齐)
      {
        href: '/admin/relay/user-attributes',
        labelKey: 'adminRelayUserAttributes',
        icon: Tags,
      },
      // 数据保留与清理(2026-09-17,4-3 条目 56 管理端补齐)
      {
        href: '/admin/relay/data-management',
        labelKey: 'adminRelayDataManagement',
        icon: Database,
      },
      // 数据库备份作业(2026-09-17,4-2 条目 48 管理端补齐)
      { href: '/admin/backup-jobs', labelKey: 'adminBackupJobs', icon: HardDriveDownload },
      // P0 中转站造血能力对齐批次(2026-07-31 立):模型映射(渠道管理)
      { href: '/admin/relay/channels', labelKey: 'adminRelayModelMappings', icon: Shuffle },
      // P0-20b 参数覆盖规则(2026-08-01 立,转发层 applyParamOps 管理)
      { href: '/admin/relay-param-ops', labelKey: 'relayParamOps', icon: SlidersHorizontal },
      // P0 第四批次(2026-08-01 立):渠道配额 + 充值阶梯折扣
      {
        href: '/admin/channel-quota',
        labelKey: 'dashboard',
        icon: Gauge,
        dynamicLabel: '渠道配额',
      },
      {
        href: '/admin/topup-config',
        labelKey: 'topupConfig',
        icon: TrendingUp,
        dynamicLabel: '充值配置',
      },
      // P0 IM 多平台远程连接控制(2026-07-31 立,16 平台适配器配置 + 消息历史)
      { href: '/admin/im-channels', labelKey: 'imChannels', icon: MessageSquareReply },
    ],
  },
  // 营销直播
  {
    groupKey: 'marketing',
    icon: Megaphone,
    items: [
      { href: '/admin/lottery', labelKey: 'dashboard', icon: Sparkles, dynamicLabel: '抽奖活动' },
      { href: '/admin/carousel', labelKey: 'dashboard', icon: Images, dynamicLabel: '横幅轮播' },
      {
        href: '/admin/signin-rule',
        labelKey: 'dashboard',
        icon: CalendarClock,
        dynamicLabel: '签到规则',
      },
      {
        href: '/admin/live/lecturers',
        labelKey: 'dashboard',
        icon: UserCheck,
        dynamicLabel: '讲师管理',
      },
    ],
  },
  // 课程考试
  {
    groupKey: 'courseExam',
    icon: GraduationCap,
    items: [
      {
        href: '/admin/learn/chapters',
        labelKey: 'dashboard',
        icon: BookOpen,
        dynamicLabel: '课程章节',
      },
      { href: '/admin/learn', labelKey: 'dashboard', icon: Network, dynamicLabel: '学习地图' },
      {
        href: '/admin/certificate',
        labelKey: 'dashboard',
        icon: Award,
        dynamicLabel: '证书管理',
      },
      {
        href: '/admin/edu/answer',
        labelKey: 'dashboard',
        icon: FileText,
        dynamicLabel: '答卷管理',
      },
      {
        href: '/admin/exam/categories',
        labelKey: 'dashboard',
        icon: Tag,
        dynamicLabel: '考试分类',
      },
      {
        href: '/admin/exam/records',
        labelKey: 'dashboard',
        icon: History,
        dynamicLabel: '考试记录',
      },
      // 教育教务三页挂在**分组 items** 上(而不是只挂扁平 ADMIN_NAV —— 那份只被
      // path-labels.ts 用于"路径→标题"映射)。
      // 补充(第九批曾据探针写"仍未生效",那是**无效证据**,别再照它排查):我找的
      // `button[aria-controls="admin-nav-group-courseExam"]` 属于本组件自身,而本组件
      // 没有任何布局挂载 —— 那个按钮注定不存在,不能用来证明侧栏没有这些项。
      // 有效事实是:`nav-data.ts` 把 ADMIN_NAV_GROUPS 经 adminGroupToNavItem 转成三级子菜单,
      // 所以数据已在渲染链上。可见性请按用户真实路径确认:侧栏 → 管理域(adminOnly) → 课程考试。
      {
        href: '/admin/edu/class/schedule',
        labelKey: 'dashboard',
        icon: GraduationCap,
        dynamicLabel: '课表排课',
      },
      { href: '/admin/edu/student', labelKey: 'dashboard', icon: Users, dynamicLabel: '学员管理' },
      { href: '/admin/edu/finance', labelKey: 'dashboard', icon: Wallet, dynamicLabel: '教育财务' },
    ],
  },
  // 监控 BI
  {
    groupKey: 'analytics',
    icon: BarChart3,
    items: [
      {
        href: '/admin/dashboard-stat',
        labelKey: 'dashboard',
        icon: BarChart3,
        dynamicLabel: '数据概览',
      },
      { href: '/admin/user-stat', labelKey: 'dashboard', icon: Users, dynamicLabel: '用户统计' },
      {
        href: '/admin/revenue-stat',
        labelKey: 'dashboard',
        icon: Banknote,
        dynamicLabel: '营收统计',
      },
      {
        href: '/admin/database-optimization',
        labelKey: 'dashboard',
        icon: Database,
        dynamicLabel: '数据库监控',
      },
      {
        href: '/admin/visit-trend',
        labelKey: 'dashboard',
        icon: BarChart3,
        dynamicLabel: '访问趋势',
      },
      {
        href: '/admin/redis-monitor',
        labelKey: 'dashboard',
        icon: Server,
        dynamicLabel: 'Redis 监控',
      },
      {
        href: '/admin/downloads',
        labelKey: 'dashboard',
        icon: Download,
        dynamicLabel: '下载统计',
      },
      // 2026-10-18 补回监控大屏入口:此前仅写在遗留扁平 ADMIN_NAV 数组(279 行起),
      // 而 Sidebar 实际渲染 ADMIN_NAV_GROUPS 分组结构,故侧边栏无此入口(用户反馈"找不到")。
      // 现挂入「数据看板(analytics)」分组,labelKey 复用 nav.monitorWallboard(中文"监控大屏",i18n 已存在)。
      {
        href: '/admin/monitor/wallboard',
        labelKey: 'monitorWallboard',
        icon: MonitorCog,
        dynamicLabel: '监控大屏',
      },
      // 2026-10-18 新增监控面板页:21 张盘的项目内原生入口(EChart 直读仓内
      // monitoring/grafana/dashboards/*.json 转译出的面板配置,经
      // /api/admin/monitor-panels/query 代理 Prometheus/Loki,运行时不接触
      // Grafana;2026-10-18 晚 Grafana 服务整体退役后本页即唯一监控入口)。
      // 与 wallboard(自研 HUD 总览)互补 —— 本页是全量明细下钻。
      {
        href: '/admin/monitor/panels',
        labelKey: 'monitorWallboard',
        icon: Gauge,
        dynamicLabel: '监控面板',
      },
    ],
  },
  // 客服工单
  {
    groupKey: 'support',
    icon: MessageSquare,
    items: [
      {
        href: '/admin/ticket',
        labelKey: 'dashboard',
        icon: MessageSquare,
        dynamicLabel: '工单管理',
      },
      {
        href: '/admin/ticket-reply',
        labelKey: 'dashboard',
        icon: MessageSquareReply,
        dynamicLabel: '工单回复',
      },
      {
        href: '/admin/oss-config',
        labelKey: 'dashboard',
        icon: Server,
        dynamicLabel: '对象存储配置',
      },
    ],
  },
  // 社区圈子
  {
    groupKey: 'community',
    icon: Users,
    items: [
      {
        href: '/admin/circles/dynamics',
        labelKey: 'dashboard',
        icon: Activity,
        dynamicLabel: '圈子动态',
      },
      {
        href: '/admin/news/categories',
        labelKey: 'dashboard',
        icon: Tag,
        dynamicLabel: '资讯分类',
      },
    ],
  },
  // 资源中心
  {
    groupKey: 'resource',
    icon: Package,
    items: [
      {
        href: '/admin/resource-tag',
        labelKey: 'dashboard',
        icon: Tag,
        dynamicLabel: '资源标签',
      },
      {
        href: '/admin/resource-product',
        labelKey: 'dashboard',
        icon: Package,
        dynamicLabel: '资源商品',
      },
    ],
  },
  // 开发者中心
  {
    groupKey: 'developer',
    icon: Code2,
    items: [
      {
        href: '/admin/menu-permission',
        labelKey: 'dashboard',
        icon: Lock,
        dynamicLabel: '菜单权限',
      },
    ],
  },
  // P1-2.2: SaaS 部署层管理(仅 superadmin 可访问)
  {
    groupKey: 'saas',
    icon: Server,
    items: [
      { href: '/admin/saas', labelKey: 'saasTenants', icon: Layers },
      { href: '/admin/saas/certificates', labelKey: 'saasCertificates', icon: Lock },
    ],
  },
]
