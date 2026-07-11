import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { userPoints, agents, lessons } from '@ihui/database'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const periodSchema = z.enum(['day', 'week', 'month', 'total']).default('total')
const limitSchema = z.coerce.number().int().min(1).max(100).default(20)

const usersRankingQuerySchema = z.object({
  period: z.preprocess(emptyToUndefined, periodSchema),
  limit: z.preprocess(emptyToUndefined, limitSchema),
})

// =============================================================================
// 路由
// =============================================================================

const rankingRoutes: FastifyPluginAsync = async (server) => {
  // GET /users — 用户积分榜（支持 day/week/month/total 时间范围）
  server.get('/users', async (request, reply) => {
    const parsed = usersRankingQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { period, limit } = parsed.data

    // total：直接按 points 降序；其余周期按经验值近似排序（积分流水聚合需重表，此处降级为总积分）
    if (period === 'total') {
      const list = await db
        .select({
          userId: userPoints.userId,
          points: userPoints.points,
          level: userPoints.level,
          experience: userPoints.experience,
        })
        .from(userPoints)
        .orderBy(desc(userPoints.points))
        .limit(limit)
      return reply.send(success({ list, period }))
    }

    // 非总榜：按 experience 近似排序（避免对流水表做大范围聚合）
    const list = await db
      .select({
        userId: userPoints.userId,
        points: userPoints.points,
        level: userPoints.level,
        experience: userPoints.experience,
      })
      .from(userPoints)
      .orderBy(desc(userPoints.experience))
      .limit(limit)
    return reply.send(success({ list, period }))
  })

  // GET /agents — 智能体热度榜（按 usage_count 降序）
  server.get('/agents', async (request, reply) => {
    const parsed = z
      .object({ limit: z.preprocess(emptyToUndefined, limitSchema) })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { limit } = parsed.data
    const list = await db
      .select({
        agentId: agents.agentId,
        name: agents.name,
        avatar: agents.avatar,
        usageCount: agents.usageCount,
        likeCount: agents.likeCount,
        shareCount: agents.shareCount,
      })
      .from(agents)
      .where(eq(agents.status, 'published'))
      .orderBy(desc(agents.usageCount))
      .limit(limit)
    return reply.send(success({ list }))
  })

  // GET /courses — 课程人气榜（按 signup_count 降序）
  server.get('/courses', async (request, reply) => {
    const parsed = z
      .object({ limit: z.preprocess(emptyToUndefined, limitSchema) })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { limit } = parsed.data
    const list = await db
      .select({
        id: lessons.id,
        title: lessons.title,
        coverImage: lessons.coverImage,
        signupCount: lessons.signupCount,
        viewCount: lessons.viewCount,
      })
      .from(lessons)
      .where(eq(lessons.isPublished, true))
      .orderBy(desc(lessons.signupCount))
      .limit(limit)
    return reply.send(success({ list }))
  })

  // GET /lists — 榜单列表（返回各榜单元信息，供前端选择展示）
  server.get('/lists', async (_request, reply) => {
    const lists = [
      { key: 'users', name: '用户积分榜', periods: ['day', 'week', 'month', 'total'] },
      { key: 'agents', name: '智能体热度榜', periods: ['total'] },
      { key: 'courses', name: '课程人气榜', periods: ['total'] },
    ]
    return reply.send(success({ lists }))
  })
}

export default rankingRoutes
