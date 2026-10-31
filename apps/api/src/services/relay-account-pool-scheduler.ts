// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号池调度服务(2026-10-22 立):token 临期刷新 + 健康巡检 + 熔断自愈 + 空闲保活。
 *
 * 由 relay-account-pool-worker(BullMQ,每 5 分钟)驱动,单轮四件事:
 * 0. keepaliveIdle:距上次使用超过窗口(默认 7 天)的号主动续一次票 —— 上游会清理
 *    闲置的 refresh 会话(实测 invalid_grant/12153),被动等临期等于等着整池猝死。
 *    对标 workbuddy-switch 桌面端的「每日保活」,差别在:① 这里是服务端集中做,
 *    不依赖任何人开着 GUI;② client-first 平台让位本机客户端(见 shouldDeferRefresh),
 *    不会把本机手里的票顶废。env RELAY_ACCOUNT_KEEPALIVE_DAYS 调窗口,0/off/false 整档关。
 * 0b. 永久保活档(2026-10-31 立):登记 `extraMetadata.keepAliveForever` 的号窗口默认 24h,
 *    且**只看客户端心跳不看 client-first**(心跳停 ⇒ 池接管续期);被失败计数摘除后由
 *    `reviveKeepAliveForeverAccounts` 退避 6h 自动解摘 —— 对「掉线就再也登不回来」的号,
 *    摘除不能是终点。详见 KEEPALIVE_FOREVER_KEY 一组常量处的立因注。
 * 1. refreshExpiring:access token 距过期 < 15 分钟且有 refreshToken → 调适配器刷新回写
 *    (对标 trae-cn-proxy-rs 的 15 分钟临期检测 + ExchangeToken 续期)
 * 2. sweepUnknown:healthStatus=unknown 的账号 → 适配器 checkHealth 定级 healthy/down
 * 3. recoverDown:down 且有 refreshToken 且刷新失败次数未超限 → 再试一次刷新,成功则回 unknown
 *    等下轮复检(对标 workbuddy-manager 的验活摘除 + 恢复)
 *
 * 刷新连续失败 REFRESH_FAILURE_LIMIT 次 → tempUnschedulable=true(自动摘除,admin 可见原因)。
 * 与 relay-channel-router 的进程级熔断互补:这里是「账号凭证生命周期」,那里是「渠道调用质量」。
 */
import { and, eq, gt, isNotNull, isNull, lt, lte, or, inArray, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { aiRelayAccountPool, type AiRelayAccountPool } from '@ihui/database'
import { decryptAccountCredentials, type AccountCredentials } from './relay-account-pool-service.js'
import { tryAcquireSharedLock } from './relay-account-shared-state.js'
import { encryptField } from '../utils/crypto.js'
import { logger } from '../utils/logger.js'
import { getRelayAdapter, type AdapterAccountContext } from './relay-upstream-adapters.js'
import { purgeAccountUsage } from './relay-account-usage.js'
import { pickProxyForAccount } from './relay-proxy-pool.js'
import { reconcileCheckinSync } from './relay-account-pool-reconcile.js'
import { retryPendingCheckinSyncs } from './relay-account-pool-checkin-sync.js'
import { ACCOUNT_SCHEDULABLE_HEALTH_STATES } from './relay-pool-stats-service.js'

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
 * qoder 同一型(2026-10-28):deviceToken/refresh 轮换 refresh_token,回灌腿 =
 * worker 的 qoder-session-sync;退回开关 RELAY_QODER_CLIENT_FIRST_REFRESH。
 */
export type RelayRenewalPolicy = 'server' | 'client-first'

/**
 * 客户端在续期的平台及其退回 server 的开关名(单一真相源)。
 *
 * qoder(2026-10-28 纳入):refresh 响应**轮换 refresh_token**(见 qoder-adapter 的
 * 真机实测形状),池主动续期会当场把本机客户端的票顶废 —— 与 trae 同一型。
 * 回灌腿 = worker 的 `qoder-session-sync`(每 10 分钟读本机 auth.v1.dat 写回池)。
 */
const CLIENT_FIRST_FLAGS: Record<string, string> = {
  trae: 'RELAY_TRAE_CLIENT_FIRST_REFRESH',
  qoder: 'RELAY_QODER_CLIENT_FIRST_REFRESH',
}

export function renewalPolicyOf(
  providerCode: string,
  env: NodeJS.ProcessEnv = process.env,
): RelayRenewalPolicy {
  const flagName = CLIENT_FIRST_FLAGS[providerCode]
  if (!flagName) return 'server'
  const flag = (env[flagName] ?? '').trim().toLowerCase()
  if (['0', 'false', 'off'].includes(flag)) return 'server'
  return 'client-first'
}

/**
 * 永久保活档(2026-10-31 立)—— 给「掉线就再也登不回来」的号一条不会死的续期路。
 *
 * 立因:机主的本机 Trae 号已无法用验证码重登,唯一出路是号池 + 一键切号。而两档既有策略
 * 都会把它杀死:
 *  - client-first 在票未过期时**永不刷**(见 shouldDeferRefresh 原语义),但本档头注自己
 *    写着「上游会清理闲置的 refresh 会话,被动等临期等于等着整池猝死」—— 客户端多日不开
 *    就是这种「安静地等到 rt 被上游回收」;
 *  - 连续 3 次刷新失败 ⇒ `tempUnschedulable=true`,而四档候选 where 全部要求未摘除
 *    ⇒ 摘除 = 从此无人再碰 = 永久丢号(对能验证码重登的号只是降级,对这枚号是终结)。
 *
 * 登记面 = `extraMetadata.keepAliveForever = true`(jsonb,零迁移;键名单源 = 本文件)。
 */

/** 永久保活登记键(判据/管理端点/回灌腿共用这一个名字,§0.6) */
export const KEEPALIVE_FOREVER_KEY = 'keepAliveForever'
/**
 * 客户端活跃心跳键:回灌腿(scripts/sync-trae-client-session.mjs → relay-trae-session-sync.ts)
 * 每轮在**探测到客户端进程在跑**时写入。scheduler 不探进程(那是机器侧事实,不该住服务层),
 * 只读这条心跳 —— 心跳在 = 客户端正在自己续期 = 池继续让位;心跳停 = 池接管。
 */
export const CLIENT_ACTIVE_AT_KEY = 'clientActiveAt'
/**
 * 心跳有效期(毫秒):回灌腿本身每 10 分钟一轮,给 3 倍余量。
 * 失效方向 = 心跳过期 ⇒ 池接管续期(宁可多刷一次,不可让号静默死)。
 */
export const CLIENT_ACTIVE_TTL_MS = 30 * 60 * 1000
/** 永久保活号的空闲窗口(小时):远窄于普通号的 7 天,保证 rt 会话在 upstream 眼里始终不闲置 */
export const KEEPALIVE_FOREVER_DEFAULT_HOURS = 24
/** 被自动摘除后的解摘退避(小时):既不让号永久死亡,也不让坏票每 5 分钟死撞上游鉴权点(封号前兆) */
export const KEEPALIVE_FOREVER_REVIVE_BACKOFF_HOURS = 6
/**
 * 永不命中的空闲边界(epoch):普通保活档被显式关闭时用它占住 `or()` 的左半边,
 * 让这一轮只剩永久保活分支有效 —— 而不是把整档 if 掉、连带把机主点名要保的号也关掉。
 */
const NEVER_IDLE_CUTOFF = new Date(0)

/** 「这枚号登记了永久保活」的唯一 JS 侧判据。取不到 metadata 一律 false(不猜)。 */
export function keepAliveForeverOf(row: { extraMetadata?: unknown }): boolean {
  const meta = row.extraMetadata
  if (!meta || typeof meta !== 'object') return false
  return (meta as Record<string, unknown>)[KEEPALIVE_FOREVER_KEY] === true
}

/**
 * 客户端心跳时刻;缺失/非字符串/解不出 ⇒ null(= 视为静默,由池接管)。
 * 只认字符串:写入口(touchClientHeartbeat)恒落 ISO,数字/对象这类形态就是畸形输入,
 * 按「没有心跳」处理才与写读两侧同口径(接管方向 = 宁可多刷一次,不冒顶号风险的反面)。
 */
export function clientActiveAtOf(row: { extraMetadata?: unknown }): Date | null {
  const meta = row.extraMetadata
  if (!meta || typeof meta !== 'object') return null
  const raw = (meta as Record<string, unknown>)[CLIENT_ACTIVE_AT_KEY]
  if (typeof raw !== 'string') return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

/** SQL 侧的同一把判据(jsonb 文本投影;与 keepAliveForeverOf 同键名,不各写一份)。 */
export function keepAliveForeverCondition() {
  return sql`(coalesce(${aiRelayAccountPool.extraMetadata}, '{}'::jsonb) ->> ${KEEPALIVE_FOREVER_KEY}) = 'true'`
}

/**
 * 永久保活号的空闲窗口(小时):`RELAY_ACCOUNT_KEEPALIVE_FOREVER_HOURS`
 * 未设/非法 ⇒ 默认 24;`0`/`off`/`false` ⇒ null(该号退回普通 7 天窗口,是显式关闭而非静默)。
 */
export function keepaliveForeverIdleHours(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = (env.RELAY_ACCOUNT_KEEPALIVE_FOREVER_HOURS ?? '').trim().toLowerCase()
  if (raw === '') return KEEPALIVE_FOREVER_DEFAULT_HOURS
  if (['0', 'off', 'false', 'disabled', 'disable'].includes(raw)) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : KEEPALIVE_FOREVER_DEFAULT_HOURS
}

/** client-first 且票尚未过期 ⇒ 本轮不许刷(刷了就是和客户端抢轮换);票已过期 ⇒ 兜底放行。 */
export function shouldDeferRefresh(
  row: { providerCode: string; tokenExpiresAt: Date | null; extraMetadata?: unknown },
  now: Date,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (keepAliveForeverOf(row)) {
    // 永久保活号不看 client-first 开关,只看「客户端此刻是不是正在续期」。
    // 顶掉正在干活的客户端 = 机主要重登 = 而他登不回来,所以只在心跳停了以后才接管。
    const activeAt = clientActiveAtOf(row)
    return activeAt !== null && now.getTime() - activeAt.getTime() < CLIENT_ACTIVE_TTL_MS
  }
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

// ── 空闲保活(2026-10-26 立,对标 workbuddy-switch 桌面端「每日保活」)──────────────
/** 默认窗口:距上次使用 ≥ 7 天即主动续票(上游清理闲置 refresh 会话前的安全边际) */
export const KEEPALIVE_DEFAULT_DAYS = 7
/** 单轮空闲保活上限(临期档之后执行,共用分布式锁;防刷新风暴打爆上游) */
export const KEEPALIVE_MAX_PER_SWEEP = 20

/**
 * 空闲保活窗口(天):`RELAY_ACCOUNT_KEEPALIVE_DAYS`
 * - 未设 → 默认 7 天;`0`/`off`/`false`/`disabled` → 整档关闭(返回 null);
 * - 非法值回落默认(失效方向是「照默认保活」,不是「静默关掉保活」)。
 */
export function keepaliveIdleDays(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = (env.RELAY_ACCOUNT_KEEPALIVE_DAYS ?? '').trim().toLowerCase()
  if (raw === '') return KEEPALIVE_DEFAULT_DAYS
  if (['0', 'off', 'false', 'disabled', 'disable'].includes(raw)) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : KEEPALIVE_DEFAULT_DAYS
}

/**
 * 空闲时钟(单源):上次被转发使用 与 上次成功刷新 取较新者;两者都没发生过则取入库时刻。
 *
 * 为什么必须并入 lastRefreshAt:若只看 lastUsedAt,一次保活刷新不会让账号退出空闲集
 * ⇒ 每 5 分钟一轮的 sweep 会把同一批闲置号反复续票,自己造出刷新风暴。刷新会写
 * lastRefreshAt → 时钟被拨回,天然获得一个完整窗口的静默期。
 */
export function accountIdleClock() {
  return sql`greatest(coalesce(${aiRelayAccountPool.lastUsedAt}, ${aiRelayAccountPool.createdAt}), coalesce(${aiRelayAccountPool.lastRefreshAt}, ${aiRelayAccountPool.createdAt}))`
}

/**
 * 空闲保活的 where(导出供镜像测试锁形状):启用 + 未摘除 + 未判死 + 能自救续票,
 * 且空闲时钟早于窗口。不要求 tokenExpiresAt —— 临期档管「将过期」,这一档专管「闲置」;
 * 两档都汇进 refreshOne 的同一把失败计数,不各写一份摘除口径。
 *
 * 为什么窗口边界要显式绑 ISO 串 + `::timestamptz`(2026-10-28 生产实测):
 * `lt(column, Date)` 由列类型的 mapToDriverValue 把 Date 转成驱动能吃的形式,可这里左边是
 * 裸 `sql` 片段(`accountIdleClock()`),没有列可推断 ⇒ drizzle 把 Date 原样丢给 postgres.js,
 * 后者只收款 string/Buffer/ArrayBuffer,直接抛 `ERR_INVALID_ARG_TYPE: Received an instance
 * of Date`。症状不是「查错行」而是**整个 sweep 在步骤 1.5 抛死**:job 每 5 分钟失败一次,
 * 后面的 unknown 定级 / down 恢复 / 签到对账全部不再执行 —— 保活档自己把巡检打死。
 * 绑定形态改成字符串 + 显式转换后,值仍是同一个时刻,驱动也不再挑类型。
 *
 * 第二把 cutoff(2026-10-31 永久保活档):登记了 `keepAliveForever` 的号用远窄于普通号的
 * 空闲窗口(默认 24h)续票 —— 它不能等 7 天,因为机主已经没有「掉线后重新验证码登录」这条
 * 退路。给 `foreverCutoff` 为空/undefined 时形状与历史完全一致(普通号窗口不变、也不看 jsonb)。
 */
export function keepaliveIdleWhere(cutoff: Date, foreverCutoff?: Date) {
  const guards = [
    eq(aiRelayAccountPool.isEnabled, true),
    eq(aiRelayAccountPool.tempUnschedulable, false),
    inArray(aiRelayAccountPool.healthStatus, [...ACCOUNT_SCHEDULABLE_HEALTH_STATES]),
    recredentialableCondition(),
  ]
  const standardIdle = lt(accountIdleClock(), sql`${cutoff.toISOString()}::timestamptz`)
  if (!foreverCutoff) return and(...guards, standardIdle)
  return and(
    ...guards,
    or(
      standardIdle,
      and(
        keepAliveForeverCondition(),
        lt(accountIdleClock(), sql`${foreverCutoff.toISOString()}::timestamptz`),
      ),
    ),
  )
}

/**
 * 永久保活号的解摘候选 where(导出供镜像测试锁形状)。
 *
 * 为什么需要这一档:`refreshOne` 连续失败 3 次会置 `tempUnschedulable=true`,而四档候选
 * 全部要求未摘除 ⇒ 摘除对普通号是「停止打上游、等 admin 看一眼」,对「登不回来」的号是
 * **永久死亡**。这里把摘除改回它名字本来的含义(临时):退避窗之后自动解摘、再给一次机会。
 * 摘除本身保留 —— 去掉它就变成坏票每 5 分钟死撞鉴权点,那正是本仓反复点名的封号前兆型。
 */
export function keepAliveReviveWhere(before: Date) {
  return and(
    keepAliveForeverCondition(),
    eq(aiRelayAccountPool.tempUnschedulable, true),
    lt(aiRelayAccountPool.updatedAt, sql`${before.toISOString()}::timestamptz`),
  )
}

/**
 * 解摘「永久保活却被自动摘除」的号(2026-10-31 立)。返回解摘枚数;0 = 本轮无事发生。
 *
 * 只做数据面动作(解摘 + 失败计数归零 + 留痕;健康态刻意不动,见下方注),
 * 不发信 —— 到人通知由承载腿(scripts/relay-account-keepalive.mjs)按汇总结论走
 * 唯一出口 notify-deploy-failure.ts(§5e / 守门 81:服务层不自拼 SMTP)。
 */
export async function reviveKeepAliveForeverAccounts(
  now: Date = new Date(),
  backoffHours: number = KEEPALIVE_FOREVER_REVIVE_BACKOFF_HOURS,
): Promise<
  Array<{ id: string; uid: string; providerCode: string; lastErrorMessage: string | null }>
> {
  const before = new Date(now.getTime() - backoffHours * 60 * 60 * 1000)
  const stale = await dbRead
    .select({
      id: aiRelayAccountPool.id,
      uid: aiRelayAccountPool.uid,
      providerCode: aiRelayAccountPool.providerCode,
      lastErrorMessage: aiRelayAccountPool.lastErrorMessage,
    })
    .from(aiRelayAccountPool)
    .where(keepAliveReviveWhere(before))
    .limit(KEEPALIVE_MAX_PER_SWEEP)
  for (const row of stale) {
    await db
      .update(aiRelayAccountPool)
      .set({
        tempUnschedulable: false,
        refreshFailureCount: 0,
        // 刻意**不写** healthStatus:解摘的语义是「解除调度封锁」,不是「判它健康」。
        // 保留 down 反而更正确 —— downRecoveryWhere 不看健康白名单,会立刻按再凭证通道重试,
        // 刷成功时由 refreshOne 把 down 收回 unknown(既有口径),失败则继续累计并再摘。
        // 2026-11-01 实测:凭空写 unknown 会把这条既有不变量洗掉,还与既有测试
        // 「按 healthStatus 键存在性识别健康写入」的选取器撞形,把定级读数顶成解摘留痕。
        lastErrorMessage: `永久保活自动解摘(摘除满 ${backoffHours}h,重新纳入续期):前因 ${(row.lastErrorMessage ?? '未知').slice(0, 200)}`,
        updatedAt: now,
      })
      .where(eq(aiRelayAccountPool.id, row.id))
      .catch(() => {})
  }
  return stale
}

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
  /**
   * 空闲保活命中的候选账号数(2026-10-26 立,对标 workbuddy-switch 每日保活)。
   * 成功/失败另计进 refreshed/refreshFailed;本键只答「这一轮有多少号被闲置窗口捞出续票」。
   */
  keepalive: number
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
export function accountHealthyCondition() {
  return and(
    eq(aiRelayAccountPool.isEnabled, true),
    eq(aiRelayAccountPool.tempUnschedulable, false),
    // 健康态白名单单源 = stats 层的 ACCOUNT_SCHEDULABLE_HEALTH_STATES(JS 侧判据同源),
    // 不再本处另写字面量 'down' —— 两处各写一份就必然有一天不一致。
    inArray(aiRelayAccountPool.healthStatus, [...ACCOUNT_SCHEDULABLE_HEALTH_STATES]),
  )
}

/**
 * `accountHealthyCondition` 是巡检侧的候选面:**不看票面** —— 票过期恰恰是要刷新它的
 * 理由,带上 tokenExpiresAt 就永远修不好那些号。
 */

/** 「这枚号现在能不能被调度选中」的唯一判据(含票面维);选号与读数共用这一把。 */
export function accountSchedulableCondition(now: Date = new Date()) {
  return and(
    accountHealthyCondition(),
    // 票已过期 ⇒ 现在调不通,不参与选号,也不计入大屏分子。
    // 无票面(cookie 型/不限期)放行:那类号的失效只能靠上游当场拒收判 down。
    or(isNull(aiRelayAccountPool.tokenExpiresAt), gt(aiRelayAccountPool.tokenExpiresAt, now)),
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

/**
 * 步骤 1「临期刷新」的 where(导出供镜像测试锁形状,查询与断言读同一个对象)
 *
 * 2026-10-29 补一格:候选集过去只看 isEnabled ∧ 能再取凭据 ∧ 将到期,而 authRejected
 * 那条路会把 `tokenExpiresAt` 收敛成"当下"(`markAccountAuthRejected`)⇒ 一枚已被巡检判死、
 * 已被 tempUnschedulable 摘除的号**永远**满足将到期条件,每 5 分钟再打一次上游换票点。
 * 现读凭据:池内 trae/18643389808 的失败计数已涨到 327(阈值 3)。死号天天打鉴权点正是
 * 本仓反复点名的封号前兆型,且"能不能被调度选中"早已有一把单源谓词(见
 * `accountSchedulableCondition` 头注),这里接上它而不是再抄一份条件。
 */
export function expiringRefreshWhere(deadline: Date) {
  return and(
    // 候选面用「健康可用」而不是「可调度」:票过期正是要刷它的理由(2026-10-31 拆层)。
    accountHealthyCondition(),
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

/** 本轮巡检出口选取台账:proxied=走代理(账号级或池),direct=直连(无可用代理) */
export interface EgressProxyTally {
  proxied: number
  direct: number
}

/**
 * 与转发链路同一口径取出口:账号级 proxyUrl 优先,否则池内按最久未用轮换。
 * 取不到代理时 pickProxyForAccount 返回 null,调用方回退直连。
 */
async function resolveEgressProxy(
  row: AiRelayAccountPool,
  tally?: EgressProxyTally,
): Promise<string | null> {
  const proxyUrl = await pickProxyForAccount({ id: row.id, proxyUrl: row.proxyUrl })
  if (tally) {
    if (proxyUrl) tally.proxied++
    else tally.direct++
  }
  return proxyUrl
}

/**
 * 刷新单账号;成功回写凭证,失败累计摘除。返回 true = 刷新成功。
 * 导出给管理面「按需查余额」共用同一把出口(回写/解摘/失败累计的口径只有一份)。
 * tally 只用于本轮巡检的观测(代理/直连计数),不影响产出。
 */
export async function refreshOne(
  row: AiRelayAccountPool,
  tally?: EgressProxyTally,
): Promise<boolean> {
  const adapter = getRelayAdapter(row.providerCode)
  if (!adapter?.refreshToken) return false
  const credentials = decryptAccountCredentials(row)
  try {
    const proxyUrl = await resolveEgressProxy(row, tally)
    const result = await adapter.refreshToken(ctxOf(row, credentials), { proxyUrl })
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
      keepalive: 0,
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
    keepalive: 0,
    healthChecked: 0,
    healthRecovered: 0,
    skipped: false,
  }
  const now = new Date()
  const deadline = new Date(now.getTime() + REFRESH_AHEAD_MS)
  // 出口选取台账(仅日志观测;不新增 sweep 产出键,保持全标量契约)
  const egress: EgressProxyTally = { proxied: 0, direct: 0 }

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
    if (await refreshOne(row, egress)) out.refreshed++
    else out.refreshFailed++
  })

  // ── 1.5 空闲保活(2026-10-26 立,对标 workbuddy-switch「每日保活」)──
  // 上游会清理闲置的 refresh 会话(撞过 invalid_grant 才发现),临期档只救「快过期」的,
  // 救不了「长期没人用」的。这里把「闲置」单独成档:超窗就先续一把,续票失败同走
  // refreshOne 的累计与摘除,不给第二份口径。分布式锁与临期档同轮,不会多实例抢刷。
  const keepaliveDays = keepaliveIdleDays()
  const foreverHours = keepaliveForeverIdleHours()
  // 永久保活号若已被上一轮的失败计数摘除,它此刻对四档候选全部不可见 = 静默等死。
  // 解摘排在保活轮之前:本轮解摘的号本轮就能被续,不必再等一个退避窗。
  const revived = await reviveKeepAliveForeverAccounts(now).catch((e: unknown) => {
    logger.warn('[relay-account-pool] 永久保活解摘异常(不影响巡检)', {
      error: e instanceof Error ? e.message.slice(0, 200) : '未知错误',
    })
    return []
  })
  if (revived.length > 0) {
    logger.warn('[relay-account-pool] 永久保活号自动解摘', {
      count: revived.length,
      accounts: revived.map((r) => `${r.providerCode}/${r.uid}`).join(','),
    })
  }
  if (keepaliveDays !== null || foreverHours !== null) {
    // 普通档被显式关闭(0/off)时永久保活档仍要跑:给普通窗口一枚永不命中的边界,
    // 让 or() 只剩 forever 分支有效 —— 「关掉普通号保活」不等于「连机主点名要保的也一起死」。
    const idleCutoff =
      keepaliveDays === null
        ? NEVER_IDLE_CUTOFF
        : new Date(now.getTime() - keepaliveDays * 24 * 60 * 60 * 1000)
    const foreverCutoff =
      foreverHours === null ? undefined : new Date(now.getTime() - foreverHours * 60 * 60 * 1000)
    const idles = await dbRead
      .select()
      .from(aiRelayAccountPool)
      .where(keepaliveIdleWhere(idleCutoff, foreverCutoff))
      .limit(KEEPALIVE_MAX_PER_SWEEP)
    out.keepalive = idles.length
    if (idles.length > 0) {
      logger.info('[relay-account-pool] 空闲保活轮开始', {
        candidates: idles.length,
        idleDays: keepaliveDays ?? 'off',
        foreverHours: foreverHours ?? 'off',
      })
    }
    await runWithConcurrency(idles, SWEEP_CONCURRENCY, async (row) => {
      if (shouldDeferRefresh(row, now)) {
        out.refreshSkipped++
        return
      }
      const adapter = getRelayAdapter(row.providerCode)
      if (!adapter?.refreshToken) {
        out.refreshSkipped++
        return
      }
      if (await refreshOne(row, egress)) out.refreshed++
      else out.refreshFailed++
    })
  }

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
      const proxyUrl = await resolveEgressProxy(row, egress)
      const outcome = await adapter.checkHealth(ctxOf(row, decryptAccountCredentials(row)), {
        proxyUrl,
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
    if (await refreshOne(row, egress)) out.healthRecovered++
  }

  // ── 4. O64 号池↔签到对账收敛(断链自愈;失败不中断 sweep,下轮继续) ──
  // 结果走日志留痕,不进返回键集(见接口处注记:两条分支同键 + 全标量契约)。
  try {
    const reconciled = await reconcileCheckinSync()
    logger.info(
      '[relay-account-pool] O64 对账收敛完成',
      reconciled as unknown as Record<string, unknown>,
    )
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
    logger.info(
      '[relay-account-pool] O64 断链待推重推完成',
      retried as unknown as Record<string, unknown>,
    )
  } catch (e) {
    logger.warn('[relay-account-pool] 待推重推异常(不影响巡检)', {
      error: e instanceof Error ? e.message.slice(0, 200) : '未知错误',
    })
  }

  if (egress.proxied + egress.direct > 0) {
    logger.info('[relay-account-pool] 本轮出口选取', {
      proxied: egress.proxied,
      direct: egress.direct,
    })
  }

  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
