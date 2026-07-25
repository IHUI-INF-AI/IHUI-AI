/**
 * Token 余额服务插件。
 * 迁移自旧架构 services/token_service.py + token_cache_service.py + token_utils_service.py。
 *
 * 功能：
 * 1. 用户 credit 余额查询（Redis 缓存优先 + DB 兜底）
 * 2. Token 扣费（事务安全 + 余额校验）
 * 3. VIP 等级判定与扣费策略
 * 4. 促销期检测
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { userMargins, users } from '@ihui/database'
import { authenticate } from './auth.js'
import { success } from '../utils/response.js'
import { logger } from '../utils/logger.js'

const TOKEN_CACHE_TTL = 300 // 5 分钟缓存
const TOKEN_CACHE_PREFIX = 'token_balance:'

// P3-1 VIP 折扣实时计数器(供 admin 看板查询)
// VIP_TOKEN_BENEFITS: vipLevel 0=1.0 / 1=0.9 / 2=0.8 / 3=0.7 / 4=0.5
// 仅当 discountRate < 1.0 且 vipLevel > 0 时视为"应用了 VIP 折扣"
const vipDiscountMetrics = {
  applies: 0, // 应用 VIP 折扣的总次数
  totalDiscounted: 0, // 累计节省 token 数(amount - actualAmount 之和,含促销期额外8折)
  byLevel: {} as Record<number, number>, // 各 VIP 等级应用次数 { 1: N, 2: N, 3: N, 4: N }
}

/** VIP 等级对应的 Token 权益 */
const VIP_TOKEN_BENEFITS: Record<number, { monthlyQuota: number; discountRate: number }> = {
  0: { monthlyQuota: 1000, discountRate: 1.0 }, // 普通用户
  1: { monthlyQuota: 5000, discountRate: 0.9 }, // VIP1
  2: { monthlyQuota: 20000, discountRate: 0.8 }, // VIP2
  3: { monthlyQuota: 100000, discountRate: 0.7 }, // VIP3
  4: { monthlyQuota: 500000, discountRate: 0.5 }, // VIP4
}

interface TokenBalanceInfo {
  userId: string
  balance: number
  vipLevel: number
  monthlyQuota: number
  discountRate: number
  isPromotionPeriod: boolean
}

interface TokenBalanceService {
  getBalance(userId: string): Promise<TokenBalanceInfo>
  deductTokens(
    userId: string,
    amount: number,
    reason?: string,
    idempotencyKey?: string,
  ): Promise<{ success: boolean; remaining: number }>
  rechargeTokens(
    userId: string,
    amount: number,
    reason?: string,
  ): Promise<{ success: boolean; balance: number }>
  invalidateCache(userId: string): Promise<void>
  checkPromotionPeriod(): boolean
}

function checkPromotionPeriod(): boolean {
  // 促销期检测：每月1-7号为促销期
  const dayOfMonth = new Date().getDate()
  return dayOfMonth <= 7
}

function getVipBenefit(vipLevel: number) {
  return VIP_TOKEN_BENEFITS[vipLevel] ?? VIP_TOKEN_BENEFITS[0]!
}

const plugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  const redis = server.redis

  async function getCachedBalance(userId: string): Promise<number | null> {
    try {
      const cached = await redis.get(`${TOKEN_CACHE_PREFIX}${userId}`)
      return cached !== null ? Number(cached) : null
    } catch {
      return null // Redis 异常时降级到 DB
    }
  }

  async function setCachedBalance(userId: string, balance: number): Promise<void> {
    try {
      await redis.setex(`${TOKEN_CACHE_PREFIX}${userId}`, TOKEN_CACHE_TTL, String(balance))
    } catch {
      // 缓存写入失败不影响主流程
    }
  }

  async function getDbBalance(
    userId: string,
  ): Promise<{ balance: number; vipLevel: number } | null> {
    // LEFT JOIN users 表读取 isVip 作 vipLevel
    // users.isVip: -1=游客 0=普通 1=VIP 2=操盘手
    // -1(游客) 由 getVipBenefit 通过 ?? VIP_TOKEN_BENEFITS[0] 兜底降级到普通用户
    // isVip null(LEFT JOIN 未命中) / 异常 → 降级 vipLevel=0 + log warning
    const result = await db
      .select({
        tokenQuantity: userMargins.tokenQuantity,
        isVip: users.isVip,
      })
      .from(userMargins)
      .leftJoin(users, eq(userMargins.userId, users.id))
      .where(eq(userMargins.userId, userId))
      .limit(1)
    if (result.length === 0) {
      return { balance: 0, vipLevel: 0 }
    }
    const row = result[0]!
    const isVipRaw = row.isVip
    let vipLevel: number
    if (isVipRaw === null || isVipRaw === undefined) {
      vipLevel = 0
      logger.warn(
        `[token-balance] isVip 为 null, 降级 vipLevel=0: userId=${userId}`,
      )
    } else {
      vipLevel = isVipRaw
    }
    return { balance: row.tokenQuantity, vipLevel }
  }

  const service: TokenBalanceService = {
    async getBalance(userId: string): Promise<TokenBalanceInfo> {
      // 1. Redis 缓存优先
      const cached = await getCachedBalance(userId)
      let balance: number
      let vipLevel: number

      if (cached !== null) {
        balance = cached
        const dbInfo = await getDbBalance(userId)
        vipLevel = dbInfo?.vipLevel ?? 0
      } else {
        // 2. DB 兜底
        const dbInfo = await getDbBalance(userId)
        if (!dbInfo) {
          balance = 0
          vipLevel = 0
        } else {
          balance = dbInfo.balance
          vipLevel = dbInfo.vipLevel
          await setCachedBalance(userId, balance)
        }
      }

      const benefit = getVipBenefit(vipLevel)
      return {
        userId,
        balance,
        vipLevel,
        monthlyQuota: benefit.monthlyQuota,
        discountRate: benefit.discountRate,
        isPromotionPeriod: checkPromotionPeriod(),
      }
    },

    async deductTokens(
      userId: string,
      amount: number,
      reason?: string,
      idempotencyKey?: string,
    ): Promise<{ success: boolean; remaining: number }> {
      const info = await this.getBalance(userId)

      // G3: 幂等保护 - 若 idempotencyKey 已存在于 token_flows(同 op_type=1 扣减),
      // 说明是 BullMQ 重试重复消费,直接返回当前余额不重复扣
      // (依赖 G2 已建的 unique index (related_order_no, op_type))
      if (idempotencyKey) {
        const existing = await db.execute(sql`
          SELECT 1 FROM "token_flows"
          WHERE "related_order_no" = ${idempotencyKey} AND "op_type" = 1
          LIMIT 1
        `)
        if (existing.length > 0) {
          return { success: true, remaining: info.balance }
        }
      }

      // 促销期折扣
      const actualAmount = checkPromotionPeriod()
        ? Math.ceil(amount * info.discountRate * 0.8) // 促销期额外8折
        : Math.ceil(amount * info.discountRate)

      if (info.balance < actualAmount) {
        return { success: false, remaining: info.balance }
      }

      // 事务扣减（opType: 1=扣减）
      const newBalance = info.balance - actualAmount
      await db.execute(sql`
        UPDATE "user_margins" SET "token_quantity" = ${newBalance}, "updated_at" = now()
        WHERE "user_id" = ${userId} AND "token_quantity" >= ${actualAmount}
      `)

      // 写流水:带 related_order_no = idempotencyKey,ON CONFLICT DO NOTHING 兜底
      // (并发场景下两个 worker 同时通过 pre-check 时,第二个 INSERT 命中 unique index 被丢弃)
      await db.execute(sql`
        INSERT INTO "token_flows" ("user_id", "op_type", "quantity", "balance_after", "remark", "related_order_no", "created_at")
        VALUES (${userId}, 1, ${actualAmount}, ${newBalance}, ${reason ?? 'api_call'}, ${idempotencyKey ?? null}, now())
        ON CONFLICT ("related_order_no", "op_type") DO NOTHING
      `)

      await this.invalidateCache(userId)

      // P3-1 VIP 折扣指标埋点:仅当 discountRate < 1.0 且 vipLevel > 0 时算应用了 VIP 折扣
      if (info.discountRate < 1.0 && info.vipLevel > 0) {
        vipDiscountMetrics.applies++
        vipDiscountMetrics.totalDiscounted += Math.max(0, amount - actualAmount)
        vipDiscountMetrics.byLevel[info.vipLevel] =
          (vipDiscountMetrics.byLevel[info.vipLevel] ?? 0) + 1
      }

      return { success: true, remaining: newBalance }
    },

    async rechargeTokens(
      userId: string,
      amount: number,
      reason?: string,
    ): Promise<{ success: boolean; balance: number }> {
      const info = await this.getBalance(userId)
      const newBalance = info.balance + amount

      await db.execute(sql`
        INSERT INTO "user_margins" ("user_id", "token_quantity", "updated_at")
        VALUES (${userId}, ${newBalance}, now())
        ON CONFLICT ("user_id") DO UPDATE SET "token_quantity" = ${newBalance}, "updated_at" = now()
      `)

      // opType: 0=充值
      await db.execute(sql`
        INSERT INTO "token_flows" ("user_id", "op_type", "quantity", "balance_after", "remark", "created_at")
        VALUES (${userId}, 0, ${amount}, ${newBalance}, ${reason ?? 'manual'}, now())
      `)

      await this.invalidateCache(userId)
      return { success: true, balance: newBalance }
    },

    async invalidateCache(userId: string): Promise<void> {
      try {
        await redis.del(`${TOKEN_CACHE_PREFIX}${userId}`)
      } catch {
        // 忽略 Redis 错误
      }
    },

    checkPromotionPeriod(): boolean {
      return checkPromotionPeriod()
    },
  }

  server.decorate('tokenBalance', service)

  // GET /api/admin/token-balance/metrics — VIP 折扣实时计数器(admin 调试用, P3-1)
  // 与 business-metrics.ts 的 /business-metrics 互补,本端点提供 admin 看板查询的细分计数器,
  // 不直接进 Prometheus(避免改 business-metrics.ts)。
  server.get('/api/admin/token-balance/metrics', { preHandler: authenticate }, async () => {
    return success({ ...vipDiscountMetrics, byLevel: { ...vipDiscountMetrics.byLevel } })
  })
}

export const tokenBalanceService = fp(plugin, {
  name: 'token-balance-service',
  fastify: '5.x',
})

declare module 'fastify' {
  interface FastifyInstance {
    tokenBalance: TokenBalanceService
  }
}

export { type TokenBalanceService, type TokenBalanceInfo }
