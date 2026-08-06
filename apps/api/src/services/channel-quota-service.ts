/**
 * 渠道配额服务(2026-08-01 立,成本控制刚需)。
 *
 * 职责:
 * 1. checkQuota(keyPoolId): 调用前检查渠道(key_pool 条目)是否超出每日/每月配额
 * 2. recordUsage(keyPoolId, tokens, costCents, isError): 调用后 UPSERT 当日用量(原子递增)
 * 3. getMonthlyUsage / getDailyUsage: admin Dashboard 用量查询
 * 4. resetDailyQuota: 定时清理任务,清理 90 天前的旧数据(按 date 分组,无需主动重置)
 *
 * 配额维度(4 个,null = 无限):
 * - daily_call_limit / monthly_call_limit: 调用次数上限
 * - daily_token_limit / monthly_token_limit: token 上限
 *
 * 配额字段在 ai_relay_key_pool 表(由迁移 20260801010050_add_channel_quota_fields.sql 添加),
 * 但因不修改 packages/database/src/schema/ai-relay.ts,此处用 sql\`column\` 原始片段读取新列。
 *
 * 用量按日聚合到 ai_relay_channel_daily_usage 表(本地 pgTable 定义,因不修改 schema/index.ts)。
 * 表结构必须与迁移 SQL 完全一致。
 *
 * 性能保护:
 * - checkQuota 用 Redis 缓存(10 秒 TTL,key: channel:quota:{keyPoolId})减少 DB 压力
 * - recordUsage 失败不阻塞主链路(try-catch + logger.warn)
 * - 批量 recordUsage 用事务
 *
 * 当月定义:UTC+8 当月 1 日 00:00 至当前(与 tiered-pricing-service.ts 一致)。
 * 当日定义:UTC+8 当日 00:00 至当前(usage_date 列存 UTC+8 date,由应用层计算写入)。
 */
import { eq, and, gte, sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  integer,
  bigint,
  timestamp,
  date as drizzleDate,
  index,
  unique,
} from 'drizzle-orm/pg-core'
import IORedis, { type Redis } from 'ioredis'

import { db, dbRead } from '../db/index.js'
import { aiRelayKeyPool } from '@ihui/database'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'

// =============================================================================
// 本地 schema:ai_relay_channel_daily_usage
// =============================================================================
// 因不修改 packages/database/src/schema/index.ts,此处 inline 定义。
// 表结构与迁移 20260801010050_add_channel_quota_fields.sql 完全一致。
// bigint mode: 'number' 与 developerApiKeys.tokenBalance 对齐(JS number,避免 BigInt 序列化问题)。

/**
 * 渠道按日用量统计表(本地定义,供配额检查 + admin Dashboard 展示)。
 *
 * UNIQUE(key_pool_id, usage_date) 用于 UPSERT:同 key 同日只有一行,递增更新。
 */
export const aiRelayChannelDailyUsage = pgTable(
  'ai_relay_channel_daily_usage',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 关联 ai_relay_key_pool.id(ON DELETE CASCADE,级联删除) */
    keyPoolId: uuid('key_pool_id').notNull(),
    /** 统计日期(UTC+8 date,由应用层计算写入,YYYY-MM-DD) */
    usageDate: drizzleDate('usage_date').notNull(),
    /** 当日调用次数(含错误) */
    callCount: integer('call_count').default(0).notNull(),
    /** 当日累计 token 数 */
    totalTokens: bigint('total_tokens', { mode: 'number' }).default(0).notNull(),
    /** 当日累计成本(分) */
    totalCostCents: integer('total_cost_cents').default(0).notNull(),
    /** 当日错误次数 */
    errorCount: integer('error_count').default(0).notNull(),
    /** 最近一次更新时间 */
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    /** 同 key 同日唯一(UPSERT 冲突目标) */
    keyPoolDateUniq: unique('ai_relay_channel_daily_usage_key_date_unique').on(
      t.keyPoolId,
      t.usageDate,
    ),
    dateIdx: index('idx_channel_daily_usage_date').on(t.usageDate),
    keyIdx: index('idx_channel_daily_usage_key').on(t.keyPoolId),
  }),
)

export type AiRelayChannelDailyUsage = typeof aiRelayChannelDailyUsage.$inferSelect
export type NewAiRelayChannelDailyUsage = typeof aiRelayChannelDailyUsage.$inferInsert

// =============================================================================
// 类型定义
// =============================================================================

/** 配额检查结果。reason 标识哪个维度超限(供前端/日志区分)。 */
export interface CheckQuotaResult {
  allowed: boolean
  reason?:
    | 'daily_call_limit_exceeded'
    | 'monthly_call_limit_exceeded'
    | 'daily_token_limit_exceeded'
    | 'monthly_token_limit_exceeded'
}

/** key_pool 的 4 个配额限制(null = 无限)。 */
interface QuotaLimits {
  dailyCallLimit: number | null
  monthlyCallLimit: number | null
  dailyTokenLimit: number | null
  monthlyTokenLimit: number | null
}

/** 单日用量聚合。 */
export interface DailyUsageResult {
  callCount: number
  totalTokens: number
  totalCostCents: number
  errorCount: number
}

/** 月度用量聚合(用于 admin Dashboard)。 */
export interface MonthlyUsageResult {
  callCount: number
  totalTokens: number
  totalCostCents: number
}

/** recordUsage 单条输入(批量用)。 */
export interface RecordUsageInput {
  keyPoolId: string
  tokens: number
  costCents: number
  isError: boolean
}

// =============================================================================
// 常量
// =============================================================================

/** Redis 缓存 key 前缀 */
const QUOTA_CACHE_PREFIX = 'channel:quota:'
/** 配额检查缓存 TTL(10 秒,平衡实时性与 DB 压力) */
const QUOTA_CACHE_TTL_SEC = 10
/** 旧数据保留天数(resetDailyQuota 清理 90 天前) */
const USAGE_RETENTION_DAYS = 90

// =============================================================================
// Redis 客户端(单例,参考 relay-response-cache.ts / expiration-monitor-service.ts)
// =============================================================================

let redisClient: Redis | null = null
let redisInitTried = false

/**
 * 获取服务专用 Redis 客户端(惰性单例)。
 *
 * 服务层不持有 FastifyInstance 引用,自建独立连接。
 * 进程退出时优雅断开,避免连接泄漏导致进程挂起。
 * Redis 不可用时返回 null,调用方降级为每次查 DB(不影响功能正确性)。
 */
function getRedis(): Redis | null {
  if (redisInitTried) return redisClient
  redisInitTried = true
  try {
    redisClient = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: false,
    })
    redisClient.on('error', (err: Error) => {
      logger.warn('[channel-quota] redis error', { error: err.message })
    })
    const quit = (): void => {
      redisClient?.quit().catch(() => {
        /* ignore */
      })
    }
    process.once('SIGTERM', quit)
    process.once('SIGINT', quit)
  } catch (err) {
    logger.warn('[channel-quota] init redis failed', { error: (err as Error).message })
    redisClient = null
  }
  return redisClient
}

// =============================================================================
// 辅助函数:UTC+8 日期/月份边界
// =============================================================================

/**
 * 获取 UTC+8 当日对应的 date 字符串(YYYY-MM-DD)。
 *
 * usage_date 列在 DB 中是 DATE 类型,应用层写入时用 UTC+8 当日的 YYYY-MM-DD。
 * 例:UTC 时间 2026-08-01 17:00(北京时间 2026-08-02 01:00)→ 返回 '2026-08-02'
 *
 * @param now 基准时间(默认当前),允许传历史时间查历史日期
 */
function getUtc8DateStr(now: Date = new Date()): string {
  const utc8Ms = now.getTime() + 8 * 60 * 60 * 1000
  const utc8Date = new Date(utc8Ms)
  const y = utc8Date.getUTCFullYear()
  const m = String(utc8Date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(utc8Date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 获取 UTC+8 当月 1 日的 date 字符串(YYYY-MM-01)。
 * 用于月度聚合查询的 gte 下界(与 usage_date 同为 UTC+8 date 字符串,对齐比较)。
 */
function getUtc8MonthStartStr(now: Date = new Date()): string {
  const utc8Ms = now.getTime() + 8 * 60 * 60 * 1000
  const utc8Date = new Date(utc8Ms)
  const y = utc8Date.getUTCFullYear()
  const m = String(utc8Date.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

// =============================================================================
// 1. checkQuota — 调用前检查渠道配额
// =============================================================================

/**
 * 检查指定渠道(key_pool 条目)是否在配额范围内。
 *
 * 流程:
 * 1. Redis 缓存命中(10s TTL)→ 直接返回缓存结果
 * 2. 查 ai_relay_key_pool 拿 4 个 limit(用 sql 原始片段读新列)
 * 3. 查 ai_relay_channel_daily_usage 拿当日用量(call_count + total_tokens)
 * 4. SUM 当月所有日期的用量(call_count + total_tokens)
 * 5. 任一超限返回 { allowed: false, reason }
 * 6. 全部满足 → { allowed: true },写 Redis 缓存
 *
 * null limit = 无限,跳过该维度检查。
 *
 * @param keyPoolId 渠道 key_pool 条目 id
 * @returns { allowed: true } 或 { allowed: false, reason }
 */
export async function checkQuota(keyPoolId: string): Promise<CheckQuotaResult> {
  // 1. Redis 缓存
  const cacheKey = `${QUOTA_CACHE_PREFIX}${keyPoolId}`
  const redis = getRedis()
  if (redis) {
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached) as CheckQuotaResult
      }
    } catch (err) {
      // Redis 读失败 → 降级查 DB,不阻塞
      logger.warn('[channel-quota] redis get failed, fallback to DB', {
        keyPoolId,
        error: (err as Error).message,
      })
    }
  }

  // 2. 查 4 个 limit(用 sql 原始片段读 ai_relay_key_pool 的新列,避免修改 schema 文件)
  const limits = await getKeyPoolQuotaLimits(keyPoolId)
  if (!limits) {
    // key_pool 不存在 → 拒绝(防御性,正常调用链不会到这里)
    const result: CheckQuotaResult = { allowed: false, reason: 'daily_call_limit_exceeded' }
    await cacheQuotaResult(cacheKey, result, redis)
    return result
  }

  // 全部 null = 无限,直接放行(快速路径)
  if (
    limits.dailyCallLimit === null &&
    limits.monthlyCallLimit === null &&
    limits.dailyTokenLimit === null &&
    limits.monthlyTokenLimit === null
  ) {
    const result: CheckQuotaResult = { allowed: true }
    await cacheQuotaResult(cacheKey, result, redis)
    return result
  }

  // 3. 查当日用量
  const todayDateStr = getUtc8DateStr()
  const dailyUsage = await getRawDailyUsage(keyPoolId, todayDateStr)

  // 4. 查当月用量(SUM)
  const monthStartStr = getUtc8MonthStartStr()
  const monthlyUsage = await getRawMonthlyUsage(keyPoolId, monthStartStr)

  // 5. 逐维度检查(任一超限即拒绝)
  let result: CheckQuotaResult

  if (limits.dailyCallLimit !== null && dailyUsage.callCount >= limits.dailyCallLimit) {
    result = { allowed: false, reason: 'daily_call_limit_exceeded' }
  } else if (
    limits.monthlyCallLimit !== null &&
    monthlyUsage.callCount >= limits.monthlyCallLimit
  ) {
    result = { allowed: false, reason: 'monthly_call_limit_exceeded' }
  } else if (limits.dailyTokenLimit !== null && dailyUsage.totalTokens >= limits.dailyTokenLimit) {
    result = { allowed: false, reason: 'daily_token_limit_exceeded' }
  } else if (
    limits.monthlyTokenLimit !== null &&
    monthlyUsage.totalTokens >= limits.monthlyTokenLimit
  ) {
    result = { allowed: false, reason: 'monthly_token_limit_exceeded' }
  } else {
    result = { allowed: true }
  }

  // 6. 写 Redis 缓存(允许/拒绝都缓存,避免被反复打)
  await cacheQuotaResult(cacheKey, result, redis)

  return result
}

/** 写配额检查结果到 Redis(失败不阻塞)。 */
async function cacheQuotaResult(
  cacheKey: string,
  result: CheckQuotaResult,
  redis: Redis | null,
): Promise<void> {
  if (!redis) return
  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', QUOTA_CACHE_TTL_SEC)
  } catch (err) {
    logger.warn('[channel-quota] redis set failed', { error: (err as Error).message })
  }
}

/**
 * 查 key_pool 的 4 个配额限制。
 * 用 sql\`column\` 原始片段读 ai_relay_key_pool 的新列(因不修改 schema/ai-relay.ts)。
 * 返回 null 表示 key_pool 不存在。
 */
async function getKeyPoolQuotaLimits(keyPoolId: string): Promise<QuotaLimits | null> {
  const rows = await dbRead
    .select({
      dailyCallLimit: sql<number | null>`daily_call_limit`,
      monthlyCallLimit: sql<number | null>`monthly_call_limit`,
      dailyTokenLimit: sql<number | null>`daily_token_limit`,
      monthlyTokenLimit: sql<number | null>`monthly_token_limit`,
    })
    .from(aiRelayKeyPool)
    .where(eq(aiRelayKeyPool.id, keyPoolId))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    dailyCallLimit: row.dailyCallLimit,
    monthlyCallLimit: row.monthlyCallLimit,
    dailyTokenLimit: row.dailyTokenLimit,
    monthlyTokenLimit: row.monthlyTokenLimit,
  }
}

/**
 * 查指定日期的用量(原始聚合,内部用)。
 *
 * @param keyPoolId 渠道 id
 * @param dateStr 日期字符串(YYYY-MM-DD,UTC+8 当日)
 */
async function getRawDailyUsage(
  keyPoolId: string,
  dateStr: string,
): Promise<{ callCount: number; totalTokens: number }> {
  const rows = await dbRead
    .select({
      callCount: aiRelayChannelDailyUsage.callCount,
      totalTokens: aiRelayChannelDailyUsage.totalTokens,
    })
    .from(aiRelayChannelDailyUsage)
    .where(
      and(
        eq(aiRelayChannelDailyUsage.keyPoolId, keyPoolId),
        eq(aiRelayChannelDailyUsage.usageDate, dateStr),
      ),
    )
    .limit(1)
  const row = rows[0]
  if (!row) return { callCount: 0, totalTokens: 0 }
  return { callCount: row.callCount, totalTokens: row.totalTokens }
}

/**
 * 查当月用量聚合(SUM,内部用)。
 *
 * @param keyPoolId 渠道 id
 * @param monthStartStr 当月 1 日 date 字符串(YYYY-MM-01,UTC+8)
 */
async function getRawMonthlyUsage(
  keyPoolId: string,
  monthStartStr: string,
): Promise<{ callCount: number; totalTokens: number }> {
  const rows = await dbRead
    .select({
      callCount: sql<number>`coalesce(sum(${aiRelayChannelDailyUsage.callCount}), 0)::bigint::int`,
      totalTokens: sql<number>`coalesce(sum(${aiRelayChannelDailyUsage.totalTokens}), 0)::bigint::int`,
    })
    .from(aiRelayChannelDailyUsage)
    .where(
      and(
        eq(aiRelayChannelDailyUsage.keyPoolId, keyPoolId),
        gte(aiRelayChannelDailyUsage.usageDate, monthStartStr),
      ),
    )
  const row = rows[0]
  if (!row) return { callCount: 0, totalTokens: 0 }
  return { callCount: row.callCount, totalTokens: row.totalTokens }
}

// =============================================================================
// 2. recordUsage — 调用后记录用量(UPSERT 原子递增)
// =============================================================================

/**
 * 记录一次渠道调用的用量(UPSERT 到 ai_relay_channel_daily_usage)。
 *
 * - 同 key 同日只有一行(UNIQUE 约束),冲突时原子递增
 * - call_count / total_tokens / total_cost_cents / error_count 全部递增
 * - updated_at 刷新
 * - 失败不阻塞主链路(try-catch + logger.warn)
 *
 * @param keyPoolId 渠道 id
 * @param tokens 本次调用 total tokens
 * @param costCents 本次调用成本(分)
 * @param isError 是否错误调用(错误调用也计 call_count,额外计 error_count)
 */
export async function recordUsage(
  keyPoolId: string,
  tokens: number,
  costCents: number,
  isError: boolean,
): Promise<void> {
  try {
    const todayDateStr = getUtc8DateStr()
    await db
      .insert(aiRelayChannelDailyUsage)
      .values({
        keyPoolId,
        usageDate: todayDateStr,
        callCount: 1,
        totalTokens: tokens,
        totalCostCents: costCents,
        errorCount: isError ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: [aiRelayChannelDailyUsage.keyPoolId, aiRelayChannelDailyUsage.usageDate],
        set: {
          callCount: sql`${aiRelayChannelDailyUsage.callCount} + 1`,
          totalTokens: sql`${aiRelayChannelDailyUsage.totalTokens} + ${tokens}`,
          totalCostCents: sql`${aiRelayChannelDailyUsage.totalCostCents} + ${costCents}`,
          errorCount: sql`${aiRelayChannelDailyUsage.errorCount} + ${isError ? 1 : 0}`,
          updatedAt: new Date(),
        },
      })
    // P1 修复(TOCTOU):recordUsage 后强制失效缓存,让 checkQuota 立即看到新用量,
    // 避免缓存窗口期(10s)内并发请求因读旧缓存而超额。
    // 原子预扣改造(需改 DB schema)记为 P2 后续优化。
    await invalidateQuotaCache(keyPoolId)
  } catch (err) {
    // 失败不阻塞主链路:配额统计是辅助功能,不能影响正常调用
    logger.warn('[channel-quota] recordUsage failed', {
      keyPoolId,
      tokens,
      costCents,
      isError,
      error: (err as Error).message,
    })
  }
}

/**
 * 批量记录用量(事务,原子性保证)。
 *
 * 用于批量回放或高并发场景:一次性 UPSERT 多条记录,失败回滚。
 * 与单条 recordUsage 不同:批量失败会回滚整个事务(调用方需决定是否重试)。
 *
 * @param inputs 多条用量记录
 */
export async function recordUsageBatch(inputs: readonly RecordUsageInput[]): Promise<void> {
  if (inputs.length === 0) return
  const todayDateStr = getUtc8DateStr()
  try {
    await db.transaction(async (tx) => {
      // P2 修复(2026-08-06):原事务内逐条 insert 循环 → 每输入一次往返查询。
      // 改为单条批量 upsert(insert().values([...]) + onConflictDoUpdate 引用 excluded),
      // 一次 SQL 提交完成全部累计,与 id-mapping-queries.ts bulkCreateMappings 同款模式。
      await tx
        .insert(aiRelayChannelDailyUsage)
        .values(
          inputs.map((input) => ({
            keyPoolId: input.keyPoolId,
            usageDate: todayDateStr,
            callCount: 1,
            totalTokens: input.tokens,
            totalCostCents: input.costCents,
            errorCount: input.isError ? 1 : 0,
          })),
        )
        .onConflictDoUpdate({
          target: [aiRelayChannelDailyUsage.keyPoolId, aiRelayChannelDailyUsage.usageDate],
          set: {
            callCount: sql`${aiRelayChannelDailyUsage.callCount} + excluded.call_count`,
            totalTokens: sql`${aiRelayChannelDailyUsage.totalTokens} + excluded.total_tokens`,
            totalCostCents: sql`${aiRelayChannelDailyUsage.totalCostCents} + excluded.total_cost_cents`,
            errorCount: sql`${aiRelayChannelDailyUsage.errorCount} + excluded.error_count`,
            updatedAt: new Date(),
          },
        })
    })
  } catch (err) {
    logger.warn('[channel-quota] recordUsageBatch failed', {
      count: inputs.length,
      error: (err as Error).message,
    })
  }
}

// =============================================================================
// 3. getMonthlyUsage — admin Dashboard 月度用量查询
// =============================================================================

/**
 * 查指定渠道当月(UTC+8 当月 1 日至今)的用量聚合。
 *
 * 用于 admin Dashboard 展示当月累计调用次数 / token / 成本。
 *
 * @param keyPoolId 渠道 id
 * @returns { callCount, totalTokens, totalCostCents }(无数据返回 0)
 */
export async function getMonthlyUsage(keyPoolId: string): Promise<MonthlyUsageResult> {
  const monthStartStr = getUtc8MonthStartStr()
  const rows = await dbRead
    .select({
      callCount: sql<number>`coalesce(sum(${aiRelayChannelDailyUsage.callCount}), 0)::bigint::int`,
      totalTokens: sql<number>`coalesce(sum(${aiRelayChannelDailyUsage.totalTokens}), 0)::bigint::int`,
      totalCostCents: sql<number>`coalesce(sum(${aiRelayChannelDailyUsage.totalCostCents}), 0)::bigint::int`,
    })
    .from(aiRelayChannelDailyUsage)
    .where(
      and(
        eq(aiRelayChannelDailyUsage.keyPoolId, keyPoolId),
        gte(aiRelayChannelDailyUsage.usageDate, monthStartStr),
      ),
    )
  const row = rows[0]
  if (!row) return { callCount: 0, totalTokens: 0, totalCostCents: 0 }
  return {
    callCount: row.callCount,
    totalTokens: row.totalTokens,
    totalCostCents: row.totalCostCents,
  }
}

// =============================================================================
// 4. getDailyUsage — admin Dashboard 单日用量查询
// =============================================================================

/**
 * 查指定渠道指定日期的用量(默认今天)。
 *
 * @param keyPoolId 渠道 id
 * @param targetDate 日期(默认 UTC+8 当日);传 Date 时取其 UTC+8 当日的 YYYY-MM-DD
 * @returns { callCount, totalTokens, totalCostCents, errorCount }(无数据返回 0)
 */
export async function getDailyUsage(
  keyPoolId: string,
  targetDate?: Date,
): Promise<DailyUsageResult> {
  const dateStr = targetDate ? getUtc8DateStr(targetDate) : getUtc8DateStr()
  const rows = await dbRead
    .select({
      callCount: aiRelayChannelDailyUsage.callCount,
      totalTokens: aiRelayChannelDailyUsage.totalTokens,
      totalCostCents: aiRelayChannelDailyUsage.totalCostCents,
      errorCount: aiRelayChannelDailyUsage.errorCount,
    })
    .from(aiRelayChannelDailyUsage)
    .where(
      and(
        eq(aiRelayChannelDailyUsage.keyPoolId, keyPoolId),
        eq(aiRelayChannelDailyUsage.usageDate, dateStr),
      ),
    )
    .limit(1)
  const row = rows[0]
  if (!row) {
    return { callCount: 0, totalTokens: 0, totalCostCents: 0, errorCount: 0 }
  }
  return {
    callCount: row.callCount,
    totalTokens: row.totalTokens,
    totalCostCents: row.totalCostCents,
    errorCount: row.errorCount,
  }
}

// =============================================================================
// 5. resetDailyQuota — 定时清理任务(每天 0 点)
// =============================================================================

/**
 * 清理 90 天前的旧用量数据。
 *
 * 设计说明:
 * - 配额按 date 分组,无需主动"重置"当日配额(新的一天自动是新行)
 * - 此函数仅做数据保留策略:删除 USAGE_RETENTION_DAYS 天前的旧数据,控制表体积
 * - 建议由 BullMQ repeatable job 每日 0 点调用
 *
 * @returns 删除的行数(0 表示无需清理或失败)
 */
export async function resetDailyQuota(): Promise<number> {
  try {
    // 计算 N 天前的 UTC+8 date 字符串(与 usage_date 列对齐)
    const cutoffMs = Date.now() - USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000
    const cutoffDateStr = getUtc8DateStr(new Date(cutoffMs))
    const result = await db
      .delete(aiRelayChannelDailyUsage)
      .where(sql`${aiRelayChannelDailyUsage.usageDate} < ${cutoffDateStr}::date`)
      .returning({ id: aiRelayChannelDailyUsage.id })
    return result.length
  } catch (err) {
    logger.warn('[channel-quota] resetDailyQuota failed', {
      error: (err as Error).message,
    })
    return 0
  }
}

// =============================================================================
// 缓存失效(供 recordUsage 后主动失效,可选)
// =============================================================================

/**
 * 主动失效某渠道的配额缓存。
 *
 * 场景:recordUsage 后想让 checkQuota 立即看到新用量(默认 10s TTL 自然过期)。
 * 注意:频繁调用会让 checkQuota 每次都查 DB,谨慎使用(高并发场景建议依赖 TTL 自然过期)。
 *
 * @param keyPoolId 渠道 id
 */
export async function invalidateQuotaCache(keyPoolId: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(`${QUOTA_CACHE_PREFIX}${keyPoolId}`)
  } catch (err) {
    logger.warn('[channel-quota] invalidateQuotaCache failed', {
      keyPoolId,
      error: (err as Error).message,
    })
  }
}
