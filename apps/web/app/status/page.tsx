import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  Clock,
  Cpu,
  Server,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

export const revalidate = 60

export const metadata: Metadata = {
  title: '系统状态 — IHUI AI',
  description: 'IHUI-AI 中转站公开状态页,展示各模型可用性、系统总览与最近事件',
}

// ===== 类型定义 =====
type ServiceStatus = 'operational' | 'degraded' | 'outage'
type IncidentSeverity = 'minor' | 'major' | 'critical'

interface Overview {
  platform: string
  version: string
  uptime: number
  timestamp: string
  services: Record<string, ServiceStatus>
}
interface ModelStatus {
  modelId: string
  displayName: string | null
  providerCode: string
  status: ServiceStatus
  p95LatencyMs: number
  errorRate: number
  lastIncidentAt: string | null
}
interface Incident {
  id: string
  providerCode: string
  modelId: string | null
  startedAt: string
  resolvedAt: string | null
  severity: IncidentSeverity
  description: string
}

type StatusResult =
  | { ok: true; overview: Overview; models: ModelStatus[]; incidents: Incident[] }
  | { ok: false; error: string }

// ===== 类型守卫 =====
const SERVICE_STATUSES = ['operational', 'degraded', 'outage'] as const
const SEVERITIES = ['minor', 'major', 'critical'] as const

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}
function isServiceStatus(v: unknown): v is ServiceStatus {
  return typeof v === 'string' && (SERVICE_STATUSES as readonly string[]).includes(v)
}
function isSeverity(v: unknown): v is IncidentSeverity {
  return typeof v === 'string' && (SEVERITIES as readonly string[]).includes(v)
}

function parseOverview(d: unknown): Overview | null {
  if (!isRecord(d)) return null
  const services = d.services
  if (!isRecord(services)) return null
  const validated: Record<string, ServiceStatus> = {}
  for (const [k, v] of Object.entries(services)) {
    if (!isServiceStatus(v)) return null
    validated[k] = v
  }
  if (
    typeof d.platform !== 'string' ||
    typeof d.version !== 'string' ||
    typeof d.uptime !== 'number' ||
    typeof d.timestamp !== 'string'
  )
    return null
  return {
    platform: d.platform,
    version: d.version,
    uptime: d.uptime,
    timestamp: d.timestamp,
    services: validated,
  }
}

function parseModels(d: unknown): ModelStatus[] | null {
  if (!isRecord(d) || !Array.isArray(d.models)) return null
  const out: ModelStatus[] = []
  for (const m of d.models) {
    if (!isRecord(m)) return null
    if (
      typeof m.modelId !== 'string' ||
      typeof m.providerCode !== 'string' ||
      !isServiceStatus(m.status) ||
      typeof m.p95LatencyMs !== 'number' ||
      typeof m.errorRate !== 'number'
    )
      return null
    if (m.displayName !== null && typeof m.displayName !== 'string') return null
    if (m.lastIncidentAt !== null && typeof m.lastIncidentAt !== 'string') return null
    out.push({
      modelId: m.modelId,
      displayName: m.displayName,
      providerCode: m.providerCode,
      status: m.status,
      p95LatencyMs: m.p95LatencyMs,
      errorRate: m.errorRate,
      lastIncidentAt: m.lastIncidentAt,
    })
  }
  return out
}

function parseIncidents(d: unknown): Incident[] | null {
  if (!isRecord(d) || !Array.isArray(d.incidents)) return null
  const out: Incident[] = []
  for (const i of d.incidents) {
    if (!isRecord(i)) return null
    if (
      typeof i.id !== 'string' ||
      typeof i.providerCode !== 'string' ||
      typeof i.startedAt !== 'string' ||
      typeof i.description !== 'string' ||
      !isSeverity(i.severity)
    )
      return null
    if (i.modelId !== null && typeof i.modelId !== 'string') return null
    if (i.resolvedAt !== null && typeof i.resolvedAt !== 'string') return null
    out.push({
      id: i.id,
      providerCode: i.providerCode,
      modelId: i.modelId,
      startedAt: i.startedAt,
      resolvedAt: i.resolvedAt,
      severity: i.severity,
      description: i.description,
    })
  }
  return out
}

// ===== 数据获取 =====
async function fetchJson<T>(url: string, parse: (d: unknown) => T | null): Promise<T | null> {
  const res = await fetch(url, { next: { revalidate: 60 } })
  if (!res.ok) return null
  const raw: unknown = await res.json()
  if (!isRecord(raw) || raw.code !== 0) return null
  return parse(raw.data)
}

async function getStatus(): Promise<StatusResult> {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8801'
    const [overview, models, incidents] = await Promise.all([
      fetchJson(`${base}/api/public/status/overview`, parseOverview),
      fetchJson(`${base}/api/public/status/models`, parseModels),
      fetchJson(`${base}/api/public/status/incidents`, parseIncidents),
    ])
    if (!overview || !models || !incidents) return { ok: false, error: '状态获取失败,请稍后重试' }
    return { ok: true, overview, models, incidents }
  } catch {
    return { ok: false, error: '状态获取失败,请稍后重试' }
  }
}

// ===== 格式化 =====
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}天`)
  if (h > 0 || d > 0) parts.push(`${h}小时`)
  parts.push(`${m}分钟`)
  return parts.join(' ')
}

const dtf = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : dtf.format(d)
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`
}

function formatLatency(ms: number): string {
  return ms > 0 ? `${ms}ms` : '—'
}

// ===== 组件 =====
function StatusBadge({ status }: { status: ServiceStatus }) {
  const styles: Record<ServiceStatus, string> = {
    operational: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    degraded: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    outage: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  }
  const labels: Record<ServiceStatus, string> = {
    operational: '正常运行',
    degraded: '性能降级',
    outage: '服务中断',
  }
  return (
    <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', styles[status])}>
      {labels[status]}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const styles: Record<IncidentSeverity, string> = {
    minor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    major: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    critical: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  }
  const labels: Record<IncidentSeverity, string> = {
    minor: '轻微',
    major: '严重',
    critical: '严重故障',
  }
  return (
    <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', styles[severity])}>
      {labels[severity]}
    </span>
  )
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">{title}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

const SERVICE_LABELS: Record<string, string> = {
  api: 'API 服务',
  database: '数据库',
  redis: '缓存',
}

function overallStatus(
  services: Record<string, ServiceStatus>,
  models: ModelStatus[],
): ServiceStatus {
  const all = [...Object.values(services), ...models.map((m) => m.status)]
  if (all.some((s) => s === 'outage')) return 'outage'
  if (all.some((s) => s === 'degraded')) return 'degraded'
  return 'operational'
}

export default async function StatusPage() {
  const result = await getStatus()

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-rose-500" />
            <p className="text-sm font-medium">{result.error}</p>
            <p className="text-xs text-muted-foreground">页面将每 60 秒自动刷新重试</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { overview, models, incidents } = result
  const overall = overallStatus(overview.services, models)

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Activity className="h-5 w-5 text-primary" />
          系统状态
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {overview.platform} · v{overview.version} · 每 60 秒自动刷新
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={overall} />
            <span className="text-sm font-medium">
              {overall === 'operational'
                ? '所有系统运行正常'
                : overall === 'degraded'
                  ? '部分服务性能降级'
                  : '部分服务中断'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              运行 {formatUptime(overview.uptime)}
            </span>
            <span className="flex items-center gap-1">
              <Server className="h-3.5 w-3.5" />
              {formatDateTime(overview.timestamp)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Section icon={Server} title="核心服务">
        <div className="space-y-2">
          {Object.entries(overview.services).map(([key, status]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm">{SERVICE_LABELS[key] ?? key}</span>
              <StatusBadge status={status} />
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Cpu} title={`模型可用性 (${models.length})`}>
        {models.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">暂无公开模型</p>
        ) : (
          <div className="space-y-2">
            {models.map((m) => (
              <div
                key={`${m.providerCode}-${m.modelId}`}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{m.displayName ?? m.modelId}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {m.providerCode}/{m.modelId}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>P95 {formatLatency(m.p95LatencyMs)}</span>
                  <span>错误率 {formatPercent(m.errorRate)}</span>
                  <span>最近事件 {m.lastIncidentAt ? formatDateTime(m.lastIncidentAt) : '—'}</span>
                  <StatusBadge status={m.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={ShieldAlert} title="最近事件(30 天)">
        {incidents.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">最近 30 天无事件记录</p>
        ) : (
          <div className="space-y-3">
            {incidents.map((i) => (
              <div key={i.id} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={i.severity} />
                  <span className="text-sm font-medium">{i.providerCode}</span>
                  <span className="text-xs text-muted-foreground">{i.modelId ?? '—'}</span>
                </div>
                <p className="text-xs text-muted-foreground">{i.description}</p>
                <p className="text-xs text-muted-foreground">
                  开始 {formatDateTime(i.startedAt)}
                  {i.resolvedAt ? ` · 解决 ${formatDateTime(i.resolvedAt)}` : ' · 进行中'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
