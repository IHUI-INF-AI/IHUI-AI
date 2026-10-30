// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'
import { isNum, isUnset, thresholdTone, type StatusTone } from './unknown-state'
import { DATA_TZ, tzParts } from './data-time'

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
  ArrowRight,
  BarChart3,
  Bell,
  Clock3,
  Cpu,
  Database,
  Gauge,
  Globe,
  Layers,
  LineChart,
  MousePointerClick,
  Route,
  Share2,
  UserRoundCheck,
  Waypoints,
  HardDrive,
  Maximize2,
  Minimize2,
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
import { useAiPanelStore } from '@/stores/ai-panel'
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
  rnRadius,
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
  /** 近 24h 页面访问排行(visit_logs 口径);null = 页面热度腿取不到 */
  pageTop?: TrafficPageRow[] | null
  /** 近 24h 同口径总 PV(排行的占比分母);null = 同一条腿取不到 */
  pageTotalPv?: number | null
  /** 近 24h 各访问面(前台/后台/登录页);null = 同一条腿取不到 */
  scopeSplit?: Array<{ scope: string; pv: number; uv: number }> | null
  /** 近 24h 各端(web/rn/mp/ex);null = 同一条腿取不到 */
  platformSplit?: TrafficPlatformRow[] | null
  /** 近 5 分钟去重会话数(实时在线近似);null = 同一条腿取不到 */
  online5m?: number | null
  pv5m?: number | null
  /** 近 24h 逐小时 PV/UV(滚动窗口,24 个桶);null = 同一条腿取不到 */
  pageHourly?: Array<{ hour: string; pv: number; uv: number }> | null
  /** 近 24h 会话质量;null = 同一条腿取不到 */
  sessionQuality?: SessionQuality | null
  /** 近 24h 访问来源;null = 同一条腿取不到 */
  visitSource?: VisitSource | null
  /** 近 24h 相邻页对;null = 同一条腿取不到 */
  visitTransition?: VisitTransition | null
  /** 近 24h 各页平均停留;null = 同一条腿取不到 */
  pageDwell?: Array<{ url: string; avgDwellSec: number | null; samples: number }> | null
}

interface TrafficPageRow {
  url: string
  scope: string
  platform: string
  pv: number
  uv: number
}

interface TrafficPlatformRow {
  platform: string
  pv: number
  uv: number
  /** 近 90 日 PV —— 把"这端从没上报过"与"今天恰好没人用"分开 */
  pv90d: number
  lastSeenAt: string | null
}

interface SessionQuality {
  sessions: number
  singlePageSessions: number
  singlePageRate: number | null
  avgPvPerSession: number | null
  depth: Array<{ bucket: string; sessions: number }>
  entryPages: Array<{ url: string; sessions: number; singlePageSessions: number }>
  exitPages: Array<{ url: string; sessions: number; singlePageSessions: number }>
}

interface VisitSource {
  totalPv: number
  buckets: Array<{ kind: string; pv: number }>
  hosts: Array<{ host: string; kind: string; pv: number }>
  splitInternal: boolean
}

interface VisitTransition {
  totalMoves: number
  distinctPairs: number
  top: Array<{ fromUrl: string; toUrl: string; n: number }>
}

interface EngagementSnapshot {
  events: Array<{ event: string; n: number }>
  clickTop: Array<{ label: string; n: number }>
  avgPageTimeSec: number | null
  totalEvents: number
}

interface AudienceSnapshot {
  newUv: number
  returningUv: number
  activeUv: number
  returningRate: number | null
}

interface RelayPoolSnapshot {
  /** key 池:总行数 / 健康态可判定行数 / 可调度 / 异常(可调度与异常不互斥) */
  keyTotal: number | null
  keyClassified?: number | null
  keySchedulable: number | null
  keyAbnormal: number | null
  /** 异常 key 里仍能被选中的条数 */
  keyAbnormalSchedulable?: number | null
  /** 余额 < 5 元且非"无限"的可调度 key 条数 */
  keyBalanceLow?: number | null
  /** key 池脏健康态行数 */
  keyRowsUnclassified?: number | null
  /** 账号池:总行数 / 健康态可判定行数 / 可调度 / 不可调度 / 其中已过期 */
  accountsTotal: number | null
  accountClassified?: number | null
  accountsSchedulable: number | null
  accountsBlocked?: number | null
  accountsBlockedExpired?: number | null
  /** 账号池脏健康态行数 */
  accountRowsUnclassified?: number | null
  /** **可调度账号**里最短 token 临期(秒;负 = 已过期) */
  minTokenExpiresInSeconds: number | null
  /** 这份快照距今多少秒(后端 5 秒缓存 + 5 秒轮询 ⇒ 常为 0..5) */
  staleAgeSec: number | null
  /** 全池**最久**未刷新的账号距今(秒);null = 没有任何账号带刷新戳 */
  accountRefreshAgeSec?: number | null
  /** 全池**最近一次**刷新距今(秒) */
  accountLatestRefreshAgeSec?: number | null
  /** 空闲保活窗口(天;null = 该档被 env 关闭) */
  keepaliveIdleDays?: number | null
  /** 两张池合计的脏健康态行数(旧后端只有这一个字段) */
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
  /** 交互热度(analytics_events 聚合);null/undefined = 取不到,读数落「—」 */
  engagement?: EngagementSnapshot | null
  /** 访客构成(新访客/回访/回访率);null/undefined = 取不到,读数落「—」 */
  audience?: AudienceSnapshot | null
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
  // 时钟也必须走数据侧时区:值班机换个系统时区,读数就会与服务端聚合错开一整天,
  // 而画面看着完全正常(见 data-time.ts 头注)。
  const p = tzParts(d)
  return `${p.dateKey} ${p.hms}`
}

/**
 * 秒级时钟独立成件:原先父组件每秒 setState,整棵树(17 个面板 + 全部图表容器)跟着
 * 重渲染;数据年龄与「今天第几小时」只需要 5s 粒度,秒级刷新收在时钟自己身上。
 */
function LiveClock() {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <div className="wb-num text-[13px] leading-tight font-semibold tabular-nums text-foreground">
      {fmtClockDigits(now)}
    </div>
  )
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
      // 0 位不写出来:「1天0小时」「3天0小时」在运行时长/临期里读着像精度丢失。
      if (d > 0) return h > 0 ? t('durationDays', { d, h }) : t('durationDaysOnly', { d })
      const m = Math.floor((seconds % 3600) / 60)
      if (h > 0) return m > 0 ? t('durationHours', { h, m }) : t('durationHoursOnly', { h })
      return t('durationMins', { m })
    },
    fmtClock(iso: string | null | undefined): string {
      if (!iso) return '—'
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return '—'
      return tzParts(d).hms
    },
    /** 事件流用:当天只显示时分秒,跨天补 MM-DD(否则隔夜事件看不出哪一天)。
     *  「今天」按数据侧时区判定 —— 用浏览器时区会把跨零点的隔夜事件当成本日。 */
    fmtStamp(iso: string | null | undefined): string {
      if (!iso) return '—'
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return '—'
      const p = tzParts(d)
      if (p.dateKey === tzParts(new Date()).dateKey) return p.hms
      const md = d.toLocaleDateString(locale, {
        month: '2-digit',
        day: '2-digit',
        timeZone: DATA_TZ,
      })
      return `${md} ${p.hms}`
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
  hint,
}: {
  label: string
  value: string
  unit?: string
  tone?: StatusTone | 'accent'
  /** 第二行小字:解释读数口径(如"其中仍可选中 2"),不参与配色判定 */
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/60 px-2.5 py-2">
      <div className="text-[10px] tracking-[0.12em] text-muted-foreground">{label}</div>
      <div
        className={cn(
          'wb-num whitespace-nowrap mt-0.5 text-[18px] leading-tight font-semibold',
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
      {hint ? (
        <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  )
}

/**
 * 面板内的「标签 + 读数」一行。label 与 value 必须是同一父节点下的纯文本元素 ——
 * 面板测试按 `parentElement.textContent` 逐行断言(如「新访客28」),中间不能夹包装层。
 * `note` 是行内状态标记(如「今日静默」),不参与读数。
 */
function MeterRow({
  label,
  value,
  note,
  tone,
}: {
  label: string
  /** 复合读数(如 `4,200 / 300`)请拆成多个元素传进来:面板测试按**精确文本**取单个数字 */
  value: React.ReactNode
  note?: string
  tone?: StatusTone
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1">
      <span className="min-w-0 truncate text-[10px] text-foreground">{label}</span>
      {note ? <span className="shrink-0 text-[9px] text-muted-foreground">{note}</span> : null}
      <span
        className={cn(
          'wb-num ml-auto shrink-0 text-[10px]',
          tone === 'bad'
            ? 'text-danger-text'
            : tone === 'warn'
              ? 'text-warning-text'
              : 'text-info-text',
        )}
      >
        {value}
      </span>
    </div>
  )
}

/**
 * 页面排行里的端前缀(四端同表):web 写裸路径,RN/小程序/插件按埋点前缀拆出来单独着色 ——
 * 否则「这个页面是谁在用」在大屏上读不出来。
 */
function platformPrefixOf(url: string): { prefix: string | null; rest: string; tone: string } {
  if (url.startsWith('/rn/')) return { prefix: '/rn/', rest: url.slice(4), tone: 'text-violet-400' }
  if (url.startsWith('/mp/')) return { prefix: '/mp/', rest: url.slice(4), tone: 'text-amber-400' }
  if (url.startsWith('/ex/'))
    return { prefix: '/ex/', rest: url.slice(4), tone: 'text-emerald-400' }
  return { prefix: null, rest: url, tone: '' }
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
  // 值班态强制暗色(手动 class,见下方 duty 逻辑);图表配色沿用同一个 isDark。
  const [dutyMode, setDutyMode] = React.useState(false)
  const isDark = resolvedTheme === 'dark' || dutyMode
  const { fmtInt, fmtCompact, fmtRate, fmtDuration, fmtClock, fmtStamp, fmtAgo } = makeFmt(
    locale,
    t,
  )
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    // 只服务数据年龄(15s 阈值)与当前小时;秒级刷新由 <LiveClock /> 自己承担。
    const timer = setInterval(() => setNow(new Date()), 5000)
    return () => clearInterval(timer)
  }, [])

  // 浏览器标签跟随视图:承载页的 metadata 是「监控面板」,大屏挂机时标签仍读作面板页。
  React.useEffect(() => {
    const prev = document.title
    document.title = t('title')
    return () => {
      document.title = prev
    }
  }, [t])

  // ---------- 值班全屏:隐藏左侧 AI 工作区 + 浏览器全屏 + 固定深色 ----------
  const prevAiPanelOpen = React.useRef(true)
  const prevHadDarkClass = React.useRef(false)
  const dutyActiveRef = React.useRef(false)

  // 退出值班的唯一回收口:面板、强制暗色、态三者一起还原,任何一条退出路径(再点/Esc/切走)都走它。
  const restoreDutyState = React.useCallback(() => {
    dutyActiveRef.current = false
    setDutyMode(false)
    // 只在进入前本来不是深色时才摘 class(用户本来就是深色主题则保持)。
    if (!prevHadDarkClass.current) document.documentElement.classList.remove('dark')
    if (prevAiPanelOpen.current) useAiPanelStore.getState().openPanel()
  }, [])

  const toggleDutyMode = React.useCallback(async () => {
    if (!dutyActiveRef.current) {
      prevAiPanelOpen.current = useAiPanelStore.getState().open
      dutyActiveRef.current = true
      // 手动加 class 而不调 next-themes.setTheme:实测该环境下 setTheme 调用后
      // class/localStorage 均不变且会连带把刚关闭的 AI 面板重新打开(2026-10-24 取证),
      // 值班只需一段临时暗色,不必改写用户的主题偏好。
      prevHadDarkClass.current = document.documentElement.classList.contains('dark')
      document.documentElement.classList.add('dark')
      useAiPanelStore.getState().closePanel()
      setDutyMode(true)
      try {
        await document.documentElement.requestFullscreen?.()
      } catch {
        // 浏览器拒绝全屏时仍保持「隐藏 AI 面板」的紧凑态,按钮可再次点击退出。
      }
      return
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
    } catch {
      // 已经不在全屏时忽略
    }
    restoreDutyState()
  }, [restoreDutyState])

  // 用户按 Esc 退出全屏时把值班态一并回收(不能留下「面板被关着/主题被改」的残局)。
  React.useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && dutyActiveRef.current) restoreDutyState()
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [restoreDutyState])

  // 切走视图(TabsContent 卸载)同样回收。
  React.useEffect(
    () => () => {
      if (dutyActiveRef.current) restoreDutyState()
    },
    [restoreDutyState],
  )

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
  const engagement = ov?.engagement ?? null
  const audience = ov?.audience ?? null
  const edge = ov?.edge ?? null

  // 号池面板口径(2026-10-30):分母取"健康态可判定行数",脏值行单独成格(两池合计,
  // 一格就能保证任何一侧出现脏值都亮)。老后端没有分池字段时分母回落到总行数 ——
  // undefined 绝不能渲成 0(§0.3)。
  const poolKeyDenom = isNum(relayPool?.keyClassified)
    ? relayPool.keyClassified
    : (relayPool?.keyTotal ?? null)
  const poolAccountDenom = isNum(relayPool?.accountClassified)
    ? relayPool.accountClassified
    : (relayPool?.accountsTotal ?? null)
  // "最久未刷新"的判色上限 = 空闲保活窗口(后端 env 单源)。取不到窗口就不判色:
  // 刷新是"临期档(24h 内到期)+ 7 天空闲保活"的按需节奏,不是每小时刷全池,
  // 用 1 小时之类的拍脑袋阈值会把正常闲置读成故障(旧版就是这么常黄的)。
  const poolRefreshBudgetSec = isNum(relayPool?.keepaliveIdleDays)
    ? relayPool.keepaliveIdleDays * 86_400
    : null

  // 告警数 = Alertmanager 活跃 ∪ 库内 firing(按告警名去重):
  // 告警桥会把同一告警同步落库,两路直接相加会重复计数
  const promAlertNames = React.useMemo(
    () => new Set((alerts?.promActive ?? []).map((a) => a.name)),
    [alerts?.promActive],
  )
  const alertCount: number | null =
    alerts === null
      ? null
      : // Alertmanager 不可达(promActiveCount=null)且库内也没有 firing 时,只能算「未判定」:
        // 0 在这里会被读成「确认没有告警」,与下方面板的 alertmanagerDown 自相矛盾。
        alerts.promActiveCount === null && (alerts.firingNames ?? []).length === 0
        ? null
        : (alerts.promActiveCount ?? 0) +
          (alerts.firingNames ?? []).filter((n) => !promAlertNames.has(n)).length
  // 退役服务(见路由 RETIRED_SERVICES)不计入健康度分母,避免状态灯恒黄。
  // alerts 块或 services 块不可达 ⇒ 'unknown'(§0.3:「没判」不得渲染成「全域正常 / 0 告警」)。
  // 核心数据源断掉时不能仍报「全域正常」:Prometheus / 业务库是这张屏的主判据,
  // 它们不可达等于「没判」,按 §0.3 落 unknown 而不是把其余绿灯当成结论。
  const coreSourceDown = ov?.sources?.prometheus === 'down' || ov?.sources?.database === 'down'
  const overallTone: StatusTone =
    ov === undefined || alerts === null || coreSourceDown
      ? 'unknown'
      : alertCount !== null && alertCount > 0
        ? 'warn'
        : // 告警面不可达(Alertmanager 没回数据)时同样不能落「正常」。
          alerts.promActive === null
          ? 'unknown'
          : services === null
            ? 'unknown'
            : services.windowsRunning < services.windowsExpectedTotal ||
                services.targetsUp < services.targetsTotal
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
          tooltip: { valueFormatter: (v) => `${v} ${t('axisReqPerSec')}` },
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
          // 轴被隐藏(错误率走独立刻度),数值只能从 tooltip 读 ⇒ 必须带百分号。
          tooltip: { valueFormatter: (v) => `${v}%` },
          ...seriesGlow(CHART_RED),
        },
        {
          name: t('legendP95'),
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          showSymbol: false,
          data: (trend?.p95Ms ?? []).map(([, v]) => Number(v.toFixed(1))),
          tooltip: { valueFormatter: (v) => `${v} ${t('unitMs')}` },
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
    // 与磁盘/迷你条同一套阈值语义:70% 转琥珀、90% 转红;无读数时保留基色(进度环本身不画)。
    const meterColor = (v: number | null, base: string) =>
      v === null ? base : v >= 90 ? CHART_RED : v >= 70 ? CHART_AMBER : base
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
          // 取不到读数时不画进度环:环停在 0 会被读成「空闲且健康」(detail 已显示 —)。
          progress: {
            show: cpuValue !== null,
            width: 8,
            itemStyle: { color: meterColor(cpuValue, CHART_CYAN) },
          },
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
          progress: {
            show: memValue !== null,
            width: 8,
            itemStyle: { color: meterColor(memValue, CHART_VIOLET) },
          },
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
    // 横向条形替代环图:2xx 常占 99%+,环图里 3/4/5xx 只剩肉眼不可辨的细缝,标签还得靠
    // 引线挤出图外互相压字;逐行条形的长度差异 + 端点数字都能直接读。
    const rows = (http?.statusRates ?? []).filter((s) => s.rate > 0)
    const total = rows.reduce((acc, s) => acc + s.rate, 0)
    // y 轴自下而上排列,倒序后 2xx 落在最上方(占比最大的先读到)。
    const ordered = [...rows].reverse()
    const data = ordered.map((s) => ({
      value: total > 0 ? Number(((s.rate / total) * 100).toFixed(2)) : 0,
      itemStyle: { color: klassColor[s.klass] ?? chartText(isDark), borderRadius: rnRadius.xs },
    }))
    return {
      grid: { left: 44, right: 56, top: 10, bottom: 20 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: chartBg(isDark),
        borderColor: chartAxis(isDark),
        textStyle: { color: fg(isDark), fontSize: 11 },
        valueFormatter: (v) => `${v}%`,
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: 100,
        ...AXIS(isDark),
        axisLabel: { color: chartText(isDark), fontSize: 9, formatter: '{value}%' },
      },
      yAxis: {
        type: 'category',
        data: ordered.map((s) => s.klass),
        ...AXIS(isDark),
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      series: [
        {
          type: 'bar',
          data,
          barWidth: 14,
          label: {
            show: true,
            position: 'right',
            color: chartText(isDark),
            fontSize: 10,
            formatter: '{c}%',
          },
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
          tooltip: { valueFormatter: (v) => `${v}%` },
          // 90% 是仪表转红的同一道线,画出来让「离红线还有多远」不必心算。
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: { color: withAlpha(CHART_RED, 0.55), type: 'dashed', width: 1 },
            data: [{ yAxis: 90 }],
          },
          ...seriesGlow(CHART_CYAN),
        },
        {
          name: t('memLegend'),
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: (trend?.memPct ?? []).map(([, v]) => Number(v.toFixed(2))),
          tooltip: { valueFormatter: (v) => `${v}%` },
          ...seriesGlow(CHART_VIOLET),
        },
      ],
    }
  }, [trend, locale, t, isDark])

  // 只画到今天当前小时:把未到的时段画成 0 柱会被读成「这些时段没有流量」。
  const nowHour = tzParts(now).hour
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
          // 最后一根 = 当前小时(未来时段已截掉),单独用纯色提亮,方便一眼定位「现在」。
          data: hours.map((h, i) => ({
            value: byHour.get(h) ?? 0,
            ...(i === hours.length - 1 ? { itemStyle: { color: CHART_CYAN } } : {}),
          })),
          barWidth: '62%',
          tooltip: { valueFormatter: (v) => `${Number(v).toLocaleString(locale)} ${t('unitPv')}` },
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
  }, [trend?.hourlyCalls, isDark, nowHour, t, locale])

  /**
   * 分时访问(滚动 24h,visit_logs 口径):与上面「今日分时调用」不是同一条腿 ——
   * 那条是当日累计、未来小时不得画 0 柱;这条窗口内 24 个桶各出现一次,
   * 空桶是该小时真没人(服务端不出空桶 ⇒ 只画回来的桶)。
   */
  const visitsHourlyOption = React.useMemo<EChartsOption>(() => {
    const rows = traffic?.pageHourly ?? []
    return {
      grid: { left: 36, right: 12, top: 18, bottom: 20 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: chartBg(isDark),
        borderColor: chartAxis(isDark),
        textStyle: { color: fg(isDark), fontSize: 11 },
      },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: chartText(isDark), fontSize: 10 },
        data: [t('visitHourlyPv'), t('visitHourlyUv')],
      },
      xAxis: { type: 'category', data: rows.map((r) => r.hour), ...AXIS(isDark) },
      yAxis: { type: 'value', ...AXIS(isDark) },
      series: [
        {
          name: t('visitHourlyPv'),
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: rows.map((r) => r.pv),
          lineStyle: { width: 1.5 },
          areaStyle: { opacity: 0.12 },
        },
        {
          name: t('visitHourlyUv'),
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: rows.map((r) => r.uv),
          lineStyle: { width: 1.5 },
        },
      ],
    }
  }, [traffic?.pageHourly, isDark, t])

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
          tooltip: { valueFormatter: (v) => `${Number(v).toLocaleString(locale)} ${t('unitPv')}` },
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
  }, [biz?.llmTopModels, isDark, t, locale])

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
          tooltip: {
            valueFormatter: (v) => `${Number(v).toLocaleString(locale)} ${t('unitUser')}`,
          },
          itemStyle: { borderRadius: [3, 3, 0, 0], color: withAlpha(CHART_GREEN, 0.85) },
          label: { show: true, position: 'top', color: chartText(isDark), fontSize: 9 },
        },
      ],
    }
  }, [biz?.signIn?.last7d, isDark, t, locale])

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
        splitNumber: 3,
        axisLabel: { color: chartText(isDark), fontSize: 9 },
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
          tooltip: { valueFormatter: (v) => `${v} ${t('unitMs')}` },
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
    // 空序列 ≠ 「窗口内没有 5xx」:查询无数据时不能凭 0 条样本发好消息(§0.3)。
    trend.errRate.length > 0 &&
    trend.errRate.every(([, v]) => v === 0) ? (
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
                <span
                  role="img"
                  aria-label={name}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] text-foreground"
                >
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
                  : alertCount > 0
                    ? 'border-destructive/30 bg-destructive/10 text-danger-text'
                    : 'border-border bg-muted/60 text-muted-foreground',
              )}
            >
              <Bell className="h-3 w-3" />
              {alertCount === null
                ? t('alertCountUnknown')
                : t('alertCount', { count: alertCount })}
            </span>
            <div className="text-right">
              <LiveClock />
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
            <Tooltip content={dutyMode ? t('exitDutyMode') : t('dutyMode')}>
              <button
                type="button"
                onClick={() => void toggleDutyMode()}
                aria-pressed={dutyMode}
                aria-label={dutyMode ? t('exitDutyMode') : t('dutyMode')}
                className="flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] text-foreground transition-colors hover:bg-muted"
              >
                {dutyMode ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                <span className="wb-src-name">{dutyMode ? t('exitDutyMode') : t('dutyMode')}</span>
              </button>
            </Tooltip>
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
              tone: thresholdTone(http?.errRate, (n) =>
                n > 0.01 ? 'bad' : n > 0.001 ? 'warn' : 'ok',
              ),
            },
            {
              icon: <Clock3 className="h-4 w-4" />,
              label: t('kpiApiP95'),
              value: typeof http?.p95ApiMs === 'number' ? fmtInt(http.p95ApiMs) : '—',
              unit: t('unitMs'),
              sub: t('kpiApiP95Sub', {
                value: typeof http?.p95AiMs === 'number' ? fmtInt(http.p95AiMs) : '—',
              }),
              // 延迟是中性读数:正常取前景色,超 500ms 转琥珀、超 1s 转红 —— 原来恒绿,
              // 绿色在大屏上同时承担「成交/用户/正常」三种含义,异常色反而失去对比。
              tone:
                typeof http?.p95ApiMs !== 'number' || !Number.isFinite(http.p95ApiMs)
                  ? ('unknown' as const)
                  : http.p95ApiMs >= 1000
                    ? ('bad' as const)
                    : http.p95ApiMs >= 500
                      ? ('warn' as const)
                      : ('default' as const),
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
              // 金额 ≥1 万元走紧凑记法(避免 6 位整数把卡片撑破);其余保留至多两位小数。
              value: biz
                ? biz.ordersTodayAmountCents >= 1_000_000
                  ? fmtCompact(biz.ordersTodayAmountCents / 100)
                  : (biz.ordersTodayAmountCents / 100).toLocaleString(locale, {
                      maximumFractionDigits: 2,
                    })
                : '—',
              unit: t('unitYuan'),
              sub: t('kpiTurnoverSub', { count: fmtInt(biz?.ordersTodayPaid) }),
              tone: biz ? ('default' as const) : ('unknown' as const),
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
              className="ui-lift wb-panel wb-rise relative overflow-hidden rounded-xl border border-border bg-card/80 px-3 py-2"
            >
              <div className="flex items-center gap-2 text-[10px] tracking-[0.16em] text-muted-foreground">
                <span className="text-info-text/70">{k.icon}</span>
                {k.label}
              </div>
              <div
                className={cn(
                  'wb-num whitespace-nowrap mt-1 text-[26px] leading-none font-bold',
                  k.tone === 'bad'
                    ? 'text-danger-text'
                    : k.tone === 'warn'
                      ? 'text-warning-text'
                      : k.tone === 'accent'
                        ? 'text-info-text'
                        : k.tone === 'unknown'
                          ? 'text-muted-foreground'
                          : k.tone === 'default'
                            ? 'text-foreground'
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
              <EChart option={gaugeOption} height={150} merge ariaLabel={t('panelHost')} />
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
                <EChart
                  option={hostTrendOption}
                  height={96}
                  merge
                  ariaLabel={t('cpuMemTrendTitle')}
                />
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
              {host !== null && ov !== undefined && (host.disks ?? []).length === 0 ? (
                <div className="py-1 text-[10px] text-muted-foreground">{t('noDiskData')}</div>
              ) : null}
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
                {(services?.targets ?? []).length === 0 && services !== null ? (
                  <span className="text-[10px] text-muted-foreground">{t('noScrapeTargets')}</span>
                ) : null}
              </div>
            </div>
          </Panel>

          {/* 流量趋势 */}
          <Panel
            title={t('panelTraffic')}
            icon={<Radio className="h-3.5 w-3.5" />}
            className="wb-c6 wb-flow-first"
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
              <EChart option={trendOption} height="100%" merge ariaLabel={t('panelTraffic')} />
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
                tone={thresholdTone(biz?.apiErrRate, (n) =>
                  n > 5 ? 'bad' : n > 1 ? 'warn' : 'ok',
                )}
              />
            </div>
          </Panel>

          {/* 状态码分布 + 分时调用 */}
          <Panel
            title={t('panelQuality')}
            icon={<Gauge className="h-3.5 w-3.5" />}
            className="wb-c6 wb-c3-md order-1"
            bodyClassName="flex flex-col gap-1"
          >
            <div className="relative">
              <EChart option={statusOption} height={172} merge ariaLabel={t('panelQuality')} />
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
              <EChart option={hourlyOption} height={116} merge ariaLabel={t('hourlyTitle')} />
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
            className="wb-c6 wb-c3-md order-1"
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
                    className="rounded-md border border-destructive/25 bg-destructive/[0.08] px-2 py-1.5 transition-colors hover:bg-destructive/[0.12]"
                  >
                    <div className="flex items-center gap-1.5">
                      <Dot tone={a.severity === 'critical' ? 'bad' : 'warn'} />
                      <span className="truncate text-[11px] font-medium text-danger-text">
                        {a.name}
                      </span>
                      {/* severity 不能只靠圆点颜色区分(色盲不可辨),补文字徽章;复用最近告警那三档文案。 */}
                      <span
                        className={cn(
                          'shrink-0 rounded-md border px-1 text-[9px]',
                          a.severity === 'critical'
                            ? 'border-destructive/40 bg-destructive/10 text-danger-text'
                            : a.severity === 'info'
                              ? 'border-info/40 bg-info/10 text-info-text'
                              : 'border-warning/40 bg-warning/10 text-warning-text',
                        )}
                      >
                        {a.severity === 'critical'
                          ? t('sevCritical')
                          : a.severity === 'info'
                            ? t('sevInfo')
                            : t('sevWarning')}
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
                      <Tooltip content={a.summary}>
                        <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                          {a.summary}
                        </div>
                      </Tooltip>
                    ) : null}
                  </div>
                ))}
                {(alerts?.promActiveCount ?? alerts?.promActive?.length ?? 0) > 5 ? (
                  <div className="px-2 py-1 text-center text-[10px] text-muted-foreground">
                    {t('moreActiveAlerts', {
                      count: (alerts?.promActiveCount ?? alerts?.promActive?.length ?? 0) - 5,
                    })}
                  </div>
                ) : null}
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
                    className="rounded-md border border-transparent bg-muted/50 px-2 py-1 transition-colors hover:bg-muted"
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
                        <Tooltip content={a.message}>
                          <span className="truncate">{a.message}</span>
                        </Tooltip>
                      ) : null}
                    </div>
                  </div>
                ))}
                {(alerts?.recent.length ?? 0) > 4 ? (
                  <div className="px-2 py-1 text-center text-[10px] text-muted-foreground">
                    {t('moreRecentAlerts', { count: (alerts?.recent.length ?? 0) - 4 })}
                  </div>
                ) : null}
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
                    className="rounded-md border border-transparent bg-muted/50 px-2 py-1.5 transition-colors hover:bg-muted"
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
                        {fmtStamp(e.createdAt)}
                      </span>
                    </div>
                    <Tooltip content={e.message}>
                      <div className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                        {e.message}
                      </div>
                    </Tooltip>
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
            className="wb-c6 order-1"
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
              <div className="mb-1 flex items-center justify-between text-[10px] tracking-[0.14em] text-muted-foreground">
                <span>{t('llmBridge')}</span>
                {biz === null && ov !== undefined ? (
                  <SourceGap text={t('sourceUnreachable')} />
                ) : null}
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
                  tone={thresholdTone(biz?.llmErrRate, (n) =>
                    n > 5 ? 'bad' : n > 1 ? 'warn' : 'ok',
                  )}
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
            className="wb-c6 wb-business-early"
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
                  <EChart option={signInOption} height={62} merge ariaLabel={t('signIn7d')} />
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
                <EChart option={modelOption} height={148} merge ariaLabel={t('topModels')} />
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
            className="wb-c6 wb-c3-md order-1"
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
                        'wb-num whitespace-nowrap mt-0.5 text-[26px] leading-none font-bold',
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
                        'wb-num whitespace-nowrap mt-0.5 text-[26px] leading-none font-bold',
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
                <div className="wb-cells wb-cells-4 grid gap-2">
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
                    <Tooltip
                      key={legKey}
                      content={`HTTP ${leg.status ?? '—'} · TTFB ${leg.ttfbMs ?? '—'}ms${leg.encoding ? ` · ${leg.encoding}` : ''}`}
                    >
                      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/60 px-2.5 py-1.5">
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
                    </Tooltip>
                  ))}
                </div>
                <div className="min-h-0 flex-1">
                  <div className="mb-1 text-[10px] tracking-[0.14em] text-muted-foreground">
                    {t('edgeSparkTitle')}
                  </div>
                  <div className="relative">
                    <EChart option={edgeOption} height={116} merge ariaLabel={t('panelEdge')} />
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
            className="wb-c6 wb-c3-md order-1"
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
                {(traffic?.families.length ?? 0) > 6 ? (
                  <div className="px-2 py-1 text-center text-[10px] text-muted-foreground">
                    {t('moreFamilies', { count: (traffic?.families.length ?? 0) - 6 })}
                  </div>
                ) : null}
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

          {/* 页面访问热度(2026-10-30 接线):访问面分桶 + 页面排行。
              排行带端前缀与占比条 —— 四端同表,不拆前缀就读不出"这页是谁在用";
              占比分母取 pageTotalPv,取不到时**不画条**(画条等于把"没判"画成"零")。 */}
          <Panel
            title={t('panelPageUsage')}
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            className="wb-c6 wb-c3-md order-1"
            right={
              traffic === null ? (
                <SourceGap text={t('sourceUnreachable')} />
              ) : isNum(traffic.online5m) ? (
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Dot tone="ok" />
                  {t('onlineNow', { count: fmtInt(traffic.online5m) })}
                </span>
              ) : null
            }
            bodyClassName="wb-split overflow-y-auto"
          >
            <div>
              <div className="mb-1.5 text-[10px] tracking-[0.14em] text-muted-foreground">
                {t('pageUsageScope')}
              </div>
              <div className="space-y-1">
                {(
                  [
                    ['public', t('scopePublic')],
                    ['admin', t('scopeAdmin')],
                    ['auth', t('scopeAuth')],
                  ] as const
                ).map(([scope, label]) => {
                  const known = traffic?.scopeSplit !== null && traffic?.scopeSplit !== undefined
                  const row = known
                    ? (traffic?.scopeSplit ?? []).find((r) => r.scope === scope)
                    : null
                  return (
                    <MeterRow
                      key={scope}
                      label={label}
                      value={
                        known ? (
                          <>
                            <span>{fmtInt(row?.pv ?? 0)}</span> /{' '}
                            <span>{fmtInt(row?.uv ?? 0)}</span>
                          </>
                        ) : (
                          '— / —'
                        )
                      }
                    />
                  )
                })}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[10px] tracking-[0.14em] text-muted-foreground">
                {t('pageUsageTop')}
              </div>
              <div className="space-y-1">
                {(traffic?.pageTop ?? []).slice(0, 8).map((row) => {
                  const { prefix, rest, tone } = platformPrefixOf(row.url)
                  const pct =
                    isNum(traffic?.pageTotalPv) && (traffic?.pageTotalPv ?? 0) > 0
                      ? Math.round((row.pv / (traffic?.pageTotalPv ?? 1)) * 100)
                      : null
                  const dwell = (traffic?.pageDwell ?? []).find((d) => d.url === row.url)
                  const dwellSec = isNum(dwell?.avgDwellSec) ? Math.round(dwell.avgDwellSec) : null
                  return (
                    <div
                      key={`${row.platform}:${row.url}`}
                      className="rounded-md bg-muted/50 px-2 py-1"
                    >
                      <div className="flex items-center gap-1.5">
                        {prefix ? (
                          <span className={cn('shrink-0 text-[10px] font-semibold', tone)}>
                            {prefix}
                          </span>
                        ) : null}
                        <span className="min-w-0 truncate text-[10px] text-foreground">{rest}</span>
                        <span className="wb-num ml-auto shrink-0 text-[10px] text-info-text">
                          {fmtInt(row.pv)} / {fmtInt(row.uv)}
                        </span>
                      </div>
                      {pct !== null || dwellSec !== null ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          {pct === null ? (
                            <div className="flex-1" />
                          ) : (
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-info/70"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                          {dwellSec === null ? null : (
                            <span className="shrink-0 text-[9px] text-muted-foreground">
                              {t('avgDwellSec', { s: dwellSec })}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
                {traffic !== null &&
                traffic.pageTop !== null &&
                traffic.pageTop !== undefined &&
                traffic.pageTop.length === 0 ? (
                  <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                    {t('pageUsageNoData')}
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          {/* 分时访问(2026-10-30 接线):滚动 24h 逐小时,与「今日分时调用」的截断语义不同 */}
          <Panel
            title={t('panelHourlyVisits')}
            icon={<LineChart className="h-3.5 w-3.5" />}
            className="wb-c6 wb-c3-md order-1"
            right={
              <span className="text-[10px] text-muted-foreground">{t('hourlyVisitWindow')}</span>
            }
            bodyClassName="flex flex-col gap-1"
          >
            <div className="relative">
              <EChart
                option={visitsHourlyOption}
                height={150}
                merge
                ariaLabel={t('panelHourlyVisits')}
              />
              {traffic === null || traffic.pageHourly === null ? (
                <ChartEmpty text={t('sourceUnreachable')} />
              ) : (traffic.pageHourly ?? []).length === 0 ? (
                /* 空数组 = 窗口内真的一次访问都没有;null 才是"腿取不到"(上面那档) */
                <ChartEmpty text={t('noTrafficData')} />
              ) : null}
            </div>
          </Panel>

          {/* 各端使用量:四端同表。"零量"必须分两种说法(今日静默 / 90日未上报) */}
          <Panel
            title={t('panelPlatforms')}
            icon={<Layers className="h-3.5 w-3.5" />}
            className="wb-c3"
            bodyClassName="overflow-y-auto"
          >
            {(traffic?.platformSplit ?? []).length === 0 ? (
              <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                {t('platformNoData')}
              </div>
            ) : (
              <div className="space-y-1">
                {(traffic?.platformSplit ?? []).map((row) => (
                  <MeterRow
                    key={row.platform}
                    label={
                      row.platform === 'rn'
                        ? t('platformRn')
                        : row.platform === 'mp'
                          ? t('platformMp')
                          : row.platform === 'ex'
                            ? t('platformEx')
                            : t('platformWeb')
                    }
                    value={`${fmtInt(row.pv)} / ${fmtInt(row.uv)}`}
                    note={
                      row.pv90d === 0
                        ? t('platformNever')
                        : row.pv === 0
                          ? t('platformQuiet')
                          : undefined
                    }
                  />
                ))}
              </div>
            )}
          </Panel>

          {/* 访客构成:新访客 / 回访 / 回访率。取不到一律「—」,不折成 0 */}
          <Panel
            title={t('panelAudience')}
            icon={<UserRoundCheck className="h-3.5 w-3.5" />}
            className="wb-c3"
            right={
              audience === null ? (
                <SourceGap text={t('sourceUnreachable')} />
              ) : isNum(audience.activeUv) ? (
                <span className="text-[10px] text-muted-foreground">
                  {t('audienceTotal', { count: fmtInt(audience.activeUv) })}
                </span>
              ) : null
            }
            bodyClassName="overflow-y-auto"
          >
            <div className="space-y-1">
              <MeterRow label={t('audienceNew')} value={fmtInt(audience?.newUv)} />
              <MeterRow label={t('audienceReturning')} value={fmtInt(audience?.returningUv)} />
              <MeterRow
                label={t('audienceRevisitRate')}
                value={
                  isNum(audience?.returningRate)
                    ? `${Math.round((audience?.returningRate ?? 0) * 100)}%`
                    : '—'
                }
              />
            </div>
          </Panel>

          {/* 会话质量:单页占比 / 人均页数 / 深度四档 / 落地页 + 退出页(两头都有才看得出断在哪) */}
          <Panel
            title={t('panelSessionQuality')}
            icon={<Waypoints className="h-3.5 w-3.5" />}
            className="wb-c6 wb-c3-md order-1"
            right={
              isNum(traffic?.sessionQuality?.sessions) ? (
                <span className="text-[10px] text-muted-foreground">
                  {t('sessionQualitySessions', {
                    count: fmtInt(traffic?.sessionQuality?.sessions),
                  })}
                </span>
              ) : null
            }
            bodyClassName="flex flex-col gap-2 overflow-y-auto"
          >
            <div className="wb-cells">
              <StatCell
                label={t('sessionQualitySinglePage')}
                value={
                  isNum(traffic?.sessionQuality?.singlePageRate)
                    ? `${Math.round((traffic?.sessionQuality?.singlePageRate ?? 0) * 100)}%`
                    : '—'
                }
                tone={
                  traffic?.sessionQuality === undefined || traffic?.sessionQuality === null
                    ? 'unknown'
                    : 'accent'
                }
              />
              <StatCell
                label={t('sessionQualityAvgPv')}
                value={
                  isNum(traffic?.sessionQuality?.avgPvPerSession)
                    ? (traffic?.sessionQuality?.avgPvPerSession ?? 0).toFixed(1)
                    : '—'
                }
                tone={
                  traffic?.sessionQuality === undefined || traffic?.sessionQuality === null
                    ? 'unknown'
                    : 'ok'
                }
              />
            </div>
            <div>
              <div className="mb-1 text-[10px] tracking-[0.14em] text-muted-foreground">
                {t('sessionQualityDepth')}
              </div>
              <div className="space-y-1">
                {(traffic?.sessionQuality?.depth ?? []).map((d) => (
                  <MeterRow
                    key={d.bucket}
                    label={
                      d.bucket === '1'
                        ? t('sessionDepth1')
                        : d.bucket === '2-3'
                          ? t('sessionDepth23')
                          : d.bucket === '4-7'
                            ? t('sessionDepth47')
                            : t('sessionDepth8Plus')
                    }
                    value={fmtInt(d.sessions)}
                  />
                ))}
                {traffic?.sessionQuality === null && traffic !== null ? (
                  <div className="px-2 py-2 text-center text-[11px] text-muted-foreground">
                    {t('sessionQualityNoData')}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="wb-split">
              <div>
                <div className="mb-1 text-[10px] tracking-[0.14em] text-muted-foreground">
                  {t('sessionQualityEntryTop')}
                </div>
                <div className="space-y-1">
                  {(traffic?.sessionQuality?.entryPages ?? []).map((row) => (
                    <MeterRow
                      key={`in:${row.url}`}
                      label={row.url}
                      value={`${fmtInt(row.sessions)} / ${fmtInt(row.singlePageSessions)}`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[10px] tracking-[0.14em] text-muted-foreground">
                  {t('sessionQualityExitTop')}
                </div>
                <div className="space-y-1">
                  {(traffic?.sessionQuality?.exitPages ?? []).map((row) => (
                    <MeterRow
                      key={`out:${row.url}`}
                      label={row.url}
                      value={`${fmtInt(row.sessions)} / ${fmtInt(row.singlePageSessions)}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          {/* 交互热度:事件分布 / 热门点击 / 平均停留(analytics_events 口径) */}
          <Panel
            title={t('panelEngagement')}
            icon={<MousePointerClick className="h-3.5 w-3.5" />}
            className="wb-c3"
            right={
              isNum(engagement?.avgPageTimeSec) ? (
                <span className="text-[10px] text-muted-foreground">
                  {t('engagementAvgStay')} {fmtDuration(engagement?.avgPageTimeSec)}
                </span>
              ) : null
            }
            bodyClassName="flex flex-col gap-2 overflow-y-auto"
          >
            <div>
              <div className="mb-1 text-[10px] tracking-[0.14em] text-muted-foreground">
                {t('engagementEvents')}
              </div>
              <div className="space-y-1">
                {(engagement?.events ?? []).slice(0, 6).map((e) => (
                  <MeterRow key={e.event} label={e.event} value={fmtInt(e.n)} />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[10px] tracking-[0.14em] text-muted-foreground">
                {t('engagementClicks')}
              </div>
              <div className="space-y-1">
                {(engagement?.clickTop ?? []).slice(0, 6).map((c) => (
                  <MeterRow key={c.label} label={c.label} value={fmtInt(c.n)} />
                ))}
                {engagement !== null && (engagement.events ?? []).length === 0 ? (
                  <div className="px-2 py-2 text-center text-[11px] text-muted-foreground">
                    {t('engagementNoData')}
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          {/* 访问来源:四类来源 + 主机榜。取不到时**一个来源格都不画**(画 0 = 把"没判"说成"没有流量") */}
          <Panel
            title={t('panelVisitSource')}
            icon={<Share2 className="h-3.5 w-3.5" />}
            className="wb-c3"
            right={
              isNum(traffic?.visitSource?.totalPv) ? (
                <span className="text-[10px] text-muted-foreground">
                  {t('visitSourceTotal', { count: fmtInt(traffic?.visitSource?.totalPv) })}
                </span>
              ) : null
            }
            bodyClassName="flex flex-col gap-2 overflow-y-auto"
          >
            {traffic?.visitSource === null || traffic?.visitSource === undefined ? (
              <div className="flex justify-center px-2 py-3">
                <SourceGap text={t('sourceUnreachable')} />
              </div>
            ) : (
              <>
                <div>
                  <div className="mb-1 text-[10px] tracking-[0.14em] text-muted-foreground">
                    {t('visitSourceBuckets')}
                  </div>
                  <div className="space-y-1">
                    {(traffic.visitSource.buckets ?? []).map((b) => (
                      <MeterRow
                        key={b.kind}
                        label={
                          b.kind === 'local'
                            ? t('visitSourceLocal')
                            : b.kind === 'internal'
                              ? t('visitSourceInternal')
                              : b.kind === 'external'
                                ? t('visitSourceExternal')
                                : t('visitSourceDirect')
                        }
                        value={fmtInt(b.pv)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[10px] tracking-[0.14em] text-muted-foreground">
                    {t('visitSourceHosts')}
                  </div>
                  <div className="space-y-1">
                    {(traffic.visitSource.hosts ?? []).slice(0, 6).map((h) => (
                      <MeterRow key={h.host} label={h.host} value={fmtInt(h.pv)} />
                    ))}
                    {traffic.visitSource.buckets.length === 0 ? (
                      <div className="px-2 py-2 text-center text-[11px] text-muted-foreground">
                        {t('visitSourceNoData')}
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </Panel>

          {/* 页面流转:相邻页对(从哪页走到哪页 + 次数) —— 排行只说"哪页热",这格答"走到哪一步" */}
          <Panel
            title={t('panelVisitTransition')}
            icon={<Route className="h-3.5 w-3.5" />}
            className="wb-c6 wb-c3-md order-1"
            right={
              isNum(traffic?.visitTransition?.totalMoves) ? (
                <span className="text-[10px] text-muted-foreground">
                  {t('visitTransitionMoves', {
                    count: fmtInt(traffic?.visitTransition?.totalMoves),
                  })}
                </span>
              ) : null
            }
            bodyClassName="overflow-y-auto"
          >
            {traffic?.visitTransition === null || traffic?.visitTransition === undefined ? (
              <div className="flex justify-center px-2 py-3">
                <SourceGap text={t('sourceUnreachable')} />
              </div>
            ) : (
              <div>
                <div className="mb-1 text-[10px] tracking-[0.14em] text-muted-foreground">
                  {t('visitTransitionTop')}
                </div>
                <div className="space-y-1">
                  {(traffic.visitTransition.top ?? []).slice(0, 8).map((t2) => (
                    <div
                      key={`${t2.fromUrl}>${t2.toUrl}`}
                      className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1"
                    >
                      <span className="min-w-0 truncate text-[10px] text-foreground">
                        {t2.fromUrl}
                      </span>
                      <ArrowRight className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate text-[10px] text-foreground">
                        {t2.toUrl}
                      </span>
                      <span className="wb-num ml-auto shrink-0 text-[10px] text-info-text">
                        {fmtInt(t2.n)}
                      </span>
                    </div>
                  ))}
                  {(traffic.visitTransition.top ?? []).length === 0 ? (
                    <div className="px-2 py-2 text-center text-[11px] text-muted-foreground">
                      {t('visitTransitionNoData')}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </Panel>

          {/* AI 号池:key 池 / 账号池 / token 临期(后端现读两张池表 + 5 秒缓存,取不到一律"—")。
              2026-10-30 口径修正:①「可调度」与调度侧同一把尺子(账号含 health≠down);
              ②分母只算健康态可判定的行,脏值行单独成格;
              ③临期只算可调度账号 —— 停用/摘除/判死的号不再把面板永久钉在"已过期";
              ④"最久未刷新"按空闲保活窗口判色(旧版 1 小时阈值把正常闲置读成故障)。 */}
          <Panel
            title={t('panelRelayPool')}
            icon={<Sparkles className="h-3.5 w-3.5" />}
            className="wb-c6 wb-c3-md order-1"
            right={
              relayPool === null ? (
                <SourceGap text={t('sourceUnreachable')} />
              ) : isNum(relayPool.staleAgeSec) ? (
                <span className="text-[10px] text-muted-foreground">
                  {t('poolStale')} {fmtDuration(relayPool.staleAgeSec)}
                </span>
              ) : null
            }
            bodyClassName="wb-split wb-split-c3"
          >
            <div>
              <div className="mb-1.5 text-[10px] tracking-[0.14em] text-muted-foreground">
                {t('poolKey')}
              </div>
              <div className="wb-cells wb-cells-c4 grid gap-1.5">
                <StatCell
                  label={t('poolKeySchedulable')}
                  value={`${fmtInt(relayPool?.keySchedulable)} / ${fmtInt(poolKeyDenom)}`}
                  tone={
                    isNum(relayPool?.keySchedulable) && isNum(poolKeyDenom)
                      ? relayPool.keySchedulable < poolKeyDenom
                        ? 'warn'
                        : 'accent'
                      : 'unknown'
                  }
                />
                <StatCell
                  label={t('poolKeyAbnormal')}
                  value={fmtInt(relayPool?.keyAbnormal)}
                  tone={
                    !isNum(relayPool?.keyAbnormal)
                      ? 'unknown'
                      : relayPool.keyAbnormal > 0
                        ? 'warn'
                        : 'ok'
                  }
                  hint={
                    isNum(relayPool?.keyAbnormalSchedulable) && (relayPool?.keyAbnormal ?? 0) > 0
                      ? t('poolKeyAbnormalHint', { count: relayPool.keyAbnormalSchedulable })
                      : undefined
                  }
                />
                <StatCell
                  label={t('poolBalanceLow')}
                  value={fmtInt(relayPool?.keyBalanceLow)}
                  tone={
                    !isNum(relayPool?.keyBalanceLow)
                      ? 'unknown'
                      : relayPool.keyBalanceLow > 0
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
                      : relayPool.rowsUnclassified > 0
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
              <div className="wb-cells wb-cells-c4 grid gap-1.5">
                <StatCell
                  label={t('poolAccountSchedulable')}
                  value={`${fmtInt(relayPool?.accountsSchedulable)} / ${fmtInt(poolAccountDenom)}`}
                  tone={
                    isNum(relayPool?.accountsSchedulable) && isNum(poolAccountDenom)
                      ? relayPool.accountsSchedulable < poolAccountDenom
                        ? 'warn'
                        : 'ok'
                      : 'unknown'
                  }
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
                  hint={t('poolTokenExpiryScope')}
                />
                <StatCell
                  label={t('poolBlockedAccounts')}
                  value={fmtInt(relayPool?.accountsBlocked)}
                  tone={
                    !isNum(relayPool?.accountsBlocked)
                      ? 'unknown'
                      : (relayPool?.accountsBlockedExpired ?? 0) > 0
                        ? 'warn'
                        : 'ok'
                  }
                  hint={
                    isNum(relayPool?.accountsBlockedExpired) && relayPool.accountsBlockedExpired > 0
                      ? t('poolBlockedExpiredHint', { count: relayPool.accountsBlockedExpired })
                      : undefined
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
                    !isNum(relayPool?.accountRefreshAgeSec) || poolRefreshBudgetSec === null
                      ? 'unknown'
                      : relayPool.accountRefreshAgeSec >= poolRefreshBudgetSec
                        ? 'warn'
                        : 'ok'
                  }
                  hint={
                    [
                      isNum(relayPool?.accountLatestRefreshAgeSec)
                        ? t('poolLatestRefreshHint', {
                            ago: fmtDuration(relayPool.accountLatestRefreshAgeSec),
                          })
                        : null,
                      isNum(relayPool?.keepaliveIdleDays)
                        ? t('poolRefreshBudgetHint', { days: relayPool.keepaliveIdleDays })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || undefined
                  }
                />
              </div>
            </div>
          </Panel>

          {/* 进程运行时长:http.uptimeSeconds(各进程自启动起运行时长,后端已返回,此前仅在页脚) */}
          <Panel
            title={t('panelUptime')}
            icon={<Clock3 className="h-3.5 w-3.5" />}
            className="wb-c6 wb-c3-md order-1"
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

        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 pt-1 pb-2 text-[10px] text-muted-foreground">
          <span>{t('footerSources', { url: ov?.prometheusUrl ?? '—' })}</span>
          <span className={cn('wb-num', dataStale && 'text-warning-text/90')}>
            {t('footerDataAge', {
              duration: dataAgeMs === null ? '—' : fmtDuration(dataAgeMs / 1000),
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
/* 读数单行列宽下限的唯一源头:.wb-cells-c3 与两栏阈值都按它复算。
 * 这两层曾各写各的数字(裸档 96 + 620 阈值)⇒ 实测「6天19小时」被切成两行、卡片被撑高。
 * 取值 = 真浏览器实测「单行不溢出所需列宽」(含卡片 px-2.5 内边距与 1px 边框)的最大者:
 *   时长读数五语言最坏「6일 19시간」121px(上一版取 143 已覆盖这一族);
 *   复合读数「12,345 / 67,890」186px —— 号池两组各有一枚 fmtInt(a) 斜杠 fmtInt(b) 的复合读数,
 *   fmtInt 走 toLocaleString 会带千分位。下限小于读数宽时,加了 nowrap 之后不是折行而是
 *   **溢出压邻格**(实测 143 下限三列时把「12345 / 67890」压出卡片 21px),那比折行更糟。 */
.wb-root { --wb-cell-min: 186px; }
.wb-cells { grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); }
.wb-cells-c3 { grid-template-columns: repeat(auto-fit, minmax(var(--wb-cell-min), 1fr)); }
/* 4 格一组(号池):固定 2×2。auto-fit(var(--wb-cell-min)) 在两栏各 ~570 时仍能排 3 列
 * ⇒ 第 4 格单独成行留孤格;2 列让「12,345 / 67,890」这类复合读数和时长读数都有余量
 * (守门 240 不许折不溢)。单格下限跟 --wb-cell-min 同源;容器不足以放两格时退回单列,
 * 宁多一行也不让读数溢出(阈值复算 = 2×186 + 格间距6 + 面板内边距24 = 402,即面板 426)。 */
.wb-cells-c4 { grid-template-columns: repeat(2, minmax(var(--wb-cell-min), 1fr)); }
@container (max-width: 425px) { .wb-cells-c4 { grid-template-columns: minmax(0, 1fr); } }
/* 6 格一组(Redis / 访客):auto-fit 在半宽面板里只能排 5 列 ⇒ 第 6 格单独一行。
 * 这里固定 3 列 ×2 行(总行数与 5+1 相同,但不再出现孤格);<480 落 2 列。 */
.wb-cells-6 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@container (max-width: 479px) { .wb-cells-6 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
/* 4 格组(边缘分位):窄面板下 auto-fit 会排成 3+1,孤格单独一行;固定 2×2。 */
@container (max-width: 479px) { .wb-cells-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
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
/* 首屏编排(全宽度生效):流量趋势与业务数据先读,主机/服务、质量/告警顺次后移。
 * 1920 下一行刚好是流量 6 + 业务 6,首屏即可读完这两块;负 order 只改视觉顺序,
 * DOM 顺序不变(读屏仍按 DOM 读,视觉优先是大屏的既定取舍)。 */
.wb-flow-first { order: -2; }
.wb-business-early { order: -1; }
.wb-c3 { grid-column: span 3; }
.wb-c6 { grid-column: span 6; }
.wb-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}
/* 长读数两栏面板:阈值按 --wb-cell-min 复算(2×(3×186+2×6)+8=1148),不沿用 .wb-split 的 620 ——
 * 620 时每栏约 300、3 格各 ~96 < 单行需求 ⇒ 读数必断行。窄于 1148 就单列,宁少一栏不折读。
 * 620–1147 段要显式按回单列:上面那条同断点的 .wb-split 会先给这层套两栏,两类选择器
 * (.wb-split.wb-split-c3)才压得住它(同特异度靠源码顺序会漂,不能赌)。 */
@container (min-width: 620px) and (max-width: 1147px) {
  .wb-split.wb-split-c3 { grid-template-columns: minmax(0, 1fr); }
}
@container (min-width: 1148px) {
  .wb-split-c3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container (max-width: 1149px) {
  .wb-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .wb-c3 { grid-column: span 3; }
  .wb-c6 { grid-column: span 6; }
  /* 620–1149 档:这几块内容在 ~370px 半宽里仍可读,两两配对后整页从 4.3 屏压到 ~3.5 屏
   * (质量+告警 / 边缘+访客 / 号池+运行时长)。≥1150 保持全宽,大屏宽度足够时不压缩。 */
  .wb-c3-md { grid-column: span 3; }
}
/* 620–699:两栏各只剩 ~300px,主机仪表/服务列表会被压成逐字换行 ⇒ 退回单列。
 * 只在这一段生效(≤619 已是单列网格,再给 span 6 会造出隐式列)。 */
@container (min-width: 620px) and (max-width: 699px) {
  .wb-c3, .wb-c3-md, .wb-c6 { grid-column: span 6; }
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
/* 大屏的纵向滚动发生在承载它的 .wb-scroll-host 上(它是 .wb-root 的祖先,不在射程内),
 * 原来只写 .wb-root ::-webkit-scrollbar ⇒ 外层滚动条一直是系统默认宽度/配色。
 * 这里把宿主机一并纳入同一档;面板内部滚动条仍由 .wb-root 那条负责。 */
.wb-scroll-host {
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--color-muted-foreground) 55%, transparent) transparent;
}
.wb-root ::-webkit-scrollbar, .wb-scroll-host::-webkit-scrollbar { width: 6px; height: 6px; }
.wb-root ::-webkit-scrollbar-thumb, .wb-scroll-host::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--color-muted-foreground) 55%, transparent);
  border-radius: var(--radius-xs);
}
.wb-root ::-webkit-scrollbar-track, .wb-scroll-host::-webkit-scrollbar-track { background: transparent; }
/* 4K/超宽值班屏:视口 ≥2200 时整体放大 12%,字号与图表一起变,不用逐类改 px。
 * 常规 1920/1440 不触发;不支持 zoom 的浏览器自动退化为当前密度(不做第二套布局)。 */
@media (min-width: 2200px) {
  .wb-root { zoom: 1.12; }
}
`
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
