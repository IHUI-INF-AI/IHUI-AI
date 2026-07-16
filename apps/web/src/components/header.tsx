'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { Menu, Bell, Search, Sun, Moon, User as UserIcon, LogOut, Megaphone } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { Button, Input, ThemeLogo } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { api, type Announcement } from '@/lib/content'
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  type NotificationItem,
} from '@/lib/notification-api'
import { Avatar } from '@/components/data/Avatar'
import { Tooltip, TooltipProvider, Dropdown, Popover } from '@/components/feedback'
import { NotificationCenter, type NoticeItem } from '@/components/feature-center'
import { useLoginDialogStore } from '@/stores/login-dialog'

const NAV_ITEMS: { href: string; zh: string; en: string }[] = [
  { href: '/', zh: '首页', en: 'Home' },
  { href: '/learn', zh: '课程', en: 'Course' },
  { href: '/live', zh: '直播', en: 'Live' },
  { href: '/exam', zh: '考试', en: 'Exam' },
  { href: '/news', zh: '资讯', en: 'News' },
  { href: '/topics', zh: '文章', en: 'Article' },
  { href: '/asks', zh: '问答', en: 'Q&A' },
  { href: '/circles', zh: '社区', en: 'Community' },
  { href: '/knowledge-base', zh: '知识库', en: 'Knowledge' },
  { href: '/announcements', zh: '公告', en: 'Notice' },
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

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const t = useTranslations('header')
  const tc = useTranslations('common')
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [searchInput, setSearchInput] = React.useState('')

  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)
  const openLogin = useLoginDialogStore((s) => s.open)

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => api<{ list: Announcement[] }>('/api/announcements').then((d) => d.list ?? []),
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated,
    retry: false,
  })
  const hasUnread = announcements.some((a) => !a.isRead)

  const qc = useQueryClient()
  const { data: notifData } = useQuery({
    queryKey: ['header', 'notifications'],
    queryFn: () => unwrap(getNotifications({ page: 1, pageSize: 10 })),
    staleTime: 30 * 1000,
    enabled: isAuthenticated,
    retry: false,
  })
  const { data: unreadData } = useQuery({
    queryKey: ['header', 'unread-count'],
    queryFn: () => unwrap(getUnreadCount()),
    staleTime: 30 * 1000,
    enabled: isAuthenticated,
    retry: false,
  })
  const headerNotices: NoticeItem[] = (
    (notifData?.list ?? []) as unknown as NotificationItem[]
  ).map((n) => ({
    id: n.id,
    title: n.title,
    description: n.content || undefined,
    type: mapNotifType(n.type),
    read: n.isRead,
    createdAt: n.createdAt,
  }))
  const headerUnread = unreadData?.notification ?? 0
  const markAllHeaderMut = useMutation({
    mutationFn: () => unwrap(markAllNotificationsRead()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['header', 'unread-count'] })
      qc.invalidateQueries({ queryKey: ['header', 'notifications'] })
    },
  })

  React.useEffect(() => setMounted(true), [])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const kw = searchInput.trim()
    if (kw) router.push(`/search?q=${encodeURIComponent(kw)}`)
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label={t('menu')}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Link href="/" className="flex shrink-0 items-center" aria-label="IHUI AI">
        <ThemeLogo />
      </Link>

      <nav
        className="hidden flex-1 items-center justify-center gap-0.5 lg:flex"
        aria-label={t('menu') ?? '主导航'}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center rounded-md px-2.5 py-1 transition-colors',
                active
                  ? 'bg-primary/10 font-semibold text-primary'
                  : 'text-foreground hover:bg-primary/5',
              )}
            >
              <span className="text-sm leading-tight">{item.zh}</span>
              <span
                className="text-[9px] uppercase leading-tight opacity-70"
                style={{ fontFamily: "'EDIX', 'HarmonyOS Sans SC', sans-serif" }}
              >
                {item.en}
              </span>
            </Link>
          )
        })}
      </nav>

      <form onSubmit={handleSearch} className="relative hidden ml-auto sm:block sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="pl-9"
          aria-label={t('searchPlaceholder')}
        />
      </form>

      <TooltipProvider>
        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          <Tooltip content={t('searchPlaceholder')}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('searchPlaceholder')}
              onClick={() => router.push('/search')}
              className="sm:hidden"
            >
              <Search className="h-5 w-5" />
            </Button>
          </Tooltip>
          <Tooltip content={t('announcements')}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('announcements')}
              onClick={() => router.push('/announcements')}
              className="relative"
            >
              <Megaphone className="h-5 w-5" />
              {hasUnread && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
              )}
            </Button>
          </Tooltip>

          <Tooltip content={t('toggleTheme')}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('toggleTheme')}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {mounted && theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </Tooltip>

          <Popover
            position="bottom"
            content={
              <div className="w-80">
                <NotificationCenter
                  items={headerNotices}
                  onMarkAllRead={headerUnread > 0 ? () => markAllHeaderMut.mutate() : undefined}
                  onItemClick={() => router.push('/notifications')}
                />
                <div className="border-t p-2 text-center">
                  <Link href="/notifications" className="text-xs text-primary hover:underline">
                    {t('viewAll')}
                  </Link>
                </div>
              </div>
            }
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('notifications')}
              className="relative"
            >
              <Bell className="h-5 w-5" />
              {headerUnread > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
              )}
            </Button>
          </Popover>

          {isAuthenticated ? (
            <Dropdown
              align="end"
              items={[
                {
                  key: 'info',
                  label: (
                    <div className="px-2 py-0.5 text-sm">
                      <div className="font-medium">{user?.nickname ?? 'User'}</div>
                      {user?.phone && (
                        <div className="text-xs text-muted-foreground">{user.phone}</div>
                      )}
                    </div>
                  ),
                },
                { key: 'div1', divider: true },
                {
                  key: 'profile',
                  label: t('profile'),
                  icon: UserIcon,
                  onSelect: () => router.push('/settings'),
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
                  className="ml-1 rounded-full ring-offset-background transition-colors hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t('profile')}
                >
                  <Avatar src={user?.avatar ?? undefined} name={user?.nickname ?? 'U'} size="sm" />
                </button>
              }
            />
          ) : (
            <Button variant="ghost" size="sm" className="ml-1" onClick={() => openLogin()}>
              {tc('login')}
            </Button>
          )}
        </div>
      </TooltipProvider>
    </header>
  )
}

export default Header
