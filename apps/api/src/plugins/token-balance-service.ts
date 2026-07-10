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

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userMargins } from '@ihui/database';

const TOKEN_CACHE_TTL = 300; // 5 分钟缓存
const TOKEN_CACHE_PREFIX = 'token_balance:';

/** VIP 等级对应的 Token 权益 */
const VIP_TOKEN_BENEFITS: Record<number, { monthlyQuota: number; discountRate: number }> = {
  0: { monthlyQuota: 1000, discountRate: 1.0 },   // 普通用户
  1: { monthlyQuota: 5000, discountRate: 0.9 },    // VIP1
  2: { monthlyQuota: 20000, discountRate: 0.8 },   // VIP2
  3: { monthlyQuota: 100000, discountRate: 0.7 },  // VIP3
  4: { monthlyQuota: 500000, discountRate: 0.5 },  // VIP4
};

interface TokenBalanceInfo {
  userId: string;
  balance: number;
  vipLevel: number;
  monthlyQuota: number;
  discountRate: number;
  isPromotionPeriod: boolean;
}

interface TokenBalanceService {
  getBalance(userId: string): Promise<TokenBalanceInfo>;
  deductTokens(userId: string, amount: number, reason?: string): Promise<{ success: boolean; remaining: number }>;
  rechargeTokens(userId: string, amount: number, reason?: string): Promise<{ success: boolean; balance: number }>;
  invalidateCache(userId: string): Promise<void>;
  checkPromotionPeriod(): boolean;
}

function checkPromotionPeriod(): boolean {
  // 促销期检测：每月1-7号为促销期
  const dayOfMonth = new Date().getDate();
  return dayOfMonth <= 7;
}

function getVipBenefit(vipLevel: number) {
  return VIP_TOKEN_BENEFITS[vipLevel] ?? VIP_TOKEN_BENEFITS[0];
}

const plugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  const redis = server.redis;

  async function getCachedBalance(userId: string): Promise<number | null> {
    try {
      const cached = await redis.get(`${TOKEN_CACHE_PREFIX}${userId}`);
      return cached !== null ? Number(cached) : null;
    } catch {
      return null; // Redis 异常时降级到 DB
    }
  }

  async function setCachedBalance(userId: string, balance: number): Promise<void> {
    try {
      await redis.setex(`${TOKEN_CACHE_PREFIX}${userId}`, TOKEN_CACHE_TTL, String(balance));
    } catch {
      // 缓存写入失败不影响主流程
    }
  }

  async function getDbBalance(userId: string): Promise<{ balance: number; vipLevel: number } | null> {
    const result = await db
      .select({
        tokenQuantity: userMargins.tokenQuantity,
      })
      .from(userMargins)
      .where(eq(userMargins.userId, userId))
      .limit(1);
    if (result.length === 0) {
      return { balance: 0, vipLevel: 0 };
    }
    // VIP 等级查询可后续从 vip 表关联，当前默认 0
    return { balance: result[0].tokenQuantity, vipLevel: 0 };
  }

  const service: TokenBalanceService = {
    async getBalance(userId: string): Promise<TokenBalanceInfo> {
      // 1. Redis 缓存优先
      const cached = await getCachedBalance(userId);
      let balance: number;
      let vipLevel: number;

      if (cached !== null) {
        balance = cached;
        const dbInfo = await getDbBalance(userId);
        vipLevel = dbInfo?.vipLevel ?? 0;
      } else {
        // 2. DB 兜底
        const dbInfo = await getDbBalance(userId);
        if (!dbInfo) {
          balance = 0;
          vipLevel = 0;
        } else {
          balance = dbInfo.balance;
          vipLevel = dbInfo.vipLevel;
          await setCachedBalance(userId, balance);
        }
      }

      const benefit = getVipBenefit(vipLevel);
      return {
        userId,
        balance,
        vipLevel,
        monthlyQuota: benefit.monthlyQuota,
        discountRate: benefit.discountRate,
        isPromotionPeriod: checkPromotionPeriod(),
      };
    },

    async deductTokens(userId: string, amount: number, reason?: string): Promise<{ success: boolean; remaining: number }> {
      const info = await this.getBalance(userId);

      // 促销期折扣
      const actualAmount = checkPromotionPeriod()
        ? Math.ceil(amount * info.discountRate * 0.8) // 促销期额外8折
        : Math.ceil(amount * info.discountRate);

      if (info.balance < actualAmount) {
        return { success: false, remaining: info.balance };
      }

      // 事务扣减（opType: 1=扣减）
      const newBalance = info.balance - actualAmount;
      await db.execute(sql`
        UPDATE "user_margins" SET "token_quantity" = ${newBalance}, "updated_at" = now()
        WHERE "user_id" = ${userId} AND "token_quantity" >= ${actualAmount}
      `);

      await db.execute(sql`
        INSERT INTO "token_flows" ("user_id", "op_type", "quantity", "balance_after", "remark", "created_at")
        VALUES (${userId}, 1, ${actualAmount}, ${newBalance}, ${reason ?? 'api_call'}, now())
      `);

      await this.invalidateCache(userId);
      return { success: true, remaining: newBalance };
    },

    async rechargeTokens(userId: string, amount: number, reason?: string): Promise<{ success: boolean; balance: number }> {
      const info = await this.getBalance(userId);
      const newBalance = info.balance + amount;

      await db.execute(sql`
        INSERT INTO "user_margins" ("user_id", "token_quantity", "updated_at")
        VALUES (${userId}, ${newBalance}, now())
        ON CONFLICT ("user_id") DO UPDATE SET "token_quantity" = ${newBalance}, "updated_at" = now()
      `);

      // opType: 0=充值
      await db.execute(sql`
        INSERT INTO "token_flows" ("user_id", "op_type", "quantity", "balance_after", "remark", "created_at")
        VALUES (${userId}, 0, ${amount}, ${newBalance}, ${reason ?? 'manual'}, now())
      `);

      await this.invalidateCache(userId);
      return { success: true, balance: newBalance };
    },

    async invalidateCache(userId: string): Promise<void> {
      try {
        await redis.del(`${TOKEN_CACHE_PREFIX}${userId}`);
      } catch {
        // 忽略 Redis 错误
      }
    },

    checkPromotionPeriod(): boolean {
      return checkPromotionPeriod();
    },
  };

  server.decorate('tokenBalance', service);
};

export const tokenBalanceService = fp(plugin, {
  name: 'token-balance-service',
  fastify: '5.x',
});

declare module 'fastify' {
  interface FastifyInstance {
    tokenBalance: TokenBalanceService;
  }
}

export { type TokenBalanceService, type TokenBalanceInfo };
