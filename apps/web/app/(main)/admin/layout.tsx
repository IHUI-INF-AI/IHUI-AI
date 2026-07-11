'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  Users,
  FolderCog,
  Settings,
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
} from 'lucide-react'

import { cn } from '@/lib/utils'

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
  icon: React.ComponentType<{ className?: string }>
}

const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/admin/users', labelKey: 'users', icon: Users },
  { href: '/admin/members', labelKey: 'members', icon: UserCheck },
  { href: '/admin/projects', labelKey: 'projects', icon: FolderCog },
  { href: '/admin/orders', labelKey: 'orders', icon: ShoppingCart },
  { href: '/admin/refund', labelKey: 'refund', icon: Receipt },
  { href: '/admin/exam', labelKey: 'exam', icon: GraduationCap },
  { href: '/admin/learn', labelKey: 'learn', icon: BookOpen },
  { href: '/admin/resources', labelKey: 'resources', icon: Package },
  { href: '/admin/live', labelKey: 'live', icon: Radio },
  { href: '/admin/point', labelKey: 'point', icon: Coins },
  { href: '/admin/news', labelKey: 'news', icon: Newspaper },
  { href: '/admin/certificate', labelKey: 'certificate', icon: Award },
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
  { href: '/admin/settings', labelKey: 'settings', icon: Settings },
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
  { href: '/admin/system/config', labelKey: 'systemConfig', icon: SlidersHorizontal },
  { href: '/admin/system/tasks', labelKey: 'systemTasks', icon: ListChecks },
  // R65: 实名认证审核
  { href: '/admin/realname-audit', labelKey: 'realnameAudit', icon: BadgeCheck },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin')
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

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
        <span>{t(`nav.${item.labelKey}`)}</span>
      </Link>
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
        <nav className="space-y-1">
          {ADMIN_NAV.map((item) => renderItem(item, isActive(item.href)))}
        </nav>
      </aside>

      <nav className="flex flex-wrap gap-1 border-b pb-2 lg:hidden">
        {ADMIN_NAV.map((item) => renderItem(item, isActive(item.href), true))}
      </nav>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
