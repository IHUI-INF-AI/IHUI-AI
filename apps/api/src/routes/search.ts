import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import {
  globalSearch,
  findSearchHistory,
  addSearchHistory,
  clearSearchHistory,
  deleteSearchHistory,
} from '../db/search-queries.js'
import {
  findHotWordList,
  createHotWord,
  updateHotWord,
  deleteHotWord,
} from '../db/misc-extended-queries.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

const ADMIN_ROLE_ID = 1

// =============================================================================
// Zod schemas
// =============================================================================

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, '关键词不能为空').max(255),
  type: z.preprocess(emptyToUndefined, z.enum(['user', 'project', 'file', 'all']).default('all')),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const suggestionsQuerySchema = z.object({
  q: z.string().trim().min(1, '关键词不能为空').max(255),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const createHotWordSchema = z.object({
  word: z.string().min(1, '热搜词不能为空').max(100),
  sort: z.number().int().min(0).optional(),
  status: z.string().max(20).optional(),
})

const updateHotWordSchema = z.object({
  word: z.string().min(1, '热搜词不能为空').max(100).optional(),
  sort: z.number().int().min(0).optional(),
  status: z.string().max(20).optional(),
})

// =============================================================================
// 鉴权辅助
// =============================================================================

/** 校验管理员权限，失败时写入响应并返回 false。 */
async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const roleId = request.jwtPayload?.roleId ?? 0
  if (roleId < ADMIN_ROLE_ID) {
    reply.status(403).send(error(403, '需要管理员权限'))
    return false
  }
  return true
}

// =============================================================================
// 路由
// =============================================================================

export const searchRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有 search 路由均需登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  })

  // GET /search - 全局搜索（user/project/file/all，跨表聚合）
  server.get(
    '/search',
    {
      schema: {
        summary: '全局搜索',
        tags: ['search'],
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string', description: '搜索关键词' },
            type: {
              type: 'string',
              enum: ['user', 'project', 'file', 'all'],
              description: '搜索类型(默认 all)',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              default: 20,
              description: '返回数量(1-50,默认 20)',
            },
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
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = searchQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { q, type, limit } = parsed.data
      const result = await globalSearch(request.userId!, q, type, limit)
      // 异步记录搜索历史，不阻塞响应
      setImmediate(() => {
        addSearchHistory({
          userId: request.userId!,
          query: q,
          filters: { type },
          resultsCount: result.total,
        }).catch(() => {
          /* 审计性写入，失败忽略 */
        })
      })
      return reply.send(success(result))
    },
  )

  // GET /search/suggestions - 搜索建议（基于搜索历史和热搜词聚合）
  server.get(
    '/search/suggestions',
    {
      schema: {
        summary: '搜索建议',
        tags: ['search'],
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string', description: '输入前缀' },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 20,
              default: 10,
              description: '返回数量(1-20,默认 10)',
            },
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
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = suggestionsQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { q, limit } = parsed.data
      // 从搜索历史中提取与输入前缀匹配的去重关键词
      const historyRows = await findSearchHistory(request.userId!, 100)
      const historyMatches = historyRows
        .filter((h) => h.query.toLowerCase().startsWith(q.toLowerCase()))
        .map((h) => h.query)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .slice(0, limit)
      // 补充热搜词
      const hotWords = await findHotWordList()
      const hotMatches = hotWords
        .filter((w) => w.word.toLowerCase().includes(q.toLowerCase()))
        .map((w) => w.word)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .filter((w) => !historyMatches.includes(w))
        .slice(0, limit - historyMatches.length)
      const suggestions = [...historyMatches, ...hotMatches]
      return reply.send(success({ q, suggestions }))
    },
  )

  // GET /search/history - 当前用户搜索历史
  server.get(
    '/search/history',
    {
      schema: {
        summary: '搜索历史',
        tags: ['search'],
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: '返回数量(1-100,默认 20)',
            },
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
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = historyQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const list = await findSearchHistory(request.userId!, parsed.data.limit)
      return reply.send(success({ list }))
    },
  )

  // DELETE /search/history - 清空搜索历史
  server.delete('/search/history', async (request, reply) => {
    const deletedCount = await clearSearchHistory(request.userId!)
    return reply.send(success({ deletedCount }))
  })

  // DELETE /search/history/:id - 删除单条搜索历史
  server.delete('/search/history/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const deleted = await deleteSearchHistory(parsed.data.id, request.userId!)
    if (!deleted) {
      return reply.status(404).send(error(404, '记录不存在'))
    }
    return reply.send(success({ id: parsed.data.id }))
  })

  // ===== 热搜词管理（管理员） =====

  // GET /search/hot-words - 热搜词列表
  server.get('/search/hot-words', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const list = await findHotWordList()
    return reply.send(success({ list }))
  })

  // POST /search/hot-words - 创建热搜词
  server.post('/search/hot-words', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const parsed = createHotWordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const hotWord = await createHotWord(parsed.data)
    return reply.status(201).send(success({ hotWord }))
  })

  // PUT /search/hot-words/:id - 更新热搜词
  server.put('/search/hot-words/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateHotWordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const hotWord = await updateHotWord(idParsed.data.id, parsed.data)
    if (!hotWord) {
      return reply.status(404).send(error(404, '热搜词不存在'))
    }
    return reply.send(success({ hotWord }))
  })

  // DELETE /search/hot-words/:id - 删除热搜词
  server.delete('/search/hot-words/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    await deleteHotWord(parsed.data.id)
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })
}
