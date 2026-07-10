'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface PieChartProps {
  data: { label: string; value: number; color?: string }[]
  donut?: boolean
  size?: number
  className?: string
}

const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export function PieChart({ data, donut = false, size = 200, className }: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 10
  const innerR = donut ? r * 0.6 : 0

  let currentAngle = -Math.PI / 2

  const slices = data.map((d, i) => {
    const angle = (d.value / total) * Math.PI * 2
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const largeArc = angle > Math.PI ? 1 : 0

    let path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
    if (donut) {
      const ix1 = cx + innerR * Math.cos(startAngle)
      const iy1 = cy + innerR * Math.sin(startAngle)
      const ix2 = cx + innerR * Math.cos(endAngle)
      const iy2 = cy + innerR * Math.sin(endAngle)
      path = `M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1} Z`
    }

    return { path, color: d.color ?? defaultColors[i % defaultColors.length], label: d.label, value: d.value, percentage: (d.value / total) * 100 }
  })

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} className="transition-opacity hover:opacity-80" />
        ))}
      </svg>
      <div className="space-y-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-medium">{s.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
