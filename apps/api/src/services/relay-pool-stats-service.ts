// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 中转号池健康快照服务(2026-10-23 立,backing service for `relay-pool-gauge`)。
 *
 * 要解决的格子:`ai_relay_key_pool`(API key 池)与 `ai_relay_account_pool`
 * (账号池)的健康态**从来只是库里的一列** —— admin 页能看到当次快照,但
 * "哪条 key 什么时候开始 down、冷却/临期有没有人在恢复"没有任何时序,
 * 也没有"池子里还剩几条能用的腿"这个头条数字。本服务把两张表的当前状态
 * 折叠成有界标签的 gauge,5 分钟级刷新。
 *
 * 三条刻意的取舍,后果都写在这里而不是藏在代码里:
 * 1. **不建预聚合表、不出迁移**:池子是运营级小表(2026-10-23 现读 key 池 29 行 /
 *    账号池 1 行),全量 SELECT 的代价与 tenant_quotas 同档;真要历史曲线,
 *    admin 号池页 + 本 gauge 的"当前值"已经够定位,建表的迁移编号还要避开
 *    在飞会话 —— 不值当。
 * 2. **查询失败不写空**:两张表任一查询抛错 ⇒ 本轮**不调 setter**,gauge 保持
 *    上一次的值,新鲜度戳不推进 ⇒ "陈"由 `ihui_relay_*_refresh_last_success_
 *    timestamp_seconds` 自己说。把"没查到"写成空池就是造假(§0.3)。
 * 3. **标签撞车显式计数**:key 池的 name 不唯一(现读 29 行里 16 个不同 name),
 *    priority 又大量重复 ⇒ 展示标签 `${name}-p${priority}` 理论上会撞。
 *    撞了的第二条不覆盖第一条,计入 label_collisions —— 少一条 key 必须看得见。
 *
 * 健康态词表只有一份:`plugins/business-metrics.ts` 的 `RELAY_POOL_HEALTH_STATES`
 * (与 schema 列注释、web 侧 PROVIDER_HEALTH_STATUSES 同源);本文件不抄第二份。
 *
 * 2026-10-23 追加:机主要"实时"。gauge 仍按 5 分钟刷(Grafana 看时序),
 * 但**大屏不再读 gauge**,改读本文件的 `getRelayPoolLiveSnapshot()` —— 同一份
 * `loadRelayPoolRows()` + 同一把 `isRelayPoolRowSchedulable` 尺子,带 5 秒缓存,
 * 所以重启不再需要等下一轮 gauge 才有数,也不会把"进程刚起来"读成"池子空了"。
 */

import { db } from '../db/index.js'
import { aiRelayKeyPool, aiRelayAccountPool } from '@ihui/database'
import {
  isRelayPoolHealthState,
  RELAY_POOL_HEALTH_STATE_VALUE,
  setRelayPoolGaugeSample,
  type RelayPoolAccountSample,
  type RelayPoolHealthState,
  type RelayPoolKeySample,
} from '../plugins/business-metrics.js'

/** 一次刷新的结果(给 scheduler-worker 记日志用;失败时 reason 非空)。 */
export interface RelayPoolRefreshResult {
  keys: number
  accounts: number
  keyRowsSkipped: number
  accountRowsSkipped: number
  keyLabelCollisions: number
  accountLabelCollisions: number
  /** 非空 = 本轮查询失败,gauge 未被动过(旧值 + 不推进的新鲜度戳) */
  reason?: string
}

/**
 * 「异常」的唯一下界:degraded(2)及以上 —— 与 Grafana 面板 `state=~"degraded|down"`
 * 同口径,也直接复用 `RELAY_POOL_HEALTH_STATE_VALUE` 这把"越大越坏"的尺子,
 * 不在本文件另写一张 `new Set(['degraded','down'])`(§0.6 同类判据只许一份)。
 */
export const RELAY_POOL_ABNORMAL_MIN_VALUE = RELAY_POOL_HEALTH_STATE_VALUE.degraded

/** 一行可调度性判定:启用且未被临时摘除。**全仓唯一一份**(gauge 与实时快照共用)。 */
export function isRelayPoolRowSchedulable(row: {
  isEnabled: boolean | null
  tempUnschedulable: boolean | null
}): boolean {
  return Boolean(row.isEnabled) && !row.tempUnschedulable
}

/** 两张池表的原始行(带 schema 全量列,供 gauge 与实时快照两种消费方各自折叠)。 */
export interface RelayPoolRows {
  keyRows: Array<{
    providerCode: string
    name: string
    priority: number
    healthStatus: string
    isEnabled: boolean | null
    tempUnschedulable: boolean | null
    healthCheckedAt: Date | null
    /** 余额(分;-1 = 无限)。仅实时快照的余额预警用,gauge 侧不需要 */
    balanceCents: number | null
  }>
  accountRows: Array<{
    providerCode: string
    uid: string
    healthStatus: string
    isEnabled: boolean | null
    tempUnschedulable: boolean | null
    consecutiveFailures: number
    totalCalls: number
    tokenExpiresAt: Date | null
    lastRefreshAt: Date | null
  }>
}

/**
 * 读两张池表的当前全量行。运营级小表(2026-10-23 现读 key 池 29 行 / 账号池 1 行),
 * 全量 SELECT 与 tenant_quotas 同档 ⇒ 允许在请求路径上按 TTL 缓存后现读。
 * **不 catch**:查询失败上抛,由调用方决定是"保持旧 gauge"还是"把整块折成 null"。
 */
export async function loadRelayPoolRows(): Promise<RelayPoolRows> {
  const [keyRows, accountRows] = await Promise.all([
    db
      .select({
        providerCode: aiRelayKeyPool.providerCode,
        name: aiRelayKeyPool.name,
        priority: aiRelayKeyPool.priority,
        healthStatus: aiRelayKeyPool.healthStatus,
        isEnabled: aiRelayKeyPool.isEnabled,
        tempUnschedulable: aiRelayKeyPool.tempUnschedulable,
        healthCheckedAt: aiRelayKeyPool.healthCheckedAt,
        balanceCents: aiRelayKeyPool.balanceCents,
      })
      .from(aiRelayKeyPool)
      .orderBy(aiRelayKeyPool.providerCode, aiRelayKeyPool.priority, aiRelayKeyPool.name),
    db
      .select({
        providerCode: aiRelayAccountPool.providerCode,
        uid: aiRelayAccountPool.uid,
        healthStatus: aiRelayAccountPool.healthStatus,
        isEnabled: aiRelayAccountPool.isEnabled,
        tempUnschedulable: aiRelayAccountPool.tempUnschedulable,
        consecutiveFailures: aiRelayAccountPool.consecutiveFailures,
        totalCalls: aiRelayAccountPool.totalCalls,
        tokenExpiresAt: aiRelayAccountPool.tokenExpiresAt,
        lastRefreshAt: aiRelayAccountPool.lastRefreshAt,
      })
      .from(aiRelayAccountPool)
      .orderBy(aiRelayAccountPool.providerCode, aiRelayAccountPool.uid),
  ])
  return { keyRows, accountRows }
}

/** 大屏「AI 号池」面板要的全部数字(现读两张池表,不经 gauge)。 */
export interface RelayPoolLiveSnapshot {
  keyTotal: number
  keySchedulable: number
  /** health_state ≥ degraded 的 key 条数(含 down) */
  keyAbnormal: number
  accountsTotal: number
  accountsSchedulable: number
  /** 账号 token 最短临期(秒;负 = 已过期;无账号带 expires_at 时为 null) */
  minTokenExpiresInSeconds: number | null
  /** 账号最近一次刷新距今(秒;null = 一条都没刷过) */
  maxRefreshAgeSeconds: number | null
  /** 健康态不在封闭词表内、因而无法折叠的行数(非 0 必须看得见) */
  rowsUnclassified: number
  /** Key 健康四态计数(unknown/healthy/degraded/down;不含 rowsUnclassified 的脏值行) */
  keyHealth: { unknown: number; healthy: number; degraded: number; down: number }
  /** 按 provider 分组的 Key 分布(可调度/异常口径与汇总字段同一把尺子) */
  keyByProvider: Array<{ provider: string; total: number; schedulable: number; abnormal: number }>
  /** 按 provider 分组的账号池分布 */
  accountByProvider: Array<{ provider: string; total: number; schedulable: number }>
  /** 余额低于 5 元(500 分)且非"无限"(-1)的 Key 条数 —— 余额预警,0 = 无需动作 */
  keyBalanceLow: number
  /** access token 将在 24 小时内过期的账号条数(含已过期) */
  accountExpiring24h: number
  computedAtMs: number
}

/**
 * 现算一份号池实时快照。与 gauge 侧**同一把尺子**(`isRelayPoolRowSchedulable` +
 * `RELAY_POOL_ABNORMAL_MIN_VALUE`),但**不写 gauge**、也不受 5 分钟刷新节奏影响。
 * 不 catch:失败由调用方折成 null。
 */
export async function computeRelayPoolLiveSnapshot(
  nowMs: number = Date.now(),
): Promise<RelayPoolLiveSnapshot> {
  const { keyRows, accountRows } = await loadRelayPoolRows()
  let keySchedulable = 0
  let keyAbnormal = 0
  let rowsUnclassified = 0
  // 以下全部在**已加载的这两份行**上累加 ⇒ 相对现状零新增查询(5 秒轮询不变)
  const keyHealth = { unknown: 0, healthy: 0, degraded: 0, down: 0 }
  const keyByProvider = new Map<string, { total: number; schedulable: number; abnormal: number }>()
  /** 余额预警阈值:5 元(500 分)。-1 = 无限,不参与预警 */
  const KEY_BALANCE_LOW_CENTS = 500
  let keyBalanceLow = 0
  for (const row of keyRows) {
    if (!isRelayPoolHealthState(row.healthStatus)) {
      rowsUnclassified++
      continue
    }
    if (isRelayPoolRowSchedulable(row)) keySchedulable++
    const isAbnormal =
      RELAY_POOL_HEALTH_STATE_VALUE[row.healthStatus] >= RELAY_POOL_ABNORMAL_MIN_VALUE
    if (isAbnormal) keyAbnormal++
    keyHealth[row.healthStatus]++
    const bucket = keyByProvider.get(row.providerCode) ?? { total: 0, schedulable: 0, abnormal: 0 }
    bucket.total++
    if (isRelayPoolRowSchedulable(row)) bucket.schedulable++
    if (isAbnormal) bucket.abnormal++
    keyByProvider.set(row.providerCode, bucket)
    if (row.balanceCents !== null && row.balanceCents >= 0 && row.balanceCents < KEY_BALANCE_LOW_CENTS) {
      keyBalanceLow++
    }
  }
  let accountsSchedulable = 0
  let minTokenExpiresInSeconds: number | null = null
  let maxRefreshAgeSeconds: number | null = null
  const accountByProvider = new Map<string, { total: number; schedulable: number }>()
  /** token 临期预警窗口:24 小时(含已过期的负值) */
  const ACCOUNT_EXPIRING_WINDOW_SEC = 24 * 3600
  let accountExpiring24h = 0
  for (const row of accountRows) {
    if (!isRelayPoolHealthState(row.healthStatus)) {
      rowsUnclassified++
      continue
    }
    if (isRelayPoolRowSchedulable(row)) accountsSchedulable++
    const exp = untilSeconds(row.tokenExpiresAt, nowMs)
    if (exp !== null && (minTokenExpiresInSeconds === null || exp < minTokenExpiresInSeconds)) {
      minTokenExpiresInSeconds = exp
    }
    if (exp !== null && exp <= ACCOUNT_EXPIRING_WINDOW_SEC) accountExpiring24h++
    const age = ageSeconds(row.lastRefreshAt, nowMs)
    if (age !== null && (maxRefreshAgeSeconds === null || age > maxRefreshAgeSeconds)) {
      maxRefreshAgeSeconds = age
    }
    const bucket = accountByProvider.get(row.providerCode) ?? { total: 0, schedulable: 0 }
    bucket.total++
    if (isRelayPoolRowSchedulable(row)) bucket.schedulable++
    accountByProvider.set(row.providerCode, bucket)
  }
  return {
    keyTotal: keyRows.length,
    keySchedulable,
    keyAbnormal,
    accountsTotal: accountRows.length,
    accountsSchedulable,
    minTokenExpiresInSeconds,
    maxRefreshAgeSeconds,
    rowsUnclassified,
    keyHealth,
    keyByProvider: [...keyByProvider.entries()]
      .map(([provider, v]) => ({ provider, ...v }))
      .sort((a, b) => a.provider.localeCompare(b.provider)),
    accountByProvider: [...accountByProvider.entries()]
      .map(([provider, v]) => ({ provider, ...v }))
      .sort((a, b) => a.provider.localeCompare(b.provider)),
    keyBalanceLow,
    accountExpiring24h,
    computedAtMs: nowMs,
  }
}

/** 实时快照 TTL:与大屏 overview 的 5 秒轮询同周期(理由同 traffic 侧)。 */
export const RELAY_POOL_LIVE_TTL_MS = 5_000

let liveCache: { atMs: number; value: RelayPoolLiveSnapshot } | null = null
let liveInflight: Promise<RelayPoolLiveSnapshot> | null = null

/** 取一份"最多 TTL 毫秒前"的号池快照;失败不入缓存(下个请求重试)。 */
export async function getRelayPoolLiveSnapshot(
  ttlMs: number = RELAY_POOL_LIVE_TTL_MS,
): Promise<RelayPoolLiveSnapshot> {
  const nowMs = Date.now()
  if (liveCache && nowMs - liveCache.atMs < ttlMs) return liveCache.value
  if (liveInflight) return liveInflight
  const inflight = (async () => {
    try {
      const value = await computeRelayPoolLiveSnapshot()
      liveCache = { atMs: value.computedAtMs, value }
      return value
    } finally {
      liveInflight = null
    }
  })()
  liveInflight = inflight
  return inflight
}

/** 仅测试用:清缓存。 */
export function __resetRelayPoolLiveCacheForTest(): void {
  liveCache = null
  liveInflight = null
}

/** 年龄类秒数:now 与过去时刻之差,负值(时钟漂移)钳 0;null 原样返回。 */
function ageSeconds(at: Date | null, nowMs: number): number | null {
  if (!at) return null
  const ms = at.getTime()
  if (!Number.isFinite(ms)) return null
  return Math.max(0, Math.floor((nowMs - ms) / 1000))
}

/** 到未来时刻的秒数(token 临期):**不钳负**(负 = 已过期,正是要看的信号)。 */
function untilSeconds(at: Date | null, nowMs: number): number | null {
  if (!at) return null
  const ms = at.getTime()
  if (!Number.isFinite(ms)) return null
  return Math.floor((ms - nowMs) / 1000)
}

/**
 * 跑一轮全量刷新:两张表各一条全量 SELECT ⇒ 折叠 ⇒ 一次性写入 gauge。
 * 任何一步抛错都向上抛(由 `refreshRelayPoolGauges` 收成 reason),**不写半个 gauge**。
 */
export async function refreshRelayPoolGauges(
  nowMs: number = Date.now(),
): Promise<RelayPoolRefreshResult> {
  const { keyRows, accountRows } = await loadRelayPoolRows()

  const keys: RelayPoolKeySample[] = []
  let keyRowsSkipped = 0
  for (const row of keyRows) {
    if (!isRelayPoolHealthState(row.healthStatus)) {
      keyRowsSkipped++
      continue
    }
    const healthState: RelayPoolHealthState = row.healthStatus
    keys.push({
      providerCode: row.providerCode,
      key: `${row.name}-p${row.priority}`,
      healthState,
      schedulable: isRelayPoolRowSchedulable(row),
      healthAgeSeconds: ageSeconds(row.healthCheckedAt, nowMs),
    })
  }

  const accounts: RelayPoolAccountSample[] = []
  let accountRowsSkipped = 0
  for (const row of accountRows) {
    if (!isRelayPoolHealthState(row.healthStatus)) {
      accountRowsSkipped++
      continue
    }
    const healthState: RelayPoolHealthState = row.healthStatus
    accounts.push({
      providerCode: row.providerCode,
      account: row.uid,
      healthState,
      schedulable: isRelayPoolRowSchedulable(row),
      consecutiveFailures: row.consecutiveFailures,
      totalCalls: row.totalCalls,
      tokenExpiresInSeconds: untilSeconds(row.tokenExpiresAt, nowMs),
      refreshAgeSeconds: ageSeconds(row.lastRefreshAt, nowMs),
    })
  }

  setRelayPoolGaugeSample({
    keys,
    accounts,
    refreshedAtMs: nowMs,
    keyRowsSkipped,
    accountRowsSkipped,
  })

  return {
    keys: keys.length,
    accounts: accounts.length,
    keyRowsSkipped,
    accountRowsSkipped,
    // 撞车计数由 setter 在清洗后判定,本函数拿不到 ⇒ 由调用方从指标侧读;
    // 这里报 0 只是"服务层未判定",不是"没有撞"(见 __test__ 的边界说明)。
    keyLabelCollisions: 0,
    accountLabelCollisions: 0,
  }
}

/**
 * scheduler 入口:与 `refreshRelayPoolGauges` 同一实现,但**永不抛** ——
 * 查询失败收进 `reason` 且不碰 gauge(旧值 + 新鲜度戳自证变陈)。
 */
export async function refreshRelayPoolGaugesSafely(
  nowMs: number = Date.now(),
): Promise<RelayPoolRefreshResult> {
  try {
    return await refreshRelayPoolGauges(nowMs)
  } catch (err) {
    return {
      keys: 0,
      accounts: 0,
      keyRowsSkipped: 0,
      accountRowsSkipped: 0,
      keyLabelCollisions: 0,
      accountLabelCollisions: 0,
      reason: err instanceof Error ? err.message : String(err),
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
