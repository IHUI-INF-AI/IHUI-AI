// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { TruncatedText } from '@/components/common'
import { useAdminRouters } from '@/hooks/use-admin-routers'

import {
  ADMIN_NAV,
  ADMIN_NAV_GROUPS,
  type AdminGroupKey,
  type AdminNavGroup,
  type AdminNavItem,
} from './admin-nav-groups'

export type { AdminGroupKey, AdminNavGroup, AdminNavItem } from './admin-nav-groups'



/**
 * 11 大运营域可折叠分组
 * - 73 个 audit 新增 item 归属到对应分组
 * - 默认全部展开
 * - localStorage key `adminNav.collapsed` 记忆用户折叠偏好
 */

/** i18n 静态映射表 — 用于消除 `t(`nav.${labelKey}`)` 动态拼接 */
const NAV_LABEL_KEY: Record<AdminNavItem['labelKey'], string> = {
  dashboard: 'nav.dashboard',
  financeAi: 'nav.financeAi',
  users: 'nav.users',
  projects: 'nav.projects',
  orders: 'nav.orders',
  roles: 'nav.roles',
  permissions: 'nav.permissions',
  workflows: 'nav.workflows',
  tags: 'nav.tags',
  feedbacks: 'nav.feedbacks',
  announcements: 'nav.announcements',
  docs: 'nav.docs',
  help: 'nav.help',
  configs: 'nav.configs',
  integrations: 'nav.integrations',
  deployDiagnosis: 'nav.adminDeployDiagnosis',
  githubApp: 'nav.githubApp',
  logs: 'nav.logs',
  events: 'nav.events',
  exam: 'nav.exam',
  learn: 'nav.learn',
  members: 'nav.members',
  resources: 'nav.resources',
  live: 'nav.live',
  news: 'nav.news',
  certificate: 'nav.certificate',
  point: 'nav.point',
  agents: 'nav.agents',
  agentCategories: 'nav.agentCategories',
  agentExamine: 'nav.agentExamine',
  agentSettlement: 'nav.agentSettlement',
  demandSquare: 'nav.demandSquare',
  backendHealth: 'nav.backendHealth',
  performanceDashboard: 'nav.performanceDashboard',
  databaseOptimization: 'nav.databaseOptimization',
  eventBusMonitor: 'nav.eventBusMonitor',
  grayRelease: 'nav.grayRelease',
  apiDebug: 'nav.apiDebug',
  apiGroups: 'nav.apiGroups',
  apiLogs: 'nav.apiLogs',
  apiUsage: 'nav.apiUsage',
  developer: 'nav.developer',
  dict: 'nav.dict',
  sms: 'nav.sms',
  smsReceive: 'nav.smsReceive',
  notificationChannels: 'nav.notificationChannels',
  notificationPreferences: 'nav.notificationPreferences',
  notificationLogs: 'nav.notificationLogs',
  recommendationConfig: 'nav.recommendationConfig',
  mobileAdapter: 'nav.mobileAdapter',
  oauthAuditDashboard: 'nav.oauthAuditDashboard',
  errorDashboard: 'nav.errorDashboard',
  monitoringDashboard: 'nav.monitoringDashboard',
  refund: 'nav.refund',
  apiPlatformApps: 'nav.apiPlatformApps',
  apiPlatformPackages: 'nav.apiPlatformPackages',
  apiPlatformBilling: 'nav.apiPlatformBilling',
  apiPlatformUsage: 'nav.apiPlatformUsage',
  shopProducts: 'nav.shopProducts',
  shopPayments: 'nav.shopPayments',
  shopWithdrawals: 'nav.shopWithdrawals',
  shopFunds: 'nav.shopFunds',
  oauthApps: 'nav.oauthApps',
  oauthAudit: 'nav.oauthAudit',
  oauthTokens: 'nav.oauthTokens',
  monitorDashboard: 'nav.monitorDashboard',
  monitorWallboard: 'nav.monitorWallboard',
  monitorFunnel: 'nav.monitorFunnel',
  monitorAlerts: 'nav.monitorAlerts',
  memberUsers: 'nav.memberUsers',
  memberRoles: 'nav.memberRoles',
  memberPermissions: 'nav.memberPermissions',
  memberLogs: 'nav.memberLogs',
  memberBlacklist: 'nav.memberBlacklist',
  systemMonitor: 'nav.systemMonitor',
  systemTasks: 'nav.systemTasks',
  realnameAudit: 'nav.realnameAudit',
  agentRules: 'nav.agentRules',
  taskDeveloper: 'nav.taskDeveloper',
  contact: 'nav.contact',
  aboutUs: 'nav.aboutUs',
  aiGc: 'nav.aiGc',
  advertise: 'nav.advertise',
  carousel: 'nav.carousel',
  zhsAgent: 'nav.zhsAgent',
  zhsUser: 'nav.zhsUser',
  zhsActivity: 'nav.zhsActivity',
  agentTask: 'nav.agentTask',
  agentRule: 'nav.agentRule',
  developerLink: 'nav.developerLink',
  identityProportion: 'nav.identityProportion',
  productIdentity: 'nav.productIdentity',
  userAgentAudio: 'nav.userAgentAudio',
  userAgentContext: 'nav.userAgentContext',
  userAgentImage: 'nav.userAgentImage',
  authAccounts: 'nav.authAccounts',
  authDept: 'nav.authDept',
  authFindInfo: 'nav.authFindInfo',
  authRole: 'nav.authRole',
  authUserVip: 'nav.authUserVip',
  authVeriCodes: 'nav.authVeriCodes',
  loginLogs: 'nav.loginLogs',
  userCenter: 'nav.userCenter',
  eduOrganization: 'nav.eduOrganization',
  eduPlatform: 'nav.eduPlatform',
  eduUserPlatform: 'nav.eduUserPlatform',
  eduZhsIdentity: 'nav.eduZhsIdentity',
  eduCourseAudit: 'nav.eduCourseAudit',
  eduCoursePay: 'nav.eduCoursePay',
  eduCoursePlatformLog: 'nav.eduCoursePlatformLog',
  eduScheduleMgr: 'nav.eduScheduleMgr',
  eduFinanceMgr: 'nav.eduFinanceMgr',
  student: 'nav.student',
  systemLoginLogs: 'nav.systemLoginLogs',
  systemOperationLogs: 'nav.systemOperationLogs',
  systemTasksLog: 'nav.systemTasksLog',
  rolesAuthUser: 'nav.rolesAuthUser',
  rolesSelectUser: 'nav.rolesSelectUser',
  ossFiles: 'nav.ossFiles',
  notificationDispatch: 'nav.notificationDispatch',
  messageOverview: 'nav.messageOverview',
  visitTracking: 'nav.visitTracking',
  behaviorAnalytics: 'nav.behaviorAnalytics',
  examMarking: 'nav.examMarking',
  crew: 'nav.crew',
  knowledgeRag: 'nav.knowledgeRag',
  saasTenants: 'nav.saasTenants',
  saasCertificates: 'nav.saasCertificates',
  pluginsStats: 'nav.pluginsStats',
  aiCost: 'nav.aiCost',
  pricing: 'nav.pricing',
  agentGovernance: 'nav.agentGovernance',
  orgGovernance: 'nav.orgGovernance',
  adminRelayOverview: 'nav.adminRelayOverview',
  adminRelayModels: 'nav.adminRelayModels',
  adminRelayKeyPool: 'nav.adminRelayKeyPool',
  adminRelayDiscovery: 'nav.adminRelayDiscovery',
  adminRelayLogs: 'nav.adminRelayLogs',
  adminRelayModelMappings: 'nav.adminRelayModelMappings',
  imChannels: 'nav.imChannels',
  topupConfig: 'nav.topupConfig',
  relayParamOps: 'nav.relayParamOps',
  adminRelayAlertRules: 'nav.adminRelayAlertRules',
  adminRelayCapacity: 'nav.adminRelayCapacity',
  adminRelayInsights: 'nav.adminRelayInsights',
  adminRelayEnterprise: 'nav.adminRelayEnterprise',
  adminRelayPlugins: 'nav.adminRelayPlugins',
  adminRelayPeakPricing: 'nav.adminRelayPeakPricing',
  adminRelayKeyScheduling: 'nav.adminRelayKeyScheduling',
  adminRelayErrorRules: 'nav.adminRelayErrorRules',
  adminRelayPromptAudit: 'nav.adminRelayPromptAudit',
  adminRelayUserAttributes: 'nav.adminRelayUserAttributes',
  adminRelayDataManagement: 'nav.adminRelayDataManagement',
  adminBackupJobs: 'nav.adminBackupJobs',
  adminSkills: 'nav.adminSkills',
  adminSkillCategories: 'nav.adminSkillCategories',
  adminSkillStats: 'nav.adminSkillStats',
  adminSkillVersions: 'nav.adminSkillVersions',
  adminSkillBatch: 'nav.adminSkillBatch',
}

/** i18n 静态映射表 — 指向既有 nav.adminGroup.*(五语齐备,不新造第二份组名) */
const NAV_GROUP_KEY: Record<AdminGroupKey, string> = {
  operation: 'nav.adminGroup.operation',
  moderation: 'nav.adminGroup.moderation',
  finance: 'nav.adminGroup.finance',
  aiAgent: 'nav.adminGroup.aiAgent',
  marketing: 'nav.adminGroup.marketing',
  courseExam: 'nav.adminGroup.courseExam',
  analytics: 'nav.adminGroup.analytics',
  support: 'nav.adminGroup.support',
  community: 'nav.adminGroup.community',
  resource: 'nav.adminGroup.resource',
  developer: 'nav.adminGroup.developer',
  saas: 'nav.adminGroup.saas',
}

const STORAGE_KEY = 'adminNav.collapsed'
const GROUPED_HREFS = new Set<string>(ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)))

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
  // 注:NAV_LABEL_KEY 映射表用的是 'nav.xxx' 完整 key,需用不限命名空间的 useTranslations()
  // 不能用 useTranslations('admin')(admin 命名空间不存在会 fallback 显示 key 本身)
  const t = useTranslations()
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
          compact ? 'px-3 py-1.5 text-label' : 'px-3 py-2 text-body',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <TruncatedText
          value={item.dynamicLabel ?? t(NAV_LABEL_KEY[item.labelKey] ?? 'nav.unknown')}
          className="min-w-0 flex-1 whitespace-nowrap"
        />
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
            'flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-label font-semibold uppercase tracking-wider transition-colors',
            hasActive
              ? 'text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          <GroupIcon className="h-3.5 w-3.5 shrink-0" />
          <TruncatedText
            value={t(NAV_GROUP_KEY[group.groupKey])}
            className="min-w-0 flex-1 text-left whitespace-nowrap"
          />
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
    <div className="flex flex-col gap-4 min-[1024px]:gap-6 min-[1024px]:flex-row">
      <aside className="hidden w-52 shrink-0 self-start min-[1024px]:sticky min-[1024px]:top-4 min-[1024px]:block">
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

      <nav className="flex flex-wrap gap-1 rounded-md bg-muted/40 p-2 pb-2 min-[1024px]:hidden">
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
