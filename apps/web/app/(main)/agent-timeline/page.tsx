// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 全活动时间线回放(P1-4):输入 session_id → GET /api/timeline 一次拉全五类活动
// (step / compaction / checkpoint / cost / injection),统一时间轴可视化 + 汇总统计;
// checkpoint 事件标注可回滚(回滚操作走既有 checkpoint_rewind 流)。
// 后端:ai-service routers/timeline.py + services/agent_timeline.py(登录鉴权)。

'use client'

import * as React from 'react'
import {
  Activity,
  Bookmark,
  ChevronDown,
  ChevronRight,
  CircleX,
  Coins,
  History,
  Loader2,
  Minimize2,
  Search,
  ShieldAlert,
  Undo2,
  Wrench,
  XCircle,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

interface TimelineEvent {
  kind: 'step' | 'compaction' | 'checkpoint' | 'cost' | 'injection'
  at: number
  at_iso: string
  title: string
  subtitle: string
  status: string
  meta: Record<string, unknown>
  ref_id: string
}

/** 1-1 全可解释:step meta 内的证据结构(后端 _step_event 提升) */
interface StepEvidenceDiff {
  path: string
  before: string
  after: string
}

interface StepEvidenceTest {
  command: string
  exit_code: number | null
  passed: number | null
  failed: number | null
}

interface StepEvidenceRollback {
  checkpoint_id: string
  path: string
  available: boolean
}

/** meta 字符串读取(非字符串/缺失返回空串) */
function getMetaStr(meta: Record<string, unknown>, key: string): string {
  const v = meta[key]
  return typeof v === 'string' ? v : ''
}

/** meta 数值读取(非数值/缺失返回 0) */
function getMetaNum(meta: Record<string, unknown>, key: string): number {
  const v = meta[key]
  return typeof v === 'number' ? v : 0
}

interface TimelineData {
  session_id: string
  total: number
  events: TimelineEvent[]
  summary: {
    counts: Record<string, number>
    total_cost_usd: number
    total_tokens: number
    window: { start: string | null; end: string | null }
  }
}

const KIND_ICON: Record<TimelineEvent['kind'], typeof Wrench> = {
  step: Wrench,
  compaction: Minimize2,
  checkpoint: Bookmark,
  cost: Coins,
  injection: ShieldAlert,
}

const KIND_COLOR: Record<TimelineEvent['kind'], string> = {
  step: 'bg-primary/10 text-primary',
  compaction: 'bg-violet-500/10 text-violet-600',
  checkpoint: 'bg-emerald-500/10 text-emerald-600',
  cost: 'bg-amber-500/10 text-amber-600',
  injection: 'bg-destructive/10 text-destructive',
}

const KIND_COUNT_KEY: Record<TimelineEvent['kind'], string> = {
  step: 'countStep',
  compaction: 'countCompaction',
  checkpoint: 'countCheckpoint',
  cost: 'countCost',
  injection: 'countInjection',
}

export default function AgentTimelinePage() {
  const t = useTranslations('agentTimeline')
  const KIND_LABEL: Record<TimelineEvent['kind'], string> = {
    step: t('kindStep'),
    compaction: t('kindCompaction'),
    checkpoint: t('kindCheckpoint'),
    cost: t('kindCost'),
    injection: t('kindInjection'),
  }
  const [sessionId, setSessionId] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [needLogin, setNeedLogin] = React.useState(false)
  const [data, setData] = React.useState<TimelineData | null>(null)
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const load = React.useCallback(
    async (sid: string) => {
      if (!sid.trim()) return
      setLoading(true)
      setError('')
      setNeedLogin(false)
      setData(null)
      const res = await fetchApi<TimelineData>(
        `/api/timeline?session_id=${encodeURIComponent(sid.trim())}`,
      )
      setLoading(false)
      if (!res.success) {
        if (res.status === 401) setNeedLogin(true)
        else setError(res.error || t('loadFailed'))
        return
      }
      setData(res.data)
      setExpanded(null)
    },
    [t],
  )

  const fmtTime = (iso: string) =>
    iso
      ? new Intl.DateTimeFormat(undefined, {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date(iso))
      : '-'
  const fmtCost = (c: number) => (c > 0 ? `$${c.toFixed(6)}` : '-')

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <div className="mb-6 flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t('subtitle')}</p>

      <div className="mb-6 flex items-center gap-2">
        <input
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load(sessionId)}
          placeholder={t('sessionIdPlaceholder')}
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={() => void load(sessionId)}
          disabled={loading || !sessionId.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {t('load')}
        </button>
      </div>

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

      {!loading && !data && !error && !needLogin && (
        <div className="flex items-center justify-center gap-2 rounded-xl border py-16 text-sm text-muted-foreground">
          <Activity className="h-5 w-5" /> {t('noEvents')}
        </div>
      )}

      {data && (
        <>
          {/* 汇总统计 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border p-4">
              <div className="mb-1 text-xs text-muted-foreground">{t('totalEvents')}</div>
              <div className="text-xl font-bold">{data.total}</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="mb-1 text-xs text-muted-foreground">{t('totalCost')}</div>
              <div className="text-xl font-bold">{fmtCost(data.summary.total_cost_usd)}</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="mb-1 text-xs text-muted-foreground">{t('totalTokens')}</div>
              <div className="text-xl font-bold">{data.summary.total_tokens}</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="mb-1 text-xs text-muted-foreground">{t('window')}</div>
              <div className="truncate text-xs font-medium">
                {data.summary.window.start ? fmtTime(data.summary.window.start) : '-'}
                {' → '}
                {data.summary.window.end ? fmtTime(data.summary.window.end) : '-'}
              </div>
            </div>
          </div>

          {/* 分类计数徽章 */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(Object.keys(KIND_LABEL) as TimelineEvent['kind'][]).map((k) => (
              <span
                key={k}
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs',
                  KIND_COLOR[k],
                )}
              >
                {t(KIND_COUNT_KEY[k], { count: data.summary.counts[k] ?? 0 })}
              </span>
            ))}
          </div>

          {/* 统一时间轴 */}
          <div className="mt-4 rounded-xl border p-4">
            <ul className="space-y-2">
              {data.events.map((ev) => {
                const Icon = KIND_ICON[ev.kind]
                const isOpen = expanded === ev.ref_id
                const isError = ev.status === 'error' || ev.status === 'blocked'
                return (
                  <li key={`${ev.kind}-${ev.ref_id}-${ev.at}`}>
                    <button
                      onClick={() => setExpanded((p) => (p === ev.ref_id ? null : ev.ref_id))}
                      className={cn(
                        'w-full rounded-lg border p-3 text-left transition',
                        isError
                          ? 'border-destructive/40 hover:bg-destructive/5'
                          : 'hover:bg-muted/40',
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
                            KIND_COLOR[ev.kind],
                          )}
                        >
                          <Icon className="h-3 w-3" /> {KIND_LABEL[ev.kind]}
                        </span>
                        <span className="truncate text-sm font-medium">{ev.title}</span>
                        {ev.kind === 'checkpoint' && (
                          <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600">
                            {t('restorable')}
                          </span>
                        )}
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {fmtTime(ev.at_iso)}
                          {isOpen ? (
                            <ChevronDown className="ml-1 inline h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="ml-1 inline h-3.5 w-3.5" />
                          )}
                        </span>
                      </div>
                      {ev.subtitle && (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {ev.subtitle}
                        </p>
                      )}
                    </button>
                    {isOpen && (
                      <div className="mt-1 space-y-2 rounded-lg bg-muted/20 p-3">
                        {ev.kind === 'step' ? (
                          <>
                            {/* 1-1 全可解释:step 事件结构化展示决策/证据 */}
                            {getMetaStr(ev.meta, 'decision') && (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">
                                  {t('decision')}
                                </span>
                                <code className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                                  {getMetaStr(ev.meta, 'decision')}
                                </code>
                                {getMetaStr(ev.meta, 'reason') && (
                                  <span className="text-xs text-muted-foreground">
                                    {getMetaStr(ev.meta, 'reason')}
                                  </span>
                                )}
                              </div>
                            )}
                            {getMetaStr(ev.meta, 'decision') !== 'execute_tool' &&
                              !getMetaStr(ev.meta, 'decision') && (
                                <span className="text-xs text-muted-foreground" />
                              )}
                            {(() => {
                              const diff = ev.meta.diff as StepEvidenceDiff | undefined
                              if (!diff || typeof diff !== 'object' || !diff.path) return null
                              return (
                                <div>
                                  <p className="mb-1 text-xs font-semibold text-muted-foreground">
                                    {t('diffEvidence')} · <code>{diff.path}</code>
                                  </p>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <div className="rounded-md bg-destructive/5 p-2">
                                      <p className="mb-1 text-xs font-medium text-destructive/80">
                                        {t('diffBefore')}
                                      </p>
                                      <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-xs">
                                        {diff.before || '(empty)'}
                                      </pre>
                                    </div>
                                    <div className="rounded-md bg-emerald-500/5 p-2">
                                      <p className="mb-1 text-xs font-medium text-emerald-700">
                                        {t('diffAfter')}
                                      </p>
                                      <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-xs">
                                        {diff.after || '(empty)'}
                                      </pre>
                                    </div>
                                  </div>
                                </div>
                              )
                            })()}
                            {(() => {
                              const test = ev.meta.test as StepEvidenceTest | undefined
                              if (!test || typeof test !== 'object' || !test.command) return null
                              return (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-semibold text-muted-foreground">
                                    {t('testEvidence')}
                                  </span>
                                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                    {test.command}
                                  </code>
                                  {test.exit_code !== null && (
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                        test.exit_code === 0
                                          ? 'bg-emerald-500/10 text-emerald-600'
                                          : 'bg-destructive/10 text-destructive'
                                      }`}
                                    >
                                      exit {test.exit_code}
                                    </span>
                                  )}
                                  {test.passed !== null && (
                                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600">
                                      {t('testPassed', { count: test.passed })}
                                    </span>
                                  )}
                                  {test.failed !== null && test.failed > 0 && (
                                    <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                                      {t('testFailed', { count: test.failed })}
                                    </span>
                                  )}
                                </div>
                              )
                            })()}
                            {(() => {
                              const rb = ev.meta.rollback as StepEvidenceRollback | undefined
                              if (!rb || typeof rb !== 'object' || !rb.available) return null
                              return (
                                <div className="flex flex-wrap items-center gap-2 rounded-md bg-emerald-500/5 p-2">
                                  <Undo2 className="h-3.5 w-3.5 text-emerald-700" />
                                  <span className="text-xs font-medium text-emerald-700">
                                    {t('rollbackEvidence')}
                                  </span>
                                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                    {rb.checkpoint_id}
                                  </code>
                                  <span className="text-xs text-muted-foreground">{rb.path}</span>
                                </div>
                              )
                            })()}
                            {(() => {
                              const cost = getMetaNum(ev.meta, 'cost')
                              const tokens = getMetaNum(ev.meta, 'tokens')
                              const dur = getMetaNum(ev.meta, 'duration_ms')
                              if (!cost && !tokens && !dur) return null
                              return (
                                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                  {dur > 0 && (
                                    <span>
                                      {t('duration')}{' '}
                                      {dur >= 1000
                                        ? `${(dur / 1000).toFixed(2)}s`
                                        : `${Math.round(dur)}ms`}
                                    </span>
                                  )}
                                  {tokens > 0 && (
                                    <span>
                                      {t('tokens')} {tokens}
                                    </span>
                                  )}
                                  {cost > 0 && (
                                    <span>
                                      {t('costEach')} {fmtCost(cost)}
                                    </span>
                                  )}
                                </div>
                              )
                            })()}
                          </>
                        ) : null}
                        <p className="mb-1 text-xs font-semibold text-muted-foreground">
                          {t('detail')}
                        </p>
                        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">
                          {JSON.stringify(ev.meta, null, 2)}
                        </pre>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
