'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, BarChart3, Clock, DollarSign, RefreshCw, Zap } from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

/* ─── Types ─── */

interface ModelUsage {
  model: string
  calls: number
  tokens: number
  cost: number
  percentage: number
}

interface DailyBreakdown {
  calls: number
  tokens: number
  cost: number
}

interface UsageStatsData {
  total_calls: number
  total_tokens: number
  estimated_cost: number
  avg_latency: number
  by_model: ModelUsage[]
}

interface GlobalUsageData {
  daily_breakdown: Record<string, DailyBreakdown>
}

/* ─── Constants ─── */

const RANGE_KEYS = ['today', '7d', '30d', '90d'] as const

const RANGE_DAYS: Record<(typeof RANGE_KEYS)[number], number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

/* ─── Helpers ─── */

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatCurrency(n: number): string {
  return `¥ ${n.toFixed(2)}`
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms)}ms`
}

/* ─── TrendChart ─── */

function TrendChart({
  data,
  t,
}: {
  data: Record<string, DailyBreakdown>
  t: ReturnType<typeof useTranslations>
}) {
  const entries = Object.entries(data)
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BarChart3 className="mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">{t('usage.chart.noData')}</p>
      </div>
    )
  }

  const maxTokens = Math.max(...entries.map(([, v]) => v.tokens), 1)
  const maxCalls = Math.max(...entries.map(([, v]) => v.calls), 1)

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Tokens 趋势 */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t('usage.chart.tokens')}
            </span>
          </div>
          <div className="flex items-end gap-[2px]" style={{ height: 100 }}>
            {entries.map(([day, val]) => {
              const pct = (val.tokens / maxTokens) * 100
              return (
                <div key={day} className="flex flex-1 flex-col items-center gap-0.5">
                  <span className="text-[10px] leading-none text-muted-foreground">
                    {formatTokens(val.tokens)}
                  </span>
                  <div className="flex w-full flex-1 items-end justify-center pt-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="w-full max-w-[20px] cursor-pointer rounded-t-sm bg-primary/60 transition-colors hover:bg-primary/80"
                          style={{ height: `${Math.max(pct, 1)}%` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{day}</p>
                        <p>{formatTokens(val.tokens)} tokens</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-[10px] leading-none text-muted-foreground">
                    {day.length > 5 ? day.slice(5) : day}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Calls 趋势 */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t('usage.chart.calls')}
            </span>
          </div>
          <div className="flex items-end gap-[2px]" style={{ height: 80 }}>
            {entries.map(([day, val]) => {
              const pct = (val.calls / maxCalls) * 100
              return (
                <div key={day} className="flex flex-1 flex-col items-center gap-0.5">
                  <div className="flex w-full flex-1 items-end justify-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="w-full max-w-[20px] cursor-pointer rounded-t-sm bg-emerald-400/60 transition-colors hover:bg-emerald-400/80 dark:bg-emerald-500/50 dark:hover:bg-emerald-500/70"
                          style={{ height: `${Math.max(pct, 1)}%` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{day}</p>
                        <p>{val.calls.toLocaleString()} calls</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-[10px] leading-none text-muted-foreground">
                    {day.length > 5 ? day.slice(5) : day}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

/* ─── Loading Skeleton ─── */

function LoadingSkeleton({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <div className="flex justify-end">
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
          {RANGE_KEYS.map((key) => (
            <span
              key={key}
              className="h-7 rounded-md px-3 text-xs font-medium text-muted-foreground"
            >
              {t(`usage.ranges.${key}`)}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />
              <div className="mt-3 h-8 w-24 animate-pulse rounded bg-muted" />
              <div className="mt-1.5 flex items-center justify-between">
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="h-4 w-12 animate-pulse rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="h-2 flex-1 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Error State ─── */

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card py-16 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
        <p className="mb-1 text-sm font-medium">{error}</p>
        <p className="mb-4 text-xs text-muted-foreground">数据加载失败，请稍后重试</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          重试
        </Button>
      </div>
    </div>
  )
}

/* ─── Empty State ─── */

function EmptyState({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card py-16 text-center">
        <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t('usage.chart.noData')}</p>
      </div>
    </div>
  )
}

/* ─── Main Page ─── */

export default function UsagePage() {
  const t = useTranslations('models')
  const [days, setDays] = React.useState(7)
  const [stats, setStats] = React.useState<UsageStatsData | null>(null)
  const [globalData, setGlobalData] = React.useState<GlobalUsageData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const activeRangeKey = RANGE_KEYS.find((k) => RANGE_DAYS[k] === days) ?? '7d'

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [statsRes, globalRes] = await Promise.all([
        fetchApi<UsageStatsData>(`/api/v1/ai/usage/stats?days=${days}`),
        fetchApi<GlobalUsageData>(`/api/v1/ai/usage/global?days=${days}`),
      ])
      if (statsRes.success) {
        setStats(statsRes.data)
      } else {
        setError(statsRes.error || '加载失败')
        return
      }
      if (globalRes.success) {
        setGlobalData(globalRes.data)
      }
    } catch {
      setError('网络异常，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [days])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) return <LoadingSkeleton t={t} />
  if (error) return <ErrorState error={error} onRetry={fetchData} />
  if (!stats) return <EmptyState t={t} />

  const totalCalls = stats.total_calls ?? 0
  const totalTokens = stats.total_tokens ?? 0
  const totalCost = stats.estimated_cost ?? 0
  const avgLatency = stats.avg_latency ?? 0

  const summaryCards = [
    {
      icon: Zap,
      label: t('usage.summary.calls'),
      value: formatNumber(totalCalls),
      sub: `${totalCalls.toLocaleString()} 次`,
    },
    {
      icon: BarChart3,
      label: t('usage.summary.tokens'),
      value: formatTokens(totalTokens),
      sub: `${totalTokens.toLocaleString()} Tokens`,
    },
    {
      icon: DollarSign,
      label: t('usage.summary.cost'),
      value: formatCurrency(totalCost),
      sub: `¥ ${totalCost.toFixed(4)}`,
    },
    {
      icon: Clock,
      label: t('usage.summary.avgLatency'),
      value: formatLatency(avgLatency),
      sub:
        avgLatency >= 1000 ? `${(avgLatency / 1000).toFixed(2)}s` : `${Math.round(avgLatency)}ms`,
    },
  ]

  const models = stats.by_model ?? []

  const dailyData = globalData?.daily_breakdown ?? {}

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />

      {/* 时间范围选择 */}
      <div className="flex justify-end">
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
          {RANGE_KEYS.map((key) => {
            const isActive = activeRangeKey === key
            return (
              <button
                key={key}
                type="button"
                className={cn(
                  'h-7 rounded-md px-3 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setDays(RANGE_DAYS[key])}
              >
                {t(`usage.ranges.${key}`)}
              </button>
            )
          })}
        </div>
      </div>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
        {summaryCards.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight">{s.value}</div>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <span className="text-xs text-muted-foreground">{s.sub}</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 用量趋势图表 */}
      {Object.keys(dailyData).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              {t('usage.chart.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={dailyData} t={t} />
          </CardContent>
        </Card>
      )}

      {/* 按模型分组 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('usage.byModel.title')}</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {models.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BarChart3 className="mb-2 h-6 w-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">{t('usage.chart.noData')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">{t('usage.byModel.model')}</th>
                    <th className="px-4 py-2 font-medium">{t('usage.byModel.calls')}</th>
                    <th className="px-4 py-2 font-medium">{t('usage.byModel.tokens')}</th>
                    <th className="px-4 py-2 font-medium">{t('usage.byModel.cost')}</th>
                    <th className="px-4 py-2 font-medium">{t('usage.byModel.share')}</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <tr key={m.model} className="text-xs hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{m.model}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {m.calls.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {formatTokens(m.tokens)}
                      </td>
                      <td className="px-4 py-2.5">¥ {m.cost.toFixed(2)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-sm bg-muted">
                            <div
                              className="h-full rounded-sm bg-primary"
                              style={{ width: `${Math.min(m.percentage, 100)}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground">
                            {(m.percentage ?? 0).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
