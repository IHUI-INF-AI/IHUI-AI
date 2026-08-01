'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  Coins,
  TrendingUp,
  Database,
  BarChart3,
  Zap,
  Loader2,
  Layers,
  Boxes,
  AlertCircle,
  ArrowLeft,
  Wallet,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { formatNumber as fmtNum } from '@/lib/date-utils'
import { TopUsersSection, BudgetAlertsSection, VipQuotasSection } from './AiCostSections'

interface AiCostSummary {
  totalCost: string | number
  totalTokens: number
  totalCalls: number
  cacheHitRate: number
}
interface ByModel {
  model: string
  cost: string | number
  tokens: number
  calls: number
}
interface ByDay {
  date: string
  cost: string | number
  tokens: number
  calls: number
}
interface PromptCacheMetrics {
  hits: number
  misses: number
  l2Hits: number
  l2Misses: number
  errors: number
}
interface AiCostDashboard {
  summary: AiCostSummary
  byModel: ByModel[]
  byDay: ByDay[]
  period: { startDate: string; endDate: string }
  promptCacheMetrics?: PromptCacheMetrics
}
interface Budget {
  id: string
  scope: string
  scopeKey: string
  model: string | null
  dailyTokenLimit: number
  monthlyTokenLimit: number
  dailyCostLimit: string
  monthlyCostLimit: string
  updatedAt: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY: AiCostDashboard = {
  summary: { totalCost: 0, totalTokens: 0, totalCalls: 0, cacheHitRate: 0 },
  byModel: [],
  byDay: [],
  period: { startDate: '', endDate: '' },
}

const hitRate = (h: number, m: number): string => {
  const total = h + m
  return total === 0 ? '—' : `${((h / total) * 100).toFixed(1)}%`
}

export default function AiCostPage() {
  const t = useTranslations('aiCost')
  const locale = useLocale()
  const [days, setDays] = React.useState(7)
  const startDateISO = React.useMemo(
    () => new Date(Date.now() - days * 86400_000).toISOString(),
    [days],
  )
  const endDateISO = React.useMemo(() => new Date().toISOString(), [])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'ai-cost', days],
    queryFn: () =>
      api<AiCostDashboard>(
        `/api/admin/ai/cost/dashboard?startDate=${startDateISO}&endDate=${endDateISO}`,
      ).catch(() => EMPTY),
    retry: false,
  })

  const { data: budgets } = useQuery({
    queryKey: ['admin', 'ai-cost', 'budgets'],
    queryFn: () => api<Budget[]>('/api/admin/ai/cost/budgets').catch(() => [] as Budget[]),
    retry: false,
  })

  const d = data ?? EMPTY
  const curFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })
  const totalCost = Number(d.summary.totalCost ?? 0) / 100
  const pc = d.promptCacheMetrics

  // 计算最大值用于水平条形图
  const maxModelCost = Math.max(...d.byModel.map((m) => Number(m.cost) || 0), 1)
  const maxDayCost = Math.max(...d.byDay.map((r) => Number(r.cost) || 0), 1)
  const dayFmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })

  const cards = [
    {
      key: 'totalCost',
      label: t('totalCost'),
      value: curFmt.format(totalCost),
      icon: Coins,
      cls: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'totalTokens',
      label: t('totalTokens'),
      value: fmtNum(d.summary.totalTokens ?? 0),
      icon: Database,
      cls: 'text-primary',
    },
    {
      key: 'totalCalls',
      label: t('totalCalls'),
      value: fmtNum(d.summary.totalCalls ?? 0),
      icon: Zap,
      cls: 'text-amber-600 dark:text-amber-400',
    },
    {
      key: 'cacheHit',
      label: t('cacheHitRate'),
      value: `${d.summary.cacheHitRate ?? 0}%`,
      icon: TrendingUp,
      cls: 'text-purple-600 dark:text-purple-400',
    },
    ...(pc
      ? [
          {
            key: 'l1Hit',
            label: t('l1HitRate'),
            value: hitRate(pc.hits, pc.misses),
            icon: Layers,
            cls: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            key: 'l2Hit',
            label: t('l2HitRate'),
            value: hitRate(pc.l2Hits, pc.l2Misses),
            icon: Boxes,
            cls: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            key: 'pcErrors',
            label: t('promptCacheErrors'),
            value: fmtNum(pc.errors ?? 0),
            icon: AlertCircle,
            cls: (pc.errors ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Coins className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/ai-metrics"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm hover:bg-muted/50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('toMetrics')}</span>
          </Link>
          <select
            aria-label={t('rangeLabel')}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value={1}>{t('range1d')}</option>
            <option value={7}>{t('range7d')}</option>
            <option value={30}>{t('range30d')}</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : isError || !data ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Database className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
            <p className="text-xs text-muted-foreground/70">{t('emptyHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 汇总卡片 */}
          <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
            {cards.map((c) => {
              const Icon = c.icon
              return (
                <Card key={c.key}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={cn('rounded-md bg-muted p-2', c.cls)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-muted-foreground">{c.label}</p>
                      <p className="text-xl font-semibold tabular-nums">{c.value}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* 按模型 + 按天 双列 */}
          <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  {t('byModel')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {d.byModel.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t('noModelData')}
                  </p>
                ) : (
                  d.byModel.slice(0, 10).map((m) => (
                    <div key={m.model} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate font-mono text-xs">{m.model}</span>
                        <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
                          {fmtNum(m.tokens)} tk ·{' '}
                          <span className="text-foreground font-medium">
                            {curFmt.format(Number(m.cost) / 100)}
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
                        <div
                          className="h-full rounded-sm bg-primary/60"
                          style={{ width: `${(Number(m.cost) / maxModelCost) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  {t('byDay')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {d.byDay.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">{t('noDayData')}</p>
                ) : (
                  d.byDay.slice(-10).map((row) => (
                    <div key={row.date} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-mono text-xs">
                          {dayFmt.format(new Date(row.date))}
                        </span>
                        <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
                          {fmtNum(row.calls)} {t('calls')} ·{' '}
                          <span className="text-foreground font-medium">
                            {curFmt.format(Number(row.cost) / 100)}
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
                        <div
                          className="h-full rounded-sm bg-emerald-500/60 dark:bg-emerald-400/60"
                          style={{ width: `${(Number(row.cost) / maxDayCost) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* 预算管理 */}
          {budgets && budgets.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-4 w-4" />
                  {t('budgets')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">{t('budgetScope')}</th>
                        <th className="py-2 pr-4 font-medium">{t('budgetKey')}</th>
                        <th className="py-2 pr-4 text-right font-medium">
                          {t('budgetDailyToken')}
                        </th>
                        <th className="py-2 pr-4 text-right font-medium">
                          {t('budgetMonthlyCost')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgets.map((b) => (
                        <tr key={b.id} className="border-b last:border-0">
                          <td className="py-2 pr-4">
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                              {b.scope}
                            </span>
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs">
                            {b.scopeKey}
                            {b.model ? ` (${b.model})` : ''}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {fmtNum(b.dailyTokenLimit)}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {curFmt.format(Number(b.monthlyCostLimit) / 100)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 用户成本排行 + 预算告警 双列 */}
          <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
            <TopUsersSection startDate={startDateISO} endDate={endDateISO} />
            <BudgetAlertsSection />
          </div>

          {/* VIP 档位配额视图 */}
          <VipQuotasSection />
        </>
      )}
    </div>
  )
}
