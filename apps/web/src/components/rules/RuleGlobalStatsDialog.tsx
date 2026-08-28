'use client'

import * as React from 'react'
import { BarChart3, Loader2, X } from 'lucide-react'

import { rulesApi } from './rules-api'
import type { RuleGlobalStats } from './types'
import { Button } from '@ihui/ui-react'
import { StatCard } from './RuleDetailCharts'

interface RuleGlobalStatsDialogProps {
  onClose: () => void
}

/** Top 规则横向柱状图(纯 SVG) */
function TopRulesChart({
  topRules,
}: {
  topRules: Array<{ id: string; name: string; matchCount: number }>
}) {
  const maxCount = Math.max(...topRules.map((r) => r.matchCount), 1)
  const barW = (count: number) => (count / maxCount) * 140
  return (
    <svg viewBox="0 0 200 80" className="h-20 w-full">
      {topRules.slice(0, 5).map((r, idx) => {
        const y = idx * 14 + 2
        const w = barW(r.matchCount)
        return (
          <g key={r.id}>
            <text x="0" y={y + 9} className="fill-muted-foreground text-[7px]">
              {r.name.slice(0, 8)}
            </text>
            <rect x="50" y={y} width={w} height="10" rx="2" className="fill-foreground/20" />
            <text x={54 + w} y={y + 9} className="fill-muted-foreground text-[7px]">
              {r.matchCount}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function RuleGlobalStatsDialog({ onClose }: RuleGlobalStatsDialogProps) {
  const [stats, setStats] = React.useState<RuleGlobalStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    rulesApi<RuleGlobalStats>('/api/rules/stats')
      .then((res) => {
        if (!cancelled) {
          setStats(res)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 模态遮罩点击外部关闭;键盘用户通过关闭按钮(X)提供等价交互
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-white/40 p-4 dark:bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col space-y-3 rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            <BarChart3 className="mr-1 inline h-3.5 w-3.5" />
            全局统计
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : stats ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="总规则数" value={String(stats.totalRules)} />
              <StatCard label="7天活跃规则" value={String(stats.activeRules7d)} />
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground">
                最常用规则 Top {stats.topRules.length}
              </p>
              <TopRulesChart topRules={stats.topRules} />
            </div>

            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">规则列表</p>
              <div className="thin-scroll max-h-48 space-y-1 overflow-y-auto">
                {stats.topRules.length === 0 ? (
                  <p className="py-2 text-center text-[10px] text-muted-foreground">暂无命中记录</p>
                ) : (
                  stats.topRules.map((r, idx) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1"
                    >
                      <span className="w-4 text-right text-[10px] text-muted-foreground">
                        {idx + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs">{r.name}</span>
                      <span className="shrink-0 rounded-sm bg-blue-500/10 px-1 text-[10px] text-blue-600">
                        {r.matchCount} 次
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  )
}

export { RuleGlobalStatsDialog }
export type { RuleGlobalStatsDialogProps }
