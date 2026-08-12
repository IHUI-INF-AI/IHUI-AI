'use client'

import * as React from 'react'
import { BarChart3, DollarSign, Gauge, Zap } from 'lucide-react'

import { Tooltip } from '@/components/feedback'
import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

interface UsageStats {
  total_tokens: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost: number
  total_calls: number
  daily_breakdown: Record<string, { total_tokens: number; cost: number }>
  model_breakdown: Record<string, { total_tokens: number; cost: number; calls: number }>
  provider_breakdown: Record<string, { total_tokens: number; cost: number; calls: number }>
}

interface QuotaInfo {
  used_tokens: number
  quota_limit: number
  remaining: number
  usage_percent: number
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function UsageBarChart({ data }: { data: Record<string, { total_tokens: number; cost: number }> }) {
  const entries = Object.entries(data)
  if (entries.length === 0) return <p className="py-4 text-center text-xs text-muted-foreground">暂无数据</p>
  const maxTokens = Math.max(...entries.map(([, v]) => v.total_tokens), 1)
  return (
    <div className="flex items-end gap-1" style={{ height: 120 }}>
      {entries.map(([day, stats]) => {
        const pct = (stats.total_tokens / maxTokens) * 100
        return (
          <div key={day} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] text-muted-foreground">{formatTokens(stats.total_tokens)}</span>
            <div className="flex w-full items-end justify-center" style={{ height: 80 }}>
              <Tooltip content={`${day}: ${formatTokens(stats.total_tokens)} tokens, $${stats.cost.toFixed(4)}`}>
                <div
                  className="w-full max-w-[24px] rounded-t-sm bg-primary/70 transition-colors hover:bg-primary"
                  style={{ height: `${Math.max(pct, 2)}%` }}
                />
                </Tooltip>
            </div>
            <span className="text-[10px] text-muted-foreground">{day.slice(5)}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function UsagePage() {
  const [stats, setStats] = React.useState<UsageStats | null>(null)
  const [quota, setQuota] = React.useState<QuotaInfo | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      fetchApi<UsageStats>('/api/v1/ai/usage/stats?days=30'),
      fetchApi<QuotaInfo>('/api/v1/ai/usage/quota'),
    ])
      .then(([statsRes, quotaRes]) => {
        if (cancelled) return
        if (statsRes.success) setStats(statsRes.data)
        else setError(statsRes.error)
        if (quotaRes.success) setQuota(quotaRes.data)
      })
      .catch(() => { if (!cancelled) setError('数据加载失败') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <p className="py-8 text-center text-sm text-muted-foreground">加载中...</p>
    </div>
  )

  if (error) return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <p className="py-8 text-center text-sm text-destructive">{error}</p>
    </div>
  )

  const modelEntries = stats ? Object.entries(stats.model_breakdown).sort((a, b) => b[1].total_tokens - a[1].total_tokens) : []
  const totalTokens = stats?.total_tokens ?? 0
  const totalCost = stats?.total_cost ?? 0
  const totalCalls = stats?.total_calls ?? 0
  const usagePercent = quota?.usage_percent ?? 0

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4 text-primary" /> 总 Token
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatTokens(totalTokens)}</p>
            <p className="text-xs text-muted-foreground">输入: {formatTokens(stats?.total_input_tokens ?? 0)} / 输出: {formatTokens(stats?.total_output_tokens ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4 text-green-500" /> 总花费
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${totalCost.toFixed(4)}</p>
            <p className="text-xs text-muted-foreground">共 {totalCalls} 次调用</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4 text-blue-500" /> 本月用量
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatTokens(quota?.used_tokens ?? 0)}</p>
            <p className="text-xs text-muted-foreground">剩余 {formatTokens(quota?.remaining ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Gauge className="h-4 w-4 text-orange-500" /> 配额使用率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{usagePercent.toFixed(1)}%</p>
            <div className="mt-2 h-2 w-full rounded-sm bg-muted">
              <div
                className={cn(
                  'h-full rounded-sm transition-all',
                  usagePercent > 80 ? 'bg-destructive' : usagePercent > 50 ? 'bg-orange-500' : 'bg-primary',
                )}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4" /> 日用量趋势(近 30 天)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.daily_breakdown ? <UsageBarChart data={stats.daily_breakdown} /> : <p className="py-4 text-center text-xs text-muted-foreground">暂无数据</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">模型用量分布</CardTitle>
        </CardHeader>
        <CardContent>
          {modelEntries.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">暂无数据</p>
          ) : (
            <div className="space-y-2">
              {modelEntries.map(([model, m]) => {
                const pct = (m.total_tokens / totalTokens) * 100
                return (
                  <div key={model}>
                    <div className="flex justify-between text-xs">
                      <span className="truncate">{model}</span>
                      <span className="text-muted-foreground">{formatTokens(m.total_tokens)} (${m.cost.toFixed(4)})</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-sm bg-muted">
                      <div className="h-full rounded-sm bg-primary/70" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}