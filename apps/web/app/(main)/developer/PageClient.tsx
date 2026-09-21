// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import {
  Activity,
  BarChart,
  Key,
  Webhook,
  CreditCard,
  Loader2,
  ArrowRight,
  Code,
  FlaskConical,
  FileText,
  GitBranch,
  Coins,
  Check,
  KeyRound,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { BackButton } from '@/components/common'
import { fetchUserSubscriptionStatus } from '@/lib/api-client-subscriptions'

interface DevSummary {
  callCount?: number
  keyCount?: number
  webhookCount?: number
  monthFee?: number
  planName?: string
  quotaUsed?: number
  quotaTotal?: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/** 用量接口返回结构(复用 /api/developer/relay/usage)。 */
interface DashboardUsage {
  groupBy: 'model' | 'day'
  mode: 'all' | 'relay' | 'byok'
  rows: Array<Record<string, unknown>>
  summary: {
    totalCalls: number
    totalTokens: number
    totalCostCents: number
    byokCallCount: number
    relayCallCount: number
    upstreamCostCents: number
    platformFeeCents: number
  }
}

// 本地复用 apps/web/app/(main)/purchase/helpers.ts 的纯格式化工具(2026-09-16 立)。
// 因 tsconfig alias '@/*' -> './src/*',而 purchase/helpers.ts 位于 apps/web/app/(非 src),
// '@/app/(main)/purchase/helpers' 无法解析,故就地复制三个函数并注明来源。
function formatTokens(n: number): string {
  const v = Number(n ?? 0)
  if (v === -1) return '∞'
  if (v <= 0) return '-'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`
  return String(v)
}

function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}小时${m}分`
  if (m > 0) return `${m}分${sec}秒`
  return `${sec}秒`
}

function windowPercent(used: number, limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((used / limit) * 100)))
}

export default function DeveloperHomePageClient() {
  const t = useTranslations('developerHomePage')
  const tPricing = useTranslations('developerPricingPage')
  const tByok = useTranslations('byokGuide')
  const locale = useLocale()
  const summaryQ = useQuery({
    queryKey: ['developer', 'summary'],
    queryFn: () => api<DevSummary>('/api/developer/summary').catch(() => ({}) as DevSummary),
  })

  const summary = summaryQ.data ?? {}
  const currencyFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })
  const numFmt = new Intl.NumberFormat(locale)

  const tDash = useTranslations('developer')

  // 今日成本:复用 /api/developer/relay/usage(groupBy=day + startDate=今天)。
  // 该接口仅返回 totalCostCents(实付/平台计费),无"官方价折算"字段,
  // 故按任务规则展示实付单值 + 说明文案,不臆造字段。
  const today = new Date().toISOString().slice(0, 10)
  const todayUsageQ = useQuery({
    queryKey: ['developer', 'dashboard', 'usage', 'today', today],
    queryFn: () =>
      api<DashboardUsage>(`/api/developer/relay/usage?groupBy=day&startDate=${today}`).catch(
        () => null,
      ),
  })
  const todayCostCents = todayUsageQ.data?.summary?.totalCostCents ?? 0

  // 余额窗口:复用 /api/developer/relay/subscriptions 的 status.windows。
  const subQ = useQuery({
    queryKey: ['developer', 'dashboard', 'subscription'],
    queryFn: () => fetchUserSubscriptionStatus().then((r) => (r.success ? r.data : null)),
  })
  const windows = subQ.data?.windows ?? []

  const stats = [
    {
      label: t('statCalls'),
      value: summary.callCount ?? 0,
      icon: BarChart,
      href: '/developer/logs',
      cls: 'text-primary',
      fmt: (v: number | string) => numFmt.format(Number(v)),
    },
    {
      label: t('statApiKeys'),
      value: summary.keyCount ?? 0,
      icon: Key,
      href: '/developer/relay/keys',
      cls: 'text-amber-600 dark:text-amber-400',
      fmt: (v: number | string) => numFmt.format(Number(v)),
    },
    {
      label: t('statWebhook'),
      value: summary.webhookCount ?? 0,
      icon: Webhook,
      href: '/developer/webhooks',
      cls: 'text-emerald-600 dark:text-emerald-400',
      fmt: (v: number | string) => numFmt.format(Number(v)),
    },
    {
      label: t('statMonthFee'),
      value: summary.monthFee ?? 0,
      icon: CreditCard,
      href: '/developer/billing',
      cls: 'text-rose-600 dark:text-rose-400',
      fmt: (v: number | string) => currencyFmt.format(Number(v)),
    },
  ]

  const quickEntries = [
    {
      label: t('qeApiDocsLabel'),
      desc: t('qeApiDocsDesc'),
      href: '/developer/api-docs',
      icon: Code,
    },
    {
      label: t('qeSandboxLabel'),
      desc: t('qeSandboxDesc'),
      href: '/developer/sandbox',
      icon: FlaskConical,
    },
    { label: t('qeLogsLabel'), desc: t('qeLogsDesc'), href: '/developer/logs', icon: FileText },
    {
      label: t('qeVersionsLabel'),
      desc: t('qeVersionsDesc'),
      href: '/developer/versions',
      icon: GitBranch,
    },
    {
      label: tPricing('cardLabel'),
      desc: tPricing('cardDesc'),
      href: '/developer/pricing',
      icon: Coins,
    },
  ]

  return (
    <div className="px-4 py-4 space-y-4">
      <BackButton />
      {summaryQ.error && <Alert variant="danger" description={(summaryQ.error as Error).message} />}

      <div className="grid grid-cols-2 gap-3 min-[1024px]:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Link
              key={s.label}
              href={s.href}
              className="group rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
            >
              <div className="flex items-center justify-between">
                <Icon className={cn('h-5 w-5', s.cls)} />
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="mt-2 truncate text-lg font-semibold tabular-nums">{s.fmt(s.value)}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </Link>
          )
        })}
      </div>

      {summary.planName && (
        <Card>
          <CardContent className="min-[640px]:p-3 flex items-center justify-between p-3">
            <div>
              <p className="text-xs text-muted-foreground">{t('currentPlan')}</p>
              <p className="mt-0.5 text-sm font-semibold">{summary.planName}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t('quotaUsage')}</p>
                <p className="whitespace-nowrap tabular-nums text-sm font-medium">
                  {numFmt.format(summary.quotaUsed ?? 0)} / {numFmt.format(summary.quotaTotal ?? 0)}
                </p>
              </div>
              <Link
                href="/developer/subscription"
                className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              >
                {t('upgrade')}
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 今日成本(实付价):复用用量接口;接口无官方价折算字段,展示实付单值 + 说明 */}
      <Card>
        <CardContent className="min-[640px]:p-3 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{tDash('dashboard.todayCost')}</p>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3 shrink-0" aria-hidden />
              {tDash('dashboard.actualCost')}
            </span>
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {todayUsageQ.isLoading ? '—' : `¥${(todayCostCents / 100).toFixed(2)}`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{tDash('dashboard.todayCostHint')}</p>
        </CardContent>
      </Card>

      {/* 余额窗口:日/周/月额度进度 + 重置倒计时,复用订阅接口 windows */}
      <Card>
        <CardContent className="min-[640px]:p-3 p-3">
          <p className="mb-3 text-sm font-semibold">{tDash('dashboard.balanceWindows')}</p>
          {windows.length === 0 ? (
            <p className="text-xs text-muted-foreground">{tDash('dashboard.noSubscription')}</p>
          ) : (
            <div className="space-y-3">
              {windows.map((w) => {
                const isUnlimited = w.limit === -1
                const pct = windowPercent(w.used, w.limit)
                const labelKey =
                  w.windowType === 'daily'
                    ? 'dashboard.dailyWindow'
                    : w.windowType === 'weekly'
                      ? 'dashboard.weeklyWindow'
                      : 'dashboard.monthlyWindow'
                return (
                  <div key={w.windowType}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{tDash(labelKey)}</span>
                      <span className="tabular-nums">
                        {isUnlimited
                          ? tDash('dashboard.unlimited')
                          : `${formatTokens(w.used)} / ${formatTokens(w.limit)}`}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-sm bg-muted">
                      <div
                        className="h-2 rounded-sm bg-primary transition-all"
                        style={{ width: `${isUnlimited ? 100 : pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {tDash('dashboard.resetsIn', { time: formatCountdown(w.resetsInSeconds) })}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 快捷操作入口 */}
      <Card>
        <CardContent className="min-[640px]:p-3 p-3">
          <p className="mb-3 text-sm font-semibold">{tDash('dashboard.quickActions')}</p>
          <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-3">
            <Link
              href="/developer/relay/keys"
              className="group flex flex-col gap-1 rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
            >
              <KeyRound className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <p className="mt-1 text-sm font-medium">{tDash('dashboard.createKey')}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {tDash('dashboard.createKeyDesc')}
              </p>
            </Link>
            <Link
              href="/purchase"
              className="group flex flex-col gap-1 rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
            >
              <Coins className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <p className="mt-1 text-sm font-medium">{tDash('dashboard.buyCredit')}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {tDash('dashboard.buyCreditDesc')}
              </p>
            </Link>
            <Link
              href="/developer/relay/usage"
              className="group flex flex-col gap-1 rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
            >
              <Activity className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <p className="mt-1 text-sm font-medium">{tDash('dashboard.viewUsage')}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {tDash('dashboard.viewUsageDesc')}
              </p>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-2.5 text-sm font-semibold">{t('quickEntries')}</div>
          <div className="grid grid-cols-2 gap-px bg-border/40 min-[1024px]:grid-cols-5">
            {quickEntries.map((q) => {
              const Icon = q.icon
              return (
                <Link
                  key={q.href}
                  href={q.href}
                  className="group flex flex-col gap-1 bg-card p-3 transition-colors hover:bg-accent"
                >
                  <Icon className="h-5 w-5 shrink-0 text-primary" />
                  <p className="mt-1 text-sm font-medium break-words">{q.label}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{q.desc}</p>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* BYOK 引导:自带 API Key,零中间商加价,免费模型不收费 */}
      <Card>
        <CardContent className="min-[640px]:p-3 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 [&>span]:translate-y-[0.5px]">
                <KeyRound className="h-4 w-4 shrink-0 text-primary" />
                <span className="whitespace-nowrap text-sm font-semibold">
                  {tByok('cardTitle')}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{tByok('cardDesc')}</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground [&>li]:translate-y-[var(--text-vcenter-offset)]">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                  <span className="whitespace-nowrap">{tByok('feature1')}</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                  <span className="whitespace-nowrap">{tByok('feature2')}</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                  <span className="whitespace-nowrap">{tByok('feature3')}</span>
                </li>
              </ul>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/settings/llm">{tByok('cta')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {summaryQ.isLoading && (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
          <span className="whitespace-nowrap">{t('loading')}</span>
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
