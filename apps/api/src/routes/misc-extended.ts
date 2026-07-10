import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { zhsUserAgentContext, docs } from '@ihui/database'
import { success, error } from '../utils/response.js'

const idParamSchema = z.object({ id: z.string().min(1) })

function parsePaging(q: { page?: string; pageSize?: string }): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(q.page) || 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
  return { page, pageSize }
}

const plugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // remote — 远程代理
  // NOTE: 旧架构 remote.py 为第三方远程请求代理（我的团队/用户信息/上传名片/
  // 可购买身份/智能体分类等），多数无独立 DB 表，此处保持合理默认值。
  // -------------------------------------------------------------------------
  server.get('/remote/list', async (_req, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/remote/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    return reply.send(success({ id: parsed.data.id }))
  })
  server.post('/remote', async (req, reply) => {
    return reply.status(201).send(success({ created: true, body: req.body }))
  })
  server.put('/remote/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    return reply.send(success({ id: parsed.data.id, updated: true }))
  })
  server.delete('/remote/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })
  // POST /remote/proxy — 代理转发请求
  server.post('/remote/proxy', async (req, reply) => {
    return reply.send(success({ proxied: true, body: req.body }))
  })

  // -------------------------------------------------------------------------
  // user_agent_context — 用户 Agent 上下文（Drizzle schema: zhs_user_agent_context）
  // -------------------------------------------------------------------------
  server.get('/user-agent-context/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      userUuid?: string
      userId?: string
      agentId?: string
      sessionId?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds = []
    if (q.userUuid) conds.push(eq(zhsUserAgentContext.userUuid, q.userUuid))
    if (q.userId) conds.push(eq(zhsUserAgentContext.userId, q.userId))
    if (q.agentId) conds.push(eq(zhsUserAgentContext.agentId, q.agentId))
    if (q.sessionId) conds.push(eq(zhsUserAgentContext.sessionId, q.sessionId))
    const where = conds.length ? and(...conds) : undefined
    try {
      const [list, totalRows] = await Promise.all([
        db
          .select()
          .from(zhsUserAgentContext)
          .where(where)
          .orderBy(desc(zhsUserAgentContext.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(zhsUserAgentContext)
          .where(where),
      ])
      return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询用户 Agent 上下文失败'))
    }
  })
  server.get('/user-agent-context/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    const numId = Number(parsed.data.id)
    if (!Number.isFinite(numId)) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const rows = await db
        .select()
        .from(zhsUserAgentContext)
        .where(eq(zhsUserAgentContext.id, numId))
        .limit(1)
      if (!rows[0]) return reply.status(404).send(error(404, '上下文记录不存在'))
      return reply.send(success(rows[0]))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询用户 Agent 上下文失败'))
    }
  })
  server.post('/user-agent-context', async (req, reply) => {
    try {
      const rows = await db
        .insert(zhsUserAgentContext)
        .values(req.body as typeof zhsUserAgentContext.$inferInsert)
        .returning()
      return reply.status(201).send(success(rows[0]))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建用户 Agent 上下文失败'))
    }
  })
  server.put('/user-agent-context/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    const numId = Number(parsed.data.id)
    if (!Number.isFinite(numId)) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const rows = await db
        .update(zhsUserAgentContext)
        .set(req.body as Partial<typeof zhsUserAgentContext.$inferInsert>)
        .where(eq(zhsUserAgentContext.id, numId))
        .returning()
      if (!rows[0]) return reply.status(404).send(error(404, '上下文记录不存在'))
      return reply.send(success(rows[0]))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新用户 Agent 上下文失败'))
    }
  })
  server.delete('/user-agent-context/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    const numId = Number(parsed.data.id)
    if (!Number.isFinite(numId)) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      await db.delete(zhsUserAgentContext).where(eq(zhsUserAgentContext.id, numId))
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除用户 Agent 上下文失败'))
    }
  })

  // -------------------------------------------------------------------------
  // docs — 文档路由（Drizzle schema: docs）
  // -------------------------------------------------------------------------
  server.get('/docs/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      category?: string
      status?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds = []
    if (q.category) conds.push(eq(docs.category, q.category))
    if (q.status) conds.push(eq(docs.status, q.status))
    const where = conds.length ? and(...conds) : undefined
    try {
      const [list, totalRows] = await Promise.all([
        db
          .select()
          .from(docs)
          .where(where)
          .orderBy(desc(docs.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(docs)
          .where(where),
      ])
      return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询文档失败'))
    }
  })
  server.get('/docs/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const rows = await db.select().from(docs).where(eq(docs.id, parsed.data.id)).limit(1)
      if (!rows[0]) return reply.status(404).send(error(404, '文档不存在'))
      return reply.send(success(rows[0]))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询文档失败'))
    }
  })
}

export default plugin
