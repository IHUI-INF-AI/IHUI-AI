'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, LogIn, UserCircle2 } from 'lucide-react'
import { Button } from '@ihui/ui'
import { Avatar } from '@/components/data/Avatar'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { getUserStatistics } from '@/lib/user-api'
import { getBalance } from '@/lib/wallet-api'

function unwrap<T>(r: { success: boolean; data?: T; error?: string }): T {
  if (!r.success) throw new Error(r.error)
  return r.data as T
}

export function MemberCard() {
  const t = useTranslations('home.memberCard')
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [checkedIn, setCheckedIn] = React.useState(false)

  const { data: stats } = useQuery({
    queryKey: ['home', 'user-stats'],
    queryFn: async () => unwrap(await getUserStatistics()),
    enabled: isAuthenticated,
    retry: false,
  })

  const { data: wallet } = useQuery({
    queryKey: ['home', 'wallet-balance'],
    queryFn: async () => unwrap(await getBalance()),
    enabled: isAuthenticated,
    retry: false,
  })

  React.useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    fetchApi<{ signedIn: boolean }>('/api/user/check-in/status')
      .then((r) => {
        if (!cancelled && r.success && r.data) setCheckedIn(r.data.signedIn)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const handleCheckIn = async () => {
    if (checkedIn) return
    const r = await fetchApi('/api/user/check-in', { method: 'POST' })
    if (r.success) setCheckedIn(true)
  }

  const statItems = [
    { label: t('points'), value: stats?.points ?? 0, href: '/settings' },
    { label: t('balance'), value: wallet?.balance ?? 0, href: '/wallet' },
    { label: t('following'), value: stats?.followingCount ?? 0, href: '/settings' },
    { label: t('fans'), value: stats?.fansCount ?? 0, href: '/settings' },
  ]

  const quickLinks = [
    { label: t('allCourses'), href: '/learn' },
    { label: t('featuredArticles'), href: '/article' },
    { label: t('askCommunity'), href: '/ask' },
    { label: t('learningCircle'), href: '/circle' },
  ]

  return (
    <aside className="w-full shrink-0 border-t md:w-[280px] md:border-l md:border-t-0">
      <div className="flex h-full flex-col justify-between p-5">
        {isAuthenticated ? (
          <>
            <div className="flex flex-col items-center text-center">
              <Avatar
                src={user?.avatar ?? undefined}
                name={user?.nickname ?? 'U'}
                size="xl"
                className="ring-2 ring-background shadow-sm"
              />
              <Link href="/settings" className="mt-3 text-base font-semibold hover:text-primary">
                {user?.nickname ?? t('defaultUser')}
              </Link>
              <button
                onClick={handleCheckIn}
                disabled={checkedIn}
                className={`mt-3 inline-flex items-center gap-1.5 rounded-md border px-4 py-1.5 text-xs transition-colors ${
                  checkedIn
                    ? 'border-border text-muted-foreground'
                    : 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'
                }`}
              >
                <CalendarCheck className="h-3.5 w-3.5" />
                {checkedIn ? t('signedIn') : t('signIn')}
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
              {statItems.map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  className="flex flex-col items-center gap-0.5 bg-card py-3 transition-colors hover:bg-primary/5"
                >
                  <strong className="text-lg font-semibold text-primary">{s.value}</strong>
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-muted to-muted/50 text-muted-foreground/40">
                <UserCircle2 className="h-8 w-8" />
              </div>
              <p className="mt-3 text-base font-medium">{t('welcome')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('loginHint')}</p>
              <Link href="/login" className="mt-4 w-full">
                <Button size="sm" className="w-full">
                  <LogIn className="mr-1 h-3.5 w-3.5" />
                  {t('loginNow')}
                </Button>
              </Link>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {quickLinks.map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 py-3 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  {q.label}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
