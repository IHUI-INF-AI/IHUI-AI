'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'
import { fetchApi } from '@/lib/api'

export interface ErrorCell {
  time: string
  tool: string
  count: number
  lastError?: string
}

interface ErrorHeatmapProps {
  agentId: string
  timeRange: string
  refreshKey: number
}

function cellColor(count: number): string {
  if (count === 0) return 'bg-transparent'
  if (count <= 2) return 'bg-red-500/25'
  if (count <= 5) return 'bg-red-500/50'
  return 'bg-red-600/80'
}

export function ErrorHeatmap({ agentId, timeRange, refreshKey }: ErrorHeatmapProps) {
  const [cells, setCells] = React.useState<ErrorCell[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [hover, setHover] = React.useState<{ time: string; tool: string } | null>(null)

  React.useEffect(() => {
    if (!agentId) return
    let cancelled = false
    setLoading(true)
    fetchApi<ErrorCell[]>(`/api/agents/${agentId}/errors?range=${timeRange}`)
      .then((r) => {
        if (cancelled) return
        if (r.success && r.data) setCells(r.data)
        else {
          setCells([])
          setError(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCells([])
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

  const times = React.useMemo(
    () => Array.from(new Set(cells.map((c) => c.time))).sort(),
    [cells],
  )
  const tools = React.useMemo(
    () => Array.from(new Set(cells.map((c) => c.tool))).sort(),
    [cells],
  )

  const lookup = React.useMemo(() => {
    const m = new Map<string, ErrorCell>()
    cells.forEach((c) => m.set(`${c.time}|${c.tool}`, c))
    return m
  }, [cells])

  const hoverCell = hover ? lookup.get(`${hover.time}|${hover.tool}`) : null
  const totalErrors = cells.reduce((s, c) => s + c.count, 0)

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          错误热力图
          <span className="text-xs font-normal text-muted-foreground">
            共 {totalErrors} 次错误
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : cells.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {error ? '接口暂不可用,暂无数据' : '暂无错误记录'}
          </p>
        ) : (
          <div className="space-y-2">
            <div className="overflow-auto">
              <div
                className="grid gap-0.5"
                style={{
                  gridTemplateColumns: `120px repeat(${times.length}, minmax(28px, 1fr))`,
                }}
              >
                <div />
                {times.map((t) => (
                  <div
                    key={t}
                    className="truncate text-center text-[10px] text-muted-foreground"
                    title={t}
                  >
                    {t}
                  </div>
                ))}
                {tools.map((tool) => (
                  <React.Fragment key={tool}>
                    <div
                      className="flex items-center truncate pr-2 text-[10px] text-muted-foreground"
                      title={tool}
                    >
                      {tool}
                    </div>
                    {times.map((t) => {
                      const c = lookup.get(`${t}|${tool}`)
                      const count = c?.count ?? 0
                      return (
                        <div
                          key={`${t}|${tool}`}
                          className={`relative h-6 rounded-sm border border-border/40 ${cellColor(count)} cursor-default transition-colors hover:ring-1 hover:ring-ring`}
                          onMouseEnter={() => setHover({ time: t, tool })}
                          onMouseLeave={() => setHover(null)}
                        >
                          {count > 0 && (
                            <span className="flex h-full items-center justify-center text-[10px] font-medium">
                              {count}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>错误密度:</span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded-sm bg-red-500/25" />
                1-2
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded-sm bg-red-500/50" />
                3-5
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded-sm bg-red-600/80" />
                6+
              </span>
            </div>

            {hoverCell && (
              <div className="rounded-md border bg-muted/40 p-2 text-xs">
                <div className="font-medium">{hoverCell.tool} @ {hoverCell.time}</div>
                <div className="text-muted-foreground">错误次数: {hoverCell.count}</div>
                {hoverCell.lastError && (
                  <div className="mt-1 text-red-600">
                    最近错误: {hoverCell.lastError.slice(0, 100)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
