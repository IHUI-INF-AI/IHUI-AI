import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { success, error } from '../utils/response.js'
import { requireAuth } from '../plugins/require-permission.js'

/**
 * 资源上下文管理接口(7 端点)
 * 管理用户上传的文件/知识库/URL 等资源,绑定到会话供 AI 引用。
 *
 * 当前数据库无 resource_context 表,返回空数组/空对象(不新建表,不修改 schema)。
 * 缺表记录:.trae-cn/tmp/p0-5-db-needed.txt
 *
 * 路由使用绝对路径字面量注册(无 prefix),与旧前端 apiClient 路径直接对齐。
 */
const plugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // 1. GET /api/resource-context/list — 资源上下文列表
  // -------------------------------------------------------------------------
  const listQuery = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
    type: z.string().optional(), // file | knowledge | url | text
    keyword: z.string().optional(),
  })

  server.get(
    '/api/resource-context/list',
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = listQuery.safeParse(req.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      // 无 resource_context 表,返回空列表
      return reply.send(
        success({
          list: [],
          total: 0,
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
        }),
      )
    },
  )

  // -------------------------------------------------------------------------
  // 2. POST /api/resource-context/create — 创建资源上下文
  // -------------------------------------------------------------------------
  const createBody = z.object({
    name: z.string().min(1).max(200),
    type: z.enum(['file', 'knowledge', 'url', 'text']).default('file'),
    url: z.string().max(2000).optional(),
    content: z.string().optional(),
    fileId: z.string().uuid().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })

  server.post(
    '/api/resource-context/create',
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = createBody.safeParse(req.body ?? {})
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const userId = req.userId
      if (!userId) {
        return reply.status(401).send(error(401, '需要登录后创建'))
      }
      // 无 resource_context 表,返回 mock 数据(含生成的 ID,前端可临时使用)
      const now = new Date()
      return reply.status(201).send(
        success({
          id: randomUUID(),
          ...parsed.data,
          userId,
          createdAt: now,
          updatedAt: now,
          persisted: false, // 标识未持久化(无表)
        }),
      )
    },
  )

  // -------------------------------------------------------------------------
  // 3. GET /api/resource-context/:id — 资源上下文详情
  // -------------------------------------------------------------------------
  const idParam = z.object({ id: z.string().min(1) })

  server.get(
    '/api/resource-context/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = idParam.safeParse(req.params)
      if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
      // 无表,所有 ID 查询返回 404
      return reply.status(404).send(error(404, '资源上下文不存在'))
    },
  )

  // -------------------------------------------------------------------------
  // 4. PUT /api/resource-context/:id — 更新资源上下文
  // -------------------------------------------------------------------------
  const updateBody = z.object({
    name: z.string().min(1).max(200).optional(),
    type: z.enum(['file', 'knowledge', 'url', 'text']).optional(),
    url: z.string().max(2000).optional(),
    content: z.string().optional(),
    fileId: z.string().uuid().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })

  server.put(
    '/api/resource-context/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const paramParsed = idParam.safeParse(req.params)
      if (!paramParsed.success) return reply.status(400).send(error(400, '无效的 ID'))
      const bodyParsed = updateBody.safeParse(req.body ?? {})
      if (!bodyParsed.success) {
        return reply
          .status(400)
          .send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
      }
      // 无表,返回 404
      return reply.status(404).send(error(404, '资源上下文不存在'))
    },
  )

  // -------------------------------------------------------------------------
  // 5. DELETE /api/resource-context/:id — 删除资源上下文
  // -------------------------------------------------------------------------
  server.delete(
    '/api/resource-context/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = idParam.safeParse(req.params)
      if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
      // 无表,返回 404
      return reply.status(404).send(error(404, '资源上下文不存在'))
    },
  )

  // -------------------------------------------------------------------------
  // 6. POST /api/resource-context/bind — 绑定资源到会话/agent
  // -------------------------------------------------------------------------
  const bindBody = z.object({
    resourceContextId: z.string().min(1),
    sessionId: z.string().min(1).optional(),
    agentId: z.string().min(1).optional(),
  })

  server.post(
    '/api/resource-context/bind',
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = bindBody.safeParse(req.body ?? {})
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      // 无表,返回未绑定
      return reply.send(
        success({
          bound: false,
          resourceContextId: parsed.data.resourceContextId,
          sessionId: parsed.data.sessionId ?? null,
          agentId: parsed.data.agentId ?? null,
        }),
      )
    },
  )

  // -------------------------------------------------------------------------
  // 7. GET /api/resource-context/session/:sessionId — 按会话查询资源上下文
  // -------------------------------------------------------------------------
  const sessionIdParam = z.object({ sessionId: z.string().min(1) })

  server.get(
    '/api/resource-context/session/:sessionId',
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = sessionIdParam.safeParse(req.params)
      if (!parsed.success) return reply.status(400).send(error(400, '无效的 sessionId'))
      // 无表,返回空列表
      return reply.send(success({ list: [] }))
    },
  )
}

export default plugin
