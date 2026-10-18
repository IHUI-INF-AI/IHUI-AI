// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 监控面板(/admin/monitor/panels)—— 21 张监控大屏的原生项目内渲染页。
 *
 * 2026-10-18 按李总指示「彻底融合进项目,不可以单独搞出一个程序」重写:
 * 不再 iframe 内嵌 Grafana,改为
 *   页面(本文件,项目自己的 EChart 组件) → /api/admin/monitor-panels/query
 *   → Prometheus(8815) / Loki(3100) 直查出图。
 * Grafana 降级为 headless 配置源:表达式由 scripts/generate-monitor-panels.mjs
 * 从 monitoring/grafana/dashboards/*.json 转译进 dashboard-config.generated.ts,
 * 运行时用户完全不接触 Grafana。零假数据:所有曲线/数字都来自真实指标。
 */
import * as React from 'react'
import { RefreshCw, AlertTriangle, Search } from 'lucide-react'
import type { EChartsOption } from 'echarts'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { EChart } from '@/components/charts/EChart'
import type { NativeDashboard, NativePanel, PanelTarget } from './dashboard-config.generated'

// 配置体积 3000+ 行(213 条表达式),静态 import 会进首屏 bundle;运行期动态
// import 让 Next 把它切成独立 chunk,本页打开时才拉取(类型仍静态导入,零成本)。
type ConfigModule = typeof import('./dashboard-config.generated')
function loadConfig(): Promise<ConfigModule> {
  return import('./dashboard-config.generated')
}

// ---------- 数据形状(与 /api/admin/monitor-panels/query 响应对齐) ----------

interface QueryResult {
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

const RANGES = [
  { label: '1小时', seconds: 3600 },
  { label: '3小时', seconds: 3 * 3600 },
  { label: '6小时', seconds: 6 * 3600 },
  { label: '24小时', seconds: 24 * 3600 },
  { label: '7天', seconds: 7 * 86400 },
] as const

const AUTO_REFRESH_MS = 30_000

/** Grafana 模板占位符按时间窗换算($__interval/$__range;generator 已把 $__rate_interval 归一为 $__interval)。 */
function materializeExpr(expr: string, rangeSec: number, stepSec: number): string {
  return expr
    .replace(/\$__range/g, `${rangeSec}s`)
    .replace(/\$__interval/g, `${stepSec}s`)
}

function stepFor(rangeSec: number): number {
  return Math.max(15, Math.round(rangeSec / 180))
}

// ---------- 数值格式化(Grafana unit 语义子集) ----------

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

/** Grafana legendFormat 的 {{label}} 替换;空模板回退为标签串。 */
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

const PALETTE = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#60a5fa', '#f472b6', '#4ade80']
const AXIS = '#3f4c63'
const TEXT = '#94a3b8'

function baseTimeOption(unit?: string): EChartsOption {
  return {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 12, top: 24, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#111a2c',
      borderColor: '#1e3a5f',
      textStyle: { color: '#cbd5e1', fontSize: 11 },
      valueFormatter: (v) => fmtValue(typeof v === 'number' ? v : Number(v), unit),
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: AXIS } },
      axisLabel: { color: TEXT, fontSize: 10, hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: TEXT,
        fontSize: 10,
        // 统一走 fmtValue:percentunit 自动 ×100,bytes/duration/速率族全部同源
        formatter: (v: number) => fmtValue(v, unit),
      },
      splitLine: { lineStyle: { color: '#16213a' } },
    },
  }
}

// ---------- 单面板渲染 ----------

/** 结果键:panelIdx*1000+targetIdx,保证跨面板唯一(targetIdx 仅面板内唯一)。 */
const rkey = (panelIdx: number, targetIdx: number) => panelIdx * 1000 + targetIdx

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
  const errs = panel.targets.map((_, i) => results.get(rkey(panelIdx, i))?.error).filter(Boolean) as string[]
  const hasData = panel.targets.some((_, i) => {
    const r = results.get(rkey(panelIdx, i))
    return panel.kind === 'logs' ? (r?.logs?.length ?? 0) > 0 : (r?.series?.length ?? 0) > 0
  })

  return (
    <div
      className={cn(
        'rounded-lg border border-[#1b2a45] bg-[#0b1220] p-3',
        panel.span === 'full' ? 'md:col-span-2' : 'md:col-span-1',
      )}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="truncate text-[13px] font-medium text-slate-200">{panel.title}</h3>
        {errs.length > 0 && (
          <span className="shrink-0 text-[10px] text-amber-400" title={errs.join('; ')}>
            <AlertTriangle className="mr-0.5 inline h-3 w-3" />
            查询异常
          </span>
        )}
      </div>
      {loading && !hasData ? (
        <div className="flex h-[220px] items-center justify-center text-xs text-slate-500">加载中…</div>
      ) : !hasData ? (
        <div className="flex h-[220px] items-center justify-center text-xs text-slate-500">
          {errs[0] ? '上游查询失败' : '当前时间窗内暂无数据'}
        </div>
      ) : (
        <PanelBody panel={panel} panelIdx={panelIdx} results={results} />
      )}
    </div>
  )
}

function PanelBody({ panel, panelIdx, results }: { panel: NativePanel; panelIdx: number; results: Map<number, QueryResult> }) {
  if (panel.kind === 'logs') return <LogsBody panel={panel} panelIdx={panelIdx} results={results} />
  if (panel.kind === 'stat') return <StatBody panel={panel} panelIdx={panelIdx} results={results} unit={panel.unit} />
  if (panel.kind === 'table') return <TableBody panel={panel} panelIdx={panelIdx} results={results} unit={panel.unit} />
  if (panel.kind === 'gauge') return <GaugeBody panel={panel} panelIdx={panelIdx} results={results} unit={panel.unit} />
  if (panel.kind === 'pie') return <PieBody panel={panel} panelIdx={panelIdx} results={results} />

  // timeseries(含 barchart/heatmap 转译);null 点原样透传,ECharts 自动断线
  const series: Array<{ name: string; type: 'line'; showSymbol: boolean; data: Array<[number, number | null]>; lineStyle: { width: number }; areaStyle?: Record<string, string>; connectNulls: boolean }> = []
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
    ...baseTimeOption(panel.unit),
    legend: {
      show: series.length > 1,
      type: 'scroll',
      top: 0,
      left: 'right',
      textStyle: { color: TEXT, fontSize: 10 },
      itemWidth: 12,
      itemHeight: 8,
      pageIconColor: '#22d3ee',
      pageTextStyle: { color: TEXT },
    },
    color: PALETTE,
    series,
  }
  return <EChart option={option} height={panel.span === 'full' ? 260 : 220} />
}

function EmptyBody() {
  return <div className="flex h-[220px] items-center justify-center text-xs text-slate-500">当前时间窗内暂无数据</div>
}

function StatBody({ panel, panelIdx, results, unit }: { panel: NativePanel; panelIdx: number; results: Map<number, QueryResult>; unit?: string }) {
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
    <div className={cn('grid gap-2', cols)}>
      {shown.map((s, i) => (
        <div key={i} className="rounded-md bg-[#0f1a30] px-3 py-2" title={stats.length > 6 ? `共 ${stats.length} 项` : undefined}>
          <div className="truncate text-[11px] text-slate-500">{s.name}</div>
          <div className="mt-0.5 font-mono text-2xl font-semibold text-cyan-300">{fmtValue(s.value, unit)}</div>
        </div>
      ))}
    </div>
  )
}

/** Grafana thresholds.steps → ECharts gauge 轴色带 [[fraction, color],...](value:null = 从量程起点起) */
function gaugeBands(panel: NativePanel, g: { min: number; max: number }): Array<[number, string]> {
  const steps = panel.thresholds
  if (!steps || !steps.length) return [[1, '#16213a']]
  const span = g.max - g.min || 1
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  const bands: Array<[number, string]> = []
  steps.forEach((s, i) => {
    if (s.value === null) {
      if (i === 0) bands.push([0, s.color])
      return
    }
    const f = clamp((s.value - g.min) / span)
    if (bands.length === 0 && f > 0) bands.push([0, '#16213a']) // 首档声明值之前是底色
    if (bands.length === 0 || f > bands[bands.length - 1]![0]) bands.push([f, s.color])
  })
  return bands.length ? bands : [[1, '#16213a']]
}

function GaugeBody({ panel, panelIdx, results, unit }: { panel: NativePanel; panelIdx: number; results: Map<number, QueryResult>; unit?: string }) {
  const gauges: Array<{ name: string; value: number; max: number; min: number }> = []
  panel.targets.forEach((t, ti) => {
    const r = results.get(rkey(panelIdx, ti))
    r?.series.forEach((s) => {
      const last = lastVal(s.points)
      if (last === null) return
      const vals = s.points.map((p) => p[1]).filter((v): v is number => v !== null)
      const peak = vals.length ? Math.max(...vals) : last
      // 量程:Grafana fieldConfig 显式声明优先,否则百分比固定档,最后才按数据自造
      const declared = panel.max ?? (unit === 'percent' ? 100 : unit === 'percentunit' ? 1 : undefined)
      const max = declared ?? Math.max(peak * 1.25, last * 1.25, 1e-9)
      const min = panel.min ?? 0
      gauges.push({ name: legendOf(t, s.labels), value: last, max, min })
    })
  })
  if (!gauges.length) return <EmptyBody />
  const shown = gauges.slice(0, 3)
  const cols = shown.length <= 1 ? 'grid-cols-1' : shown.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
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
                  axisLine: { lineStyle: { width: 10, color: gaugeBands(panel, g) } },
                  pointer: { length: '55%', width: 4, itemStyle: { color: '#22d3ee' } },
                  axisTick: { show: false },
                  splitLine: { show: false },
                  axisLabel: { show: false },
                  title: { show: true, offsetCenter: [0, '70%'], color: TEXT, fontSize: 10 },
                  detail: {
                    valueAnimation: false,
                    offsetCenter: [0, '35%'],
                    formatter: () => fmtValue(g.value, unit),
                    color: '#67e8f9',
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

function PieBody({ panel, panelIdx, results }: { panel: NativePanel; panelIdx: number; results: Map<number, QueryResult> }) {
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
            backgroundColor: '#111a2c',
            borderColor: '#1e3a5f',
            textStyle: { color: '#cbd5e1', fontSize: 11 },
            valueFormatter: (v) => fmtValue(typeof v === 'number' ? v : Number(v), panel.unit),
          },
          legend: { orient: 'vertical', right: 4, top: 'middle', type: 'scroll', textStyle: { color: TEXT, fontSize: 10 }, itemWidth: 10, itemHeight: 7, pageIconColor: '#22d3ee', pageTextStyle: { color: TEXT } },
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

function TableBody({ panel, panelIdx, results, unit }: { panel: NativePanel; panelIdx: number; results: Map<number, QueryResult>; unit?: string }) {
  const rows: Array<{ name: string; value: string; raw: number | null }> = []
  panel.targets.forEach((t, ti) => {
    const r = results.get(rkey(panelIdx, ti))
    r?.series.forEach((s) => {
      const last = lastVal(s.points)
      if (last !== null) rows.push({ name: legendOf(t, s.labels), value: fmtValue(last, unit), raw: last })
    })
  })
  if (!rows.length) return <EmptyBody />
  // 值降序:监控表格的使用动作是"找最大的那个序列",排序后一眼定位(null 断点沉底)
  rows.sort((a, b) => (b.raw ?? -Infinity) - (a.raw ?? -Infinity))
  return (
    <div className="max-h-[220px] overflow-auto">
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="text-slate-500">
            <th className="px-2 py-1 font-normal">序列</th>
            <th className="px-2 py-1 text-right font-normal">当前值</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.slice(0, 40).map((r, i) => (
            <tr key={i} className="border-t border-[#16213a] text-slate-300">
              <td className="max-w-[280px] truncate px-2 py-1">{r.name}</td>
              <td className="px-2 py-1 text-right text-cyan-300">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** nssm/子进程 stdout 常带 ANSI 色码,Loki 原样收录 ⇒ 渲染前剥掉,否则页面上是乱码方块。 */
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
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
  error: 'bg-red-400',
  warn: 'bg-amber-400',
  info: 'bg-slate-600',
  other: 'bg-slate-700',
}

function LogsBody({ panel, panelIdx, results }: { panel: NativePanel; panelIdx: number; results: Map<number, QueryResult> }) {
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
          <div key={i} className="flex gap-2 border-b border-[#101a2e] pb-0.5">
            <span className={cn('mt-0.5 h-3 w-0.5 shrink-0 rounded', LEVEL_BAR[level])} title={level} />
            <span className="shrink-0 text-slate-600">
              {sameDay ? d.toLocaleTimeString('zh-CN', { hour12: false }) : d.toLocaleString('zh-CN', { hour12: false })}
            </span>
            <span className="whitespace-pre-wrap break-all text-slate-300">{l.line}</span>
          </div>
        )
      })}
    </div>
  )
}

// ---------- 页面主体 ----------

export default function MonitorPanelsPage() {
  const [config, setConfig] = React.useState<ConfigModule | null>(null)
  const [activeUid, setActiveUid] = React.useState<string>('')
  const [rangeSec, setRangeSec] = React.useState<number>(RANGES[1].seconds)
  const [autoRefresh, setAutoRefresh] = React.useState(true)
  const [loading, setLoading] = React.useState(false)
  const [pageError, setPageError] = React.useState('')
  const [results, setResults] = React.useState<Map<number, QueryResult>>(new Map())
  const [updatedAt, setUpdatedAt] = React.useState<Date | null>(null)
  const [navOpen, setNavOpen] = React.useState(true)
  const [filter, setFilter] = React.useState('')
  const [countdown, setCountdown] = React.useState(AUTO_REFRESH_MS / 1000)
  const inFlight = React.useRef(false)

  // 配置 chunk 懒加载(首次进入拉取一次,随后走模块缓存)
  React.useEffect(() => {
    let alive = true
    void loadConfig().then((m) => {
      if (!alive) return
      setConfig(m)
      setActiveUid((u) => u || m.MONITOR_DASHBOARDS[0]!.uid)
    })
    return () => {
      alive = false
    }
  }, [])

  const dashboard = config?.MONITOR_DASHBOARDS.find((d) => d.uid === activeUid) ?? null

  const load = React.useCallback(async (dash: NativeDashboard, rSec: number) => {
    // 在飞防护:30s interval 不看上一次是否完成,批间慢于 30s 时新旧两次 load
    // 会竞争 setResults(旧响应可覆盖新响应)。ref 跨闭包共享状态。
    if (inFlight.current) return
    inFlight.current = true
    setLoading(true)
    setPageError('')
    const queries: Array<{
      ref: string
      expr: string
      backend: 'prometheus' | 'loki'
      rangeSeconds?: number
      stepSeconds?: number
    }> = []
    const flat: Array<{ panelIdx: number; targetIdx: number }> = []
    const stepSec = stepFor(rSec)
    dash.panels.forEach((p, pi) => {
      // stat/gauge/table 用即时查询(最新值);其余走区间查询
      const instant = p.kind === 'stat' || p.kind === 'gauge' || p.kind === 'table'
      p.targets.forEach((t, ti) => {
        queries.push({
          ref: `q${queries.length}`,
          expr: materializeExpr(t.expr, rSec, stepSec),
          backend: p.backend,
          ...(instant ? {} : { rangeSeconds: rSec, stepSeconds: stepSec }),
        })
        flat.push({ panelIdx: pi, targetIdx: ti })
      })
    })
    const next = new Map<number, QueryResult>()
    try {
      // 同键(expr+backend+窗口)去重:同盘常见多面板共享同一表达式,只查一次上游
      const byKey = new Map<string, number[]>() // key -> queries 原始下标列表(含首个)
      const uniq: typeof queries = []
      const uniqOrig: number[] = [] // uniq[j] 对应 queries[uniqOrig[j]]
      const uniqFlat: Array<{ panelIdx: number; targetIdx: number }> = []
      queries.forEach((q, i) => {
        const key = `${q.backend}|${q.rangeSeconds ?? '-'}|${q.stepSeconds ?? '-'}|${q.expr}`
        const hit = byKey.get(key)
        if (hit) hit.push(i)
        else {
          byKey.set(key, [i])
          uniq.push(q)
          uniqOrig.push(i)
          uniqFlat.push(flat[i]!)
        }
      })
      // API 单次上限 96 条,分批(服务端已并发执行,批间串行即可)
      for (let i = 0; i < uniq.length; i += 96) {
        const batch = uniq.slice(i, i + 96)
        let res
        try {
          res = await fetchApi<{ results: QueryResult[] }>('/api/admin/monitor-panels/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queries: batch }),
            timeoutMs: 60_000,
          })
        } catch (e) {
          // 网络异常/请求中止:不静默,给出行内提示(数据保留旧值)
          setPageError(`网络异常:${String((e as Error).message).slice(0, 120)}`)
          break
        }
        if (!res.success || !res.data) {
          setPageError(res.error || '查询失败')
          break
        }
        res.data.results.forEach((r, bi) => {
          const j = i + bi
          const f = uniqFlat[j]
          if (!f) return
          next.set(rkey(f.panelIdx, f.targetIdx), r)
          // 克隆给共享同表达式的其余引用
          const origIdx = uniqOrig[j]!
          const q0 = queries[origIdx]!
          const key = `${q0.backend}|${q0.rangeSeconds ?? '-'}|${q0.stepSeconds ?? '-'}|${q0.expr}`
          for (const dup of byKey.get(key) ?? []) {
            if (dup === origIdx) continue
            const df = flat[dup]
            if (df) next.set(rkey(df.panelIdx, df.targetIdx), r)
          }
        })
      }
      setResults(next)
      setUpdatedAt(new Date())
      setCountdown(AUTO_REFRESH_MS / 1000)
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (dashboard) void load(dashboard, rangeSec)
  }, [dashboard, rangeSec, load])

  React.useEffect(() => {
    if (!autoRefresh || !dashboard) return
    const t = setInterval(() => void load(dashboard, rangeSec), AUTO_REFRESH_MS)
    return () => clearInterval(t)
  }, [autoRefresh, dashboard, rangeSec, load])

  // 倒计时仅做显示(实际刷新由上面的 interval 驱动);每次数据落定即重置
  React.useEffect(() => {
    if (!autoRefresh) return
    const tick = setInterval(() => setCountdown((c) => (c <= 1 ? AUTO_REFRESH_MS / 1000 : c - 1)), 1000)
    return () => clearInterval(tick)
  }, [autoRefresh])
  React.useEffect(() => {
    setCountdown(AUTO_REFRESH_MS / 1000)
  }, [updatedAt])

  /** 切盘即清旧数据:避免新盘面板短暂显示上一盘的结果(键空间不同,语义上是脏数据)。 */
  const switchDashboard = (uid: string) => {
    if (uid === activeUid) return
    setActiveUid(uid)
    setResults(new Map())
    setUpdatedAt(null)
    setPageError('')
  }

  const groups = config?.PANEL_GROUPS ?? []
  const boards = config?.MONITOR_DASHBOARDS ?? []
  const panels = React.useMemo(() => {
    if (!dashboard) return []
    const q = filter.trim().toLowerCase()
    return q ? dashboard.panels.filter((p) => p.title.toLowerCase().includes(q)) : dashboard.panels
  }, [dashboard, filter])

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden rounded-lg border border-[#1b2a45] bg-[#070d1a]">
      {/* 左侧导航:21 张盘,按分组 */}
      <aside
        className={cn(
          'shrink-0 overflow-y-auto border-r border-[#16213a] bg-[#0a101f] transition-all',
          navOpen ? 'w-56' : 'w-12',
        )}
      >
        <button
          type="button"
          onClick={() => setNavOpen((v) => !v)}
          className="w-full px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500 hover:text-cyan-300"
        >
          {navOpen ? `监控大屏 (${boards.length})` : '»'}
        </button>
        {!config ? (
          <div className="px-3 py-2 text-[11px] text-slate-600">配置加载中…</div>
        ) : (
          groups.map((group) => {
            const groupBoards = boards.filter((d) => d.group === group)
            if (!groupBoards.length) return null
            return (
              <div key={group} className="mb-2">
                {navOpen && (
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{group}</div>
                )}
                {groupBoards.map((d) => (
                  <button
                    key={d.uid}
                    type="button"
                    onClick={() => switchDashboard(d.uid)}
                    className={cn(
                      'block w-full truncate px-3 py-1.5 text-left text-xs transition-colors',
                      d.uid === activeUid
                        ? 'border-l-2 border-cyan-400 bg-[#0f1a30] text-cyan-300'
                        : 'border-l-2 border-transparent text-slate-400 hover:bg-[#0d1626] hover:text-slate-200',
                    )}
                    title={d.title}
                  >
                    {navOpen ? d.title : d.title.slice(0, 2)}
                  </button>
                ))}
              </div>
            )
          })
        )}
      </aside>

      {/* 主区域 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏 */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#16213a] bg-[#0a101f] px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-100">{dashboard?.title ?? '监控面板'}</h2>
          {dashboard && (
            <span className="rounded bg-[#0f1a30] px-1.5 py-0.5 text-[10px] text-slate-500">
              {filter.trim() ? `${panels.length}/${dashboard.panels.length}` : dashboard.panels.length} 面板
            </span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="筛选面板…"
                className="w-32 rounded border border-[#1b2a45] bg-[#0b1220] py-1 pl-7 pr-2 text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
              />
            </div>
            <div className="flex overflow-hidden rounded border border-[#1b2a45]">
              {RANGES.map((r) => (
                <button
                  key={r.seconds}
                  type="button"
                  onClick={() => setRangeSec(r.seconds)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] transition-colors',
                    rangeSec === r.seconds ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={cn(
                'flex items-center gap-1 rounded border px-2 py-1 text-[11px]',
                autoRefresh
                  ? 'border-cyan-500/40 text-cyan-300'
                  : 'border-[#1b2a45] text-slate-500 hover:text-slate-300',
              )}
            >
              <RefreshCw className={cn('h-3 w-3', autoRefresh && 'animate-spin')} style={autoRefresh ? { animationDuration: '3s' } : undefined} />
              {autoRefresh ? `${countdown}s` : '已暂停'}
            </button>
            <button
              type="button"
              onClick={() => dashboard && void load(dashboard, rangeSec)}
              disabled={loading || !dashboard}
              className="rounded border border-[#1b2a45] px-2 py-1 text-[11px] text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-50"
            >
              刷新
            </button>
            {updatedAt && (
              <span className="text-[10px] text-slate-600">更新于 {updatedAt.toLocaleTimeString('zh-CN', { hour12: false })}</span>
            )}
          </div>
        </div>

        {pageError && (
          <div className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-1.5 text-[11px] text-amber-400">{pageError}</div>
        )}

        {/* 面板网格 */}
        <div className="flex-1 overflow-y-auto p-4">
          {!dashboard ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">配置加载中…</div>
          ) : panels.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">无匹配「{filter}」的面板</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {panels.map((p) => {
                const pi = dashboard.panels.indexOf(p)
                return <PanelCard key={p.id} panel={p} panelIdx={pi} results={results} loading={loading} />
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
