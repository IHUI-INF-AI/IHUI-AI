'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'

export interface TokenUsageItem {
  sessionLabel: string
  prompt: number
  completion: number
}

interface TokenUsageChartProps {
  agentId: string
  timeRange: string
  refreshKey: number
}

function formatToken(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

export function TokenUsageChart({ agentId, timeRange, refreshKey }: TokenUsageChartProps) {
  const [data, setData] = React.useState<TokenUsageItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!agentId) return
    let cancelled = false
    setLoading(true)
    fetchApi<TokenUsageItem[]>(`/api/agents/${agentId}/token-usage?range=${timeRange}`)
      .then((r) => {
        if (cancelled) return
        if (r.success && r.data) setData(r.data)
        else {
          setData([])
          setError(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData([])
          setError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [agentId, timeRange, refreshKey])

  const totals = data.reduce(
    (acc, d) => {
      acc.prompt += d.prompt
      acc.completion += d.completion
      acc.peak = Math.max(acc.peak, d.prompt + d.completion)
      return acc
    },
    { prompt: 0, completion: 0, peak: 0 },
  )
  const total = totals.prompt + totals.completion
  const avg = data.length > 0 ? Math.round(total / data.length) : 0
  const maxBar = Math.max(totals.peak, 1)

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Token 消耗</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {error ? '接口暂不可用,暂无数据' : '暂无 Token 消耗记录'}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border bg-muted/30 p-2">
                <div className="text-[10px] text-muted-foreground">总消耗</div>
                <div className="text-sm font-bold">{formatToken(total)}</div>
              </div>
              <div className="rounded-md border bg-muted/30 p-2">
                <div className="text-[10px] text-muted-foreground">平均</div>
                <div className="text-sm font-bold">{formatToken(avg)}</div>
              </div>
              <div className="rounded-md border bg-muted/30 p-2">
                <div className="text-[10px] text-muted-foreground">峰值</div>
                <div className="text-sm font-bold">{formatToken(totals.peak)}</div>
              </div>
            </div>

            <div className="flex h-48 items-end gap-1.5">
              {data.map((d, i) => {
                const sum = d.prompt + d.completion
                const promptH = (d.prompt / maxBar) * 100
                const completionH = (d.completion / maxBar) * 100
                return (
                  <div
                    key={i}
                    className="group relative flex h-full flex-1 flex-col justify-end"
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                  >
                    <div
                      className="w-full rounded-t-sm bg-primary/40"
                      style={{ height: `${completionH}%` }}
                    />
                    <div
                      className="w-full bg-primary"
                      style={{ height: `${promptH}%` }}
                    />
                    {hoverIdx === i && (
                      <div className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[10px] shadow">
                        <div>{d.sessionLabel}</div>
                        <div className="text-primary">Prompt: {formatToken(d.prompt)}</div>
                        <div className="text-primary/60">Completion: {formatToken(d.completion)}</div>
                        <div className="font-bold">合计: {formatToken(sum)}</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-primary" />
                Prompt
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-primary/40" />
                Completion
              </span>
              <span className="ml-auto">{data.length} 个会话</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
