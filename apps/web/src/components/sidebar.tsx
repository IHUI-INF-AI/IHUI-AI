'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Home,
  MessageSquare,
  FolderOpen,
  BookOpen,
  Bot,
  FileText,
  FileCheck,
  Users,
  CreditCard,
  Settings,
  HelpCircle,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Gift,
  Sparkles,
  Shield,
  Search,
  Star,
  Tag,
  Rss,
  X,
  Video,
  Package,
  Award,
  Calendar,
  BarChart3,
  ShoppingBag,
  UserCircle,
  Workflow,
  ScrollText,
  LayoutGrid,
  Crown,
  Wallet,
  KeyRound,
  Newspaper,
  GraduationCap,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@ihui/ui'
import { useAuthStore } from '@/stores/auth'
import { Avatar } from '@/components/data/Avatar'

interface NavItem {
  href: string
  labelKey:
    | 'home'
    | 'chat'
    | 'chatHistory'
    | 'models'
    | 'workspace'
    | 'teams'
    | 'learn'
    | 'exam'
    | 'circles'
    | 'plaza'
    | 'asks'
    | 'docs'
    | 'payment'
    | 'vip'
    | 'user'
    | 'settings'
    | 'admin'
    | 'help'
    | 'search'
    | 'favorites'
    | 'following'
    | 'subscriptions'
    | 'tags'
    | 'activities'
    | 'feedback'
    | 'points'
    | 'orders'
    | 'live'
    | 'members'
    | 'resources'
    | 'eduPoints'
    | 'schedule'
    | 'adminStatistics'
    | 'userCenter'
    | 'messages'
    | 'topics'
    | 'adminWorkflows'
    | 'adminTags'
    | 'adminLogs'
    | 'wallet'
    | 'oauthMyAuthorized'
    | 'news'
    | 'lecturers'
    | 'student'
    | 'agents'
    | 'distribution'
    | 'oauthPlatform'
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', labelKey: 'home', icon: Home },
  { href: '/chat', labelKey: 'chat', icon: MessageSquare },
  { href: '/chat/history', labelKey: 'chatHistory', icon: MessageSquare },
  { href: '/models', labelKey: 'models', icon: Bot },
  { href: '/workspace', labelKey: 'workspace', icon: FolderOpen },
  { href: '/teams', labelKey: 'teams', icon: Users },
  { href: '/search', labelKey: 'search', icon: Search },
  { href: '/favorites', labelKey: 'favorites', icon: Star },
  { href: '/following', labelKey: 'following', icon: Users },
  { href: '/subscriptions', labelKey: 'subscriptions', icon: Rss },
  { href: '/tags', labelKey: 'tags', icon: Tag },
  { href: '/learn', labelKey: 'learn', icon: BookOpen },
  { href: '/exam', labelKey: 'exam', icon: FileCheck },
  { href: '/plaza', labelKey: 'plaza', icon: LayoutGrid },
  { href: '/circles', labelKey: 'circles', icon: Users },
  { href: '/asks', labelKey: 'asks', icon: HelpCircle },
  { href: '/live', labelKey: 'live', icon: Video },
  { href: '/lecturers', labelKey: 'lecturers', icon: Users },
  { href: '/news', labelKey: 'news', icon: Newspaper },
  { href: '/agents', labelKey: 'agents', icon: Bot },
  { href: '/distribution', labelKey: 'distribution', icon: Gift },
  { href: '/oauth/platform', labelKey: 'oauthPlatform', icon: KeyRound },
  { href: '/resources', labelKey: 'resources', icon: Package },
  { href: '/topics', labelKey: 'topics', icon: BookOpen },
  { href: '/messages', labelKey: 'messages', icon: MessageSquare },
  { href: '/schedule', labelKey: 'schedule', icon: Calendar },
  { href: '/docs', labelKey: 'docs', icon: FileText },
  { href: '/vip-membership', labelKey: 'vip', icon: Crown },
  { href: '/wallet', labelKey: 'wallet', icon: Wallet },
  { href: '/oauth/my-authorized', labelKey: 'oauthMyAuthorized', icon: KeyRound },
  { href: '/payment', labelKey: 'payment', icon: CreditCard },
  { href: '/orders', labelKey: 'orders', icon: ShoppingBag },
  { href: '/activities', labelKey: 'activities', icon: Gift },
  { href: '/points', labelKey: 'points', icon: Star },
  { href: '/edu-points', labelKey: 'eduPoints', icon: Award },
  { href: '/student', labelKey: 'student', icon: GraduationCap },
  { href: '/members', labelKey: 'members', icon: Users, adminOnly: true },
  { href: '/user-center', labelKey: 'userCenter', icon: UserCircle, adminOnly: true },
  { href: '/user/profile', labelKey: 'user', icon: User },
  { href: '/settings', labelKey: 'settings', icon: Settings },
  { href: '/admin', labelKey: 'admin', icon: Shield, adminOnly: true },
  { href: '/admin/statistics', labelKey: 'adminStatistics', icon: BarChart3, adminOnly: true },
  { href: '/admin/workflows', labelKey: 'adminWorkflows', icon: Workflow, adminOnly: true },
  { href: '/admin/tags', labelKey: 'adminTags', icon: Tag, adminOnly: true },
  { href: '/admin/logs', labelKey: 'adminLogs', icon: ScrollText, adminOnly: true },
  { href: '/feedback', labelKey: 'feedback', icon: MessageSquare },
  { href: '/help', labelKey: 'help', icon: HelpCircle },
]

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const t = useTranslations('nav')
  const tc = useTranslations('common')
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (!pathname.startsWith(href)) return false
    // 更具体的同前缀项优先高亮，避免 /chat 与 /chat/history 同时高亮
    return !NAV_ITEMS.some(
      (i) => i.href !== href && i.href.startsWith(href) && pathname.startsWith(i.href),
    )
  }

  const isAdmin = (user?.roleId ?? 0) >= 1
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const navContent = (
    <nav className="flex-1 space-y-1 px-2 py-4">
      {visibleItems.map((item) => {
        const Icon = item.icon
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onCloseMobile}
            title={collapsed ? t(item.labelKey) : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              collapsed && 'justify-center',
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{t(item.labelKey)}</span>}
          </Link>
        )
      })}
    </nav>
  )

  const footer = (
    <div className="border-t p-2">
      {isAuthenticated ? (
        <div
          className={cn(
            'flex items-center gap-3 rounded-md px-2 py-2',
            collapsed && 'justify-center',
          )}
        >
          <Avatar src={user?.avatar ?? undefined} name={user?.nickname ?? 'U'} size="sm" />
          {!collapsed && (
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="break-words text-sm font-medium">{user?.nickname ?? 'User'}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleLogout}
                title={tc('logout')}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
          {collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleLogout}
              title={tc('logout')}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        !collapsed && (
          <Link
            href="/login"
            onClick={onCloseMobile}
            className="block rounded-md px-3 py-2 text-center text-sm font-medium text-primary hover:underline"
          >
            {tc('login')}
          </Link>
        )
      )}
    </div>
  )

  const header = (
    <div className="flex h-14 items-center gap-2 border-b px-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Sparkles className="h-5 w-5" />
      </div>
      {!collapsed && <span className="text-lg font-bold tracking-tight">IHUI AI</span>}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleCollapse}
        className="ml-auto hidden h-8 w-8 lg:flex"
        title={collapsed ? t('expand') : t('collapse')}
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onCloseMobile}
        className="ml-auto h-8 w-8 lg:hidden"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )

  return (
    <>
      {/* 桌面端固定侧边栏 */}
      <aside
        className={cn(
          'hidden h-screen shrink-0 flex-col border-r bg-card transition-[width] duration-200 lg:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {header}
        {navContent}
        {footer}
      </aside>

      {/* 移动端抽屉遮罩 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}

      {/* 移动端抽屉 */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r bg-card transition-transform duration-200 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {header}
        {navContent}
        {footer}
      </aside>
    </>
  )
}

export default Sidebar
