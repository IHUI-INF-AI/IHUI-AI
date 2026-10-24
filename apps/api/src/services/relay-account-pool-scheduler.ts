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
import { and, eq, isNotNull, isNull, lt, lte, ne, or, inArray, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { aiRelayAccountPool, type AiRelayAccountPool } from '@ihui/database'
import { decryptAccountCredentials, type AccountCredentials } from './relay-account-pool-service.js'
import { tryAcquireSharedLock } from './relay-account-shared-state.js'
import { encryptField } from '../utils/crypto.js'
import { logger } from '../utils/logger.js'
import { getRelayAdapter, type AdapterAccountContext } from './relay-upstream-adapters.js'
import { purgeAccountUsage } from './relay-account-usage.js'
import { reconcileCheckinSync } from './relay-account-pool-reconcile.js'
import { retryPendingCheckinSyncs } from './relay-account-pool-checkin-sync.js'

/** 临期刷新窗口:距过期 15 分钟内触发(上游 token 寿命 ~14 天,窗口足够宽) */
const REFRESH_AHEAD_MS = 15 * 60 * 1000
/** 连续刷新失败摘除阈值 */
const REFRESH_FAILURE_LIMIT = 3

/**
 * 平台续期归属(2026-10-24 立):'server' = 池负责续期;'client-first' = 客户端负责续期,
 * 池只在 access token **已过期**后兜底刷新。
 *
 * 立因:Trae 的 ExchangeToken 每次都轮换 refreshToken,而本机 Trae 客户端与号池共用
 * 同一枚 rt —— 池先刷,客户端手里的票当场作废(2026-10-24 实测:池 02:20 续期,
 * 02:26 客户端 `[updateUserInfo] {}` 登录态被清)。客户端在跑时它会自己续期,另有
 * scripts/sync-trae-client-session.mjs 每 10 分钟把客户端新票回灌进池;池内票一旦真的
 * 过期,说明客户端已不在续期,此时兜底刷新不会再顶掉谁。
 * RELAY_TRAE_CLIENT_FIRST_REFRESH=0/false/off 可整体退回 server 策略。
 */
export type RelayRenewalPolicy = 'server' | 'client-first'

export function renewalPolicyOf(
  providerCode: string,
  env: NodeJS.ProcessEnv = process.env,
): RelayRenewalPolicy {
  if (providerCode !== 'trae') return 'server'
  const flag = (env.RELAY_TRAE_CLIENT_FIRST_REFRESH ?? '').trim().toLowerCase()
  if (['0', 'false', 'off'].includes(flag)) return 'server'
  return 'client-first'
}

/** client-first 且票尚未过期 ⇒ 本轮不许刷(刷了就是和客户端抢轮换);票已过期 ⇒ 兜底放行。 */
export function shouldDeferRefresh(
  row: { providerCode: string; tokenExpiresAt: Date | null },
  now: Date,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (renewalPolicyOf(row.providerCode, env) !== 'client-first') return false
  return row.tokenExpiresAt !== null && row.tokenExpiresAt.getTime() > now.getTime()
}
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
  // O64 checkinReconcile/checkinRetry 两键不得进产出面(2026-10-24 定案 099b843,由
  // apps/api/tests/relay-account-pool-sweep-result.test.ts 三例钉住):①两条分支必须同键集,
  // 跳过分支无对账可发;②产出面只允许标量,对象键消费面不解码。要加回来的合法顺序 =
  // 消费面(worker)先写真读取 → 产出面同批加键 → 白名单同批登记,三者缺一即红。
  // 调用接线保留(价值在真跑),明细走调度日志。
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

/**
 * 「这枚号现在能不能被调度选中」的唯一判据(2026-10-23 立)。
 *
 * 立因:巡检把上游明确拒收判成 `healthStatus='down'` 并收敛到期列,而选号 WHERE 只看了
 * `isEnabled ∧ ¬tempUnschedulable` ⇒ 巡检判死的号照样被选中,一次拒收要等转发再失败几次
 * 才靠会话死/额度冷却摘除。两个面各写一份「可用」的口径,必然漂移(§0.6)。
 *
 * 所以这条条件是调度侧(relay-account-forwarder.selectAccountCandidates)与巡检侧
 * (`healthStatusOf` 的产物)之间唯一的接缝:巡检写 down ⇒ 调度当场不再选它。
 * `unknown` 仍可选(新导入/未判定要给一次实测机会),`healthy`/`degraded` 照旧可选。
 */
export function accountSchedulableCondition() {
  return and(
    eq(aiRelayAccountPool.isEnabled, true),
    eq(aiRelayAccountPool.tempUnschedulable, false),
    ne(aiRelayAccountPool.healthStatus, 'down'),
  )
}

/**
 * 上游**当场明确拒收**凭据 ⇒ 同一次写里:到期列收敛到当下 + 健康降级 down。
 *
 * 单点实现,供巡检之外的「上游主动探测」档(管理面按需查余额等)复用 ——
 * 到期列是弱证据,任何一处拿到"上游明确拒收"都必须立刻把它收敛掉,
 * 否则换票写进去的新未来时刻会继续冒充「票仍可用」。5xx/网络/形状不符
 * 不是明确拒收,不得调用本函数(那些走 indeterminate,保留原状)。
 */
export async function markAccountAuthRejected(
  accountId: string,
  reason: string | null,
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(aiRelayAccountPool)
    .set({
      tokenExpiresAt: now,
      healthStatus: 'down',
      healthCheckedAt: now,
      lastErrorMessage: (reason ?? '上游拒收凭据').slice(0, 500),
      updatedAt: now,
    })
    .where(eq(aiRelayAccountPool.id, accountId))
    .catch(() => {})
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
        // 换票成功 = 凭据版本原子前进(号池↔签到同步只按版本差补推)
        credVersion: sql`${aiRelayAccountPool.credVersion} + 1`,
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
    // 上游**明确拒收**凭据时才收敛到期列(结构化判定,不匹配错误文案);
    // 网络/5xx 等未判定失败绝不改写到期时刻。与失败计数、健康降级同一次写。
    const authRejected = adapter.isAuthError?.(e) === true
    await db
      .update(aiRelayAccountPool)
      .set({
        refreshFailureCount: failures,
        tempUnschedulable: shouldRemove ? true : row.tempUnschedulable,
        healthStatus: shouldRemove ? 'down' : row.healthStatus,
        lastErrorMessage: note.slice(0, 500),
        updatedAt: new Date(),
        ...(authRejected ? { tokenExpiresAt: new Date() } : {}),
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
    if (shouldDeferRefresh(row, now)) {
      // client-first:票还没过期,刷新 = 和本机客户端抢轮换(会把客户端顶下线)。
      // 客户端新票由 scripts/sync-trae-client-session.mjs 每 10 分钟回灌;
      // 票一旦真过期(客户端已不在续期)这里不再拦,池兜底刷。
      out.refreshSkipped++
      return
    }
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
    if (!adapter) {
      // 静默 return 会让"平台适配器没注册上"永远看不见(2026-10-24 实测:
      // 号池三轮 sweep 都跑完、该号却一直停在 unknown,无任何日志可查)
      logger.warn('[relay-account-pool] 健康检查跳过:平台适配器未注册', {
        providerCode: row.providerCode,
        accountId: row.id,
      })
      return
    }
    try {
      const outcome = await adapter.checkHealth(ctxOf(row, decryptAccountCredentials(row)), {
        proxyUrl: row.proxyUrl,
      })
      out.healthChecked++
      const now = new Date()
      await db
        .update(aiRelayAccountPool)
        .set({
          // 未判定保留 unknown,不写 down(§0.3:取不到 ≠ 失效)
          healthStatus: healthStatusOf(outcome),
          healthCheckedAt: now,
          lastErrorMessage: outcome.ok ? null : (outcome.error ?? '健康检查失败').slice(0, 500),
          updatedAt: now,
          // 上游明确拒收 → 到期列收敛到当下(与健康降级同一次写)。
          // 未来到期时刻从此不能再被当成「票仍可用」的证据;5xx 未判定不碰该列。
          ...(outcome.ok === false && outcome.authFailed === true ? { tokenExpiresAt: now } : {}),
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
    if (shouldDeferRefresh(row, now)) continue // 同上:票未过期不抢客户端的轮换权
    const adapter = getRelayAdapter(row.providerCode)
    if (!adapter?.refreshToken) continue
    if (await refreshOne(row)) out.healthRecovered++
  }

  // ── 4. O64 号池↔签到对账收敛(断链自愈;失败不中断 sweep,下轮继续) ──
  // 结果走日志留痕,不进返回键集(见接口处注记:两条分支同键 + 全标量契约)。
  try {
    const reconciled = await reconcileCheckinSync()
    logger.info('[relay-account-pool] O64 对账收敛完成', reconciled as unknown as Record<string, unknown>)
  } catch (e) {
    logger.warn('[relay-account-pool] 对账收敛器异常(不影响巡检)', {
      error: e instanceof Error ? e.message.slice(0, 200) : '未知错误',
    })
  }

  // ── 4.5 O64 断链待推重推:retryPendingCheckinSyncs 直接读 pending 标记重推;
  //    reconcile(步骤4)仅按"缺/版本落后"补推、读不到 extraMetadata.checkinSync.pending,
  //    覆盖不到响应丢失但已同步/state 待推/无引擎平台等 sticky-pending。两者同在分布式锁内、幂等、互不冲突。
  try {
    const retried = await retryPendingCheckinSyncs()
    logger.info('[relay-account-pool] O64 断链待推重推完成', retried as unknown as Record<string, unknown>)
  } catch (e) {
    logger.warn('[relay-account-pool] 待推重推异常(不影响巡检)', {
      error: e instanceof Error ? e.message.slice(0, 200) : '未知错误',
    })
  }

  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
