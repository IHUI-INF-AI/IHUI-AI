'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Gauge,
  Loader2,
  RefreshCw,
  Shield,
  XCircle,
  Zap,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { formatNumber } from '@/lib/date-utils'

// ────────────────────────────────────────────────────────────────────────────
// 类型定义(API 返回结构,字段防御性可选)
// ────────────────────────────────────────────────────────────────────────────

type Severity = 'info' | 'warning' | 'critical'
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
type TraceStatus = 'ok' | 'error' | string

interface HubEvent {
  id?: string
  ts?: string | number
  event_type?: string
  type?: string
  pillar?: string
  source?: string
  severity?: Severity
  payload?: unknown
}

interface DecisionAction {
  name?: string
  status?: 'success' | 'failed' | string
  duration_ms?: number
}

interface Decision {
  id?: string
  ts?: string | number
  trigger_event?: string
  trigger?: string
  playbook?: string
  actions?: DecisionAction[]
  duration_ms?: number
  status?: string
}

interface Playbook {
  id: string
  name?: string
  trigger?: string
  enabled?: boolean
  description?: string
}

interface BudgetSummary {
  tokens_used?: number
  token_used?: number
  token_limit?: number
  tokens_limit?: number
  cost?: number
  cost_limit?: number
  usage_pct?: number
  pillars?: Record<string, { used?: number; limit?: number; tokens_used?: number; token_limit?: number; cost?: number }>
}

interface BudgetTrendPoint {
  date?: string
  tokens?: number
  token?: number
  cost?: number
}

interface CostBreakdown {
  by_pillar?: Record<string, number>
  by_model?: Record<string, number>
  by_action?: Record<string, number>
}

interface PillarHealth {
  pillar?: string
  status?: HealthStatus
  metrics?: Record<string, number | string>
}

interface Trace {
  trace_id?: string
  pillar?: string
  duration_ms?: number
  status?: TraceStatus
  ts?: string | number
}

// ────────────────────────────────────────────────────────────────────────────
// 颜色 / 样式映射
// ────────────────────────────────────────────────────────────────────────────

const PILLAR_STYLE: Record<string, string> = {
  rules: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  hook: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  spec: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
  context: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  subagent: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  terminal: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
  budget: 'text-red-400 bg-red-500/10 border-red-500/30',
}

const PILLAR_ORDER = ['rules', 'hook', 'spec', 'context', 'subagent', 'terminal', 'budget']

function pillarStyle(pillar?: string): string {
  if (!pillar) return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30'
  const key = pillar.toLowerCase()
  return PILLAR_STYLE[key] ?? 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30'
}

// 事件类型颜色由前缀(第一个 . 之前)决定
function eventTypeStyle(eventType?: string): string {
  if (!eventType) return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30'
  const prefix = (eventType.split('.')[0] ?? '').toLowerCase()
  return PILLAR_STYLE[prefix] ?? 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30'
}

const SEVERITY_STYLE: Record<Severity, { dot: string; text: string; icon: React.ReactNode }> = {
  info: { dot: 'bg-zinc-400', text: 'text-zinc-400', icon: null },
  warning: { dot: 'bg-amber-400', text: 'text-amber-400', icon: <AlertTriangle className="h-3 w-3" /> },
  critical: { dot: 'bg-red-500', text: 'text-red-400', icon: <AlertCircle className="h-3 w-3" /> },
}

const HEALTH_STYLE: Record<HealthStatus, { dot: string; text: string }> = {
  healthy: { dot: 'bg-emerald-500', text: 'text-emerald-400' },
  degraded: { dot: 'bg-amber-400', text: 'text-amber-400' },
  unhealthy: { dot: 'bg-red-500', text: 'text-red-400' },
  unknown: { dot: 'bg-zinc-500', text: 'text-zinc-400' },
}

// ────────────────────────────────────────────────────────────────────────────
// 工具函数
// ────────────────────────────────────────────────────────────────────────────

function relativeTime(ts?: string | number): string {
  if (!ts) return '-'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '-'
  const diff = Date.now() - d.getTime()
  if (diff < 0) return '刚刚'
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}秒前`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`
  return `${Math.floor(diff / 86_400_000)}天前`
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return 0
}

function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[]
  return []
}

// ────────────────────────────────────────────────────────────────────────────
// 通用 fetch hook(支持轮询)
// ────────────────────────────────────────────────────────────────────────────

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refresh: () => void
}

function useOrchFetch<T>(url: string | null, intervalMs?: number): FetchState<T> {
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState<boolean>(url !== null)
  const [error, setError] = React.useState<string | null>(null)
  const [tick, setTick] = React.useState(0)

  const refresh = React.useCallback(() => setTick((t) => t + 1), [])

  React.useEffect(() => {
    if (!url) {
      setLoading(false)
      return
    }
    let cancelled = false
    const run = async () => {
      const r = await fetchApi<T>(url)
      if (cancelled) return
      if (r.success) {
        setData(r.data)
        setError(null)
      } else {
        setError(r.error)
      }
      setLoading(false)
    }
    void run()
    if (intervalMs && intervalMs > 0) {
      const id = setInterval(run, intervalMs)
      return () => {
        cancelled = true
        clearInterval(id)
      }
    }
    return () => {
      cancelled = true
    }
  }, [url, intervalMs, tick])

  return { data, loading, error, refresh }
}

// ────────────────────────────────────────────────────────────────────────────
// 通用 UI 子组件
// ────────────────────────────────────────────────────────────────────────────

function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label && <span>{label}</span>}
    </div>
  )
}

function Unavailable({ message }: { message: string }) {
  return (
    <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <AlertCircle className="h-5 w-5 text-amber-400" />
      <span>{message}</span>
    </div>
  )
}

function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
      <div
        className={cn('h-full rounded transition-all', className ?? 'bg-primary')}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Tab 1: 事件流
// ────────────────────────────────────────────────────────────────────────────

function EventFeedTab() {
  const t = useTranslations('orchestration')
  const [pillarFilter, setPillarFilter] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})

  const url = React.useMemo(() => {
    const base = '/orchestration/events?limit=100'
    if (pillarFilter) return `${base}&pillar=${encodeURIComponent(pillarFilter)}`
    return base
  }, [pillarFilter])

  const { data, loading, error, refresh } = useOrchFetch<HubEvent[] | { events?: HubEvent[] } | null>(
    url,
    5000,
  )

  const events = React.useMemo<HubEvent[]>(() => {
    if (!data) return []
    if (Array.isArray(data)) return data
    return asArray<HubEvent>(data.events)
  }, [data])

  // 顶部统计:24h 事件总数 + 按类型分布
  const stats = React.useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    const recent = events.filter((e) => {
      const d = new Date(e.ts ?? 0)
      return d.getTime() >= cutoff
    })
    const byType: Record<string, number> = {}
    for (const e of recent) {
      const key = (e.event_type ?? e.type ?? 'unknown').split('.')[0] ?? 'unknown'
      byType[key] = (byType[key] ?? 0) + 1
    }
    return { total: recent.length, byType }
  }, [events])

  if (loading && events.length === 0) return <Spinner label={t('loading')} />
  if (error && events.length === 0) return <Unavailable message={t('unavailable')} />

  return (
    <div className="flex flex-col gap-3">
      {/* 顶部统计条 */}
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs">
          <Zap className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-muted-foreground">{t('events.events24h')}</span>
          <span className="font-semibold tabular-nums">{formatNumber(stats.total)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(stats.byType).map(([k, v]) => (
            <span
              key={k}
              className={cn(
                'rounded border px-1.5 py-0.5 text-[10px] tabular-nums',
                pillarStyle(k),
              )}
            >
              {k} · {v}
            </span>
          ))}
        </div>
        <div className="ml-auto">
          <button
            type="button"
            onClick={refresh}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs transition-colors hover:bg-accent"
          >
            <RefreshCw className="h-3 w-3" />
            <span>{t('events.refresh')}</span>
          </button>
        </div>
      </div>

      {/* 支柱过滤 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setPillarFilter(null)}
          className={cn(
            'rounded-md border px-2 py-1 text-xs transition-colors',
            pillarFilter === null
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
          )}
        >
          {t('events.filterAll')}
        </button>
        {PILLAR_ORDER.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPillarFilter(p)}
            className={cn(
              'rounded-md border px-2 py-1 text-xs transition-colors',
              pillarFilter === p
                ? 'border-primary bg-primary text-primary-foreground'
                : cn('hover:opacity-80', pillarStyle(p)),
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {/* 事件列表 */}
      {events.length === 0 ? (
        <Unavailable message={t('events.noEvents')} />
      ) : (
        <div className="flex flex-col gap-1.5">
          {events.map((e, i) => {
            const id = e.id ?? `${e.ts ?? i}-${i}`
            const sev: Severity = e.severity ?? 'info'
            const sevStyle = SEVERITY_STYLE[sev]
            const isOpen = expanded[id] ?? false
            const eventType = e.event_type ?? e.type ?? '-'
            return (
              <div
                key={id}
                className="rounded-md border border-border bg-card/40 px-2.5 py-2 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2">
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', sevStyle.dot)} />
                  <span
                    className={cn(
                      'rounded border px-1.5 py-0.5 text-[10px] font-medium',
                      eventTypeStyle(eventType),
                    )}
                  >
                    {eventType}
                  </span>
                  <span
                    className={cn(
                      'rounded border px-1.5 py-0.5 text-[10px]',
                      pillarStyle(e.pillar),
                    )}
                  >
                    {e.pillar ?? '-'}
                  </span>
                  {e.source && (
                    <span className="truncate text-[10px] text-muted-foreground">{e.source}</span>
                  )}
                  <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {relativeTime(e.ts)}
                  </span>
                  {e.payload != null && (
                    <button
                      type="button"
                      onClick={() => setExpanded((p) => ({ ...p, [id]: !p[id] }))}
                      className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent"
                      aria-label={t('events.payload')}
                    >
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
                {isOpen && e.payload != null && (
                  <pre className="mt-1.5 overflow-x-auto rounded bg-muted/50 p-2 text-[10px] leading-relaxed text-muted-foreground">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Tab 2: 联合决策
// ────────────────────────────────────────────────────────────────────────────

function DecisionsTab() {
  const t = useTranslations('orchestration')
  const decisionsState = useOrchFetch<Decision[] | { decisions?: Decision[] } | null>(
    '/orchestration/decisions?limit=50',
  )
  const playbooksState = useOrchFetch<Playbook[] | { playbooks?: Playbook[] } | null>(
    '/orchestration/playbooks',
  )
  const [toggling, setToggling] = React.useState<Record<string, boolean>>({})

  const decisions = React.useMemo<Decision[]>(() => {
    const d = decisionsState.data
    if (!d) return []
    if (Array.isArray(d)) return d
    return asArray<Decision>(d.decisions)
  }, [decisionsState.data])

  const playbooks = React.useMemo<Playbook[]>(() => {
    const d = playbooksState.data
    if (!d) return []
    if (Array.isArray(d)) return d
    return asArray<Playbook>(d.playbooks)
  }, [playbooksState.data])

  const handleToggle = React.useCallback(
    async (id: string) => {
      setToggling((p) => ({ ...p, [id]: true }))
      const r = await fetchApi<{ enabled?: boolean } | null>(
        `/orchestration/playbooks/${encodeURIComponent(id)}/toggle`,
        { method: 'POST' },
      )
      setToggling((p) => ({ ...p, [id]: false }))
      if (r.success) {
        playbooksState.refresh()
      }
    },
    [playbooksState],
  )

  const loading = decisionsState.loading && decisions.length === 0
  if (loading) return <Spinner label={t('loading')} />
  const unavailable = decisionsState.error && decisions.length === 0 && playbooks.length === 0
  if (unavailable) return <Unavailable message={t('unavailable')} />

  return (
    <div className="flex flex-col gap-3">
      {/* 决策历史 */}
      <div className="flex flex-col gap-1.5">
        <div className="text-xs font-medium text-muted-foreground">
          {t('tabs.decisions')} · {decisions.length}
        </div>
        {decisions.length === 0 ? (
          <Unavailable message={t('decisions.noDecisions')} />
        ) : (
          decisions.map((d, i) => {
            const id = d.id ?? `${d.ts ?? i}-${i}`
            const actions = asArray<DecisionAction>(d.actions)
            const totalDur = d.duration_ms ?? actions.reduce((s, a) => s + num(a.duration_ms), 0)
            return (
              <div
                key={id}
                className="rounded-md border border-border bg-card/40 px-2.5 py-2 backdrop-blur-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{relativeTime(d.ts)}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate text-foreground">
                    {d.trigger_event ?? d.trigger ?? '-'}
                  </span>
                  {d.playbook && (
                    <>
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      <span className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-400">
                        {d.playbook}
                      </span>
                    </>
                  )}
                  {totalDur > 0 && (
                    <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {t('decisions.duration')} {formatNumber(totalDur)}ms
                    </span>
                  )}
                </div>
                {actions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {actions.map((a, ai) => {
                      const ok = a.status === 'success'
                      return (
                        <span
                          key={ai}
                          className={cn(
                            'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]',
                            ok
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                              : 'border-red-500/30 bg-red-500/10 text-red-400',
                          )}
                        >
                          {ok ? (
                            <CheckCircle2 className="h-2.5 w-2.5" />
                          ) : (
                            <XCircle className="h-2.5 w-2.5" />
                          )}
                          {a.name ?? `action-${ai}`}
                          {a.duration_ms != null && (
                            <span className="tabular-nums opacity-70">{a.duration_ms}ms</span>
                          )}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Playbook 列表 */}
      <div className="flex flex-col gap-1.5">
        <div className="text-xs font-medium text-muted-foreground">
          {t('decisions.playbooks')} · {playbooks.length}
        </div>
        {playbooks.length === 0 ? (
          <Unavailable message={t('decisions.noDecisions')} />
        ) : (
          playbooks.map((pb) => {
            const enabled = pb.enabled ?? false
            const isToggling = toggling[pb.id] ?? false
            return (
              <div
                key={pb.id}
                className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 py-2 backdrop-blur-sm"
              >
                <Shield
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    enabled ? 'text-emerald-400' : 'text-muted-foreground',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{pb.name ?? pb.id}</div>
                  {(pb.trigger || pb.description) && (
                    <div className="truncate text-[10px] text-muted-foreground">
                      {t('decisions.trigger')}: {pb.trigger ?? pb.description}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggle(pb.id)}
                  disabled={isToggling}
                  className={cn(
                    'inline-flex h-5 shrink-0 items-center gap-1 rounded-md border px-1.5 text-[10px] transition-colors disabled:opacity-50',
                    enabled
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
                  )}
                >
                  {isToggling ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        enabled ? 'bg-emerald-400' : 'bg-zinc-500',
                      )}
                    />
                  )}
                  <span>{enabled ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Tab 3: 预算治理
// ────────────────────────────────────────────────────────────────────────────

function BudgetTab() {
  const t = useTranslations('orchestration')
  const summaryState = useOrchFetch<BudgetSummary | null>('/orchestration/budget/summary?period=today')
  const trendState = useOrchFetch<BudgetTrendPoint[] | { trend?: BudgetTrendPoint[] } | null>(
    '/orchestration/budget/trend?days=7',
  )
  const breakdownState = useOrchFetch<CostBreakdown | null>(
    '/orchestration/budget/cost-breakdown?period=today',
  )

  const summary = summaryState.data ?? null
  const trend = React.useMemo<BudgetTrendPoint[]>(() => {
    const d = trendState.data
    if (!d) return []
    if (Array.isArray(d)) return d
    return asArray<BudgetTrendPoint>(d.trend)
  }, [trendState.data])
  const breakdown = breakdownState.data ?? null

  if (summaryState.loading && !summary) return <Spinner label={t('loading')} />
  if (summaryState.error && !summary) return <Unavailable message={t('unavailable')} />

  const tokensUsed = num(summary?.tokens_used ?? summary?.token_used)
  const tokenLimit = num(summary?.token_limit ?? summary?.tokens_limit)
  const cost = num(summary?.cost)
  const costLimit = num(summary?.cost_limit)
  const usagePct = summary?.usage_pct ?? (tokenLimit > 0 ? (tokensUsed / tokenLimit) * 100 : 0)
  const pillars = summary?.pillars ?? {}

  const maxTrendTokens = Math.max(1, ...trend.map((p) => num(p.tokens ?? p.token)))

  const breakdownEntries = (obj: Record<string, number> | undefined) =>
    obj ? Object.entries(obj).sort((a, b) => num(b[1]) - num(a[1])) : []

  return (
    <div className="flex flex-col gap-3">
      {/* 顶部用量汇总 */}
      <div className="rounded-md border border-border bg-card/40 p-3 backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
          <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
          <span>{t('budget.todayUsage')}</span>
        </div>
        <div className="mb-2 flex items-end gap-4">
          <div className="flex flex-col">
            <span className="text-lg font-semibold tabular-nums">
              {formatNumber(tokensUsed)}
            </span>
            <span className="text-[10px] text-muted-foreground">{t('budget.tokens')}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold tabular-nums text-emerald-400">
              ${cost.toFixed(4)}
            </span>
            <span className="text-[10px] text-muted-foreground">{t('budget.cost')}</span>
          </div>
          <div className="ml-auto flex flex-col items-end">
            <span
              className={cn(
                'text-lg font-semibold tabular-nums',
                usagePct >= 90 ? 'text-red-400' : usagePct >= 70 ? 'text-amber-400' : 'text-emerald-400',
              )}
            >
              {usagePct.toFixed(1)}%
            </span>
            <span className="text-[10px] text-muted-foreground">
              {tokenLimit > 0 ? `/ ${formatNumber(tokenLimit)}` : ''}
            </span>
          </div>
        </div>
        <ProgressBar
          value={usagePct}
          max={100}
          className={cn(
            usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-amber-400' : 'bg-emerald-500',
          )}
        />
        {costLimit > 0 && (
          <div className="mt-1.5 text-[10px] text-muted-foreground">
            {t('budget.cost')} ${cost.toFixed(2)} / ${costLimit.toFixed(2)}
          </div>
        )}
      </div>

      {/* 7 天趋势 */}
      <div className="rounded-md border border-border bg-card/40 p-3 backdrop-blur-sm">
        <div className="mb-2 text-xs font-medium text-muted-foreground">{t('budget.trend')}</div>
        {trend.length === 0 ? (
          <Unavailable message={t('unavailable')} />
        ) : (
          <div className="flex h-24 items-end gap-1.5">
            {trend.map((p, i) => {
              const tokens = num(p.tokens ?? p.token)
              const h = Math.max(2, (tokens / maxTrendTokens) * 100)
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-cyan-500/40 to-cyan-400"
                      style={{ height: `${h}%` }}
                      title={`${formatNumber(tokens)} · $${num(p.cost).toFixed(4)}`}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {p.date ? String(p.date).slice(5) : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 支柱预算 */}
      <div className="rounded-md border border-border bg-card/40 p-3 backdrop-blur-sm">
        <div className="mb-2 text-xs font-medium text-muted-foreground">{t('budget.pillarBudget')}</div>
        {Object.keys(pillars).length === 0 ? (
          <Unavailable message={t('unavailable')} />
        ) : (
          <div className="flex flex-col gap-2">
            {PILLAR_ORDER.filter((p) => pillars[p]).map((p) => {
              const item = pillars[p]
              if (!item) return null
              const used = num(item.used ?? item.tokens_used)
              const limit = num(item.limit ?? item.token_limit)
              const pct = limit > 0 ? (used / limit) * 100 : 0
              return (
                <div key={p} className="flex items-center gap-2">
                  <span className={cn('w-16 shrink-0 text-[10px]', pillarStyle(p).split(' ')[0])}>
                    {p}
                  </span>
                  <div className="min-w-0 flex-1">
                    <ProgressBar
                      value={pct}
                      max={100}
                      className={cn(
                        pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-500',
                      )}
                    />
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {formatNumber(used)}
                    {limit > 0 ? ` / ${formatNumber(limit)}` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 成本分解 */}
      <div className="rounded-md border border-border bg-card/40 p-3 backdrop-blur-sm">
        <div className="mb-2 text-xs font-medium text-muted-foreground">{t('budget.costBreakdown')}</div>
        {!breakdown ? (
          <Unavailable message={t('unavailable')} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <BreakdownColumn
              title={t('budget.byPillar')}
              entries={breakdownEntries(breakdown.by_pillar)}
            />
            <BreakdownColumn
              title={t('budget.byModel')}
              entries={breakdownEntries(breakdown.by_model)}
            />
            <BreakdownColumn
              title={t('budget.byAction')}
              entries={breakdownEntries(breakdown.by_action)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function BreakdownColumn({ title, entries }: { title: string; entries: Array<[string, number]> }) {
  const max = Math.max(1, ...entries.map((e) => num(e[1])))
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] font-medium text-muted-foreground">{title}</div>
      {entries.length === 0 ? (
        <span className="text-[10px] text-muted-foreground">-</span>
      ) : (
        entries.map(([k, v]) => {
          const val = num(v)
          const pct = (val / max) * 100
          return (
            <div key={k} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="truncate text-muted-foreground">{k}</span>
                <span className="shrink-0 tabular-nums text-foreground">${val.toFixed(4)}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded bg-cyan-500/60"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Tab 4: 遥测
// ────────────────────────────────────────────────────────────────────────────

function TelemetryTab() {
  const t = useTranslations('orchestration')
  const healthState = useOrchFetch<
    PillarHealth[] | { pillars?: PillarHealth[] } | Record<string, PillarHealth> | null
  >('/orchestration/telemetry/health', 10000)
  const tracesState = useOrchFetch<Trace[] | { traces?: Trace[] } | null>(
    '/orchestration/telemetry/traces?limit=20',
    10000,
  )

  const pillars = React.useMemo<PillarHealth[]>(() => {
    const d = healthState.data
    if (!d) return []
    if (Array.isArray(d)) return d
    if (d.pillars) return asArray<PillarHealth>(d.pillars)
    // Record<string, PillarHealth> 形态
    return Object.entries(d).map(([k, v]) => ({ pillar: k, ...(v as PillarHealth) }))
  }, [healthState.data])

  const traces = React.useMemo<Trace[]>(() => {
    const d = tracesState.data
    if (!d) return []
    if (Array.isArray(d)) return d
    return asArray<Trace>(d.traces)
  }, [tracesState.data])

  if (healthState.loading && pillars.length === 0) return <Spinner label={t('loading')} />
  if (healthState.error && pillars.length === 0) return <Unavailable message={t('unavailable')} />

  return (
    <div className="flex flex-col gap-3">
      {/* 支柱健康卡片 */}
      <div className="flex flex-col gap-1.5">
        <div className="text-xs font-medium text-muted-foreground">{t('telemetry.pillarHealth')}</div>
        {pillars.length === 0 ? (
          <Unavailable message={t('unavailable')} />
        ) : (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {pillars.map((p, i) => {
              const status: HealthStatus = p.status ?? 'unknown'
              const hs = HEALTH_STYLE[status]
              const key = p.pillar ?? `pillar-${i}`
              return (
                <div
                  key={key}
                  className="rounded-md border border-border bg-card/40 p-2 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-1.5 w-1.5 rounded-full', hs.dot)} />
                    <span className={cn('truncate text-xs font-medium', pillarStyle(p.pillar).split(' ')[0])}>
                      {p.pillar ?? '-'}
                    </span>
                  </div>
                  <div className={cn('mt-1 text-[10px]', hs.text)}>
                    {t(`telemetry.${status}`)}
                  </div>
                  {p.metrics && (
                    <div className="mt-1 flex flex-col gap-0.5">
                      {Object.entries(p.metrics).slice(0, 3).map(([mk, mv]) => (
                        <div key={mk} className="flex justify-between text-[9px] text-muted-foreground">
                          <span className="truncate">{mk}</span>
                          <span className="shrink-0 tabular-nums">{String(mv)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 最近 Trace */}
      <div className="flex flex-col gap-1.5">
        <div className="text-xs font-medium text-muted-foreground">{t('telemetry.recentTraces')}</div>
        {traces.length === 0 ? (
          <Unavailable message={t('unavailable')} />
        ) : (
          traces.map((tr, i) => {
            const id = tr.trace_id ?? `trace-${i}`
            const ok = tr.status !== 'error'
            return (
              <div
                key={id}
                className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 py-1.5 backdrop-blur-sm"
              >
                {ok ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className="h-3 w-3 shrink-0 text-red-400" />
                )}
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground" title={id}>
                  #{id.slice(0, 10)}
                </span>
                <span
                  className={cn(
                    'rounded border px-1.5 py-0.5 text-[10px]',
                    pillarStyle(tr.pillar),
                  )}
                >
                  {tr.pillar ?? '-'}
                </span>
                <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {tr.duration_ms != null ? `${formatNumber(tr.duration_ms)}ms` : ''}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {relativeTime(tr.ts)}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 主组件
// ────────────────────────────────────────────────────────────────────────────

type TabKey = 'events' | 'decisions' | 'budget' | 'telemetry'

const TABS: Array<{ key: TabKey; icon: React.ReactNode }> = [
  { key: 'events', icon: <Zap className="h-3.5 w-3.5" /> },
  { key: 'decisions', icon: <Shield className="h-3.5 w-3.5" /> },
  { key: 'budget', icon: <DollarSign className="h-3.5 w-3.5" /> },
  { key: 'telemetry', icon: <Gauge className="h-3.5 w-3.5" /> },
]

export function OrchestrationHubPanel() {
  const t = useTranslations('orchestration')
  const [activeTab, setActiveTab] = React.useState<TabKey>('events')

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background/80 backdrop-blur-md">
      {/* 标题栏 */}
      <header className="flex h-11 shrink-0 items-center gap-2 bg-muted/30 px-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Activity className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-semibold">{t('title')}</span>
        <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span>{t('status.running')}</span>
        </span>
      </header>

      {/* Tab 导航 */}
      <nav className="flex shrink-0 items-center gap-1 bg-muted/20 px-2 py-1.5">
        {TABS.map((tab) => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-pressed={active}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {tab.icon}
              <span>{t(`tabs.${tab.key}`)}</span>
            </button>
          )
        })}
      </nav>

      {/* 内容区 */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 thin-scroll">
        {activeTab === 'events' && <EventFeedTab />}
        {activeTab === 'decisions' && <DecisionsTab />}
        {activeTab === 'budget' && <BudgetTab />}
        {activeTab === 'telemetry' && <TelemetryTab />}
      </div>
    </div>
  )
}

export default OrchestrationHubPanel
