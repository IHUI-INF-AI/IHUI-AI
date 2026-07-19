import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, ilike, desc, asc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tools, toolFavorites } from '@ihui/database'
import { requireAuth, requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { getToolRunner, ToolExecutorError } from '../services/clawdbot/tool-executor.js'
import { logger } from '../utils/logger.js'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  category: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  search: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
  sort: z.enum(['rating', 'favoriteCount', 'sortOrder', 'createdAt']).default('sortOrder'),
  order: z.enum(['asc', 'desc']).default('asc'),
})

const createToolSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(64),
  icon: z.string().max(512).optional(),
  url: z.string().max(512).optional(),
  rating: z.number().int().min(0).max(500).optional(),
  status: z.enum(['published', 'draft', 'offline']).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

const updateToolSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(64).optional(),
  icon: z.string().max(512).optional(),
  url: z.string().max(512).optional(),
  rating: z.number().int().min(0).max(500).optional(),
  status: z.enum(['published', 'draft', 'offline']).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

// =============================================================================
// 路由
// =============================================================================

const toolsRoutes: FastifyPluginAsync = async (server) => {
  // GET / — 工具列表（支持分类筛选/搜索/排序）
  server.get('/', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, category, search, sort, order } = parsed.data
    const conditions = [eq(tools.status, 'published')]
    if (category) conditions.push(eq(tools.category, category))
    if (search) conditions.push(ilike(tools.name, `%${search}%`))

    const sortColumn = tools[sort]
    const orderFn = order === 'desc' ? desc : asc
    const offset = (page - 1) * pageSize

    const list = await db
      .select()
      .from(tools)
      .where(and(...conditions))
      .orderBy(orderFn(sortColumn))
      .limit(pageSize)
      .offset(offset)

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tools)
      .where(and(...conditions))
    const total = countResult[0]?.count ?? 0

    return reply.send(success({ list, total, page, pageSize }))
  })

  // GET /:id — 工具详情
  server.get('/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [tool] = await db.select().from(tools).where(eq(tools.id, parsed.data.id)).limit(1)
    if (!tool) return reply.status(404).send(error(404, '工具不存在'))
    return reply.send(success({ tool }))
  })

  // POST / — 创建工具（admin）
  server.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createToolSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [tool] = await db.insert(tools).values(parsed.data).returning()
    return reply.status(201).send(success({ tool }))
  })

  // PATCH /:id — 更新工具（admin）
  server.patch('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateToolSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [tool] = await db
      .update(tools)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(tools.id, idParsed.data.id))
      .returning()
    if (!tool) return reply.status(404).send(error(404, '工具不存在'))
    return reply.send(success({ tool }))
  })

  // DELETE /:id — 删除工具（admin）
  server.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [tool] = await db.delete(tools).where(eq(tools.id, parsed.data.id)).returning()
    if (!tool) return reply.status(404).send(error(404, '工具不存在'))
    return reply.send(success({ ok: true }))
  })

  // POST /:id/favorite — 收藏工具（需登录）
  server.post('/:id/favorite', { preHandler: requireAuth }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    // 校验工具是否存在
    const [tool] = await db.select().from(tools).where(eq(tools.id, idParsed.data.id)).limit(1)
    if (!tool) return reply.status(404).send(error(404, '工具不存在'))
    // 幂等：已收藏则直接返回
    const [existing] = await db
      .select()
      .from(toolFavorites)
      .where(and(eq(toolFavorites.userId, userId), eq(toolFavorites.toolId, idParsed.data.id)))
      .limit(1)
    if (existing) return reply.send(success({ favorited: true }))
    await db.insert(toolFavorites).values({ userId, toolId: idParsed.data.id })
    // 收藏数 +1
    await db
      .update(tools)
      .set({ favoriteCount: sql`${tools.favoriteCount} + 1` })
      .where(eq(tools.id, idParsed.data.id))
    return reply.status(201).send(success({ favorited: true }))
  })

  // DELETE /:id/favorite — 取消收藏（需登录）
  server.delete('/:id/favorite', { preHandler: requireAuth }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const [deleted] = await db
      .delete(toolFavorites)
      .where(and(eq(toolFavorites.userId, userId), eq(toolFavorites.toolId, idParsed.data.id)))
      .returning()
    if (deleted) {
      // 收藏数 -1（不低于 0）
      await db
        .update(tools)
        .set({ favoriteCount: sql`GREATEST(${tools.favoriteCount} - 1, 0)` })
        .where(eq(tools.id, idParsed.data.id))
    }
    return reply.send(success({ favorited: false }))
  })

  // ===========================================================================
  // 调试端点（dry-run，无副作用，对应源 tools.py timeout/exception/log）
  // - 不调用真实业务工具，不调外部 API，不写 DB
  // - 仅测试 ToolRunner 的超时/异常机制和日志记录
  // ===========================================================================

  const debugTimeoutSchema = z.object({
    timeout: z.number().int().positive().max(60000).default(10000),
  })

  const debugExceptionSchema = z.object({
    errorType: z.enum(['client', 'server', 'request', 'other']),
  })

  const debugLogSchema = z.object({
    message: z.string().min(1).max(2000),
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  })

  const exceptionErrorMap = {
    client: { code: 'forbidden' as const, message: '模拟的客户端错误' },
    server: { code: 'failed' as const, message: '模拟的服务器错误' },
    request: { code: 'failed' as const, message: '模拟的请求错误' },
    other: { code: 'failed' as const, message: '模拟的一般错误' },
  }

  // POST /debug/timeout — 工具超时机制测试（dry-run）
  server.post('/debug/timeout', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = debugTimeoutSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { timeout } = parsed.data
    const runner = getToolRunner()
    const toolName = `__debug_timeout_${Date.now()}`
    runner.register(
      {
        name: toolName,
        description: 'debug timeout',
        category: 'debug',
        timeout,
        requiredPermissions: [],
      },
      async () => {
        await new Promise((r) => setTimeout(r, timeout * 2))
        return 'ok'
      },
    )
    try {
      const result = await runner.execute(
        toolName,
        {},
        {
          userId: 'debug',
          permissions: [],
        },
      )
      return reply.send(
        success({
          success: result.success,
          timeoutSet: timeout,
          elapsedTime: result.durationMs,
          message: result.timedOut ? `操作超时(${timeout}ms)` : '操作在超时前成功完成',
          errorType: result.timedOut ? 'timeout' : undefined,
        }),
      )
    } finally {
      runner.unregister(toolName)
    }
  })

  // POST /debug/exception — 工具异常处理测试（dry-run）
  server.post('/debug/exception', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = debugExceptionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { errorType } = parsed.data
    const err = exceptionErrorMap[errorType]
    const runner = getToolRunner()
    const toolName = `__debug_exception_${Date.now()}`
    runner.register(
      {
        name: toolName,
        description: 'debug exception',
        category: 'debug',
        timeout: 5000,
        requiredPermissions: [],
      },
      async () => {
        throw new ToolExecutorError(err.message, err.code)
      },
    )
    try {
      const result = await runner.execute(
        toolName,
        {},
        {
          userId: 'debug',
          permissions: [],
        },
      )
      return reply.send(
        success({
          errorType,
          success: result.success,
          message: result.error ?? '',
          details: err.message,
        }),
      )
    } finally {
      runner.unregister(toolName)
    }
  })

  // POST /debug/log — 日志级别测试（dry-run，仅记录日志）
  server.post('/debug/log', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = debugLogSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { message, level } = parsed.data
    logger[level](`[debug/log] ${message}`, { source: 'debug-endpoint' })
    return reply.send(
      success({
        success: true,
        level,
        message,
        timestamp: new Date().toISOString(),
      }),
    )
  })
}

export default toolsRoutes
