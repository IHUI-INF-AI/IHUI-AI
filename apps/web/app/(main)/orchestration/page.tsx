'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Gauge,
  HeartPulse,
  Loader2,
  Network,
  Radio,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'

const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL ?? 'http://localhost:8803'

/** GET /api/orchestration/status 的 data */
interface HubStatus {
  running: boolean
  event_count: number
  decision_count: number
  playbook_states: Record<string, boolean>
  redis_mode: boolean
}

/** 事件按类型统计 */
interface EventTypeStats {
  count: number
  success: number
  failed: number
}

/** 事件统计 */
interface EventStats {
  window_hours: number
  total_events: number
  by_type: Record<string, EventTypeStats>
}

/** 编排决策统计 */
interface DecisionStats {
  total_decisions: number
  completed: number
  partially_failed: number
  failed: number
  skipped: number
  success_rate: number
  avg_duration_ms: number
  playbook_triggers: Record<string, number>
}

/** 预置 playbook */
interface Playbook {
  id: string
  name: string
  trigger: string
  actions: unknown[]
  enabled: boolean
}

/** 支柱健康(近 1h 事件统计) */
interface PillarHealth {
  event_count: number
  success: number
  failed: number
  health: string
}

/** GET /api/orchestration/dashboard 的 data */
interface Dashboard {
  status: HubStatus
  event_stats: EventStats
  decision_stats: DecisionStats
  playbooks: Playbook[]
  pillar_health: Record<string, PillarHealth>
  timestamp: string
}

/** 事件流单条事件 */
interface HubEvent {
  id?: string
  event_type: string
  source_pillar: string
  timestamp: string
  payload?: Record<string, unknown>
  dispatch_id?: string
  severity?: string
}

/** 支柱中文名(前端展示用,后端无 i18n) */
const PILLAR_LABELS: Record<string, string> = {
  rules: '规则',
  hook: 'Hook',
  spec: 'Spec',
  context: '上下文',
  subagent: '子代理',
  terminal: '终端',
  budget: '预算',
}

/** 事件严重程度样式 */
const SEVERITY_CLASSES: Record<string, string> = {
  info: 'bg-muted text-muted-foreground',
  warning: 'bg-amber-500/10 text-amber-600',
  critical: 'bg-rose-500/10 text-rose-600',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** AI 服务直连(带 JWT Bearer),解包 {code, message, data} */
async function apiFetch<T>(path: string, token: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${AI_SERVICE_URL}${path}`, { headers })
  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  if (!res.ok) {
    const message =
      isRecord(json) && typeof json.message === 'string'
        ? json.message
        : undefined
    throw new Error(message ?? `编排请求失败:${res.status}`)
  }
  if (!isRecord(json)) throw new Error('编排服务响应格式异常')
  if (json.code !== 0) {
    throw new Error(typeof json.message === 'string' ? json.message : '编排服务返回错误')
  }
  const data = json.data
  if (data === null || data === undefined) throw new Error('编排服务无数据')
  return data as T
}

function formatTime(ts?: string): string {
  if (!ts) return '-'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString()
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export default function OrchestrationPage() {
  const t = useTranslations('eduAi.orch')

  const [dashboard, setDashboard] = React.useState<Dashboard | null>(null)
  const [dashboardLoading, setDashboardLoading] = React.useState(false)
  const [dashboardError, setDashboardError] = React.useState<string | null>(null)

  const [events, setEvents] = React.useState<HubEvent[]>([])
  const [eventsLoading, setEventsLoading] = React.useState(false)
  const [eventsError, setEventsError] = React.useState<string | null>(null)

  async function loadDashboard() {
    setDashboardLoading(true)
    setDashboardError(null)
    try {
      const data = await apiFetch<Dashboard>('/api/orchestration/dashboard', useAuthStore.getState().token)
      setDashboard(data)
    } catch (e) {
      setDashboardError((e as Error).message)
    } finally {
      setDashboardLoading(false)
    }
  }

  async function loadEvents() {
    setEventsLoading(true)
    setEventsError(null)
    try {
      const data = await apiFetch<HubEvent[]>('/api/orchestration/events?limit=50', useAuthStore.getState().token)
      setEvents(Array.isArray(data) ? data : [])
    } catch (e) {
      setEventsError((e as Error).message)
    } finally {
      setEventsLoading(false)
    }
  }

  function handleRefresh() {
    void loadDashboard()
    void loadEvents()
  }

  React.useEffect(() => {
    void loadDashboard()
    void loadEvents()
    }, [])

  const status = dashboard?.status

  const statItemClass = 'flex flex-col items-center justify-center gap-1 rounded-lg border bg-muted/40 p-4'

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/edu" />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Network className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t('lastHeartbeat')}: {dashboard ? formatTime(dashboard.timestamp) : '-'}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={dashboardLoading || eventsLoading}
          onClick={handleRefresh}
        >
          <RefreshCw className={cn('h-4 w-4', (dashboardLoading || eventsLoading) && 'animate-spin')} />
          {t('refresh')}
        </Button>
      </div>

      {/* 状态卡 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            {t('status')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dashboardLoading && !dashboard ? (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : dashboardError && !dashboard ? (
            <Alert variant="danger" description={dashboardError} />
          ) : status ? (
            <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-4">
              <div className={statItemClass}>
                <HeartPulse className={cn('h-5 w-5', status.running ? 'text-emerald-600' : 'text-muted-foreground')} />
                <p className="text-xs text-muted-foreground">{t('status')}</p>
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-medium',
                    status.running
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {status.running ? t('running') : t('unknown')}
                </span>
              </div>
              <div className={statItemClass}>
                <Radio className="h-5 w-5 text-primary" />
                <p className="text-xs text-muted-foreground">{t('total')}</p>
                <span className="text-xl font-bold tabular-nums">{status.event_count}</span>
              </div>
              <div className={statItemClass}>
                <Cpu className="h-5 w-5 text-primary" />
                <p className="text-xs text-muted-foreground">{t('total')}</p>
                <span className="text-xl font-bold tabular-nums">{status.decision_count}</span>
              </div>
              <div className={statItemClass}>
                <Database className="h-5 w-5 text-primary" />
                <p className="text-xs text-muted-foreground">{t('module')}</p>
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-medium',
                    status.redis_mode
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-amber-500/10 text-amber-600',
                  )}
                >
                  {status.redis_mode ? t('healthy') : t('unhealthy')}
                </span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 仪表盘卡 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            {t('dashboard')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {dashboardLoading && !dashboard ? (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : dashboardError && !dashboard ? (
            <Alert variant="danger" description={dashboardError} />
          ) : dashboard ? (
            <>
              <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
                {/* 事件统计 */}
                <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
                  <h3 className="flex items-center gap-1.5 text-sm font-medium">
                    <Radio className="h-4 w-4 text-primary" />
                    {t('events')}
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">{t('total')}</p>
                      <p className="text-xl font-bold tabular-nums">
                        {dashboard.event_stats.total_events}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('success')}</p>
                      <p className="text-xl font-bold tabular-nums text-emerald-600">
                        {Object.values(dashboard.event_stats.by_type ?? {}).reduce(
                          (sum, s) => sum + s.success,
                          0,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('failed')}</p>
                      <p className="text-xl font-bold tabular-nums text-rose-600">
                        {Object.values(dashboard.event_stats.by_type ?? {}).reduce(
                          (sum, s) => sum + s.failed,
                          0,
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 决策统计 */}
                <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
                  <h3 className="flex items-center gap-1.5 text-sm font-medium">
                    <Cpu className="h-4 w-4 text-primary" />
                    {t('status')}
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">{t('total')}</p>
                      <p className="text-xl font-bold tabular-nums">
                        {dashboard.decision_stats.total_decisions}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('success')}</p>
                      <p className="text-xl font-bold tabular-nums text-emerald-600">
                        {dashboard.decision_stats.completed}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('failed')}</p>
                      <p className="text-xl font-bold tabular-nums text-rose-600">
                        {dashboard.decision_stats.failed}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>成功率: {formatPercent(dashboard.decision_stats.success_rate)}</span>
                    <span>平均耗时: {Math.round(dashboard.decision_stats.avg_duration_ms)}ms</span>
                  </div>
                </div>
              </div>

              {/* 支柱健康 */}
              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-sm font-medium">
                  <HeartPulse className="h-4 w-4 text-primary" />
                  {t('status')}
                </h3>
                <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-3 min-[1024px]:grid-cols-4">
                  {Object.entries(dashboard.pillar_health ?? {}).map(([pillar, health]) => (
                    <div
                      key={pillar}
                      className="space-y-1.5 rounded-lg border bg-muted/40 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {PILLAR_LABELS[pillar] ?? pillar}
                        </p>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium',
                            health.health === 'healthy'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : health.health === 'unhealthy'
                                ? 'bg-rose-500/10 text-rose-600'
                                : 'bg-amber-500/10 text-amber-600',
                          )}
                        >
                          {health.health === 'healthy' ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : health.health === 'unhealthy' ? (
                            <XCircle className="h-3 w-3" />
                          ) : (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {health.health === 'healthy'
                            ? t('healthy')
                            : health.health === 'unhealthy'
                              ? t('unhealthy')
                              : t('unknown')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {t('total')}: {health.event_count}
                        </span>
                        <span className="text-emerald-600">
                          {t('success')}: {health.success}
                        </span>
                        <span className="text-rose-600">
                          {t('failed')}: {health.failed}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* 事件流卡 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            {t('events')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eventsLoading && events.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : eventsError && events.length === 0 ? (
            <Alert variant="danger" description={eventsError} />
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center">
              <Radio className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('noEvents')}</p>
            </div>
          ) : (
            <ul className="max-h-[480px] space-y-1.5 overflow-y-auto pr-1">
              {events.map((event, i) => (
                <li
                  key={event.id ?? `${event.event_type}-${i}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                >
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 font-mono text-xs font-medium',
                      SEVERITY_CLASSES[event.severity ?? 'info'] ?? SEVERITY_CLASSES.info,
                    )}
                  >
                    {event.event_type}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Cpu className="h-3.5 w-3.5" />
                    {t('module')}: {PILLAR_LABELS[event.source_pillar] ?? event.source_pillar}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {formatTime(event.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
