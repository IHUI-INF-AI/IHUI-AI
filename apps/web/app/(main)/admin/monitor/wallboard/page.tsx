// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 生产在线端监控大屏(/admin/monitor/wallboard)。
 *
 * 数据面:GET /api/admin/ops-wallboard/overview(5s 轮询)+ /ops-wallboard/trend(20s 轮询)。
 * 视觉定位:控制中心/工业 HUD —— 深空蓝底 + 青色辉光描边 + 切角面板 + 等宽数字,
 * 固定深色(不随站点主题),适配值班室大屏长时间挂机。
 */
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Bell,
  Clock3,
  Cpu,
  Database,
  Gauge,
  HardDrive,
  Radio,
  Server,
  ShieldAlert,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { EChart } from '@/components/charts/EChart'
import { cn } from '@/lib/utils'
import { BackButton } from '@/components/common'
import type { EChartsOption } from 'echarts'

// ===================== 类型(与 apps/api/src/routes/admin-ops-wallboard.ts 对齐) =====================

interface HostSnapshot {
  cpuPct: number | null
  memTotalBytes: number | null
  memFreeBytes: number | null
  memPct: number | null
  disks: Array<{ volume: string; sizeBytes: number; freeBytes: number; usedPct: number }>
  netRxBytesPerSec: number | null
  netTxBytesPerSec: number | null
  bootTimeEpochSec: number | null
}

interface ServicesSnapshot {
  windows: Array<{ name: string; state: string }>
  targets: Array<{ job: string; instance: string; up: number }>
  windowsTotal: number
  windowsRunning: number
  targetsTotal: number
  targetsUp: number
}

interface HttpSnapshot {
  qps: number | null
  errRate: number | null
  p95ApiMs: number | null
  p95AiMs: number | null
  statusRates: Array<{ klass: string; rate: number }>
  uptimeSeconds: Array<{ job: string; seconds: number }>
  wsConnections: number | null
  activeConnections: number | null
  aiActiveSessions: number | null
}

interface RedisSnapshot {
  clients: number | null
  memUsedBytes: number | null
  memMaxBytes: number | null
  keys: number | null
  hitRatio: number | null
  opsPerSec: number | null
  evicted: number | null
  uptimeSeconds: number | null
}

interface PgSnapshot {
  backends: number | null
  sizeBytes: number | null
  hitRatio: number | null
  commitPerSec: number | null
  tupReturnedPerSec: number | null
  tupFetchedPerSec: number | null
}

interface BridgeSnapshot {
  alertsReceived: number | null
  mailDelivered: number | null
  mailUndelivered: boolean | null
  dedupSuppressed: number | null
}

interface BusinessSnapshot {
  usersTotal: number
  usersTodayNew: number
  usersActive: number
  ordersTodayPaid: number
  ordersTodayAmountCents: number
  ordersYesterdayPaid: number
  apiCallsToday: number
  apiErrRate: number
  apiAvgLatencyMs: number
  topEndpoints: Array<{ path: string; method: string; calls: number }>
  llmCallsToday: number
  llmTokensToday: number
  llmCostCentsToday: number
  llmErrRate: number
  llmP95LatencyMs: number
  llmTopModels: Array<{ model: string; calls: number }>
}

interface ActiveAlert {
  name: string
  severity: string
  state: string
  since: string
  summary: string | null
}

interface AlertItem {
  name: string
  source: string
  severity: string
  status: string
  message: string | null
  firedAt: string
  resolvedAt: string | null
}

interface AlertsSnapshot {
  promActive: ActiveAlert[] | null
  promActiveCount: number | null
  firingTotal: number
  recent: AlertItem[]
}

interface EventItem {
  type: string
  level: string
  message: string
  createdAt: string
}

interface OverviewPayload {
  generatedAt: string
  prometheusUrl: string
  sources: { prometheus: string; alertmanager: string; database: string }
  host: HostSnapshot | null
  services: ServicesSnapshot | null
  http: HttpSnapshot | null
  redis: RedisSnapshot | null
  pg: PgSnapshot | null
  bridge: BridgeSnapshot | null
  business: BusinessSnapshot | null
  alerts: AlertsSnapshot | null
  events: EventItem[] | null
}

interface TrendPayload {
  startEpochMs: number
  endEpochMs: number
  stepSeconds: number
  qps: Array<[number, number]>
  errRate: Array<[number, number]>
  cpuPct: Array<[number, number]>
  memPct: Array<[number, number]>
  p95Ms: Array<[number, number]>
  hourlyCalls: Array<{ hour: string; calls: number }>
}

// ===================== 展示工具 =====================

function fmtInt(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString('zh-CN')
}

function fmtCompact(n: number | null | undefined, digits = 1): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e8) return `${(n / 1e8).toFixed(digits)}亿`
  if (abs >= 1e4) return `${(n / 1e4).toFixed(digits)}万`
  return fmtInt(n)
}

function fmtBytes(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)}${units[i]}`
}

function fmtRate(bytesPerSec: number | null | undefined): string {
  if (typeof bytesPerSec !== 'number' || !Number.isFinite(bytesPerSec)) return '—'
  return `${fmtBytes(bytesPerSec)}/s`
}

function fmtPct(v: number | null | undefined, digits = 2): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return `${v.toFixed(digits)}%`
}

function fmtDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  if (d > 0) return `${d}天${h}小时`
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}小时${m}分` : `${m}分`
}

function fmtClock(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('zh-CN', { hour12: false })
}

function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diff = Date.now() - t
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}秒前`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`
  return `${Math.floor(diff / 86_400_000)}天前`
}

function fmtClockDigits(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

// ===================== 迷你 UI 构件(切角面板/状态点/迷你条) =====================

function Panel({
  title,
  icon,
  right,
  className,
  bodyClassName,
  children,
}: {
  title: string
  icon?: React.ReactNode
  right?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        'wb-panel relative flex min-h-0 flex-col rounded-sm border border-[rgba(72,146,196,0.22)] bg-[rgba(10,21,38,0.72)]',
        className,
      )}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-[rgba(72,146,196,0.16)] px-3 py-2">
        <span className="h-3 w-[3px] rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
        {icon ? <span className="text-cyan-200/70">{icon}</span> : null}
        <h2 className="wb-display text-[13px] font-semibold tracking-[0.18em] text-slate-100 uppercase">
          {title}
        </h2>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </header>
      <div className={cn('min-h-0 flex-1 overflow-hidden p-3', bodyClassName)}>{children}</div>
    </section>
  )
}

function Dot({ tone }: { tone: 'ok' | 'warn' | 'bad' | 'idle' }) {
  const color =
    tone === 'ok'
      ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]'
      : tone === 'warn'
        ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]'
        : tone === 'bad'
          ? 'bg-red-500 shadow-[0_0_6px_rgba(248,113,113,0.9)]'
          : 'bg-slate-500'
  return <span className={cn('inline-block h-1.5 w-1.5 rounded-full', color)} />
}

function MiniBar({ pct, tone }: { pct: number; tone?: 'ok' | 'warn' | 'bad' }) {
  const t = tone ?? (pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : 'ok')
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(72,146,196,0.18)]">
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-700',
          t === 'bad'
            ? 'bg-gradient-to-r from-red-500 to-amber-400'
            : t === 'warn'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-300'
              : 'bg-gradient-to-r from-cyan-400 to-emerald-400',
        )}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  )
}

function StatCell({
  label,
  value,
  unit,
  tone,
}: {
  label: string
  value: string
  unit?: string
  tone?: 'ok' | 'warn' | 'bad' | 'accent'
}) {
  return (
    <div className="rounded-sm border border-[rgba(72,146,196,0.16)] bg-[rgba(20,36,60,0.5)] px-2.5 py-2">
      <div className="text-[10px] tracking-[0.12em] text-slate-400">{label}</div>
      <div
        className={cn(
          'wb-num mt-0.5 text-[18px] leading-tight font-semibold',
          tone === 'bad'
            ? 'text-red-400'
            : tone === 'warn'
              ? 'text-amber-300'
              : tone === 'accent'
                ? 'text-cyan-300'
                : 'text-slate-100',
        )}
      >
        {value}
        {unit ? <span className="ml-0.5 text-[11px] text-slate-400">{unit}</span> : null}
      </div>
    </div>
  )
}

// ===================== 取数 =====================

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

// ===================== 图表主题(与大屏深色底固定配套) =====================

const AXIS = {
  axisLine: { lineStyle: { color: 'rgba(100,160,210,0.35)' } },
  axisLabel: { color: '#7c93ad', fontSize: 10 },
  splitLine: { lineStyle: { color: 'rgba(100,160,210,0.12)' } },
} as const

function seriesGlow(color: string) {
  return {
    itemStyle: { color },
    lineStyle: { color, width: 2 },
  }
}

// ===================== 页面 =====================

export default function OpsWallboardPage() {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const { data: ov, dataUpdatedAt } = useQuery({
    queryKey: ['admin', 'ops-wallboard', 'overview'],
    queryFn: () => fetchJson<OverviewPayload>('/api/admin/ops-wallboard/overview'),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  })
  const { data: trend } = useQuery({
    queryKey: ['admin', 'ops-wallboard', 'trend'],
    queryFn: () => fetchJson<TrendPayload>('/api/admin/ops-wallboard/trend?minutes=90&step=30'),
    refetchInterval: 20000,
  })

  const host = ov?.host ?? null
  const services = ov?.services ?? null
  const http = ov?.http ?? null
  const redis = ov?.redis ?? null
  const pg = ov?.pg ?? null
  const bridge = ov?.bridge ?? null
  const biz = ov?.business ?? null
  const alerts = ov?.alerts ?? null
  const events = ov?.events ?? null

  const alertCount = (alerts?.promActiveCount ?? 0) + (alerts?.firingTotal ?? 0)
  const overallTone: 'ok' | 'warn' | 'bad' =
    alertCount > 0 || (services && services.windowsRunning < services.windowsTotal)
      ? 'warn'
      : 'ok'

  // ---------- 图表 option ----------
  const trendOption = React.useMemo<EChartsOption>(() => {
    const labels = (trend?.qps ?? []).map(([ts]) =>
      new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
    )
    return {
      grid: { left: 42, right: 46, top: 26, bottom: 22 },
      legend: {
        data: ['QPS', '5xx 错误率(%)', 'P95(ms)'],
        textStyle: { color: '#8fa6bf', fontSize: 10 },
        top: 0,
        itemWidth: 14,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(8,18,33,0.92)',
        borderColor: 'rgba(72,146,196,0.35)',
        textStyle: { color: '#dbe7f3', fontSize: 11 },
      },
      xAxis: { type: 'category', data: labels, ...AXIS, boundaryGap: false },
      yAxis: [
        { type: 'value', name: 'req/s', nameTextStyle: { color: '#7c93ad' }, ...AXIS },
        {
          type: 'value',
          name: '%/ms',
          nameTextStyle: { color: '#7c93ad' },
          ...AXIS,
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'QPS',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: (trend?.qps ?? []).map(([, v]) => Number(v.toFixed(2))),
          ...seriesGlow('#22d3ee'),
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(34,211,238,0.35)' },
                { offset: 1, color: 'rgba(34,211,238,0.02)' },
              ],
            },
          },
        },
        {
          name: '5xx 错误率(%)',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          showSymbol: false,
          data: (trend?.errRate ?? []).map(([, v]) => Number((v * 100).toFixed(3))),
          ...seriesGlow('#f87171'),
        },
        {
          name: 'P95(ms)',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          showSymbol: false,
          data: (trend?.p95Ms ?? []).map(([, v]) => Number(v.toFixed(1))),
          ...seriesGlow('#fbbf24'),
        },
      ],
    }
  }, [trend])

  const gaugeOption = React.useMemo<EChartsOption>(
    () => ({
      series: [
        {
          type: 'gauge',
          center: ['25%', '56%'],
          radius: '78%',
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          progress: { show: true, width: 8, itemStyle: { color: '#22d3ee' } },
          axisLine: { lineStyle: { width: 8, color: [[1, 'rgba(72,146,196,0.22)']] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          title: { offsetCenter: [0, '34%'], color: '#8fa6bf', fontSize: 11 },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '2%'],
            color: '#e6f2ff',
            fontSize: 22,
            fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
            formatter: '{value}%',
          },
          data: [{ value: host?.cpuPct ?? 0, name: 'CPU' }],
        },
        {
          type: 'gauge',
          center: ['75%', '56%'],
          radius: '78%',
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          progress: { show: true, width: 8, itemStyle: { color: '#a78bfa' } },
          axisLine: { lineStyle: { width: 8, color: [[1, 'rgba(72,146,196,0.22)']] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          title: { offsetCenter: [0, '34%'], color: '#8fa6bf', fontSize: 11 },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '2%'],
            color: '#e6f2ff',
            fontSize: 22,
            fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
            formatter: '{value}%',
          },
          data: [{ value: host?.memPct ?? 0, name: '内存' }],
        },
      ],
    }),
    [host?.cpuPct, host?.memPct],
  )

  const statusOption = React.useMemo<EChartsOption>(() => {
    const klassColor: Record<string, string> = {
      '2xx': '#34d399',
      '3xx': '#22d3ee',
      '4xx': '#fbbf24',
      '5xx': '#f87171',
      other: '#64748b',
    }
    const data = (http?.statusRates ?? []).map((s) => ({
      name: s.klass,
      value: Number(s.rate.toFixed(3)),
      itemStyle: { color: klassColor[s.klass] ?? '#64748b' },
    }))
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(8,18,33,0.92)',
        borderColor: 'rgba(72,146,196,0.35)',
        textStyle: { color: '#dbe7f3', fontSize: 11 },
      },
      series: [
        {
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '52%'],
          label: { color: '#8fa6bf', fontSize: 10, formatter: '{b}\n{c}/s' },
          labelLine: { lineStyle: { color: 'rgba(120,160,200,0.35)' } },
          itemStyle: { borderColor: 'rgba(10,21,38,0.9)', borderWidth: 2 },
          data,
        },
      ],
    }
  }, [http?.statusRates])

  const hourlyOption = React.useMemo<EChartsOption>(() => {
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
    const byHour = new Map((trend?.hourlyCalls ?? []).map((r) => [r.hour, r.calls]))
    return {
      grid: { left: 40, right: 12, top: 16, bottom: 22 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(8,18,33,0.92)',
        borderColor: 'rgba(72,146,196,0.35)',
        textStyle: { color: '#dbe7f3', fontSize: 11 },
      },
      xAxis: { type: 'category', data: hours, ...AXIS },
      yAxis: { type: 'value', ...AXIS },
      series: [
        {
          type: 'bar',
          data: hours.map((h) => byHour.get(h) ?? 0),
          barWidth: '62%',
          itemStyle: {
            borderRadius: [2, 2, 0, 0],
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(34,211,238,0.95)' },
                { offset: 1, color: 'rgba(34,211,238,0.15)' },
              ],
            },
          },
        },
      ],
    }
  }, [trend?.hourlyCalls])

  const modelOption = React.useMemo<EChartsOption>(() => {
    const models = [...(biz?.llmTopModels ?? [])].reverse()
    return {
      grid: { left: 8, right: 40, top: 6, bottom: 6, containLabel: true },
      tooltip: {
        backgroundColor: 'rgba(8,18,33,0.92)',
        borderColor: 'rgba(72,146,196,0.35)',
        textStyle: { color: '#dbe7f3', fontSize: 11 },
      },
      xAxis: { type: 'value', ...AXIS, splitLine: { show: false }, axisLabel: { show: false } },
      yAxis: {
        type: 'category',
        data: models.map((m) => m.model),
        ...AXIS,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#9db4cd', fontSize: 10, width: 120, overflow: 'truncate' },
      },
      series: [
        {
          type: 'bar',
          data: models.map((m) => m.calls),
          barWidth: 12,
          label: { show: true, position: 'right', color: '#8fa6bf', fontSize: 10 },
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: 'rgba(167,139,250,0.35)' },
                { offset: 1, color: '#a78bfa' },
              ],
            },
          },
        },
      ],
    }
  }, [biz?.llmTopModels])

  // ---------- 渲染 ----------
  return (
    <div className="wb-root min-h-full bg-[#060c17] px-0 text-slate-200">
      <style>{WALLBOARD_CSS}</style>

      {/* ===== 顶部横梁 ===== */}
      <header className="wb-header sticky top-0 z-20 flex items-center gap-4 border-b border-[rgba(72,146,196,0.28)] bg-[rgba(6,12,23,0.92)] px-5 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <BackButton />
          <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-cyan-400/40 bg-cyan-400/10 shadow-[0_0_18px_rgba(34,211,238,0.35)]">
            <Gauge className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <h1 className="wb-display text-[17px] leading-tight font-bold tracking-[0.22em] text-slate-50">
              IHUI AI · 生产在线监控大屏
            </h1>
            <p className="text-[10px] tracking-[0.3em] text-cyan-200/60 uppercase">
              Production Operations Wallboard · Live
            </p>
          </div>
        </div>

        <div className="mx-2 hidden items-center gap-2 lg:flex">
          {(
            [
              ['Prometheus', ov?.sources.prometheus],
              ['Alertmanager', ov?.sources.alertmanager],
              ['Database', ov?.sources.database],
            ] as Array<[string, string | undefined]>
          ).map(([name, state]) => (
            <span
              key={name}
              className="flex items-center gap-1.5 rounded-sm border border-[rgba(72,146,196,0.22)] bg-[rgba(20,36,60,0.55)] px-2 py-1 text-[10px] text-slate-300"
            >
              <Dot tone={state === 'up' ? 'ok' : 'bad'} />
              {name}
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px]',
              overallTone === 'ok'
                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                : 'border-amber-400/40 bg-amber-400/10 text-amber-300',
            )}
          >
            <Dot tone={overallTone} />
            {overallTone === 'ok' ? '全域正常' : '存在告警'}
          </span>
          <span className="flex items-center gap-1.5 rounded-sm border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-300">
            <Bell className="h-3 w-3" />
            告警 {alertCount}
          </span>
          <div className="text-right">
            <div className="wb-num text-[15px] leading-tight font-semibold text-slate-100">
              {fmtClockDigits(now)}
            </div>
            <div className="text-[9px] tracking-[0.2em] text-slate-500">
              刷新于 {dataUpdatedAt ? fmtClock(new Date(dataUpdatedAt).toISOString()) : '—'} · 5s 轮询
            </div>
          </div>
        </div>
      </header>

      {/* ===== KPI 带 ===== */}
      <section className="grid grid-cols-2 gap-2.5 px-4 pt-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          {
            icon: <Activity className="h-4 w-4" />,
            label: '实时 QPS',
            value: typeof http?.qps === 'number' ? http.qps.toFixed(2) : '—',
            sub: `活跃连接 ${fmtInt(http?.activeConnections)}`,
            tone: 'accent' as const,
          },
          {
            icon: <ShieldAlert className="h-4 w-4" />,
            label: '5xx 错误率',
            value: typeof http?.errRate === 'number' ? fmtPct(http.errRate * 100, 3) : '—',
            sub: '近 5 分钟窗口',
            tone: (http?.errRate ?? 0) > 0.01 ? ('bad' as const) : ('ok' as const),
          },
          {
            icon: <Clock3 className="h-4 w-4" />,
            label: 'API P95 延迟',
            value: typeof http?.p95ApiMs === 'number' ? fmtInt(http.p95ApiMs) : '—',
            unit: 'ms',
            sub: `AI 服务 P95 ${typeof http?.p95AiMs === 'number' ? fmtInt(http.p95AiMs) : '—'}ms`,
            tone: 'ok' as const,
          },
          {
            icon: <Users className="h-4 w-4" />,
            label: '用户总数',
            value: fmtInt(biz?.usersTotal),
            sub: `今日新增 ${fmtInt(biz?.usersTodayNew)}`,
            tone: 'accent' as const,
          },
          {
            icon: <Wallet className="h-4 w-4" />,
            label: '今日成交',
            value: biz ? (biz.ordersTodayAmountCents / 100).toLocaleString('zh-CN') : '—',
            unit: '元',
            sub: `已付订单 ${fmtInt(biz?.ordersTodayPaid)} 笔`,
            tone: 'ok' as const,
          },
          {
            icon: <Sparkles className="h-4 w-4" />,
            label: '今日 AI 调用',
            value: fmtCompact(biz?.llmCallsToday),
            sub: `Token ${fmtCompact(biz?.llmTokensToday)}`,
            tone: 'accent' as const,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="wb-panel wb-rise relative overflow-hidden rounded-sm border border-[rgba(72,146,196,0.22)] bg-[rgba(10,21,38,0.72)] px-3 py-2.5"
          >
            <div className="flex items-center gap-2 text-[10px] tracking-[0.16em] text-slate-400">
              <span className="text-cyan-200/70">{k.icon}</span>
              {k.label}
            </div>
            <div
              className={cn(
                'wb-num mt-1 text-[26px] leading-none font-bold',
                k.tone === 'bad'
                  ? 'text-red-400'
                  : k.tone === 'accent'
                    ? 'text-cyan-300'
                    : 'text-emerald-300',
              )}
            >
              {k.value}
              {k.unit ? <span className="ml-1 text-[12px] text-slate-400">{k.unit}</span> : null}
            </div>
            <div className="mt-1 text-[10px] text-slate-500">{k.sub}</div>
          </div>
        ))}
      </section>

      {/* ===== 主体网格 ===== */}
      <section className="grid grid-cols-1 gap-2.5 p-4 xl:grid-cols-12">
        {/* 主机资源 */}
        <Panel
          title="主机资源 HOST"
          icon={<Cpu className="h-3.5 w-3.5" />}
          className="xl:col-span-3"
          right={
            <span className="text-[10px] text-slate-500">
              运行 {fmtDuration(host ? (Date.now() / 1000 - (host.bootTimeEpochSec ?? 0)) : null)}
            </span>
          }
        >
          <EChart option={gaugeOption} height={150} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <StatCell
              label="物理内存"
              value={`${fmtBytes(typeof host?.memTotalBytes === 'number' && typeof host?.memFreeBytes === 'number' ? host.memTotalBytes - host.memFreeBytes : null)} / ${fmtBytes(host?.memTotalBytes)}`}
            />
            <StatCell
              label="网络吞吐"
              value={`↓ ${fmtRate(host?.netRxBytesPerSec)}`}
              unit={`↑ ${fmtRate(host?.netTxBytesPerSec)}`}
              tone="accent"
            />
          </div>
          <div className="mt-2.5 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] tracking-[0.14em] text-slate-400">
              <HardDrive className="h-3 w-3" /> 磁盘卷
            </div>
            {(host?.disks ?? []).map((d) => (
              <div key={d.volume}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="wb-num text-slate-300">{d.volume}</span>
                  <span className="text-slate-500">
                    {fmtBytes(d.sizeBytes - d.freeBytes)} / {fmtBytes(d.sizeBytes)}
                  </span>
                  <span
                    className={cn(
                      'wb-num',
                      d.usedPct >= 90
                        ? 'text-red-400'
                        : d.usedPct >= 75
                          ? 'text-amber-300'
                          : 'text-cyan-300',
                    )}
                  >
                    {fmtPct(d.usedPct, 1)}
                  </span>
                </div>
                <div className="mt-1">
                  <MiniBar pct={d.usedPct} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* 流量趋势 */}
        <Panel
          title="流量与延迟 TRAFFIC"
          icon={<Radio className="h-3.5 w-3.5" />}
          className="xl:col-span-6"
          right={<span className="text-[10px] text-slate-500">近 90 分钟 · 30s 粒度</span>}
          bodyClassName="flex flex-col gap-2"
        >
          <EChart option={trendOption} height={228} className="flex-1" />
          <div className="grid grid-cols-4 gap-2">
            <StatCell
              label="WS 长连接"
              value={fmtInt(http?.wsConnections)}
              unit="路"
              tone="accent"
            />
            <StatCell
              label="AI 活跃会话"
              value={fmtInt(http?.aiActiveSessions)}
              unit="个"
              tone="accent"
            />
            <StatCell
              label="API 今日调用"
              value={fmtCompact(biz?.apiCallsToday)}
              tone="ok"
            />
            <StatCell
              label="API 平均延迟"
              value={fmtInt(biz?.apiAvgLatencyMs)}
              unit="ms"
              tone="ok"
            />
          </div>
        </Panel>

        {/* 服务矩阵 */}
        <Panel
          title="服务矩阵 SERVICES"
          icon={<Server className="h-3.5 w-3.5" />}
          className="xl:col-span-3"
          right={
            <span className="text-[10px] text-slate-500">
              {services ? `${services.windowsRunning}/${services.windowsTotal} 运行中` : '—'}
            </span>
          }
          bodyClassName="overflow-y-auto"
        >
          <div className="space-y-1">
            {(services?.windows ?? []).map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between rounded-sm border border-transparent bg-[rgba(20,36,60,0.42)] px-2 py-[5px] transition-colors hover:border-[rgba(72,146,196,0.3)]"
              >
                <span className="wb-num truncate text-[11px] text-slate-300">{s.name}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <Dot tone={s.state === 'running' ? 'ok' : s.state === 'stopped' ? 'bad' : 'warn'} />
                  <span
                    className={cn(
                      'text-[10px]',
                      s.state === 'running'
                        ? 'text-emerald-300/90'
                        : s.state === 'stopped'
                          ? 'text-red-400'
                          : 'text-amber-300',
                    )}
                  >
                    {s.state === 'running' ? '运行' : s.state === 'stopped' ? '已停' : s.state}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-[rgba(72,146,196,0.14)] pt-2">
            <div className="mb-1.5 text-[10px] tracking-[0.14em] text-slate-400">
              抓取目标({services ? `${services.targetsUp}/${services.targetsTotal}` : '—'} 在线)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(services?.targets ?? []).map((t) => (
                <span
                  key={`${t.job}-${t.instance}`}
                  className={cn(
                    'flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px]',
                    t.up === 1
                      ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200/90'
                      : 'border-red-400/30 bg-red-500/10 text-red-300',
                  )}
                  title={t.instance}
                >
                  <Dot tone={t.up === 1 ? 'ok' : 'bad'} />
                  {t.job}
                </span>
              ))}
            </div>
          </div>
        </Panel>

        {/* 状态码分布 + 分时调用 */}
        <Panel
          title="请求质量 QUALITY"
          icon={<Gauge className="h-3.5 w-3.5" />}
          className="xl:col-span-4"
          bodyClassName="flex flex-col gap-1"
        >
          <EChart option={statusOption} height={172} />
          <div className="mt-1 text-[10px] tracking-[0.14em] text-slate-400">今日 24 小时调用分布</div>
          <EChart option={hourlyOption} height={116} />
        </Panel>

        {/* 告警与事件 */}
        <Panel
          title="告警与事件 ALERTS"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          className="xl:col-span-5"
          right={
            <span className="flex items-center gap-2 text-[10px] text-slate-500">
              <span>邮件通道 {bridge?.mailUndelivered === false ? '正常' : '注意'}</span>
              <span>抑制 {fmtInt(bridge?.dedupSuppressed)}</span>
            </span>
          }
          bodyClassName="grid grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2"
        >
          <div>
            <div className="mb-1.5 text-[10px] tracking-[0.14em] text-slate-400">
              活跃告警(Alertmanager)
            </div>
            <div className="space-y-1.5">
              {(alerts?.promActive ?? []).slice(0, 5).map((a, i) => (
                <div
                  key={`${a.name}-${i}`}
                  className="rounded-sm border border-red-400/25 bg-red-500/[0.08] px-2 py-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <Dot tone={a.severity === 'critical' ? 'bad' : 'warn'} />
                    <span className="truncate text-[11px] font-medium text-red-200">{a.name}</span>
                    <span className="ml-auto shrink-0 text-[9px] text-slate-500">
                      {fmtAgo(a.since)}
                    </span>
                  </div>
                  {a.summary ? (
                    <div className="mt-0.5 truncate text-[10px] text-slate-400">{a.summary}</div>
                  ) : null}
                </div>
              ))}
              {alerts?.promActiveCount === 0 ? (
                <div className="rounded-sm border border-emerald-400/20 bg-emerald-400/[0.06] px-2 py-3 text-center text-[11px] text-emerald-300/90">
                  当前无活跃告警
                </div>
              ) : null}
              {alerts?.promActive === null || alerts?.promActive === undefined ? (
                <div className="rounded-sm border border-amber-400/20 bg-amber-400/[0.06] px-2 py-3 text-center text-[11px] text-amber-200/90">
                  Alertmanager 数据不可用
                </div>
              ) : null}
            </div>
            <div className="mt-2 mb-1.5 text-[10px] tracking-[0.14em] text-slate-400">
              最近告警记录(库内)
            </div>
            <div className="space-y-1">
              {(alerts?.recent ?? []).slice(0, 4).map((a, i) => (
                <div key={`${a.name}-${i}`} className="flex items-center gap-1.5 text-[10px]">
                  <Dot tone={a.status === 'firing' ? 'bad' : 'ok'} />
                  <span className="truncate text-slate-300">{a.name}</span>
                  <span className="ml-auto shrink-0 text-slate-500">{fmtAgo(a.firedAt)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[10px] tracking-[0.14em] text-slate-400">系统事件流</div>
            <div className="space-y-1">
              {(events ?? []).map((e, i) => (
                <div
                  key={`${e.createdAt}-${i}`}
                  className="rounded-sm border border-transparent bg-[rgba(20,36,60,0.42)] px-2 py-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <Dot
                      tone={
                        e.level === 'error' || e.level === 'critical'
                          ? 'bad'
                          : e.level === 'warning'
                            ? 'warn'
                            : 'ok'
                      }
                    />
                    <span className="shrink-0 text-[9px] tracking-[0.12em] text-cyan-200/80 uppercase">
                      {e.type}
                    </span>
                    <span className="ml-auto shrink-0 text-[9px] text-slate-500">
                      {fmtClock(e.createdAt)}
                    </span>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[10px] text-slate-400">{e.message}</div>
                </div>
              ))}
              {events && events.length === 0 ? (
                <div className="px-2 py-3 text-center text-[11px] text-slate-500">暂无事件</div>
              ) : null}
            </div>
          </div>
        </Panel>

        {/* 数据层 */}
        <Panel
          title="数据层 DATASTORE"
          icon={<Database className="h-3.5 w-3.5" />}
          className="xl:col-span-3"
          bodyClassName="flex flex-col gap-2"
        >
          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] tracking-[0.14em] text-slate-400">
              <span>PostgreSQL</span>
              <span className="text-slate-500">连接 {fmtInt(pg?.backends)}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <StatCell label="库体积" value={fmtBytes(pg?.sizeBytes)} tone="accent" />
              <StatCell
                label="缓冲命中率"
                value={typeof pg?.hitRatio === 'number' ? fmtPct(pg.hitRatio * 100, 1) : '—'}
                tone={(pg?.hitRatio ?? 1) >= 0.95 ? 'ok' : 'warn'}
              />
              <StatCell label="事务/秒" value={fmtInt(pg?.commitPerSec)} />
              <StatCell label="行返回/秒" value={fmtInt(pg?.tupReturnedPerSec)} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] tracking-[0.14em] text-slate-400">
              <span>Redis</span>
              <span className="text-slate-500">
                内存 {fmtBytes(redis?.memUsedBytes)}
                {redis?.memMaxBytes ? ` / ${fmtBytes(redis.memMaxBytes)}` : ''}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <StatCell label="客户端" value={fmtInt(redis?.clients)} tone="accent" />
              <StatCell label="键数" value={fmtInt(redis?.keys)} />
              <StatCell
                label="命中率"
                value={typeof redis?.hitRatio === 'number' ? fmtPct(redis.hitRatio * 100, 1) : '—'}
                tone={(redis?.hitRatio ?? 1) >= 0.8 ? 'ok' : 'warn'}
              />
              <StatCell label="命令/秒" value={fmtInt(redis?.opsPerSec)} />
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] tracking-[0.14em] text-slate-400">
              LLM 会话 · 告警桥
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <StatCell
                label="今日 LLM 调用"
                value={fmtCompact(biz?.llmCallsToday)}
                tone="accent"
              />
              <StatCell
                label="LLM 失败率"
                value={biz ? fmtPct(biz.llmErrRate, 2) : '—'}
                tone={(biz?.llmErrRate ?? 0) > 5 ? 'bad' : 'ok'}
              />
              <StatCell
                label="LLM P95"
                value={biz ? fmtInt(biz.llmP95LatencyMs) : '—'}
                unit="ms"
              />
              <StatCell
                label="计费成本"
                value={biz ? (biz.llmCostCentsToday / 100).toFixed(2) : '—'}
                unit="元"
                tone="warn"
              />
            </div>
          </div>
        </Panel>

        {/* 业务纵深 */}
        <Panel
          title="业务纵深 BUSINESS"
          icon={<Wallet className="h-3.5 w-3.5" />}
          className="xl:col-span-5"
          bodyClassName="grid grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2"
        >
          <div>
            <div className="mb-1.5 text-[10px] tracking-[0.14em] text-slate-400">
              今日高频接口 TOP5
            </div>
            <div className="space-y-1">
              {(biz?.topEndpoints ?? []).map((e, i) => (
                <div
                  key={`${e.method}-${e.path}-${i}`}
                  className="flex items-center gap-2 rounded-sm bg-[rgba(20,36,60,0.42)] px-2 py-1"
                >
                  <span className="wb-num w-4 text-[10px] text-slate-500">{i + 1}</span>
                  <span className="shrink-0 rounded-sm border border-cyan-400/25 px-1 text-[9px] text-cyan-200/90">
                    {e.method}
                  </span>
                  <span className="truncate text-[10px] text-slate-300" title={e.path}>
                    {e.path}
                  </span>
                  <span className="wb-num ml-auto shrink-0 text-[10px] text-cyan-300">
                    {fmtCompact(e.calls)}
                  </span>
                </div>
              ))}
              {biz && biz.topEndpoints.length === 0 ? (
                <div className="px-2 py-3 text-center text-[11px] text-slate-500">今日暂无调用</div>
              ) : null}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <StatCell label="注册用户" value={fmtInt(biz?.usersTotal)} tone="accent" />
              <StatCell label="正常用户" value={fmtInt(biz?.usersActive)} />
              <StatCell label="今日新增" value={fmtInt(biz?.usersTodayNew)} tone="ok" />
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[10px] tracking-[0.14em] text-slate-400">
              今日模型调用分布 TOP5
            </div>
            <EChart option={modelOption} height={148} />
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <StatCell
                label="今日订单"
                value={fmtInt(biz?.ordersTodayPaid)}
                unit="笔"
                tone="accent"
              />
              <StatCell
                label="昨日订单"
                value={fmtInt(biz?.ordersYesterdayPaid)}
                unit="笔"
              />
              <StatCell
                label="告警桥收信"
                value={fmtInt(bridge?.mailDelivered)}
                unit="封"
                tone={bridge?.mailUndelivered ? 'bad' : 'ok'}
              />
            </div>
          </div>
        </Panel>
      </section>

      <footer className="flex items-center justify-between border-t border-[rgba(72,146,196,0.16)] px-5 py-2 text-[10px] text-slate-600">
        <span>
          数据源 · Prometheus {ov?.prometheusUrl ?? '—'} / Alertmanager / PostgreSQL / Redis ·
          全部为生产在线端实时采集
        </span>
        <span className="wb-num">
          UPTIME ·{' '}
          {(http?.uptimeSeconds ?? [])
            .map((u) => `${u.job} ${fmtDuration(u.seconds)}`)
            .join('  |  ') || '—'}
        </span>
      </footer>
    </div>
  )
}

// ===================== 大屏专属样式(切角/辉光/扫描线/等宽数字) =====================

const WALLBOARD_CSS = `
.wb-root {
  --wb-font-display: 'Bahnschrift', 'DIN Alternate', 'Oswald', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --wb-font-num: 'JetBrains Mono', 'Cascadia Mono', 'Consolas', 'Bahnschrift', monospace;
  background-image:
    radial-gradient(1100px 520px at 82% -12%, rgba(34, 211, 238, 0.11), transparent 60%),
    radial-gradient(880px 460px at 8% 108%, rgba(167, 139, 250, 0.09), transparent 62%),
    linear-gradient(rgba(72, 146, 196, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(72, 146, 196, 0.05) 1px, transparent 1px);
  background-size: auto, auto, 32px 32px, 32px 32px;
}
.wb-display { font-family: var(--wb-font-display); }
.wb-num {
  font-family: var(--wb-font-num);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
/* 切角面板 + 四角亮标 */
.wb-panel {
  clip-path: polygon(0 10px, 10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px));
  box-shadow: inset 0 0 24px rgba(34, 211, 238, 0.05), 0 8px 26px rgba(2, 8, 18, 0.5);
}
.wb-header::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.55), rgba(167, 139, 250, 0.4), transparent);
  animation: wb-scan 6s linear infinite;
}
@keyframes wb-scan {
  0% { transform: translateX(-30%); opacity: 0.5; }
  50% { transform: translateX(30%); opacity: 1; }
  100% { transform: translateX(-30%); opacity: 0.5; }
}
.wb-rise { animation: wb-rise 0.55s ease-out both; }
@keyframes wb-rise {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
.wb-root ::-webkit-scrollbar { width: 6px; height: 6px; }
.wb-root ::-webkit-scrollbar-thumb {
  background: rgba(72, 146, 196, 0.35);
  border-radius: 3px;
}
.wb-root ::-webkit-scrollbar-track { background: transparent; }
`
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
