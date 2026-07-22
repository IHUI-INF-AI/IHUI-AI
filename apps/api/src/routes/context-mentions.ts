/**
 * Context Mentions 路由 — 多维 @ 提及检索后端入口。
 *
 * 端点(注册前缀 /api/context):
 * - GET /mentions?q=&type=file|database|symbol|folder|web  统一检索
 * - GET /database/tables?q=                                 数据库表清单
 * - GET /database/schema/:table                             指定表列定义
 * - GET /symbols?q=                                         符号语义搜索
 * - POST /enrich                                            @ 提及 + RAG 两层集成(2026-07-22 立)
 * - GET /sources                                            可用上下文源类型 + 预算分配(2026-07-22 立)
 *
 * 鉴权:JWT(复用 packages/auth authenticate)
 * 校验:Zod(query schema)
 * 响应:{ code: 0, message: 'success', data: ... }
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { contextEngineService } from '../services/context-engine-service.js'

const mentionQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().max(255).optional()),
  type: z.enum(['file', 'database', 'symbol', 'folder', 'web']).default('file'),
  workspacePath: z.preprocess(emptyToUndefined, z.string().max(512).optional()),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

const tableQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().max(255).optional()),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const symbolQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().min(1).max(255)),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

/** POST /enrich 请求体 schema(2026-07-22 立,2026-07-22 深化加 userId) */
const enrichBodySchema = z.object({
  userMessage: z.string().max(8000).default(''),
  conversationId: z.string().max(255).default(''),
  mentions: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(['file', 'database', 'symbol', 'folder', 'web']),
        label: z.string(),
        detail: z.string().optional(),
        insertText: z.string(),
        meta: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .default([]),
  messages: z
    .array(
      z.object({
        role: z.string(),
        content: z.string(),
      }),
    )
    .optional(),
  totalBudget: z.coerce.number().int().min(500).max(32000).default(8000),
  userId: z.string().max(255).default(''),
})

/** GET /visualization + GET /memory + GET /compression-stats 查询参数 schema(2026-07-22 深化立) */
const visualizationQuerySchema = z.object({
  conversationId: z.preprocess(emptyToUndefined, z.string().max(255)).default(''),
  userId: z.preprocess(emptyToUndefined, z.string().max(255)).default(''),
})

const memoryQuerySchema = z.object({
  conversationId: z.preprocess(emptyToUndefined, z.string().max(255)).default(''),
  userId: z.preprocess(emptyToUndefined, z.string().max(255)).default(''),
})

const compressionStatsQuerySchema = z.object({
  userId: z.preprocess(emptyToUndefined, z.string().max(255)).default(''),
})

const clearMemoryQuerySchema = z.object({
  conversationId: z.preprocess(emptyToUndefined, z.string().max(255)).default(''),
})

/** POST /visualization/track 请求体 schema(2026-07-22 深化立) */
const trackVisualizationBodySchema = z.object({
  conversationId: z.string().max(255),
  totalTokens: z.coerce.number().int().min(0).default(0),
  historyTokens: z.coerce.number().int().min(0).default(0),
  codebaseTokens: z.coerce.number().int().min(0).default(0),
  mentionTokens: z.coerce.number().int().min(0).default(0),
  webTokens: z.coerce.number().int().min(0).default(0),
  databaseTokens: z.coerce.number().int().min(0).default(0),
})

// === Context Engineering 超越创新 schema(2026-07-23 立) ===

/** POST /predict 请求体 schema */
const predictBodySchema = z.object({
  currentMessage: z.string().max(8000).default(''),
  conversationHistory: z
    .array(z.object({ role: z.string(), content: z.string() }))
    .default([]),
  conversationId: z.string().max(255).default(''),
  taskType: z.string().max(50).default('default'),
  userId: z.string().max(255).default(''),
})

/** GET /prefetch 查询参数 schema */
const prefetchQuerySchema = z.object({
  conversationId: z.preprocess(emptyToUndefined, z.string().max(255)).default(''),
  target: z.preprocess(emptyToUndefined, z.string().max(512)).default(''),
})

/** POST /knowledge-graph/build 请求体 schema */
const buildGraphBodySchema = z.object({
  projectId: z.string().min(1).max(255),
  workspacePath: z.string().max(512).default(''),
})

/** GET /knowledge-graph 查询参数 schema */
const knowledgeGraphQuerySchema = z.object({
  projectId: z.preprocess(emptyToUndefined, z.string().max(255)).default(''),
  node_type: z.preprocess(emptyToUndefined, z.string().max(100)).default(''),
  edge_type: z.preprocess(emptyToUndefined, z.string().max(100)).default(''),
})

/** GET /graph-retrieve 查询参数 schema */
const graphRetrieveQuerySchema = z.object({
  query: z.preprocess(emptyToUndefined, z.string().max(1000)).default(''),
  projectId: z.preprocess(emptyToUndefined, z.string().max(255)).default(''),
  userId: z.preprocess(emptyToUndefined, z.string().max(255)).default(''),
  depth: z.coerce.number().int().min(1).max(2).default(2),
})

/** POST /quality-score 请求体 schema */
const qualityScoreBodySchema = z.object({
  conversationId: z.string().max(255).default(''),
  taskType: z.string().max(50).default('default'),
  taskQuery: z.string().max(8000).default(''),
  userId: z.string().max(255).default(''),
  currentContext: z.array(z.record(z.string(), z.unknown())).optional(),
})

/** POST /smart-compact 请求体 schema */
const smartCompactBodySchema = z.object({
  messages: z.array(z.object({ role: z.string(), content: z.string() })).min(1),
  preserveKeywords: z.array(z.string().max(200)).optional(),
  conversationId: z.string().max(255).default(''),
  userId: z.string().max(255).default(''),
})

/** POST /cross-project/save 请求体 schema */
const crossProjectSaveBodySchema = z.object({
  userId: z.string().min(1).max(255),
  summary: z.string().min(1).max(500),
  sourceProject: z.string().min(1).max(255),
  tags: z.array(z.string().max(100)).optional(),
  detail: z.string().max(2000).default(''),
})

/** GET /cross-project/search 查询参数 schema */
const crossProjectSearchQuerySchema = z.object({
  userId: z.preprocess(emptyToUndefined, z.string().max(255)).default(''),
  q: z.preprocess(emptyToUndefined, z.string().max(1000)).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

/** DELETE /cross-project/:id 查询参数 schema */
const crossProjectDeleteQuerySchema = z.object({
  userId: z.preprocess(emptyToUndefined, z.string().max(255)).default(''),
})

export const contextMentionRoutes: FastifyPluginAsync = async (server) => {
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  // GET /mentions — 统一检索入口(按 type 分发)
  server.get('/mentions', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = mentionQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { q, type, workspacePath, limit } = parsed.data
    try {
      const mentions = await contextEngineService.search({
        query: q ?? '',
        type,
        userId: request.userId,
        workspacePath,
        limit,
      })
      return reply.send(success({ mentions, total: mentions.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '检索失败'))
    }
  })

  // GET /database/tables — 数据库表清单
  server.get('/database/tables', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = tableQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { q, limit } = parsed.data
    try {
      const mentions = await contextEngineService.searchDatabaseTables(q ?? '', limit)
      return reply.send(success({ mentions, total: mentions.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '数据库表查询失败'))
    }
  })

  // GET /database/schema/:table — 指定表列定义
  server.get('/database/schema/:table', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { table } = request.params as { table: string }
    if (!table) {
      return reply.status(400).send(error(400, '表名不能为空'))
    }
    try {
      const schema = await contextEngineService.getTableSchema(table)
      return reply.send(success(schema))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, 'Schema 查询失败'))
    }
  })

  // GET /symbols — 符号语义搜索
  server.get('/symbols', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = symbolQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { q, limit } = parsed.data
    try {
      const symbols = await contextEngineService.searchSymbols(q, limit)
      return reply.send(success({ symbols, total: symbols.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '符号检索失败'))
    }
  })

  // POST /enrich — @ 提及结果 + RAG 检索两层集成(2026-07-22 立,2026-07-22 深化加 userId)
  // 转发到 context-engine-service.enrich,委托 ai-service /api/context/enrich
  // 降级:ai-service 不可用时仅返回 @ 提及内容(无 RAG 检索)
  server.post('/enrich', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = enrichBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { userMessage, conversationId, mentions, messages, totalBudget, userId } = parsed.data
    try {
      const enriched = await contextEngineService.enrich({
        userMessage,
        conversationId,
        mentions,
        messages,
        totalBudget,
        // 优先使用请求体 userId,为空时回退到 JWT 解析的 request.userId
        userId: userId || request.userId,
      })
      return reply.send(success(enriched))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '上下文增强失败'))
    }
  })

  // GET /sources — 返回可用上下文源类型 + 预算分配(2026-07-22 立)
  // 转发到 context-engine-service.getSources,委托 ai-service /api/context/sources
  // 降级:ai-service 不可用时返回内置默认值
  server.get('/sources', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    try {
      const data = await contextEngineService.getSources()
      return reply.send(success(data))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '源类型查询失败'))
    }
  })

  // POST /visualization/track — 记录当前会话 token 分布(2026-07-22 深化立)
  // 前端定期调用,转发到 ai-service POST /api/context/visualization/track
  // 数据存 Redis list "context:viz:{conversationId}"(LPUSH + LTRIM 100 条)
  server.post('/visualization/track', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = trackVisualizationBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const recorded = await contextEngineService.trackVisualization(parsed.data)
      return reply.send(success({ recorded }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '可视化记录失败'))
    }
  })

  // GET /visualization — 返回可视化数据(2026-07-22 深化立)
  // 转发到 ai-service GET /api/context/visualization
  // 返回饼图 + 历史趋势 + 压缩事件
  server.get('/visualization', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = visualizationQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { conversationId, userId } = parsed.data
    try {
      const data = await contextEngineService.getVisualization(
        conversationId,
        userId || request.userId,
      )
      return reply.send(success(data))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '可视化查询失败'))
    }
  })

  // GET /compression-stats — 返回压缩统计(2026-07-22 深化立)
  // 转发到 ai-service GET /api/context/compression-stats
  // 返回平均压缩比、平均质量分、最近 10 次压缩详情
  server.get('/compression-stats', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = compressionStatsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { userId } = parsed.data
    try {
      const data = await contextEngineService.getCompressionStats(userId || request.userId)
      return reply.send(success(data))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '压缩统计查询失败'))
    }
  })

  // GET /memory — 返回会话记忆(summary + 用户偏好,2026-07-22 深化立)
  // 转发到 ai-service GET /api/context/memory
  // 返回上次压缩的 summary + 用户长期偏好(常访问的文件/符号)
  server.get('/memory', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = memoryQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { conversationId, userId } = parsed.data
    try {
      const data = await contextEngineService.getSessionMemory(
        conversationId,
        userId || request.userId,
      )
      return reply.send(success(data))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '会话记忆查询失败'))
    }
  })

  // DELETE /memory — 清除会话记忆(2026-07-22 深化立)
  // 转发到 ai-service DELETE /api/context/memory
  // 删除 Redis hash "context:summary:{conversationId}"
  server.delete('/memory', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = clearMemoryQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { conversationId } = parsed.data
    try {
      const cleared = await contextEngineService.clearSessionMemory(conversationId)
      return reply.send(success({ cleared }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '会话记忆清除失败'))
    }
  })

  // === Context Engineering 超越创新路由(2026-07-23 立) ===

  // POST /predict — 上下文预测 + 异步预取
  // 转发到 ai-service POST /api/context/predict
  // LLM 预测下一步需要的上下文 + 异步预取到 Redis cache(TTL 5 分钟)
  server.post('/predict', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = predictBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { currentMessage, conversationHistory, conversationId, taskType, userId } = parsed.data
    try {
      const result = await contextEngineService.predict({
        currentMessage,
        conversationHistory,
        conversationId,
        taskType,
        userId: userId || request.userId,
      })
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '上下文预测失败'))
    }
  })

  // GET /prefetch — 读取预取 cache
  // 转发到 ai-service GET /api/context/prefetch
  server.get('/prefetch', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = prefetchQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { conversationId, target } = parsed.data
    try {
      const data = await contextEngineService.getPrefetched(conversationId, target)
      return reply.send(success({ items: data, total: data.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '预取上下文读取失败'))
    }
  })

  // POST /knowledge-graph/build — 构建知识图谱
  // 转发到 ai-service POST /api/context/knowledge-graph/build
  server.post('/knowledge-graph/build', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = buildGraphBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { projectId, workspacePath } = parsed.data
    try {
      const data = await contextEngineService.buildKnowledgeGraph(projectId, workspacePath)
      return reply.send(success(data))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '知识图谱构建失败'))
    }
  })

  // GET /knowledge-graph — 获取知识图谱数据(可视化)
  // 转发到 ai-service GET /api/context/knowledge-graph
  server.get('/knowledge-graph', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = knowledgeGraphQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { projectId, node_type, edge_type } = parsed.data
    try {
      const data = await contextEngineService.getKnowledgeGraph(
        projectId,
        node_type,
        edge_type,
      )
      return reply.send(success(data))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '知识图谱查询失败'))
    }
  })

  // GET /graph-retrieve — 图检索
  // 转发到 ai-service GET /api/context/graph-retrieve
  server.get('/graph-retrieve', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = graphRetrieveQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { query, projectId, userId, depth } = parsed.data
    try {
      const data = await contextEngineService.graphRetrieve(
        query,
        projectId,
        userId || request.userId,
        depth,
      )
      return reply.send(success({ items: data, total: data.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '图检索失败'))
    }
  })

  // POST /quality-score — 上下文质量评分
  // 转发到 ai-service POST /api/context/quality-score
  server.post('/quality-score', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = qualityScoreBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { conversationId, taskType, taskQuery, userId, currentContext } = parsed.data
    try {
      const data = await contextEngineService.getQualityScore({
        conversationId,
        taskType,
        taskQuery,
        userId: userId || request.userId,
        currentContext,
      })
      return reply.send(success(data))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '质量评分失败'))
    }
  })

  // POST /smart-compact — 智能压缩
  // 转发到 ai-service POST /api/context/smart-compact
  server.post('/smart-compact', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = smartCompactBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { messages, preserveKeywords, conversationId, userId } = parsed.data
    try {
      const data = await contextEngineService.smartCompact({
        messages,
        preserveKeywords,
        conversationId,
        userId: userId || request.userId,
      })
      return reply.send(success(data))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '智能压缩失败'))
    }
  })

  // POST /cross-project/save — 保存跨项目经验
  // 转发到 ai-service POST /api/context/cross-project/save
  server.post('/cross-project/save', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = crossProjectSaveBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { summary, sourceProject, tags, detail } = parsed.data
    try {
      const data = await contextEngineService.saveCrossProjectExperience({
        userId: request.userId,
        summary,
        sourceProject,
        tags,
        detail,
      })
      return reply.send(success(data))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '跨项目经验保存失败'))
    }
  })

  // GET /cross-project/search — 搜索跨项目经验
  // 转发到 ai-service GET /api/context/cross-project/search
  server.get('/cross-project/search', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = crossProjectSearchQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { q, limit } = parsed.data
    try {
      const data = await contextEngineService.searchCrossProjectExperiences(
        request.userId,
        q,
        limit,
      )
      return reply.send(success({ items: data, total: data.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '跨项目经验搜索失败'))
    }
  })

  // DELETE /cross-project/:id — 删除跨项目经验
  // 转发到 ai-service DELETE /api/context/cross-project/:id
  server.delete('/cross-project/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '经验 ID 不能为空'))
    }
    const parsed = crossProjectDeleteQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const deleted = await contextEngineService.deleteCrossProjectExperience(
        request.userId,
        id,
      )
      return reply.send(success({ deleted }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '跨项目经验删除失败'))
    }
  })
}

export default contextMentionRoutes
