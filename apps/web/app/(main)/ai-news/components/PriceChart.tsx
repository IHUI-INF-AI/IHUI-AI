'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import type { LeaderboardEntry } from '@/lib/ai-news-api'
import { parseNumeric } from './text-utils'

interface Props {
  entries: LeaderboardEntry[]
}

const CHART_H = 200
const PAD_L = 36
const PAD_R = 12
const PAD_T = 16
const PAD_B = 36
const BAR_W = 14
const BAR_GAP = 4
const GROUP_GAP = 28

/** SVG 柱状图:输入价(蓝)+ 输出价(橙),纯手写无图表库(做减法原则) */
export function PriceChart({ entries }: Props) {
  const t = useTranslations('aiNews')

  const data = React.useMemo(() => {
    return entries
      .map((e) => ({
        name: e.modelName.length > 15 ? e.modelName.slice(0, 14) + '…' : e.modelName,
        input: parseNumeric(e.inputPrice),
        output: parseNumeric(e.outputPrice),
        inputRaw: e.inputPrice,
        outputRaw: e.outputPrice,
      }))
      .filter((d) => (d.input !== null && d.input > 0) || (d.output !== null && d.output > 0))
  }, [entries])

  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        {t('compare.noPriceData')}
      </div>
    )
  }

  const maxVal = Math.max(...data.flatMap((d) => [d.input ?? 0, d.output ?? 0]))
  const groupW = BAR_W * 2 + BAR_GAP
  const chartW = PAD_L + PAD_R + data.length * groupW + (data.length - 1) * GROUP_GAP
  const plotH = CHART_H - PAD_T - PAD_B
  const yTicks = 4
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => (maxVal * i) / yTicks)

  return (
    <svg viewBox={`0 0 ${chartW} ${CHART_H}`} className="w-full" style={{ maxHeight: CHART_H }} preserveAspectRatio="xMidYMid meet">
      {/* Y 轴刻度 + 网格线 */}
      {tickVals.map((v, i) => {
        const y = PAD_T + plotH - (v / maxVal) * plotH
        return (
          <g key={i}>
            <line x1={PAD_L} y1={y} x2={chartW - PAD_R} y2={y} className="stroke-muted" strokeWidth={0.5} opacity={0.3} />
            <text x={PAD_L - 4} y={y} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground" fontSize={8}>
              {v.toFixed(v >= 10 ? 0 : 1)}
            </text>
          </g>
        )
      })}
      {/* 柱子 */}
      {data.map((d, i) => {
        const gx = PAD_L + i * (groupW + GROUP_GAP)
        const inH = d.input && d.input > 0 ? (d.input / maxVal) * plotH : 0
        const outH = d.output && d.output > 0 ? (d.output / maxVal) * plotH : 0
        return (
          <g key={i}>
            {inH > 0 ? (
              <rect x={gx} y={PAD_T + plotH - inH} width={BAR_W} height={inH} fill="#3b82f6" rx={1.5}>
                <title>{`${d.name} · 输入价: ${d.inputRaw}`}</title>
              </rect>
            ) : null}
            {outH > 0 ? (
              <rect x={gx + BAR_W + BAR_GAP} y={PAD_T + plotH - outH} width={BAR_W} height={outH} fill="#f97316" rx={1.5}>
                <title>{`${d.name} · 输出价: ${d.outputRaw}`}</title>
              </rect>
            ) : null}
            <text x={gx + BAR_W + BAR_GAP / 2} y={PAD_T + plotH + 13} textAnchor="middle" className="fill-muted-foreground" fontSize={8}>
              {d.name}
            </text>
          </g>
        )
      })}
      {/* 图例 */}
      <g>
        <rect x={PAD_L} y={2} width={8} height={8} fill="#3b82f6" rx={1} />
        <text x={PAD_L + 12} y={9} className="fill-muted-foreground" fontSize={8}>输入</text>
        <rect x={PAD_L + 44} y={2} width={8} height={8} fill="#f97316" rx={1} />
        <text x={PAD_L + 56} y={9} className="fill-muted-foreground" fontSize={8}>输出</text>
      </g>
    </svg>
  )
}
