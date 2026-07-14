'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
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
  Sun,
  Moon,
  Bell,
  Download,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { cn } from '@/lib/utils'
import { Button } from '@ihui/ui'
import { useAuthStore } from '@/stores/auth'
import { useLanguageStore, type Language } from '@/stores/language'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { Avatar } from '@/components/data/Avatar'
import { Tooltip, TooltipProvider, Dropdown, Popover } from '@/components/feedback'
import { NotificationCenter, type NoticeItem } from '@/components/feature-center'
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  type NotificationItem,
} from '@/lib/notification-api'

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

const LANGUAGES: { code: Language; name: string }[] = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
]

const DOWNLOADS = [
  { label: 'iOS', href: 'https://apps.apple.com/cn/app/ihui-ai' },
  { label: 'Android APK', href: '/apk/ihui-ai-latest.apk' },
  { label: '微信小程序', href: '/minapp' },
  { label: '桌面端', href: '/download/desktop' },
]

function mapNotifType(type: string): NoticeItem['type'] {
  switch (type) {
    case 'order':
      return 'success'
    case 'mention':
      return 'warning'
    default:
      return 'info'
  }
}

async function unwrap<T>(p: Promise<{ success: boolean; data?: T; error?: string }>): Promise<T> {
  const r = await p
  if (!r.success) throw new Error(r.error)
  return r.data as T
}

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

/** 侧边栏底部工具栏:搜索 / 语言 / 主题 / 下载客户端 */
function SidebarActions({ collapsed }: { collapsed: boolean }) {
  const tc = useTranslations('common')
  const th = useTranslations('header')
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { locale, setLocale } = useLanguageStore()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const handleLocaleChange = (code: Language) => {
    document.cookie = `locale=${code};path=/;max-age=31536000`
    setLocale(code)
    window.location.reload()
  }

  const btnClass = 'h-7 w-7 shrink-0'

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex gap-1 rounded-md p-1',
          collapsed ? 'flex-col items-center' : 'flex-row justify-center',
        )}
      >
        <Tooltip content={tc('search')}>
          <Button
            variant="ghost"
            size="icon"
            className={btnClass}
            title={collapsed ? tc('search') : undefined}
            onClick={() => router.push('/search')}
          >
            <Search className="h-4 w-4" />
          </Button>
        </Tooltip>

        <Popover
          position="top"
          content={
            <div className="w-36 py-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLocaleChange(lang.code)}
                  className={cn(
                    'flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent',
                    locale === lang.code && 'bg-accent font-medium',
                  )}
                >
                  <img
                    src={`/images/flags/${lang.code}.svg`}
                    className="h-3 w-4 object-cover"
                    alt={lang.name}
                  />
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          }
        >
          <Button
            variant="ghost"
            size="icon"
            className={cn(btnClass, 'p-0')}
            title={collapsed ? '语言' : undefined}
          >
            <img
              src={`/images/flags/${locale}.svg`}
              className="h-3 w-4 object-cover"
              alt={locale}
            />
          </Button>
        </Popover>

        <Tooltip content={th('toggleTheme')}>
          <Button
            variant="ghost"
            size="icon"
            className={btnClass}
            title={collapsed ? th('toggleTheme') : undefined}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {mounted && theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </Tooltip>

        <Popover
          position="top"
          content={
            <div className="w-36 py-1">
              {DOWNLOADS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="block px-2 py-1.5 text-sm hover:bg-accent"
                >
                  {item.label}
                </a>
              ))}
            </div>
          }
        >
          <Button
            variant="ghost"
            size="icon"
            className={btnClass}
            title={collapsed ? '下载客户端' : undefined}
          >
            <Download className="h-4 w-4" />
          </Button>
        </Popover>
      </div>
    </TooltipProvider>
  )
}

/** 侧边栏底部用户区:头像 + 用户名 + 通知铃铛 + 下拉菜单(profile/settings/logout) */
function SidebarUserRow({
  collapsed,
  onCloseMobile,
}: {
  collapsed: boolean
  onCloseMobile: () => void
}) {
  const t = useTranslations('nav')
  const tc = useTranslations('common')
  const th = useTranslations('header')
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)
  const openLogin = useLoginDialogStore((s) => s.open)

  const qc = useQueryClient()
  const { data: notifData } = useQuery({
    queryKey: ['sidebar', 'notifications'],
    queryFn: () => unwrap(getNotifications({ page: 1, pageSize: 10 })),
    staleTime: 30 * 1000,
  })
  const { data: unreadData } = useQuery({
    queryKey: ['sidebar', 'unread-count'],
    queryFn: () => unwrap(getUnreadCount()),
    staleTime: 30 * 1000,
  })
  const notices: NoticeItem[] = ((notifData?.list ?? []) as unknown as NotificationItem[]).map(
    (n) => ({
      id: n.id,
      title: n.title,
      description: n.content || undefined,
      type: mapNotifType(n.type),
      read: n.isRead,
      createdAt: n.createdAt,
    }),
  )
  const unread = unreadData?.notification ?? 0
  const markAllMut = useMutation({
    mutationFn: () => unwrap(markAllNotificationsRead()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sidebar', 'unread-count'] })
      qc.invalidateQueries({ queryKey: ['sidebar', 'notifications'] })
    },
  })

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  if (!isAuthenticated) {
    return (
      <div className="px-2 pb-2">
        {collapsed ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 w-full"
            title={tc('login')}
            onClick={() => {
              openLogin()
              onCloseMobile()
            }}
          >
            <User className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              openLogin()
              onCloseMobile()
            }}
          >
            {tc('login')}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="px-2 pb-2">
      <div
        className={cn('flex items-center gap-2 rounded-md p-1.5', collapsed && 'justify-center')}
      >
        <Dropdown
          align="start"
          side="top"
          items={[
            {
              key: 'header',
              label: (
                <div className="flex items-center gap-2 px-1 py-1">
                  <Avatar src={user?.avatar ?? undefined} name={user?.nickname ?? 'U'} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{user?.nickname ?? 'User'}</div>
                    {user?.phone && (
                      <div className="truncate text-xs text-muted-foreground">{user.phone}</div>
                    )}
                  </div>
                </div>
              ),
            },
            { key: 'div1', divider: true },
            {
              key: 'profile',
              label: t('user'),
              icon: User,
              onSelect: () => {
                router.push('/user/profile')
                onCloseMobile()
              },
            },
            {
              key: 'settings',
              label: t('settings'),
              icon: Settings,
              onSelect: () => {
                router.push('/settings')
                onCloseMobile()
              },
            },
            { key: 'div2', divider: true },
            {
              key: 'logout',
              label: tc('logout'),
              icon: LogOut,
              danger: true,
              onSelect: handleLogout,
            },
          ]}
          trigger={
            <button
              className="rounded-full outline-none ring-offset-background transition-colors hover:ring-2 hover:ring-ring"
              title={user?.nickname ?? 'User'}
            >
              <Avatar src={user?.avatar ?? undefined} name={user?.nickname ?? 'U'} size="sm" />
            </button>
          }
        />
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-sm font-medium">{user?.nickname ?? 'User'}</span>
            <Popover
              position="top"
              content={
                <div className="w-80">
                  <NotificationCenter
                    items={notices}
                    onMarkAllRead={unread > 0 ? () => markAllMut.mutate() : undefined}
                    onItemClick={() => {
                      router.push('/notifications')
                      onCloseMobile()
                    }}
                  />
                  <div className="border-t p-2 text-center">
                    <Link
                      href="/notifications"
                      onClick={onCloseMobile}
                      className="text-xs text-primary hover:underline"
                    >
                      {th('viewAll')}
                    </Link>
                  </div>
                </div>
              }
            >
              <Button
                variant="ghost"
                size="icon"
                className="relative h-7 w-7 shrink-0"
                title={th('notifications')}
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500" />
                )}
              </Button>
            </Popover>
          </>
        )}
      </div>
    </div>
  )
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)

  const [width, setWidth] = React.useState(136)
  const [isResizing, setIsResizing] = React.useState(false)

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-width')
      if (saved !== null) {
        const w = Number(saved)
        if (!Number.isNaN(w) && w >= 60 && w <= 136) setWidth(w)
      }
    } catch {
      // localStorage 不可用
    }
  }, [])

  React.useEffect(() => {
    try {
      localStorage.setItem('sidebar-width', String(width))
    } catch {
      // localStorage 不可用
    }
  }, [width])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = width
    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX
      setWidth(Math.min(Math.max(startWidth + delta, 60), 136))
    }
    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

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

  const navContent = (
    <nav className="hover-scroll scroll-fade min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
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
    <div className="shrink-0">
      <SidebarActions collapsed={collapsed} />
      <SidebarUserRow collapsed={collapsed} onCloseMobile={onCloseMobile} />
    </div>
  )

  const header = (
    <div
      className={cn(
        'flex h-10 shrink-0 items-center gap-2 px-2.5',
        collapsed && 'justify-center px-0',
      )}
    >
      {!collapsed && (
        <>
          <img
            src="/images/logo.svg"
            className="h-8 w-auto max-w-full cursor-pointer object-contain dark:hidden"
            alt="IHUI AI"
          />
          <img
            src="/images/bailogo.svg"
            className="hidden h-8 w-auto max-w-full cursor-pointer object-contain dark:block"
            alt="IHUI AI"
          />
        </>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleCollapse}
        className={cn('hidden h-7 w-7 lg:flex', !collapsed && 'ml-auto')}
        title={collapsed ? t('expand') : t('collapse')}
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onCloseMobile}
        className="ml-auto h-7 w-7 lg:hidden"
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
          'relative hidden h-screen shrink-0 flex-col bg-sidebar lg:flex',
          isResizing ? '' : 'transition-[width] duration-200',
          collapsed && 'w-[60px]',
        )}
        style={!collapsed ? { width: `${width}px` } : undefined}
      >
        {header}
        {navContent}
        {footer}
        {!collapsed && (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- 拖拽调整侧边栏宽度的手柄
          <div
            onMouseDown={handleMouseDown}
            className="group absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize"
          >
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border transition-all duration-200 group-hover:w-[3px] group-hover:bg-primary" />
          </div>
        )}
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
          'fixed inset-y-0 left-0 z-50 flex w-[136px] flex-col bg-sidebar transition-transform duration-200 lg:hidden',
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
