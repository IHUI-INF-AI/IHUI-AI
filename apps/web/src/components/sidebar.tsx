'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  MessageSquare,
  FolderOpen,
  Bot,
  FileText,
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
  GraduationCap,
  Download,
  PlayCircle,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@ihui/ui'
import { useAuthStore } from '@/stores/auth'
import { useLanguageStore, type Language } from '@/stores/language'
import { Avatar } from '@/components/data/Avatar'
import { Tooltip, TooltipProvider, Dropdown, Popover } from '@/components/feedback'
import { SearchBar } from '@/components/business'
import { useClickOutside } from '@/hooks/use-click-outside'

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

/**
 * 侧边栏尺寸常量(R73 refactor 之前的仓库原状,2026-07-14 恢复)
 * 后续重构请勿随意修改 — 与设计 token 耦合:
 * - 168px 是中文 4 字导航项不换行的临界宽度(配合 nav item `gap-2.5 px-2.5 + whitespace-nowrap`)
 * - 60px 是折叠态只显图标的临界宽度(h-10 item + 居中)
 * - 240px 是避免主内容区挤压过窄的上限
 */
const SIDEBAR_DEFAULT_WIDTH = 168
const SIDEBAR_MIN_WIDTH = 60
const SIDEBAR_MAX_WIDTH = 240
const SIDEBAR_MOBILE_WIDTH = 168

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'AI',
    items: [
      { href: '/chat', labelKey: 'chat', icon: MessageSquare },
      { href: '/chat/history', labelKey: 'chatHistory', icon: MessageSquare },
      { href: '/models', labelKey: 'models', icon: Bot },
      { href: '/workspace', labelKey: 'workspace', icon: FolderOpen },
    ],
  },
  {
    label: '内容',
    items: [
      { href: '/plaza', labelKey: 'plaza', icon: LayoutGrid },
      { href: '/agents', labelKey: 'agents', icon: Bot },
      { href: '/distribution', labelKey: 'distribution', icon: Gift },
      { href: '/lecturers', labelKey: 'lecturers', icon: Users },
      { href: '/teams', labelKey: 'teams', icon: Users },
      { href: '/resources', labelKey: 'resources', icon: Package },
      { href: '/messages', labelKey: 'messages', icon: MessageSquare },
      { href: '/schedule', labelKey: 'schedule', icon: Calendar },
      { href: '/docs', labelKey: 'docs', icon: FileText },
      { href: '/search', labelKey: 'search', icon: Search },
      { href: '/favorites', labelKey: 'favorites', icon: Star },
      { href: '/following', labelKey: 'following', icon: Users },
      { href: '/subscriptions', labelKey: 'subscriptions', icon: Rss },
      { href: '/tags', labelKey: 'tags', icon: Tag },
      { href: '/oauth/platform', labelKey: 'oauthPlatform', icon: KeyRound },
    ],
  },
  {
    label: '教育',
    items: [
      { href: '/learn', labelKey: 'learn', icon: GraduationCap },
      { href: '/live', labelKey: 'live', icon: PlayCircle },
      { href: '/exam', labelKey: 'exam', icon: ScrollText },
      { href: '/asks', labelKey: 'asks', icon: MessageSquare },
    ],
  },
  {
    label: '交易',
    items: [
      { href: '/vip-membership', labelKey: 'vip', icon: Crown },
      { href: '/wallet', labelKey: 'wallet', icon: Wallet },
      { href: '/payment', labelKey: 'payment', icon: CreditCard },
      { href: '/orders', labelKey: 'orders', icon: ShoppingBag },
      { href: '/activities', labelKey: 'activities', icon: Gift },
      { href: '/points', labelKey: 'points', icon: Star },
      { href: '/edu-points', labelKey: 'eduPoints', icon: Award },
      { href: '/oauth/my-authorized', labelKey: 'oauthMyAuthorized', icon: KeyRound },
    ],
  },
  {
    label: '个人',
    items: [
      { href: '/user/profile', labelKey: 'user', icon: User },
      { href: '/student', labelKey: 'student', icon: GraduationCap },
      { href: '/settings', labelKey: 'settings', icon: Settings },
      { href: '/feedback', labelKey: 'feedback', icon: MessageSquare },
      { href: '/help', labelKey: 'help', icon: HelpCircle },
    ],
  },
  {
    label: '管理',
    items: [
      { href: '/admin', labelKey: 'admin', icon: Shield, adminOnly: true },
      { href: '/admin/statistics', labelKey: 'adminStatistics', icon: BarChart3, adminOnly: true },
      { href: '/user-center', labelKey: 'userCenter', icon: UserCircle, adminOnly: true },
      { href: '/members', labelKey: 'members', icon: Users, adminOnly: true },
      { href: '/admin/workflows', labelKey: 'adminWorkflows', icon: Workflow, adminOnly: true },
      { href: '/admin/tags', labelKey: 'adminTags', icon: Tag, adminOnly: true },
      { href: '/admin/logs', labelKey: 'adminLogs', icon: ScrollText, adminOnly: true },
    ],
  },
]

const LANGUAGES: { code: Language; name: string }[] = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
]

const DOWNLOADS = [
  { labelKey: 'downloadIOS', href: 'https://apps.apple.com/cn/app/ihui-ai' },
  { labelKey: 'downloadAndroidApk', href: '/apk/ihui-ai-latest.apk' },
  { labelKey: 'downloadWechatMiniApp', href: '/minapp' },
  { labelKey: 'downloadDesktop', href: '/download/desktop' },
]

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  id?: string
  mobileOpen: boolean
  onCloseMobile: () => void
}

/** 侧边栏底部工具栏:语言 / 下载客户端(搜索入口由 Header + 侧边栏搜索行共同承载,见 SearchNavItem) */
function SidebarActions({ collapsed }: { collapsed: boolean }) {
  const { locale, setLocale } = useLanguageStore()
  const t = useTranslations('nav')

  const handleLocaleChange = (code: Language) => {
    document.cookie = `locale=${code};path=/;max-age=31536000`
    setLocale(code)
    window.location.reload()
  }

  const btnClass = 'h-7 w-7 shrink-0'

  return (
    <div
      className={cn(
        'flex gap-1 rounded-md p-1',
        collapsed ? 'flex-col items-center' : 'flex-row justify-center',
      )}
    >
      <Popover
        position={collapsed ? 'right' : 'top'}
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
                {}
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
          title={collapsed ? t('language') : undefined}
        >
          {}
          <img src={`/images/flags/${locale}.svg`} className="h-3 w-4 object-cover" alt={locale} />
        </Button>
      </Popover>

      <Popover
        position={collapsed ? 'right' : 'top'}
        content={
          <div className="w-36 py-1">
            {DOWNLOADS.map((item) => (
              <a
                key={item.labelKey}
                href={item.href}
                className="block px-2 py-1.5 text-sm hover:bg-accent"
              >
                {t(item.labelKey)}
              </a>
            ))}
          </div>
        }
      >
        <Button
          variant="ghost"
          size="icon"
          className={btnClass}
          title={collapsed ? t('downloadClient') : undefined}
        >
          <Download className="h-4 w-4" />
        </Button>
      </Popover>
    </div>
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
              className="shrink-0 rounded-full outline-none ring-offset-background transition-colors hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={user?.nickname ?? 'User'}
              title={user?.nickname ?? 'User'}
            >
              <Avatar src={user?.avatar ?? undefined} name={user?.nickname ?? 'U'} size="sm" />
            </button>
          }
        />
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {user?.nickname ?? 'User'}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * 侧边栏'搜索'导航行:折叠态退化为 Link 跳 /search;展开态承载一个带 SearchBar 的弹层,
 * 提交后跳 /search?q=... 并关闭。点击外部 / Esc 键 / 路由变化均会关闭弹层。
 */
function SearchNavItem({
  collapsed,
  active,
  label,
  onCloseMobile,
  refCb,
}: {
  collapsed: boolean
  active: boolean
  label: string
  onCloseMobile: () => void
  refCb: (el: HTMLElement | null) => void
}) {
  const router = useRouter()
  const tc = useTranslations('common')
  const [open, setOpen] = React.useState(false)
  const popRef = useClickOutside<HTMLDivElement>(React.useCallback(() => setOpen(false), []))
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsStr = searchParams?.toString()

  // 路由变化(同路径不同 query 也算)时关闭弹层
  React.useEffect(() => {
    setOpen(false)
  }, [pathname, searchParamsStr, setOpen])

  // Esc 关闭弹层
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const handleSearch = (kw: string) => {
    router.push(`/search?q=${encodeURIComponent(kw)}`)
    setOpen(false)
    onCloseMobile()
  }

  const className = cn(
    'flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors',
    active
      ? 'bg-primary text-primary-foreground'
      : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground',
    collapsed && 'justify-center',
  )

  if (collapsed) {
    return (
      <Tooltip content={label} side="right">
        <Link
          href="/search"
          ref={refCb}
          onClick={onCloseMobile}
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          className={className}
        >
          <Search className="h-5 w-5 shrink-0" />
        </Link>
      </Tooltip>
    )
  }

  return (
    <div ref={popRef} className="relative">
      <button
        type="button"
        ref={refCb}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-current={active ? 'page' : undefined}
        onClick={() => setOpen((o) => !o)}
        className={className}
      >
        <Search className="h-5 w-5 shrink-0" />
        <span>{label}</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={tc('searchPlaceholder')}
          className="absolute left-0 top-full z-50 mt-2 w-[calc(100vw-2rem)] max-w-80 rounded-md border bg-popover p-3 text-popover-foreground shadow-md lg:left-full lg:top-0 lg:mt-0 lg:ml-2"
        >
          <SearchBar onSearch={handleSearch} placeholder={tc('searchPlaceholder')} focusOnMount />
        </div>
      )}
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
  const tc = useTranslations('common')
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)

  const [width, setWidth] = React.useState(SIDEBAR_DEFAULT_WIDTH)
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
  const itemRefs = React.useRef<Map<string, HTMLElement>>(new Map())
  const resizeCleanupRef = React.useRef<(() => void) | null>(null)

  const clampWidth = React.useCallback((w: number) => Math.min(Math.max(w, 60), 240), [])

  const stopResize = React.useCallback(() => {
    resizeCleanupRef.current?.()
    resizeCleanupRef.current = null
  }, [])

  const handleResizeStart = React.useCallback(
    (clientX: number) => {
      setIsResizing(true)
      const startX = clientX
      const startWidth = width
      const handleMouseMove = (ev: MouseEvent) => {
        setWidth(clampWidth(startWidth + (ev.clientX - startX)))
      }
      const handleMouseUp = () => stopResize()
      resizeCleanupRef.current = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        setIsResizing(false)
      }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [width, clampWidth, stopResize],
  )

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    handleResizeStart(e.clientX)
  }

  const handleResizeKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 32 : 8
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault()
        setWidth(clampWidth(width - step))
        break
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault()
        setWidth(clampWidth(width + step))
        break
      case 'Home':
        e.preventDefault()
        setWidth(SIDEBAR_MIN_WIDTH)
        break
      case 'End':
        e.preventDefault()
        setWidth(SIDEBAR_MAX_WIDTH)
        break
    }
  }

  React.useEffect(() => {
    const onBlur = () => stopResize()
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('blur', onBlur)
      stopResize()
    }
  }, [stopResize])

  const isActive = React.useCallback(
    (href: string) => {
      if (href === '/') return pathname === '/'
      if (!pathname.startsWith(href)) return false
      // 更具体的同前缀项优先高亮，避免 /chat 与 /chat/history 同时高亮
      return !NAV_GROUPS.some((g) =>
        g.items.some(
          (i) => i.href !== href && i.href.startsWith(href) && pathname.startsWith(i.href),
        ),
      )
    },
    [pathname],
  )

  const isAdmin = (user?.roleId ?? 0) >= 1
  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.adminOnly || isAdmin),
  })).filter((g) => g.items.length > 0)

  const activeHref = React.useMemo(() => {
    const found = visibleGroups.flatMap((g) => g.items).find((item) => isActive(item.href))
    return found?.href
  }, [visibleGroups, isActive])

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
        className="hover-scroll scroll-fade min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2"
      >
        {visibleGroups.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'pt-2' : ''}>
            {!collapsed && (
              <div className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              const label = t(item.labelKey)
              const className = cn(
                'flex h-10 w-full min-w-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground',
                collapsed && 'justify-center',
              )
              const refCb = (el: HTMLElement | null) => {
                if (el) itemRefs.current.set(item.href, el)
                else itemRefs.current.delete(item.href)
              }
              // 搜索行:展开态承载弹层 + SearchBar,折叠态保留 Link 跳 /search
              if (item.labelKey === 'search') {
                return (
                  <SearchNavItem
                    key={item.href}
                    collapsed={collapsed}
                    active={active}
                    label={label}
                    onCloseMobile={onCloseMobile}
                    refCb={refCb}
                  />
                )
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
          </div>
        ))}
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
        'flex h-10 shrink-0 items-center gap-2 px-2.5 transition-[padding] duration-200',
        collapsed && 'justify-center px-0',
      )}
    >
      {!collapsed && (
        <>
          {}
          <img
            src="/images/logo.svg"
            className="h-8 w-auto max-w-full cursor-pointer object-contain dark:hidden"
            alt="IHUI AI"
          />
          {}
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
        className={cn('hidden h-7 w-7 lg:flex', !collapsed ? 'ml-auto' : 'mx-auto')}
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
        aria-label={t('mainNav')}
        className={cn(
          'relative hidden h-screen shrink-0 flex-col overflow-y-hidden overflow-x-visible border-r border-border bg-sidebar lg:flex',
          isResizing ? '' : 'transition-[width] duration-200',
          collapsed && 'w-[60px]',
        )}
        style={!collapsed ? { width: `${width}px` } : undefined}
      >
        {header}
        {navContent}
        {footer}
        {!collapsed && (
          <div
            role="slider"
            aria-label={tc('resizeSidebar')}
            aria-valuenow={width}
            aria-valuemin={SIDEBAR_MIN_WIDTH}
            aria-valuemax={SIDEBAR_MAX_WIDTH}
            tabIndex={0}
            onMouseDown={handleResizeMouseDown}
            onKeyDown={handleResizeKeyDown}
            className="group absolute right-0 top-0 z-10 flex h-full w-1.5 cursor-col-resize items-center justify-center outline-none focus-visible:w-2 focus-visible:bg-primary/10"
          >
            <div className="h-full w-px bg-border transition-all duration-200 group-hover:w-[3px] group-hover:bg-primary group-focus-visible:w-[3px] group-focus-visible:bg-primary" />
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
        aria-label={t('mainNav')}
        role="dialog"
        style={{ width: SIDEBAR_MOBILE_WIDTH }}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col overflow-y-hidden overflow-x-visible border-r border-border bg-sidebar transition-transform duration-200 lg:hidden',
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
