import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import {
  calculateCost,
  listPricing,
  listSupportedRegions,
  upsertPricing,
} from '../services/pricing-service.js'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

// 系统管理员角色 ID（与 admin 路由保持一致）
const ADMIN_ROLE_ID = 1

// =============================================================================
// 鉴权辅助
// =============================================================================

/** 校验登录 + 管理员权限，失败时已写响应并返回 false。 */
async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    reply
      .status(statusCode)
      .send(error(statusCode, (e as Error).message || 'Authentication required'))
    return false
  }
  const roleId = request.jwtPayload?.roleId ?? 0
  if (roleId < ADMIN_ROLE_ID) {
    reply.status(403).send(error(403, '需要管理员权限'))
    return false
  }
  return true
}

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
    if (!(await requireAdmin(request, reply))) return

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
