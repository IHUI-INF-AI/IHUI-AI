'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface RadarChartProps {
  data: { label: string; value: number; max?: number }[]
  size?: number
  color?: string
  className?: string
}

export const RadarChart = React.memo(function RadarChart({
  data,
  size = 240,
  color = 'var(--primary)',
  className,
}: RadarChartProps) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 30
  const count = data.length
  const angleStep = (Math.PI * 2) / count

  const getPoint = (i: number, radius: number) => ({
    x: cx + radius * Math.cos(-Math.PI / 2 + i * angleStep),
    y: cy + radius * Math.sin(-Math.PI / 2 + i * angleStep),
  })

  const dataPoints = data.map((d, i) => {
    const ratio = d.value / (d.max ?? 100)
    return getPoint(i, r * Math.min(1, Math.max(0, ratio)))
  })

  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'

  return (
    <div className={cn('w-full', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="雷达图"
      >
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <polygon
            key={t}
            points={data
              .map((_, i) => {
                const p = getPoint(i, r * t)
                return `${p.x},${p.y}`
              })
              .join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.5}
            className="text-muted-foreground/20"
          />
        ))}
        {data.map((_, i) => {
          const p = getPoint(i, r)
          return (
            <line
              key={`axis-${i}`}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="currentColor"
              strokeWidth={0.5}
              className="text-muted-foreground/20"
            />
          )
        })}
        <path d={dataPath} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={2} />
        {dataPoints.map((p, i) => (
          <circle key={`point-${i}`} cx={p.x} cy={p.y} r={3} fill={color} />
        ))}
        {data.map((d, i) => {
          const p = getPoint(i, r + 16)
          return (
            <text
              key={`label-${i}`}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground text-xs"
            >
              {d.label}
            </text>
          )
        })}
      </svg>
    </div>
  )
})
