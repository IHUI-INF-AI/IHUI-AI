/**
 * AI 模型定价公开路由(AGENTS.md §24 P0-3a/b 配套)。
 *
 * 路径前缀:/api(server.ts 通过 fastify.register 指定)
 *
 * 端点:
 * - GET /api/ai-pricing  公开,返回所有模型定价(按 modelId 升序)
 *
 * 配套前端:apps/web/app/(main)/models-pricing/ModelsPricingContent.tsx
 */
import type { FastifyPluginAsync } from 'fastify'
import { asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { aiPricing } from '@ihui/database'
import { success } from '../utils/response.js'

export const aiPricingRoutes: FastifyPluginAsync = async (server) => {
  // 公开:模型定价列表(无需登录,定价页需要展示给所有访客)
  server.get('/ai-pricing', async (_request, reply) => {
    const items = await db
      .select({
        id: aiPricing.id,
        modelId: aiPricing.modelId,
        inputTokenPrice: aiPricing.inputTokenPrice,
        outputTokenPrice: aiPricing.outputTokenPrice,
        regionPricing: aiPricing.regionPricing,
        currency: aiPricing.currency,
        effectiveAt: aiPricing.effectiveAt,
      })
      .from(aiPricing)
      .orderBy(asc(aiPricing.modelId))
    return reply.send(success({ items }))
  })
}
