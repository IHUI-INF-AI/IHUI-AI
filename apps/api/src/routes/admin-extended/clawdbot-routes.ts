/**
 * Clawdbot 机器人/权限/会话管理路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/clawdbot
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, count } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { clawdbotBots, clawdbotPermissions, clawdbotSessions } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../../utils/response.js'
import { idParamSchema } from './_shared.js'

const createClawdbotBotSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  avatar: z.string().max(500).optional(),
  systemPrompt: z.string().optional(),
  model: z.string().max(100).optional(),
  temperature: z.string().max(10).optional(),
  maxTokens: z.number().int().optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
})
const updateClawdbotBotSchema = createClawdbotBotSchema.partial()

const bulkUpdateClawdbotBotsSchema = z.object({
  bots: z.array(updateClawdbotBotSchema.extend({ id: z.string().uuid() })),
})

const createClawdbotPermissionSchema = z.object({
  botId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  role: z.string().max(50).optional(),
  permissions: z.array(z.string()).optional(),
})

const clawdbotPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  botId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: z.string().max(20).optional(),
})

function parseClawdbotPagination(request: FastifyRequest, reply: FastifyReply) {
  const parsed = clawdbotPaginationSchema.safeParse(request.query)
  if (!parsed.success) {
    reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    return null
  }
  return parsed.data
}

export const clawdbotRoutes: FastifyPluginAsync = async (server) => {
  server.get(
    '/admin/clawdbot/analytics/summary',
    { preHandler: requireAdmin },
    async (_request, reply) => {
      const [botTotal, botActive, sessionTotal, permissionTotal] = await Promise.all([
        db.select({ count: count() }).from(clawdbotBots),
        db.select({ count: count() }).from(clawdbotBots).where(eq(clawdbotBots.isActive, true)),
        db.select({ count: count() }).from(clawdbotSessions),
        db.select({ count: count() }).from(clawdbotPermissions),
      ])
      return reply.send(
        success({
          botsTotal: botTotal[0]?.count ?? 0,
          botsActive: botActive[0]?.count ?? 0,
          sessionsTotal: sessionTotal[0]?.count ?? 0,
          permissionsTotal: permissionTotal[0]?.count ?? 0,
        }),
      )
    },
  )
  server.get('/admin/clawdbot/bots', { preHandler: requireAdmin }, async (request, reply) => {
    const q = parseClawdbotPagination(request, reply)
    if (!q) return
    const offset = (q.page - 1) * q.pageSize
    const [items, totalRows] = await Promise.all([
      db
        .select()
        .from(clawdbotBots)
        .orderBy(desc(clawdbotBots.createdAt))
        .limit(q.pageSize)
        .offset(offset),
      db.select({ count: count() }).from(clawdbotBots),
    ])
    return reply.send(
      success({ list: items, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })
  server.post('/admin/clawdbot/bots', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createClawdbotBotSchema, request.body)
    const [row] = await db.insert(clawdbotBots).values(body).returning()
    return reply.status(201).send(success(row))
  })
  server.put('/admin/clawdbot/bots', { preHandler: requireAdmin }, async (request, reply) => {
    const { bots } = parseOrThrow(bulkUpdateClawdbotBotsSchema, request.body)
    await db.transaction(async (tx) => {
      for (const b of bots) {
        await tx
          .update(clawdbotBots)
          .set({ ...b, updatedAt: new Date() })
          .where(eq(clawdbotBots.id, b.id))
      }
    })
    return reply.send(success({ updated: bots.length }))
  })
  server.put('/admin/clawdbot/bots/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateClawdbotBotSchema, request.body)
    const [row] = await db
      .update(clawdbotBots)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(clawdbotBots.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '机器人不存在'))
    return reply.send(success(row))
  })
  server.delete(
    '/admin/clawdbot/bots/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const [row] = await db.delete(clawdbotBots).where(eq(clawdbotBots.id, id)).returning()
      if (!row) return reply.status(404).send(error(404, '机器人不存在'))
      return reply.send(success({ id, deleted: true }))
    },
  )
  server.get('/admin/clawdbot/stats', { preHandler: requireAdmin }, async (_request, reply) => {
    const [botTotal, botActive, sessionTotal, permissionTotal] = await Promise.all([
      db.select({ count: count() }).from(clawdbotBots),
      db.select({ count: count() }).from(clawdbotBots).where(eq(clawdbotBots.isActive, true)),
      db.select({ count: count() }).from(clawdbotSessions),
      db.select({ count: count() }).from(clawdbotPermissions),
    ])
    return reply.send(
      success({
        botsTotal: botTotal[0]?.count ?? 0,
        botsActive: botActive[0]?.count ?? 0,
        sessionsTotal: sessionTotal[0]?.count ?? 0,
        permissionsTotal: permissionTotal[0]?.count ?? 0,
      }),
    )
  })
  server.get(
    '/admin/clawdbot/permissions',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const q = parseClawdbotPagination(request, reply)
      if (!q) return
      const offset = (q.page - 1) * q.pageSize
      const where = q.botId ? eq(clawdbotPermissions.botId, q.botId) : undefined
      const [items, totalRows] = await Promise.all([
        db
          .select()
          .from(clawdbotPermissions)
          .where(where)
          .orderBy(desc(clawdbotPermissions.createdAt))
          .limit(q.pageSize)
          .offset(offset),
        db.select({ count: count() }).from(clawdbotPermissions).where(where),
      ])
      return reply.send(
        success({
          list: items,
          total: totalRows[0]?.count ?? 0,
          page: q.page,
          pageSize: q.pageSize,
        }),
      )
    },
  )
  server.post(
    '/admin/clawdbot/permissions',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = parseOrThrow(createClawdbotPermissionSchema, request.body)
      const [row] = await db.insert(clawdbotPermissions).values(body).returning()
      return reply.status(201).send(success(row))
    },
  )
  server.delete(
    '/admin/clawdbot/permissions/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const [row] = await db
        .delete(clawdbotPermissions)
        .where(eq(clawdbotPermissions.id, id))
        .returning()
      if (!row) return reply.status(404).send(error(404, '权限不存在'))
      return reply.send(success({ id, deleted: true }))
    },
  )
  server.get('/admin/clawdbot/sessions', { preHandler: requireAdmin }, async (request, reply) => {
    const q = parseClawdbotPagination(request, reply)
    if (!q) return
    const offset = (q.page - 1) * q.pageSize
    const filters = [
      q.botId ? eq(clawdbotSessions.botId, q.botId) : undefined,
      q.userId ? eq(clawdbotSessions.userId, q.userId) : undefined,
      q.status ? eq(clawdbotSessions.status, q.status) : undefined,
    ].filter((f) => f !== undefined)
    const where = filters.length > 0 ? and(...filters) : undefined
    const [items, totalRows] = await Promise.all([
      db
        .select()
        .from(clawdbotSessions)
        .where(where)
        .orderBy(desc(clawdbotSessions.createdAt))
        .limit(q.pageSize)
        .offset(offset),
      db.select({ count: count() }).from(clawdbotSessions).where(where),
    ])
    return reply.send(
      success({ list: items, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })
  server.get(
    '/admin/clawdbot/sessions/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const [row] = await db
        .select()
        .from(clawdbotSessions)
        .where(eq(clawdbotSessions.id, id))
        .limit(1)
      if (!row) return reply.status(404).send(error(404, '会话不存在'))
      return reply.send(success(row))
    },
  )
}
