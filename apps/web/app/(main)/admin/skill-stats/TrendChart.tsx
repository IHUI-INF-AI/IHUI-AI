'use client'

import type { CategoryDistribution } from './types'

export function TrendChart({ data }: { data: CategoryDistribution[] }) {
  const maxCount = Math.max(1, ...data.map((d) => d.count))
  const labelMap: Record<string, string> = {
    code: '代码',
    media: '多媒体',
    'ai-top': 'AI 工具',
  }

  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">暂无分类数据</div>
    )
  }

  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = (d.count / maxCount) * 100
        return (
          <div key={d.category} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{labelMap[d.category] ?? d.category}</span>
              <span className="tabular-nums text-foreground/70">{d.count}</span>
            </div>
            <div className="h-2 w-full rounded-sm bg-muted/60">
              <div
                className="h-2 rounded-sm bg-primary/70 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}