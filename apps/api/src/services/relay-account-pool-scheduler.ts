// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号池调度服务(2026-10-22 立):token 临期刷新 + 健康巡检 + 熔断自愈。
 *
 * 由 relay-account-pool-worker(BullMQ,每 5 分钟)驱动,单轮三件事:
 * 1. refreshExpiring:access token 距过期 < 15 分钟且有 refreshToken → 调适配器刷新回写
 *    (对标 trae-cn-proxy-rs 的 15 分钟临期检测 + ExchangeToken 续期)
 * 2. sweepUnknown:healthStatus=unknown 的账号 → 适配器 checkHealth 定级 healthy/down
 * 3. recoverDown:down 且有 refreshToken 且刷新失败次数未超限 → 再试一次刷新,成功则回 unknown
 *    等下轮复检(对标 workbuddy-manager 的验活摘除 + 恢复)
 *
 * 刷新连续失败 REFRESH_FAILURE_LIMIT 次 → tempUnschedulable=true(自动摘除,admin 可见原因)。
 * 与 relay-channel-router 的进程级熔断互补:这里是「账号凭证生命周期」,那里是「渠道调用质量」。
 */
import { and, eq, isNotNull, isNull, lt, lte, or, inArray } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { aiRelayAccountPool, type AiRelayAccountPool } from '@ihui/database'
import { decryptAccountCredentials, type AccountCredentials } from './relay-account-pool-service.js'
import { tryAcquireSharedLock } from './relay-account-shared-state.js'
import { encryptField } from '../utils/crypto.js'
import { logger } from '../utils/logger.js'
import { getRelayAdapter, type AdapterAccountContext } from './relay-upstream-adapters.js'
import { purgeAccountUsage } from './relay-account-usage.js'

/** 临期刷新窗口:距过期 15 分钟内触发(上游 token 寿命 ~14 天,窗口足够宽) */
const REFRESH_AHEAD_MS = 15 * 60 * 1000
/** 连续刷新失败摘除阈值 */
const REFRESH_FAILURE_LIMIT = 3
/** 单轮最多处理的账号数(防刷新风暴打爆上游) */
const BATCH_LIMIT = 50
/** 单轮刷新/健康检查的并发上限(手写 worker pool,不引依赖) */
const SWEEP_CONCURRENCY = 5
/** 台账清理节流:两次 delete 至少间隔 24h(sweep 每 5 分钟一轮,不加节流会每分钟删) */
const USAGE_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000
let lastUsagePurgeAt = 0
/** 巡检分布式锁:锁名 + 租约 TTL(10 分钟 ≥ 单轮最坏耗时;进程崩溃锁自愈,不阻塞下轮) */
export const SWEEP_LOCK_NAME = 'relay-account-pool-sweep'
const SWEEP_LOCK_TTL_MS = 10 * 60 * 1000
/**
 * unknown 复检退避:上游持续不可用时不必每 5 分钟重打一遍。
 * 新导入账号 healthCheckedAt 为空 → 立即受检;判成「未判定」后隔 30 分钟再试。
 */
const UNKNOWN_RECHECK_MS = 30 * 60 * 1000

/**
 * 健康结果 → 持久化状态(唯一口径:巡检 / 管理面 / 导入 CLI 共用)。
 * indeterminate 保留 unknown,严禁写 down —— 「取不到」不等于「凭据失效」。
 */
export function healthStatusOf(outcome: {
  ok: boolean
  indeterminate?: boolean
}): 'healthy' | 'down' | 'unknown' {
  if (outcome.ok) return 'healthy'
  return outcome.indeterminate === true ? 'unknown' : 'down'
}

export interface AccountPoolSweepResult {
  refreshed: number
  refreshFailed: number
  refreshSkipped: number
  healthChecked: number
  healthRecovered: number
  /** true = 分布式锁被其他实例持有,本轮整体跳过(多实例不重复 sweep) */
  skipped: boolean
}

function ctxOf(row: AiRelayAccountPool, credentials: AccountCredentials): AdapterAccountContext {
  return { row, credentials }
}

/** 简单 worker pool:最多 limit 个 worker 并行消费 items(保持结果不确定但计数一致)。 */
async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++
      const item = items[idx]
      if (item !== undefined) await worker(item)
    }
  })
  await Promise.all(runners)
}

/** 台账过期清理(24h 节流;失败由 purgeAccountUsage 内部吞掉)。 */
async function maybePurgeUsageLedger(): Promise<void> {
  const now = Date.now()
  if (lastUsagePurgeAt > 0 && now - lastUsagePurgeAt < USAGE_PURGE_INTERVAL_MS) return
  lastUsagePurgeAt = now
  const deleted = await purgeAccountUsage()
  if (deleted > 0) {
    logger.info('[relay-account-pool] 过期用量台账已清理', { deleted })
  }
}

/** 单测用:重置 24h 清理节流(模块级状态,避免跨用例互相影响)。 */
export const __test__ = {
  resetUsagePurgeThrottle(): void {
    lastUsagePurgeAt = 0
  },
}

/**
 * "这枚账号还能不能自己再取到凭据"的谓词 = 有 refreshToken **或** 有 cookie。
 *
 * 立因(2026-10-23 现读):Trae 的 web 号只有登录 cookie、没有 refreshToken
 * (它的 `refreshToken` 走 cookie→GetUserToken 换票,rt 只是兜底通道),而两档候选都写死了
 * `refreshTokenEnc IS NOT NULL` ⇒ 这类号既进不了临期刷新、也进不了 down 恢复队列,
 * 一旦掉进 healthStatus=down 就永久停在那儿,除非有人手工点一次余额。
 * 归属判据应当是"适配器能不能重新拿到凭据",不是"某一枚列恰好非空"。
 */
export function recredentialableCondition() {
  return or(isNotNull(aiRelayAccountPool.refreshTokenEnc), isNotNull(aiRelayAccountPool.cookiesEnc))
}

/** 步骤 1「临期刷新」的 where(导出供镜像测试锁形状,查询与断言读同一个对象) */
export function expiringRefreshWhere(deadline: Date) {
  return and(
    eq(aiRelayAccountPool.isEnabled, true),
    recredentialableCondition(),
    lte(aiRelayAccountPool.tokenExpiresAt, deadline),
  )
}

/** 步骤 3「down/degraded 恢复」的 where(不设到期界限:健康已判死,属按需重试) */
export function downRecoveryWhere() {
  return and(
    eq(aiRelayAccountPool.isEnabled, true),
    inArray(aiRelayAccountPool.healthStatus, ['down', 'degraded']),
    recredentialableCondition(),
  )
}

/**
 * 刷新单账号;成功回写凭证,失败累计摘除。返回 true = 刷新成功。
 * 导出给管理面「按需查余额」共用同一把出口(回写/解摘/失败累计的口径只有一份)。
 */
export async function refreshOne(row: AiRelayAccountPool): Promise<boolean> {
  const adapter = getRelayAdapter(row.providerCode)
  if (!adapter?.refreshToken) return false
  const credentials = decryptAccountCredentials(row)
  try {
    const result = await adapter.refreshToken(ctxOf(row, credentials), { proxyUrl: row.proxyUrl })
    if (!result) return false
    const now = new Date()
    await db
      .update(aiRelayAccountPool)
      .set({
        tokenEnc: encryptField(result.token),
        refreshTokenEnc:
          result.refreshToken !== undefined && result.refreshToken !== null
            ? encryptField(result.refreshToken)
            : row.refreshTokenEnc,
        // 平台扩展凭据整包回写(CodeArts 刷新轮转整套 STS 凭据;无 secrets 的平台保持原值)
        ...(result.secrets && Object.keys(result.secrets).length > 0
          ? { secretsEnc: encryptField(JSON.stringify(result.secrets)) }
          : {}),
        tokenExpiresAt: result.expiresAt,
        lastRefreshAt: now,
        refreshFailureCount: 0,
        // 刷新成功即解除「凭证失效」型摘除;健康状态回 unknown 等巡检定级
        tempUnschedulable: false,
        healthStatus: row.healthStatus === 'down' ? 'unknown' : row.healthStatus,
        lastErrorMessage: null,
        updatedAt: now,
      })
      .where(eq(aiRelayAccountPool.id, row.id))
    return true
  } catch (e) {
    const failures = row.refreshFailureCount + 1
    const shouldRemove = failures >= REFRESH_FAILURE_LIMIT
    // 失败原因必须自己带出来:原先 catch 把异常整个吞掉,只有撞上限那一次才写一句
    // "连续 N 次刷新失败"—— 于是面板与台账上都看不出到底是 cookie 死了、票被顶掉还是代码错,
    // 机主只能盲猜(2026-10-23 实测就是这么绕了一圈)。
    const reason = e instanceof Error ? e.message : String(e)
    const note = `token 刷新失败(第 ${failures}/${REFRESH_FAILURE_LIMIT} 次):${reason}${
      shouldRemove ? ' ⇒ 连续超限,已自动摘除' : ''
    }`
    await db
      .update(aiRelayAccountPool)
      .set({
        refreshFailureCount: failures,
        tempUnschedulable: shouldRemove ? true : row.tempUnschedulable,
        healthStatus: shouldRemove ? 'down' : row.healthStatus,
        lastErrorMessage: note.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(aiRelayAccountPool.id, row.id))
    return false
  }
}

/**
 * 巡检入口(多实例安全):先抢分布式锁(SET NX PX),锁被其他实例持有 ⇒ 本轮跳过。
 * 锁在 finally 释放;进程崩溃未释放时靠租约 TTL(10 分钟)自愈。
 */
export async function sweepAccountPool(): Promise<AccountPoolSweepResult> {
  const lock = await tryAcquireSharedLock(SWEEP_LOCK_NAME, SWEEP_LOCK_TTL_MS)
  if (!lock) {
    logger.info('[relay-account-pool] 巡检分布式锁被其他实例持有,本轮跳过')
    return {
      refreshed: 0,
      refreshFailed: 0,
      refreshSkipped: 0,
      healthChecked: 0,
      healthRecovered: 0,
      skipped: true,
    }
  }
  try {
    return await runSweepOnce()
  } finally {
    await lock.release().catch(() => {})
  }
}

async function runSweepOnce(): Promise<AccountPoolSweepResult> {
  const out: AccountPoolSweepResult = {
    refreshed: 0,
    refreshFailed: 0,
    refreshSkipped: 0,
    healthChecked: 0,
    healthRecovered: 0,
    skipped: false,
  }
  const now = new Date()
  const deadline = new Date(now.getTime() + REFRESH_AHEAD_MS)

  // ── 0. 台账保留期清理(24h 节流;每 5 分钟一轮 sweep 但不会每轮 delete) ──
  await maybePurgeUsageLedger()

  // ── 1. 临期刷新(并发上限 SWEEP_CONCURRENCY) ──
  const expiring = await dbRead
    .select()
    .from(aiRelayAccountPool)
    .where(expiringRefreshWhere(deadline))
    .limit(BATCH_LIMIT)
  await runWithConcurrency(expiring, SWEEP_CONCURRENCY, async (row) => {
    const adapter = getRelayAdapter(row.providerCode)
    if (!adapter?.refreshToken) {
      out.refreshSkipped++
      return
    }
    if (await refreshOne(row)) out.refreshed++
    else out.refreshFailed++
  })

  // ── 2. unknown 健康定级(并发上限 SWEEP_CONCURRENCY;未判定结果按退避复检) ──
  const recheckBefore = new Date(Date.now() - UNKNOWN_RECHECK_MS)
  const unknowns = await dbRead
    .select()
    .from(aiRelayAccountPool)
    .where(
      and(
        eq(aiRelayAccountPool.isEnabled, true),
        eq(aiRelayAccountPool.healthStatus, 'unknown'),
        // 未摘除的,或摘除但已重新启用的
        eq(aiRelayAccountPool.tempUnschedulable, false),
        // 新导入(healthCheckedAt 为空)立即受检;上一轮判「未判定」的按退避等待
        or(
          isNull(aiRelayAccountPool.healthCheckedAt),
          lt(aiRelayAccountPool.healthCheckedAt, recheckBefore),
        ),
      ),
    )
    .limit(BATCH_LIMIT)
  await runWithConcurrency(unknowns, SWEEP_CONCURRENCY, async (row) => {
    const adapter = getRelayAdapter(row.providerCode)
    if (!adapter) return
    try {
      const outcome = await adapter.checkHealth(ctxOf(row, decryptAccountCredentials(row)), {
        proxyUrl: row.proxyUrl,
      })
      out.healthChecked++
      await db
        .update(aiRelayAccountPool)
        .set({
          // 未判定保留 unknown,不写 down(§0.3:取不到 ≠ 失效)
          healthStatus: healthStatusOf(outcome),
          healthCheckedAt: new Date(),
          lastErrorMessage: outcome.ok ? null : (outcome.error ?? '健康检查失败').slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(aiRelayAccountPool.id, row.id))
    } catch {
      /* 单账号检查异常不中断整轮 */
    }
  })

  // ── 3. down 账号恢复尝试(可按 cookie 或 refreshToken 再取凭据,且未超失败阈值) ──
  const downs = await dbRead.select().from(aiRelayAccountPool).where(downRecoveryWhere()).limit(10)
  for (const row of downs) {
    if (row.refreshFailureCount >= REFRESH_FAILURE_LIMIT) continue
    const adapter = getRelayAdapter(row.providerCode)
    if (!adapter?.refreshToken) continue
    if (await refreshOne(row)) out.healthRecovered++
  }

  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
