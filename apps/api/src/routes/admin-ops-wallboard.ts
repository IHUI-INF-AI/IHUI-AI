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
import { z } from 'zod'
import { desc, gte, lte, sql, and } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { apiLogs, llmCallLogs, monitorAlerts, orders, systemEvents, users } from '@ihui/database'
import { success, error } from '../utils/response.js'
import { requireAdmin } from '../plugins/require-permission.js'

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

// ===== 时区工具:Asia/Shanghai 日界(UTC 表示,口径与 relay-stats.ts 逐字一致)=====
function shanghaiDayStartUtc(daysAgo = 0): Date {
  const shanghaiNow = new Date(Date.now() + 8 * 3600 * 1000)
  return new Date(
    Date.UTC(
      shanghaiNow.getUTCFullYear(),
      shanghaiNow.getUTCMonth(),
      shanghaiNow.getUTCDate() - daysAgo,
    ) -
      8 * 3600 * 1000,
  )
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
  targets: Array<{ job: string; instance: string; up: number }>
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
        up: sampleNum(s) ?? 0,
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
  aiActiveSessions: number | null
}

async function buildHttp(): Promise<HttpSnapshot | null> {
  try {
    const [qps, errRate, p95Api, p95Ai, statusDist, uptime, ws, active, llmSessions] =
      await Promise.all([
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
        promQuery('ihui_llm_active_sessions'),
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
      aiActiveSessions: firstNum(llmSessions),
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

// ===== 业务库聚合 =====

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

async function buildBusiness(): Promise<BusinessSnapshot | null> {
  try {
    const todayStart = shanghaiDayStartUtc(0)
    const yestStart = shanghaiDayStartUtc(1)
    const [userRows, orderToday, orderYest, apiToday, apiTop, llmToday, llmModels] =
      await Promise.all([
        dbRead
          .select({
            total: sql<number>`count(*)::int`,
            todayNew: sql<number>`count(*) filter (where ${users.createdAt} >= ${todayStart.toISOString()}::timestamptz)::int`,
            active: sql<number>`count(*) filter (where ${users.status} = 1)::int`,
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
            errRate: sql<number>`coalesce(avg(case when ${apiLogs.statusCode} >= 500 then 1 else 0 end) * 100, 0)::float8`,
            avgLatency: sql<number>`coalesce(avg(${apiLogs.duration}), 0)::int`,
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
            errRate: sql<number>`coalesce(avg(case when ${llmCallLogs.status} = 'error' then 1 else 0 end) * 100, 0)::float8`,
            p95Latency: sql<number>`coalesce(percentile_cont(0.95) WITHIN GROUP (ORDER BY ${llmCallLogs.latencyMs})::int, 0)`,
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
      ])
    const u = userRows[0]
    const o = orderToday[0]
    const oy = orderYest[0]
    const a = apiToday[0]
    const l = llmToday[0]
    return {
      usersTotal: u?.total ?? 0,
      usersTodayNew: u?.todayNew ?? 0,
      usersActive: u?.active ?? 0,
      ordersTodayPaid: o?.paid ?? 0,
      ordersTodayAmountCents: o?.amountCents ?? 0,
      ordersYesterdayPaid: oy?.paid ?? 0,
      apiCallsToday: a?.calls ?? 0,
      apiErrRate: Number((a?.errRate ?? 0).toFixed(2)),
      apiAvgLatencyMs: a?.avgLatency ?? 0,
      topEndpoints: apiTop.map((r) => ({
        path: r.path,
        method: r.method,
        calls: r.calls,
      })),
      llmCallsToday: l?.calls ?? 0,
      llmTokensToday: l?.tokens ?? 0,
      llmCostCentsToday: l?.costCents ?? 0,
      llmErrRate: Number((l?.errRate ?? 0).toFixed(2)),
      llmP95LatencyMs: l?.p95Latency ?? 0,
      llmTopModels: llmModels.map((r) => ({ model: r.model, calls: r.calls })),
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
      .where(gte(apiLogs.createdAt, shanghaiDayStartUtc(0)))
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

// ===== 路由 =====
export const adminOpsWallboardRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/ops-wallboard/overview', async (request, reply) => {
    // 字段名含 "token"(llmTokensToday 等)会被 response-sanitizer 遮蔽为 "***"(同 ai-cost);
    // 大屏为 requireAdmin 管理端点,可信上下文直接跳过整端点脱敏
    request.skipResponseSanitization = true
    const [host, services, http, redis, pg, bridge, business, alerts, events] = await Promise.all([
      buildHost(),
      buildServices(),
      buildHttp(),
      buildRedis(),
      buildPg(),
      buildBridge(),
      buildBusiness(),
      buildAlerts(),
      buildEvents(),
    ])
    return reply.send(
      success({
        generatedAt: new Date().toISOString(),
        prometheusUrl: PROMETHEUS_URL,
        sources: {
          prometheus: http !== null || host !== null ? 'up' : 'down',
          alertmanager: alerts !== null && alerts.promActive !== null ? 'up' : 'down',
          database: business !== null ? 'up' : 'down',
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
      }),
    )
  })

  server.get('/ops-wallboard/trend', async (request, reply) => {
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
