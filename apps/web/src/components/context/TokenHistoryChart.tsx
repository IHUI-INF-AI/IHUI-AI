'use client'

import * as React from 'react'
import type { VisualizationData } from '@ihui/shared/context/index'
import { TOKEN_COLORS, TOKEN_LABELS } from './TokenPieChart'

interface TokenHistoryChartProps {
  data: VisualizationData['history']
  width?: number
  height?: number
}

type SeriesKey = keyof typeof TOKEN_COLORS

const SERIES_KEYS: SeriesKey[] = ['history', 'codebase', 'mention', 'web', 'database']

export function TokenHistoryChart({
  data,
  width = 720,
  height = 240,
}: TokenHistoryChartProps) {
  const padL = 48
  const padR = 16
  const padT = 16
  const padB = 28
  const legendH = 18
  const plotW = width - padL - padR
  const plotH = height - padT - padB - legendH

  const points = React.useMemo(() => {
    return data.map((d) => ({
      ts: d.timestamp,
      history: d.distribution.historyTokens,
      codebase: d.distribution.codebaseTokens,
      mention: d.distribution.mentionTokens,
      web: d.distribution.webTokens,
      database: d.distribution.databaseTokens,
    }))
  }, [data])

  const maxVal = React.useMemo(() => {
    let m = 0
    for (const p of points) {
      for (const k of SERIES_KEYS) m = Math.max(m, p[k])
    }
    return m <= 0 ? 1 : m
  }, [points])

  const xStep = points.length > 1 ? plotW / (points.length - 1) : 0
  const tickCount = 4
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => (maxVal * i) / tickCount)

  const xOf = (i: number) => padL + i * xStep
  const yOf = (v: number) => padT + plotH - (v / maxVal) * plotH

  const fmtTime = (ts: string) => {
    try {
      const d = new Date(ts)
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    } catch {
      return ''
    }
  }

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Token 历史趋势图"
    >
      {/* Y 轴网格 + 刻度 */}
      {yTicks.map((t, i) => {
        const y = yOf(t)
        return (
          <g key={`y-${i}`}>
            <line
              x1={padL}
              x2={width - padR}
              y1={y}
              y2={y}
              stroke="hsl(var(--border))"
              strokeWidth={1}
              strokeDasharray={i === 0 ? '' : '3 3'}
            />
            <text
              x={padL - 6}
              y={y + 3}
              textAnchor="end"
              className="fill-muted-foreground"
              style={{ fontSize: 9 }}
            >
              {Math.round(t).toLocaleString()}
            </text>
          </g>
        )
      })}

      {/* X 轴标签(最多 6 个,等距) */}
      {points.length > 0 &&
        Array.from({ length: Math.min(6, points.length) }).map((_, idx) => {
          const i = points.length > 1 ? Math.round((idx / 5) * (points.length - 1)) : 0
          const p = points[i]
          if (!p) return null
          return (
            <text
              key={`x-${idx}`}
              x={xOf(i)}
              y={height - padB + 14}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 9 }}
            >
              {fmtTime(p.ts)}
            </text>
          )
        })}

      {/* 5 条折线 */}
      {SERIES_KEYS.map((k) => {
        if (points.length === 0) return null
        const coords = points.map((p, i) => `${xOf(i)},${yOf(p[k])}`).join(' ')
        return (
          <g key={k}>
            <polyline
              points={coords}
              fill="none"
              stroke={TOKEN_COLORS[k]}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            >
              <title>{TOKEN_LABELS[k]}</title>
            </polyline>
            {points.length <= 30 &&
              points.map((p, i) => (
                <rect
                  key={`pt-${k}-${i}`}
                  x={xOf(i) - 2}
                  y={yOf(p[k]) - 2}
                  width={4}
                  height={4}
                  rx={1}
                  fill={TOKEN_COLORS[k]}
                />
              ))}
          </g>
        )
      })}

      {/* Legend */}
      {SERIES_KEYS.map((k, i) => {
        const lx = padL + i * (plotW / SERIES_KEYS.length)
        return (
          <g key={`leg-${k}`}>
            <line
              x1={lx}
              x2={lx + 14}
              y1={padT + plotH + legendH + 4}
              y2={padT + plotH + legendH + 4}
              stroke={TOKEN_COLORS[k]}
              strokeWidth={2}
            />
            <text
              x={lx + 18}
              y={padT + plotH + legendH + 7}
              className="fill-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {TOKEN_LABELS[k]}
            </text>
          </g>
        )
      })}

      {points.length === 0 && (
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 12 }}
        >
          暂无历史数据
        </text>
      )}
    </svg>
  )
}
