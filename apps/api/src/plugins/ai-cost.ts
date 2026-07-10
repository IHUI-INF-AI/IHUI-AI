import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { createHash } from 'node:crypto';
import { eq, sql, and, gte, sum, desc, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  aiCostRecords,
  aiBudgets,
  type AiCostRecord,
} from '@ihui/database';
import { authenticate } from './auth.js';
import { success, error } from '../utils/response.js';

// =============================================================================
// Prompt 缓存 (LRU, 内存)
// =============================================================================

interface CacheEntry {
  response: unknown;
  expiredAt: number;
}

const promptCache = new Map<string, CacheEntry>();
const CACHE_MAX = 500;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 分钟

function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex');
}

/** 查询 prompt 缓存, 命中返回结果, 否则返回 null。 */
export function getCachedPrompt(prompt: string): unknown | null {
  const key = hashPrompt(prompt);
  const entry = promptCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiredAt) {
    promptCache.delete(key);
    return null;
  }
  return entry.response;
}

/** 写入 prompt 缓存。 */
export function setCachedPrompt(prompt: string, response: unknown): void {
  const key = hashPrompt(prompt);
  if (promptCache.size >= CACHE_MAX) {
    // 淘汰最旧条目
    const firstKey = promptCache.keys().next().value;
    if (firstKey) promptCache.delete(firstKey);
  }
  promptCache.set(key, { response, expiredAt: Date.now() + CACHE_TTL_MS });
}

/** 清空 prompt 缓存。 */
export function clearPromptCache(): void {
  promptCache.clear();
}

// =============================================================================
// Token 预算控制
// =============================================================================

interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
}

/** 检查预算: 按用户/租户/模型维度, 返回是否允许调用。 */
export async function checkBudget(
  scope: 'user' | 'tenant' | 'model',
  scopeKey: string,
  model?: string,
): Promise<BudgetCheckResult> {
  const conditions = [eq(aiBudgets.scope, scope), eq(aiBudgets.scopeKey, scopeKey)];
  if (model) conditions.push(eq(aiBudgets.model, model));

  const [budget] = await db
    .select()
    .from(aiBudgets)
    .where(and(...conditions))
    .limit(1);

  if (!budget) return { allowed: true };

  // 查今日已用 token
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [used] = await db
    .select({ total: sum(aiCostRecords.totalTokens) })
    .from(aiCostRecords)
    .where(gte(aiCostRecords.createdAt, todayStart));

  const usedToday = Number(used?.total ?? 0);
  if (usedToday >= budget.dailyTokenLimit) {
    return { allowed: false, reason: '日 token 预算已用尽' };
  }

  return { allowed: true };
}

// =============================================================================
// AI 成本记录
// =============================================================================

export interface CostRecordInput {
  userId?: string;
  tenantId?: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  cached?: boolean;
  requestType?: string;
  promptHash?: string;
  metadata?: string;
}

/** 记录一次 AI 调用的成本。 */
export async function recordAiCost(input: CostRecordInput): Promise<void> {
  await db.insert(aiCostRecords).values({
    userId: input.userId,
    tenantId: input.tenantId,
    model: input.model,
    provider: input.provider,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    totalTokens: input.totalTokens,
    cost: input.cost.toString(),
    cached: input.cached ?? false,
    requestType: input.requestType ?? 'chat',
    promptHash: input.promptHash,
    metadata: input.metadata,
  });
}

/** 装饰 server: 提供 AI 成本治理辅助方法。 */
declare module 'fastify' {
  interface FastifyInstance {
    aiCost: {
      checkBudget: typeof checkBudget;
      record: typeof recordAiCost;
      getCached: typeof getCachedPrompt;
      setCached: typeof setCachedPrompt;
    };
  }
}

/**
 * AI 成本治理插件:
 * - Token 预算控制 (按用户/租户/模型)
 * - Prompt 缓存 (重复 prompt 复用结果)
 * - AI 调用成本记录
 * - 成本看板 API (GET /api/admin/ai/cost/dashboard)
 */
const aiCostPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.decorate('aiCost', {
    checkBudget,
    record: recordAiCost,
    getCached: getCachedPrompt,
    setCached: setCachedPrompt,
  });

  // ---- 成本看板 API ----

  // GET /api/admin/ai/cost/dashboard — 成本汇总看板
  server.get(
    '/api/admin/ai/cost/dashboard',
    { preHandler: authenticate },
    async (request: FastifyRequest) => {
      const query = request.query as {
        startDate?: string;
        endDate?: string;
        tenantId?: string;
      };
      const endDate = query.endDate ? new Date(query.endDate) : new Date();
      const startDate = query.startDate ? new Date(query.startDate) : new Date(endDate.getTime() - 30 * 24 * 3600 * 1000);

      const conditions: SQL[] = [
        gte(aiCostRecords.createdAt, startDate),
        sql`${aiCostRecords.createdAt} <= ${endDate}`,
      ];
      if (query.tenantId) {
        conditions.push(eq(aiCostRecords.tenantId, query.tenantId));
      }

      // 总成本
      const [totalRow] = await db
        .select({
          totalCost: sum(aiCostRecords.cost),
          totalTokens: sum(aiCostRecords.totalTokens),
          totalCalls: sql<number>`count(*)::int`,
        })
        .from(aiCostRecords)
        .where(and(...conditions));

      // 按模型分组
      const byModel = await db
        .select({
          model: aiCostRecords.model,
          cost: sum(aiCostRecords.cost),
          tokens: sum(aiCostRecords.totalTokens),
          calls: sql<number>`count(*)::int`,
        })
        .from(aiCostRecords)
        .where(and(...conditions))
        .groupBy(aiCostRecords.model)
        .orderBy(desc(sum(aiCostRecords.cost)));

      // 按天分组
      const byDay = await db
        .select({
          date: sql<string>`to_char(${aiCostRecords.createdAt}, 'YYYY-MM-DD')`,
          cost: sum(aiCostRecords.cost),
          tokens: sum(aiCostRecords.totalTokens),
          calls: sql<number>`count(*)::int`,
        })
        .from(aiCostRecords)
        .where(and(...conditions))
        .groupBy(sql`to_char(${aiCostRecords.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${aiCostRecords.createdAt}, 'YYYY-MM-DD')`);

      return success({
        summary: {
          totalCost: totalRow?.totalCost ?? '0',
          totalTokens: Number(totalRow?.totalTokens ?? 0),
          totalCalls: totalRow?.totalCalls ?? 0,
          cacheHitRate: await getCacheHitRate(conditions),
        },
        byModel: byModel.map((r) => ({
          model: r.model,
          cost: r.cost ?? '0',
          tokens: Number(r.tokens ?? 0),
          calls: r.calls ?? 0,
        })),
        byDay: byDay.map((r) => ({
          date: r.date,
          cost: r.cost ?? '0',
          tokens: Number(r.tokens ?? 0),
          calls: r.calls ?? 0,
        })),
        period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      });
    },
  );

  // GET /api/admin/ai/cost/records — 成本记录明细
  server.get(
    '/api/admin/ai/cost/records',
    { preHandler: authenticate },
    async (request: FastifyRequest) => {
      const query = request.query as {
        limit?: string;
        offset?: string;
        userId?: string;
        model?: string;
      };
      const limit = Math.min(parseInt(query.limit ?? '50', 10), 200);
      const offset = parseInt(query.offset ?? '0', 10);

      const conditions: SQL[] = [];
      if (query.userId) conditions.push(eq(aiCostRecords.userId, query.userId));
      if (query.model) conditions.push(eq(aiCostRecords.model, query.model));

      const records: AiCostRecord[] = await db
        .select()
        .from(aiCostRecords)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(aiCostRecords.createdAt))
        .limit(limit)
        .offset(offset);

      return success(
        records.map((r) => ({
          id: r.id,
          userId: r.userId,
          tenantId: r.tenantId,
          model: r.model,
          provider: r.provider,
          promptTokens: r.promptTokens,
          completionTokens: r.completionTokens,
          totalTokens: r.totalTokens,
          cost: r.cost,
          cached: r.cached,
          requestType: r.requestType,
          createdAt: r.createdAt,
        })),
      );
    },
  );

  // GET /api/admin/ai/cost/budgets — 预算列表
  server.get(
    '/api/admin/ai/cost/budgets',
    { preHandler: authenticate },
    async () => {
      const budgets = await db.select().from(aiBudgets).orderBy(desc(aiBudgets.updatedAt));
      return success(budgets);
    },
  );

  // POST /api/admin/ai/cost/budgets — 设置预算
  server.post(
    '/api/admin/ai/cost/budgets',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply) => {
      const body = request.body as {
        scope: 'user' | 'tenant' | 'model';
        scopeKey: string;
        model?: string;
        dailyTokenLimit?: number;
        monthlyTokenLimit?: number;
        dailyCostLimit?: number;
        monthlyCostLimit?: number;
      };
      if (!body.scope || !body.scopeKey) {
        reply.status(400).send(error(400, 'scope 和 scopeKey 必填'));
        return;
      }

      const [existing] = await db
        .select()
        .from(aiBudgets)
        .where(
          and(
            eq(aiBudgets.scope, body.scope),
            eq(aiBudgets.scopeKey, body.scopeKey),
            body.model ? eq(aiBudgets.model, body.model) : undefined,
          ),
        )
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(aiBudgets)
          .set({
            dailyTokenLimit: body.dailyTokenLimit ?? existing.dailyTokenLimit,
            monthlyTokenLimit: body.monthlyTokenLimit ?? existing.monthlyTokenLimit,
            dailyCostLimit: body.dailyCostLimit?.toString() ?? existing.dailyCostLimit,
            monthlyCostLimit: body.monthlyCostLimit?.toString() ?? existing.monthlyCostLimit,
          })
          .where(eq(aiBudgets.id, existing.id))
          .returning();
        return success(updated);
      }

      const [created] = await db
        .insert(aiBudgets)
        .values({
          scope: body.scope,
          scopeKey: body.scopeKey,
          model: body.model,
          dailyTokenLimit: body.dailyTokenLimit,
          monthlyTokenLimit: body.monthlyTokenLimit,
          dailyCostLimit: body.dailyCostLimit?.toString(),
          monthlyCostLimit: body.monthlyCostLimit?.toString(),
        })
        .returning();
      return success(created);
    },
  );
};

/** 计算缓存命中率。 */
async function getCacheHitRate(conditions: SQL[]): Promise<number> {
  const [cachedRow] = await db
    .select({
      cached: sql<number>`count(*) filter (where ${aiCostRecords.cached} = true)::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(aiCostRecords)
    .where(and(...conditions));
  const total = Number(cachedRow?.total ?? 0);
  if (total === 0) return 0;
  const cached = Number(cachedRow?.cached ?? 0);
  return Math.round((cached / total) * 10000) / 100;
}

export default fp(aiCostPlugin, {
  name: 'ai-cost-plugin',
  fastify: '5.x',
});
