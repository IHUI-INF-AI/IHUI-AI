'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Building2,
  ArrowLeft,
  ArrowDownToLine,
  Users,
  TrendingUp,
  Wallet,
  Crown,
  Loader2,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  getOverview,
  getInviteInfo,
  type CommissionOverview,
  type InviteInfo,
} from '@/lib/distribution-api'
import { Button, Card, CardContent } from '@ihui/ui'
import { Avatar } from '@/components/data'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'

const fmtYuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`

async function apiOverview(): Promise<CommissionOverview> {
  const r = await getOverview()
  if (!r.success) throw new Error(r.error)
  return r.data
}

async function apiInviteInfo(): Promise<InviteInfo> {
  const r = await getInviteInfo()
  if (!r.success) throw new Error(r.error)
  return r.data
}

async function apiDayMonth(): Promise<{ day: number; month: number }> {
  // TODO: 后端暂无日/月收益端点，复用 commission/summary 占位
  const r = await fetchApi<{ commissionDay: number }>('/api/finance/commission/summary')
  const day = r.success ? (r.data.commissionDay ?? 0) : 0
  return { day, month: day * 30 }
}

export default function DistributionCompanyPage() {
  const t = useTranslations('distributionCompany')
  const tc = useTranslations('common')
  const user = useAuthStore((s) => s.user)

  const overviewQ = useQuery({
    queryKey: ['distribution', 'company', 'overview'],
    queryFn: apiOverview,
  })
  const inviteQ = useQuery({
    queryKey: ['distribution', 'company', 'invite-info'],
    queryFn: apiInviteInfo,
  })
  const dayMonthQ = useQuery({
    queryKey: ['distribution', 'company', 'day-month'],
    queryFn: apiDayMonth,
  })

  const loading = overviewQ.isLoading || inviteQ.isLoading
  const level = inviteQ.data?.level ?? 'L1'
  const initials = (user?.nickname ?? 'U').slice(0, 2)

  const stats = [
    {
      label: t('dayEarnings'),
      value: fmtYuan(dayMonthQ.data?.day ?? 0),
      icon: TrendingUp,
      tone: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: t('monthEarnings'),
      value: fmtYuan(dayMonthQ.data?.month ?? 0),
      icon: TrendingUp,
      tone: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: t('totalEarnings'),
      value: fmtYuan(overviewQ.data?.totalCommission ?? 0),
      icon: Wallet,
      tone: 'text-primary',
    },
    {
      label: t('pendingEarnings'),
      value: fmtYuan(overviewQ.data?.pendingCommission ?? 0),
      icon: Crown,
      tone: 'text-amber-600 dark:text-amber-400',
    },
  ]

  const teamStats = [
    { label: t('teamSize'), value: overviewQ.data?.invitedCount ?? 0 },
    { label: t('activeMembers'), value: overviewQ.data?.activeCount ?? 0 },
    { label: t('myRank'), value: overviewQ.data?.rank ?? 0 },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Link
        href="/distribution"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tc('back')}
      </Link>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Building2 className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            {loading ? (
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
            ) : (
              <Avatar src={user?.avatar} fallback={initials} name={user?.nickname} size="lg" />
            )}
            <div className="space-y-1">
              <div className="text-lg font-semibold">{user?.nickname ?? '-'}</div>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  'bg-primary/10 text-primary',
                )}
              >
                <Crown className="h-3 w-3" />
                {t('levelLabel')}: {level}
              </span>
            </div>
          </div>
          <Link href="/wallet/withdraw">
            <Button>
              <ArrowDownToLine className="h-4 w-4" />
              {t('withdraw')}
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <Icon className={cn('h-4 w-4', s.tone)} />
                </div>
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <div className={cn('text-xl font-bold tracking-tight md:text-2xl', s.tone)}>
                    {s.value}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Users className="h-4 w-4 text-primary" />
              {t('teamOverview')}
            </h2>
            <Link href="/distribution/team" className="text-sm text-primary hover:underline">
              {t('viewDetail')}
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {teamStats.map((s) => (
              <div key={s.label} className="rounded-lg bg-muted/40 px-4 py-3 text-center">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                {loading ? (
                  <Loader2 className="mx-auto mt-1 h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <div className="mt-1 text-2xl font-bold">{s.value}</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
