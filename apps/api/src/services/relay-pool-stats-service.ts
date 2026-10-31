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
 * `loadRelayPoolRows()` + 同一套可调度尺子(key/账号各一把,见下),带 5 秒缓存,
 * 所以重启不再需要等下一轮 gauge 才有数,也不会把"进程刚起来"读成"池子空了"。
 *
 * 2026-10-26 追加(号池"容量归零"从来没人量):本文件新增 `foldRelayPoolCapacity()` ——
 * 按 provider 折叠 total/enabled/schedulable 三档,是**容量口径的唯一实现**,同时供
 * ① gauge 族 `ihui_relay_account_pool_{accounts,enabled_accounts,schedulable_accounts,zero_capacity}{provider_code}`
 * (与 key 族 `*_schedulable_keys` 同节拍:同一个 `relay-pool-gauge` job、同一次 setter)、
 * ② 每轮刷新里的到人 warn(容量归零/整池无启用号)、
 * ③ 告警引擎 `relay-alert-rules-service.ts` 的号池指标。
 * 与上面第 4 条大屏 `accountByProvider` 的分工不是重复实现:那一块回答"健康态可折叠的行里
 * 有几条能调度"(展示口径,脏健康态行已被词表闸在外),这一块回答"池子里到底还有没有腿"
 * (容量口径,停用行与词表外脏行都在册);两把尺子的**可调度判定仍然只有
 * `isRelayPoolRowSchedulable` 一份**(§0.6)。
 */

import { db } from '../db/index.js'
import { aiRelayKeyPool, aiRelayAccountPool } from '@ihui/database'
import { logger } from '../utils/logger.js'
import {
  isRelayPoolHealthState,
  RELAY_POOL_HEALTH_STATES,
  RELAY_POOL_HEALTH_STATE_VALUE,
  setRelayPoolGaugeSample,
  type RelayPoolAccountSample,
  type RelayPoolHealthState,
  type RelayPoolKeySample,
  type RelayPoolProviderCapacity,
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

/**
 * 账号池「可调度」的健康态白名单 —— **唯一份**,从 `RELAY_POOL_HEALTH_STATES` 派生(去掉 down)。
 *
 * 立因(2026-10-30 实测):选号 SQL(`relay-account-pool-scheduler` 的
 * `accountSchedulableCondition`)判 `health ≠ down`,而本文件的 `isRelayPoolRowSchedulable`
 * 只看启用/摘除 ⇒ 巡检判死但尚未触发 temp 摘除的那一窗里,大屏、gauge 与告警引擎都把它
 * 算成"可调度的腿"(高估容量、掩盖归零)。key 池调度侧确实不看健康态(有熔断器另管),
 * 所以两个池子的可调度判据本来就该是两把尺子,但都必须与各自调度侧同源。
 *
 * `unknown` 仍可选(新导入/未判定要给一次实测机会),`healthy`/`degraded` 照旧可选。
 */
export const ACCOUNT_SCHEDULABLE_HEALTH_STATES = RELAY_POOL_HEALTH_STATES.filter(
  (state) => state !== 'down',
) as readonly Exclude<RelayPoolHealthState, 'down'>[]

/**
 * 账号池一行可调度性判定:与调度侧 `accountSchedulableCondition()` 同口径。
 *
 * 2026-10-31 补票面维:此前只判启用/摘除/健康态 ⇒ 票过期 70 小时的 minimax 被算成
 * 「可调度」,既污染大屏分子,又让它有机会被选号撞上游 401。无票面(cookie 型)放行。
 */
export function isRelayAccountRowSchedulable(
  row: {
    isEnabled: boolean | null
    tempUnschedulable: boolean | null
    healthStatus?: string | null
    tokenExpiresAt?: Date | null
  },
  nowMs: number = Date.now(),
): boolean {
  return (
    isRelayPoolRowSchedulable(row) &&
    typeof row.healthStatus === 'string' &&
    (ACCOUNT_SCHEDULABLE_HEALTH_STATES as readonly string[]).includes(row.healthStatus) &&
    (!row.tokenExpiresAt || row.tokenExpiresAt.getTime() > nowMs)
  )
}

/** 折叠容量所需的最小行形(两张池表都满足)。 */
export interface RelayPoolCapacityRow {
  providerCode: string
  isEnabled: boolean | null
  tempUnschedulable: boolean | null
  /**
   * 健康态。key 池容量**不读**它(调度侧不看健康态,由熔断器另管);
   * 账号池容量必须读它 —— 判据见 `isRelayAccountRowSchedulable`。
   */
  healthStatus?: string | null
  /** 票面到期时刻。账号池容量同样要读:票过期的号没有容量(与选号同一把尺子)。 */
  tokenExpiresAt?: Date | null
}

/**
 * 按 provider 折叠一个池子的容量三档(total / enabled / schedulable)。**唯一一份**:
 * gauge 侧的 `ihui_relay_account_pool_*{provider_code}`、告警引擎的号池指标、
 * 以及下面的到人日志,全部读它,不许在任何一侧再数一遍(AGENTS §0.6)。
 *
 * 三条口径写死在这里,免得日后各自漂移:
 * - `totalRows` 计**所有**行(含 is_enabled=false、含健康态落在封闭词表之外的脏值行)
 *   —— 容量问的是"池子里有没有腿",与健康态词表能不能折叠无关;
 * - `enabledRows` 只数 `is_enabled = true`(临时摘除的也算,那正是"有号但调度不到"这一型);
 * - `schedulableRows` 走调用方给的判据(缺省 `isRelayPoolRowSchedulable`);账号池必须传
 *   `isRelayAccountRowSchedulable`,否则 health=down 但尚未置 temp 的行会被算成"有腿",
 *   容量归零告警就永远不会响。
 * 结果按 providerCode 升序(渲染与日志都要确定性顺序)。空输入 ⇒ 空数组(不是"全 0")。
 */
export function foldRelayPoolCapacity(
  rows: readonly RelayPoolCapacityRow[],
  schedulableOf: (row: RelayPoolCapacityRow) => boolean = isRelayPoolRowSchedulable,
): RelayPoolProviderCapacity[] {
  const byProvider = new Map<string, RelayPoolProviderCapacity>()
  for (const row of rows) {
    const bucket = byProvider.get(row.providerCode) ?? {
      providerCode: row.providerCode,
      totalRows: 0,
      enabledRows: 0,
      schedulableRows: 0,
    }
    bucket.totalRows++
    if (Boolean(row.isEnabled)) bucket.enabledRows++
    if (schedulableOf(row)) bucket.schedulableRows++
    byProvider.set(row.providerCode, bucket)
  }
  return [...byProvider.values()].sort((a, b) => a.providerCode.localeCompare(b.providerCode))
}

/** 账号池容量折叠的唯一入口(含 health=down 排除);消费方不得直接给 `foldRelayPoolCapacity` 传裸行。 */
export function foldRelayAccountCapacity(
  rows: readonly RelayPoolCapacityRow[],
): RelayPoolProviderCapacity[] {
  return foldRelayPoolCapacity(rows, isRelayAccountRowSchedulable)
}

/** 容量归零的 provider(enabled>0 ∧ schedulable=0)—— 静默回落正在发生的那一格。 */
export function zeroCapacityProviders(
  capacity: readonly RelayPoolProviderCapacity[],
): RelayPoolProviderCapacity[] {
  return capacity.filter((c) => c.enabledRows > 0 && c.schedulableRows === 0)
}

/** 整池归零(一条 enabled 号都没有)—— 与"provider 全停用"同型,单独点名不并入上一档。 */
export function poolHasNoEnabledRows(capacity: readonly RelayPoolProviderCapacity[]): boolean {
  return capacity.reduce((acc, c) => acc + c.enabledRows, 0) === 0
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
  /** key 池总行数(含停用/脏健康态行) */
  keyTotal: number
  /** key 池健康态可判定的行数 —— 「可调度 Key」的分母必须是它,不是 keyTotal */
  keyClassified: number
  keySchedulable: number
  /** health_state ≥ degraded 的 key 条数(含 down;与 keySchedulable 不互斥,可调度 ≠ 健康) */
  keyAbnormal: number
  /** 异常 key 里**仍能被选中**的条数(解释"可调度 14/14 却异常 2"这对读数) */
  keyAbnormalSchedulable: number
  /** key 池健康态不在封闭词表内的行数 */
  keyRowsUnclassified: number
  /** 余额低于 5 元且非"无限"的**可调度** key 条数(停用 key 没钱不算信号) */
  keyBalanceLow: number
  /** 账号池总行数(含停用/脏健康态行) */
  accountsTotal: number
  /** 账号池健康态可判定的行数 —— 「可调度账号」的分母必须是它 */
  accountClassified: number
  accountsSchedulable: number
  /** 可判定但不可调度的账号数(停用 / 临时摘除 / 宕机) —— = accountClassified - accountsSchedulable */
  accountsBlocked: number
  /** 不可调度账号里 token 已过期的条数(死号仍然可见,但不再污染临期读数) */
  accountsBlockedExpired: number
  /**
   * **可调度账号**里最短的 token 临期(秒;负 = 已过期;无此类账号带 expires_at 时为 null)。
   * 已被停用/摘除/判死的号不参与 —— 否则一条永远修不好的死号会把面板永久钉在"已过期",
   * 并把真正需要动作的临期信号(例如可调度号 19 小时后到期)盖掉。
   */
  minTokenExpiresInSeconds: number | null
  /** 全池**最久**未刷新的账号距今(秒;null = 一条都没刷过) */
  maxRefreshAgeSeconds: number | null
  /** 全池**最近一次**刷新距今(秒;null = 一条都没刷过)—— 刷新巡检还活着的正向信号 */
  minRefreshAgeSeconds: number | null
  /** 账号池健康态不在封闭词表内的行数 */
  accountRowsUnclassified: number
  /** 两张池合计的脏健康态行数(保留给既有消费方;新消费方请用上面两个分池字段) */
  rowsUnclassified: number
  /** Key 健康四态计数(unknown/healthy/degraded/down;不含 rowsUnclassified 的脏值行) */
  keyHealth: { unknown: number; healthy: number; degraded: number; down: number }
  /** 按 provider 分组的 Key 分布(可调度/异常口径与汇总字段同一把尺子) */
  keyByProvider: Array<{ provider: string; total: number; schedulable: number; abnormal: number }>
  /** 按 provider 分组的账号池分布 */
  accountByProvider: Array<{ provider: string; total: number; schedulable: number }>
  /** access token 将在 24 小时内过期的**可调度**账号条数(含已过期) */
  accountExpiring24h: number
  computedAtMs: number
}

/**
 * 现算一份号池实时快照。与 gauge 侧**同一把尺子**(key 用 `isRelayPoolRowSchedulable`、
 * 账号用 `isRelayAccountRowSchedulable`,异常用 `RELAY_POOL_ABNORMAL_MIN_VALUE`),
 * 但**不写 gauge**、也不受 5 分钟刷新节奏影响。不 catch:失败由调用方折成 null。
 */
export async function computeRelayPoolLiveSnapshot(
  nowMs: number = Date.now(),
): Promise<RelayPoolLiveSnapshot> {
  const { keyRows, accountRows } = await loadRelayPoolRows()
  let keySchedulable = 0
  let keyAbnormal = 0
  let keyAbnormalSchedulable = 0
  let keyRowsUnclassified = 0
  // 以下全部在**已加载的这两份行**上累加 ⇒ 相对现状零新增查询(5 秒轮询不变)
  const keyHealth = { unknown: 0, healthy: 0, degraded: 0, down: 0 }
  const keyByProvider = new Map<string, { total: number; schedulable: number; abnormal: number }>()
  /** 余额预警阈值:5 元(500 分)。-1 = 无限,不参与预警 */
  const KEY_BALANCE_LOW_CENTS = 500
  let keyBalanceLow = 0
  for (const row of keyRows) {
    if (!isRelayPoolHealthState(row.healthStatus)) {
      keyRowsUnclassified++
      continue
    }
    const schedulable = isRelayPoolRowSchedulable(row)
    if (schedulable) keySchedulable++
    const isAbnormal =
      RELAY_POOL_HEALTH_STATE_VALUE[row.healthStatus] >= RELAY_POOL_ABNORMAL_MIN_VALUE
    if (isAbnormal) keyAbnormal++
    if (isAbnormal && schedulable) keyAbnormalSchedulable++
    keyHealth[row.healthStatus]++
    const bucket = keyByProvider.get(row.providerCode) ?? { total: 0, schedulable: 0, abnormal: 0 }
    bucket.total++
    if (schedulable) bucket.schedulable++
    if (isAbnormal) bucket.abnormal++
    keyByProvider.set(row.providerCode, bucket)
    // 只有能被选中的 key 没钱才是信号;停用/摘除的 key 余额为 0 是正常存量
    if (
      schedulable &&
      row.balanceCents !== null &&
      row.balanceCents >= 0 &&
      row.balanceCents < KEY_BALANCE_LOW_CENTS
    ) {
      keyBalanceLow++
    }
  }
  let accountsSchedulable = 0
  let accountsBlocked = 0
  let accountsBlockedExpired = 0
  let accountRowsUnclassified = 0
  let minTokenExpiresInSeconds: number | null = null
  let maxRefreshAgeSeconds: number | null = null
  let minRefreshAgeSeconds: number | null = null
  const accountByProvider = new Map<string, { total: number; schedulable: number }>()
  /** token 临期预警窗口:24 小时(含已过期的负值) */
  const ACCOUNT_EXPIRING_WINDOW_SEC = 24 * 3600
  let accountExpiring24h = 0
  for (const row of accountRows) {
    if (!isRelayPoolHealthState(row.healthStatus)) {
      accountRowsUnclassified++
      continue
    }
    // 与选号 SQL 同一把尺子:down 的号即使还没被 temp 摘除也不再算"可调度"
    const schedulable = isRelayAccountRowSchedulable(row)
    if (schedulable) accountsSchedulable++
    else accountsBlocked++
    const exp = untilSeconds(row.tokenExpiresAt, nowMs)
    if (schedulable) {
      if (exp !== null && (minTokenExpiresInSeconds === null || exp < minTokenExpiresInSeconds)) {
        minTokenExpiresInSeconds = exp
      }
      if (exp !== null && exp <= ACCOUNT_EXPIRING_WINDOW_SEC) accountExpiring24h++
    } else if (exp !== null && exp < 0) {
      // 死号的过期票单独计数:仍然看得见,但不再冒充"池子最短临期"
      accountsBlockedExpired++
    }
    const age = ageSeconds(row.lastRefreshAt, nowMs)
    if (age !== null) {
      if (maxRefreshAgeSeconds === null || age > maxRefreshAgeSeconds) maxRefreshAgeSeconds = age
      if (minRefreshAgeSeconds === null || age < minRefreshAgeSeconds) minRefreshAgeSeconds = age
    }
    const bucket = accountByProvider.get(row.providerCode) ?? { total: 0, schedulable: 0 }
    bucket.total++
    if (schedulable) bucket.schedulable++
    accountByProvider.set(row.providerCode, bucket)
  }
  return {
    keyTotal: keyRows.length,
    keyClassified: keyRows.length - keyRowsUnclassified,
    keySchedulable,
    keyAbnormal,
    keyAbnormalSchedulable,
    keyRowsUnclassified,
    accountsTotal: accountRows.length,
    accountClassified: accountRows.length - accountRowsUnclassified,
    accountsSchedulable,
    accountsBlocked,
    accountsBlockedExpired,
    minTokenExpiresInSeconds,
    maxRefreshAgeSeconds,
    minRefreshAgeSeconds,
    accountRowsUnclassified,
    rowsUnclassified: keyRowsUnclassified + accountRowsUnclassified,
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
const RELAY_POOL_LIVE_TTL_MS = 5_000

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
async function refreshRelayPoolGauges(nowMs: number = Date.now()): Promise<RelayPoolRefreshResult> {
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
      // 与选号 SQL 同口径(down 不再算可调度);key 侧仍用 isRelayPoolRowSchedulable(有熔断器另管)
      schedulable: isRelayAccountRowSchedulable(row),
      consecutiveFailures: row.consecutiveFailures,
      totalCalls: row.totalCalls,
      tokenExpiresInSeconds: untilSeconds(row.tokenExpiresAt, nowMs),
      refreshAgeSeconds: ageSeconds(row.lastRefreshAt, nowMs),
    })
  }

  // 按 provider 的容量折叠(全仓唯一一份算法,见 foldRelayPoolCapacity 头注):
  // 喂 gauge 的 ihui_relay_account_pool_{accounts,enabled_accounts,schedulable_accounts,zero_capacity}
  // 四连,也喂下面的到人日志,还喂告警引擎 `relay-alert-rules-service` 的号池指标。
  // 取的是**原始行**而非上面的样本 ⇒ 停用行/脏健康态行都在册,容量不被词表过滤遮蔽。
  const accountCapacity = foldRelayAccountCapacity(accountRows)

  setRelayPoolGaugeSample({
    keys,
    accounts,
    accountCapacity,
    refreshedAtMs: nowMs,
    keyRowsSkipped,
    accountRowsSkipped,
  })

  // 容量归零必须当场喊出来(2026-10-26 立):此前"账号池一条都调度不到"与"这个站点
  // 压根没用账号池"在观面上同形,回落点的 catch 连一行日志都没有。gauge 是面板面,
  // 这一行是日志面 —— 两脸都要有,缺一就还是"造好没装车"(AGENTS §0.9)。
  // 节拍 = 本 job 每 5 分钟一轮,不在请求路径上 ⇒ 不会成日志风暴。
  for (const c of zeroCapacityProviders(accountCapacity)) {
    logger.warn(
      `[relay-pool] 账号池容量归零:provider=${c.providerCode} enabled=${c.enabledRows} schedulable=0` +
        ` —— 该 provider 的账号池回退现在每次都静默落回 ai-service;` +
        `下一步:后台「中转-号池-账号池」把 temp_unschedulable 解除(冷却到期自动解除看 consecutive_failures),` +
        `或补入可用号;复现口径 node scripts/check-relay-capacity-zero.mjs`,
      { providerCode: c.providerCode, enabledRows: c.enabledRows, totalRows: c.totalRows },
    )
  }
  if (accountCapacity.length > 0 && poolHasNoEnabledRows(accountCapacity)) {
    logger.warn(
      `[relay-pool] 账号池整池无可启用号:providers=${accountCapacity.map((c) => c.providerCode).join(',')} ` +
        `rows=${accountCapacity.reduce((acc, c) => acc + c.totalRows, 0)} enabled=0` +
        ` —— 全部 is_enabled=false,账号池这条腿等于不存在;` +
        `下一步:确认是否刻意停用(那么在容量哨兵里登记白名单理由),否则在后台重新启用需要的号`,
      { providers: accountCapacity.map((c) => c.providerCode) },
    )
  }

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
