/**
 * 过期监听 + Canary 联动服务。
 *
 * 迁移自旧架构三个文件：
 * - cached_expiration_monitor.py：基于缓存的 AgentBuy/AgentSettlement 过期检测
 * - canary_monitor_bridge.py：监听器掉线连续 N 次触发 Canary 自动回滚
 * - monitor_startup.py：监听服务生命周期管理
 *
 * 设计要点：
 * 1. 每个调度周期检测 AgentBuy 到期未处理记录（expiresAt <= now），标记为 expired。
 * 2. 检测 AgentSettlement 超时未结算记录（createdAt 早于阈值且 unsettled），自动结算为 settled。
 * 3. Redis 缓存已处理记录 id（SET + TTL），避免同一记录被重复检测/处理。
 * 4. 任一检测环节异常计入连续失败计数；连续 4 次失败触发 Canary 回滚
 *    （每 30s 一次 × 4 = 2 分钟，与旧架构 canary_monitor_bridge 阈值一致）。
 * 5. 成功完成一轮检测重置失败计数与触发标志。
 *
 * 多实例部署时由 BullMQ 保证同一调度周期只在一个 worker 实例执行，
 * Redis 状态（failStreak / triggered / processed）跨实例共享。
 */

import { and, eq, lte, not, inArray } from 'drizzle-orm'
import IORedis, { type Redis } from 'ioredis'
import { db } from '../db/index.js'
import { config } from '../config/index.js'
import { zhsAgentBuy, agentSettlements } from '@ihui/database'
import { getCanaryConfig, rollbackCanary } from './canary-service.js'
import { logger } from '../utils/logger.js'

// ---------- 常量 ----------

/** Canary 配置名（对应 canary_configs 表中 name 字段）。 */
const CANARY_NAME = 'expiration-monitor'

/** 连续检测失败几次后触发 Canary 回滚（每 30s 一次 × 4 = 2 分钟，与旧架构一致）。 */
const FAIL_THRESHOLD = 4

/** 结算记录超时阈值（小时）：创建超过该时长仍未结算视为过期。 */
const SETTLEMENT_TIMEOUT_HOURS = 72

/** 单次检测批量上限，避免一次性拉取过多记录。 */
const BATCH_LIMIT = 500

/** 已处理记录缓存 TTL（秒），略大于结算超时窗口便于回溯。 */
const PROCESSED_TTL = 25 * 60 * 60

/** Canary 触发标志 TTL（秒），避免短时间内反复触发回滚。 */
const TRIGGERED_TTL = 60 * 60

// Redis key
const FAIL_STREAK_KEY = 'expmon:fail_streak'
const TRIGGERED_KEY = 'expmon:canary_triggered'
const PROCESSED_BUY_KEY = 'expmon:processed:agent_buy'
const PROCESSED_SETTLEMENT_KEY = 'expmon:processed:agent_settlement'

// ---------- Redis 单例 ----------

let redisClient: Redis | null = null

/**
 * 获取服务专用 Redis 客户端（惰性单例）。
 *
 * 服务层不持有 FastifyInstance 引用（与 canary-service 风格一致），
 * 因此自建独立连接。进程退出时优雅断开，避免连接泄漏导致进程挂起。
 */
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    })
    redisClient.on('error', (err) => {
      logger.error('[expiration-monitor] redis error', { error: err })
    })
    const quit = (): void => {
      redisClient?.quit().catch(() => {})
    }
    process.once('SIGTERM', quit)
    process.once('SIGINT', quit)
  }
  return redisClient
}

// ---------- 类型 ----------

export interface ExpirationMonitorResult {
  checkedAgentBuy: number
  expiredAgentBuy: number
  checkedAgentSettlement: number
  expiredAgentSettlement: number
  failStreak: number
  canaryTriggered: boolean
  healthy: boolean
}

// ---------- 检测：AgentBuy ----------

/**
 * 检测 AgentBuy 到期未处理记录（expiresAt <= now 且状态非 expired/cancelled），
 * 批量标记为 expired。已处理过的 id 通过 Redis SET 去重，避免重复处理。
 */
async function detectExpiredAgentBuy(
  redis: Redis,
  now: Date,
): Promise<{ checked: number; expired: number }> {
  const rows = await db
    .select({ id: zhsAgentBuy.id })
    .from(zhsAgentBuy)
    .where(
      and(
        lte(zhsAgentBuy.expiresAt, now),
        not(inArray(zhsAgentBuy.status, ['expired', 'cancelled'])),
      ),
    )
    .limit(BATCH_LIMIT)

  if (rows.length === 0) return { checked: 0, expired: 0 }

  const unprocessed = await filterUnprocessed(redis, PROCESSED_BUY_KEY, rows)
  if (unprocessed.length === 0) return { checked: rows.length, expired: 0 }

  const ids = unprocessed.map((r) => r.id)
  await db
    .update(zhsAgentBuy)
    .set({ status: 'expired', updatedAt: now })
    .where(
      and(inArray(zhsAgentBuy.id, ids), not(inArray(zhsAgentBuy.status, ['expired', 'cancelled']))),
    )

  await markProcessed(redis, PROCESSED_BUY_KEY, ids)
  return { checked: rows.length, expired: unprocessed.length }
}

// ---------- 检测：AgentSettlement ----------

/**
 * 检测 AgentSettlement 超时未结算记录（status=unsettled 且 createdAt 早于阈值），
 * 自动结算为 settled 并回填 settledAt。已处理过的 id 通过 Redis SET 去重。
 *
 * 新架构 agent_settlements 表无 expiresAt 字段，改用 createdAt + 超时阈值
 * 判定"到期未结算"，语义等价于旧架构的 expiration_date。
 */
async function detectExpiredAgentSettlement(
  redis: Redis,
  now: Date,
): Promise<{ checked: number; expired: number }> {
  const cutoff = new Date(now.getTime() - SETTLEMENT_TIMEOUT_HOURS * 60 * 60 * 1000)
  const rows = await db
    .select({ id: agentSettlements.id })
    .from(agentSettlements)
    .where(and(eq(agentSettlements.status, 'unsettled'), lte(agentSettlements.createdAt, cutoff)))
    .limit(BATCH_LIMIT)

  if (rows.length === 0) return { checked: 0, expired: 0 }

  const unprocessed = await filterUnprocessed(redis, PROCESSED_SETTLEMENT_KEY, rows)
  if (unprocessed.length === 0) return { checked: rows.length, expired: 0 }

  const ids = unprocessed.map((r) => r.id)
  await db
    .update(agentSettlements)
    .set({ status: 'settled', settledAt: now, updatedAt: now })
    .where(and(inArray(agentSettlements.id, ids), eq(agentSettlements.status, 'unsettled')))

  await markProcessed(redis, PROCESSED_SETTLEMENT_KEY, ids)
  return { checked: rows.length, expired: unprocessed.length }
}

// ---------- 缓存工具 ----------

/** 过滤掉 Redis processed SET 中已存在的 id，返回未处理子集。 */
async function filterUnprocessed<T extends { id: string }>(
  redis: Redis,
  key: string,
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return []
  const pipe = redis.pipeline()
  for (const r of rows) pipe.sismember(key, r.id)
  const results = await pipe.exec()
  if (!results) return rows
  const unprocessed: T[] = []
  for (const [i, row] of rows.entries()) {
    const entry = results[i]
    if (!entry) continue
    // sismember 返回 0/1，1 表示已处理
    if (Number(entry[1]) !== 1) unprocessed.push(row)
  }
  return unprocessed
}

/** 将处理过的 id 加入 Redis SET 并续期 TTL。 */
async function markProcessed(redis: Redis, key: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const pipe = redis.pipeline()
  for (const id of ids) pipe.sadd(key, id)
  pipe.expire(key, PROCESSED_TTL)
  await pipe.exec()
}

// ---------- Canary 联动 ----------

/** 检测成功：重置失败计数与触发标志。 */
async function recordSuccess(redis: Redis): Promise<void> {
  await redis.set(FAIL_STREAK_KEY, '0')
  await redis.del(TRIGGERED_KEY)
}

/**
 * 检测失败：递增失败计数，达阈值时用 NX 占位触发标志后调用 Canary 回滚。
 * 返回当前失败次数与是否触发了回滚。
 */
async function recordFailureAndMaybeRollback(
  redis: Redis,
  reason: string,
): Promise<{ triggered: boolean; streak: number }> {
  const streak = await redis.incr(FAIL_STREAK_KEY)
  if (streak < FAIL_THRESHOLD) {
    return { triggered: false, streak }
  }
  // 达阈值，用 NX 避免重复触发（标志带 TTL，过期后可再次触发）
  const acquired = await redis.set(TRIGGERED_KEY, '1', 'EX', TRIGGERED_TTL, 'NX')
  if (acquired !== 'OK') {
    return { triggered: false, streak }
  }
  await triggerCanaryRollback(reason)
  return { triggered: true, streak }
}

/** 调用 canary-service 的回滚接口；配置不存在或非活跃时安全跳过。 */
async function triggerCanaryRollback(reason: string): Promise<void> {
  try {
    const cfg = await getCanaryConfig(CANARY_NAME)
    if (!cfg) {
      logger.error(`[expiration-monitor] canary config "${CANARY_NAME}" not found, skip rollback`)
      return
    }
    if (!cfg.isActive) {
      logger.warn(`[expiration-monitor] canary "${CANARY_NAME}" not active, skip rollback`)
      return
    }
    await rollbackCanary(CANARY_NAME, reason)
    logger.error(`[expiration-monitor] canary rollback triggered: ${reason}`)
  } catch (err) {
    // 回滚失败不应影响后续调度
    logger.error('[expiration-monitor] canary rollback failed', { error: err })
  }
}

// ---------- 主入口 ----------

/**
 * 执行一轮过期监听检测 + Canary 联动判定。
 *
 * 由 scheduler-worker 每 30s 调用一次。内部捕获所有异常并返回 healthy=false，
 * 不向调度层抛错（避免 BullMQ 重试雪崩）；Canary 回滚在内部自治触发。
 */
export async function startExpirationMonitor(): Promise<ExpirationMonitorResult> {
  const redis = getRedis()
  const now = new Date()

  let checkedBuy = 0
  let expiredBuy = 0

  // AgentBuy 检测
  try {
    const r = await detectExpiredAgentBuy(redis, now)
    checkedBuy = r.checked
    expiredBuy = r.expired
  } catch (err) {
    logger.error('[expiration-monitor] detect AgentBuy failed', { error: err })
    const { triggered, streak } = await recordFailureAndMaybeRollback(
      redis,
      `AgentBuy detection error: ${(err as Error).message}`,
    )
    return {
      checkedAgentBuy: checkedBuy,
      expiredAgentBuy: expiredBuy,
      checkedAgentSettlement: 0,
      expiredAgentSettlement: 0,
      failStreak: streak,
      canaryTriggered: triggered,
      healthy: false,
    }
  }

  // AgentSettlement 检测
  try {
    const r = await detectExpiredAgentSettlement(redis, now)
    await recordSuccess(redis)
    return {
      checkedAgentBuy: checkedBuy,
      expiredAgentBuy: expiredBuy,
      checkedAgentSettlement: r.checked,
      expiredAgentSettlement: r.expired,
      failStreak: 0,
      canaryTriggered: false,
      healthy: true,
    }
  } catch (err) {
    logger.error('[expiration-monitor] detect AgentSettlement failed', { error: err })
    const { triggered, streak } = await recordFailureAndMaybeRollback(
      redis,
      `AgentSettlement detection error: ${(err as Error).message}`,
    )
    return {
      checkedAgentBuy: checkedBuy,
      expiredAgentBuy: expiredBuy,
      checkedAgentSettlement: 0,
      expiredAgentSettlement: 0,
      failStreak: streak,
      canaryTriggered: triggered,
      healthy: false,
    }
  }
}
