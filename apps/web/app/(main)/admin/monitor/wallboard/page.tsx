// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'
import { isNum, isUnset, thresholdTone, type StatusTone } from './unknown-state'

/**
 * 生产在线端监控大屏(/admin/monitor/wallboard)。
 *
 * 数据面:GET /api/admin/ops-wallboard/overview(5s 轮询)+ /ops-wallboard/trend(20s 轮询)。
 * 视觉定位:控制中心/工业 HUD —— 圆角面板 + 等宽数字 + 辉光描边,
 * 配色全部走语义 token(bg-shell-panel/bg-card/border-border/success/warning/destructive/info),
 * 页面底不自带色块与网格线 —— 大屏直接坐在工作区自己的背景上,
 * 随站点明暗主题切换(ECharts 走 canvas 读不到 CSS var,按 resolvedTheme 显式切换,见下方图表主题)。
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Bell,
  Clock3,
  Cpu,
  Database,
  Gauge,
  Globe,
  HardDrive,
  Radio,
  Server,
  ShieldAlert,
  Sparkles,
  Unplug,
  Users,
  Wallet,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { EChart } from '@/components/charts/EChart'
import { cn } from '@/lib/utils'
import { BackButton } from '@/components/common'
// 悬停提示一律走项目 Tooltip(守门 18:禁用原生 HTML title 属性)
import { Tooltip, TooltipProvider } from '@/components/feedback'
import { useTheme } from 'next-themes'
import {
  CHART_AMBER,
  CHART_CYAN,
  CHART_GREEN,
  CHART_RED,
  CHART_VIOLET,
  chartAxis,
  chartBg,
  chartText,
  withAlpha,
} from '@ihui/design-tokens'
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
  windows: Array<{ name: string; state: string; retired: boolean }>
  targets: Array<{ job: string; instance: string; up: number }>
  windowsTotal: number
  windowsRunning: number
  windowsExpectedTotal: number
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

interface EdgeLegSnapshot {
  ok: boolean
  status: number | null
  totalMs: number | null
  ttfbMs: number | null
  bytes: number | null
  encoding: string | null
  edgeStatus: string | null
  edgeAgeSec: number | null
  landedViaEdgeOne: boolean
  reason: string | null
}

interface EdgeSnapshot {
  at: string
  ageSec: number
  stats: {
    samples: number
    hitRatio: number | null
    lastMs: number | null
    p50Ms: number | null
    p95Ms: number | null
    worstMs: number | null
    landedViaEdgeOne: boolean | null
  }
  legs: Record<'edgeHomepage' | 'apexRedirect' | 'edgeStatic' | 'originViaCf', EdgeLegSnapshot>
  series: Array<[number, number, boolean]>
}

interface SignInSnapshot {
  todayUsers: number
  todayRewardPoints: number
  maxStreakDays: number
  unsignedActiveUsers: number
  last7d: Array<{ date: string; users: number }>
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
  /** 签到快照:后端取不到时为 null(渲染"—"),老版本后端无此字段(undefined 同样走"—") */
  signIn?: SignInSnapshot | null
}

interface TrafficSnapshot {
  pv24h: number | null
  uv24h: number | null
  pv1h: number | null
  uv1h: number | null
  humanPv24h: number | null
  botPv24h: number | null
  families: Array<{ family: string; pv: number }>
  /** 这份快照距今多少秒(后端 5 秒缓存 + 5 秒轮询 ⇒ 常为 0..5);null = 整块取不到 */
  aggregationAgeSec: number | null
  truncated: boolean | null
}

interface RelayPoolSnapshot {
  keyTotal: number | null
  keySchedulable: number | null
  keyAbnormal: number | null
  accountsTotal: number | null
  accountsSchedulable: number | null
  minTokenExpiresInSeconds: number | null
  /** 这份快照距今多少秒(后端 5 秒缓存 + 5 秒轮询 ⇒ 常为 0..5) */
  staleAgeSec: number | null
  /** 账号最近一次刷新距今(秒);null = 没有任何账号带刷新戳 */
  accountRefreshAgeSec?: number | null
  /** 健康态不在封闭词表内、无法折叠的行数(非 0 = 库里有脏值) */
  rowsUnclassified?: number | null
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
  firingNames: string[]
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
  sources: { prometheus: string; alertmanager: string; database: string; edge: string }
  host: HostSnapshot | null
  services: ServicesSnapshot | null
  http: HttpSnapshot | null
  redis: RedisSnapshot | null
  pg: PgSnapshot | null
  bridge: BridgeSnapshot | null
  business: BusinessSnapshot | null
  alerts: AlertsSnapshot | null
  events: EventItem[] | null
  traffic?: TrafficSnapshot | null
  relayPool?: RelayPoolSnapshot | null
  edge: EdgeSnapshot | null
}

interface TrendPayload {
  startEpochMs: number
  endEpochMs: number
  stepSeconds: number
  minutes: number
  qps: Array<[number, number]>
  errRate: Array<[number, number]>
  cpuPct: Array<[number, number]>
  memPct: Array<[number, number]>
  p95Ms: Array<[number, number]>
  hourlyCalls: Array<{ hour: string; calls: number }>
}

// ===================== 展示工具 =====================

type WallboardT = ReturnType<typeof useTranslations<'admin.wallboard'>>

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

function fmtPct(v: number | null | undefined, digits = 2): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return `${v.toFixed(digits)}%`
}

function fmtClockDigits(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * 随语言变化的展示工具(人读文案走 t 的字面量键,数字走 locale)。
 * 每次渲染重建即可,调用点都在渲染期,不进依赖数组。
 */
function makeFmt(locale: string, t: WallboardT) {
  return {
    fmtInt(n: number | null | undefined): string {
      if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
      return Math.round(n).toLocaleString(locale)
    },
    fmtCompact(n: number | null | undefined): string {
      if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
      const abs = Math.abs(n)
      if (abs >= 1e4) return new Intl.NumberFormat(locale, { notation: 'compact' }).format(n)
      return Math.round(n).toLocaleString(locale)
    },
    fmtRate(bytesPerSec: number | null | undefined): string {
      if (typeof bytesPerSec !== 'number' || !Number.isFinite(bytesPerSec)) return '—'
      return `${fmtBytes(bytesPerSec)}/s`
    },
    fmtDuration(seconds: number | null | undefined): string {
      if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '—'
      // <60s 必须落到秒档:原实现直接落到「N分」⇒ 3 秒聚合龄显示成「0分」。
      if (seconds < 60) return t('durationSecs', { s: Math.max(0, Math.floor(seconds)) })
      const d = Math.floor(seconds / 86400)
      const h = Math.floor((seconds % 86400) / 3600)
      if (d > 0) return t('durationDays', { d, h })
      const m = Math.floor((seconds % 3600) / 60)
      return h > 0 ? t('durationHours', { h, m }) : t('durationMins', { m })
    },
    fmtClock(iso: string | null | undefined): string {
      if (!iso) return '—'
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return '—'
      return d.toLocaleTimeString(locale, { hour12: false })
    },
    fmtAgo(iso: string | null | undefined): string {
      if (!iso) return '—'
      const ts = new Date(iso).getTime()
      if (Number.isNaN(ts)) return '—'
      const diff = Date.now() - ts
      if (diff < 60_000) return t('agoSecs', { n: Math.max(1, Math.floor(diff / 1000)) })
      if (diff < 3_600_000) return t('agoMins', { n: Math.floor(diff / 60_000) })
      if (diff < 86_400_000) return t('agoHours', { n: Math.floor(diff / 3_600_000) })
      return t('agoDays', { n: Math.floor(diff / 86_400_000) })
    },
  }
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
        'ui-lift wb-panel relative flex min-h-0 flex-col rounded-xl border border-border bg-card/80',
        className,
      )}
    >
      <header className="flex shrink-0 items-center gap-2 px-3 pt-2 pb-1">
        <span className="h-3 w-[3px] rounded-full bg-info shadow-[0_0_8px_color-mix(in_srgb,var(--color-info)_80%,transparent)]" />
        {icon ? <span className="text-info-text/70">{icon}</span> : null}
        <h2 className="wb-display text-[13px] font-semibold tracking-[0.18em] text-foreground uppercase">
          {title}
        </h2>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </header>
      <div className={cn('min-h-0 flex-1 overflow-hidden p-3', bodyClassName)}>{children}</div>
    </section>
  )
}

function Dot({ tone }: { tone: StatusTone | 'idle' }) {
  const color =
    tone === 'ok'
      ? 'bg-success shadow-[0_0_6px_color-mix(in_srgb,var(--color-success)_90%,transparent)]'
      : tone === 'warn'
        ? 'bg-warning shadow-[0_0_6px_color-mix(in_srgb,var(--color-warning)_90%,transparent)]'
        : tone === 'bad'
          ? 'bg-destructive shadow-[0_0_6px_color-mix(in_srgb,var(--color-destructive)_90%,transparent)]'
          : tone === 'unknown'
            ? 'bg-muted-foreground/60'
            : 'bg-muted-foreground'
  return <span className={cn('inline-block h-1.5 w-1.5 rounded-full', color)} />
}

/** 数据源状态三态:未到数(undefined)必须落灰,不得默认染红(§0.3 未判定不冒充故障)。 */
function sourceTone(state: string | undefined): StatusTone | 'idle' {
  return state === 'up' ? 'ok' : state === 'down' ? 'bad' : 'unknown'
}

function MiniBar({ pct, tone }: { pct: number; tone?: 'ok' | 'warn' | 'bad' }) {
  const t = tone ?? (pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : 'ok')
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-700',
          t === 'bad'
            ? 'bg-gradient-to-r from-destructive to-warning'
            : t === 'warn'
              ? 'bg-gradient-to-r from-warning to-warning/70'
              : 'bg-gradient-to-r from-info to-success',
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
  tone?: StatusTone | 'accent'
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/60 px-2.5 py-2">
      <div className="text-[10px] tracking-[0.12em] text-muted-foreground">{label}</div>
      <div
        className={cn(
          'wb-num mt-0.5 text-[18px] leading-tight font-semibold',
          tone === 'bad'
            ? 'text-danger-text'
            : tone === 'warn'
              ? 'text-warning-text'
              : tone === 'accent'
                ? 'text-info-text'
                : tone === 'unknown'
                  ? 'text-muted-foreground'
                  : 'text-foreground',
        )}
      >
        {value}
        {unit ? <span className="ml-0.5 text-[11px] text-muted-foreground">{unit}</span> : null}
      </div>
    </div>
  )
}

/** 图表空数据占位(数据源无样本/未启用时盖在画布上,避免「空白=坏了」的误读)。 */
function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="rounded-md border border-border bg-card/80 px-2.5 py-1 text-[10px] text-muted-foreground">
        {text}
      </span>
    </div>
  )
}

/** 未知态唯一展示原语:暗色「—」+ Unplug 字形 + 不可达注记。 */
function SourceGap({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[10px] text-muted-foreground',
        className,
      )}
    >
      <span className="wb-num leading-none">—</span>
      <Unplug className="h-3 w-3 shrink-0 opacity-70" />
      <span className="leading-none">{text}</span>
    </span>
  )
}

// ===================== 取数 =====================

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

// ===================== 图表主题(跟随站点明暗主题) =====================
// ECharts 画在 canvas 上,读不到 CSS var()(AGENTS §3 技术约束):轴线/文字/tooltip 底取
// design-tokens 的 chartAxis/chartText/chartBg(JS 侧唯一真相源,逐位镜像 tokens.css 的
// --chart-axis / --chart-text),系列色取 --chart-N 色板;明暗由 resolvedTheme 显式切换
// 并计入各 option 的 useMemo 依赖,主题翻转即重建 option。

const AXIS = (isDark: boolean) => ({
  axisLine: { lineStyle: { color: chartAxis(isDark) } },
  axisLabel: { color: chartText(isDark), fontSize: 10 },
  splitLine: { lineStyle: { color: withAlpha(chartAxis(isDark), isDark ? 0.5 : 0.9) } },
})

/** 画布上的主读数前景(明暗两档,对齐 --color-foreground;canvas 读不到 var 故取字面色)。 */
const fg = (isDark: boolean): string => (isDark ? '#e6f2ff' : '#0f172a')

function seriesGlow(color: string) {
  return {
    itemStyle: { color },
    lineStyle: { color, width: 2 },
  }
}

// ===================== 页面 =====================

/** 监控大屏路由:统一落到监控面板页的大屏模式,由该页顶栏的切换器在两种呈现间切换。 */
export default function OpsWallboardPage() {
  const router = useRouter()
  React.useEffect(() => {
    router.replace('/admin/monitor/panels?view=wallboard')
  }, [router])
  return null
}

/**
 * 大屏呈现本体。顶栏右侧的 `headerExtra` 由承载页(监控面板页)注入两种呈现的切换器 ——
 * 本文件不 import 那个组件,以免与承载页形成循环引用。
 */
export function WallboardView({ headerExtra }: { headerExtra: React.ReactNode }) {
  const t = useTranslations('admin.wallboard')
  const locale = useLocale()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { fmtInt, fmtCompact, fmtRate, fmtDuration, fmtClock, fmtAgo } = makeFmt(locale, t)
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const {
    data: ov,
    dataUpdatedAt,
    isError: ovError,
    refetch: refetchOv,
  } = useQuery({
    queryKey: ['admin', 'ops-wallboard', 'overview'],
    queryFn: () => fetchJson<OverviewPayload>('/api/admin/ops-wallboard/overview'),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  })
  const {
    data: trend,
    isError: trendError,
    dataUpdatedAt: trendUpdatedAt,
    refetch: refetchTrend,
  } = useQuery({
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
  const traffic = ov?.traffic ?? null
  const relayPool = ov?.relayPool ?? null
  const edge = ov?.edge ?? null

  // 告警数 = Alertmanager 活跃 ∪ 库内 firing(按告警名去重):
  // 告警桥会把同一告警同步落库,两路直接相加会重复计数
  const promAlertNames = React.useMemo(
    () => new Set((alerts?.promActive ?? []).map((a) => a.name)),
    [alerts?.promActive],
  )
  const alertCount: number | null =
    alerts === null
      ? null
      : (alerts.promActiveCount ?? 0) +
        (alerts.firingNames ?? []).filter((n) => !promAlertNames.has(n)).length
  // 退役服务(见路由 RETIRED_SERVICES)不计入健康度分母,避免状态灯恒黄。
  // alerts 块或 services 块不可达 ⇒ 'unknown'(§0.3:「没判」不得渲染成「全域正常 / 0 告警」)。
  const overallTone: StatusTone =
    ov === undefined || alerts === null
      ? 'unknown'
      : alertCount !== null && alertCount > 0
        ? 'warn'
        : services === null
          ? 'unknown'
          : services.windowsRunning < services.windowsExpectedTotal
            ? 'warn'
            : 'ok'
  // overview 5s 轮询;数据年龄超过 3 个周期视为延迟,「刷新于」转琥珀提示
  const dataAgeMs = dataUpdatedAt ? now.getTime() - dataUpdatedAt : null
  const dataStale = dataAgeMs !== null && dataAgeMs > 15000
  // trend 20s 轮询;查询已坏或最后快照年龄 >3 个周期,面板必须挂「数据延迟」,
  // 不能让坏掉的趋势查询把旧快照一直渲染成实时
  const trendStale = trendError || (trendUpdatedAt !== 0 && now.getTime() - trendUpdatedAt > 60_000)

  // ---------- 图表 option ----------
  const trendOption = React.useMemo<EChartsOption>(() => {
    const labels = (trend?.qps ?? []).map(([ts]) =>
      new Date(ts).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    )
    // 错误率与 P95 量纲差三个数量级:共用一个右轴时错误率恒贴底(实测不可见)。
    // 错误率走隐藏的第三轴(0..实测峰值×1.2),只由 tooltip 读数,不占轴标签。
    const errPctMax = Math.max(0.1, ...(trend?.errRate ?? []).map(([, v]) => v * 100)) * 1.2
    return {
      grid: { left: 42, right: 46, top: 26, bottom: 22 },
      legend: {
        data: [t('legendQps'), t('legendErrRate'), t('legendP95')],
        textStyle: { color: chartText(isDark), fontSize: 10 },
        top: 0,
        itemWidth: 14,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: chartBg(isDark),
        borderColor: chartAxis(isDark),
        textStyle: { color: fg(isDark), fontSize: 11 },
      },
      xAxis: { type: 'category', data: labels, ...AXIS(isDark), boundaryGap: false },
      yAxis: [
        {
          type: 'value',
          name: t('axisReqPerSec'),
          nameTextStyle: { color: chartText(isDark) },
          ...AXIS(isDark),
        },
        {
          type: 'value',
          name: t('axisPctMs'),
          nameTextStyle: { color: chartText(isDark) },
          ...AXIS(isDark),
          splitLine: { show: false },
        },
        {
          type: 'value',
          min: 0,
          max: Number(errPctMax.toFixed(3)),
          show: false,
        },
      ],
      series: [
        {
          name: t('legendQps'),
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: (trend?.qps ?? []).map(([, v]) => Number(v.toFixed(2))),
          ...seriesGlow(CHART_CYAN),
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: withAlpha(CHART_CYAN, 0.35) },
                { offset: 1, color: withAlpha(CHART_CYAN, 0.02) },
              ],
            },
          },
        },
        {
          name: t('legendErrRate'),
          type: 'line',
          yAxisIndex: 2,
          smooth: true,
          showSymbol: false,
          data: (trend?.errRate ?? []).map(([, v]) => Number((v * 100).toFixed(3))),
          ...seriesGlow(CHART_RED),
        },
        {
          name: t('legendP95'),
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          showSymbol: false,
          data: (trend?.p95Ms ?? []).map(([, v]) => Number(v.toFixed(1))),
          ...seriesGlow(CHART_AMBER),
        },
      ],
    }
  }, [trend, locale, t, isDark])

  const gaugeOption = React.useMemo<EChartsOption>(() => {
    // 仪表读数:null(数据源不可达)显示「—」而不是 0%(0% 会被读成「空闲且健康」)
    const cpuValue =
      typeof host?.cpuPct === 'number' && Number.isFinite(host.cpuPct) ? host.cpuPct : null
    const memValue =
      typeof host?.memPct === 'number' && Number.isFinite(host.memPct) ? host.memPct : null
    return {
      series: [
        {
          type: 'gauge',
          center: ['25%', '56%'],
          radius: '78%',
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          progress: { show: true, width: 8, itemStyle: { color: CHART_CYAN } },
          axisLine: { lineStyle: { width: 8, color: [[1, chartAxis(isDark)]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          title: { offsetCenter: [0, '34%'], color: chartText(isDark), fontSize: 11 },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '2%'],
            color: cpuValue === null ? chartText(isDark) : fg(isDark),
            fontSize: 22,
            fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
            formatter: cpuValue === null ? () => '—' : '{value}%',
          },
          data: [{ value: cpuValue ?? 0, name: t('gaugeCpu') }],
        },
        {
          type: 'gauge',
          center: ['75%', '56%'],
          radius: '78%',
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          progress: { show: true, width: 8, itemStyle: { color: CHART_VIOLET } },
          axisLine: { lineStyle: { width: 8, color: [[1, chartAxis(isDark)]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          title: { offsetCenter: [0, '34%'], color: chartText(isDark), fontSize: 11 },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '2%'],
            color: memValue === null ? chartText(isDark) : fg(isDark),
            fontSize: 22,
            fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
            formatter: memValue === null ? () => '—' : '{value}%',
          },
          data: [{ value: memValue ?? 0, name: t('gaugeMem') }],
        },
      ],
    }
  }, [host?.cpuPct, host?.memPct, t, isDark])

  const statusOption = React.useMemo<EChartsOption>(() => {
    const klassColor: Record<string, string> = {
      '2xx': CHART_GREEN,
      '3xx': CHART_CYAN,
      '4xx': CHART_AMBER,
      '5xx': CHART_RED,
      other: chartText(isDark),
    }
    // 零占比类目不进环图(否则 legend/标签里挤出一串 0%);占比读数统一由右侧 legend 承担,
    // 环内只标 ≥10% 的类目 —— 2xx 常占 99%+,原先四个标签全挤在环外左上角且互相压字。
    const rows = (http?.statusRates ?? []).filter((s) => s.rate > 0)
    const total = rows.reduce((acc, s) => acc + s.rate, 0)
    const data = rows.map((s) => ({
      name: s.klass,
      value: Number(s.rate.toFixed(3)),
      itemStyle: { color: klassColor[s.klass] ?? chartText(isDark) },
    }))
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: chartBg(isDark),
        borderColor: chartAxis(isDark),
        textStyle: { color: fg(isDark), fontSize: 11 },
      },
      legend: {
        orient: 'vertical',
        right: 4,
        top: 'middle',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 8,
        textStyle: { color: chartText(isDark), fontSize: 10 },
        formatter: (name: string) => {
          const item = data.find((d) => d.name === name)
          const pct = item && total > 0 ? (item.value / total) * 100 : 0
          return `${name}  ${pct.toFixed(pct >= 10 ? 1 : 2)}%`
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['42%', '66%'],
          center: ['38%', '52%'],
          label: {
            show: true,
            position: 'inside',
            color: fg(true),
            fontSize: 10,
            formatter: (p) => ((p.percent ?? 0) >= 10 ? `${(p.percent ?? 0).toFixed(1)}%` : ''),
          },
          labelLine: { show: false },
          itemStyle: { borderColor: chartBg(isDark), borderWidth: 2 },
          data,
        },
      ],
    }
  }, [http?.statusRates, isDark])

  // 主机 CPU / 内存走势(补齐 trend.cpuPct / trend.memPct 两个已返回未上屏的序列)
  const hostTrendOption = React.useMemo<EChartsOption>(() => {
    const labels = (trend?.cpuPct ?? []).map(([ts]) =>
      new Date(ts).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    )
    return {
      grid: { left: 34, right: 34, top: 22, bottom: 18 },
      legend: {
        data: [t('cpuLegend'), t('memLegend')],
        textStyle: { color: chartText(isDark), fontSize: 10 },
        top: 0,
        itemWidth: 12,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: chartBg(isDark),
        borderColor: chartAxis(isDark),
        textStyle: { color: fg(isDark), fontSize: 11 },
      },
      xAxis: {
        type: 'category',
        data: labels,
        ...AXIS(isDark),
        boundaryGap: false,
        axisLabel: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        splitNumber: 2,
        ...AXIS(isDark),
        axisLabel: { color: chartText(isDark), fontSize: 9 },
        splitLine: { show: false },
      },
      series: [
        {
          name: t('cpuLegend'),
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: (trend?.cpuPct ?? []).map(([, v]) => Number(v.toFixed(2))),
          ...seriesGlow(CHART_CYAN),
        },
        {
          name: t('memLegend'),
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: (trend?.memPct ?? []).map(([, v]) => Number(v.toFixed(2))),
          ...seriesGlow(CHART_VIOLET),
        },
      ],
    }
  }, [trend, locale, t, isDark])

  // 只画到今天当前小时:把未到的时段画成 0 柱会被读成「这些时段没有流量」。
  const nowHour = now.getHours()
  const hourlyOption = React.useMemo<EChartsOption>(() => {
    const hours = Array.from({ length: nowHour + 1 }, (_, i) => String(i).padStart(2, '0'))
    const byHour = new Map((trend?.hourlyCalls ?? []).map((r) => [r.hour, r.calls]))
    return {
      grid: { left: 40, right: 12, top: 16, bottom: 22 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: chartBg(isDark),
        borderColor: chartAxis(isDark),
        textStyle: { color: fg(isDark), fontSize: 11 },
      },
      xAxis: { type: 'category', data: hours, ...AXIS(isDark) },
      yAxis: { type: 'value', ...AXIS(isDark) },
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
                { offset: 0, color: withAlpha(CHART_CYAN, 0.95) },
                { offset: 1, color: withAlpha(CHART_CYAN, 0.15) },
              ],
            },
          },
        },
      ],
    }
  }, [trend?.hourlyCalls, isDark, nowHour])

  const modelOption = React.useMemo<EChartsOption>(() => {
    const models = [...(biz?.llmTopModels ?? [])].reverse()
    return {
      grid: { left: 8, right: 40, top: 6, bottom: 6, containLabel: true },
      tooltip: {
        backgroundColor: chartBg(isDark),
        borderColor: chartAxis(isDark),
        textStyle: { color: fg(isDark), fontSize: 11 },
      },
      xAxis: {
        type: 'value',
        ...AXIS(isDark),
        splitLine: { show: false },
        axisLabel: { show: false },
      },
      yAxis: {
        type: 'category',
        data: models.map((m) => m.model),
        ...AXIS(isDark),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: chartText(isDark), fontSize: 10, width: 120, overflow: 'truncate' },
      },
      series: [
        {
          type: 'bar',
          data: models.map((m) => m.calls),
          barWidth: 12,
          label: { show: true, position: 'right', color: chartText(isDark), fontSize: 10 },
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: withAlpha(CHART_VIOLET, 0.35) },
                { offset: 1, color: CHART_VIOLET },
              ],
            },
          },
        },
      ],
    }
  }, [biz?.llmTopModels, isDark])

  // 近 7 日签到人数:纯柱形,横轴只留 MM-DD,纵轴标签隐藏(格子小,数字已标在柱顶)
  const signInOption = React.useMemo<EChartsOption>(() => {
    const rows = biz?.signIn?.last7d ?? []
    return {
      grid: { left: 4, right: 4, top: 12, bottom: 2, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: chartBg(isDark),
        borderColor: chartAxis(isDark),
        textStyle: { color: fg(isDark), fontSize: 11 },
      },
      xAxis: {
        type: 'category',
        data: rows.map((r) => r.date.slice(5)),
        ...AXIS(isDark),
        axisLabel: { color: chartText(isDark), fontSize: 9 },
      },
      yAxis: {
        type: 'value',
        ...AXIS(isDark),
        splitLine: { show: false },
        axisLabel: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: rows.map((r) => r.users),
          barWidth: 9,
          itemStyle: { borderRadius: [3, 3, 0, 0], color: withAlpha(CHART_GREEN, 0.85) },
          label: { show: true, position: 'top', color: chartText(isDark), fontSize: 9 },
        },
      ],
    }
  }, [biz?.signIn?.last7d, isDark])

  // 访客首页访问耗时走势:点色 = 该次是否命中边缘缓存(绿 HIT / 黄 MISS),线 = 耗时 ms
  const edgeOption = React.useMemo<EChartsOption>(() => {
    const rows = edge?.series ?? []
    const labels = rows.map(([ts]) =>
      new Date(ts).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    )
    return {
      grid: { left: 42, right: 12, top: 18, bottom: 20 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: chartBg(isDark),
        borderColor: chartAxis(isDark),
        textStyle: { color: fg(isDark), fontSize: 11 },
      },
      xAxis: { type: 'category', data: labels, ...AXIS(isDark), boundaryGap: false },
      yAxis: {
        type: 'value',
        name: t('unitMs'),
        nameTextStyle: { color: chartText(isDark) },
        ...AXIS(isDark),
      },
      series: [
        {
          name: t('edgeSparkName'),
          type: 'line',
          showSymbol: true,
          symbolSize: 5,
          data: rows.map(([, ms, hit]) => ({
            value: ms,
            itemStyle: { color: hit ? CHART_GREEN : CHART_AMBER },
          })),
          ...seriesGlow(CHART_CYAN),
        },
      ],
    }
  }, [edge?.series, locale, t, isDark])

  // 「无 5xx」好消息徽章:刻意定义在组件作用域(脱离 <Panel right> 开标签区间),
  // 避免被圆角角色门按 panel 角色误判须 xl;该徽章自身无角色类名,落「未判定」射程外,不计入红。
  const no5xxBadge =
    trend &&
    trend.qps.length > 0 &&
    (trend.errRate.length === 0 || trend.errRate.every(([, v]) => v === 0)) ? (
      <span className="flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] text-success-text">
        <Dot tone="ok" />
        {t('no5xxWindow', { minutes: trend.minutes })}
      </span>
    ) : null

  // 访客加速两档阈值着色:null(未测到)⇒ 'unknown',不得借默认值染成绿/红
  const edgeLastTone = thresholdTone(edge?.stats.lastMs, (n) =>
    n >= 3000 ? 'bad' : n >= 1500 ? 'warn' : 'ok',
  )
  const edgeHitTone = thresholdTone(edge?.stats.hitRatio, (n) => (n >= 0.8 ? 'ok' : 'warn'))
  // 边缘探测三条腿的标签键(官网首页 / 根域名跳转 / 静态资源);对照腿 originViaCf 已有专属文案
  const EDGE_LEG_LABEL: Record<
    'edgeHomepage' | 'apexRedirect' | 'edgeStatic',
    'edgeLegHomepage' | 'edgeLegApex' | 'edgeLegStatic'
  > = {
    edgeHomepage: 'edgeLegHomepage',
    apexRedirect: 'edgeLegApex',
    edgeStatic: 'edgeLegStatic',
  }

  // ---------- 渲染 ----------
  return (
    <TooltipProvider>
      <div className="wb-root min-h-full px-0 text-foreground">
        <style>{WALLBOARD_CSS}</style>

        {/* overview/trend 整体失败(网络/500):顶部横幅 + 一键重试,避免整屏「—」或旧快照无解释 */}
        {ovError || trendError ? (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/[0.08] px-3 py-2 text-[11px] text-danger-text">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{t('loadFailed')}</span>
            <button
              type="button"
              onClick={() => {
                void refetchOv()
                void refetchTrend()
              }}
              className="ml-auto shrink-0 rounded-sm border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] text-danger-text transition-colors hover:bg-destructive/20"
            >
              {t('retry')}
            </button>
          </div>
        ) : null}

        {/* ===== 顶部横梁 ===== */}
        <header className="wb-header sticky top-0 z-20 flex items-center gap-3 bg-shell-panel/90 px-4 py-2 backdrop-blur">
          <div className="wb-hdr-title flex min-w-0 items-center gap-2.5">
            <BackButton />
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-info/40 bg-info/10 shadow-[0_0_12px_color-mix(in_srgb,var(--color-info)_28%,transparent)]">
              <Gauge className="h-4 w-4 text-info-text" />
            </div>
            <div className="min-w-0">
              <h1 className="wb-display truncate text-[15px] leading-tight font-bold tracking-[0.16em] text-foreground">
                {t('title')}
              </h1>
              <p className="truncate text-[9px] tracking-[0.24em] text-muted-foreground uppercase">
                {t('subtitle')}
              </p>
            </div>
          </div>

          <div className="wb-hdr-sources flex items-center gap-1.5">
            {(
              [
                [t('srcPrometheus'), ov?.sources?.prometheus],
                [t('srcAlertmanager'), ov?.sources?.alertmanager],
                [t('srcDatabase'), ov?.sources?.database],
                [t('srcEdge'), ov?.sources?.edge],
              ] as Array<[string, string | undefined]>
            ).map(([name, state]) => (
              <Tooltip key={name} content={name}>
                <span className="flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] text-foreground">
                  <Dot tone={sourceTone(state)} />
                  <span className="wb-src-name">{name}</span>
                </span>
              </Tooltip>
            ))}
          </div>

          <div className="wb-hdr-status ml-auto flex shrink-0 items-center gap-2">
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px]',
                overallTone === 'ok'
                  ? 'border-success/40 bg-success/10 text-success-text'
                  : overallTone === 'warn'
                    ? 'border-warning/40 bg-warning/10 text-warning-text'
                    : 'border-border bg-muted/60 text-muted-foreground',
              )}
            >
              <Dot tone={overallTone} />
              {overallTone === 'ok'
                ? t('statusOk')
                : overallTone === 'warn'
                  ? t('statusWarn')
                  : t('statusUnknown')}
            </span>
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px]',
                alertCount === null
                  ? 'border-border bg-muted/60 text-muted-foreground'
                  : 'border-destructive/30 bg-destructive/10 text-danger-text',
              )}
            >
              <Bell className="h-3 w-3" />
              {alertCount === null
                ? t('alertCountUnknown')
                : t('alertCount', { count: alertCount })}
            </span>
            <div className="text-right">
              <div className="wb-num text-[13px] leading-tight font-semibold tabular-nums text-foreground">
                {fmtClockDigits(now)}
              </div>
              <div
                className={cn(
                  'text-[9px] tracking-[0.2em]',
                  dataStale ? 'text-warning-text/90' : 'text-muted-foreground',
                )}
              >
                {dataStale ? `${t('staleData')} · ` : ''}
                {t('refreshedAt', {
                  time: ov?.generatedAt
                    ? fmtClock(ov.generatedAt)
                    : dataUpdatedAt
                      ? fmtClock(new Date(dataUpdatedAt).toISOString())
                      : '—',
                })}
              </div>
            </div>
            {headerExtra}
          </div>
        </header>

        {/* ===== KPI 带 ===== */}
        <section className="wb-cells-lg grid gap-2.5 px-4 pt-3">
          {[
            {
              icon: <Activity className="h-4 w-4" />,
              label: t('kpiQps'),
              value: typeof http?.qps === 'number' ? http.qps.toFixed(2) : '—',
              sub: t('kpiQpsSub', { count: fmtInt(http?.activeConnections) }),
              tone: 'accent' as const,
            },
            {
              icon: <ShieldAlert className="h-4 w-4" />,
              label: t('kpiErrRate'),
              value: typeof http?.errRate === 'number' ? fmtPct(http.errRate * 100, 3) : '—',
              sub: t('errRateWindow'),
              tone: thresholdTone(http?.errRate, (n) => (n > 0.01 ? 'bad' : 'ok')),
            },
            {
              icon: <Clock3 className="h-4 w-4" />,
              label: t('kpiApiP95'),
              value: typeof http?.p95ApiMs === 'number' ? fmtInt(http.p95ApiMs) : '—',
              unit: t('unitMs'),
              sub: t('kpiApiP95Sub', {
                value: typeof http?.p95AiMs === 'number' ? fmtInt(http.p95AiMs) : '—',
              }),
              tone: http === null ? ('unknown' as const) : ('ok' as const),
            },
            {
              icon: <Users className="h-4 w-4" />,
              label: t('kpiUsers'),
              value: fmtInt(biz?.usersTotal),
              sub: t('kpiUsersSub', { count: fmtInt(biz?.usersTodayNew) }),
              tone: biz ? ('accent' as const) : ('unknown' as const),
            },
            {
              icon: <Wallet className="h-4 w-4" />,
              label: t('kpiTurnover'),
              value: biz ? (biz.ordersTodayAmountCents / 100).toLocaleString(locale) : '—',
              unit: t('unitYuan'),
              sub: t('kpiTurnoverSub', { count: fmtInt(biz?.ordersTodayPaid) }),
              tone: biz ? ('ok' as const) : ('unknown' as const),
            },
            {
              icon: <Sparkles className="h-4 w-4" />,
              label: t('kpiAiCalls'),
              value: fmtCompact(biz?.llmCallsToday),
              sub: t('kpiAiCallsSub', { count: fmtCompact(biz?.llmTokensToday) }),
              tone: biz ? ('accent' as const) : ('unknown' as const),
            },
          ].map((k) => (
            <div
              key={k.label}
              className="ui-lift wb-panel wb-rise relative overflow-hidden rounded-lg border border-border bg-card/80 px-3 py-2"
            >
              <div className="flex items-center gap-2 text-[10px] tracking-[0.16em] text-muted-foreground">
                <span className="text-info-text/70">{k.icon}</span>
                {k.label}
              </div>
              <div
                className={cn(
                  'wb-num mt-1 text-[26px] leading-none font-bold',
                  k.tone === 'bad'
                    ? 'text-danger-text'
                    : k.tone === 'accent'
                      ? 'text-info-text'
                      : k.tone === 'unknown'
                        ? 'text-muted-foreground'
                        : 'text-success-text',
                )}
              >
                {k.value}
                {k.unit ? (
                  <span className="ml-1 text-[12px] text-muted-foreground">{k.unit}</span>
                ) : null}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">{k.sub}</div>
            </div>
          ))}
        </section>

        {/* ===== 主体网格 ===== */}
        <section className="wb-grid grid gap-2.5 p-4">
          {/* 主机资源 */}
          <Panel
            title={t('panelHost')}
            icon={<Cpu className="h-3.5 w-3.5" />}
            className="wb-c3"
            right={
              <span className="text-[10px] text-muted-foreground">
                {t('hostUptime', {
                  duration: fmtDuration(
                    isNum(host?.bootTimeEpochSec)
                      ? Date.now() / 1000 - host.bootTimeEpochSec
                      : null,
                  ),
                })}
              </span>
            }
            bodyClassName="overflow-y-auto"
          >
            <div className="relative">
              <EChart option={gaugeOption} height={150} />
              {ov !== undefined && !isNum(host?.cpuPct) && !isNum(host?.memPct) ? (
                <ChartEmpty text={t('sourceUnreachable')} />
              ) : null}
            </div>
            <div className="mt-2 wb-cells grid gap-2">
              <StatCell
                label={t('memPhysical')}
                value={`${fmtBytes(typeof host?.memTotalBytes === 'number' && typeof host?.memFreeBytes === 'number' ? host.memTotalBytes - host.memFreeBytes : null)} / ${fmtBytes(host?.memTotalBytes)}`}
              />
              <StatCell
                label={t('netThroughput')}
                value={`↓ ${fmtRate(host?.netRxBytesPerSec)}`}
                unit={`↑ ${fmtRate(host?.netTxBytesPerSec)}`}
                tone="accent"
              />
            </div>
            <div className="mt-2.5">
              <div className="mb-1 text-[10px] tracking-[0.14em] text-muted-foreground">
                {t('cpuMemTrendTitle')}
              </div>
              <div className="relative">
                <EChart option={hostTrendOption} height={96} />
                {!trend || trend.cpuPct.length === 0 ? (
                  <ChartEmpty text={trendError ? t('trendLoadFailed') : t('noHostTrendData')} />
                ) : null}
              </div>
            </div>
            <div className="mt-2.5 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] tracking-[0.14em] text-muted-foreground">
                <HardDrive className="h-3 w-3" /> {t('diskVolumes')}
              </div>
              {(host?.disks ?? []).map((d) => (
                <div key={d.volume}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="wb-num text-foreground">{d.volume}</span>
                    <span className="text-muted-foreground">
                      {fmtBytes(d.sizeBytes - d.freeBytes)} / {fmtBytes(d.sizeBytes)}
                    </span>
                    <span
                      className={cn(
                        'wb-num',
                        d.usedPct >= 90
                          ? 'text-danger-text'
                          : d.usedPct >= 75
                            ? 'text-warning-text'
                            : 'text-info-text',
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

          {/* 服务矩阵 */}
          <Panel
            title={t('panelServices')}
            icon={<Server className="h-3.5 w-3.5" />}
            className="wb-c3"
            right={
              services ? (
                <span className="text-[10px] text-muted-foreground">
                  {t('svcRunning', {
                    running: services.windowsRunning,
                    total: services.windowsExpectedTotal,
                  })}
                </span>
              ) : (
                <SourceGap text={t('sourceUnreachable')} />
              )
            }
            bodyClassName="flex max-h-[540px] flex-col overflow-y-auto"
          >
            <div className="space-y-1">
              {ov !== undefined && services === null ? (
                <div className="flex justify-center py-3">
                  <SourceGap text={t('sourceUnreachable')} />
                </div>
              ) : null}
              {(services?.windows ?? []).map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between rounded-md border border-transparent bg-muted/50 px-2 py-[5px] transition-colors hover:bg-muted"
                >
                  <span className="wb-num truncate text-[11px] text-foreground">{s.name}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Dot
                      tone={
                        s.retired
                          ? 'idle'
                          : s.state === 'running'
                            ? 'ok'
                            : s.state === 'stopped'
                              ? 'bad'
                              : 'warn'
                      }
                    />
                    <span
                      className={cn(
                        'text-[10px]',
                        s.retired
                          ? 'text-muted-foreground'
                          : s.state === 'running'
                            ? 'text-success-text/90'
                            : s.state === 'stopped'
                              ? 'text-danger-text'
                              : 'text-warning-text',
                      )}
                    >
                      {s.retired
                        ? t('svcStateRetired')
                        : s.state === 'running'
                          ? t('svcStateRunning')
                          : s.state === 'stopped'
                            ? t('svcStateStopped')
                            : t('svcStateOther')}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-4">
              <div className="mb-1.5 text-[10px] tracking-[0.14em] text-muted-foreground">
                {t('scrapeTargets', {
                  up: services ? String(services.targetsUp) : '—',
                  total: services ? String(services.targetsTotal) : '—',
                })}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(services?.targets ?? []).map((target) => (
                  <Tooltip key={`${target.job}-${target.instance}`} content={target.instance}>
                    <span
                      className={cn(
                        'flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]',
                        target.up === 1
                          ? 'border-success/25 bg-success/10 text-success-text/90'
                          : 'border-destructive/30 bg-destructive/10 text-danger-text',
                      )}
                    >
                      <Dot tone={target.up === 1 ? 'ok' : 'bad'} />
                      {target.job}
                    </span>
                  </Tooltip>
                ))}
              </div>
            </div>
          </Panel>

          {/* 流量趋势 */}
          <Panel
            title={t('panelTraffic')}
            icon={<Radio className="h-3.5 w-3.5" />}
            className="wb-c6"
            right={
              <span className="flex items-center gap-2">
                {no5xxBadge}
                <span className="text-[10px] text-muted-foreground">{t('trendWindow')}</span>
                {trendStale ? (
                  <span className="flex items-center gap-1 text-[10px] text-warning-text/90">
                    <Dot tone="warn" />
                    {t('staleData')}
                  </span>
                ) : null}
              </span>
            }
            bodyClassName="flex flex-col gap-2"
          >
            <div className="relative min-h-[220px] flex-1">
              <EChart option={trendOption} height="100%" />
              {!trend || trend.qps.length === 0 ? (
                <ChartEmpty text={trendError ? t('trendLoadFailed') : t('noTrendData')} />
              ) : null}
            </div>
            <div className="wb-cells grid gap-2">
              <StatCell
                label={t('wsConnections')}
                value={fmtInt(http?.wsConnections)}
                unit={t('unitConn')}
                tone="accent"
              />
              <StatCell
                label={t('aiSessions')}
                value={fmtInt(http?.aiActiveSessions)}
                unit={t('unitSession')}
                tone="accent"
              />
              <StatCell
                label={t('apiCallsToday')}
                value={fmtCompact(biz?.apiCallsToday)}
                tone={biz ? 'ok' : 'unknown'}
              />
              <StatCell
                label={t('apiAvgLatency')}
                value={fmtInt(biz?.apiAvgLatencyMs)}
                unit={t('unitMs')}
                tone={biz ? 'ok' : 'unknown'}
              />
              <StatCell
                label={t('apiErrRateLabel')}
                value={typeof biz?.apiErrRate === 'number' ? fmtPct(biz.apiErrRate, 2) : '—'}
                tone={thresholdTone(biz?.apiErrRate, (n) => (n > 5 ? 'bad' : 'ok'))}
              />
            </div>
          </Panel>

          {/* 状态码分布 + 分时调用 */}
          <Panel
            title={t('panelQuality')}
            icon={<Gauge className="h-3.5 w-3.5" />}
            className="wb-c6"
            bodyClassName="flex flex-col gap-1"
          >
            <div className="relative">
              <EChart option={statusOption} height={172} />
              {!http || http.statusRates.length === 0 ? (
                <ChartEmpty
                  text={ov !== undefined && !http ? t('sourceUnreachable') : t('noStatusData')}
                />
              ) : null}
            </div>
            <div className="mt-1 text-[10px] tracking-[0.14em] text-muted-foreground">
              {t('hourlyTitle')}
            </div>
            <div className="relative">
              <EChart option={hourlyOption} height={116} />
              {trendError ? (
                <ChartEmpty text={t('trendLoadFailed')} />
              ) : trend && trend.hourlyCalls.length === 0 ? (
                /* 分时数据来自业务库聚合(后端失败降级为 []);库不可达时不得把
                   全零柱渲染成「今日无流量」(§0.3) */
                <ChartEmpty
                  text={
                    ov?.sources?.database === 'down' ? t('sourceUnreachable') : t('noCallsToday')
                  }
                />
              ) : null}
            </div>
          </Panel>

          {/* 告警与事件 */}
          <Panel
            title={t('panelAlerts')}
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            className="wb-c6"
            right={
              <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Dot
                    tone={
                      isUnset(bridge?.mailUndelivered)
                        ? 'unknown'
                        : bridge.mailUndelivered
                          ? 'bad'
                          : 'ok'
                    }
                  />
                  {isUnset(bridge?.mailUndelivered)
                    ? t('statusUnknown')
                    : bridge.mailUndelivered === false
                      ? t('mailOk')
                      : t('mailWarn')}
                </span>
                <span>{t('dedupSuppressed', { count: fmtInt(bridge?.dedupSuppressed) })}</span>
              </span>
            }
            bodyClassName="wb-split overflow-y-auto"
          >
            <div>
              <div className="mb-1.5 text-[10px] tracking-[0.14em] text-muted-foreground">
                {t('activeAlerts')}
              </div>
              <div className="space-y-1.5">
                {(alerts?.promActive ?? []).slice(0, 5).map((a, i) => (
                  <div
                    key={`${a.name}-${i}`}
                    className="rounded-md border border-destructive/25 bg-destructive/[0.08] px-2 py-1.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <Dot tone={a.severity === 'critical' ? 'bad' : 'warn'} />
                      <span className="truncate text-[11px] font-medium text-danger-text">
                        {a.name}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-md border px-1 text-[9px]',
                          a.state === 'active'
                            ? 'border-destructive/30 bg-destructive/10 text-danger-text'
                            : 'border-warning/30 bg-warning/10 text-warning-text',
                        )}
                      >
                        {a.state === 'suppressed'
                          ? t('alertStateSuppressed')
                          : a.state === 'unprocessed'
                            ? t('alertStateUnprocessed')
                            : t('alertStateActive')}
                      </span>
                      <span className="ml-auto shrink-0 text-[9px] text-muted-foreground">
                        {fmtAgo(a.since)}
                      </span>
                    </div>
                    {a.summary ? (
                      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {a.summary}
                      </div>
                    ) : null}
                  </div>
                ))}
                {alerts?.promActiveCount === 0 ? (
                  <div className="rounded-md border border-success/20 bg-success/[0.06] px-2 py-3 text-center text-[11px] text-success-text/90">
                    {t('noActiveAlerts')}
                  </div>
                ) : null}
                {alerts?.promActive === null || alerts?.promActive === undefined ? (
                  <div className="rounded-md border border-warning/20 bg-warning/[0.06] px-2 py-3 text-center text-[11px] text-warning-text/90">
                    {t('alertmanagerDown')}
                  </div>
                ) : null}
              </div>
              <div className="mt-2 mb-1.5 text-[10px] tracking-[0.14em] text-muted-foreground">
                {t('recentAlerts')}
              </div>
              <div className="space-y-1">
                {(alerts?.recent ?? []).slice(0, 4).map((a, i) => (
                  <div
                    key={`${a.name}-${i}`}
                    className="rounded-md border border-transparent bg-muted/50 px-2 py-1"
                  >
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <Dot tone={a.status === 'firing' ? 'bad' : 'ok'} />
                      <span
                        className={cn(
                          'shrink-0 rounded-md border px-1 text-[9px]',
                          a.severity === 'critical'
                            ? 'border-destructive/30 bg-destructive/10 text-danger-text'
                            : a.severity === 'info'
                              ? 'border-info/40 bg-info/10 text-info-text'
                              : 'border-warning/30 bg-warning/10 text-warning-text',
                        )}
                      >
                        {a.severity === 'critical'
                          ? t('sevCritical')
                          : a.severity === 'info'
                            ? t('sevInfo')
                            : t('sevWarning')}
                      </span>
                      <span className="truncate text-foreground">{a.name}</span>
                      <span className="ml-auto shrink-0 text-muted-foreground">
                        {fmtAgo(a.firedAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                      <span className="shrink-0 text-info-text/70">{a.source}</span>
                      {a.resolvedAt ? (
                        <span className="truncate text-success-text/80">
                          {t('resolvedAgo', { ago: fmtAgo(a.resolvedAt) })}
                        </span>
                      ) : a.message ? (
                        <span className="truncate">{a.message}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
                {alerts === null ? (
                  <div className="flex justify-center rounded-md border border-border bg-muted/50 px-2 py-3">
                    <SourceGap text={t('sourceUnreachable')} />
                  </div>
                ) : alerts.recent.length === 0 ? (
                  <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                    {t('noRecentAlerts')}
                  </div>
                ) : null}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[10px] tracking-[0.14em] text-muted-foreground">
                {t('eventsTitle')}
              </div>
              <div className="space-y-1">
                {(events ?? []).map((e, i) => (
                  <div
                    key={`${e.createdAt}-${i}`}
                    className="rounded-md border border-transparent bg-muted/50 px-2 py-1.5"
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
                      <span className="shrink-0 text-[9px] tracking-[0.12em] text-info-text/80 uppercase">
                        {e.type}
                      </span>
                      <span className="ml-auto shrink-0 text-[9px] text-muted-foreground">
                        {fmtClock(e.createdAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                      {e.message}
                    </div>
                  </div>
                ))}
                {events === null ? (
                  <div className="flex justify-center rounded-md border border-border bg-muted/50 px-2 py-3">
                    <SourceGap text={t('sourceUnreachable')} />
                  </div>
                ) : events.length === 0 ? (
                  <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                    {t('noEvents')}
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          {/* 数据层 */}
          <Panel
            title={t('panelDatastore')}
            icon={<Database className="h-3.5 w-3.5" />}
            className="wb-c6"
            bodyClassName="flex flex-col gap-2"
          >
            <div>
              <div className="mb-1 flex items-center justify-between text-[10px] tracking-[0.14em] text-muted-foreground">
                <span>{t('pgLabel')}</span>
                {pg === null && ov !== undefined ? (
                  <SourceGap text={t('sourceUnreachable')} />
                ) : (
                  <span className="text-muted-foreground">
                    {t('pgConnections', { count: fmtInt(pg?.backends) })}
                  </span>
                )}
              </div>
              <div className="wb-cells grid gap-1.5">
                <StatCell label={t('dbSize')} value={fmtBytes(pg?.sizeBytes)} tone="accent" />
                <StatCell
                  label={t('bufferHit')}
                  value={typeof pg?.hitRatio === 'number' ? fmtPct(pg.hitRatio * 100, 1) : '—'}
                  tone={thresholdTone(pg?.hitRatio, (n) => (n >= 0.95 ? 'ok' : 'warn'))}
                />
                <StatCell label={t('txnPerSec')} value={fmtInt(pg?.commitPerSec)} />
                <StatCell label={t('rowsPerSec')} value={fmtInt(pg?.tupReturnedPerSec)} />
                <StatCell label={t('rowsFetchedPerSec')} value={fmtInt(pg?.tupFetchedPerSec)} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[10px] tracking-[0.14em] text-muted-foreground">
                <span>{t('redisLabel')}</span>
                {redis === null && ov !== undefined ? (
                  <SourceGap text={t('sourceUnreachable')} />
                ) : (
                  <span className="text-muted-foreground">
                    {t('memUsage', {
                      used: `${fmtBytes(redis?.memUsedBytes)}${redis?.memMaxBytes ? ` / ${fmtBytes(redis.memMaxBytes)}` : ''}`,
                    })}
                  </span>
                )}
              </div>
              <div className="wb-cells wb-cells-6 grid gap-1.5">
                <StatCell label={t('redisClients')} value={fmtInt(redis?.clients)} tone="accent" />
                <StatCell label={t('redisKeys')} value={fmtInt(redis?.keys)} />
                <StatCell
                  label={t('redisHit')}
                  value={
                    typeof redis?.hitRatio === 'number' ? fmtPct(redis.hitRatio * 100, 1) : '—'
                  }
                  tone={thresholdTone(redis?.hitRatio, (n) => (n >= 0.8 ? 'ok' : 'warn'))}
                />
                <StatCell label={t('redisOps')} value={fmtInt(redis?.opsPerSec)} />
                <StatCell label={t('redisEvicted')} value={fmtInt(redis?.evicted)} />
                <StatCell label={t('redisUptime')} value={fmtDuration(redis?.uptimeSeconds)} />
              </div>
            </div>
            <div>
              <div className="mb-1 text-[10px] tracking-[0.14em] text-muted-foreground">
                {t('llmBridge')}
              </div>
              <div className="wb-cells grid gap-1.5">
                <StatCell
                  label={t('llmCallsToday')}
                  value={fmtCompact(biz?.llmCallsToday)}
                  tone="accent"
                />
                <StatCell
                  label={t('llmErrRate')}
                  value={biz ? fmtPct(biz.llmErrRate, 2) : '—'}
                  tone={thresholdTone(biz?.llmErrRate, (n) => (n > 5 ? 'bad' : 'ok'))}
                />
                <StatCell
                  label={t('llmP95')}
                  value={biz ? fmtInt(biz.llmP95LatencyMs) : '—'}
                  unit={t('unitMs')}
                />
                <StatCell
                  label={t('llmCost')}
                  value={biz ? (biz.llmCostCentsToday / 100).toFixed(2) : '—'}
                  unit={t('unitYuan')}
                  tone="warn"
                />
                <StatCell
                  label={t('alertsReceived')}
                  value={fmtInt(bridge?.alertsReceived)}
                  tone="accent"
                />
              </div>
            </div>
          </Panel>

          {/* 业务纵深 */}
          <Panel
            title={t('panelBusiness')}
            icon={<Wallet className="h-3.5 w-3.5" />}
            className="wb-c6"
            bodyClassName="wb-split overflow-y-auto"
          >
            <div>
              <div className="mb-1.5 text-[10px] tracking-[0.14em] text-muted-foreground">
                {t('topEndpoints')}
              </div>
              <div className="space-y-1">
                {(biz?.topEndpoints ?? []).map((e, i) => (
                  <div
                    key={`${e.method}-${e.path}-${i}`}
                    className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1"
                  >
                    <span className="wb-num w-4 text-[10px] text-muted-foreground">{i + 1}</span>
                    <span className="shrink-0 rounded-md border border-info/25 px-1 text-[9px] text-info-text/90">
                      {e.method}
                    </span>
                    <Tooltip content={e.path}>
                      <span className="truncate text-[10px] text-foreground">{e.path}</span>
                    </Tooltip>
                    <span className="wb-num ml-auto shrink-0 text-[10px] text-info-text">
                      {fmtCompact(e.calls)}
                    </span>
                  </div>
                ))}
                {biz === null ? (
                  <div className="flex justify-center px-2 py-3">
                    <SourceGap text={t('sourceUnreachable')} />
                  </div>
                ) : biz.topEndpoints.length === 0 ? (
                  <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                    {t('noCallsToday')}
                  </div>
                ) : null}
              </div>
              <div className="mt-2 wb-cells grid gap-1.5">
                <StatCell
                  label={t('usersRegistered')}
                  value={fmtInt(biz?.usersTotal)}
                  tone="accent"
                />
                <StatCell label={t('usersActive')} value={fmtInt(biz?.usersActive)} />
                <StatCell label={t('usersNewToday')} value={fmtInt(biz?.usersTodayNew)} tone="ok" />
              </div>
              {/* 签到:数据来自 sign_in_records(与积分体系同源);取不到 ⇒ 各格渲染"—",不写 0 */}
              <div className="mt-2">
                <div className="mb-1.5 flex items-center gap-2 text-[10px] tracking-[0.14em] text-muted-foreground">
                  <span>{t('signInTitle')}</span>
                  {biz && !biz.signIn ? <SourceGap text={t('sourceUnreachable')} /> : null}
                </div>
                <div className="wb-cells grid gap-1.5">
                  <StatCell
                    label={t('signInToday')}
                    value={fmtInt(biz?.signIn?.todayUsers)}
                    unit={t('unitUser')}
                    tone="ok"
                  />
                  <StatCell
                    label={t('signInUnsigned')}
                    value={fmtInt(biz?.signIn?.unsignedActiveUsers)}
                    unit={t('unitUser')}
                    tone="warn"
                  />
                  <StatCell
                    label={t('signInStreak')}
                    value={fmtInt(biz?.signIn?.maxStreakDays)}
                    unit={t('unitDay')}
                  />
                  <StatCell
                    label={t('signInReward')}
                    value={fmtInt(biz?.signIn?.todayRewardPoints)}
                    unit={t('unitPoint')}
                    tone="accent"
                  />
                </div>
                <div className="relative mt-1.5">
                  <div className="mb-0.5 text-[9px] tracking-[0.12em] text-muted-foreground">
                    {t('signIn7d')}
                  </div>
                  <EChart option={signInOption} height={62} />
                  {!biz?.signIn || biz.signIn.last7d.length === 0 ? (
                    <ChartEmpty text={biz?.signIn ? t('noSignIn7d') : t('sourceUnreachable')} />
                  ) : null}
                </div>
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[10px] tracking-[0.14em] text-muted-foreground">
                {t('topModels')}
              </div>
              <div className="relative">
                <EChart option={modelOption} height={148} />
                {!biz || biz.llmTopModels.length === 0 ? (
                  <ChartEmpty
                    text={ov !== undefined && !biz ? t('sourceUnreachable') : t('noModelCalls')}
                  />
                ) : null}
              </div>
              <div className="mt-2 wb-cells grid gap-1.5">
                <StatCell
                  label={t('ordersToday')}
                  value={fmtInt(biz?.ordersTodayPaid)}
                  unit={t('unitOrder')}
                  tone="accent"
                />
                <StatCell
                  label={t('ordersYesterday')}
                  value={fmtInt(biz?.ordersYesterdayPaid)}
                  unit={t('unitOrder')}
                />
                <StatCell
                  label={t('bridgeMail')}
                  value={fmtInt(bridge?.mailDelivered)}
                  unit={t('unitMail')}
                  tone={
                    isUnset(bridge?.mailUndelivered)
                      ? 'unknown'
                      : bridge.mailUndelivered
                        ? 'bad'
                        : 'ok'
                  }
                />
              </div>
            </div>
          </Panel>

          {/* 访客访问耗时 · 国内加速命中率(edge 块独立降级:null ⇒ 未判定,绝不渲染 0) */}
          <Panel
            title={t('panelEdge')}
            icon={<Globe className="h-3.5 w-3.5" />}
            className="wb-c6"
            right={
              edge ? (
                <span className="text-[10px] text-muted-foreground">
                  {t('edgeUpdatedAgo', { ago: fmtAgo(edge.at) })}
                </span>
              ) : (
                <SourceGap text={t('sourceUnreachable')} />
              )
            }
            bodyClassName="flex flex-col gap-2"
          >
            {edge === null ? (
              ov !== undefined ? (
                <div className="flex flex-1 items-center justify-center py-4">
                  <SourceGap text={t('sourceUnreachable')} />
                </div>
              ) : null
            ) : (
              <>
                <div className="wb-cells grid gap-2">
                  <div className="rounded-lg border border-border bg-muted/60 px-2.5 py-2">
                    <div className="text-[10px] tracking-[0.12em] text-muted-foreground">
                      {t('edgeHeadlineMs')}
                    </div>
                    <div
                      className={cn(
                        'wb-num mt-0.5 text-[26px] leading-none font-bold',
                        edgeLastTone === 'bad'
                          ? 'text-danger-text'
                          : edgeLastTone === 'warn'
                            ? 'text-warning-text'
                            : edgeLastTone === 'unknown'
                              ? 'text-muted-foreground'
                              : 'text-info-text',
                      )}
                    >
                      {isNum(edge.stats.lastMs) ? fmtInt(edge.stats.lastMs) : '—'}
                      {isNum(edge.stats.lastMs) ? (
                        <span className="ml-1 text-[12px] text-muted-foreground">
                          {t('unitMs')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/60 px-2.5 py-2">
                    <div className="text-[10px] tracking-[0.12em] text-muted-foreground">
                      {t('edgeHeadlineHit')}
                    </div>
                    <div
                      className={cn(
                        'wb-num mt-0.5 text-[26px] leading-none font-bold',
                        edgeHitTone === 'bad'
                          ? 'text-danger-text'
                          : edgeHitTone === 'warn'
                            ? 'text-warning-text'
                            : edgeHitTone === 'unknown'
                              ? 'text-muted-foreground'
                              : 'text-success-text',
                      )}
                    >
                      {isNum(edge.stats.hitRatio) ? fmtPct(edge.stats.hitRatio * 100, 1) : '—'}
                    </div>
                  </div>
                </div>
                <div className="wb-cells grid gap-2">
                  <StatCell
                    label={t('edgeStatP50')}
                    value={isNum(edge.stats.p50Ms) ? fmtInt(edge.stats.p50Ms) : '—'}
                    unit={t('unitMs')}
                  />
                  <StatCell
                    label={t('edgeStatP95')}
                    value={isNum(edge.stats.p95Ms) ? fmtInt(edge.stats.p95Ms) : '—'}
                    unit={t('unitMs')}
                  />
                  <StatCell
                    label={t('edgeStatWorst')}
                    value={isNum(edge.stats.worstMs) ? fmtInt(edge.stats.worstMs) : '—'}
                    unit={t('unitMs')}
                    tone={thresholdTone(edge.stats.worstMs, (n) => (n >= 5000 ? 'bad' : 'warn'))}
                  />
                  <StatCell label={t('edgeStatSamples')} value={fmtInt(edge.stats.samples)} />
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-2.5 py-2">
                  <Dot tone={edge.legs.originViaCf.ok ? 'ok' : 'bad'} />
                  <span className="text-[10px] tracking-[0.12em] text-muted-foreground">
                    {t('edgeControlLeg')}
                  </span>
                  <span
                    className={cn(
                      'wb-num ml-auto text-[14px] font-semibold',
                      isNum(edge.legs.originViaCf.totalMs)
                        ? 'text-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {isNum(edge.legs.originViaCf.totalMs)
                      ? fmtInt(edge.legs.originViaCf.totalMs)
                      : '—'}
                    <span className="ml-0.5 text-[11px] text-muted-foreground">{t('unitMs')}</span>
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {(
                    [
                      ['edgeHomepage', edge.legs.edgeHomepage],
                      ['apexRedirect', edge.legs.apexRedirect],
                      ['edgeStatic', edge.legs.edgeStatic],
                    ] as const
                  ).map(([legKey, leg]) => (
                    <div
                      key={legKey}
                      className="flex items-center gap-2 rounded-md border border-border bg-muted/60 px-2.5 py-1.5"
                    >
                      <Dot tone={leg.ok ? 'ok' : 'bad'} />
                      <span className="text-[10px] tracking-[0.12em] text-muted-foreground">
                        {t(EDGE_LEG_LABEL[legKey])}
                      </span>
                      <span
                        className={cn(
                          'wb-num ml-auto text-[13px] font-semibold',
                          isNum(leg.totalMs) ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {isNum(leg.totalMs) ? fmtInt(leg.totalMs) : '—'}
                        <span className="ml-0.5 text-[10px] text-muted-foreground">
                          {t('unitMs')}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="min-h-0 flex-1">
                  <div className="mb-1 text-[10px] tracking-[0.14em] text-muted-foreground">
                    {t('edgeSparkTitle')}
                  </div>
                  <div className="relative">
                    <EChart option={edgeOption} height={116} />
                    {edge.series.length === 0 ? <ChartEmpty text={t('edgeNoSeries')} /> : null}
                  </div>
                </div>
              </>
            )}
          </Panel>

          {/* 访客与机器人(2026-10-23):PV/UV + 真人 vs 自动化 + 客户端族构成 */}
          <Panel
            title={t('panelTrafficRobot')}
            icon={<Users className="h-3.5 w-3.5" />}
            className="wb-c6"
            right={
              traffic === null ? (
                <SourceGap text={t('sourceUnreachable')} />
              ) : isNum(traffic.aggregationAgeSec) ? (
                <span className="text-[10px] text-muted-foreground">
                  {t('trafficAggAge', { ago: fmtDuration(traffic.aggregationAgeSec) })}
                </span>
              ) : null
            }
            bodyClassName="wb-split"
          >
            <div>
              <div className="wb-cells wb-cells-6 grid gap-1.5">
                <StatCell
                  label={t('pv24h')}
                  value={fmtInt(traffic?.pv24h)}
                  unit={t('unitPv')}
                  tone="accent"
                />
                <StatCell
                  label={t('uv24h')}
                  value={fmtInt(traffic?.uv24h)}
                  unit={t('unitUser')}
                  tone="ok"
                />
                <StatCell
                  label={t('humanPv')}
                  value={fmtInt(traffic?.humanPv24h)}
                  unit={t('unitPv')}
                />
                <StatCell
                  label={t('botPv')}
                  value={fmtInt(traffic?.botPv24h)}
                  unit={t('unitPv')}
                  tone="warn"
                />
                <StatCell
                  label={t('pv1h')}
                  value={fmtInt(traffic?.pv1h)}
                  unit={t('unitPv')}
                  tone="accent"
                />
                <StatCell
                  label={t('uv1h')}
                  value={fmtInt(traffic?.uv1h)}
                  unit={t('unitUser')}
                  tone="ok"
                />
              </div>
              {traffic?.truncated ? (
                <div className="mt-1.5 text-[10px] text-warning-text">{t('trafficTruncated')}</div>
              ) : null}
            </div>
            <div>
              <div className="mb-1.5 text-[10px] tracking-[0.14em] text-muted-foreground">
                {t('familyBreakdown')}
              </div>
              <div className="space-y-1">
                {(traffic?.families ?? []).slice(0, 6).map((f) => (
                  <div
                    key={f.family}
                    className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1"
                  >
                    <span className="truncate text-[10px] text-foreground">{f.family}</span>
                    <span className="wb-num ml-auto shrink-0 text-[10px] text-info-text">
                      {fmtCompact(f.pv)}
                    </span>
                  </div>
                ))}
                {traffic === null ? (
                  <div className="flex justify-center px-2 py-3">
                    <SourceGap text={t('sourceUnreachable')} />
                  </div>
                ) : traffic.families.length === 0 ? (
                  <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                    {t('noTrafficData')}
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          {/* AI 号池:key 池 / 账号池 / token 临期(后端现读两张池表 + 5 秒缓存,取不到一律"—") */}
          <Panel
            title={t('panelRelayPool')}
            icon={<Sparkles className="h-3.5 w-3.5" />}
            className="wb-c6"
            right={
              relayPool === null ? (
                <SourceGap text={t('sourceUnreachable')} />
              ) : isNum(relayPool.staleAgeSec) ? (
                <span className="text-[10px] text-muted-foreground">
                  {t('poolStale')} {fmtDuration(relayPool.staleAgeSec)}
                </span>
              ) : null
            }
            bodyClassName="wb-split"
          >
            <div>
              <div className="mb-1.5 text-[10px] tracking-[0.14em] text-muted-foreground">
                {t('poolKey')}
              </div>
              <div className="wb-cells grid gap-1.5">
                <StatCell
                  label={t('poolKeySchedulable')}
                  value={`${fmtInt(relayPool?.keySchedulable)} / ${fmtInt(relayPool?.keyTotal)}`}
                  tone="accent"
                />
                <StatCell
                  label={t('poolKeyAbnormal')}
                  value={fmtInt(relayPool?.keyAbnormal)}
                  tone={
                    !isNum(relayPool?.keyAbnormal)
                      ? 'unknown'
                      : (relayPool?.keyAbnormal ?? 0) > 0
                        ? 'warn'
                        : 'ok'
                  }
                />
                <StatCell
                  label={t('poolRowsUnclassified')}
                  value={fmtInt(relayPool?.rowsUnclassified)}
                  tone={
                    !isNum(relayPool?.rowsUnclassified)
                      ? 'unknown'
                      : (relayPool?.rowsUnclassified ?? 0) > 0
                        ? 'warn'
                        : 'ok'
                  }
                />
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[10px] tracking-[0.14em] text-muted-foreground">
                {t('poolAccount')}
              </div>
              <div className="wb-cells grid gap-1.5">
                <StatCell
                  label={t('poolAccountSchedulable')}
                  value={`${fmtInt(relayPool?.accountsSchedulable)} / ${fmtInt(relayPool?.accountsTotal)}`}
                  tone="ok"
                />
                <StatCell
                  label={t('poolTokenExpiry')}
                  value={
                    !isNum(relayPool?.minTokenExpiresInSeconds)
                      ? '—'
                      : relayPool.minTokenExpiresInSeconds < 0
                        ? t('expired')
                        : fmtDuration(relayPool.minTokenExpiresInSeconds)
                  }
                  tone={
                    !isNum(relayPool?.minTokenExpiresInSeconds)
                      ? 'unknown'
                      : relayPool.minTokenExpiresInSeconds < 0
                        ? 'bad'
                        : relayPool.minTokenExpiresInSeconds < 86400
                          ? 'warn'
                          : 'ok'
                  }
                />
                <StatCell
                  label={t('accountRefreshAge')}
                  value={
                    !isNum(relayPool?.accountRefreshAgeSec)
                      ? '—'
                      : fmtDuration(relayPool.accountRefreshAgeSec)
                  }
                  tone={
                    !isNum(relayPool?.accountRefreshAgeSec)
                      ? 'unknown'
                      : relayPool.accountRefreshAgeSec >= 3600
                        ? 'warn'
                        : 'ok'
                  }
                />
              </div>
            </div>
          </Panel>

          {/* 进程运行时长:http.uptimeSeconds(各进程自启动起运行时长,后端已返回,此前仅在页脚) */}
          <Panel
            title={t('panelUptime')}
            icon={<Clock3 className="h-3.5 w-3.5" />}
            className="wb-c6"
            right={http === null ? <SourceGap text={t('sourceUnreachable')} /> : null}
            bodyClassName="max-h-[320px] overflow-y-auto"
          >
            {(http?.uptimeSeconds ?? []).length === 0 ? (
              <div className="flex justify-center py-3">
                <SourceGap text={t('sourceUnreachable')} />
              </div>
            ) : (
              <div className="space-y-1">
                {(http?.uptimeSeconds ?? []).map((u) => (
                  <div
                    key={u.job}
                    className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1"
                  >
                    <span className="wb-num truncate text-[11px] text-foreground">{u.job}</span>
                    <span className="wb-num ml-auto shrink-0 text-[11px] text-info-text">
                      {fmtDuration(u.seconds)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </section>

        <footer className="flex items-center justify-between px-5 pt-1 pb-2 text-[10px] text-muted-foreground">
          <span>{t('footerSources', { url: ov?.prometheusUrl ?? '—' })}</span>
          <span className="wb-num">
            {t('footerUptime', {
              list:
                (http?.uptimeSeconds ?? [])
                  .map((u) => `${u.job} ${fmtDuration(u.seconds)}`)
                  .join('  |  ') || '—',
            })}
          </span>
        </footer>
      </div>
    </TooltipProvider>
  )
}

// ===================== 大屏专属样式(切角/辉光/扫描线/等宽数字) =====================

const WALLBOARD_CSS = `
.wb-root {
  --wb-font-display: 'Bahnschrift', 'DIN Alternate', 'Oswald', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --wb-font-num: 'JetBrains Mono', 'Cascadia Mono', 'Consolas', 'Bahnschrift', monospace;
  /* 刻意不给底:大屏直接坐在工作区自己的背景上(机主 2026-10-20 定档:灰底 + 网格线是多余的一层壳)。 */
}
.wb-display { font-family: var(--wb-font-display); }
.wb-num {
  font-family: var(--wb-font-num);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
/* 面板形状只认圆角档位(机主 2026-10-22 定档:切角与 rounded-* 叠在一起,每个容器角都被剪掉一块、
 * 边框在斜切处断开,读起来像渲染坏了)。HUD 感改由下面的内辉光 + 页头扫描线承担。
 * 内辉光单拆成变量:hover 浮起时 .ui-lift 会整条覆盖 box-shadow,若把内辉光写死在同一条声明里,
 * 面板一浮起就会"变平"(辉光消失)。浮起只换**外阴影**那一层。 */
.wb-panel {
  --wb-inset: inset 0 0 24px color-mix(in srgb, var(--color-info) 6%, transparent);
  /* 静止档收回到规范淡影(= --shadow-premium 的 0 2px 8px / black-6)。
     原先这里写的是 0 8px 26px / black-20(2026-10-18 HUD 改版自创,超规范三倍),
     结果是**不 hover 也带着大投影**,而 hover 的 lift 影只比它大 4px —— 差值读不出来,
     机主两轮"没区别/没立体感"的真正根因就在这条静止影上。投影只该属于浮起态。 */
  box-shadow: var(--wb-inset), 0 2px 8px var(--color-black-6);
}
.wb-panel.ui-lift:hover {
  box-shadow: var(--wb-inset), var(--lift-shadow);
}
.dark .wb-panel.ui-lift:hover {
  box-shadow: var(--wb-inset), var(--lift-shadow-dark);
}
.wb-header::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--color-info) 55%, transparent),
    color-mix(in srgb, var(--chart-5) 45%, transparent),
    transparent
  );
  animation: wb-scan 6s linear infinite;
}
@keyframes wb-scan {
  0% { transform: translateX(-30%); opacity: 0.5; }
  50% { transform: translateX(30%); opacity: 1; }
  100% { transform: translateX(-30%); opacity: 0.5; }
}
/* 页头按容器判定,不按视口:三簇 nowrap 实测宽 326(标题)+251(数据源)+331(状态)=997,
 * 嵌进 ~900px 面板时视口 lg: 仍算"宽"⇒ 中文被逐字断行。996 取 N-1 防临界抖动;
 * 再窄(≤ 标题326+状态331+间距32=689)不另设档,由标题/副标题的 truncate 兜底成单行省略号。 */
.wb-header { container-type: inline-size; }
/* 均匀列网格:列数由容器宽决定,不再用视口断点(实测容器宽与视口不同步)。
 * 104 = 实测最大标签需求 99px + 余量;135 = 反算自原设计(容器 914 时 6 栏、gap 10 ⇒ 6×135+5×10=860≤882)。
 * 缺这两条定义 ⇒ display:grid 无列模板会退化成单列竖排(本仓 2026-10-21 实测回归)。 */
.wb-cells { grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); }
/* 6 格一组(Redis / 访客):auto-fit 在半宽面板里只能排 5 列 ⇒ 第 6 格单独一行。
 * 这里固定 3 列 ×2 行(总行数与 5+1 相同,但不再出现孤格);<480 落 2 列。 */
.wb-cells-6 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@container (max-width: 479px) { .wb-cells-6 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.wb-cells-lg { grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); }
/* KPI 带按容器宽分档:1440 视口下容器 ~786px,auto-fit(135) 只排 5 列,第 6 张会单独
 * 占一行的 1/5(实测 2026-10-24)。≥900 六列一行、600–899 三列两行、<600 两列。 */
@container (min-width: 900px) { .wb-cells-lg { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
@container (min-width: 600px) and (max-width: 899px) { .wb-cells-lg { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@container (max-width: 599px) { .wb-cells-lg { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.wb-hdr-title h1, .wb-hdr-title p, .wb-hdr-status, .wb-hdr-sources { white-space: nowrap; }
@container (max-width: 996px) {
  /* 窄容器只收掉文字、保留四个状态点(悬停 Tooltip 给全名),不再整块隐藏数据源 */
  .wb-src-name { display: none; }
}
/* .wb-scroll-host 的 container-type 已迁 app/globals.css(与 .ai-input-toolbar/.account-card 同族);
 * 它原本住在这里 ⇒ 只在 wallboard 视图挂载,面板视图没有容器,@container 会退回按视口判定。
 *
 * 主体网格按容器分档(2026-10-22):原实现靠视口 xl:grid-cols-12,而项目 xl 断点 = 1920px
 * ⇒ 视口 1920 以下整片单列(实测 1600 视口、容器 914 时滚 4 屏)。改为三档:
 *   ≥1150 12 栏 = 原设计三列(3/3/6 · 4/3/5 · 5/7);
 *   620–1149 6 栏 = 两列,映射 3/4/5→半宽、6/7→全宽,按源码顺序零空位;
 *   <620 单列(手机)。
 * 面板内部的两栏(告警/业务)也按面板自身宽度判定(.wb-panel 是容器),不再按视口 md:。 */
.wb-panel { container-type: inline-size; }
.wb-grid { grid-template-columns: repeat(12, minmax(0, 1fr)); }
.wb-c3 { grid-column: span 3; }
.wb-c4 { grid-column: span 4; }
.wb-c5 { grid-column: span 5; }
.wb-c6 { grid-column: span 6; }
.wb-c7 { grid-column: span 7; }
.wb-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}
@container (max-width: 1149px) {
  .wb-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .wb-c3, .wb-c4, .wb-c5 { grid-column: span 3; }
  .wb-c6, .wb-c7 { grid-column: span 6; }
}
@container (max-width: 619px) {
  .wb-grid { grid-template-columns: minmax(0, 1fr); }
  .wb-grid > * { grid-column: auto; }
}
/* 半宽面板(约 440px)内部两栏会把 11px 文本挤成 2-3 字一行 ⇒ 只有面板自身够宽才开两栏 */
@container (min-width: 620px) {
  .wb-split { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
/* 窄容器:状态区落到第二行右对齐,标题不再被逐字挤压 */
@container (max-width: 1023px) {
  .wb-header { flex-wrap: wrap; }
  .wb-hdr-status { width: 100%; justify-content: flex-end; }
}
/* fill-mode 用 backwards 而不是 both:both 会在动画结束后**永久占住 transform**
 * (动画优先级高于普通作者声明),把 hover 浮起的 transform 整个吃掉 —— 实测这些卡片
 * 内联 !important 都改不动 scale/transform。backwards 只在延迟期套首帧,结束即交还。 */
.wb-rise { animation: wb-rise 0.55s ease-out backwards; }
@keyframes wb-rise {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
.wb-root ::-webkit-scrollbar { width: 6px; height: 6px; }
.wb-root ::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--color-muted-foreground) 55%, transparent);
  border-radius: var(--radius-xs);
}
.wb-root ::-webkit-scrollbar-track { background: transparent; }
`
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
