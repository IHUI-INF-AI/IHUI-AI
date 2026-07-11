'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Star, Coins, TrendingUp, Award, Loader2, Calendar } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'

interface Transaction {
  id: string
  type: 'earn' | 'spend' | 'sign_in' | 'invite' | 'admin'
  source: string
  amount: number
  balanceAfter: number
  description?: string
  createdAt: string
}
interface LeaderboardUser {
  userId: string
  nickname: string
  avatar?: string
  points: number
  level: number
  isMe?: boolean
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const TX_ICON: Record<Transaction['type'], React.ComponentType<{ className?: string }>> = {
  earn: TrendingUp,
  spend: Coins,
  sign_in: Star,
  invite: Award,
  admin: Star,
}

function State({
  kind,
  text,
  icon: Icon,
}: {
  kind: 'loading' | 'error' | 'empty'
  text: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  if (kind === 'error')
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {text}
      </div>
    )
  if (kind === 'loading') {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {text}
      </div>
    )
  }
  const I = Icon ?? Star
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
      <I className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  primary,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: number | string
  loading?: boolean
  primary?: boolean
}) {
  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardContent className="space-y-1.5 p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className={cn('h-3.5 w-3.5', primary && 'text-primary')} />
          {label}
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="text-2xl font-bold tracking-tight">{value ?? '-'}</div>
        )}
      </CardContent>
    </Card>
  )
}

export default function PointsPage() {
  const t = useTranslations('points')
  const locale = useLocale()
  const [tab, setTab] = React.useState<'tx' | 'lb'>('tx')
  const currentUserId = useAuthStore((s) => s.user?.id)

  const pointsQ = useQuery({
    queryKey: ['points'],
    queryFn: () =>
      api<{ points: { points: number; totalEarned: number; totalSpent: number } }>(
        '/api/points',
      ).then((d) => ({
        current: d.points.points,
        totalEarned: d.points.totalEarned,
        totalSpent: d.points.totalSpent,
      })),
  })
  const txQ = useQuery({
    queryKey: ['points', 'tx'],
    queryFn: () =>
      api<{ list: Transaction[] }>('/api/points/transactions').then((d) => d.list ?? []),
  })
  const lbQ = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api<{ list: LeaderboardUser[] }>('/api/leaderboard').then((d) => d.list ?? []),
    select: (list) => list.map((u) => ({ ...u, isMe: u.userId === currentUserId })),
  })
  const levelQ = useQuery({
    queryKey: ['levels', 'current'],
    queryFn: () =>
      api<{
        current: { level: number; name: string; minExperience: number }
        next: { level: number; name: string; minExperience: number } | null
        experience: number
        progress: number
      }>('/api/levels/current').then((d) => ({
        level: d.current.level,
        name: d.current.name,
        currentPoints: d.experience,
        nextLevelPoints: d.next?.minExperience,
        nextLevelName: d.next?.name,
      })),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v?: string) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const points = pointsQ.data
  const level = levelQ.data
  const progress =
    level && level.nextLevelPoints
      ? Math.min(100, Math.round((level.currentPoints / level.nextLevelPoints) * 100))
      : 100
  const remaining = level?.nextLevelPoints
    ? Math.max(0, level.nextLevelPoints - level.currentPoints)
    : 0

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Star className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link href="/points/sign-in">
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4" />
            {t('signInLink')}
          </Button>
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Star}
          label={t('current')}
          value={points?.current}
          loading={pointsQ.isLoading}
          primary
        />
        <StatCard
          icon={TrendingUp}
          label={t('totalEarned')}
          value={points?.totalEarned}
          loading={pointsQ.isLoading}
        />
        <StatCard
          icon={Coins}
          label={t('totalSpent')}
          value={points?.totalSpent}
          loading={pointsQ.isLoading}
        />
        <StatCard
          icon={Award}
          label={t('level')}
          value={level ? `Lv.${level.level}` : undefined}
          loading={levelQ.isLoading}
        />
      </div>

      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{level?.name ?? '-'}</span>
            <span className="text-muted-foreground">
              {level?.nextLevelName
                ? t('nextLevel', { name: level.nextLevelName, points: remaining })
                : t('maxLevel')}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-1 border-b">
        {(['tx', 'lb'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === k
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`tab.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'tx' ? (
        txQ.isLoading ? (
          <State kind="loading" text={t('loading')} />
        ) : txQ.error ? (
          <State kind="error" text={(txQ.error as Error).message} />
        ) : txQ.data && txQ.data.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{t('source')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('amount')}</th>
                  <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">
                    {t('balance')}
                  </th>
                  <th className="hidden px-4 py-2 text-left font-medium md:table-cell">
                    {t('description')}
                  </th>
                  <th className="px-4 py-2 text-right font-medium">{t('time')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {txQ.data.map((tx) => {
                  const Icon = TX_ICON[tx.type] ?? Star
                  const positive = tx.amount >= 0
                  return (
                    <tr key={tx.id} className="transition-colors hover:bg-accent/50">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium">{tx.source}</span>
                        </div>
                      </td>
                      <td
                        className={cn(
                          'px-4 py-2 text-right font-medium',
                          positive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400',
                        )}
                      >
                        {positive ? '+' : ''}
                        {tx.amount}
                      </td>
                      <td className="hidden px-4 py-2 text-right text-muted-foreground sm:table-cell">
                        {tx.balanceAfter}
                      </td>
                      <td className="hidden px-4 py-2 text-muted-foreground md:table-cell">
                        {tx.description ?? '-'}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                        {fmt(tx.createdAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <State kind="empty" icon={Coins} text={t('empty')} />
        )
      ) : lbQ.isLoading ? (
        <State kind="loading" text={t('loading')} />
      ) : lbQ.error ? (
        <State kind="error" text={(lbQ.error as Error).message} />
      ) : lbQ.data && lbQ.data.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">{t('rank')}</th>
                <th className="px-4 py-2 text-left font-medium">{t('user')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('pointsLabel')}</th>
                <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">
                  {t('levelLabel')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lbQ.data.map((u, i) => (
                <tr
                  key={u.userId}
                  className={cn('transition-colors hover:bg-accent/50', u.isMe && 'bg-primary/5')}
                >
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                        i < 3
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {u.avatar ? (
                          <img src={u.avatar} alt={u.nickname} className="h-6 w-6 rounded-full" />
                        ) : (
                          (u.nickname?.[0] ?? 'U').toUpperCase()
                        )}
                      </div>
                      <span className="font-medium">{u.nickname}</span>
                      {u.isMe && <span className="text-xs text-primary">({t('you')})</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-medium">{u.points}</td>
                  <td className="hidden px-4 py-2 text-right text-muted-foreground sm:table-cell">
                    Lv.{u.level}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <State kind="empty" icon={Award} text={t('empty')} />
      )}
    </div>
  )
}
