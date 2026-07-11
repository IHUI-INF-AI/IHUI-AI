'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface BarChartProps {
  data: number[]
  xAxis?: string[]
  horizontal?: boolean
  height?: number
  color?: string
  className?: string
}

export const BarChart = React.memo(function BarChart({
  data,
  xAxis,
  horizontal = false,
  height = 200,
  color = 'var(--primary)',
  className,
}: BarChartProps) {
  const max = Math.max(...data, 1)

  if (horizontal) {
    return (
      <div className={cn('w-full space-y-2', className)}>
        {data.map((v, i) => (
          <div key={`bar-${i}`} className="flex items-center gap-2">
            {xAxis && (
              <span className="w-16 shrink-0 text-xs text-muted-foreground">{xAxis[i]}</span>
            )}
            <div className="h-6 flex-1 overflow-hidden rounded bg-muted">
              <div
                className="flex h-full items-center justify-end rounded px-2 text-xs text-white transition-all"
                style={{ width: `${(v / max) * 100}%`, backgroundColor: color }}
              >
                {v}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const width = 400
  const padding = { top: 10, right: 10, bottom: xAxis ? 24 : 10, left: 30 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom
  const barW = (chartW / data.length) * 0.6
  const gap = (chartW / data.length) * 0.4

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="柱状图"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padding.left}
            y1={padding.top + chartH * t}
            x2={width - padding.right}
            y2={padding.top + chartH * t}
            stroke="currentColor"
            strokeWidth={0.5}
            className="text-muted-foreground/20"
          />
        ))}
        {data.map((v, i) => {
          const h = (v / max) * chartH
          const x = padding.left + i * (barW + gap) + gap / 2
          const y = padding.top + chartH - h
          return (
            <g key={`bar-${i}`}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                fill={color}
                rx={2}
                className="transition-all hover:opacity-80"
              />
              {xAxis && (
                <text
                  x={x + barW / 2}
                  y={height - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {xAxis[i]}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
})
