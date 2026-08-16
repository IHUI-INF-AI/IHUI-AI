/**
 * API Key 调用配额管理（按小时/天限制）。
 *
 * 防止单个 API Key 在短时间内大量调用接口，保护后端资源。
 * 使用数据库 api_key_quotas 表持久化配额状态，支持多实例共享。
 * 配额按小时滚动重置（hourlyUsed），按天滚动重置（dailyUsed）。
 */

import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { apiKeyQuotas } from '@ihui/database'

/** 配额检查结果。 */
export interface QuotaCheckResult {
  /** 是否允许调用 */
  allowed: boolean
  /** 当前周期剩余可用次数（取小时/天配额中较小者） */
  remaining: number
  /** 下次重置时间（按小时滚动） */
  resetAt: Date
  /** 拒绝原因（allowed=false 时有值） */
  reason?: 'hourly_exceeded' | 'daily_exceeded'
}

/** 配额配置（可按 API Key 自定义）。 */
export interface QuotaConfig {
  hourlyLimit?: number
  dailyLimit?: number
}

/** 默认配额：每小时 1000 次，每天 10000 次。 */
export const DEFAULT_HOURLY_LIMIT = 1000
export const DEFAULT_DAILY_LIMIT = 10_000

/**
 * 计算下一个整点时间（小时重置点）。
 */
function nextHourReset(now: Date = new Date()): Date {
  const next = new Date(now)
  next.setMinutes(0, 0, 0)
  next.setHours(next.getHours() + 1)
  return next
}

/**
 * 计算下一个自然日零点（天重置点）。
 */
function nextDayReset(now: Date = new Date()): Date {
  const next = new Date(now)
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() + 1)
  return next
}

/**
 * API Key 调用配额管理器。
 * 一个实例对应一组配额配置；可对多个 API Key 复用。
 */
export class ApiKeyQuota {
  constructor(private readonly defaultConfig: QuotaConfig = {}) {}

  /**
   * 检查指定 API Key 是否仍可调用。
   * 不消耗配额，仅查询当前状态。
   */
  async checkQuota(apiKeyId: string): Promise<QuotaCheckResult> {
    const row = await this.getOrCreateQuota(apiKeyId)
    const now = new Date()

    // 判断是否需要重置（按小时滚动）
    let hourlyUsed = row.hourlyUsed
    let dailyUsed = row.dailyUsed
    let resetAt = row.resetAt

    if (now >= resetAt) {
      // 跨小时：重置 hourlyUsed
      hourlyUsed = 0
      resetAt = nextHourReset(now)
      // 跨自然日：同时重置 dailyUsed
      const dayReset = nextDayReset(now)
      const prevDayReset = nextDayReset(new Date(now.getTime() - 3600_000))
      if (resetAt.getTime() === dayReset.getTime() || now >= prevDayReset) {
        dailyUsed = 0
      }
    }

    const hourlyRemaining = row.hourlyLimit - hourlyUsed
    const dailyRemaining = row.dailyLimit - dailyUsed
    const remaining = Math.max(0, Math.min(hourlyRemaining, dailyRemaining))

    if (hourlyRemaining <= 0) {
      return { allowed: false, remaining: 0, resetAt, reason: 'hourly_exceeded' }
    }
    if (dailyRemaining <= 0) {
      return { allowed: false, remaining: 0, resetAt: nextDayReset(now), reason: 'daily_exceeded' }
    }
    return { allowed: true, remaining, resetAt }
  }

  /**
   * 记录一次调用消耗。
   * @param cost 消耗的配额数（如批量接口可计多次），默认 1
   *
   * P2-2 修复(2026-08-06):原实现 read→update 分离,并发调用丢失计数。
   * 改为原子 SQL UPDATE(CASE WHEN 内联重置判断),消除竞态。
   */
  async recordUsage(apiKeyId: string, cost: number = 1): Promise<void> {
    const now = new Date()
    const nextHour = nextHourReset(now)
    // 今日零点:resetAt 早于它说明跨过自然日,daily 一并重置
    const dayStart = new Date(now)
    dayStart.setHours(0, 0, 0, 0)

    await db
      .update(apiKeyQuotas)
      .set({
        // 跨小时(now >= resetAt)→ hourly 归零后加 cost;否则累加
        hourlyUsed: sql`CASE WHEN ${apiKeyQuotas.resetAt} <= ${now} THEN ${cost} ELSE ${apiKeyQuotas.hourlyUsed} + ${cost} END`,
        // 跨小时且跨自然日 → daily 归零后加 cost;否则累加
        dailyUsed: sql`CASE WHEN ${apiKeyQuotas.resetAt} <= ${now} AND ${apiKeyQuotas.resetAt} < ${dayStart} THEN ${cost} ELSE ${apiKeyQuotas.dailyUsed} + ${cost} END`,
        resetAt: sql`CASE WHEN ${apiKeyQuotas.resetAt} <= ${now} THEN ${nextHour} ELSE ${apiKeyQuotas.resetAt} END`,
        updatedAt: now,
      })
      .where(eq(apiKeyQuotas.apiKeyId, apiKeyId))
  }

  /**
   * 原子地检查并扣除配额（check + record 合并，避免并发超用）。
   * 使用 SQL 条件更新保证原子性。
   *
   * P2-2 修复(2026-08-06):原实现 check→update 分离,并发冲突时回退 checkQuota
   * ("放行但不计数",配额实际被绕过)。现在单条原子 UPDATE 完成检查+扣减:
   * WHERE 内联 hourly/daily 上限条件,未超限才扣减;0 行影响 = 超限或记录不存在。
   */
  async checkAndConsume(apiKeyId: string, cost: number = 1): Promise<QuotaCheckResult> {
    // 记录不存在时先初始化(不存在则此次无法原子扣减,初始化后重试一次)
    const exists = await this.getOrCreateQuota(apiKeyId)
    if (!exists) throw new Error('初始化 API Key 配额失败')

    const now = new Date()
    const nextHour = nextHourReset(now)
    const dayStart = new Date(now)
    dayStart.setHours(0, 0, 0, 0)

    const updated = await db
      .update(apiKeyQuotas)
      .set({
        hourlyUsed: sql`CASE WHEN ${apiKeyQuotas.resetAt} <= ${now} THEN ${cost} ELSE ${apiKeyQuotas.hourlyUsed} + ${cost} END`,
        dailyUsed: sql`CASE WHEN ${apiKeyQuotas.resetAt} <= ${now} AND ${apiKeyQuotas.resetAt} < ${dayStart} THEN ${cost} ELSE ${apiKeyQuotas.dailyUsed} + ${cost} END`,
        resetAt: sql`CASE WHEN ${apiKeyQuotas.resetAt} <= ${now} THEN ${nextHour} ELSE ${apiKeyQuotas.resetAt} END`,
        updatedAt: now,
      })
      .where(
        sql`${apiKeyQuotas.apiKeyId} = ${apiKeyId}
            AND ${apiKeyQuotas.hourlyUsed} + ${cost} <= ${apiKeyQuotas.hourlyLimit}
            AND ${apiKeyQuotas.dailyUsed} + ${cost} <= ${apiKeyQuotas.dailyLimit}`,
      )
      .returning({
        hourlyUsed: apiKeyQuotas.hourlyUsed,
        dailyUsed: apiKeyQuotas.dailyUsed,
        hourlyLimit: apiKeyQuotas.hourlyLimit,
        dailyLimit: apiKeyQuotas.dailyLimit,
        resetAt: apiKeyQuotas.resetAt,
      })

    const row = updated[0]
    if (!row) {
      // 0 行影响 = 超限。读取最新状态返回拒绝原因。
      const latest = await this.getOrCreateQuota(apiKeyId)
      const hourlyRemaining = latest.hourlyLimit - latest.hourlyUsed
      const dailyRemaining = latest.dailyLimit - latest.dailyUsed
      if (hourlyRemaining < cost) {
        return {
          allowed: false,
          remaining: Math.max(0, hourlyRemaining),
          resetAt: latest.resetAt,
          reason: 'hourly_exceeded',
        }
      }
      return {
        allowed: false,
        remaining: Math.max(0, dailyRemaining),
        resetAt: nextDayReset(now),
        reason: 'daily_exceeded',
      }
    }

    const remaining = Math.min(row.hourlyLimit - row.hourlyUsed, row.dailyLimit - row.dailyUsed)
    return { allowed: true, remaining: Math.max(0, remaining), resetAt: row.resetAt }
  }

  /** 读取或初始化配额记录。 */
  private async getOrCreateQuota(apiKeyId: string) {
    const rows = await db
      .select()
      .from(apiKeyQuotas)
      .where(eq(apiKeyQuotas.apiKeyId, apiKeyId))
      .limit(1)
    const existing = rows[0]
    if (existing) return existing

    // 初始化
    const hourlyLimit = this.defaultConfig.hourlyLimit ?? DEFAULT_HOURLY_LIMIT
    const dailyLimit = this.defaultConfig.dailyLimit ?? DEFAULT_DAILY_LIMIT
    const resetAt = nextHourReset()
    const inserted = await db
      .insert(apiKeyQuotas)
      .values({
        apiKeyId,
        hourlyUsed: 0,
        dailyUsed: 0,
        hourlyLimit,
        dailyLimit,
        resetAt,
      })
      .onConflictDoNothing({ target: [apiKeyQuotas.apiKeyId] })
      .returning()
    const row = inserted[0]
    if (row) return row
    // P2 修复(2026-08-06):两个并发请求同时初始化相同 apiKeyId 时,
    // 后到的 insert 撞唯一约束(23505)原实现会抛 500。onConflictDoNothing 吞掉冲突后,
    // 回退重查返回并发请求已插入的记录,保证幂等返回。
    const existingAfterInsert = await db
      .select()
      .from(apiKeyQuotas)
      .where(eq(apiKeyQuotas.apiKeyId, apiKeyId))
      .limit(1)
    if (existingAfterInsert[0]) return existingAfterInsert[0]
    throw new Error('初始化 API Key 配额失败')
  }
}
