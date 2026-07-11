'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Crown, Check, Loader2, Sparkles } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface VipLevel {
  id: string
  levelName: string
  levelValue: number
  price: number
  durationDays: number
  benefits: string[]
  status: number
  sortOrder: number
}

interface MyVip {
  levelName?: string
  levelValue: number
  startTime: string
  endTime: string
  status: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const formatCNY = (cents: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(cents / 100)

export default function VipMembershipPage() {
  const t = useTranslations('vip')
  const tc = useTranslations('common')
  const locale = useLocale()

  const {
    data: levelsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['vip-levels'],
    queryFn: () => api<{ items: VipLevel[] }>('/api/vip/levels'),
  })
  const { data: myData } = useQuery({
    queryKey: ['vip-my'],
    queryFn: () => api<{ vip: MyVip | null }>('/api/vip/my'),
  })

  const levels = levelsData?.items ?? []
  const myVip = myData?.vip ?? null
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const popularIdx = levels.length > 1 ? Math.floor(levels.length / 2) : 0

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1 text-center">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Crown className="h-7 w-7 text-amber-500" />
          {t('myVip')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card className={cn(myVip ? 'border-amber-500/40 bg-amber-50/40' : 'border-dashed')}>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          {myVip ? (
            <>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('currentLevel')}</p>
                <p className="flex items-center gap-2 text-lg font-semibold">
                  {myVip.levelName ?? t('title')}
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs',
                      myVip.status === 1
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {myVip.status === 1 ? t('active') : t('expired')}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('expireAt')}: {dateFmt.format(new Date(myVip.endTime))}
                </p>
              </div>
              <Button asChild>
                <Link href="/vip/details">{t('upgradeNow')}</Link>
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-lg font-semibold">{t('notVip')}</p>
                <p className="text-sm text-muted-foreground">{t('choosePlan')}</p>
              </div>
              <Button asChild variant="outline">
                <Link href="/vip/details">{t('subscribe')}</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : levels.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <Crown className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-start">
          {levels.map((level, idx) => {
            const isPopular = idx === popularIdx
            const benefits = Array.isArray(level.benefits) ? level.benefits : []
            return (
              <Card
                key={level.id}
                className={cn(
                  'relative flex flex-col transition-shadow',
                  isPopular && 'border-amber-500/50 shadow-lg lg:scale-105',
                )}
              >
                {isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-white shadow">
                    <Sparkles className="mr-1 inline h-3 w-3" />
                    {t('popular')}
                  </span>
                )}
                <CardHeader className="p-6 pb-3">
                  <CardTitle className="text-xl">{level.levelName}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col p-6 pt-0">
                  <div className="mb-4 flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{formatCNY(level.price)}</span>
                    <span className="text-sm text-muted-foreground">
                      {t('durationDays', { days: level.durationDays })}
                    </span>
                  </div>

                  {benefits.length > 0 && (
                    <ul className="mb-6 space-y-2 text-sm">
                      {benefits.map((b, i) => (
                        <li key={`benefit-${i}`} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-auto pt-4">
                    <Button asChild className="w-full" variant={isPopular ? 'default' : 'outline'}>
                      <Link href="/vip/details">{t('choosePlan')}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <div className="rounded-lg border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        {t('faqHint')}
      </div>
      <div className="text-center">
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {tc('backHome')}
        </Link>
      </div>
    </div>
  )
}
