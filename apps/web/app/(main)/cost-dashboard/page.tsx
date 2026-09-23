// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 成本看板(对标 Claude Code / Codex 的成本透明可观测)。
// 消费:
//   GET /api/cost-ledger/summary        → totals + by_tool/by_model + window
//   GET /api/cost-ledger/timeseries     → 按日/小时的 cost + token 走势(?granularity)
//   GET /api/v1/ai/usage/budget-events  → 预算事件时间线(governor 环形缓冲,最新在前)
// 渲染聚合卡片 + by_tool/by_model 清单 + 纯 CSS 条形走势 + 预算事件时间线 + 空态提示。
// 预算事件端点失败时静默隐藏区块(不阻断主看板)。后端:ai-service routers/usage.py。
// 未登录(401)提示"请先登录"。后端:ai-service routers/cost_ledger.py。

'use client'

import * as React from 'react'
import {
  Activity,
  AlertTriangle,
  CircleX,
  Coins,
  Cpu,
  Loader2,
  Timer,
  TrendingUp,
  Wrench,
  XCircle,
} from 'lucide-react'

import { useTranslations } from 'next-intl'
import { fetchApi } from '@/lib/api'
import { Tooltip } from '@/components/feedback'
import type { BudgetEvent, CostSummary, CostTimeseries } from '@/api/cost-ledger-api'
import { fetchBudgetEvents } from '@/api/cost-ledger-api'

type Granularity = 'day' | 'hour'

export default function CostDashboardPage() {
  const t = useTranslations('costDashboard')
  const [summary, setSummary] = React.useState<CostSummary | null>(null)
  const [series, setSeries] = React.useState<CostTimeseries>([])
  const [granularity, setGranularity] = React.useState<Granularity>('day')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [needLogin, setNeedLogin] = React.useState(false)
  // 预算事件(独立于成本账本加载,null = 端点不可用 → 静默隐藏区块,不阻断主看板)
  const [budgetEvents, setBudgetEvents] = React.useState<BudgetEvent[] | null>(null)

  const load = React.useCallback(
    async (gran: Granularity) => {
      setLoading(true)
      setError('')
      setNeedLogin(false)
      const sRes = await fetchApi<CostSummary>('/api/cost-ledger/summary')
      const tRes = await fetchApi<CostTimeseries>(`/api/cost-ledger/timeseries?granularity=${gran}`)
      setLoading(false)

      const handleFailure = (res: { success: false; error: string; status?: number }) => {
        if (res.status === 401) {
          setNeedLogin(true)
        } else {
          setError((res as { message?: string }).message || t('loadFailed'))
        }
        setSummary(null)
        setSeries([])
      }

      if (!sRes.success) return handleFailure(sRes)
      if (!tRes.success) return handleFailure(tRes)
      setSummary(sRes.data)
      setSeries(tRes.data || [])
    },
    [t],
  )

  React.useEffect(() => {
    void load(granularity)
  }, [load, granularity])

  // 预算事件:独立加载,失败静默降级(null → 隐藏区块),空数组 → 空态提示
  React.useEffect(() => {
    let cancelled = false
    fetchBudgetEvents(50)
      .then((data) => {
        if (!cancelled) setBudgetEvents(data?.events ?? [])
      })
      .catch(() => {
        if (!cancelled) setBudgetEvents(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const fmtUsd = (cost: number) => (cost > 0 ? `$${cost.toFixed(4)}` : '$0')
  const fmtDur = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`)

  // 预算事件类型徽章(design token 颜色;类型语义见 budgetBadge 的映射)
  const budgetBadge = (type: string): { label: string; cls: string } => {
    switch (type) {
      case 'budget.critical':
        return { label: t('budgetCritical'), cls: 'bg-destructive/10 text-destructive' }
      case 'budget.degrade':
        return { label: t('budgetDegrade'), cls: 'bg-primary/10 text-primary' }
      case 'budget.degrade_reset':
        return { label: t('budgetDegradeReset'), cls: 'bg-emerald-500/10 text-emerald-600' }
      default:
        return { label: t('budgetWarning'), cls: 'bg-amber-500/10 text-amber-600' }
    }
  }

  // 条形走势:把桶展开为等宽横柱(cost 与 token 各一个对照柱)
  const maxCost = Math.max(0, ...series.map((b) => b.cost))
  const maxTokens = Math.max(0, ...series.map((b) => b.tokens))
  const pct = (v: number, max: number) => (max > 0 ? Math.max(2, (v / max) * 100) : 0)

  const byToolEntries = summary
    ? Object.entries(summary.by_tool || {}).sort((a, b) => b[1].cost - a[1].cost)
    : []
  const byModelEntries = summary
    ? Object.entries(summary.by_model || {}).sort((a, b) => b[1].cost - a[1].cost)
    : []

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="ml-auto flex items-center gap-2">
          {(['day', 'hour'] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`rounded-lg border px-3 py-1 text-sm transition ${
                granularity === g
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'hover:bg-muted'
              }`}
            >
              {g === 'day' ? t('day') : t('hour')}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t('subtitle')}</p>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}
        </div>
      )}
      {needLogin && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <CircleX className="h-4 w-4" /> {t('needLogin')}
        </p>
      )}
      {error && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <XCircle className="h-4 w-4" /> {error}
        </p>
      )}

      {!loading && summary && summary.steps === 0 && !error && !needLogin && (
        <div className="flex items-center justify-center gap-2 rounded-xl border py-16 text-sm text-muted-foreground">
          <Activity className="h-5 w-5" /> {t('empty')}
        </div>
      )}

      {!loading && summary && summary.steps > 0 && (
        <>
          {/* 聚合卡片 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Coins className="h-3.5 w-3.5" /> {t('totalCost')}
              </div>
              <div className="text-xl font-bold">{fmtUsd(summary.total_cost)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t('estimatedCount', { count: summary.estimated_count })}
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Cpu className="h-3.5 w-3.5" /> {t('totalToken')}
              </div>
              <div className="text-xl font-bold">{summary.total_tokens.toLocaleString()}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                in {summary.total_tokens_in.toLocaleString()} / out{' '}
                {summary.total_tokens_out.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Timer className="h-3.5 w-3.5" /> {t('totalDuration')}
              </div>
              <div className="text-xl font-bold">{fmtDur(summary.total_duration_ms)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {summary.window?.start ?? '—'} ~ {summary.window?.end ?? '—'}
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Activity className="h-3.5 w-3.5" /> {t('steps')}
              </div>
              <div className="text-xl font-bold">{summary.steps}</div>
              <div className="mt-1 text-xs">
                <span className="text-emerald-600">ok {summary.ok_count}</span>
                <span className="text-destructive"> · err {summary.error_count}</span>
              </div>
            </div>
          </div>

          {/* 时间走势 */}
          <div className="mt-4 rounded-xl border p-3">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4" />{' '}
              {t('costTokenTrend', { granularity: granularity === 'day' ? t('day') : t('hour') })}
            </h2>
            {series.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Activity className="h-5 w-5" /> {t('noSeries')}
              </div>
            ) : (
              <div className="space-y-1.5">
                {series.map((b) => (
                  <div
                    key={b.bucket}
                    className="grid grid-cols-[7rem_1fr_1fr_5rem] items-center gap-2 text-xs"
                  >
                    <Tooltip content={b.bucket}>
                      <span className="truncate text-muted-foreground">{b.bucket}</span>
                    </Tooltip>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-3 rounded bg-primary/70"
                        style={{ width: `${pct(b.cost, maxCost)}%` }}
                      />
                      <span className="shrink-0 text-muted-foreground">{fmtUsd(b.cost)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-3 rounded bg-emerald-500/70"
                        style={{ width: `${pct(b.tokens, maxTokens)}%` }}
                      />
                      <span className="shrink-0 text-muted-foreground">
                        {b.tokens.toLocaleString()} tok
                      </span>
                    </div>
                    <span className="text-right text-muted-foreground">
                      {t('stepsSuffix', { count: b.steps })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* by_tool / by_model */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border p-3">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Wrench className="h-4 w-4" /> {t('byTool')}
              </h2>
              {byToolEntries.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">-</div>
              ) : (
                <ul className="space-y-2">
                  {byToolEntries.map(([name, v]) => (
                    <li key={name} className="flex items-center gap-3 text-sm">
                      <Tooltip content={name}>
                        <span className="w-40 truncate">{name}</span>
                      </Tooltip>
                      <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                        {fmtUsd(v.cost)}
                      </span>
                      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                        {v.tokens.toLocaleString()} tok
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border p-3">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Cpu className="h-4 w-4" /> {t('byModel')}
              </h2>
              {byModelEntries.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">-</div>
              ) : (
                <ul className="space-y-2">
                  {byModelEntries.map(([name, v]) => (
                    <li key={name} className="flex items-center gap-3 text-sm">
                      <Tooltip content={name}>
                        <span className="w-40 truncate">{name}</span>
                      </Tooltip>
                      <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                        {fmtUsd(v.cost)}
                      </span>
                      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                        {v.tokens.toLocaleString()} tok
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {/* 预算事件时间线(独立于成本账本;端点不可用时 null → 静默隐藏) */}
      {budgetEvents !== null && (
        <div className="mt-4 rounded-xl border p-3">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4" /> {t('budgetEvents')}
            <Tooltip content={t('budgetEventsHint')}>
              <span className="cursor-help rounded-sm border px-1.5 text-[10px] font-normal leading-4 text-muted-foreground">
                ?
              </span>
            </Tooltip>
          </h2>
          {budgetEvents.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Activity className="h-5 w-5" /> {t('budgetEventsEmpty')}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {budgetEvents.map((e, i) => {
                const badge = budgetBadge(e.event_type)
                const pct =
                  typeof e.usage_percent === 'number'
                    ? `${(e.usage_percent * 100).toFixed(1)}%`
                    : ''
                const ts = e.timestamp ? new Date(e.timestamp).toLocaleString() : ''
                return (
                  <li
                    key={`${e.timestamp}-${i}`}
                    className="flex flex-wrap items-center gap-2 border-l-2 border-muted pl-3 text-sm"
                  >
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    {e.hard_stop && (
                      <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                        {t('budgetHardStop')}
                      </span>
                    )}
                    {e.pillar && (
                      <Tooltip content={e.pillar}>
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs">
                          {e.pillar}
                        </span>
                      </Tooltip>
                    )}
                    {pct && (
                      <Tooltip content={t('budgetUsagePercent', { percent: pct })}>
                        <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                          {pct}
                        </span>
                      </Tooltip>
                    )}
                    {typeof e.daily_cost === 'number' && e.daily_cost > 0 && (
                      <Tooltip content={t('budgetDailyCost', { cost: fmtUsd(e.daily_cost) })}>
                        <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                          {fmtUsd(e.daily_cost)}
                        </span>
                      </Tooltip>
                    )}
                    {e.degrade_to && (
                      <Tooltip content={t('budgetDegradedTo', { model: e.degrade_to })}>
                        <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                          → {e.degrade_to}
                        </span>
                      </Tooltip>
                    )}
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{ts}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
