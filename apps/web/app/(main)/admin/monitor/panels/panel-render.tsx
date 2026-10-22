// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 监控面板共享渲染层(2026-10-18 从 page.tsx 抽出):
 * 表达式物化/单位格式化/六种面板的原生 EChart 渲染。
 * 消费方:/admin/monitor/panels 主页 与 /admin/saas 的原生化面板包装组件。
 */
import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import type { EChartsOption } from 'echarts'

import { useTheme } from 'next-themes'

import { cn } from '@/lib/utils'
import { EChart } from '@/components/charts/EChart'
import { Tooltip } from '@/components/feedback'
import { CHART_PALETTE, chartText, chartAxis, chartBg, withAlpha } from '@ihui/design-tokens'
import type { NativeDashboard, NativePanel, PanelTarget } from './dashboard-config.generated'

// ---------- 数据形状(与 /api/admin/monitor-panels/query 响应对齐) ----------

export interface QueryResult {
  ref: string
  /** points[1] 为 null = 上游 NaN/+Inf(断点,非 0;ECharts 自动断线) */
  series: Array<{ labels: Record<string, string>; points: Array<[number, number | null]> }>
  logs?: Array<{ ts: number; line: string; labels: Record<string, string> }>
  error?: string
}

/** 取序列最后一个非 null 值(断点不算最新值)。 */
function lastVal(points: Array<[number, number | null]>): number | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const v = points[i]![1]
    if (v !== null && Number.isFinite(v)) return v
  }
  return null
}

// ---------- 时间窗与步长 ----------

/** 面板模板占位符按时间窗换算($__interval/$__range;generator 已把 $__rate_interval 归一为 $__interval)。 */
export function materializeExpr(expr: string, rangeSec: number, stepSec: number): string {
  return expr.replace(/\$__range/g, `${rangeSec}s`).replace(/\$__interval/g, `${stepSec}s`)
}

export function stepFor(rangeSec: number): number {
  return Math.max(15, Math.round(rangeSec / 180))
}

// ---------- 数值格式化(面板 unit 语义子集) ----------

function fmtCompact(v: number): string {
  const a = Math.abs(v)
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}k`
  if (a === 0) return '0'
  if (a < 0.01) return v.toExponential(1)
  if (a < 1) return v.toFixed(3)
  return a < 100 ? v.toFixed(2) : v.toFixed(0)
}

function fmtBytes(v: number): string {
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let i = 0
  let n = Math.abs(v)
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${u[i]}`
}

function fmtDuration(v: number): string {
  if (v < 1) return `${(v * 1000).toFixed(0)}ms`
  if (v < 90) return `${v.toFixed(1)}s`
  if (v < 5400) return `${(v / 60).toFixed(1)}m`
  if (v < 172800) return `${(v / 3600).toFixed(1)}h`
  return `${(v / 86400).toFixed(1)}d`
}

function fmtValue(v: number | null | undefined, unit?: string): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  switch (unit) {
    case 'percent':
      return `${v.toFixed(1)}%`
    case 'percentunit':
      return `${(v * 100).toFixed(1)}%`
    case 'bytes':
      return fmtBytes(v)
    case 'seconds':
    case 's':
      return fmtDuration(v)
    case 'ms':
      return `${v.toFixed(v < 10 ? 2 : 0)}ms`
    case 'currencyCNY':
      return `¥${fmtCompact(v)}`
    case 'currencyUSD':
      return `$${fmtCompact(v)}`
    case 'decgbytes':
      return fmtBytes(v * 1e9)
    case 'bool':
      return v > 0 ? '是' : '否'
    case 'ops':
    case 'reqps':
    case 'cps':
    case 'wps':
    case 'pps':
      return `${fmtCompact(v)}/s`
    case 'bps':
      return `${fmtCompact(v)}bps`
    case 'logs/s':
      return `${fmtCompact(v)}/s`
    default:
      return fmtCompact(v)
  }
}

/** 图例模板 {{label}} 替换;空模板回退为标签串。 */
function legendOf(target: PanelTarget, labels: Record<string, string>): string {
  // 静态 legend(P50/P95/API QPS 等,无模板)优先级最高 —— 原样保留,
  // 否则会被下方标签拼接覆盖成 method=GET 之类,同盘 P50/P95/P99 撞名
  if (target.legend && !target.legend.includes('{{')) return target.legend
  const named = target.legend.replace(/\{\{([^}]+)\}\}/g, (_, k: string) => labels[k.trim()] ?? '?')
  if (target.legend && !named.includes('{{') && named !== target.legend) return named
  if (target.legend && named === target.legend) {
    // 模板变量未命中(标签缺失),回退拼接
    const parts = Object.entries(labels)
      .filter(([k]) => k !== 'job' && k !== 'instance' && k !== '__name__')
      .map(([k, v]) => `${k}=${v}`)
    if (parts.length) return parts.join(', ')
  }
  if (!target.legend) {
    const v = labels.__name__ ?? Object.values(labels)[0] ?? ''
    return v
  }
  return named
}

// ---------- 图表配色(HUD 青色系为主) ----------
// 复用项目 design-tokens 的明暗感知色板:canvas 读不到 CSS var,
// 必须按 resolvedTheme 在 JS 侧取色,跟随项目明暗主题(不再写死蓝黑 hex)。

const PALETTE = [...CHART_PALETTE]

/** ECharts canvas 主题色(明暗双档):坐标轴/分隔线/文字/tooltip/网格底。 */
function monitorChartColors(isDark: boolean) {
  const axis = chartAxis(isDark) // 轴线/分隔线:暗 #1e293b / 亮 #e5e7eb
  const text = chartText(isDark) // 坐标文字:暗 #64748b / 亮 #94a3b8
  const bg = chartBg(isDark) // 容器底(扇区描边等):暗 #0f172a / 亮 #fff
  const subText = isDark ? '#7c93ad' : '#64748b'
  // 网格线:明暗都用低透文字色,深浅背景上都温和可见(不再写死 #16213a 深蓝)
  const gridLine = withAlpha(text, 0.22)
  const tooltipBg = isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.97)'
  const tooltipBorder = isDark ? 'rgba(72,146,196,0.35)' : 'rgba(148,163,184,0.4)'
  const tooltipText = isDark ? '#cbd5e1' : '#0f172a'
  return { axis, text, bg, subText, gridLine, tooltipBg, tooltipBorder, tooltipText }
}

/** 强调值/图例翻页/仪表指针色 = --color-info 的 JS 镜像(canvas 读不到 CSS var,
 * 按 resolvedTheme 取档,值与 tokens.css @theme 亮 hsl(199 89% 48%) / .dark hsl(199 80% 55%) 同步)。
 * 原硬编码亮青色在亮档白底上对比度不足,两主题统一收敛到 info 语义档。 */
function infoColor(isDark: boolean): string {
  return isDark ? 'hsl(199, 80%, 55%)' : 'hsl(199, 89%, 48%)'
}

function baseTimeOption(
  unit: string | undefined,
  colors: ReturnType<typeof monitorChartColors>,
): EChartsOption {
  return {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 12, top: 24, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.tooltipBg,
      borderColor: colors.tooltipBorder,
      textStyle: { color: colors.tooltipText, fontSize: 11 },
      valueFormatter: (v) => fmtValue(typeof v === 'number' ? v : Number(v), unit),
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: colors.axis } },
      axisLabel: { color: colors.text, fontSize: 10, hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: colors.text,
        fontSize: 10,
        // 统一走 fmtValue:percentunit 自动 ×100,bytes/duration/速率族全部同源
        formatter: (v: number) => fmtValue(v, unit),
      },
      splitLine: { lineStyle: { color: colors.gridLine } },
    },
  }
}

// ---------- 单面板渲染 ----------

/** 结果键:panelIdx*1000+targetIdx,保证跨面板唯一(targetIdx 仅面板内唯一)。 */
export const rkey = (panelIdx: number, targetIdx: number) => panelIdx * 1000 + targetIdx

function PanelCard({
  panel,
  panelIdx,
  results,
  loading,
}: {
  panel: NativePanel
  panelIdx: number
  results: Map<number, QueryResult>
  loading: boolean
}) {
  const errs = panel.targets
    .map((_, i) => results.get(rkey(panelIdx, i))?.error)
    .filter(Boolean) as string[]
  const hasData = panel.targets.some((_, i) => {
    const r = results.get(rkey(panelIdx, i))
    return panel.kind === 'logs' ? (r?.logs?.length ?? 0) > 0 : (r?.series?.length ?? 0) > 0
  })

  return (
    <div
      className={cn(
        'ui-lift flex flex-col rounded-lg border border-border bg-card p-3',
        panel.span === 'full' && 'pn-span-full',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-3 w-[3px] shrink-0 rounded-full bg-info/70" />
          <h3 className="truncate text-[13px] font-medium text-foreground">{panel.title}</h3>
        </div>
        {errs.length > 0 && (
          <Tooltip content={errs.join('; ')}>
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-warning-text">
              <AlertTriangle className="h-3 w-3" />
              查询异常
            </span>
          </Tooltip>
        )}
      </div>
      {loading && !hasData ? (
        <PanelPlaceholder text="加载中…" />
      ) : !hasData ? (
        <PanelPlaceholder text={errs[0] ? '上游查询失败' : '当前时间窗内暂无数据'} />
      ) : (
        <PanelBody panel={panel} panelIdx={panelIdx} results={results} />
      )}
    </div>
  )
}

function PanelPlaceholder({ text }: { text: string }) {
  return (
    <div className="flex h-[180px] flex-col items-center justify-center gap-2 rounded-md bg-muted/30 text-[11px] text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
      {text}
    </div>
  )
}

function PanelBody({
  panel,
  panelIdx,
  results,
}: {
  panel: NativePanel
  panelIdx: number
  results: Map<number, QueryResult>
}) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const colors = monitorChartColors(isDark)
  if (panel.kind === 'logs') return <LogsBody panel={panel} panelIdx={panelIdx} results={results} />
  if (panel.kind === 'stat')
    return <StatBody panel={panel} panelIdx={panelIdx} results={results} unit={panel.unit} />
  if (panel.kind === 'table')
    return <TableBody panel={panel} panelIdx={panelIdx} results={results} unit={panel.unit} />
  if (panel.kind === 'gauge')
    return <GaugeBody panel={panel} panelIdx={panelIdx} results={results} unit={panel.unit} />
  if (panel.kind === 'pie') return <PieBody panel={panel} panelIdx={panelIdx} results={results} />

  // timeseries(含 barchart/heatmap 转译);null 点原样透传,ECharts 自动断线
  const series: Array<{
    name: string
    type: 'line'
    showSymbol: boolean
    data: Array<[number, number | null]>
    lineStyle: { width: number }
    areaStyle?: Record<string, string>
    connectNulls: boolean
  }> = []
  panel.targets.forEach((t, ti) => {
    const r = results.get(rkey(panelIdx, ti))
    r?.series.forEach((s) => {
      series.push({
        name: legendOf(t, s.labels),
        type: 'line',
        showSymbol: false,
        data: s.points.map(([ts, v]) => [ts * 1000, v] as [number, number | null]),
        lineStyle: { width: 1.5 },
        areaStyle: { color: 'rgba(34,211,238,0.06)' },
        connectNulls: false,
      })
    })
  })
  if (!series.length) return <EmptyBody />
  const option: EChartsOption = {
    ...baseTimeOption(panel.unit, colors),
    legend: {
      show: series.length > 1,
      type: 'scroll',
      top: 0,
      left: 'right',
      textStyle: { color: colors.text, fontSize: 10 },
      itemWidth: 12,
      itemHeight: 8,
      pageIconColor: infoColor(isDark),
      pageTextStyle: { color: colors.text },
    },
    color: PALETTE,
    series,
  }
  return <EChart option={option} height={panel.span === 'full' ? 260 : 220} />
}

function EmptyBody() {
  return <PanelPlaceholder text="当前时间窗内暂无数据" />
}

function StatBody({
  panel,
  panelIdx,
  results,
  unit,
}: {
  panel: NativePanel
  panelIdx: number
  results: Map<number, QueryResult>
  unit?: string
}) {
  const stats: Array<{ name: string; value: number }> = []
  panel.targets.forEach((t, ti) => {
    const r = results.get(rkey(panelIdx, ti))
    r?.series.forEach((s) => {
      const last = lastVal(s.points)
      if (last !== null) stats.push({ name: legendOf(t, s.labels), value: last })
    })
  })
  if (!stats.length) return <EmptyBody />
  const shown = stats.slice(0, 6)
  const cols = shown.length <= 1 ? 'grid-cols-1' : shown.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'
  return (
    <div className="space-y-1.5">
      <div className={cn('grid gap-2', cols)}>
        {shown.map((s, i) => (
          <div key={i} className="rounded-lg bg-muted/60 px-3 py-2">
            <div className="truncate text-[11px] text-muted-foreground">{s.name}</div>
            <div className="mt-0.5 font-mono text-2xl font-semibold tabular-nums text-info-text">
              {fmtValue(s.value, unit)}
            </div>
          </div>
        ))}
      </div>
      {stats.length > 6 && (
        <div className="text-[10px] text-muted-foreground">共 {stats.length} 项，仅显示前 6 项</div>
      )}
    </div>
  )
}

/** 面板 thresholds.steps → ECharts gauge 轴色带 [[fraction, color],...](value:null = 从量程起点起) */
function gaugeBands(
  panel: NativePanel,
  g: { min: number; max: number },
  isDark: boolean,
): Array<[number, string]> {
  const baseTint = chartAxis(isDark) // 未命中阈值区间的底色:明暗都取坐标轴色,不再写死深蓝
  const steps = panel.thresholds
  if (!steps || !steps.length) return [[1, baseTint]]
  const span = g.max - g.min || 1
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  const bands: Array<[number, string]> = []
  steps.forEach((s, i) => {
    if (s.value === null) {
      if (i === 0) bands.push([0, s.color])
      return
    }
    const f = clamp((s.value - g.min) / span)
    if (bands.length === 0 && f > 0) bands.push([0, baseTint]) // 首档声明值之前是底色
    if (bands.length === 0 || f > bands[bands.length - 1]![0]) bands.push([f, s.color])
  })
  return bands.length ? bands : [[1, baseTint]]
}

function GaugeBody({
  panel,
  panelIdx,
  results,
  unit,
}: {
  panel: NativePanel
  panelIdx: number
  results: Map<number, QueryResult>
  unit?: string
}) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const gauges: Array<{ name: string; value: number; max: number; min: number }> = []
  panel.targets.forEach((t, ti) => {
    const r = results.get(rkey(panelIdx, ti))
    r?.series.forEach((s) => {
      const last = lastVal(s.points)
      if (last === null) return
      const vals = s.points.map((p) => p[1]).filter((v): v is number => v !== null)
      const peak = vals.length ? Math.max(...vals) : last
      // 量程:面板 fieldConfig 显式声明优先,否则百分比固定档,最后才按数据自造
      const declared =
        panel.max ?? (unit === 'percent' ? 100 : unit === 'percentunit' ? 1 : undefined)
      const max = declared ?? Math.max(peak * 1.25, last * 1.25, 1e-9)
      const min = panel.min ?? 0
      gauges.push({ name: legendOf(t, s.labels), value: last, max, min })
    })
  })
  if (!gauges.length) return <EmptyBody />
  const shown = gauges.slice(0, 3)
  const cols =
    shown.length <= 1 ? 'grid-cols-1' : shown.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
  return (
    <div className={cn('grid gap-2', cols)}>
      {shown.map((g, i) => (
        <EChart
          key={i}
          height={200}
          option={
            {
              backgroundColor: 'transparent',
              series: [
                {
                  type: 'gauge',
                  startAngle: 210,
                  endAngle: -30,
                  min: g.min,
                  max: g.max,
                  radius: '95%',
                  axisLine: { lineStyle: { width: 10, color: gaugeBands(panel, g, isDark) } },
                  pointer: { length: '55%', width: 4, itemStyle: { color: infoColor(isDark) } },
                  axisTick: { show: false },
                  splitLine: { show: false },
                  axisLabel: { show: false },
                  title: {
                    show: true,
                    offsetCenter: [0, '70%'],
                    color: chartText(isDark),
                    fontSize: 10,
                  },
                  detail: {
                    valueAnimation: false,
                    offsetCenter: [0, '35%'],
                    formatter: () => fmtValue(g.value, unit),
                    color: infoColor(isDark),
                    fontSize: 18,
                    fontWeight: 600,
                  },
                  data: [{ value: g.value, name: g.name }],
                },
              ],
            } as EChartsOption
          }
        />
      ))}
    </div>
  )
}

function PieBody({
  panel,
  panelIdx,
  results,
}: {
  panel: NativePanel
  panelIdx: number
  results: Map<number, QueryResult>
}) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const colors = monitorChartColors(isDark)
  const slices: Array<{ name: string; value: number }> = []
  panel.targets.forEach((t, ti) => {
    const r = results.get(rkey(panelIdx, ti))
    r?.series.forEach((s) => {
      const last = lastVal(s.points)
      if (last !== null) slices.push({ name: legendOf(t, s.labels), value: last })
    })
  })
  if (!slices.length) return <EmptyBody />
  slices.sort((a, b) => b.value - a.value)
  return (
    <EChart
      height={220}
      option={
        {
          backgroundColor: 'transparent',
          color: PALETTE,
          tooltip: {
            trigger: 'item',
            backgroundColor: colors.tooltipBg,
            borderColor: colors.tooltipBorder,
            textStyle: { color: colors.tooltipText, fontSize: 11 },
            valueFormatter: (v) => fmtValue(typeof v === 'number' ? v : Number(v), panel.unit),
          },
          legend: {
            orient: 'vertical',
            right: 4,
            top: 'middle',
            type: 'scroll',
            textStyle: { color: colors.text, fontSize: 10 },
            itemWidth: 10,
            itemHeight: 7,
            pageIconColor: infoColor(isDark),
            pageTextStyle: { color: colors.text },
          },
          series: [
            {
              type: 'pie',
              radius: ['45%', '72%'],
              center: ['38%', '50%'],
              label: { show: false },
              data: slices,
            },
          ],
        } as EChartsOption
      }
    />
  )
}

function TableBody({
  panel,
  panelIdx,
  results,
  unit,
}: {
  panel: NativePanel
  panelIdx: number
  results: Map<number, QueryResult>
  unit?: string
}) {
  const rows: Array<{ name: string; value: string; raw: number | null }> = []
  panel.targets.forEach((t, ti) => {
    const r = results.get(rkey(panelIdx, ti))
    r?.series.forEach((s) => {
      const last = lastVal(s.points)
      if (last !== null)
        rows.push({ name: legendOf(t, s.labels), value: fmtValue(last, unit), raw: last })
    })
  })
  if (!rows.length) return <EmptyBody />
  // 值降序:监控表格的使用动作是"找最大的那个序列",排序后一眼定位(null 断点沉底)
  rows.sort((a, b) => (b.raw ?? -Infinity) - (a.raw ?? -Infinity))
  return (
    <div className="max-h-[220px] overflow-auto">
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="text-muted-foreground">
            <th className="px-2 py-1 font-normal">序列</th>
            <th className="px-2 py-1 text-right font-normal">当前值</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.slice(0, 40).map((r, i) => (
            <tr key={i} className="text-foreground transition-colors hover:bg-muted/40">
              <td className="max-w-[280px] truncate px-2 py-1">{r.name}</td>
              <td className="px-2 py-1 text-right tabular-nums text-info-text">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** nssm/子进程 stdout 常带 ANSI 色码,Loki 原样收录 ⇒ 渲染前剥掉,否则页面上是乱码方块。 */
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
}

/** 日志行级别 → 行首色条,扫一眼就能定位错误行。 */
function logLevelOf(line: string): 'error' | 'warn' | 'info' | 'other' {
  const u = line.toUpperCase()
  if (/\b(ERROR|ERR|FATAL|PANIC|FAIL(ED)?)\b/.test(u)) return 'error'
  if (/\b(WARN|WARNING|DEPRECATED)\b/.test(u)) return 'warn'
  if (/\b(INFO|DEBUG|TRACE|HTTP|GET|POST|PUT|DELETE)\b/.test(u)) return 'info'
  return 'other'
}

const LEVEL_BAR: Record<string, string> = {
  error: 'bg-destructive',
  warn: 'bg-warning',
  info: 'bg-muted-foreground',
  other: 'bg-muted-foreground/50',
}

function LogsBody({
  panel,
  panelIdx,
  results,
}: {
  panel: NativePanel
  panelIdx: number
  results: Map<number, QueryResult>
}) {
  const lines: Array<{ ts: number; line: string }> = []
  panel.targets.forEach((_, ti) => {
    const r = results.get(rkey(panelIdx, ti))
    r?.logs?.forEach((l) => lines.push({ ts: l.ts, line: stripAnsi(l.line) }))
  })
  if (!lines.length) return <EmptyBody />
  lines.sort((a, b) => b.ts - a.ts)
  const t0 = new Date(lines[0]!.ts)
  return (
    <div className="max-h-[240px] space-y-0.5 overflow-auto font-mono text-[11px] leading-relaxed">
      {lines.slice(0, 120).map((l, i) => {
        const d = new Date(l.ts)
        const sameDay = d.toDateString() === t0.toDateString()
        const level = logLevelOf(l.line)
        return (
          <div
            key={i}
            className="flex gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/40"
          >
            <span className={cn('mt-0.5 h-3 w-0.5 shrink-0 rounded', LEVEL_BAR[level])} />
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {sameDay
                ? d.toLocaleTimeString('zh-CN', { hour12: false })
                : d.toLocaleString('zh-CN', { hour12: false })}
            </span>
            <span className="whitespace-pre-wrap break-all text-foreground">{l.line}</span>
          </div>
        )
      })}
    </div>
  )
}

/** 面板网格:panels 可为过滤子集,索引始终映射回 dash.panels 全量(rkey 空间不变) */
export function DashboardGrid({
  dash,
  panels,
  results,
  loading,
}: {
  dash: NativeDashboard
  panels: NativePanel[]
  results: Map<number, QueryResult>
  loading: boolean
}) {
  return (
    <div className="pn-grid">
      {panels.map((p) => {
        const pi = dash.panels.indexOf(p)
        return <PanelCard key={p.id} panel={p} panelIdx={pi} results={results} loading={loading} />
      })}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
