// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Activity, Download, Gauge, Loader2, TrendingUp, Zap } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@ihui/ui-react'
import { Alert, Tooltip } from '@/components/feedback'
import { BackButton } from '@/components/common'

// ===================== 既有基础用量展示(保留) =====================

interface UsageRow {
  groupKey: string
  callCount: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  successCount: number
  errorCount: number
  totalCostCents: number
  byokCallCount: number
  relayCallCount: number
  upstreamCostCents: number
  platformFeeCents: number
}

interface UsageData {
  groupBy: 'model' | 'day'
  mode: 'all' | 'relay' | 'byok'
  rows: UsageRow[]
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

type ModeFilter = 'all' | 'relay' | 'byok'

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/**
 * 表头由调用方(组件内)取好词再传入:模块层无法取词。
 * 列顺序与下方 rows 的值顺序一一对应,改动需同步。
 */
function exportCsv(rows: UsageRow[], groupBy: 'model' | 'day', head: readonly string[]) {
  const lines = rows.map((r) =>
    [
      r.groupKey,
      r.callCount,
      r.totalTokens,
      r.promptTokens,
      r.completionTokens,
      r.successCount,
      r.errorCount,
      (r.totalCostCents / 100).toFixed(2),
      r.byokCallCount,
      r.relayCallCount,
      r.byokCallCount > 0 ? (r.upstreamCostCents / 100).toFixed(4) : '',
      r.byokCallCount > 0 ? (r.platformFeeCents / 100).toFixed(4) : '',
    ].join(','),
  )
  const csv = '﻿' + [head.join(','), ...lines].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `relay-usage-${groupBy}-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** 调用模式徽章:仅 BYOK=绿 / 仅中转站=灰 / 混合=蓝 */
function ModeBadge({ byok, relay }: { byok: number; relay: number }) {
  // 变量名不得与同文件其他 useTranslations 绑定重名:check-i18n-keys 与本仓契约测试都按
  // "文件内 var → ns" 归集,重名会让后声明的绑定覆盖先声明的,把在用的键误判成缺失/孤儿。
  const tMode = useTranslations('developer.relayUsage')
  if (byok > 0 && relay > 0) {
    return (
      <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
        {tMode('modeMixed')}
      </span>
    )
  }
  if (byok > 0) {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        BYOK
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
      {tMode('modeRelay')}
    </span>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 min-[640px]:p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

// ===================== 用量重度分析(新增) =====================

interface AnalyticsData {
  cost: { totalCents: number; standardCents: number | null; actualCents: number }
  tokens: {
    input: number
    output: number
    cacheRead: number
    cacheCreation: number
    total: number
    cacheHitRate: number
  }
  latency: { avgMs: number; p50Ms: number; p95Ms: number; count: number }
  endpoints: { endpoint: string; calls: number; costCents: number }[]
  daily: { date: string; calls: number; costCents: number; tokens: number }[]
  models: { model: string; calls: number; costCents: number; tokens: number }[]
}

interface ApiKeyOption {
  id: string
  name: string
}

// ===================== 主组件 =====================

export default function RelayUsagePage() {
  const locale = useLocale()
  const t = useTranslations('developer')
  const tu = useTranslations('developer.relayUsage')
  const num = new Intl.NumberFormat(locale)
  // 金额走 Intl,币种符号由 locale 决定(不把符号焊进文案)
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const money4 = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })

  // 基础用量筛选
  const [groupBy, setGroupBy] = React.useState<'model' | 'day'>('model')
  const [mode, setMode] = React.useState<ModeFilter>('all')
  const [startDate, setStartDate] = React.useState('')

  // 分析筛选(与基础用量共享 startDate)
  const [endDate, setEndDate] = React.useState('')
  const [model, setModel] = React.useState('')
  const [apiKeyId, setApiKeyId] = React.useState('')
  const [exporting, setExporting] = React.useState(false)

  // --- 基础用量 ---
  const baseQs = new URLSearchParams({ groupBy, mode })
  if (startDate) baseQs.set('startDate', startDate)
  const { data, isLoading, error } = useQuery({
    queryKey: ['developer', 'relay', 'usage', groupBy, mode, startDate],
    queryFn: () => api<UsageData>(`/api/developer/relay/usage?${baseQs.toString()}`),
  })
  const rows = data?.rows ?? []
  const summary = data?.summary

  // --- API Key 下拉(用于分析筛选)---
  const { data: keysData } = useQuery({
    queryKey: ['developer', 'relay', 'keys'],
    queryFn: () => api<{ list: ApiKeyOption[] }>('/api/developer/relay/keys'),
  })
  const keyOptions = keysData?.list ?? []

  // --- 用量分析 ---
  const anaQs = new URLSearchParams()
  if (startDate) anaQs.set('startDate', startDate)
  if (endDate) anaQs.set('endDate', endDate)
  if (model) anaQs.set('model', model)
  if (apiKeyId) anaQs.set('apiKeyId', apiKeyId)
  const { data: analytics, isLoading: anaLoading } = useQuery({
    queryKey: ['developer', 'relay', 'usage', 'analytics', startDate, endDate, model, apiKeyId],
    queryFn: () => api<AnalyticsData>(`/api/developer/relay/usage/analytics?${anaQs.toString()}`),
  })

  const maxEndpointCalls = analytics ? Math.max(1, ...analytics.endpoints.map((e) => e.calls)) : 1
  const maxDailyCalls = analytics ? Math.max(1, ...analytics.daily.map((d) => d.calls)) : 1
  const trendDays = analytics ? analytics.daily.slice(-30) : []

  async function exportAnalyticsCsv() {
    setExporting(true)
    try {
      const qs = new URLSearchParams()
      if (startDate) qs.set('startDate', startDate)
      if (endDate) qs.set('endDate', endDate)
      if (model) qs.set('model', model)
      if (apiKeyId) qs.set('apiKeyId', apiKeyId)
      qs.set('format', 'csv')
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || ''
      const res = await fetch(`${base}/api/developer/relay/usage/export?${qs.toString()}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        let msg = tu('exportFailed')
        try {
          const j = await res.json()
          if (j?.message) msg = j.message
        } catch {
          /* ignore */
        }
        toast.error(msg)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relay-usage-detail-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(t('analytics.exportCsv'))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <BackButton />

      {/* 标题 + 既有导出 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Activity className="h-6 w-6 text-primary" aria-hidden />
            {tu('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{tu('subtitle')}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            exportCsv(rows, groupBy, [
              groupBy === 'day' ? tu('colDate') : tu('colModel'),
              tu('csvCalls'),
              tu('csvTotalTokens'),
              tu('csvPromptTokens'),
              tu('csvCompletionTokens'),
              tu('colSuccess'),
              tu('colFailure'),
              tu('colCostYuan'),
              tu('csvByokCalls'),
              tu('csvRelayCalls'),
              tu('colUpstreamCostYuan'),
              tu('colPlatformFeeYuan'),
            ])
            toast.success(tu('exportedCsv'))
          }}
          disabled={rows.length === 0}
        >
          <Download className="h-4 w-4" aria-hidden />
          {t('analytics.exportCsv')}
        </Button>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {/* 基础用量筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={mode} onValueChange={(v) => setMode(v as ModeFilter)}>
          <SelectTrigger className="w-32" aria-label={tu('callMode')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tu('modeAll')}</SelectItem>
            <SelectItem value="relay">{tu('modeRelay')}</SelectItem>
            <SelectItem value="byok">BYOK</SelectItem>
          </SelectContent>
        </Select>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as 'model' | 'day')}>
          <SelectTrigger className="w-32" aria-label={tu('grouping')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="model">{tu('groupByModel')}</SelectItem>
            <SelectItem value="day">{tu('groupByDay')}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-40"
          aria-label={tu('startDate')}
        />
        {startDate && (
          <Button size="sm" variant="ghost" onClick={() => setStartDate('')}>
            {tu('clear')}
          </Button>
        )}
      </div>

      {/* 基础用量汇总卡片 */}
      <div className="grid grid-cols-2 gap-3 min-[768px]:grid-cols-3 min-[1024px]:grid-cols-6">
        <SummaryCard
          label={tu('totalCalls')}
          value={summary ? num.format(summary.totalCalls) : '—'}
        />
        <SummaryCard
          label={tu('totalTokens')}
          value={summary ? num.format(summary.totalTokens) : '—'}
        />
        <SummaryCard
          label={tu('totalCost')}
          value={summary ? money.format(summary.totalCostCents / 100) : '—'}
        />
        <SummaryCard
          label={tu('byokCalls')}
          value={summary ? num.format(summary.byokCallCount) : '—'}
        />
        <SummaryCard
          label={tu('byokUpstreamCost')}
          value={summary ? money4.format(summary.upstreamCostCents / 100) : '—'}
        />
        <SummaryCard
          label={tu('byokPlatformFee')}
          value={summary ? money4.format(summary.platformFeeCents / 100) : '—'}
        />
      </div>

      {/* 基础用量明细表 */}
      <div className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">
                  {groupBy === 'day' ? tu('colDate') : tu('colModel')}
                </th>
                <th className="px-3 py-2 text-right">{tu('calls')}</th>
                <th className="px-3 py-2 text-right">{tu('totalTokens')}</th>
                <th className="px-3 py-2 text-right">Prompt</th>
                <th className="px-3 py-2 text-right">Completion</th>
                <th className="px-3 py-2 text-right">{tu('colSuccess')}</th>
                <th className="px-3 py-2 text-right">{tu('colFailure')}</th>
                <th className="px-3 py-2 text-left">{tu('callMode')}</th>
                <th className="px-3 py-2 text-right">{tu('colCostYuan')}</th>
                <th className="px-3 py-2 text-right">{tu('colUpstreamCostYuan')}</th>
                <th className="px-3 py-2 text-right">{tu('colPlatformFeeYuan')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
                    {t('loading')}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.groupKey} className="">
                    <td className="px-3 py-2 font-medium">{r.groupKey}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num.format(r.callCount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {num.format(r.totalTokens)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {num.format(r.promptTokens)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {num.format(r.completionTokens)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {r.successCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                      {r.errorCount}
                    </td>
                    <td className="px-3 py-2">
                      <ModeBadge byok={r.byokCallCount} relay={r.relayCallCount} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {(r.totalCostCents / 100).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.byokCallCount > 0 ? (r.upstreamCostCents / 100).toFixed(4) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.byokCallCount > 0 ? (r.platformFeeCents / 100).toFixed(4) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============ 用量重度分析 ============ */}
      <section className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <TrendingUp className="h-5 w-5 text-primary" aria-hidden />
              {t('analytics.title')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('analytics.subtitle')}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={exportAnalyticsCsv}
            disabled={exporting || anaLoading}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            {exporting ? t('analytics.exporting') : t('analytics.exportCsv')}
          </Button>
        </div>

        {/* 分析筛选 */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
            aria-label={tu('endDate')}
          />
          <Input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={tu('modelOptional')}
            className="w-44"
            aria-label={tu('modelFilter')}
          />
          <Select value={apiKeyId} onValueChange={setApiKeyId}>
            <SelectTrigger className="w-48" aria-label={tu('apiKeyFilter')}>
              <SelectValue placeholder={tu('allApiKeys')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{tu('allApiKeys')}</SelectItem>
              {keyOptions.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {anaLoading ? (
          <div className="rounded-lg border border-border bg-card p-3 min-[640px]:p-3 text-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
            {t('loading')}
          </div>
        ) : !analytics || analytics.latency.count === 0 ? (
          <div className="rounded-lg border border-border bg-card p-3 min-[640px]:p-3 text-center text-sm text-muted-foreground">
            {t('analytics.noData')}
          </div>
        ) : (
          <>
            {/* 成本卡 */}
            <div className="rounded-lg border border-border bg-card p-3 min-[640px]:p-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <TrendingUp className="h-4 w-4" aria-hidden />
                {t('analytics.costCard')}
              </h3>
              <p className="mt-2 text-3xl font-bold tabular-nums">
                {money.format(analytics.cost.actualCents / 100)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t('analytics.actualPrice')}</p>
              {analytics.cost.standardCents !== null && (
                <div className="mt-2 border-t border-border pt-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('analytics.standardPrice')}</span>
                    <span className="tabular-nums">
                      {money.format(analytics.cost.standardCents / 100)}
                    </span>
                  </div>
                  {analytics.cost.standardCents - analytics.cost.actualCents > 0.005 && (
                    <div className="mt-1 flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                      <span>{t('analytics.saved')}</span>
                      <span className="tabular-nums">
                        {money.format(
                          (analytics.cost.standardCents - analytics.cost.actualCents) / 100,
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 缓存命中率 + 延迟卡(并排) */}
            <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
              {/* 缓存命中率(条形) */}
              <div className="rounded-lg border border-border bg-card p-3 min-[640px]:p-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Zap className="h-4 w-4" aria-hidden />
                  {t('analytics.cacheCard')}
                </h3>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t('analytics.hitRate')}</span>
                    <span className="tabular-nums">
                      {(analytics.tokens.cacheHitRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1 h-3 w-full overflow-hidden rounded-sm bg-muted">
                    <div
                      className="h-3 bg-primary"
                      style={{ width: `${Math.min(100, analytics.tokens.cacheHitRate * 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
                    <span>
                      {tu('cacheRead', { count: num.format(analytics.tokens.cacheRead) })}
                    </span>
                    <span>
                      {tu('cacheWrite', { count: num.format(analytics.tokens.cacheCreation) })}
                    </span>
                  </div>
                </div>
              </div>

              {/* 延迟卡 */}
              <div className="rounded-lg border border-border bg-card p-3 min-[640px]:p-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Gauge className="h-4 w-4" aria-hidden />
                  {t('analytics.latencyCard')}
                </h3>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('analytics.avg')}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {num.format(analytics.latency.avgMs)}
                      <span className="ml-0.5 text-xs font-normal text-muted-foreground">ms</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('analytics.p50')}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {num.format(analytics.latency.p50Ms)}
                      <span className="ml-0.5 text-xs font-normal text-muted-foreground">ms</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('analytics.p95')}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {num.format(analytics.latency.p95Ms)}
                      <span className="ml-0.5 text-xs font-normal text-muted-foreground">ms</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 端点分布(条形列表,call_type 维度替代) */}
            <div className="rounded-lg border border-border bg-card p-3 min-[640px]:p-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {t('analytics.endpointsCard')}
              </h3>
              <div className="mt-3 space-y-2">
                {analytics.endpoints.map((e) => (
                  <div key={e.endpoint}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{e.endpoint}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {num.format(e.calls)} · {money.format(e.costCents / 100)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-sm bg-muted">
                      <div
                        className="h-2 bg-primary"
                        style={{ width: `${(e.calls / maxEndpointCalls) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 日趋势(mini 柱状图,div 高度映射) */}
            <div className="rounded-lg border border-border bg-card p-3 min-[640px]:p-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {t('analytics.dailyTrend')}
              </h3>
              <div className="mt-3 flex h-16 items-end gap-0.5 overflow-x-auto">
                {trendDays.map((d) => (
                  <Tooltip key={d.date} content={`${d.date} · ${num.format(d.calls)}`}>
                    <div className="flex min-w-[6px] flex-1 flex-col items-center justify-end">
                      <div
                        className="w-full bg-primary/70"
                        style={{
                          height: `${Math.max(2, (d.calls / maxDailyCalls) * 56)}px`,
                        }}
                      />
                    </div>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* 模型分解 */}
            <div className="rounded-lg border border-border bg-card p-3 min-[640px]:p-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {t('analytics.modelsCard')}
              </h3>
              <div className="mt-3 space-y-1">
                {analytics.models.slice(0, 12).map((m) => (
                  <div
                    key={m.model}
                    className="flex items-center justify-between text-xs tabular-nums"
                  >
                    <span className="truncate font-medium">{m.model}</span>
                    <span className="text-muted-foreground">
                      {num.format(m.calls)} · {money.format(m.costCents / 100)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
