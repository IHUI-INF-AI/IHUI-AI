// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Gift, Users, TrendingUp, Clock, Copy, Check, Crown } from 'lucide-react'

import {
  getOverview,
  getInviteInfo,
  getCommissionRates,
  type CommissionOverview,
  type InviteInfo,
  type CommissionRatesResult,
} from '@ihui/api-client'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { StatCard } from '@/components/data'
import { AuthGatePrompt } from '@/components/common'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { formatPrice } from '@ihui/shared/utils/format'

const fmtYuan = (cents: number) => `¥${formatPrice(cents)}`

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

async function apiCommissionRates(): Promise<CommissionRatesResult> {
  const r = await getCommissionRates()
  if (!r.success) throw new Error(r.error)
  return r.data
}

const RULES = [
  { key: 'rule1', titleKey: 'rule1Title' },
  { key: 'rule2', titleKey: 'rule2Title' },
  { key: 'rule3', titleKey: 'rule3Title' },
]

export default function CommissionPlanPage() {
  const t = useTranslations('commissionPlan')
  // 分佣比例真值的空态/标题取自跨端共享词条(shared 词包,web 端由 i18n-provider 深合并)
  const te = useTranslations('earnCommission')
  const [copied, setCopied] = React.useState(false)

  // 2026-09-30 登录态门:未登录不发注定 401 的请求
  const { allow } = useAuthGate()

  const overviewQ = useQuery({
    queryKey: ['commission', 'plan', 'overview'],
    queryFn: apiOverview,
    enabled: allow,
  })
  const inviteQ = useQuery({
    queryKey: ['commission', 'plan', 'invite-info'],
    queryFn: apiInviteInfo,
    enabled: allow,
  })
  // GET /distribution/commission-rates 同挂 distributionRoutes 的 authenticate preHandler ⇒ 挡门后
  const ratesQ = useQuery({
    queryKey: ['commission', 'plan', 'rates'],
    queryFn: apiCommissionRates,
    enabled: allow,
  })

  const loading = overviewQ.isLoading || inviteQ.isLoading
  const inviteUrl = inviteQ.data?.inviteUrl ?? ''
  const inviteCode = inviteQ.data?.inviteCode ?? ''
  // 空态/错误态都不以硬编比例顶位:键与值原样取自 system_configs(category=distribution)
  const rateRows = Object.entries(ratesQ.data?.rates ?? {}).map(([level, rate]) => ({
    level,
    rate: String(rate ?? ''),
  }))

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
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-heading font-bold tracking-tight min-[768px]:text-display">
          <Gift className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      {allow ? (
        <>
          <div className="grid grid-cols-1 gap-3 min-[768px]:grid-cols-3">
            {stats.map((s) => (
              <StatCard
                key={s.label}
                title={s.label}
                value={s.value}
                icon={s.icon}
                loading={loading}
              />
            ))}
          </div>

          <Card>
            <CardContent className="min-[640px]:p-3 space-y-4 p-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Gift className="h-4 w-4 text-primary" />
                  {t('inviteTitle')}
                </h2>
                {inviteCode && (
                  <span className="rounded-md bg-cta/10 px-2.5 py-0.5 text-label font-medium text-primary">
                    {t('inviteCode')}: {inviteCode}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  placeholder={t('inviteLinkPlaceholder')}
                  className="h-9 flex-1 rounded-sm border bg-muted/40 px-3 text-sm text-muted-foreground"
                />
                <Button onClick={handleCopy} disabled={!inviteUrl}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? t('copied') : t('copy')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <AuthGatePrompt message="请先登录后查看我的分销数据" />
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('rulesTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {RULES.map((rule, idx) => (
            <div key={rule.key} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cta text-label font-bold text-cta-foreground">
                {idx + 1}
              </span>
              <div className="space-y-0.5">
                <div className="text-body font-medium">{t(rule.titleKey)}</div>
                <p className="text-xs text-muted-foreground">{t(rule.key)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 分佣比例:档位/比例逐行取自 GET /distribution/commission-rates 的在册配置;
          未配置时如实渲染空态,不再以硬编 10/15/20% 顶位(与小程序 distribution/plan 同源) */}
      {allow ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-4 w-4 text-amber-500" />
              {t('levelsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {ratesQ.isError ? (
              <p className="text-xs text-destructive">
                {ratesQ.error instanceof Error ? ratesQ.error.message : te('rateEmpty')}
              </p>
            ) : ratesQ.isLoading ? null : rateRows.length === 0 ? (
              <p className="text-xs text-muted-foreground">{te('rateEmpty')}</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 min-[768px]:grid-cols-3">
                {rateRows.map((row) => (
                  <div key={row.level} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-body font-semibold">{row.level}</span>
                      <span className="text-lg font-bold text-primary">{row.rate}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t('commissionRate')}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-center">
        <Link href="/vip">
          <Button size="lg" className="w-full min-[768px]:w-auto">
            <Crown className="h-4 w-4" />
            {t('joinVip')}
          </Button>
        </Link>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
