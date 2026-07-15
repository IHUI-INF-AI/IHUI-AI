'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Gift, Users, TrendingUp, Clock, Copy, Check, Crown } from 'lucide-react'

import {
  getOverview,
  getInviteInfo,
  type CommissionOverview,
  type InviteInfo,
} from '@/lib/distribution-api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { StatCard } from '@/components/data'
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

const LEVELS = [
  { key: 'level1', rate: '10%' },
  { key: 'level2', rate: '15%' },
  { key: 'level3', rate: '20%' },
]

const RULES = [
  { key: 'rule1', titleKey: 'rule1Title' },
  { key: 'rule2', titleKey: 'rule2Title' },
  { key: 'rule3', titleKey: 'rule3Title' },
]

export default function CommissionPlanPage() {
  const t = useTranslations('commissionPlan')
  const [copied, setCopied] = React.useState(false)

  const overviewQ = useQuery({ queryKey: ['commission', 'plan', 'overview'], queryFn: apiOverview })
  const inviteQ = useQuery({
    queryKey: ['commission', 'plan', 'invite-info'],
    queryFn: apiInviteInfo,
  })

  const loading = overviewQ.isLoading || inviteQ.isLoading
  const inviteUrl = inviteQ.data?.inviteUrl ?? ''
  const inviteCode = inviteQ.data?.inviteCode ?? ''

  const stats = [
    {
      label: t('totalInvites'),
      value: String(overviewQ.data?.invitedCount ?? 0),
      icon: Users,
    },
    {
      label: t('totalEarnings'),
      value: fmtYuan(overviewQ.data?.totalCommission ?? 0),
      icon: TrendingUp,
    },
    {
      label: t('pendingSettlement'),
      value: fmtYuan(overviewQ.data?.pendingCommission ?? 0),
      icon: Clock,
    },
  ]

  const handleCopy = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Gift className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {stats.map((s) => (
          <StatCard key={s.label} title={s.label} value={s.value} icon={s.icon} loading={loading} />
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Gift className="h-4 w-4 text-primary" />
              {t('inviteTitle')}
            </h2>
            {inviteCode && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {t('inviteCode')}: {inviteCode}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={inviteUrl}
              placeholder={t('inviteLinkPlaceholder')}
              className="h-9 flex-1 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground"
            />
            <Button onClick={handleCopy} disabled={!inviteUrl}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t('copied') : t('copy')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('rulesTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {RULES.map((rule, idx) => (
            <div key={rule.key} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                {idx + 1}
              </span>
              <div className="space-y-0.5">
                <div className="text-sm font-medium">{t(rule.titleKey)}</div>
                <p className="text-xs text-muted-foreground">{t(rule.key)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="h-4 w-4 text-amber-500" />
            {t('levelsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {LEVELS.map((lv, idx) => (
              <div
                key={lv.key}
                className={cn(
                  'rounded-lg border p-4',
                  idx === 1 && 'border-primary/40 bg-primary/5',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{t(lv.key)}</span>
                  <span className="text-lg font-bold text-primary">{lv.rate}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t('commissionRate')}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Link href="/vip">
          <Button size="lg" className="w-full md:w-auto">
            <Crown className="h-4 w-4" />
            {t('joinVip')}
          </Button>
        </Link>
      </div>
    </div>
  )
}
