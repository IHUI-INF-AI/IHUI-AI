// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// 平台特有:依赖 DOM/SVG(recharts 渲染),仅 web 端消费。
// 色值一律取 @ihui/design-tokens 的 CHART_* 档(单一色源),组件内禁止十六进制字面量。
// ⚠️ 不要用 var(--primary):tokens.css 里没有这个键(真名 --color-primary,且是纯墨档),
//    写错会静默渲染成"无线"——grades 页两处折线即此型(2026-11-03 真浏览器实测 lineStroke=none)。
import {
  CHART_GREEN,
  CHART_AMBER,
  CHART_ORANGE,
  CHART_RED,
  CHART_BLUE,
  CHART_PINK,
  CHART_INDIGO,
} from '@ihui/design-tokens'

/* ─── 聚合口径(纯函数,零 IO,可被单测直接 import)─── */

/** 与后端 eduAttendanceRecord.status 协议码逐字一致;新增码不在此列,归 other */
export const TREND_STATUS_CODES = ['present', 'late', 'early', 'absent', 'leave'] as const

export type AttendanceTrendStatusCode = (typeof TREND_STATUS_CODES)[number]

/** 图上每一段的颜色键:5 个协议码 + other(后端新增状态码的收口段) */
export type AttendanceTrendSegmentKey = AttendanceTrendStatusCode | 'other'

/** GET /attendance/stats 的 periodBreakdown 行形态(服务端已按 status 聚合过一轮) */
export interface AttendancePeriodRow {
  period: string
  status: string
  count: number
}

/** 一个时段的读数:分母 total = 该时段有考勤记录的人次(不是班级在册人数) */
export interface AttendanceTrendPoint {
  /** 时段键:日 YYYY-MM-DD / 周 IYYY-IW / 月 YYYY-MM,服务端下发,客户端只排序不重算 */
  period: string
  present: number
  late: number
  early: number
  absent: number
  leave: number
  /** 协议外的状态码合并段,保证六段之和恒等于 total(读数不丢) */
  other: number
  /** 分母 = 该时段全部状态计数之和 */
  total: number
  /** 出勤率(%) = present ÷ total,两位小数,与 /attendance/stats 的全局口径同一算式 */
  attendanceRate: number
}

/** 非有限值/负数/小数一律折成 0,绝不让 NaN 进图表 */
function toCount(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 0
}

/**
 * 把 periodBreakdown 聚合成按时间升序的读数序列。
 *
 * 为什么要聚合:服务端只给 (时段, 状态, 计数) 三元组,同一时段散成多行,
 * 折线与堆叠柱都需要"一时段一点"。分母在客户端算,后端一行不改。
 *
 * 三条不丢数的规则:
 *  1. 时段或状态取不到字符串 ⇒ 该行整行跳过(服务端坏数据,不臆造读数);
 *  2. count ≤ 0 或非有限 ⇒ 折 0,不进分母也不进分子;
 *  3. 状态码不在 5 档协议内 ⇒ 进 other,留在分母里(后端加新状态时出勤率不会静默虚高)。
 */
export function buildAttendanceTrendSeries(
  rows: ReadonlyArray<AttendancePeriodRow | null | undefined>,
): AttendanceTrendPoint[] {
  const buckets = new Map<string, Record<string, number>>()

  for (const row of rows) {
    const period = typeof row?.period === 'string' ? row.period.trim() : ''
    const status = typeof row?.status === 'string' ? row.status.trim() : ''
    if (!period || !status) continue
    const count = toCount(row?.count)
    if (count === 0) continue
    const bucket = buckets.get(period)
    if (bucket) bucket[status] = (bucket[status] ?? 0) + count
    else buckets.set(period, { [status]: count })
  }

  return Array.from(buckets.entries())
    .sort((a, b) => (a[0] === b[0] ? 0 : a[0] < b[0] ? -1 : 1))
    .map(([period, counts]) => {
      const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
      const known = TREND_STATUS_CODES.reduce(
        (acc, code) => {
          acc[code] = counts[code] ?? 0
          return acc
        },
        {} as Record<AttendanceTrendStatusCode, number>,
      )
      const other = Math.max(0, total - Object.values(known).reduce((sum, n) => sum + n, 0))
      return {
        period,
        ...known,
        other,
        total,
        attendanceRate: total > 0 ? Math.round((known.present / total) * 10000) / 100 : 0,
      }
    })
}

/* ─── 图表 ─── */

/** 段色:与页面徽章档语义同指(绿=正常、琥珀=迟到、橙=早退、红=缺勤、蓝=请假、粉=协议外其他) */
const SEGMENT_COLORS: Readonly<Record<AttendanceTrendSegmentKey, string>> = {
  present: CHART_GREEN,
  late: CHART_AMBER,
  early: CHART_ORANGE,
  absent: CHART_RED,
  leave: CHART_BLUE,
  other: CHART_PINK,
}

const SEGMENT_ORDER: readonly AttendanceTrendSegmentKey[] = [...TREND_STATUS_CODES, 'other']

export interface AttendanceTrendChartProps {
  /** /attendance/stats 的 periodBreakdown 原样传入,组件自己聚合 */
  breakdown: ReadonlyArray<AttendancePeriodRow | null | undefined>
  /** 段键 → 已取词文案(取词一律在页面侧完成后经 props 传入,组件不接 i18n hook) */
  labels: Readonly<Record<AttendanceTrendSegmentKey, string>>
  /** 折线系列名(出勤率) */
  rateLabel: string
  /** 左右轴标题 */
  countAxisLabel: string
  /** 图表区域的无障碍描述(role=img 用它替代 title 属性) */
  ariaLabel: string
  /** 空数据文案 */
  emptyLabel: string
}

/**
 * 出勤趋势:每日出勤率折线(右轴 %) + 状态构成堆叠柱(左轴 人次)。
 * 两轴同图,柱看"迟到一天比一天多"、线看"整体出勤被哪几天拖下去"。
 */
export function AttendanceTrendChart({
  breakdown,
  labels,
  rateLabel,
  countAxisLabel,
  ariaLabel,
  emptyLabel,
}: AttendanceTrendChartProps) {
  const series = React.useMemo(() => buildAttendanceTrendSeries(breakdown), [breakdown])
  const visibleSegments = React.useMemo(
    // 其他段只在真出现未知状态码时才上牌,免得五语言图例长期挂一个 0
    () =>
      series.some((p) => p.other > 0) ? SEGMENT_ORDER : SEGMENT_ORDER.filter((k) => k !== 'other'),
    [series],
  )

  if (series.length === 0) {
    return <p className="py-8 text-center text-body text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="h-80" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="period" className="text-label" />
          <YAxis
            yAxisId="count"
            width={56}
            label={{ value: countAxisLabel, angle: -90, position: 'insideLeft' }}
            className="text-label"
          />
          <YAxis
            yAxisId="rate"
            orientation="right"
            domain={[0, 100]}
            unit="%"
            className="text-label"
          />
          <Tooltip />
          <Legend />
          {visibleSegments.map((key) => (
            <Bar
              key={key}
              yAxisId="count"
              dataKey={key}
              stackId="status"
              name={labels[key]}
              fill={SEGMENT_COLORS[key]}
            />
          ))}
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="attendanceRate"
            name={rateLabel}
            stroke={CHART_INDIGO}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            unit="%"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default AttendanceTrendChart
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
