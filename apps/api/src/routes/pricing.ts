import type { FastifyPluginAsync } from 'fastify'
import {
  calculateCost,
  listPricing,
  listSupportedRegions,
  upsertPricing,
} from '../services/pricing-service.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'

// 系统管理员角色 ID（与 admin 路由保持一致）

// =============================================================================
// 定价路由（前缀 /api，由 server.ts 统一注册）
// =============================================================================

export const pricingRoutes: FastifyPluginAsync = async (server) => {
  // GET /pricing/models — 列出所有模型定价配置
  server.get('/pricing/models', async (_request, reply) => {
    const list = await listPricing()
    return reply.send(success({ models: list }))
  })

  // POST /pricing/models — 创建/更新模型定价（admin only）
  server.post('/pricing/models', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return

    const body = request.body as {
      modelId: string
      inputTokenPrice: number
      outputTokenPrice: number
      regionPricing?: Record<string, number>
      discount?: unknown
      currency?: string
      effectiveAt?: string
      expiresAt?: string | null
    }

    if (
      !body.modelId ||
      typeof body.inputTokenPrice !== 'number' ||
      typeof body.outputTokenPrice !== 'number'
    ) {
      return reply.status(400).send(error(400, 'modelId/inputTokenPrice/outputTokenPrice 必填'))
    }

    const saved = await upsertPricing({
      modelId: body.modelId,
      inputTokenPrice: body.inputTokenPrice,
      outputTokenPrice: body.outputTokenPrice,
      regionPricing: body.regionPricing,
      discount: body.discount ?? null,
      currency: body.currency,
      effectiveAt: body.effectiveAt ? new Date(body.effectiveAt) : undefined,
      expiresAt:
        body.expiresAt === null ? null : body.expiresAt ? new Date(body.expiresAt) : undefined,
    })

    return reply.send(success({ model: saved }))
  })

  // GET /pricing/calculate — 计算指定参数下的成本
  server.get('/pricing/calculate', async (request, reply) => {
    const query = request.query as {
      modelId?: string
      inputTokens?: string
      outputTokens?: string
      region?: string
      discountCode?: string
    }

    if (!query.modelId) {
      return reply.status(400).send(error(400, 'modelId 必填'))
    }

    const inputTokens = parseInt(query.inputTokens ?? '0', 10) || 0
    const outputTokens = parseInt(query.outputTokens ?? '0', 10) || 0

    const result = await calculateCost({
      modelId: query.modelId,
      inputTokens,
      outputTokens,
      region: query.region,
      discountCode: query.discountCode,
    })

    return reply.send(success(result))
  })

  // GET /pricing/regions — 列出所有支持的区域
  server.get('/pricing/regions', async (_request, reply) => {
    const regions = await listSupportedRegions()
    return reply.send(success({ regions }))
  })
}
