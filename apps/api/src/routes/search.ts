import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import {
  globalSearch,
  findSearchHistory,
  addSearchHistory,
  clearSearchHistory,
  deleteSearchHistory,
  highlightSearchResult,
  getSearchFacets,
} from '../db/search-queries.js'
import {
  findHotWordList,
  createHotWord,
  updateHotWord,
  deleteHotWord,
} from '../db/misc-extended-queries.js'
import { searchContents } from '@ihui/database'
import { eq, sql, desc, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const boolQuery = z.preprocess((v) => v === 'true' || v === '1', z.boolean())

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, '关键词不能为空').max(255),
  type: z.preprocess(emptyToUndefined, z.enum(['user', 'project', 'file', 'all']).default('all')),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  highlight: boolQuery.default(false),
  facets: boolQuery.default(false),
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
            highlight: {
              type: 'boolean',
              default: false,
              description: '是否返回高亮字段 highlightedTitle/highlightedContent(默认 false)',
            },
            facets: {
              type: 'boolean',
              default: false,
              description: '是否返回 facets 聚合结果(默认 false)',
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
      const { q, type, limit, highlight, facets } = parsed.data
      const result = await globalSearch(request.userId!, q, type, limit)

      const data = highlight
        ? highlightSearchResult(result, q)
        : ({ ...result } as ReturnType<typeof highlightSearchResult>)

      if (facets) {
        data.facets = await getSearchFacets(request.userId!, q)
      }

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
      return reply.send(success(data))
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
    await requireAdmin(request, reply)
    if (reply.sent) return
    const list = await findHotWordList()
    return reply.send(success({ list }))
  })

  // POST /search/hot-words - 创建热搜词
  server.post('/search/hot-words', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createHotWordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const hotWord = await createHotWord(parsed.data)
    return reply.status(201).send(success({ hotWord }))
  })

  // PUT /search/hot-words/:id - 更新热搜词
  server.put('/search/hot-words/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
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
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    await deleteHotWord(parsed.data.id)
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })

  // ===== D 盘 search 微服务 P0 补齐端点（迁移自 cloud-learning-search-service） =====

  // GET /search/public-api/content - 公开内容搜索(查 search_contents 表)
  server.get('/search/public-api/content', async (request, reply) => {
    const q = z
      .object({
        keyword: z.string().min(1),
        topicType: z.enum(['article', 'news', 'question', 'resource', 'lesson']).optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, 'keyword 必填'))
    const offset = (q.data.page - 1) * q.data.pageSize
    const conditions = [sql`${searchContents.searchText} ILIKE ${'%' + q.data.keyword + '%'}`]
    if (q.data.topicType) conditions.push(eq(searchContents.topicType, q.data.topicType))
    const where = and(...conditions)
    const list = await db
      .select()
      .from(searchContents)
      .where(where)
      .orderBy(desc(searchContents.viewCount))
      .limit(q.data.pageSize)
      .offset(offset)
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(searchContents)
      .where(where)
    return reply.send(
      success({
        list,
        total: countRow?.count ?? 0,
        page: q.data.page,
        pageSize: q.data.pageSize,
        keyword: q.data.keyword,
      }),
    )
  })

  // POST /search/public-api/content - 创建内容索引(由 article/news service 反向同步调用)
  server.post('/search/public-api/content', async (request, reply) => {
    await authenticate(request)
    const body = z
      .object({
        topicId: z.string().uuid(),
        topicType: z.enum(['article', 'news', 'question', 'resource', 'lesson']),
        topicTitle: z.string().min(1).max(300),
        topicSummary: z.string().optional(),
        searchText: z.string().min(1),
        authorId: z.string().uuid().optional(),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db.insert(searchContents).values(body.data).returning()
    return reply.send(success(row))
  })

  // PUT /search/public-api/content - 更新内容索引
  server.put('/search/public-api/content', async (request, reply) => {
    await authenticate(request)
    const body = z
      .object({
        id: z.string().uuid(),
        topicTitle: z.string().min(1).max(300).optional(),
        topicSummary: z.string().optional(),
        searchText: z.string().min(1).optional(),
        viewCount: z.number().int().min(0).optional(),
        likeCount: z.number().int().min(0).optional(),
        commentCount: z.number().int().min(0).optional(),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, 'id 必填'))
    const { id, ...patch } = body.data
    const [row] = await db
      .update(searchContents)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(searchContents.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '内容索引不存在'))
    return reply.send(success(row))
  })

  // DELETE /search/public-api/content - 删除内容索引
  server.delete('/search/public-api/content', async (request, reply) => {
    await authenticate(request)
    const body = z
      .object({
        id: z.string().uuid().optional(),
        topicId: z.string().uuid().optional(),
        topicType: z.string().optional(),
      })
      .safeParse(request.body ?? request.query)
    if (!body.success || (!body.data.id && !body.data.topicId))
      return reply.status(400).send(error(400, 'id 或 topicId+topicType 必填'))
    const conditions = []
    if (body.data.id) conditions.push(eq(searchContents.id, body.data.id))
    if (body.data.topicId && body.data.topicType)
      conditions.push(
        and(
          eq(searchContents.topicId, body.data.topicId),
          eq(
            searchContents.topicType,
            body.data.topicType as 'article' | 'news' | 'question' | 'resource' | 'lesson',
          ),
        )!,
      )
    const deleted = await db
      .delete(searchContents)
      .where(conditions[0]!)
      .returning({ id: searchContents.id })
    return reply.send(success({ deleted: deleted.length, ids: deleted.map((d) => d.id) }))
  })
}
