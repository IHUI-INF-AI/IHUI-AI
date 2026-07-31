/**
 * API Key TPM (Token Per Minute) 限流 service。
 *
 * 职责:
 * - checkTpmQuota: 调用前检查当前分钟已用 token 是否超限
 * - recordTpmUsage: 调用后记录实际 token 用量(Redis + DB 双写)
 * - getMinuteUsage: 查询当前分钟用量(UI 显示)
 * - getHourlyStats: 查询最近 60 分钟用量统计(图表展示)
 *
 * Redis 为主存储(低延迟),DB 兜底(Redis miss 时回源)。
 * Redis 故障时 fail-open(放行,不阻塞合法用户)。
 *
 * 注:tpmLimit 字段由 migration 20260801010060 添加,
 * schema 类型由主 agent 后续统一集成,此处用类型断言读取(与 api-key-auth.ts 同模式)。
 */
import { eq, sql } from 'drizzle-orm'
import IORedis, { type Redis } from 'ioredis'
import { db, dbRead } from '../db/index.js'
import { developerApiKeys } from '@ihui/database'
import type { DeveloperApiKey } from '@ihui/database'
import { logger } from '../utils/logger.js'
import { config } from '../config/index.js'

// ============================================================================
// 类型定义
// ============================================================================

/** checkTpmQuota 返回值。 */
export interface TpmQuotaResult {
  allowed: boolean
  remaining: number
  resetAt: Date
}

/** getMinuteUsage 返回值。 */
export interface MinuteUsage {
  tokens: number
  requests: number
  resetAt: Date
}

/** getHourlyStats 单条统计。 */
export interface HourlyStatEntry {
  minute: Date
  tokens: number
  requests: number
}

// ============================================================================
// Redis 客户端(懒加载单例,与 api-key-auth.ts 同模式)
// ============================================================================

let redisClient: Redis | null = null

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
    })
    redisClient.on('error', () => {
      /* silent — TPM check fails open */
    })
  }
  return redisClient
}

// ============================================================================
// 工具函数
// ============================================================================

/** 当前分钟的 Unix 时间戳(分钟粒度)。 */
function getCurrentMinute(): number {
  return Math.floor(Date.now() / 60_000)
}

/** 下一分钟整点(用于 resetAt)。 */
function getNextMinuteReset(): Date {
  return new Date((getCurrentMinute() + 1) * 60_000)
}

/** Redis token 计数 key。 */
function getTpmTokenKey(apiKeyId: string, minute: number): string {
  return `tpm:${apiKeyId}:${minute}`
}

/** Redis 请求计数 key。 */
function getTpmReqKey(apiKeyId: string, minute: number): string {
  return `tpm:req:${apiKeyId}:${minute}`
}

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 检查 API Key 的 TPM 配额。
 *
 * @param apiKeyId API Key ID
 * @param estimatedTokens 预估本次请求消耗的 token 数
 * @returns { allowed, remaining, resetAt }
 *   - tpmLimit 为 null(无限)→ allowed: true, remaining: Infinity
 *   - 已用 + estimated > tpmLimit → allowed: false, remaining: 0
 *   - 否则 → allowed: true, remaining: tpmLimit - 已用
 *   - Redis 故障 → fail-open(allowed: true)
 */
export async function checkTpmQuota(
  apiKeyId: string,
  estimatedTokens: number,
): Promise<TpmQuotaResult> {
  const resetAt = getNextMinuteReset()

  // 查 tpmLimit(migration 新增字段,schema 类型待主 agent 集成,用类型断言读取)
  const [row] = await dbRead
    .select()
    .from(developerApiKeys)
    .where(eq(developerApiKeys.id, apiKeyId))
    .limit(1)

  if (!row) {
    return { allowed: true, remaining: Infinity, resetAt }
  }

  const tpmLimit = (row as DeveloperApiKey & { tpmLimit: number | null }).tpmLimit

  // null = 无限
  if (tpmLimit === null) {
    return { allowed: true, remaining: Infinity, resetAt }
  }

  // 读 Redis 当前分钟已用 token
  const minute = getCurrentMinute()
  const tokenKey = getTpmTokenKey(apiKeyId, minute)

  let usedTokens = 0
  try {
    const redis = getRedisClient()
    const val = await redis.get(tokenKey)
    usedTokens = val ? Number(val) : 0
  } catch {
    logger.warn('TPM quota check failed open (Redis error)', { apiKeyId })
    return { allowed: true, remaining: Infinity, resetAt }
  }

  if (usedTokens + estimatedTokens > tpmLimit) {
    return { allowed: false, remaining: 0, resetAt }
  }

  return { allowed: true, remaining: tpmLimit - usedTokens, resetAt }
}

/**
 * 记录 API Key 的 TPM 用量(Redis + DB 双写)。
 *
 * Redis: INCRBY token 数 + INCR 请求数,TTL 120 秒(用 pipeline 减少 RTT)
 * DB: UPSERT 到 api_key_minute_usage 表(异步,失败不阻塞)
 *
 * @param apiKeyId API Key ID
 * @param tokens 实际消耗的 token 数
 */
export async function recordTpmUsage(apiKeyId: string, tokens: number): Promise<void> {
  const minute = getCurrentMinute()
  const tokenKey = getTpmTokenKey(apiKeyId, minute)
  const reqKey = getTpmReqKey(apiKeyId, minute)

  // Redis pipeline: INCRBY + INCR + EXPIRE × 2
  try {
    const redis = getRedisClient()
    const pipeline = redis.pipeline()
    pipeline.incrby(tokenKey, tokens)
    pipeline.incr(reqKey)
    pipeline.expire(tokenKey, 120)
    pipeline.expire(reqKey, 120)
    await pipeline.exec()
  } catch {
    logger.warn('TPM usage Redis record failed (non-blocking)', { apiKeyId })
  }

  // 异步 UPSERT 到 DB(失败不阻塞)
  void db
    .execute(sql`
      INSERT INTO api_key_minute_usage (api_key_id, usage_minute, request_count, total_tokens, updated_at)
      VALUES (${apiKeyId}, date_trunc('minute', now()), 1, ${tokens}, now())
      ON CONFLICT (api_key_id, usage_minute)
      DO UPDATE SET
        request_count = api_key_minute_usage.request_count + 1,
        total_tokens = api_key_minute_usage.total_tokens + ${tokens},
        updated_at = now()
    `)
    .catch((err: unknown) => {
      logger.warn('TPM usage DB upsert failed (non-blocking)', { apiKeyId, error: String(err) })
    })
}

/**
 * 查询当前分钟的 TPM 用量(用于 UI 显示)。
 *
 * 优先读 Redis(低延迟),Redis miss 时回源查 DB。
 *
 * @param apiKeyId API Key ID
 * @returns { tokens, requests, resetAt }
 */
export async function getMinuteUsage(apiKeyId: string): Promise<MinuteUsage> {
  const minute = getCurrentMinute()
  const tokenKey = getTpmTokenKey(apiKeyId, minute)
  const reqKey = getTpmReqKey(apiKeyId, minute)
  const resetAt = getNextMinuteReset()

  // 优先读 Redis
  try {
    const redis = getRedisClient()
    const pipeline = redis.pipeline()
    pipeline.get(tokenKey)
    pipeline.get(reqKey)
    const results = await pipeline.exec()
    const tokensRaw = results?.[0]?.[1]
    const reqRaw = results?.[1]?.[1]
    return {
      tokens: tokensRaw != null ? Number(tokensRaw) : 0,
      requests: reqRaw != null ? Number(reqRaw) : 0,
      resetAt,
    }
  } catch {
    logger.warn('TPM minute usage Redis miss, falling back to DB', { apiKeyId })
  }

  // 回源查 DB
  const result = await dbRead.execute(sql`
    SELECT request_count, total_tokens
    FROM api_key_minute_usage
    WHERE api_key_id = ${apiKeyId} AND usage_minute = date_trunc('minute', now())
  `)
  const rows = result as unknown as Array<{ request_count: number; total_tokens: number }>
  const row = rows[0]
  return {
    tokens: row?.total_tokens ?? 0,
    requests: row?.request_count ?? 0,
    resetAt,
  }
}

/**
 * 查询最近 60 分钟的 TPM 用量统计(用于前端图表)。
 *
 * @param apiKeyId API Key ID
 * @returns 按时间升序排列的用量数组
 */
export async function getHourlyStats(apiKeyId: string): Promise<HourlyStatEntry[]> {
  const result = await dbRead.execute(sql`
    SELECT
      usage_minute AS minute,
      total_tokens AS tokens,
      request_count AS requests
    FROM api_key_minute_usage
    WHERE api_key_id = ${apiKeyId}
      AND usage_minute >= date_trunc('minute', now()) - interval '60 minutes'
    ORDER BY usage_minute ASC
  `)
  const rows = result as unknown as Array<{
    minute: Date
    tokens: number
    requests: number
  }>
  return rows.map((r) => ({
    minute: r.minute,
    tokens: Number(r.tokens),
    requests: Number(r.requests),
  }))
}
