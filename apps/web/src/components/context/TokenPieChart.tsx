'use client'

import * as React from 'react'
import type { TokenDistribution } from '@ihui/shared/context/index'

/** 5 类源的颜色映射(与 CONTEXT_TYPE_COLORS 共用色板) */
export const TOKEN_COLORS = {
  history: '#6366f1',
  codebase: '#10b981',
  mention: '#f59e0b',
  web: '#3b82f6',
  database: '#ec4899',
} as const

export const TOKEN_LABELS = {
  history: '对话历史',
  codebase: '代码库',
  mention: '@ 提及',
  web: '网页',
  database: '数据库',
} as const

interface PieSlice {
  key: keyof typeof TOKEN_COLORS
  value: number
}

interface TokenPieChartProps {
  distribution: TokenDistribution
  size?: number
}

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle <= Math.PI ? 0 : 1
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`
}

export function TokenPieChart({ distribution, size = 220 }: TokenPieChartProps) {
  const slices: PieSlice[] = [
    { key: 'history', value: distribution.historyTokens },
    { key: 'codebase', value: distribution.codebaseTokens },
    { key: 'mention', value: distribution.mentionTokens },
    { key: 'web', value: distribution.webTokens },
    { key: 'database', value: distribution.databaseTokens },
  ]
  const total = slices.reduce((s, x) => s + x.value, 0)
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 4

  let acc = 0
  const paths: Array<{ key: keyof typeof TOKEN_COLORS; d: string; value: number }> = []
  if (total > 0) {
    for (const s of slices) {
      if (s.value <= 0) continue
      const startAngle = (acc / total) * 2 * Math.PI - Math.PI / 2
      acc += s.value
      const endAngle = (acc / total) * 2 * Math.PI - Math.PI / 2
      paths.push({ key: s.key, d: describeArc(cx, cy, r, startAngle, endAngle), value: s.value })
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Token 分布饼图"
      >
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={2} />
        ) : (
          paths.map((p) => (
            <path
              key={p.key}
              d={p.d}
              fill={TOKEN_COLORS[p.key]}
              stroke="hsl(var(--card))"
              strokeWidth={1.5}
            >
              <title>
                {TOKEN_LABELS[p.key]}: {p.value} tokens
              </title>
            </path>
          ))
        )}
        <circle cx={cx} cy={cy} r={r * 0.55} fill="hsl(var(--card))" />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: 16, fontWeight: 700 }}
        >
          {total.toLocaleString()}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 10 }}
        >
          total tokens
        </text>
      </svg>
      <div className="grid w-full grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {slices.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: TOKEN_COLORS[s.key] }}
            />
            <span className="text-muted-foreground">{TOKEN_LABELS[s.key]}</span>
            <span className="ml-auto font-medium tabular-nums">
              {s.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
