'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import type { TrendDataPoint, TrendRange } from './types'

interface TrendChartProps {
  data: TrendDataPoint[]
  range: TrendRange
  onRangeChange: (range: TrendRange) => void
}

const BAR_GAP = 4
const BAR_MIN_HEIGHT = 4
const CHART_HEIGHT = 180

export function TrendChart({ data, range, onRangeChange }: TrendChartProps) {
  const t = useTranslations('admin.skillStats')

  const ranges: { key: TrendRange; label: string }[] = [
    { key: 'week', label: t('trendWeek') },
    { key: 'month', label: t('trendMonth') },
    { key: 'quarter', label: t('trendQuarter') },
  ]

  const maxCount = Math.max(1, ...data.map((d) => d.count))
  const barWidth = Math.max(8, Math.min(24, (CHART_HEIGHT - data.length * BAR_GAP) / data.length))

  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">{t('noData')}</div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {ranges.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => onRangeChange(r.key)}
            className={`rounded-sm px-2 py-0.5 text-[11px] transition-colors ${
              range === r.key
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${data.length * (barWidth + BAR_GAP)} ${CHART_HEIGHT + 24}`}
        className="w-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t('trendTitle')}
      >
        {/* Y axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = CHART_HEIGHT - ratio * CHART_HEIGHT
          return (
            <g key={ratio}>
              <line
                x1={0}
                y1={y}
                x2={data.length * (barWidth + BAR_GAP)}
                y2={y}
                stroke="currentColor"
                className="text-muted/30"
                strokeWidth={0.5}
              />
              <text
                x={-2}
                y={y + 3}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize={9}
              >
                {Math.round(maxCount * ratio)}
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const barHeight = Math.max(BAR_MIN_HEIGHT, (d.count / maxCount) * CHART_HEIGHT)
          const x = i * (barWidth + BAR_GAP)
          const y = CHART_HEIGHT - barHeight
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={2}
                className="fill-primary/70 hover:fill-primary/90 transition-colors"
              />
              <text
                x={x + barWidth / 2}
                y={CHART_HEIGHT + 14}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize={8}
                transform={`rotate(-45, ${x + barWidth / 2}, ${CHART_HEIGHT + 14})`}
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}