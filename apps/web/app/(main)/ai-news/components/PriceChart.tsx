// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CHART_BLUE, CHART_ORANGE } from '@ihui/design-tokens'
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
        // 后端 model_leaderboard 的价目列可空(LeaderboardEntry.inputPrice: string | null,
        // 见 src/lib/ai-news-api/types.ts)。parseNumeric 的契约(text-utils.tsx:14):
        // null/undefined/'' 一律返回 null ⇒ 「柱高 > 0」在业务上必然蕴含「原始串非 null」,
        // 但 TS 无法跨两个字段推断这一相关性,故下方 tooltip 对原始串做显式非空分支:
        // 真为 null 时不发提示,绝不拿假值(空串/占位)喂给用户看懂的价格位。
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
    <svg
      viewBox={`0 0 ${chartW} ${CHART_H}`}
      className="w-full"
      style={{ maxHeight: CHART_H }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Y 轴刻度 + 网格线 */}
      {tickVals.map((v, i) => {
        const y = PAD_T + plotH - (v / maxVal) * plotH
        return (
          <g key={i}>
            <line
              x1={PAD_L}
              y1={y}
              x2={chartW - PAD_R}
              y2={y}
              className="stroke-muted"
              strokeWidth={0.5}
              opacity={0.3}
            />
            <text
              x={PAD_L - 4}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground"
              fontSize={8}
            >
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
              <rect
                x={gx}
                y={PAD_T + plotH - inH}
                width={BAR_W}
                height={inH}
                fill={CHART_BLUE}
                rx={1.5} // radius-exempt: 图表细柱微圆角(1.5px),吸附到档位会破坏观感
              >
                {d.inputRaw !== null ? (
                  <title>{t('priceChart.inputPrice', { name: d.name, price: d.inputRaw })}</title>
                ) : null}
              </rect>
            ) : null}
            {outH > 0 ? (
              <rect
                x={gx + BAR_W + BAR_GAP}
                y={PAD_T + plotH - outH}
                width={BAR_W}
                height={outH}
                fill={CHART_ORANGE}
                rx={1.5} // radius-exempt: 图表细柱微圆角(1.5px),吸附到档位会破坏观感
              >
                {d.outputRaw !== null ? (
                  <title>{t('priceChart.outputPrice', { name: d.name, price: d.outputRaw })}</title>
                ) : null}
              </rect>
            ) : null}
            <text
              x={gx + BAR_W + BAR_GAP / 2}
              y={PAD_T + plotH + 13}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={8}
            >
              {d.name}
            </text>
          </g>
        )
      })}
      {/* 图例 */}
      <g>
        {/* radius-exempt: 图例小方块微圆角(1px),吸附到档位会破坏观感 */}
        <rect x={PAD_L} y={2} width={8} height={8} fill={CHART_BLUE} rx={1} />
        <text x={PAD_L + 12} y={9} className="fill-muted-foreground" fontSize={8}>
          {t('priceChart.legendInput')}
        </text>
        {/* radius-exempt: 图例小方块微圆角(1px),吸附到档位会破坏观感 */}
        <rect x={PAD_L + 44} y={2} width={8} height={8} fill={CHART_ORANGE} rx={1} />
        <text x={PAD_L + 56} y={9} className="fill-muted-foreground" fontSize={8}>
          {t('priceChart.legendOutput')}
        </text>
      </g>
    </svg>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
