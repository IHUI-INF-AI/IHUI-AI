import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { db } from '../db/index.js'
import {
  agentHeatStats,
  agents,
  examQuestions,
  examPapers,
  examRecords,
  circlePosts,
  comments,
  newsArticles,
  resources,
  helpArticles,
} from '@ihui/database'
import {
  getLearnStatistics,
  getExamStatistics,
  getContentStatistics,
  getOverviewStatistics,
  findStatisticsSnapshots,
  findStatisticsSnapshotById,
  createStatisticsSnapshot,
  deleteStatisticsSnapshot,
  getMessageStatistics,
  getLiveStatistics,
  getPointStatistics,
  getResourceStatistics,
  getUserCenterStatistics,
  findVisitLogList,
} from '../db/statistics-queries.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const listSnapshotsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.preprocess(emptyToUndefined, z.string().min(1).max(50).optional()),
})

const createSnapshotSchema = z.object({
  type: z.enum(['overview', 'learn', 'exam', 'content']),
  data: z.record(z.unknown()).optional(),
})

const visitLogsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  startTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  endTime: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
})

// Agent 热度统计查询参数
const agentHeatQuery = z.object({
  startDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  endDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const agentHeatRefreshSchema = z.object({
  dateStr: z.string().min(1).optional(),
})

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
}

// =============================================================================
// 公共路由（前缀 /api，需登录，只读聚合统计）
// =============================================================================

export const statisticsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
  })

  // GET /statistics/learn - 学习统计
  server.get(
    '/statistics/learn',
    {
      schema: {
        summary: '学习统计',
        tags: ['statistics'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const statistics = await getLearnStatistics()
      return reply.send(success({ statistics }))
    },
  )

  // GET /statistics/exam - 考试统计
  server.get(
    '/statistics/exam',
    {
      schema: {
        summary: '考试统计',
        tags: ['statistics'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const statistics = await getExamStatistics()
      return reply.send(success({ statistics }))
    },
  )

  // GET /statistics/content - 内容统计
  server.get(
    '/statistics/content',
    {
      schema: {
        summary: '内容统计',
        tags: ['statistics'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const statistics = await getContentStatistics()
      return reply.send(success({ statistics }))
    },
  )

  // GET /statistics/overview - 总览统计
  server.get(
    '/statistics/overview',
    {
      schema: {
        summary: '总览统计',
        tags: ['statistics'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const statistics = await getOverviewStatistics()
      return reply.send(success({ statistics }))
    },
  )

  // GET /statistics/agent-heat - Agent 热度统计（从 agentHeatStats 表聚合）
  server.get(
    '/statistics/agent-heat',
    {
      schema: {
        summary: 'Agent 热度统计',
        tags: ['statistics'],
        querystring: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: '起始日期 YYYY-MM-DD（默认 7 天前）' },
            endDate: { type: 'string', description: '结束日期 YYYY-MM-DD（默认今天）' },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = agentHeatQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { startDate, endDate, limit } = parsed.data
      // 默认最近 7 天
      const end = endDate ?? new Date().toISOString().slice(0, 10)
      const start =
        startDate ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      // 按小时聚合 Agent 使用次数（从 agent_heat_stats 表）
      const heatRows = await db
        .select({
          agentId: agentHeatStats.agentId,
          totalHits: sql<number>`sum(${agentHeatStats.hitCount})::int`,
          days: sql<number>`count(distinct ${agentHeatStats.dateStr})::int`,
        })
        .from(agentHeatStats)
        .where(and(gte(agentHeatStats.dateStr, start), lte(agentHeatStats.dateStr, end)))
        .groupBy(agentHeatStats.agentId)
        .orderBy(desc(sql`sum(${agentHeatStats.hitCount})`))
        .limit(limit)

      // 关联 agents 表获取名称
      const agentIds = heatRows.map((r) => r.agentId)
      let agentMap: Map<string, { name: string; avatar: string | null }> = new Map()
      if (agentIds.length > 0) {
        const agentInfos = await db
          .select({
            agentId: agents.agentId,
            name: agents.name,
            avatar: agents.avatar,
          })
          .from(agents)
          .where(sql`${agents.agentId} = any(${agentIds})`)
        agentMap = new Map(agentInfos.map((a) => [a.agentId, { name: a.name, avatar: a.avatar }]))
      }

      const items = heatRows.map((r) => {
        const info = agentMap.get(r.agentId)
        return {
          agentId: r.agentId,
          name: info?.name ?? '未知',
          avatar: info?.avatar ?? null,
          totalHits: r.totalHits,
          days: r.days,
          // 热度分数 = 总命中数 × ln(1 + 活跃天数) × 100 / 7
          heatScore: Math.round((r.totalHits * Math.log(1 + r.days) * 100) / 7),
        }
      })

      // 独立用户数（近似：从 agent_heat_stats 无法直接获取，返回 agent 数量近似）
      return reply.send(
        success({
          items,
          total: items.length,
          dateRange: { startDate: start, endDate: end },
          uniqueAgents: items.length,
        }),
      )
    },
  )

  // GET /statistics/agent-heat/:agentId - 单个 Agent 热度详情
  server.get(
    '/statistics/agent-heat/:agentId',
    {
      schema: {
        summary: '单个 Agent 热度详情',
        tags: ['statistics'],
        querystring: {
          type: 'object',
          properties: {
            startDate: { type: 'string' },
            endDate: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { agentId } = z.object({ agentId: z.string() }).parse(request.params)
      const { startDate, endDate } =
        agentHeatQuery.pick({ startDate: true, endDate: true }).safeParse(request.query).data ?? {}
      const end = endDate ?? new Date().toISOString().slice(0, 10)
      const start =
        startDate ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      // 按日期聚合该 Agent 的热度
      const dailyRows = await db
        .select({
          dateStr: agentHeatStats.dateStr,
          hitCount: agentHeatStats.hitCount,
        })
        .from(agentHeatStats)
        .where(
          and(
            eq(agentHeatStats.agentId, agentId),
            gte(agentHeatStats.dateStr, start),
            lte(agentHeatStats.dateStr, end),
          ),
        )
        .orderBy(agentHeatStats.dateStr)

      // Agent 基本信息
      const agentRows = await db
        .select({
          agentId: agents.agentId,
          name: agents.name,
          avatar: agents.avatar,
          usageCount: agents.usageCount,
          likeCount: agents.likeCount,
          shareCount: agents.shareCount,
        })
        .from(agents)
        .where(eq(agents.agentId, agentId))
        .limit(1)

      if (agentRows.length === 0) {
        return reply.status(404).send(error(404, 'Agent 不存在'))
      }

      const agent = agentRows[0]!
      const totalHits = dailyRows.reduce((sum, r) => sum + r.hitCount, 0)
      const days = dailyRows.length

      return reply.send(
        success({
          agentId: agent.agentId,
          name: agent.name,
          avatar: agent.avatar,
          usageCount: agent.usageCount,
          likeCount: agent.likeCount,
          shareCount: agent.shareCount,
          totalHits,
          days,
          heatScore: Math.round((totalHits * Math.log(1 + days) * 100) / 7),
          daily: dailyRows,
          dateRange: { startDate: start, endDate: end },
        }),
      )
    },
  )

  // ===========================================================================
  // P3-1: 聚合统计端点(admin 权限,3 个新端点)
  // 路径:-aggregated 后缀避免与现有 /statistics/exam 和 /statistics/content 冲突
  // ===========================================================================

  const dateRangeQuery = z.object({
    startDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    endDate: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  })

  const aggregatedResponseSchema = {
    200: {
      type: 'object' as const,
      properties: {
        code: { type: 'number' },
        message: { type: 'string' },
        data: { type: 'object', additionalProperties: true },
      },
    },
    400: {
      type: 'object' as const,
      properties: { code: { type: 'number' }, message: { type: 'string' } },
    },
    401: {
      type: 'object' as const,
      properties: { code: { type: 'number' }, message: { type: 'string' } },
    },
    403: {
      type: 'object' as const,
      properties: { code: { type: 'number' }, message: { type: 'string' } },
    },
  }

  // GET /statistics/exam-aggregated - 考试统计聚合(题目数/试卷数/答题次数/平均分/及格率)
  server.get(
    '/statistics/exam-aggregated',
    { preHandler: requireAdmin, schema: { response: aggregatedResponseSchema } },
    async (_request, reply) => {
      const [questionRows, paperRows, recordRows, passRows, avgRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(examQuestions),
        db.select({ count: sql<number>`count(*)::int` }).from(examPapers),
        db.select({ count: sql<number>`count(*)::int` }).from(examRecords),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(examRecords)
          .where(eq(examRecords.isPassed, true)),
        db
          .select({
            avg: sql<number>`coalesce(avg(${examRecords.score}::numeric), 0)::float`,
          })
          .from(examRecords),
      ])
      const recordTotal = recordRows[0]?.count ?? 0
      const passTotal = passRows[0]?.count ?? 0
      const statistics = {
        questionTotal: questionRows[0]?.count ?? 0,
        paperTotal: paperRows[0]?.count ?? 0,
        recordTotal,
        avgScore: Number((avgRows[0]?.avg ?? 0).toFixed(2)),
        passTotal,
        passRate: recordTotal > 0 ? Math.round((passTotal / recordTotal) * 10000) / 10000 : 0,
      }
      return reply.send(success({ statistics }))
    },
  )

  // GET /statistics/circle - 圈子统计聚合(动态数/评论数/点赞数/活跃用户)
  server.get(
    '/statistics/circle',
    { preHandler: requireAdmin, schema: { response: aggregatedResponseSchema } },
    async (request, reply) => {
      const parsed = dateRangeQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const [postRows, commentRows, likeRows, activeUserRows] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(circlePosts)
          .where(eq(circlePosts.status, 1)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(comments)
          .where(eq(comments.resourceType, 'post')),
        db
          .select({
            sum: sql<number>`coalesce(sum(${circlePosts.likeCount}), 0)::int`,
          })
          .from(circlePosts)
          .where(eq(circlePosts.status, 1)),
        db
          .select({
            count: sql<number>`count(distinct ${circlePosts.userId})::int`,
          })
          .from(circlePosts)
          .where(eq(circlePosts.status, 1)),
      ])
      const statistics = {
        postTotal: postRows[0]?.count ?? 0,
        commentTotal: commentRows[0]?.count ?? 0,
        likeTotal: likeRows[0]?.sum ?? 0,
        activeUserCount: activeUserRows[0]?.count ?? 0,
      }
      return reply.send(success({ statistics }))
    },
  )

  // GET /statistics/content-aggregated - 内容统计聚合(文章数/新闻数/资源数/浏览量)
  server.get(
    '/statistics/content-aggregated',
    { preHandler: requireAdmin, schema: { response: aggregatedResponseSchema } },
    async (_request, reply) => {
      const [articleRows, newsRows, resourceRows, newsViewRows, resourceViewRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(helpArticles),
        db.select({ count: sql<number>`count(*)::int` }).from(newsArticles),
        db.select({ count: sql<number>`count(*)::int` }).from(resources),
        db
          .select({
            sum: sql<number>`coalesce(sum(${newsArticles.viewCount}), 0)::int`,
          })
          .from(newsArticles),
        db
          .select({
            sum: sql<number>`coalesce(sum(${resources.viewCount}), 0)::int`,
          })
          .from(resources),
      ])
      const statistics = {
        articleTotal: articleRows[0]?.count ?? 0,
        newsTotal: newsRows[0]?.count ?? 0,
        resourceTotal: resourceRows[0]?.count ?? 0,
        newsViewSum: newsViewRows[0]?.sum ?? 0,
        resourceViewSum: resourceViewRows[0]?.sum ?? 0,
        viewSum: (newsViewRows[0]?.sum ?? 0) + (resourceViewRows[0]?.sum ?? 0),
      }
      return reply.send(success({ statistics }))
    },
  )
}

// =============================================================================
// 管理员路由（前缀 /api/admin，统计快照管理）
// =============================================================================

export const adminStatisticsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /statistics/snapshots - 快照列表
  server.get(
    '/statistics/snapshots',
    {
      schema: {
        summary: '统计快照列表',
        tags: ['statistics'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            type: { type: 'string', description: '快照类型筛选: overview/learn/exam/content' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = listSnapshotsQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findStatisticsSnapshots(parsed.data)
      return reply.send(success(result))
    },
  )

  // GET /statistics/snapshots/:id - 快照详情
  server.get(
    '/statistics/snapshots/:id',
    {
      schema: {
        summary: '快照详情',
        tags: ['statistics'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const snapshot = await findStatisticsSnapshotById(parsed.data.id)
      if (!snapshot) {
        return reply.status(404).send(error(404, '快照不存在'))
      }
      return reply.send(success({ snapshot }))
    },
  )

  // POST /statistics/snapshots - 创建快照
  // 支持两种模式：1) 传入 type+data 自定义；2) 仅传 type，自动采集当前统计。
  server.post(
    '/statistics/snapshots',
    {
      schema: {
        summary: '创建统计快照',
        tags: ['statistics'],
        body: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['overview', 'learn', 'exam', 'content'],
              description: '快照类型',
            },
            data: { type: 'object', description: '快照数据(可选，缺省则自动采集当前统计)' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = createSnapshotSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      // 若未提供 data，则按 type 自动采集当前统计
      let data = parsed.data.data
      if (!data || Object.keys(data).length === 0) {
        if (parsed.data.type === 'overview')
          data = (await getOverviewStatistics()) as unknown as Record<string, unknown>
        else if (parsed.data.type === 'learn')
          data = (await getLearnStatistics()) as unknown as Record<string, unknown>
        else if (parsed.data.type === 'exam')
          data = (await getExamStatistics()) as unknown as Record<string, unknown>
        else data = (await getContentStatistics()) as unknown as Record<string, unknown>
      }
      const snapshot = await createStatisticsSnapshot({
        type: parsed.data.type,
        data,
        createdBy: request.userId,
      })
      return reply.status(201).send(success({ snapshot }))
    },
  )

  // DELETE /statistics/snapshots/:id - 删除快照
  server.delete(
    '/statistics/snapshots/:id',
    {
      schema: {
        summary: '删除统计快照',
        tags: ['statistics'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findStatisticsSnapshotById(parsed.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '快照不存在'))
      }
      await deleteStatisticsSnapshot(parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    },
  )

  // ----- 扩展统计端点 -----

  // GET /statistics/message - 消息统计
  server.get('/statistics/message', async (_request, reply) => {
    const statistics = await getMessageStatistics()
    return reply.send(success({ statistics }))
  })

  // GET /statistics/live - 直播统计
  server.get('/statistics/live', async (_request, reply) => {
    const statistics = await getLiveStatistics()
    return reply.send(success({ statistics }))
  })

  // GET /statistics/point - 积分统计
  server.get('/statistics/point', async (_request, reply) => {
    const statistics = await getPointStatistics()
    return reply.send(success({ statistics }))
  })

  // GET /statistics/resource - 资源统计
  server.get('/statistics/resource', async (_request, reply) => {
    const statistics = await getResourceStatistics()
    return reply.send(success({ statistics }))
  })

  // GET /statistics/user-center - 用户中心统计
  server.get('/statistics/user-center', async (_request, reply) => {
    const statistics = await getUserCenterStatistics()
    return reply.send(success({ statistics }))
  })

  // GET /visit-tracking/visits - 访问明细列表
  server.get('/visit-tracking/visits', async (request, reply) => {
    const parsed = visitLogsQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findVisitLogList(parsed.data)
    return reply.send(success(result))
  })

  // POST /statistics/agent-heat/refresh - 手动触发热度统计刷新
  // 从 agents 表的 usageCount 同步到 agentHeatStats（按当天日期记录）
  server.post('/statistics/agent-heat/refresh', async (request, reply) => {
    const parsed = agentHeatRefreshSchema.safeParse(request.body)
    const dateStr = parsed.success
      ? (parsed.data.dateStr ?? new Date().toISOString().slice(0, 10))
      : new Date().toISOString().slice(0, 10)

    // 查询所有已发布的 Agent 当前 usage_count
    const agentRows = await db
      .select({
        agentId: agents.agentId,
        usageCount: agents.usageCount,
      })
      .from(agents)
      .where(eq(agents.status, 'published'))

    // 删除当天已有记录后重新写入（幂等）
    await db.delete(agentHeatStats).where(eq(agentHeatStats.dateStr, dateStr))

    if (agentRows.length > 0) {
      await db.insert(agentHeatStats).values(
        agentRows.map((a) => ({
          agentId: a.agentId,
          hitCount: a.usageCount,
          dateStr,
        })),
      )
    }

    return reply.send(
      success({
        refreshed: true,
        dateStr,
        agentCount: agentRows.length,
      }),
    )
  })
}
