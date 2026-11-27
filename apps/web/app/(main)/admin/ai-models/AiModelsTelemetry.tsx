// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 模型管理页顶部「运行监测」条(2026-11-26 立)。
 *
 * 设计取舍:
 * - 不复刻 /admin/monitor/wallboard:那里是全站大屏,这里只回答"我这几个模型配置近来跑得怎么样";
 * - QPS/Token 速率用 5 分钟窗口,1h 均值会把突发抹平;调用/Token 总量用 60 分钟窗口;
 * - 每个数字都来自 llm_call_logs 实测:0 就是 0,没有样本的延迟写「—」而不是 0ms,
 *   未归属到配置的流水在调用卡副标题里单独点名,不摊进任何一行。
 */
import * as React from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowUpRight, CircleHelp, RefreshCw, TriangleAlert } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/date-utils'
import { formatCompact } from '@/lib/number-format'
import { GradeBadge, GradeRubric, GradeTooltip } from './AiModelGradeBadge'
import {
  formatCost,
  formatLatency,
  formatPercent,
  formatRate,
  formatSeriesTick,
  formatTime,
} from './telemetry-format'
import type { AiModelTelemetry, TelemetryWindow } from './types'

interface Props {
  data: AiModelTelemetry | undefined
  isLoading: boolean
  isFetching: boolean
  isError: boolean
  window: TelemetryWindow
  onWindowChange: (window: TelemetryWindow) => void
  onRefresh: () => void
}

function Tile({
  label,
  value,
  sub,
  subTip,
  tone,
  className,
}: {
  label: string
  value: string
  sub: string
  subTip?: string
  tone?: string
  className?: string
}) {
  const body = (
    <div className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">{sub}</div>
  )
  return (
    <div
      className={cn('min-w-0 rounded-md border border-stroke-subtle bg-muted/20 p-2.5', className)}
    >
      <div className="truncate text-label text-muted-foreground">{label}</div>
      <div className={cn('mt-1 truncate text-heading font-bold tabular-nums', tone)}>{value}</div>
      {subTip && subTip !== sub ? <Tooltip content={subTip}>{body}</Tooltip> : body}
    </div>
  )
}

export function AiModelsTelemetry({
  data,
  isLoading,
  isFetching,
  isError,
  window,
  onWindowChange,
  onRefresh,
}: Props) {
  const t = useTranslations('adminAiModels')
  const locale = useLocale()
  const [hover, setHover] = React.useState<number | null>(null)

  const totals = data?.totals
  const realtime = data?.realtime
  const series = data?.series ?? []
  const peak = series.reduce((max, p) => Math.max(max, p.calls), 0)
  const hovered = hover !== null ? series[hover] : undefined

  const errorRate = totals?.errorRate ?? null
  const errorTone =
    errorRate === null
      ? 'text-muted-foreground'
      : errorRate >= 0.01
        ? 'text-danger-text'
        : errorRate >= 0.002
          ? 'text-warning-text'
          : 'text-success-text'

  const p95 = formatLatency(totals?.p95LatencyMs ?? null, locale)
  const ttft = formatLatency(totals?.ttftP95Ms ?? null, locale)
  const errorSub =
    totals && totals.calls > 0
      ? [
          p95 ? `${t('telemetry.p95Label')} ${p95}` : t('telemetry.noLatency'),
          ttft ? `TTFT ${ttft}` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : t('telemetry.noTraffic')
  const tierText = totals?.byTier
    ? [
        ['S', totals.byTier.excellent],
        ['A', totals.byTier.good],
        ['B', totals.byTier.fair],
        ['C', totals.byTier.poor],
      ]
        .filter(([, n]) => Number(n) > 0)
        .map(([tier, n]) => `${tier} ${n}`)
        .join(' · ')
    : ''
  const errorBreakdown = totals?.errorBreakdown
    ? [
        ['鉴权', totals.errorBreakdown.auth],
        ['限流', totals.errorBreakdown.rateLimit],
        ['5xx', totals.errorBreakdown.server],
        ['超时', totals.errorBreakdown.timeout],
        ['客户端', totals.errorBreakdown.client],
        ['其他', totals.errorBreakdown.other],
      ]
        .filter(([, n]) => Number(n) > 0)
        .map(([name, n]) => `${name} ${n}`)
        .join(' · ')
    : ''

  const callsSub = totals
    ? [
        t('telemetry.activeConfigs', { count: totals.activeConfigs }),
        totals.unattributedCalls > 0
          ? t('telemetry.unattributed', { count: formatNumber(totals.unattributedCalls) })
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''
  const callsSubTip = totals
    ? [
        callsSub,
        totals.attributedRate !== null
          ? t('telemetry.attributed', { pct: formatPercent(totals.attributedRate, locale) })
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{t('telemetry.title')}</CardTitle>
              {data && totals?.grade && (
                <Tooltip
                  content={
                    <GradeTooltip
                      grade={totals.grade}
                      calls={totals.calls}
                      errors={totals.errors}
                      p95LatencyMs={totals.p95LatencyMs}
                      overall
                    />
                  }
                >
                  <span className="inline-flex">
                    <GradeBadge grade={totals.grade} size="md" showScore />
                  </span>
                </Tooltip>
              )}
              {tierText && (
                <span className="text-label tabular-nums text-muted-foreground">{tierText}</span>
              )}
              <Tooltip content={<GradeRubric />} side="bottom" align="start">
                <span className="inline-flex text-muted-foreground hover:text-foreground">
                  <CircleHelp
                    className="h-3.5 w-3.5"
                    aria-label={t('telemetry.grade.rubricTitle')}
                  />
                </span>
              </Tooltip>
            </div>
            <p className="mt-0.5 text-label text-muted-foreground">
              {t('telemetry.subtitleWindow', { window })}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              {(['1h', '24h', '7d'] as const).map((value) => (
                <Button
                  key={value}
                  variant={window === value ? 'default' : 'ghost'}
                  size="xs"
                  className="h-6 px-1.5 text-[11px]"
                  onClick={() => onWindowChange(value)}
                >
                  {value}
                </Button>
              ))}
            </div>
            {data && (
              <span className="hidden text-label text-muted-foreground min-[640px]:inline">
                {t('telemetry.updatedAt', {
                  time: formatTime(data.generatedAt, locale),
                })}
              </span>
            )}
            <Button
              variant="ghost"
              size="xs"
              onClick={onRefresh}
              disabled={isFetching}
              aria-label={t('telemetry.refresh')}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            </Button>
            <Link
              href="/admin/monitor/panels"
              className="inline-flex items-center gap-0.5 text-label text-muted-foreground hover:text-foreground"
            >
              {t('telemetry.fullMonitor')}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isError ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <TriangleAlert className="h-5 w-5 text-warning" />
            <div className="text-body font-medium">{t('telemetry.loadFailed')}</div>
            <Button variant="outline" size="xs" onClick={onRefresh}>
              {t('telemetry.retry')}
            </Button>
          </div>
        ) : isLoading && !data ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 min-[768px]:grid-cols-3 min-[1536px]:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="rounded-md border border-stroke-subtle p-2.5">
                  <div className="h-3 w-16 animate-pulse rounded-xs bg-muted" />
                  <div className="mt-2 h-5 w-20 animate-pulse rounded-xs bg-muted" />
                  <div className="mt-2 h-3 w-24 animate-pulse rounded-xs bg-muted" />
                </div>
              ))}
            </div>
            <div className="h-9 animate-pulse rounded-xs bg-muted" />
          </div>
        ) : !data || !totals || !realtime ? (
          <div className="py-6 text-center text-label text-muted-foreground">
            {t('telemetry.noTraffic')}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 min-[768px]:grid-cols-3 min-[1536px]:grid-cols-6">
              <Tile
                label={t('telemetry.callsLabel')}
                value={formatNumber(totals.calls)}
                sub={callsSub}
                subTip={callsSubTip}
              />
              <Tile
                label={t('telemetry.tokensLabel')}
                value={formatCompact(totals.tokens, locale)}
                sub={t('telemetry.ioSplit', {
                  input: formatCompact(totals.promptTokens, locale),
                  output: formatCompact(totals.completionTokens, locale),
                })}
              />
              <Tile
                label={t('telemetry.qpsLabel')}
                value={formatRate(realtime.qps, locale)}
                sub={t('telemetry.last5m')}
                tone="text-foreground"
              />
              <Tile
                label={t('telemetry.tpsLabel')}
                value={formatRate(realtime.tps, locale)}
                sub={t('telemetry.last5m')}
                tone="text-foreground"
              />
              <Tile
                label={t('telemetry.errorLabel')}
                value={formatPercent(errorRate, locale)}
                sub={errorSub}
                subTip={errorBreakdown ? `${errorSub} · ${errorBreakdown}` : undefined}
                tone={errorTone}
                className="col-span-2 min-[1536px]:col-span-1"
              />
              <Tile
                label={t('telemetry.costLabel')}
                value={(totals.pricedCalls ?? 0) > 0 ? formatCost(totals.costCents, locale) : '—'}
                sub={
                  totals.calls > 0
                    ? t('telemetry.costSub', {
                        priced: formatNumber(totals.pricedCalls ?? 0),
                        calls: formatNumber(totals.calls),
                      })
                    : '—'
                }
                className="col-span-2 min-[768px]:col-span-1"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-3 text-label text-muted-foreground">
                <span>{t('telemetry.chartTitle')}</span>
                <span className="truncate tabular-nums">
                  {hovered
                    ? t('telemetry.chartHover', {
                        time: formatSeriesTick(hovered.t, window, locale),
                        calls: formatNumber(hovered.calls),
                        tokens: formatCompact(hovered.tokens, locale),
                      })
                    : peak > 0
                      ? t('telemetry.chartPeak', { count: formatNumber(peak) })
                      : null}
                </span>
              </div>
              {totals.calls > 0 ? (
                <>
                  <div
                    className="flex h-9 items-end gap-px"
                    role="img"
                    aria-label={t('telemetry.chartTitle')}
                    onMouseLeave={() => setHover(null)}
                  >
                    {series.map((point, index) => (
                      <div
                        key={point.t}
                        className="flex h-full min-w-0 flex-1 items-end"
                        onMouseEnter={() => setHover(index)}
                      >
                        <div
                          className={cn(
                            'w-full rounded-xs transition-colors',
                            point.calls > 0 ? 'bg-primary/55' : 'bg-muted',
                            hover === index && point.calls > 0 && 'bg-primary',
                          )}
                          style={{
                            height:
                              point.calls > 0
                                ? `${Math.max((point.calls / peak) * 100, 6)}%`
                                : '2px',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] tabular-nums text-muted-foreground">
                    <span>{series[0] ? formatSeriesTick(series[0].t, window, locale) : ''}</span>
                    <span>
                      {series[Math.floor(series.length / 2)]
                        ? formatSeriesTick(series[Math.floor(series.length / 2)]!.t, window, locale)
                        : ''}
                    </span>
                    <span>
                      {series[series.length - 1]
                        ? formatSeriesTick(series[series.length - 1]!.t, window, locale)
                        : ''}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex h-9 items-center justify-center text-label text-muted-foreground">
                  {t('telemetry.noTraffic')}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
