'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Users,
  TrendingUp,
  Wallet,
  Gift,
  Loader2,
  ArrowRight,
  DollarSign,
  CheckCircle2,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui'
import { StatCard } from '@/components/data'

interface TeamCenterData {
  totalInvitees: number
  vipInvitees: number
  monthNew: number
  commissionTotal: number
  withdrawalTotal: number
}

interface CommissionSummaryData {
  totalAmount: number
  totalToken: number
  commissionDay: number
}

interface AvailableData {
  available: number
}

interface InviteeStatsData {
  totalInvitees: number
  vipInvitees: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const fmtYuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`

export default function DistributionHomePage() {
  const t = useTranslations('distribution')
  const tc = useTranslations('common')

  const teamQ = useQuery({
    queryKey: ['distribution', 'team-center'],
    queryFn: () => api<TeamCenterData>('/api/finance/distribution/team/center'),
  })
  const summaryQ = useQuery({
    queryKey: ['distribution', 'commission-summary'],
    queryFn: () => api<CommissionSummaryData>('/api/finance/commission/summary'),
  })
  const availableQ = useQuery({
    queryKey: ['distribution', 'withdrawal-available'],
    queryFn: () => api<AvailableData>('/api/finance/withdrawal/available'),
  })
  const inviteeQ = useQuery({
    queryKey: ['distribution', 'invitee-stats'],
    queryFn: () => api<InviteeStatsData>('/api/finance/distribution/invitee-stats'),
  })

  const stats = [
    {
      label: t('teamSize'),
      value: teamQ.data?.totalInvitees ?? 0,
      icon: Users,
      tone: 'text-primary',
    },
    {
      label: t('totalCommission'),
      value: fmtYuan(summaryQ.data?.totalAmount ?? teamQ.data?.commissionTotal ?? 0),
      icon: TrendingUp,
      tone: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: t('availableCommission'),
      value: fmtYuan(availableQ.data?.available ?? 0),
      icon: Wallet,
      tone: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: t('withdrawnCommission'),
      value: fmtYuan(teamQ.data?.withdrawalTotal ?? 0),
      icon: CheckCircle2,
      tone: 'text-purple-600 dark:text-purple-400',
    },
  ]

  const entries = [
    { href: '/distribution/commission', label: t('myCommission'), icon: DollarSign },
    { href: '/distribution/orders', label: t('commissionOrders'), icon: TrendingUp },
    { href: '/distribution/team', label: t('distributionTeam'), icon: Users },
    { href: '/distribution/withdraw/records', label: t('withdrawRecords'), icon: Gift },
    { href: '/distribution/token', label: t('tokenWallet'), icon: Wallet },
  ]

  const loading = teamQ.isLoading || summaryQ.isLoading || availableQ.isLoading

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Gift className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} title={s.label} value={s.value} icon={s.icon} loading={loading} />
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t('quickEntry')}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {entries.map((e) => {
            const Icon = e.icon
            return (
              <Link key={e.href} href={e.href}>
                <Card className="transition-colors hover:bg-accent">
                  <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                    <Icon className="h-6 w-6 text-primary" />
                    <span className="text-sm font-medium">{e.label}</span>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{t('inviteStats')}</h2>
            <Link
              href="/distribution/team"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {tc('back')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/40 px-4 py-3">
              <div className="text-xs text-muted-foreground">{t('totalInvitees')}</div>
              {inviteeQ.isLoading ? (
                <Loader2 className="mt-1 h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <div className="mt-1 text-2xl font-bold">{inviteeQ.data?.totalInvitees ?? 0}</div>
              )}
            </div>
            <div className="rounded-lg bg-muted/40 px-4 py-3">
              <div className="text-xs text-muted-foreground">{t('vipInvitees')}</div>
              {inviteeQ.isLoading ? (
                <Loader2 className="mt-1 h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <div className="mt-1 text-2xl font-bold">{inviteeQ.data?.vipInvitees ?? 0}</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
