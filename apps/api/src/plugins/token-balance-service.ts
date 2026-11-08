// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { userMargins, users } from '@ihui/database'
import { authenticate } from './auth.js'
import { requireAdmin } from './require-permission.js'
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

/**
 * 原子扣减用户钱包 token 余额,并在同一事务写 token_flows(opType=1)。
 *
 * 与 deductTokens 共用同一套 SQL 语义;抽成独立导出函数是为了让没有 Fastify server
 * 的调用方(Crew 子 LLM)也能接上真实扣费链路,而不是只记统计表。
 */
export async function deductWalletTokens(input: {
  userId: string
  amount: number
  reason?: string
  idempotencyKey?: string
  /** 调用前已读到的余额;不传时在事务内再查一次 */
  currentBalance?: number
}): Promise<{ success: boolean; remaining: number }> {
  const { userId, amount, reason, idempotencyKey, currentBalance } = input
  return db.transaction(async (tx) => {
    const readBalance = async (): Promise<number> => {
      if (currentBalance !== undefined) return currentBalance
      const [row] = await tx
        .select({ tokenQuantity: userMargins.tokenQuantity })
        .from(userMargins)
        .where(eq(userMargins.userId, userId))
        .limit(1)
      return row?.tokenQuantity ?? 0
    }

    // G3:事务内幂等检查(依赖 unique index (related_order_no, op_type))
    if (idempotencyKey) {
      const existing = await tx.execute(sql`
        SELECT 1 FROM "token_flows"
        WHERE "related_order_no" = ${idempotencyKey} AND "op_type" = 1
        LIMIT 1
      `)
      if (existing.length > 0) {
        return { success: true, remaining: await readBalance() }
      }
    }

    // 原子 UPDATE + WHERE 余额检查 + RETURNING(0 行 = 余额不足或用户不存在)
    const updated = await tx
      .update(userMargins)
      .set({
        tokenQuantity: sql`${userMargins.tokenQuantity} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(and(eq(userMargins.userId, userId), sql`${userMargins.tokenQuantity} >= ${amount}`))
      .returning({ tokenQuantity: userMargins.tokenQuantity })

    if (updated.length === 0) {
      return { success: false, remaining: await readBalance() }
    }

    const newBalance = updated[0]!.tokenQuantity
    await tx.execute(sql`
      INSERT INTO "token_flows" ("user_id", "op_type", "quantity", "balance_after", "remark", "related_order_no", "created_at")
      VALUES (${userId}, 1, ${amount}, ${newBalance}, ${reason ?? 'api_call'}, ${idempotencyKey ?? null}, now())
      ON CONFLICT ("related_order_no", "op_type") DO NOTHING
    `)
    return { success: true, remaining: newBalance }
  })
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
      logger.warn(`[token-balance] isVip 为 null, 降级 vipLevel=0: userId=${userId}`)
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

      // 促销期折扣(discountRate 是用户属性,不会在事务中改变,事务外计算无并发风险)
      const actualAmount = checkPromotionPeriod()
        ? Math.ceil(amount * info.discountRate * 0.8) // 促销期额外8折
        : Math.ceil(amount * info.discountRate)

      // P0 修复:幂等检查 + 原子扣减 + 流水写入全部包在事务内,
      // 防止 UPDATE 成功后 INSERT 失败导致余额扣了无流水。
      const result = await deductWalletTokens({
        userId,
        amount: actualAmount,
        reason,
        idempotencyKey,
        currentBalance: info.balance,
      })

      // 事务提交成功后:invalidate cache + VIP 折扣埋点(事务外,失败不影响主流程)
      if (result.success) {
        await this.invalidateCache(userId)
        // P3-1 VIP 折扣指标埋点:仅当 discountRate < 1.0 且 vipLevel > 0 时算应用了 VIP 折扣
        if (info.discountRate < 1.0 && info.vipLevel > 0) {
          vipDiscountMetrics.applies++
          vipDiscountMetrics.totalDiscounted += Math.max(0, amount - actualAmount)
          vipDiscountMetrics.byLevel[info.vipLevel] =
            (vipDiscountMetrics.byLevel[info.vipLevel] ?? 0) + 1
        }
      }

      return result
    },

    async rechargeTokens(
      userId: string,
      amount: number,
      reason?: string,
    ): Promise<{ success: boolean; balance: number }> {
      // P0 修复:原子 UPSERT + 流水写入包在事务内,
      // 防止 UPSERT 成功后 INSERT 失败导致余额加了无流水。
      const newBalance = await db.transaction(async (tx) => {
        // 原子 UPSERT 用 SQL 表达式 token_quantity = token_quantity + amount(防 lost update)
        const [updated] = await tx
          .insert(userMargins)
          .values({ userId, tokenQuantity: amount, frozenQuantity: 0 })
          .onConflictDoUpdate({
            target: userMargins.userId,
            set: {
              tokenQuantity: sql`${userMargins.tokenQuantity} + ${amount}`,
              updatedAt: new Date(),
            },
          })
          .returning({ tokenQuantity: userMargins.tokenQuantity })

        const balance = updated!.tokenQuantity

        // opType: 0=充值(事务内,失败回滚 UPSERT)
        await tx.execute(sql`
          INSERT INTO "token_flows" ("user_id", "op_type", "quantity", "balance_after", "remark", "created_at")
          VALUES (${userId}, 0, ${amount}, ${balance}, ${reason ?? 'manual'}, now())
        `)

        return balance
      })

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
  server.get(
    '/api/admin/token-balance/metrics',
    { preHandler: [authenticate, requireAdmin] },
    async () => {
      return success({ ...vipDiscountMetrics, byLevel: { ...vipDiscountMetrics.byLevel } })
    },
  )
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
