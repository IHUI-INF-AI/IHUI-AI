// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/admin/ops-wallboard/* 生产在线端监控大屏数据聚合(2026-10-16 立)。
 *
 * 端点清单(注册前缀 /api/admin):
 * 1. GET /ops-wallboard/overview — 一次快照:主机/服务矩阵/HTTP 流量/PG/Redis/AI/业务/告警/事件
 * 2. GET /ops-wallboard/trend?minutes=90&step=30 — 区间序列(QPS/错误率/P95/CPU/内存 + 今日分时调用)
 *
 * 数据源三路,每路独立降级(单路失败只留 null,不拖垮整块 payload):
 *  - Prometheus(默认 http://127.0.0.1:8815,PROMETHEUS_URL 可覆盖,与 prometheus.yml 的
 *    原生部署端口一致)
 *  - Alertmanager(默认 http://127.0.0.1:9093,ALERTMANAGER_URL 可覆盖)
 *  - 业务库 dbRead(users/orders/api_logs/llm_call_logs/monitor_alerts/system_events)
 *
 * 复用模式参考 apps/api/src/routes/admin/relay-stats.ts(Asia/Shanghai 日界 + percentile_cont
 * 聚合)与 deploy/saas/admin-api/src/routes/metrics.ts(promQuery 封装 + 超时降级 null)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { bizDayKey, bizDayStartUtc } from '../utils/biz-day.js'
import { z } from 'zod'
import { desc, eq, gte, lte, sql, and } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import {
  apiLogs,
  llmCallLogs,
  monitorAlerts,
  orders,
  signInRecords,
  systemEvents,
  users,
} from '@ihui/database'
import { shiftDate, todayString } from '../utils/checkin-helpers.js'
import { success, error } from '../utils/response.js'
import { requireAdmin } from '../plugins/require-permission.js'
import type { EdgeLegKey, EdgeLegSample, EdgeStats } from '../services/edge-access.js'
import { edgeSeries, latestEdgeSnapshot } from '../services/edge-access.js'
import { getTrafficLiveSnapshot } from '../services/traffic-stats-service.js'
import {
  getPageUsageLiveSnapshot,
  type PageUsageLiveRow,
  type PlatformUsageLiveRow,
  type ScopeUsageLiveRow,
} from '../db/visit-tracking-queries.js'
import { getEngagementLiveSnapshot } from '../services/engagement-stats-service.js'
import { getAudienceLiveSnapshot } from '../services/audience-stats-service.js'
import {
  getSessionQualityLiveSnapshot,
  type SessionQualitySnapshot,
} from '../services/session-quality-stats-service.js'
import {
  getVisitSourceLiveSnapshot,
  type VisitSourceSnapshot,
} from '../services/visit-source-stats-service.js'
import {
  getVisitTransitionLiveSnapshot,
  type VisitTransitionSnapshot,
} from '../services/visit-transition-stats-service.js'
import { getRelayPoolLiveSnapshot } from '../services/relay-pool-stats-service.js'

// ===== 可观测数据源端点(环境变量可覆盖;默认值 = Windows 原生部署实况)=====
const PROMETHEUS_URL = (process.env.PROMETHEUS_URL ?? 'http://127.0.0.1:8815').replace(/\/$/, '')
const ALERTMANAGER_URL = (process.env.ALERTMANAGER_URL ?? 'http://127.0.0.1:9093').replace(
  /\/$/,
  '',
)
/** 单次探测超时:大屏每 5s 轮询,任一数据源卡住都不得拖到下一轮。 */
const FETCH_TIMEOUT_MS = 5000
/** 业务库聚合口径的主库名(PG exporter 的 datname 标签值)。 */
const PRIMARY_DB_LABEL = 'ihui_dev'

/**
 * 已退役停用的 IHUI 服务名单(逗号分隔,大小写不敏感)。
 * 2026-10 僵尸服务清理时 IHUI-OLLAMA 已 Disabled,但 windows_exporter 的
 * windows_service_state 只反映运行状态(停用服务同样上报 stopped),无法从指标
 * 区分「主动停用」与「异常停止」。若不排除,健康度分母恒含停用服务 ⇒ 大屏状态灯
 * 与「存在告警」判定恒黄。名单按实际拓扑经环境变量覆盖。
 */
const RETIRED_SERVICES = new Set(
  (process.env.OPS_WALLBOARD_RETIRED_SERVICES ?? 'IHUI-OLLAMA')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean),
)

// ===== Prometheus 读取封装(取不到一律 null,禁止抛出拖垮整块)=====
interface PromSample {
  metric: Record<string, string>
  value: [number, string]
}
interface PromRangeSample {
  metric: Record<string, string>
  values: Array<[number, string]>
}

async function promQuery(query: string): Promise<PromSample[] | null> {
  try {
    const url = `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return null
    const body = (await res.json()) as { status?: string; data?: { result?: PromSample[] } }
    if (body.status !== 'success' || !Array.isArray(body.data?.result)) return null
    return body.data.result
  } catch {
    return null
  }
}

async function promRange(
  query: string,
  start: number,
  end: number,
  step: number,
): Promise<PromRangeSample[] | null> {
  try {
    const params = new URLSearchParams({
      query,
      start: String(start),
      end: String(end),
      step: String(step),
    })
    const res = await fetch(`${PROMETHEUS_URL}/api/v1/query_range?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const body = (await res.json()) as {
      status?: string
      data?: { result?: PromRangeSample[] }
    }
    if (body.status !== 'success' || !Array.isArray(body.data?.result)) return null
    return body.data.result
  } catch {
    return null
  }
}

function sampleNum(s: PromSample | undefined): number | null {
  if (!s) return null
  const v = Number(s.value?.[1])
  return Number.isFinite(v) ? v : null
}

function firstNum(list: PromSample[] | null): number | null {
  return sampleNum(list?.[0])
}

/** 百分比保留两位;无样本(SQL 聚合出 NULL)一律落 null ——
 *  「今天还没有请求」写成 0.00% 会被大屏读成「零错误率」,那是 §0.3 禁止的顶替。 */
function pct2(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(2)) : null
}

/** range 序列 → [[epochMs, value], …],值不合法的点直接丢弃。 */
function rangeToSeries(list: PromRangeSample[] | null): Array<[number, number]> {
  const s = list?.[0]
  if (!s?.values) return []
  const out: Array<[number, number]> = []
  for (const [ts, raw] of s.values) {
    const v = Number(raw)
    if (Number.isFinite(v)) out.push([Math.round(ts * 1000), v])
  }
  return out
}

// 业务日界唯一出口在 utils/biz-day.ts(守门 246 拦第二份副本)

/** 上海日界的 YYYY-MM-DD 日期串(daysAgo=0 即上海今天)。与 usersTodayNew 同口径:
 *  新增用户按上海日界切分,增长曲线若按 UTC 切日,16:00 后的注册会被算进"明天",
 *  与同一张屏上的「今日新增」读数自相矛盾。算法本体在 utils/biz-day.ts(守门 246 拦第二份)。 */
function bizDayKeyAgo(daysAgo = 0): string {
  return bizDayKey(bizDayStartUtc(daysAgo))
}

// ===== 各数据面聚合(每块独立 try/catch ⇒ 失败置 null)=====

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

async function buildHost(): Promise<HostSnapshot | null> {
  try {
    const [cpu, memTotal, memFree, diskSize, diskFree, netRx, netTx, boot] = await Promise.all([
      promQuery(
        '100 * (1 - sum(rate(windows_cpu_time_total{mode="idle"}[2m])) / clamp_min(sum(rate(windows_cpu_time_total[2m])), 0.000001))',
      ),
      promQuery('windows_cs_physical_memory_bytes'),
      promQuery('windows_memory_physical_free_bytes'),
      promQuery('windows_logical_disk_size_bytes'),
      promQuery('windows_logical_disk_free_bytes'),
      promQuery('sum(rate(windows_net_bytes_received_total[2m]))'),
      promQuery('sum(rate(windows_net_bytes_sent_total[2m]))'),
      promQuery('windows_system_boot_time_timestamp_seconds'),
    ])
    const memTotalBytes = firstNum(memTotal)
    const memFreeBytes = firstNum(memFree)
    // 卷标合成:size/free 两族按 volume 标签对齐,只保留 `C:` 形态的真分区
    const freeByVolume = new Map<string, number>()
    for (const s of diskFree ?? []) {
      const vol = s.metric?.volume
      const v = sampleNum(s)
      if (vol && v !== null) freeByVolume.set(vol, v)
    }
    const disks: HostSnapshot['disks'] = []
    for (const s of diskSize ?? []) {
      const vol = s.metric?.volume ?? ''
      const sizeBytes = sampleNum(s)
      if (!/^[A-Za-z]:$/.test(vol) || sizeBytes === null || sizeBytes <= 0) continue
      const freeBytes = freeByVolume.get(vol) ?? 0
      disks.push({
        volume: vol,
        sizeBytes,
        freeBytes,
        usedPct: Number((((sizeBytes - freeBytes) / sizeBytes) * 100).toFixed(2)),
      })
    }
    disks.sort((a, b) => a.volume.localeCompare(b.volume))
    return {
      cpuPct: firstNum(cpu) !== null ? Number(firstNum(cpu)!.toFixed(2)) : null,
      memTotalBytes,
      memFreeBytes,
      memPct:
        memTotalBytes && memFreeBytes !== null
          ? Number((((memTotalBytes - memFreeBytes) / memTotalBytes) * 100).toFixed(2))
          : null,
      disks,
      netRxBytesPerSec: firstNum(netRx),
      netTxBytesPerSec: firstNum(netTx),
      bootTimeEpochSec: firstNum(boot),
    }
  } catch {
    return null
  }
}

interface ServicesSnapshot {
  windows: Array<{ name: string; state: string; retired: boolean }>
  targets: Array<{ job: string; instance: string; up: number | null }>
  windowsTotal: number
  windowsRunning: number
  /** 非退役服务总数(健康度分母;退役服务见 RETIRED_SERVICES) */
  windowsExpectedTotal: number
  targetsTotal: number
  targetsUp: number
}

async function buildServices(): Promise<ServicesSnapshot | null> {
  try {
    // `== 1` 只保留"当前处于该状态"的样本(exporter 对每个状态各发一条 0/1)
    const [svc, targets] = await Promise.all([
      promQuery('windows_service_state{name=~"(?i).*ihui.*"} == 1'),
      promQuery('up'),
    ])
    const windows = (svc ?? [])
      .map((s) => ({
        name: s.metric?.name ?? '',
        state: s.metric?.state ?? 'unknown',
        retired: RETIRED_SERVICES.has((s.metric?.name ?? '').toUpperCase()),
      }))
      .filter((s) => s.name)
      .sort((a, b) => a.name.localeCompare(b.name))
    const targetList = (targets ?? [])
      .map((s) => ({
        job: s.metric?.job ?? '',
        instance: s.metric?.instance ?? '',
        // 取不到样本 ⇒ null(未判定),不得 `?? 0`:0 在大屏上会把「从没上报过的目标」
        // 画成红色「down」,那是把「没量到」冒充成「量到了坏结论」。
        up: sampleNum(s),
      }))
      .filter((t) => t.job)
      .sort((a, b) => a.job.localeCompare(b.job))
    return {
      windows,
      targets: targetList,
      windowsTotal: windows.length,
      windowsRunning: windows.filter((w) => w.state === 'running' && !w.retired).length,
      windowsExpectedTotal: windows.filter((w) => !w.retired).length,
      targetsTotal: targetList.length,
      targetsUp: targetList.filter((t) => t.up === 1).length,
    }
  } catch {
    return null
  }
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
}

async function buildHttp(): Promise<HttpSnapshot | null> {
  try {
    // 2026-10-25:原先这里还查 `ihui_llm_active_sessions`。该 gauge 在 ai-service 侧
    // 已随"死 gauge 摘除"退役(生产零调用,面板恒空),墙板是最后一处残留消费点 ⇒
    // 一并摘掉,否则大屏把"指标已不存在"画成"会话数为零"。号池健康已由
    // `ihui_llm_pool_leg_*` 族承载,见 /admin/monitor/panels 的「号池冷却中的腿数」。
    const [qps, errRate, p95Api, p95Ai, statusDist, uptime, ws, active] = await Promise.all([
      promQuery('sum(rate(http_requests_total[5m]))'),
      promQuery(
        'sum(rate(http_requests_by_status{status=~"5.."}[5m])) / clamp_min(sum(rate(http_requests_by_status[5m])), 0.000001)',
      ),
      promQuery(
        'histogram_quantile(0.95, sum by (le) (rate(http_response_time_ms_bucket{job="api"}[5m])))',
      ),
      promQuery(
        'histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{job="ai-service"}[5m]))) * 1000',
      ),
      promQuery('sum by (status) (rate(http_requests_by_status[5m]))'),
      promQuery('process_uptime_seconds'),
      promQuery('websocket_connections'),
      promQuery('active_connections'),
    ])
    // 状态码 → 2xx/3xx/4xx/5xx 分桶
    const buckets = new Map<string, number>()
    for (const s of statusDist ?? []) {
      const code = s.metric?.status ?? ''
      const rate = sampleNum(s) ?? 0
      const klass = /^\d{3}$/.test(code) ? `${code[0]}xx` : 'other'
      buckets.set(klass, (buckets.get(klass) ?? 0) + rate)
    }
    return {
      qps: firstNum(qps),
      errRate: firstNum(errRate),
      p95ApiMs: firstNum(p95Api),
      p95AiMs: firstNum(p95Ai),
      statusRates: [...buckets.entries()]
        .map(([klass, rate]) => ({ klass, rate: Number(rate.toFixed(4)) }))
        .sort((a, b) => a.klass.localeCompare(b.klass)),
      uptimeSeconds: (uptime ?? [])
        .filter((s) => s.metric?.job)
        .map((s) => ({ job: s.metric.job!, seconds: sampleNum(s) ?? 0 })),
      wsConnections: firstNum(ws),
      activeConnections: firstNum(active),
    }
  } catch {
    return null
  }
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

async function buildRedis(): Promise<RedisSnapshot | null> {
  try {
    const [clients, memUsed, memMax, keys, hits, misses, ops, evicted, uptime] = await Promise.all([
      promQuery('redis_connected_clients'),
      promQuery('redis_memory_used_bytes'),
      promQuery('redis_memory_max_bytes'),
      promQuery('sum(redis_db_keys)'),
      promQuery('redis_keyspace_hits_total'),
      promQuery('redis_keyspace_misses_total'),
      promQuery('rate(redis_commands_processed_total[5m])'),
      promQuery('redis_evicted_keys_total'),
      promQuery('redis_uptime_in_seconds'),
    ])
    const h = firstNum(hits)
    const m = firstNum(misses)
    return {
      clients: firstNum(clients),
      memUsedBytes: firstNum(memUsed),
      memMaxBytes: firstNum(memMax),
      keys: firstNum(keys),
      hitRatio: h !== null && m !== null ? Number((h / Math.max(h + m, 1)).toFixed(4)) : null,
      opsPerSec: firstNum(ops),
      evicted: firstNum(evicted),
      uptimeSeconds: firstNum(uptime),
    }
  } catch {
    return null
  }
}

interface PgSnapshot {
  backends: number | null
  sizeBytes: number | null
  hitRatio: number | null
  commitPerSec: number | null
  tupReturnedPerSec: number | null
  tupFetchedPerSec: number | null
}

async function buildPg(): Promise<PgSnapshot | null> {
  try {
    const sel = `datname="${PRIMARY_DB_LABEL}"`
    const [backends, size, hits, reads, commit, returned, fetched] = await Promise.all([
      promQuery(`pg_stat_database_numbackends{${sel}}`),
      promQuery(`pg_database_size_bytes{${sel}}`),
      promQuery(`pg_stat_database_blks_hit{${sel}}`),
      promQuery(`pg_stat_database_blks_read{${sel}}`),
      promQuery(`rate(pg_stat_database_xact_commit{${sel}}[5m])`),
      promQuery(`rate(pg_stat_database_tup_returned{${sel}}[5m])`),
      promQuery(`rate(pg_stat_database_tup_fetched{${sel}}[5m])`),
    ])
    const h = firstNum(hits)
    const r = firstNum(reads)
    return {
      backends: firstNum(backends),
      sizeBytes: firstNum(size),
      hitRatio: h !== null && r !== null ? Number((h / Math.max(h + r, 1)).toFixed(4)) : null,
      commitPerSec: firstNum(commit),
      tupReturnedPerSec: firstNum(returned),
      tupFetchedPerSec: firstNum(fetched),
    }
  } catch {
    return null
  }
}

interface BridgeSnapshot {
  alertsReceived: number | null
  mailDelivered: number | null
  mailUndelivered: boolean | null
  dedupSuppressed: number | null
}

async function buildBridge(): Promise<BridgeSnapshot | null> {
  try {
    const [recv, delivered, undelivered, suppressed] = await Promise.all([
      promQuery('ihui_alertbridge_alerts_received_total'),
      promQuery('ihui_alertbridge_mail_alerts_delivered_total'),
      promQuery('ihui_alertbridge_mail_undelivered'),
      promQuery('ihui_alertbridge_alerts_dedup_suppressed_total'),
    ])
    return {
      alertsReceived: firstNum(recv),
      mailDelivered: firstNum(delivered),
      mailUndelivered: firstNum(undelivered) !== null ? firstNum(undelivered) === 1 : null,
      dedupSuppressed: firstNum(suppressed),
    }
  } catch {
    return null
  }
}

// ===== 访客与机器人 / AI 号池(2026-10-23 立:把面板盘里的关键数字直接搬上大屏)=====
/**
 * 这两块**现算**,不读 Prometheus gauge(2026-10-23 改:机主要"实时",不要小时级)。
 *  - 访客块:`getTrafficLiveSnapshot()` —— 直接对 `api_logs` 跑 24h/1h 总计 +
 *    24h 按 UA 分组三条 SQL(实测合计 ≈ 46 ms,走 `api_logs_created_at_idx`),
 *    带 5 秒进程内缓存 ⇒ 大屏 5 秒轮询拿到的就是 5 秒内的真值,且 **api 重启不归零**。
 *  - 号池块:`getRelayPoolLiveSnapshot()` —— 直接读 `ai_relay_key_pool` /
 *    `ai_relay_account_pool`(运营级小表),同样 5 秒缓存,不受 5 分钟 gauge 节奏影响。
 * 两块都:取不到/查询失败一律 null(渲染"—"),**不折成 0**;`aggregationAgeSec`
 * 现在报的是"这份快照距今多少秒"(0..5),不再是"上一次小时级刷新距今"。
 */
interface TrafficSnapshot {
  /** 近 24h PV / UV(api_logs 口径) */
  pv24h: number | null
  uv24h: number | null
  /** 近 1h PV / UV */
  pv1h: number | null
  uv1h: number | null
  /** 近 24h 真人(首方 + 人浏览器)PV 与自动化 PV */
  humanPv24h: number | null
  botPv24h: number | null
  /** 各客户端族近 24h PV(降序) */
  families: Array<{ family: string; pv: number }>
  /** 这份快照距今多少秒(0..TTL);null = 快照取不到,整块不可用 */
  aggregationAgeSec: number | null
  /** true = 族分解被 UA 种类预算截断,族值只是下界 */
  truncated: boolean | null
  /**
   * 近 24h 页面访问排行(visit_logs 口径,最多 8 条);null = 页面热度腿取不到。
   * 2026-10-26 立:此前大屏只有 api_logs 的 PV/UV 与客户端族,回答不了"哪些页面
   * 被用了多少次";本格与 `scopeSplit` 同源(同一次 24h 聚合),单腿失败只置 null。
   */
  pageTop: PageUsageLiveRow[] | null
  /**
   * 近 24h 同口径总 PV(visit_logs 口径,不是 api_logs 的流量)。
   * 前端拿它算「这个页面占了多少」——排行里没有分母就只能比大小,看不出占比。
   * null = 页面热度腿取不到。
   */
  pageTotalPv: number | null
  /** 近 24h 各访问面(前台/后台/登录页)的 PV/UV;null = 同一条腿取不到 */
  scopeSplit: ScopeUsageLiveRow[] | null
  /** 近 24h 各端(web/RN/小程序)PV/UV;null = 同一条腿取不到 */
  platformSplit: PlatformUsageLiveRow[] | null
  /** 近 5 分钟去重会话数(实时在线近似);null = 同一条腿取不到 */
  online5m: number | null
  /** 近 5 分钟浏览量 */
  pv5m: number | null
  /**
   * 近 24h 会话质量(来了之后看了几屏 / 落地页排行);null = 同一条腿取不到。
   * 2026-10-26 立:页面热度说「/chat 被打开 N 次」,不回答「打开的人里有多少顺手又翻了别的
   * 页面」—— 这一格补的就是那句没答的话。口径 = session_id(标签页级),见
   * `services/session-quality-stats-service.ts` 头注。
   */
  sessionQuality: SessionQualitySnapshot | null
  /**
   * 近 24h 访问来源(直接访问 / 本机开发 / 站内 / 外部 + 主机 TOP);null = 同一条腿取不到。
   * 2026-10-26 立:此前大屏只说"多少人用了多少次",不说"他们从哪来"——
   * 生产实测 GitHub 是最大入口,本机开发流量却占着约三成,不分类就分不清推广渠道。
   * 只给 PV(来源维度上访客数无法精确去重),见 `services/visit-source-stats-service.ts` 头注。
   */
  visitSource: VisitSourceSnapshot | null
  /**
   * 近 24h 页面流转(相邻页对 TOP:从哪一页走到了哪一页);null = 同一条腿取不到。
   * 2026-10-26 立:排行只说"哪个页面热"、会话质量只说"看了几屏",
   * 这两格都不答「进来之后走到了哪一步」—— 生产实测最大的一跳是
   * `/ → /sso/login` 与 `/sso/login → /`(未登录用户在登录↔首页之间打转)。
   */
  visitTransition: VisitTransitionSnapshot | null
}

async function buildTraffic(): Promise<TrafficSnapshot | null> {
  // 页面热度是独立腿:失败只把两格置 null(渲染"—"),不拖垮访客块。
  let pageUsage: Awaited<ReturnType<typeof getPageUsageLiveSnapshot>> | null = null
  try {
    pageUsage = await getPageUsageLiveSnapshot()
  } catch {
    pageUsage = null
  }
  // 会话质量也是独立腿:失败只把这一格置 null(渲染"—"),不拖垮其它腿。
  let sessionQuality: SessionQualitySnapshot | null = null
  try {
    sessionQuality = await getSessionQualityLiveSnapshot()
  } catch {
    sessionQuality = null
  }
  // 访问来源同样独立:失败只置 null,不拖垮其它腿。
  let visitSource: VisitSourceSnapshot | null = null
  try {
    visitSource = await getVisitSourceLiveSnapshot()
  } catch {
    visitSource = null
  }
  // 页面流转同样独立:失败只置 null。
  let visitTransition: VisitTransitionSnapshot | null = null
  try {
    visitTransition = await getVisitTransitionLiveSnapshot()
  } catch {
    visitTransition = null
  }
  try {
    // 现算(带 5 秒进程内缓存):三条限窗 SQL 走 api_logs_created_at_idx,合计 ≈ 46 ms。
    // 任何一条抛错都会上抛到下面的 catch ⇒ 整块 null ⇒ 大屏渲染"—",绝不折成 0 访客。
    const live = await getTrafficLiveSnapshot()
    return {
      pv24h: live.pv24h,
      uv24h: live.uv24h,
      pv1h: live.pv1h,
      uv1h: live.uv1h,
      humanPv24h: live.humanPv24h,
      botPv24h: live.botPv24h,
      families: live.families,
      aggregationAgeSec: Math.max(0, Math.floor((Date.now() - live.computedAtMs) / 1000)),
      truncated: live.truncated,
      pageTop: pageUsage?.top ?? null,
      pageTotalPv: pageUsage?.totalPv ?? null,
      scopeSplit: pageUsage?.scopes ?? null,
      platformSplit: pageUsage?.platforms ?? null,
      online5m: pageUsage?.online5m ?? null,
      pv5m: pageUsage?.pv5m ?? null,
      sessionQuality,
      visitSource,
      visitTransition,
    }
  } catch {
    return null
  }
}

interface RelayPoolSnapshot {
  /** key 池:总条数 / 可调度 / 异常(degraded + down) */
  keyTotal: number | null
  keySchedulable: number | null
  keyAbnormal: number | null
  /** 账号池:总条数 / 可调度 */
  accountsTotal: number | null
  accountsSchedulable: number | null
  /** 账号 token 最短临期(秒;负 = 已过期) */
  minTokenExpiresInSeconds: number | null
  /**
   * 这份快照距今多少秒(0..TTL)。**语义已随实时化改写**(2026-10-23):原来报的是
   * "5 分钟一轮的 gauge 多久没刷过",现在池子是现读的,该值恒为 0..5 —— 它就是
   * "这个数有多新"。账号自身 `last_refresh_at` 的年龄另有 `accountRefreshAgeSec`。
   */
  staleAgeSec: number | null
  /** 账号最近一次刷新距今(秒);null = 没有任何账号带刷新戳 */
  accountRefreshAgeSec: number | null
  /** 健康态不在封闭词表内、无法折叠的行数(非 0 说明库里有脏值,必须看得见) */
  rowsUnclassified: number | null
  /** Key 健康四态计数(unknown/healthy/degraded/down;与汇总字段同一把尺子) */
  keyHealth: { unknown: number; healthy: number; degraded: number; down: number } | null
  /** 按 provider 分组的 Key 分布(可调度/异常口径与汇总字段同一把尺子) */
  keyByProvider: Array<{
    provider: string
    total: number
    schedulable: number
    abnormal: number
  }> | null
  /** 按 provider 分组的账号池分布 */
  accountByProvider: Array<{ provider: string; total: number; schedulable: number }> | null
  /** 余额 < 5 元且非"无限"(-1)的 Key 条数 —— 余额预警 */
  keyBalanceLow: number | null
  /** access token 将在 24 小时内过期的账号条数(含已过期) */
  accountExpiring24h: number | null
}

async function buildRelayPool(): Promise<RelayPoolSnapshot | null> {
  try {
    // 现读两张池表(带 5 秒缓存),不经 gauge ⇒ 不受 5 分钟刷新节奏影响,重启也有数。
    const live = await getRelayPoolLiveSnapshot()
    return {
      keyTotal: live.keyTotal,
      keySchedulable: live.keySchedulable,
      keyAbnormal: live.keyAbnormal,
      accountsTotal: live.accountsTotal,
      accountsSchedulable: live.accountsSchedulable,
      minTokenExpiresInSeconds: live.minTokenExpiresInSeconds,
      staleAgeSec: Math.max(0, Math.floor((Date.now() - live.computedAtMs) / 1000)),
      accountRefreshAgeSec: live.maxRefreshAgeSeconds,
      rowsUnclassified: live.rowsUnclassified,
      keyHealth: live.keyHealth,
      keyByProvider: live.keyByProvider,
      accountByProvider: live.accountByProvider,
      keyBalanceLow: live.keyBalanceLow,
      accountExpiring24h: live.accountExpiring24h,
    }
  } catch {
    return null
  }
}

// ===== 业务库聚合 =====

/**
 * 签到快照(2026-10-23 立,机主要求"签到几个/还剩几个未签到"上大屏)。
 * 口径与写入口 `routes/gamification.ts` 严格同源:`sign_in_date` 由 `todayString()` 写,
 * 即 **UTC 日期** 而非上海日界 —— 这里必须用同一个函数取"今天",否则每天 00:00-08:00
 * (上海)会与真实签到记录错开一天,大屏读成 0 而用户明明签过。
 * 未签到人数 = 启用用户数 - 今日签到人数(下限 0);`signIn` 整块取不到时为 null,
 * 不折成 0(0 在大屏上等于"没人签到",与"没量到"是两件事)。
 */
interface SignInSnapshot {
  /** 今日签到人数(按 user_id 去重) */
  todayUsers: number
  /** 今日发放的签到奖励积分合计 */
  todayRewardPoints: number
  /** 今日签到用户中的最高连续签到天数 */
  maxStreakDays: number
  /** 未签到人数 = 启用用户(status=1) - 今日签到人数,下限 0 */
  unsignedActiveUsers: number
  /** 近 7 日每日签到人数(缺的那天补 0:查询成功时"没有记录"就是真 0) */
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
  apiErrRate: number | null
  apiAvgLatencyMs: number | null
  topEndpoints: Array<{ path: string; method: string; calls: number }>
  llmCallsToday: number
  llmTokensToday: number
  llmCostCentsToday: number
  llmErrRate: number | null
  llmP95LatencyMs: number | null
  llmTopModels: Array<{ model: string; calls: number }>
  signIn: SignInSnapshot | null
  /** 近 14 日每日新增用户(上海日界,含今天,后端逐日补齐);查询失败为 null */
  userGrowth: Array<{ date: string; count: number }> | null
  /** 用户构成(全部即时计数,与 usersTotal 同一次查询):VIP 身份 / 操盘手身份 */
  usersVip: number
  usersTrader: number
  /** 邀请注册用户(累计)与近 7 日邀请注册(parent_id 非空 = 经推荐人链接注册) */
  usersInvited: number
  usersInvited7d: number
  /** 等级分布 [普通, 白银, 黄金, 钻石](users.level 0..3) */
  usersByLevel: [number, number, number, number]
  /** 近 7 日签到去重用户数(留存近似);查询失败为 null(不折成 0) */
  activeUsers7d: number | null
}

async function buildBusiness(): Promise<BusinessSnapshot | null> {
  try {
    const todayStart = bizDayStartUtc(0)
    const yestStart = bizDayStartUtc(1)
    // 签到口径:与写入口 gamification.ts 同源 —— 两侧都走 utils/biz-day.ts 的业务日界(上海)
    const signInToday = todayString()
    const signInWeekAgo = shiftDate(signInToday, -6)
    const [
      userRows,
      orderToday,
      orderYest,
      apiToday,
      apiTop,
      llmToday,
      llmModels,
      signToday,
      signWeek,
      userGrowthRows,
      activeUsers7dRows,
    ] = await Promise.all([
      // 用户构成:与 usersTotal 同一次扫描上多加几个 filter 计数 ⇒ 零额外查询成本。
      // is_vip 值域(-1 游客 / 0 普通 / 1 VIP / 2 操盘手)见 users schema 注释。
      dbRead
        .select({
          total: sql<number>`count(*)::int`,
          todayNew: sql<number>`count(*) filter (where ${users.createdAt} >= ${todayStart.toISOString()}::timestamptz)::int`,
          active: sql<number>`count(*) filter (where ${users.status} = 1)::int`,
          vip: sql<number>`count(*) filter (where ${users.isVip} = 1)::int`,
          trader: sql<number>`count(*) filter (where ${users.isVip} = 2)::int`,
          invited: sql<number>`count(*) filter (where ${users.parentId} is not null)::int`,
          invited7d: sql<number>`count(*) filter (where ${users.parentId} is not null and ${users.createdAt} >= ${bizDayStartUtc(6).toISOString()}::timestamptz)::int`,
          level0: sql<number>`count(*) filter (where ${users.level} = 0)::int`,
          level1: sql<number>`count(*) filter (where ${users.level} = 1)::int`,
          level2: sql<number>`count(*) filter (where ${users.level} = 2)::int`,
          level3: sql<number>`count(*) filter (where ${users.level} = 3)::int`,
        })
        .from(users),
      dbRead
        .select({
          paid: sql<number>`count(*)::int`,
          amountCents: sql<number>`coalesce(sum(${orders.amount}), 0)::bigint::int`,
        })
        .from(orders)
        .where(and(gte(orders.createdAt, todayStart), sql`${orders.status} = 'paid'`)),
      dbRead
        .select({ paid: sql<number>`count(*)::int` })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, yestStart),
            lte(orders.createdAt, todayStart),
            sql`${orders.status} = 'paid'`,
          ),
        ),
      dbRead
        .select({
          calls: sql<number>`count(*)::int`,
          // 不得 coalesce 成 0:今天一条请求都没有时,0.00% 会被大屏读成「零错误率」(§0.3)。
          // 无行 ⇒ avg 为 NULL ⇒ 大屏落「—/未判定」。
          errRate: sql<
            number | null
          >`(avg(case when ${apiLogs.statusCode} >= 500 then 1 else 0 end) * 100)::float8`,
          avgLatency: sql<number | null>`avg(${apiLogs.duration})::int`,
        })
        .from(apiLogs)
        .where(gte(apiLogs.createdAt, todayStart)),
      dbRead
        .select({
          path: apiLogs.path,
          method: apiLogs.method,
          calls: sql<number>`count(*)::int`,
        })
        .from(apiLogs)
        .where(gte(apiLogs.createdAt, todayStart))
        .groupBy(apiLogs.path, apiLogs.method)
        .orderBy(desc(sql`count(*)`))
        .limit(5),
      dbRead
        .select({
          calls: sql<number>`count(*)::int`,
          tokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint::int`,
          costCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'costCents')::numeric)), 0)::int`,
          errRate: sql<
            number | null
          >`(avg(case when ${llmCallLogs.status} = 'error' then 1 else 0 end) * 100)::float8`,
          p95Latency: sql<
            number | null
          >`percentile_cont(0.95) WITHIN GROUP (ORDER BY ${llmCallLogs.latencyMs})::int`,
        })
        .from(llmCallLogs)
        .where(gte(llmCallLogs.createdAt, todayStart)),
      dbRead
        .select({
          model: llmCallLogs.model,
          calls: sql<number>`count(*)::int`,
        })
        .from(llmCallLogs)
        .where(gte(llmCallLogs.createdAt, todayStart))
        .groupBy(llmCallLogs.model)
        .orderBy(desc(sql`count(*)`))
        .limit(5),
      // 签到今日汇总:单表独立 catch ⇒ 这张表出问题不拖垮整块业务纵深
      dbRead
        .select({
          users: sql<number>`count(distinct ${signInRecords.userId})::int`,
          points: sql<number>`coalesce(sum(${signInRecords.rewardPoints}), 0)::int`,
          maxStreak: sql<number>`coalesce(max(${signInRecords.consecutiveDays}), 0)::int`,
        })
        .from(signInRecords)
        .where(eq(signInRecords.signInDate, signInToday))
        .catch(() => null),
      // 近 7 日每日签到人数(含今天)
      dbRead
        .select({
          date: sql<string>`to_char(${signInRecords.signInDate}, 'YYYY-MM-DD')`,
          users: sql<number>`count(distinct ${signInRecords.userId})::int`,
        })
        .from(signInRecords)
        .where(gte(signInRecords.signInDate, signInWeekAgo))
        .groupBy(signInRecords.signInDate)
        .orderBy(signInRecords.signInDate)
        .catch(() => null),
      // 近 14 日每日新增用户(上海日界,与 usersTodayNew 同口径:createdAt + 8h 后按日切分)。
      // 这张表出问题不拖垮整块业务纵深 ⇒ 同样单表独立 catch(null)。
      dbRead
        .select({
          date: sql<string>`to_char(${users.createdAt} + interval '8 hours', 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(users)
        .where(gte(users.createdAt, bizDayStartUtc(13)))
        .groupBy(sql`1`)
        .orderBy(sql`1`)
        .catch(() => null),
      // 近 7 日签到去重用户数(留存近似:一天都没签到的用户不进分母口径,报"活跃"而非"沉默")。
      // sign_in_records 有 (user_id, sign_in_date) 唯一索引 ⇒ 这条 count distinct 走索引即可。
      dbRead
        .select({
          users: sql<number>`count(distinct ${signInRecords.userId})::int`,
        })
        .from(signInRecords)
        .where(gte(signInRecords.signInDate, signInWeekAgo))
        .catch(() => null),
    ])
    const u = userRows[0]
    const o = orderToday[0]
    const oy = orderYest[0]
    const a = apiToday[0]
    const l = llmToday[0]
    // 签到块:今日汇总取不到 ⇒ 整块 null(渲染"未判定");近 7 日取不到 ⇒ 只留空数组,
    // 不把"没量到"写成 7 根 0 柱(0 根柱在大屏上等于"连着七天没人签到")
    const st = signToday?.[0]
    const signInUsersToday = st?.users ?? 0
    let signIn: SignInSnapshot | null = null
    if (signToday !== null) {
      const byDate = new Map((signWeek ?? []).map((r) => [r.date, r.users]))
      const last7d: SignInSnapshot['last7d'] = []
      if (signWeek !== null) {
        for (let i = 6; i >= 0; i--) {
          const date = shiftDate(signInToday, -i)
          last7d.push({ date, users: byDate.get(date) ?? 0 })
        }
      }
      signIn = {
        todayUsers: signInUsersToday,
        todayRewardPoints: st?.points ?? 0,
        maxStreakDays: st?.maxStreak ?? 0,
        unsignedActiveUsers: Math.max(0, (u?.active ?? 0) - signInUsersToday),
        last7d,
      }
    }
    // 用户增长:查询失败 ⇒ null(整块不渲染,不把"没量到"画成 14 根 0 柱);
    // 查询成功 ⇒ 按上海日界逐日补齐 14 天 —— 无行的日期是"当天确实 0 注册"这一真实读数。
    let userGrowth: BusinessSnapshot['userGrowth'] = null
    if (userGrowthRows !== null) {
      const byDate = new Map(userGrowthRows.map((r) => [r.date, r.count]))
      userGrowth = []
      for (let i = 13; i >= 0; i--) {
        const date = bizDayKeyAgo(i)
        userGrowth.push({ date, count: byDate.get(date) ?? 0 })
      }
    }
    return {
      usersTotal: u?.total ?? 0,
      usersTodayNew: u?.todayNew ?? 0,
      usersActive: u?.active ?? 0,
      usersVip: u?.vip ?? 0,
      usersTrader: u?.trader ?? 0,
      usersInvited: u?.invited ?? 0,
      usersInvited7d: u?.invited7d ?? 0,
      usersByLevel: [u?.level0 ?? 0, u?.level1 ?? 0, u?.level2 ?? 0, u?.level3 ?? 0],
      activeUsers7d: activeUsers7dRows?.[0]?.users ?? null,
      ordersTodayPaid: o?.paid ?? 0,
      ordersTodayAmountCents: o?.amountCents ?? 0,
      ordersYesterdayPaid: oy?.paid ?? 0,
      apiCallsToday: a?.calls ?? 0,
      apiErrRate: pct2(a?.errRate),
      apiAvgLatencyMs: a?.avgLatency ?? null,
      topEndpoints: apiTop.map((r) => ({
        path: r.path,
        method: r.method,
        calls: r.calls,
      })),
      llmCallsToday: l?.calls ?? 0,
      llmTokensToday: l?.tokens ?? 0,
      llmCostCentsToday: l?.costCents ?? 0,
      llmErrRate: pct2(l?.errRate),
      llmP95LatencyMs: l?.p95Latency ?? null,
      llmTopModels: llmModels.map((r) => ({ model: r.model, calls: r.calls })),
      signIn,
      userGrowth,
    }
  } catch (e) {
    console.error('[ops-wallboard] buildBusiness failed:', e)
    return null
  }
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

interface ActiveAlert {
  name: string
  severity: string
  state: string
  since: string
  summary: string | null
}

interface AlertsSnapshot {
  promActive: ActiveAlert[] | null
  promActiveCount: number | null
  firingTotal: number
  /** 库内 firing 告警的去重名(与 promActive 按名并集,防双源重复计数) */
  firingNames: string[]
  recent: AlertItem[]
}

async function buildAlerts(): Promise<AlertsSnapshot | null> {
  try {
    let promActive: ActiveAlert[] | null = null
    try {
      const res = await fetch(`${ALERTMANAGER_URL}/api/v2/alerts?active=true&silenced=false`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (res.ok) {
        const raw = (await res.json()) as Array<{
          labels?: Record<string, string>
          annotations?: Record<string, string>
          startsAt?: string
          /** AM v1 顶层字段(v2 已移除,保留兼容) */
          state?: string
          /** AM v2 起 state 迁到 status.state */
          status?: { state?: string }
        }>
        promActive = raw
          .map((a) => ({
            name: a.labels?.alertname ?? 'unknown',
            severity: a.labels?.severity ?? 'warning',
            state: a.status?.state ?? a.state ?? 'active',
            since: a.startsAt ?? '',
            summary: a.annotations?.summary ?? a.annotations?.description ?? null,
          }))
          .sort((x, y) => x.since.localeCompare(y.since))
      }
    } catch {
      promActive = null
    }
    const recentRows = await dbRead
      .select({
        name: monitorAlerts.name,
        source: monitorAlerts.source,
        severity: monitorAlerts.severity,
        status: monitorAlerts.status,
        message: monitorAlerts.message,
        firedAt: monitorAlerts.firedAt,
        resolvedAt: monitorAlerts.resolvedAt,
      })
      .from(monitorAlerts)
      .orderBy(desc(monitorAlerts.firedAt))
      .limit(8)
    const firingRows = await dbRead
      .select({ n: sql<number>`count(*)::int` })
      .from(monitorAlerts)
      .where(sql`${monitorAlerts.status} = 'firing'`)
    const firingNameRows = await dbRead
      .select({ names: sql<string[]>`array_agg(distinct ${monitorAlerts.name})` })
      .from(monitorAlerts)
      .where(sql`${monitorAlerts.status} = 'firing'`)
    return {
      promActive,
      promActiveCount: promActive ? promActive.length : null,
      firingTotal: firingRows[0]?.n ?? 0,
      firingNames: firingNameRows[0]?.names ?? [],
      recent: recentRows.map((r) => ({
        ...r,
        firedAt: r.firedAt.toISOString(),
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      })),
    }
  } catch {
    return null
  }
}

interface EventItem {
  type: string
  level: string
  message: string
  createdAt: string
}

async function buildEvents(): Promise<EventItem[] | null> {
  try {
    const rows = await dbRead
      .select({
        type: systemEvents.type,
        level: systemEvents.level,
        message: systemEvents.message,
        createdAt: systemEvents.createdAt,
      })
      .from(systemEvents)
      .orderBy(desc(systemEvents.createdAt))
      .limit(10)
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
  } catch {
    return null
  }
}

// ===== trend(区间序列)=====
const trendQuerySchema = z.object({
  minutes: z.coerce.number().int().min(5).max(240).default(90),
  step: z.coerce.number().int().min(10).max(600).default(30),
})

interface TrendSnapshot {
  startEpochMs: number
  endEpochMs: number
  stepSeconds: number
  /** 请求的区间分钟数(前端「无 5xx」徽章等按此展示,避免与实取参数脱节) */
  minutes: number
  qps: Array<[number, number]>
  errRate: Array<[number, number]>
  cpuPct: Array<[number, number]>
  memPct: Array<[number, number]>
  p95Ms: Array<[number, number]>
  hourlyCalls: Array<{ hour: string; calls: number }>
}

async function buildTrend(minutes: number, step: number): Promise<TrendSnapshot> {
  const end = Math.floor(Date.now() / 1000)
  const start = end - minutes * 60
  const [qps, errRate, cpu, mem, p95, hourlyRows] = await Promise.all([
    promRange('sum(rate(http_requests_total[1m]))', start, end, step),
    promRange(
      'sum(rate(http_requests_by_status{status=~"5.."}[5m])) / clamp_min(sum(rate(http_requests_by_status[5m])), 0.000001)',
      start,
      end,
      step,
    ),
    promRange(
      '100 * (1 - sum(rate(windows_cpu_time_total{mode="idle"}[2m])) / clamp_min(sum(rate(windows_cpu_time_total[2m])), 0.000001))',
      start,
      end,
      step,
    ),
    promRange(
      '100 * (1 - windows_memory_physical_free_bytes / clamp_min(windows_cs_physical_memory_bytes, 1))',
      start,
      end,
      step,
    ),
    promRange(
      'histogram_quantile(0.95, sum by (le) (rate(http_response_time_ms_bucket{job="api"}[5m])))',
      start,
      end,
      step,
    ),
    dbRead
      .select({
        hour: sql<string>`to_char(${apiLogs.createdAt} AT TIME ZONE 'Asia/Shanghai', 'HH24')`,
        calls: sql<number>`count(*)::int`,
      })
      .from(apiLogs)
      .where(gte(apiLogs.createdAt, bizDayStartUtc(0)))
      .groupBy(sql`1`)
      .orderBy(sql`1`)
      .catch(() => [] as Array<{ hour: string; calls: number }>),
  ])
  return {
    startEpochMs: start * 1000,
    endEpochMs: end * 1000,
    stepSeconds: step,
    minutes,
    qps: rangeToSeries(qps),
    errRate: rangeToSeries(errRate),
    cpuPct: rangeToSeries(cpu),
    memPct: rangeToSeries(mem),
    p95Ms: rangeToSeries(p95),
    hourlyCalls: (hourlyRows ?? []).map((r) => ({ hour: r.hour, calls: r.calls })),
  }
}

/**
 * 访客链路(国内加速)实测块 — 数据来自 api 进程内的 `edge-access` 定时探方,不经 Prometheus:
 * 这四个数是"本机视角访问公网入口"的量,没有任何 exporter 采集它。取不到 ⇒ null,
 * 大屏显示"未判定",而不是显示 0ms(0ms 在大屏上长得像"飞快")。
 * `ageSec` 用来回答"这轮量的是多久以前的"——服务刚重启、或探方被禁用时它是唯一线索。
 */
interface EdgeBlock {
  at: string
  ageSec: number
  stats: EdgeStats
  legs: Record<EdgeLegKey, EdgeLegSample>
  series: Array<[number, number, boolean]>
}

function buildEdge(): EdgeBlock | null {
  const snap = latestEdgeSnapshot()
  if (!snap) return null
  return {
    at: snap.at,
    ageSec: Math.max(0, Math.round((Date.now() - Date.parse(snap.at)) / 1000)),
    stats: snap.stats,
    legs: snap.legs,
    series: edgeSeries(),
  }
}

// 公网可达例外(2026-10-20 定):大屏页面本身由公网域名提供,而 server.ts 的 onRoute 钩子
// 对 /api/admin/* 强制注入 network.allowExternal:false ⇒ 大屏取数在公网一律 403
// "External network access not allowed for this route",页面只剩「加载失败 / —」。
// 两条端点只读、无写副作用,鉴权仍由下方 preHandler 的 requireAdmin + httpOnly Cookie 裁定,
// 故显式声明 allowExternal:true 打开公网可达(其余 /api/admin/* 维持强制内网限制)。
const WALLBOARD_NETWORK = { network: { allowExternal: true } }

// ===== 路由 =====
export const adminOpsWallboardRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/ops-wallboard/overview', { config: WALLBOARD_NETWORK }, async (request, reply) => {
    // 字段名含 "token"(llmTokensToday 等)会被 response-sanitizer 遮蔽为 "***"(同 ai-cost);
    // 大屏为 requireAdmin 管理端点,可信上下文直接跳过整端点脱敏
    request.skipResponseSanitization = true
    const [
      host,
      services,
      http,
      redis,
      pg,
      bridge,
      business,
      alerts,
      events,
      traffic,
      relayPool,
      engagement,
      audience,
    ] = await Promise.all([
      buildHost(),
      buildServices(),
      buildHttp(),
      buildRedis(),
      buildPg(),
      buildBridge(),
      buildBusiness(),
      buildAlerts(),
      buildEvents(),
      buildTraffic(),
      buildRelayPool(),
      // 事件热度是独立腿:取不到只让这一格 null(渲染"—"),不拖垮整页。
      getEngagementLiveSnapshot().catch(() => null),
      // 访客构成(近 24h 新访客/回访)同样是独立腿:首现聚合要扫全表分组,失败只让这一格空。
      getAudienceLiveSnapshot().catch(() => null),
    ])
    const edge = buildEdge()
    return reply.send(
      success({
        generatedAt: new Date().toISOString(),
        prometheusUrl: PROMETHEUS_URL,
        sources: {
          prometheus: http !== null || host !== null ? 'up' : 'down',
          alertmanager: alerts !== null && alerts.promActive !== null ? 'up' : 'down',
          database: business !== null ? 'up' : 'down',
          edge: edge !== null ? 'up' : 'down',
        },
        host,
        services,
        http,
        redis,
        pg,
        bridge,
        business,
        alerts,
        events,
        traffic,
        relayPool,
        engagement,
        audience,
        edge,
      }),
    )
  })

  server.get('/ops-wallboard/trend', { config: WALLBOARD_NETWORK }, async (request, reply) => {
    request.skipResponseSanitization = true
    const parsed = trendQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, 'minutes/step 参数不合法'))
    }
    const { minutes, step } = parsed.data
    return reply.send(success(await buildTrend(minutes, step)))
  })
}

export default adminOpsWallboardRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
