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
 */

import { db } from '../db/index.js'
import { aiRelayKeyPool, aiRelayAccountPool } from '@ihui/database'
import {
  isRelayPoolHealthState,
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
      schedulable: row.isEnabled && !row.tempUnschedulable,
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
      schedulable: row.isEnabled && !row.tempUnschedulable,
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
