import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { listLeaderboard, getLeaderboardEntry } from '../services/leaderboard-service.js'

// =============================================================================
// Zod schemas
// =============================================================================

const querySchema = z.object({
  category: z
    .preprocess(
      emptyToUndefined,
      z
        .enum(['overall', 'llm', 'image', 'video', 'multimodal', 'audio', 'embedding', 'agent'])
        .optional()
        .default('overall'),
    ),
  subcategory: z.preprocess(emptyToUndefined, z.string().max(32).optional()),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// =============================================================================
// 路由
// =============================================================================

const leaderboardRoutes: FastifyPluginAsync = async (server) => {
  // GET /model-leaderboard — 排行榜列表
  // 查询参数:category(可选,默认 overall)、subcategory(可选)、limit(可选,默认 20,最大 100)
  server.get('/model-leaderboard', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await listLeaderboard({
      category: parsed.data.category,
      subcategory: parsed.data.subcategory,
      limit: parsed.data.limit,
    })
    return reply.send(success(result))
  })

  // GET /model-leaderboard/:modelId — 模型详情
  server.get<{ Params: { modelId: string } }>('/model-leaderboard/:modelId', async (request, reply) => {
    const { modelId } = request.params
    const entry = await getLeaderboardEntry(modelId)
    if (!entry) return reply.status(404).send(error(404, '模型不存在'))
    return reply.send(success({ entry }))
  })
}

export default leaderboardRoutes
