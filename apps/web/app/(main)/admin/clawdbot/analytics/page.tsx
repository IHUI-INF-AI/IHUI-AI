'use client'

import * as React from 'react'
import { BarChart, Loader2, Activity, Clock, CheckCircle, XCircle } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Alert } from '@/components/feedback'

interface AnalyticsSummary {
  totalCalls: number
  successCount: number
  failedCount: number
  successRate: number
  avgLatencyMs: number
  p95LatencyMs: number
  topIntents: Array<{ intent: string; count: number }>
  callsByBot: Array<{ botId: string; count: number }>
}

export default function ClawdbotAnalyticsPage() {
  const [summary, setSummary] = React.useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    const res = await fetchApi<AnalyticsSummary>('/api/admin/clawdbot/analytics/summary')
    if (res.success && res.data) setSummary(res.data)
    else if (!res.success) setError(res.error)
    setLoading(false)
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
      <div className="p-4">
        <Alert variant="danger" title="加载失败" description={error} />
      </div>
    )
  }
  if (!summary) return null

  const statCards = [
    {
      key: 'calls',
      label: '总调用',
      value: summary.totalCalls,
      icon: Activity,
      cls: 'text-primary',
    },
    {
      key: 'success',
      label: '成功',
      value: summary.successCount,
      icon: CheckCircle,
      cls: 'text-emerald-600',
    },
    {
      key: 'failed',
      label: '失败',
      value: summary.failedCount,
      icon: XCircle,
      cls: 'text-red-600',
    },
    {
      key: 'rate',
      label: '成功率',
      value: `${summary.successRate.toFixed(1)}%`,
      icon: BarChart,
      cls: 'text-sky-600',
    },
    {
      key: 'avg',
      label: '平均延迟',
      value: `${summary.avgLatencyMs.toFixed(0)}ms`,
      icon: Clock,
      cls: 'text-amber-600',
    },
    {
      key: 'p95',
      label: 'P95 延迟',
      value: `${summary.p95LatencyMs.toFixed(0)}ms`,
      icon: Clock,
      cls: 'text-amber-600',
    },
  ]

  const maxIntentCount = Math.max(...summary.topIntents.map((i) => i.count), 1)
  const maxBotCount = Math.max(...summary.callsByBot.map((b) => b.count), 1)

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <BarChart className="h-6 w-6 text-primary" /> 分析统计
      </h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map((c) => (
          <div key={c.key} className="flex items-center gap-2 rounded-lg border bg-card p-3">
            <c.icon className={cn('h-4 w-4 shrink-0', c.cls)} />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{c.value}</p>
              <p className="truncate text-xs text-muted-foreground">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">热门意图</p>
          {summary.topIntents.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <div className="space-y-2">
              {summary.topIntents.map((item) => (
                <div key={item.intent} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>{item.intent}</span>
                    <span className="text-muted-foreground">{item.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded bg-primary"
                      style={{ width: `${(item.count / maxIntentCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Bot 调用量</p>
          {summary.callsByBot.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <div className="space-y-2">
              {summary.callsByBot.map((item) => (
                <div key={item.botId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate">{item.botId}</span>
                    <span className="text-muted-foreground">{item.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded bg-emerald-500"
                      style={{ width: `${(item.count / maxBotCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
