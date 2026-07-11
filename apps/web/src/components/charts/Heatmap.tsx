'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface HeatmapProps {
  data: number[][]
  xLabels?: string[]
  yLabels?: string[]
  color?: string
  className?: string
}

export const Heatmap = React.memo(function Heatmap({
  data,
  xLabels,
  yLabels,
  color = '#3b82f6',
  className,
}: HeatmapProps) {
  const flat = data.flat()
  const max = Math.max(...flat, 1)
  const min = Math.min(...flat, 0)
  const range = max - min || 1

  const getOpacity = (v: number) => ((v - min) / range) * 0.9 + 0.1

  return (
    <div className={cn('w-full overflow-x-auto', className)} role="img" aria-label="热力图">
      <div className="inline-block">
        {yLabels && (
          <div className="flex">
            <span className="w-16" />
            {xLabels?.map((label, i) => (
              <span
                key={`x-${i}`}
                className="flex-1 px-1 text-center text-[10px] text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        )}
        {data.map((row, i) => (
          <div key={`row-${i}`} className="flex items-center">
            {yLabels && (
              <span className="w-16 shrink-0 pr-2 text-right text-[10px] text-muted-foreground">
                {yLabels[i]}
              </span>
            )}
            {row.map((v, j) => (
              <div
                key={j}
                className="m-0.5 flex aspect-square min-w-[24px] items-center justify-center rounded text-[10px] font-medium transition-transform hover:scale-110"
                style={{
                  backgroundColor: color,
                  opacity: getOpacity(v),
                  color: getOpacity(v) > 0.5 ? '#fff' : undefined,
                }}
                title={`${xLabels?.[j] ?? ''} ${yLabels?.[i] ?? ''}: ${v}`}
              >
                {v}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
})
