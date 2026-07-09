'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { Menu, Bell, Search, Sun, Moon, User as UserIcon, LogOut, Megaphone } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useQuery } from '@tanstack/react-query'

import { Button, Input } from '@ihui/ui'
import { useAuthStore } from '@/stores/auth'
import { api, type Announcement } from '@/lib/content'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const t = useTranslations('header')
  const tc = useTranslations('common')
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [searchInput, setSearchInput] = React.useState('')

  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements'],
    queryFn: () =>
      api<{ list: Announcement[] }>('/api/announcements').then((d) => d.list ?? []),
    staleTime: 5 * 60 * 1000,
  })
  const hasUnread = announcements.some((a) => !a.isRead)

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

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label={t('menu')}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <form onSubmit={handleSearch} className="relative hidden flex-1 md:block md:max-w-sm">
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

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" asChild aria-label={t('announcements')}>
          <Link href="/announcements" className="relative">
            <Megaphone className="h-5 w-5" />
            {hasUnread && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </Link>
        </Button>

        <Button variant="ghost" size="icon" aria-label={t('toggleTheme')} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {mounted && theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>

        <Button variant="ghost" size="icon" aria-label={t('notifications')}>
          <Bell className="h-5 w-5" />
        </Button>

        {isAuthenticated ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium ring-offset-background transition-colors hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t('profile')}
              >
                {user?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt={user.nickname} className="h-8 w-8 rounded-full" />
                ) : (
                  (user?.nickname?.[0] ?? 'U').toUpperCase()
                )}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-50 min-w-[10rem] overflow-hidden rounded-md border bg-card p-1 text-card-foreground shadow-md"
              >
                <div className="px-2 py-1.5 text-sm">
                  <div className="font-medium">{user?.nickname ?? 'User'}</div>
                  {user?.phone && (
                    <div className="text-xs text-muted-foreground">{user.phone}</div>
                  )}
                </div>
                <DropdownMenu.Separator className="my-1 h-px bg-muted" />
                <DropdownMenu.Item className="flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground">
                  <UserIcon className="h-4 w-4" />
                  <Link href="/settings" className="flex-1">{t('profile')}</Link>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-muted" />
                <DropdownMenu.Item
                  className="flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none focus:bg-accent"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  {tc('logout')}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        ) : (
          <Button asChild variant="ghost" size="sm" className="ml-1">
            <Link href="/login">{tc('login')}</Link>
          </Button>
        )}
      </div>
    </header>
  )
}

export default Header
