'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Calendar, Check, Flame, Gift, Loader2, ArrowLeft } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface SignInToday {
  signedIn: boolean
  consecutiveDays: number
  todayReward: number
  week: { date: string; day: number; reward: number; signed: boolean }[]
}
interface SignInHistoryItem {
  signInDate: string
  rewardPoints: number
  consecutiveDays: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] // 0=日 ... 6=六

export default function SignInPage() {
  const t = useTranslations('points.signIn')
  const locale = useLocale()
  const qc = useQueryClient()

  const todayQ = useQuery({
    queryKey: ['sign-in', 'today'],
    queryFn: () => api<SignInToday>('/api/sign-in/today'),
  })
  const historyQ = useQuery({
    queryKey: ['sign-in', 'history'],
    queryFn: () =>
      api<{ list: SignInHistoryItem[] }>('/api/sign-in/history').then((d) => d.list ?? []),
  })

  const signMut = useMutation({
    mutationFn: () =>
      api<{ record: { consecutiveDays: number }; points: { points: number } }>('/api/sign-in', {
        method: 'POST',
      }).then((d) => ({ points: d.points.points, consecutiveDays: d.record.consecutiveDays })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sign-in'] })
      qc.invalidateQueries({ queryKey: ['points'] })
      qc.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })

  const dateFmt = new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' })
  const fullFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const fmtShort = (v?: string) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }
  const fmtFull = (v?: string) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : fullFmt.format(d)
  }

  const today = todayQ.data
  const week = today?.week ?? []
  const signedIn = today?.signedIn ?? false
  const consecutive = today?.consecutiveDays ?? 0

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Image
              src="/images/kouzi-icon.png"
              alt=""
              aria-hidden
              width={32}
              height={32}
              className="h-8 w-8 rounded-md object-cover"
              unoptimized
            />
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link
          href="/points"
          className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToPoints')}
        </Link>
      </header>

      {todayQ.isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : todayQ.error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {(todayQ.error as Error).message}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full',
                  signedIn
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {signedIn ? <Check className="h-6 w-6" /> : <Calendar className="h-6 w-6" />}
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold">
                  {signedIn ? t('signedIn') : t('notSignedIn')}
                </p>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Flame className="h-4 w-4 text-orange-500" />
                  {t('consecutiveDays', { days: consecutive })}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 sm:items-end">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Gift className="h-4 w-4 text-primary" />
                {t('todayReward')}:{' '}
                <span className="font-semibold text-foreground">+{today?.todayReward ?? 0}</span>
              </div>
              <Button onClick={() => signMut.mutate()} disabled={signedIn || signMut.isPending}>
                {signMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : signedIn ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
                {signedIn ? t('signedInBtn') : signMut.isPending ? t('signing') : t('signInBtn')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {signMut.isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {(signMut.error as Error).message}
        </div>
      )}
      {signMut.isSuccess && (
        <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
          {t('signInSuccess', { points: signMut.data.points })}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {t('weekCalendar')}
        </h2>
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((d) => {
            const item = week.find((w) => w.day === d)
            const isSigned = item?.signed ?? false
            return (
              <div
                key={d}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors',
                  isSigned ? 'border-primary/40 bg-primary/5' : 'hover:bg-accent/50',
                )}
              >
                <span className="text-xs text-muted-foreground">{t(`day${d}`)}</span>
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium',
                    isSigned
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {isSigned ? <Check className="h-4 w-4" /> : item ? fmtShort(item.date) : '-'}
                </span>
                <span className="text-xs text-muted-foreground">+{item?.reward ?? 0}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Flame className="h-4 w-4" />
          {t('history')}
        </h2>
        {historyQ.isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : historyQ.error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {(historyQ.error as Error).message}
          </div>
        ) : historyQ.data && historyQ.data.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{t('dateLabel')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('rewardLabel')}</th>
                  <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">
                    {t('consecutiveLabel')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {historyQ.data.map((h) => (
                  <tr key={h.signInDate} className="transition-colors hover:bg-accent/50">
                    <td className="px-4 py-2 text-muted-foreground">{fmtFull(h.signInDate)}</td>
                    <td className="px-4 py-2 text-right font-medium text-emerald-600 dark:text-emerald-400">
                      +{h.rewardPoints}
                    </td>
                    <td className="hidden px-4 py-2 text-right text-muted-foreground sm:table-cell">
                      {h.consecutiveDays}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          </div>
        )}
      </section>
    </div>
  )
}
