// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useEffect, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Eye, Pencil, Trash2, Zap } from 'lucide-react'
import { Button, Switch } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import { formatNumber } from '@/lib/date-utils'
import { formatCompact } from '@/lib/number-format'
import { GradeBadge, GradeRubric, GradeTooltip } from './AiModelGradeBadge'
import { formatClock, formatLatency, formatRate } from './telemetry-format'
import type { AiModelGovernance, ConfigTelemetry, ModelRow, TelemetryWindow } from './types'

interface Props {
  list: ModelRow[]
  isLoading: boolean
  telemetry?: Record<string, ConfigTelemetry>
  telemetryReady?: boolean
  realtimeMinutes?: number
  window: TelemetryWindow
  governance?: AiModelGovernance
  togglePending: boolean
  testPending: boolean
  onToggle: (item: ModelRow) => void
  onTest: (id: number) => void
  onEdit: (item: ModelRow) => void
  onDelete: (item: ModelRow) => void
  onInspect: (id: number) => void
}

function endpointHost(baseUrl: string) {
  try {
    return new URL(baseUrl).host
  } catch {
    return baseUrl
  }
}

function RuntimeCell({
  metric,
  realtimeMinutes,
  window,
  ready,
}: {
  metric: ConfigTelemetry | undefined
  realtimeMinutes: number
  window: TelemetryWindow
  ready: boolean
}) {
  const locale = useLocale()
  const t = useTranslations('adminAiModels')

  if (!metric || metric.calls === 0) {
    return (
      <span className="text-label text-muted-foreground">
        {ready ? t('telemetry.cellNoCalls', { window }) : t('telemetry.cellUnavailable')}
      </span>
    )
  }

  const seconds = Math.max(realtimeMinutes * 60, 1)
  const qps = formatRate(metric.calls5m / seconds, locale)
  const tps = formatRate(metric.tokens5m / seconds, locale)
  const p95 = formatLatency(metric.p95LatencyMs, locale)
  const last = metric.lastCallAt ? formatClock(metric.lastCallAt, locale) : '—'

  return (
    <Tooltip
      content={t('telemetry.cellTip', {
        window,
        calls: formatNumber(metric.calls),
        tokens: formatCompact(metric.tokens, locale),
        errors: formatNumber(metric.errors),
        p95: p95 ?? t('telemetry.noLatency'),
        last,
      })}
    >
      <div className="space-y-0.5 text-label tabular-nums">
        <div className="whitespace-nowrap">
          <span className="font-medium">
            {t('telemetry.cellCalls', {
              count: formatCompact(metric.calls, locale),
              tokens: formatCompact(metric.tokens, locale),
            })}
          </span>
        </div>
        <div className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground">
          <span>{t('telemetry.cellRates', { qps, tps })}</span>
          {metric.errors > 0 && (
            <span className="text-danger-text">
              · {t('telemetry.cellErrors', { count: formatNumber(metric.errors) })}
            </span>
          )}
        </div>
      </div>
    </Tooltip>
  )
}

function GradeCell({ metric, ready }: { metric: ConfigTelemetry | undefined; ready: boolean }) {
  if (!ready) return <span className="text-label text-muted-foreground">—</span>
  const grade = metric?.grade ?? { tier: 'insufficient' as const, score: null, sample: 0 }
  return (
    <Tooltip
      content={
        <GradeTooltip
          grade={grade}
          calls={metric?.calls ?? 0}
          errors={metric?.errors ?? 0}
          p95LatencyMs={metric?.p95LatencyMs ?? null}
        />
      }
    >
      <button
        type="button"
        className="inline-flex cursor-default border-0 bg-transparent p-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-stroke-focus"
      >
        <GradeBadge grade={grade} />
      </button>
    </Tooltip>
  )
}

export function AiModelsTable({
  list,
  isLoading,
  telemetry,
  telemetryReady = false,
  realtimeMinutes = 5,
  window,
  governance,
  togglePending,
  testPending,
  onToggle,
  onTest,
  onEdit,
  onDelete,
  onInspect,
}: Props) {
  const t = useTranslations('adminAiModels')
  const scrollRef = useRef<HTMLDivElement>(null)
  // 只在行集合变化(筛选/翻页)时归零横向滚动;mutation 后 refetch 是同一批行,
  // 若依赖 list 引用会导致用户刚拖到右侧又被弹回行首。
  const scrollResetKey = list.map((item) => item.id).join('|')
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 })
  }, [scrollResetKey])
  // 同名不同端点(典型:Qoder 的 gateway 反代行与 openapi 上游登记行)只靠 Base URL 区分,
  // 在名称下补一行 host,避免用户看成两条重复配置。
  const nameCounts = new Map<string, number>()
  for (const item of list) nameCounts.set(item.name, (nameCounts.get(item.name) ?? 0) + 1)
  return (
    <div className="rounded-md border border-border">
      <div ref={scrollRef} className="overflow-x-auto">
        <table className="w-full text-body">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">名称</th>
              <th className="w-[86px] whitespace-nowrap px-3 py-2 text-left font-medium">
                <Tooltip content={<GradeRubric />}>
                  <span className="border-b border-dotted border-stroke-subtle pb-px">
                    {t('telemetry.grade.column')}
                  </span>
                </Tooltip>
              </th>
              <th className="px-3 py-2 text-left font-medium">Provider</th>
              <th className="px-3 py-2 text-left font-medium">Base URL</th>
              <th className="px-3 py-2 text-left font-medium">格式</th>
              <th className="px-3 py-2 text-left font-medium">Key</th>
              <th className="px-3 py-2 text-left font-medium">启用</th>
              <th className="w-[150px] min-w-[150px] whitespace-nowrap px-3 py-2 text-left font-medium">
                <Tooltip content={t('telemetry.columnHint')}>
                  <span className="border-b border-dotted border-stroke-subtle pb-px">
                    {t('telemetry.column', { window })}
                  </span>
                </Tooltip>
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-medium">测试</th>
              <th className="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                  加载中...
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                  暂无数据
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-left font-medium text-foreground underline-offset-2 hover:underline"
                      onClick={() => onInspect(item.id)}
                      title="打开模型级遥测与调用明细"
                    >
                      {item.name}
                    </button>
                    {(nameCounts.get(item.name) ?? 0) > 1 && (
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {endpointHost(item.baseUrl)}
                      </div>
                    )}
                    {governance &&
                      (() => {
                        const meta = governance.byConfig[String(item.id)]
                        if (!meta) return null
                        const badges: Array<{ text: string; tone: string }> = []
                        if (meta.duplicateName)
                          badges.push({
                            text: '重名配置',
                            tone: 'border-amber-500/30 text-amber-700 dark:text-amber-400',
                          })
                        if (meta.aliasConflictModels.length > 0)
                          badges.push({
                            text: `别名冲突 ${meta.aliasConflictModels.length}`,
                            tone: 'border-destructive/30 text-destructive',
                          })
                        if (meta.publicModelCount > 0 && !item.enabled)
                          badges.push({
                            text: '公开但停用',
                            tone: 'border-destructive/30 text-destructive',
                          })
                        if (
                          meta.publicModelCount > 0 &&
                          meta.accountPool &&
                          meta.accountPool.opsHealthy === 0
                        )
                          badges.push({
                            text: '无运营号',
                            tone: 'border-destructive/30 text-destructive',
                          })
                        if (badges.length === 0) return null
                        return (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {badges.map((badge) => (
                              <span
                                key={badge.text}
                                className={`rounded-md border px-1 py-0 text-[10px] ${badge.tone}`}
                              >
                                {badge.text}
                              </span>
                            ))}
                          </div>
                        )
                      })()}
                  </td>
                  <td className="px-3 py-2">
                    <GradeCell metric={telemetry?.[String(item.id)]} ready={telemetryReady} />
                  </td>
                  <td className="px-3 py-2 font-mono text-label">
                    <div className="flex items-center gap-1.5">
                      <span>{item.providerCode}</span>
                      {item.isRelayProvider && (
                        <Tooltip content={t('providerRelayHint')}>
                          <span className="cursor-help whitespace-nowrap rounded-md border border-violet-200 bg-violet-50 px-1 py-0.5 font-sans text-[10px] font-medium leading-4 text-violet-700 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-300">
                            {t('providerRelay')}
                          </span>
                        </Tooltip>
                      )}
                    </div>
                    {governance?.byConfig[String(item.id)] && (
                      <div className="mt-0.5 font-sans text-[10px] text-muted-foreground">
                        模型 {governance.byConfig[String(item.id)]!.modelCount} · 公开{' '}
                        {governance.byConfig[String(item.id)]!.publicModelCount}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-label text-muted-foreground max-w-[200px] truncate">
                    {item.baseUrl}
                  </td>
                  <td className="px-3 py-2 text-label">{item.apiFormat}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-label ${
                        item.hasApiKey
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {item.hasApiKey ? '已配置' : '未配置'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={item.enabled}
                      onCheckedChange={() => onToggle(item)}
                      disabled={togglePending}
                    />
                  </td>
                  <td className="w-[150px] min-w-[150px] whitespace-nowrap px-3 py-2">
                    <RuntimeCell
                      metric={telemetry?.[String(item.id)]}
                      realtimeMinutes={realtimeMinutes}
                      window={window}
                      ready={telemetryReady}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {item.lastTestStatus ? (
                      <span
                        className={`text-label ${
                          item.lastTestStatus === 'success'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {item.lastTestStatus === 'success'
                          ? `成功 ${item.lastTestResponseMs ?? 0}ms`
                          : '失败'}
                      </span>
                    ) : (
                      <span className="text-label text-muted-foreground">未测试</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Tooltip content="模型级遥测">
                        <span className="inline-flex">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onInspect(item.id)}
                            aria-label="模型级遥测"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip content="测试连通">
                        <span className="inline-flex">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onTest(item.id)}
                            disabled={testPending}
                          >
                            <Zap className="h-3.5 w-3.5" />
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip content="编辑">
                        <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Tooltip>
                      <Tooltip content="删除">
                        <Button variant="ghost" size="sm" onClick={() => onDelete(item)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
