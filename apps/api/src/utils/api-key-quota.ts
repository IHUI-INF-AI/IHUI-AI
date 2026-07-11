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
   */
  async recordUsage(apiKeyId: string, cost: number = 1): Promise<void> {
    const row = await this.getOrCreateQuota(apiKeyId)
    const now = new Date()

    // 判断重置
    let hourlyUsed = row.hourlyUsed
    let dailyUsed = row.dailyUsed
    let resetAt = row.resetAt
    if (now >= resetAt) {
      hourlyUsed = 0
      resetAt = nextHourReset(now)
      const dayReset = nextDayReset(now)
      const prevDayReset = nextDayReset(new Date(now.getTime() - 3600_000))
      if (resetAt.getTime() === dayReset.getTime() || now >= prevDayReset) {
        dailyUsed = 0
      }
    }

    await db
      .update(apiKeyQuotas)
      .set({
        hourlyUsed: hourlyUsed + cost,
        dailyUsed: dailyUsed + cost,
        resetAt,
        updatedAt: now,
      })
      .where(eq(apiKeyQuotas.apiKeyId, apiKeyId))
  }

  /**
   * 原子地检查并扣除配额（check + record 合并，避免并发超用）。
   * 使用 SQL 条件更新保证原子性。
   */
  async checkAndConsume(apiKeyId: string, cost: number = 1): Promise<QuotaCheckResult> {
    const row = await this.getOrCreateQuota(apiKeyId)
    const now = new Date()

    let hourlyUsed = row.hourlyUsed
    let dailyUsed = row.dailyUsed
    let resetAt = row.resetAt
    if (now >= resetAt) {
      hourlyUsed = 0
      resetAt = nextHourReset(now)
      const dayReset = nextDayReset(now)
      const prevDayReset = nextDayReset(new Date(now.getTime() - 3600_000))
      if (resetAt.getTime() === dayReset.getTime() || now >= prevDayReset) {
        dailyUsed = 0
      }
    }

    if (hourlyUsed + cost > row.hourlyLimit) {
      return { allowed: false, remaining: 0, resetAt, reason: 'hourly_exceeded' }
    }
    if (dailyUsed + cost > row.dailyLimit) {
      return { allowed: false, remaining: 0, resetAt: nextDayReset(now), reason: 'daily_exceeded' }
    }

    // 原子条件更新：仅在当前值未变时扣减
    const updated = await db
      .update(apiKeyQuotas)
      .set({
        hourlyUsed: sql`${apiKeyQuotas.hourlyUsed} + ${cost}`,
        dailyUsed: sql`${apiKeyQuotas.dailyUsed} + ${cost}`,
        resetAt,
        updatedAt: now,
      })
      .where(
        sql`${apiKeyQuotas.apiKeyId} = ${apiKeyId}
            AND ${apiKeyQuotas.hourlyUsed} = ${hourlyUsed}
            AND ${apiKeyQuotas.dailyUsed} = ${dailyUsed}`,
      )
      .returning({ id: apiKeyQuotas.id })

    if (updated.length === 0) {
      // 并发冲突：重新检查
      return this.checkQuota(apiKeyId)
    }

    const remaining = Math.min(
      row.hourlyLimit - hourlyUsed - cost,
      row.dailyLimit - dailyUsed - cost,
    )
    return { allowed: true, remaining: Math.max(0, remaining), resetAt }
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
      .returning()
    const row = inserted[0]
    if (!row) throw new Error('初始化 API Key 配额失败')
    return row
  }
}
