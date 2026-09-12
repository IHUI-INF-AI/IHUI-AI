// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import {
  Activity,
  Database,
  Crown,
  AlertCircle,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Code2,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
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

/** FIM 补全接受率单模型汇总(P1-9,来自 ai-service /api/llm/fim/metrics/summary) */
interface FimModelMetrics {
  model: string
  requests: number
  suggestions: number
  accepted: number
  acceptanceRate: number | null
  failures: number
  p50LatencyMs: number | null
  p95LatencyMs: number | null
  alert: boolean
  alertReason: string | null
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
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', danger && 'text-red-600')}>
        {value}
      </p>
    </div>
  )
}

export default function AiMetricsPage() {
  const t = useTranslations('admin.aiMetrics')
  const locale = useLocale()
  const [sse, setSse] = React.useState<SseMetrics | null>(null)
  const [pc, setPc] = React.useState<PromptCacheMetrics | null>(null)
  const [vip, setVip] = React.useState<VipMetrics | null>(null)
  const [fim, setFim] = React.useState<FimModelMetrics[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(false)
  const [lastRefresh, setLastRefresh] = React.useState<Date | null>(null)

  const refresh = React.useCallback(async () => {
    try {
      const [sseData, costData, vipData, fimData] = await Promise.all([
        api<SseMetrics>('/api/ai/admin/ai/chat/metrics'),
        api<{ promptCacheMetrics?: PromptCacheMetrics }>(
          '/api/admin/ai/cost/dashboard?startDate=&endDate=',
        ),
        api<VipMetrics>('/api/admin/token-balance/metrics'),
        // FIM 补全接受率:ai-service 端点。单独 catch 兜底,避免其不可用拖垮整页看板
        api<{ models: FimModelMetrics[] }>('/api/llm/fim/metrics/summary').catch(() => ({
          models: [] as FimModelMetrics[],
        })),
      ])
      setSse(sseData)
      setPc(
        costData.promptCacheMetrics ?? { hits: 0, misses: 0, l2Hits: 0, l2Misses: 0, errors: 0 },
      )
      setVip(vipData)
      setFim(fimData.models ?? [])
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
        {
          label: t('sseRateLimitHits'),
          value: fmtNum(sse.rateLimitHits ?? 0),
          danger: sse.rateLimitHits > 0,
        },
        {
          label: t('sseBudgetRejects'),
          value: fmtNum(sse.budgetRejects ?? 0),
          danger: sse.budgetRejects > 0,
        },
        { label: t('sseRetryAfterSent'), value: fmtNum(sse.retryAfterSent ?? 0) },
        {
          label: t('sseUpstreamErrors'),
          value: fmtNum(sse.upstreamErrors ?? 0),
          danger: sse.upstreamErrors > 0,
        },
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
  const fimAlerts = fim.filter((m) => m.alert)
  const showError = error && !sse && !pc && !vip

  return (
    <div className="space-y-4 px-4 py-4">
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
          <CardContent className="flex flex-col items-center justify-center gap-2 py-8 text-center">
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
              <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-5">
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
              <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-5">
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
              <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
                <MetricCell label={t('vipApplies')} value={fmtNum(vip?.applies ?? 0)} />
                <MetricCell
                  label={t('vipTotalDiscounted')}
                  value={fmtNum(vip?.totalDiscounted ?? 0)}
                />
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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Code2 className="h-4 w-4" />
                {t('fimAcceptance')}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t('fimAcceptanceDesc')}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {fimAlerts.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-red-600/40 bg-red-600/5 p-3 text-sm text-red-600">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    <p>{t('fimAlert')}</p>
                    {fimAlerts.map((m) => (
                      <p key={m.model} className="text-xs">
                        {m.model}: {m.alertReason}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {fim.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">{t('fimNoData')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('fimModel')}</TableHead>
                        <TableHead className="text-right">{t('fimRequests')}</TableHead>
                        <TableHead className="text-right">{t('fimSuggestions')}</TableHead>
                        <TableHead className="text-right">{t('fimAccepted')}</TableHead>
                        <TableHead className="text-right">{t('fimAcceptanceRate')}</TableHead>
                        <TableHead className="text-right">{t('fimLatency')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fim.map((m) => (
                        <TableRow key={m.model}>
                          <TableCell className="font-mono text-xs">{m.model}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtNum(m.requests)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtNum(m.suggestions)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmtNum(m.accepted)}
                          </TableCell>
                          <TableCell
                            className={cn('text-right tabular-nums', m.alert && 'text-red-600')}
                          >
                            {m.acceptanceRate === null
                              ? '—'
                              : `${(m.acceptanceRate * 100).toFixed(1)}%`}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {m.p50LatencyMs === null
                              ? '—'
                              : `${m.p50LatencyMs} / ${m.p95LatencyMs ?? '—'}`}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
