'use client'

import * as React from 'react'
// @ts-ignore
import Link from 'next/link'
// @ts-ignore
import { useTranslations, useLocale } from 'next-intl'
// @ts-ignore
import { Activity, Database, Crown, AlertCircle, Loader2, ArrowLeft, RefreshCw } from 'lucide-react'

import { fetchApi } from '@/lib/api'
// @ts-ignore
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
// @ts-ignore
import { formatNumber as fmtNum } from '@/lib/date-utils'

interface SseMetrics {
  timeouts: number
  rateLimitHits: number
  budgetRejects: number
  retryAfterSent: number
  upstreamErrors: number
}
interface PromptCacheMetrics {
  hits: number
  misses: number
  l2Hits: number
  l2Misses: number
  errors: number
}
interface VipMetrics {
  applies: number
  totalDiscounted: number
  byLevel: Record<string, number>
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const hitRate = (h: number, m: number): string => {
  const total = h + m
  return total === 0 ? '—' : `${((h / total) * 100).toFixed(1)}%`
}

interface MetricItem {
  label: string
  value: string
  danger?: boolean
}

function MetricCell({ label, value, danger }: MetricItem) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', danger && 'text-red-600')}>{value}</p>
    </div>
  )
}

export default function AiMetricsPage() {
  const t = useTranslations('admin.aiMetrics')
  const locale = useLocale()
  const [sse, setSse] = React.useState<SseMetrics | null>(null)
  const [pc, setPc] = React.useState<PromptCacheMetrics | null>(null)
  const [vip, setVip] = React.useState<VipMetrics | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  const [lastRefresh, setLastRefresh] = React.useState<Date | null>(null)

  const refresh = React.useCallback(async () => {
    try {
      const [sseData, costData, vipData] = await Promise.all([
        api<SseMetrics>('/api/ai/admin/ai/chat/metrics'),
        api<{ promptCacheMetrics?: PromptCacheMetrics }>('/api/admin/ai/cost/dashboard?startDate=&endDate='),
        api<VipMetrics>('/api/admin/token-balance/metrics'),
      ])
      setSse(sseData)
      setPc(costData.promptCacheMetrics ?? { hits: 0, misses: 0, l2Hits: 0, l2Misses: 0, errors: 0 })
      setVip(vipData)
      setError(false)
      setLastRefresh(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refresh()
    const id = setInterval(refresh, 30_000)
    return () => clearInterval(id)
  }, [refresh])

  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const sseCards: MetricItem[] = sse
    ? [
        { label: t('sseTimeouts'), value: fmtNum(sse.timeouts ?? 0), danger: sse.timeouts > 0 },
        { label: t('sseRateLimitHits'), value: fmtNum(sse.rateLimitHits ?? 0), danger: sse.rateLimitHits > 0 },
        { label: t('sseBudgetRejects'), value: fmtNum(sse.budgetRejects ?? 0), danger: sse.budgetRejects > 0 },
        { label: t('sseRetryAfterSent'), value: fmtNum(sse.retryAfterSent ?? 0) },
        { label: t('sseUpstreamErrors'), value: fmtNum(sse.upstreamErrors ?? 0), danger: sse.upstreamErrors > 0 },
      ]
    : []

  const pcCards: MetricItem[] = pc
    ? [
        { label: t('pcL1Hits'), value: fmtNum(pc.hits ?? 0) },
        { label: t('pcL1Misses'), value: fmtNum(pc.misses ?? 0) },
        { label: t('pcL2Hits'), value: fmtNum(pc.l2Hits ?? 0) },
        { label: t('pcL2Misses'), value: fmtNum(pc.l2Misses ?? 0) },
        { label: t('pcErrors'), value: fmtNum(pc.errors ?? 0), danger: (pc.errors ?? 0) > 0 },
      ]
    : []

  const vipLevels = vip?.byLevel ? Object.entries(vip.byLevel) : []
  const showError = error && !sse && !pc && !vip

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Activity className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link
          href="/admin/ai-cost"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm hover:bg-muted/50"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('backToCost')}</span>
        </Link>
      </div>

      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        <span>
          {showError
            ? t('loadFailed')
            : lastRefresh
              ? t('lastRefresh', { time: timeFmt.format(lastRefresh) })
              : ''}
        </span>
      </div>

      {showError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <p className="text-sm text-muted-foreground">{t('loadFailed')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                {t('sseMetrics')}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t('sseMetricsDesc')}</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {sseCards.map((c, i) => (
                  <MetricCell key={i} {...c} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" />
                {t('promptCache')}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t('promptCacheDesc')}</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {pcCards.map((c, i) => (
                  <MetricCell key={i} {...c} />
                ))}
              </div>
              {pc && (
                <p className="mt-3 text-xs text-muted-foreground">
                  L1: {hitRate(pc.hits, pc.misses)} / L2: {hitRate(pc.l2Hits, pc.l2Misses)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Crown className="h-4 w-4" />
                {t('vipDiscount')}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t('vipDiscountDesc')}</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCell label={t('vipApplies')} value={fmtNum(vip?.applies ?? 0)} />
                <MetricCell label={t('vipTotalDiscounted')} value={fmtNum(vip?.totalDiscounted ?? 0)} />
                {vipLevels.map(([level, count]) => (
                  <MetricCell
                    key={level}
                    label={t('vipLevel', { level: level.replace(/^vip/i, '') })}
                    value={fmtNum(count)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
