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
  Download,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@ihui/ui'
import { useAuthStore } from '@/stores/auth'
import { useLanguageStore, type Language } from '@/stores/language'
import { Avatar } from '@/components/data/Avatar'
import { Tooltip, TooltipProvider, Dropdown, Popover } from '@/components/feedback'

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

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  id?: string
  mobileOpen: boolean
  onCloseMobile: () => void
}

/** 侧边栏底部工具栏:语言 / 下载客户端（搜索与主题切换由 Header 承载，避免重复） */
function SidebarActions({ collapsed }: { collapsed: boolean }) {
  const { locale, setLocale } = useLanguageStore()

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

/** 侧边栏底部用户区:头像 + 用户名 + 下拉菜单(profile/settings/logout)。未登录态不渲染(Header 已有登录入口)。 */
function SidebarUserRow({
  collapsed,
  onCloseMobile,
}: {
  collapsed: boolean
  onCloseMobile: () => void
}) {
  const t = useTranslations('nav')
  const tc = useTranslations('common')
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  if (!isAuthenticated) return null

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
          <span className="flex-1 truncate text-sm font-medium">{user?.nickname ?? 'User'}</span>
        )}
      </div>
    </div>
  )
}

export function Sidebar({
  id,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)

  const [width, setWidth] = React.useState(168)
  const [isResizing, setIsResizing] = React.useState(false)

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-width')
      if (saved !== null) {
        const w = Number(saved)
        if (!Number.isNaN(w) && w >= 60 && w <= 240) setWidth(w)
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

  const navRef = React.useRef<HTMLElement>(null)
  const itemRefs = React.useRef<Map<string, HTMLAnchorElement>>(new Map())
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = width
    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX
      setWidth(Math.min(Math.max(startWidth + delta, 60), 240))
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

  const activeHref = React.useMemo(() => {
    const found = visibleItems.find((item) => isActive(item.href))
    return found?.href
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, visibleItems])

  React.useEffect(() => {
    if (!activeHref) return
    const el = itemRefs.current.get(activeHref)
    const nav = navRef.current
    if (el && nav) {
      const navRect = nav.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      if (elRect.top < navRect.top || elRect.bottom > navRect.bottom) {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        el.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' })
      }
    }
  }, [activeHref])

  const navContent = (
    <TooltipProvider>
      <nav
        ref={navRef}
        id={id}
        aria-label={t('title') ?? '主导航'}
        className="hover-scroll scroll-fade min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-2"
      >
        {visibleItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          const label = t(item.labelKey)
          const className = cn(
            'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors',
            active
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            collapsed && 'justify-center',
          )
          const refCb = (el: HTMLAnchorElement | null) => {
            if (el) itemRefs.current.set(item.href, el)
            else itemRefs.current.delete(item.href)
          }
          if (collapsed) {
            return (
              <Tooltip key={item.href} content={label} side="right">
                <Link
                  href={item.href}
                  ref={refCb}
                  onClick={onCloseMobile}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  className={className}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                </Link>
              </Tooltip>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={refCb}
              onClick={onCloseMobile}
              aria-current={active ? 'page' : undefined}
              className={className}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </TooltipProvider>
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
        aria-label="主导航"
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
        aria-modal="true"
        aria-label="主导航"
        role="dialog"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[168px] flex-col bg-sidebar transition-transform duration-200 lg:hidden',
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
