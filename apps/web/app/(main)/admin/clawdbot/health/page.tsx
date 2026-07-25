'use client'

import * as React from 'react'
import { useLocale } from 'next-intl'
import { Activity, Loader2, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'

interface DependencyCheck {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  latencyMs: number
  message?: string
  checkedAt: number
}

interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy'
  uptime: number
  timestamp: number
  dependencies: DependencyCheck[]
}

const STATUS_CONFIG = {
  healthy: { icon: CheckCircle, cls: 'text-emerald-600', bg: 'bg-emerald-500/10', label: '健康' },
  degraded: { icon: AlertTriangle, cls: 'text-amber-600', bg: 'bg-amber-500/10', label: '降级' },
  unhealthy: { icon: XCircle, cls: 'text-red-600', bg: 'bg-red-500/10', label: '异常' },
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m ${sec}s`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

export default function ClawdbotHealthPage() {
  const locale = useLocale()
  const [report, setReport] = React.useState<HealthReport | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const load = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const res = await fetchApi<HealthReport>('/api/admin/clawdbot/health')
    if (res.success && res.data) setReport(res.data)
    else if (!res.success) setError(res.error)
    setLoading(false)
    setRefreshing(false)
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中...
      </div>
    )
  }
  if (error) {
    return (
      <div className="space-y-4">
        <div className="p-4">
          <Alert variant="danger" title="加载失败" description={error} />
        </div>
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => void load(true)}>
            <RefreshCw className="h-4 w-4" /> 重试
          </Button>
        </div>
      </div>
    )
  }
  if (!report) return null

  const StatusIcon = STATUS_CONFIG[report.status].icon

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Activity className="h-6 w-6 text-primary" /> 健康检查
        </h1>
        <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          刷新
        </Button>
      </div>

      <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl',
            STATUS_CONFIG[report.status].bg,
          )}
        >
          <StatusIcon className={cn('h-6 w-6', STATUS_CONFIG[report.status].cls)} />
        </div>
        <div>
          <p className="text-lg font-semibold">{STATUS_CONFIG[report.status].label}</p>
          <p className="text-xs text-muted-foreground">
            运行时长 {formatUptime(report.uptime)} · 检查于{' '}
            {timeFmt.format(new Date(report.timestamp))}
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-2.5">
          <p className="text-sm font-medium">依赖检查</p>
        </div>
        <div className="divide-y">
          {report.dependencies.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              暂无依赖检查项
            </div>
          ) : (
            report.dependencies.map((dep) => {
              const cfg = STATUS_CONFIG[dep.status]
              const DepIcon = cfg.icon
              return (
                <div key={dep.name} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <DepIcon className={cn('h-4 w-4', cfg.cls)} />
                    <div>
                      <p className="text-sm font-medium">{dep.name}</p>
                      {dep.message && (
                        <p className="text-xs text-muted-foreground">{dep.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{dep.latencyMs}ms</span>
                    <span className={cn('rounded px-1.5 py-0.5', cfg.bg, cfg.cls)}>
                      {cfg.label}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
