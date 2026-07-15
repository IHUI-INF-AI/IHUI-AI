'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface LineChartProps {
  data: number[]
  xAxis?: string[]
  labels?: string[]
  smooth?: boolean
  height?: number
  color?: string
  className?: string
}

export const LineChart = React.memo(function LineChart({
  data,
  xAxis,
  labels,
  smooth = false,
  height = 200,
  color = 'var(--primary)',
  className,
}: LineChartProps) {
  const width = 400
  const padding = { top: 10, right: 10, bottom: xAxis ? 24 : 10, left: 30 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1

  const points = data.map((v, i) => ({
    x: padding.left + (chartW / (data.length - 1 || 1)) * i,
    y: padding.top + chartH - ((v - min) / range) * chartH,
  }))

  const path = smooth
    ? points.reduce((acc, p, i) => {
        if (i === 0) return `M ${p.x} ${p.y}`
        const prev = points[i - 1]!
        const cx1 = prev.x + (p.x - prev.x) / 2
        const cy1 = prev.y
        const cx2 = prev.x + (p.x - prev.x) / 2
        const cy2 = p.y
        return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p.x} ${p.y}`
      }, '')
    : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const lastPoint = points[points.length - 1]!
  const firstPoint = points[0]!
  const areaPath = `${path} L ${lastPoint.x} ${padding.top + chartH} L ${firstPoint.x} ${padding.top + chartH} Z`

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="折线图"
      >
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
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
        <path d={areaPath} fill="url(#lineGrad)" />
        <path d={path} fill="none" stroke={color} strokeWidth={2} />
        {points.map((p, i) => (
          <circle
            key={`point-${i}`}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={color}
            className="opacity-0 hover:opacity-100"
          />
        ))}
        {xAxis?.map((label, i) => (
          <text
            key={`xaxis-${i}`}
            x={points[i]?.x}
            y={height - 6}
            textAnchor="middle"
            className="fill-muted-foreground text-xs"
          >
            {label}
          </text>
        ))}
      </svg>
      {labels && (
        <div className="mt-2 flex flex-wrap gap-3">
          {labels.map((label, i) => (
            <span
              key={`label-${i}`}
              className="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
})
