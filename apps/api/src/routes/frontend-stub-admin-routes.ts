/**
 * 前端 admin 模块缺失路由桩。
 * 来源：api-routes-missing.json 中未匹配到后端路由的调用。
 * 策略：统一返回空列表/空对象/操作成功，避免前端 404。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { eq, and, desc, count } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  agentRule,
  productIdentities,
  eduMemberLevels,
  zhsUserPlatform,
  zhsUserAgentAudio,
  themes,
  themeColors,
  themeFonts,
  themeAssets,
  themePresets,
  agentTasks,
  clawdbotBots,
  clawdbotPermissions,
  clawdbotSessions,
  users,
  eduOrders,
} from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../utils/response.js'
import { createComment, findTicketById } from '../db/customer-service-queries.js'

const idParamSchema = z.object({ id: z.string().min(1) })

const createAgentRuleSchema = z.object({
  agentId: z.string().min(1),
  ruleName: z.string().min(1),
  ruleCode: z.string().min(1),
  ruleType: z.string().max(32).optional(),
  priority: z.number().int().optional(),
  status: z.number().int().optional(),
  description: z.string().max(255).optional(),
})
const updateAgentRuleSchema = createAgentRuleSchema.partial()

const createProductIdentitySchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(64),
  type: z.string().min(1).max(32),
  value: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.string().max(20).optional(),
})
const updateProductIdentitySchema = createProductIdentitySchema.partial()

const createMemberLevelSchema = z.object({
  name: z.string().min(1).max(100),
  growthValue: z.number().int().optional(),
  discount: z.string().optional(),
  sort: z.number().int().optional(),
})
const updateMemberLevelSchema = createMemberLevelSchema.partial()

const createUserPlatformSchema = z.object({
  userUuid: z.string().min(1),
  platformId: z.coerce.number().int(),
  status: z.number().int().optional(),
})
const updateUserPlatformSchema = createUserPlatformSchema.partial()

const updateUserSchema = z
  .object({
    nickname: z.string().min(1).max(64).optional(),
    avatar: z.string().max(500).optional(),
    bio: z.string().max(500).optional(),
    gender: z.number().int().min(0).max(2).optional(),
    birthday: z.string().optional(),
    roleId: z.number().int().min(0).max(10).optional(),
    deptId: z.number().int().optional(),
    status: z.number().int().min(0).max(3).optional(),
    isVip: z.number().int().min(-1).max(2).optional(),
    level: z.number().int().min(0).max(3).optional(),
  })
  .strict()

const updateOrderSchema = z
  .object({
    status: z.enum(['pending', 'paid', 'cancelled', 'refunded']).optional(),
    payType: z.string().max(50).optional(),
    remark: z.string().max(500).optional(),
    targetTitle: z.string().max(200).optional(),
  })
  .strict()

const adminSendCommentSchema = z.object({
  ticketId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  attachments: z.array(z.unknown()).optional(),
})

const createUserAgentAudioSchema = z.object({
  userUuid: z.string().min(1),
  agentId: z.string().min(1),
  audioUrl: z.string().max(500).optional(),
  duration: z.number().int().optional(),
})
const updateUserAgentAudioSchema = createUserAgentAudioSchema.partial()

const themesPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  themeId: z.string().uuid().optional(),
})

function parseThemesPagination(request: FastifyRequest, reply: FastifyReply) {
  const parsed = themesPaginationSchema.safeParse(request.query)
  if (!parsed.success) {
    reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    return null
  }
  return parsed.data
}

const createThemeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isDark: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isCurrent: z.boolean().optional(),
  preset: z.string().max(50).optional(),
  settings: z.record(z.unknown()).optional(),
})
const updateThemeSchema = createThemeSchema.partial()

const createThemeColorSchema = z.object({
  themeId: z.string().uuid(),
  key: z.string().min(1).max(100),
  value: z.string().min(1).max(100),
  label: z.string().max(100).optional(),
  sortOrder: z.number().int().optional(),
})
const updateThemeColorSchema = createThemeColorSchema.partial()

const bulkUpdateThemeColorsSchema = z.object({
  colors: z.array(updateThemeColorSchema.extend({ id: z.string().uuid() })),
})

const createThemeFontSchema = z.object({
  themeId: z.string().uuid(),
  name: z.string().min(1).max(100),
  family: z.string().min(1).max(200),
  url: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})
const updateThemeFontSchema = createThemeFontSchema.partial()

const createThemeAssetSchema = z.object({
  themeId: z.string().uuid(),
  type: z.string().min(1).max(50),
  url: z.string().min(1).max(500),
  label: z.string().max(100).optional(),
  sortOrder: z.number().int().optional(),
})

const importThemeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isDark: z.boolean().optional(),
  preset: z.string().max(50).optional(),
  settings: z.record(z.unknown()).optional(),
  colors: z
    .array(
      z.object({
        key: z.string().min(1).max(100),
        value: z.string().min(1).max(100),
        label: z.string().max(100).optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .optional(),
  fonts: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        family: z.string().min(1).max(200),
        url: z.string().max(500).optional(),
        isDefault: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .optional(),
  assets: z
    .array(
      z.object({
        type: z.string().min(1).max(50),
        url: z.string().min(1).max(500),
        label: z.string().max(100).optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .optional(),
})

const applyPresetSchema = z.object({
  presetId: z.string().uuid().optional(),
  preset: z.string().max(50).optional(),
  name: z.string().max(100).optional(),
})

const darkModeSchema = z.object({
  isDark: z.boolean(),
})

const createAgentTaskSchema = z.object({
  agentId: z.string().uuid(),
  ruleId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.string().max(20).optional(),
  priority: z.number().int().optional(),
  payload: z.record(z.unknown()).optional(),
  result: z.record(z.unknown()).optional(),
  scheduledAt: z.coerce.date().optional(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  errorMessage: z.string().optional(),
})
const updateAgentTaskSchema = createAgentTaskSchema.partial()

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

export const frontendStubAdminRoutes: FastifyPluginAsync = async (server) => {
  server.put('/admin/agent-rule/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateAgentRuleSchema, request.body)
    const [row] = await db
      .update(agentRule)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(agentRule.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/admin/agent-rule/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    await db.delete(agentRule).where(eq(agentRule.id, id))
    return reply.send(success({ id, deleted: true }))
  })
  server.put('/admin/agent-task/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateAgentTaskSchema, request.body)
    const [row] = await db
      .update(agentTasks)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(agentTasks.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '任务不存在'))
    return reply.send(success(row))
  })
  server.delete('/admin/agent-task/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const [row] = await db.delete(agentTasks).where(eq(agentTasks.id, id)).returning()
    if (!row) return reply.status(404).send(error(404, '任务不存在'))
    return reply.send(success({ id, deleted: true }))
  })
  server.put(
    '/admin/messages/announcements',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ updated: true }))
    },
  )
  server.patch(
    '/admin/api-platform/packages',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ updated: true }))
    },
  )
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
  server.post(
    '/admin/customer-service/send',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = parseOrThrow(adminSendCommentSchema, request.body)
      const ticket = await findTicketById(body.ticketId)
      if (!ticket) return reply.status(404).send(error(404, '工单不存在'))
      const comment = await createComment({
        ticketId: body.ticketId,
        userId: request.userId!,
        content: body.content,
        isAdmin: true,
        attachments: body.attachments ?? [],
      })
      return reply.status(201).send(success({ created: true, id: comment.id }))
    },
  )

  server.put(
    '/admin/certificates/templates',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ updated: true }))
    },
  )
  server.post(
    '/admin/edu/classes/:id/members',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.delete(
    '/admin/edu/classes/:id/members/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.put('/admin/edu/classes', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put(
    '/admin/learn/lessons/:id/chapters',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ updated: true }))
    },
  )

  server.put(
    '/admin/edu/exam/arrangements',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ updated: true }))
    },
  )
  server.put('/admin/edu/exam/templates', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/learn/community', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/learn/homework', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/live/channels', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/learn/maps', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/learn/materials', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/learn/lessons', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/learn/plans', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/learn/reminds', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.post(
    '/admin/learn/signup-batchlesson/:id/retry',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.put(
    '/admin/learn/premium-topics',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ updated: true }))
    },
  )
  server.put('/admin/member-levels/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateMemberLevelSchema, request.body)
    const [row] = await db
      .update(eduMemberLevels)
      .set(body)
      .where(eq(eduMemberLevels.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete(
    '/admin/member-levels/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      await db.delete(eduMemberLevels).where(eq(eduMemberLevels.id, id))
      return reply.send(success({ id, deleted: true }))
    },
  )
  server.put('/admin/users/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateUserSchema, request.body)
    const [row] = await db
      .update(users)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '用户不存在'))
    return reply.send(success(row))
  })
  server.post('/admin/users/:id/review', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.put('/admin/user-platform/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateUserPlatformSchema, request.body)
    const [row] = await db
      .update(zhsUserPlatform)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(zhsUserPlatform.id, Number(id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete(
    '/admin/user-platform/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      await db.delete(zhsUserPlatform).where(eq(zhsUserPlatform.id, Number(id)))
      return reply.send(success({ id, deleted: true }))
    },
  )
  server.patch('/admin/help/articles', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/invoices/titles', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/learn/categories', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/live/categories', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.post('/admin/users/:id/audit', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.put('/admin/members/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.post(
    '/admin/monitor/alerts/:id/ack',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.post(
    '/admin/monitor/alerts/:id/resolve',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.get('/admin/monitor/funnel/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({}))
  })
  server.get('/admin/monitoring/alerts', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  server.put('/admin/orders/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateOrderSchema, request.body)
    const [row] = await db
      .update(eduOrders)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(eduOrders.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '订单不存在'))
    return reply.send(success(row))
  })
  server.delete('/admin/orders/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const [row] = await db.delete(eduOrders).where(eq(eduOrders.id, id)).returning()
    if (!row) return reply.status(404).send(error(404, '订单不存在'))
    return reply.send(success({ id, deleted: true }))
  })
  server.post('/admin/oss/files', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.patch('/admin/oss/drivers', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.get('/admin/system/posts', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.put(
    '/admin/product-identity/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const body = parseOrThrow(updateProductIdentitySchema, request.body)
      const [row] = await db
        .update(productIdentities)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(productIdentities.id, id))
        .returning()
      if (!row) return reply.status(404).send(error(404, '记录不存在'))
      return reply.send(success(row))
    },
  )
  server.delete(
    '/admin/product-identity/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      await db.delete(productIdentities).where(eq(productIdentities.id, id))
      return reply.send(success({ id, deleted: true }))
    },
  )
  server.delete(
    '/admin/roles/:id/users/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.delete('/admin/roles/:id/users', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ deleted: true }))
  })
  server.post('/admin/roles/:id/users', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post(
    '/admin/shop/payments/:id/ship',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.patch('/admin/shop/products', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/shop/withdrawals', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.post(
    '/admin/shop/withdrawals/:id/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )

  server.get('/admin/system/tasks/logs', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.post(
    '/admin/system/tasks/:id/run',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  // === Themes routes (23 routes, all requireAdmin) ===
  // --- Static path routes (registered before :id) ---

  // GET /admin/themes/current — 获取当前主题
  server.get('/admin/themes/current', { preHandler: requireAdmin }, async (_request, reply) => {
    const [theme] = await db.select().from(themes).where(eq(themes.isCurrent, true)).limit(1)
    if (!theme) return reply.status(404).send(error(404, '未设置当前主题'))
    return reply.send(success(theme))
  })

  // GET /admin/themes/dark-mode — 获取暗色模式状态
  server.get('/admin/themes/dark-mode', { preHandler: requireAdmin }, async (_request, reply) => {
    const [theme] = await db.select().from(themes).where(eq(themes.isCurrent, true)).limit(1)
    if (!theme) return reply.status(404).send(error(404, '未设置当前主题'))
    return reply.send(success({ isDark: theme.isDark, themeId: theme.id }))
  })

  // PUT /admin/themes/dark-mode — 切换暗色模式
  server.put('/admin/themes/dark-mode', { preHandler: requireAdmin }, async (request, reply) => {
    const { isDark } = parseOrThrow(darkModeSchema, request.body)
    const [theme] = await db.select().from(themes).where(eq(themes.isCurrent, true)).limit(1)
    if (!theme) return reply.status(404).send(error(404, '未设置当前主题'))
    const [updated] = await db
      .update(themes)
      .set({ isDark, updatedAt: new Date() })
      .where(eq(themes.id, theme.id))
      .returning()
    return reply.send(success(updated))
  })

  // POST /admin/themes/import — 导入主题(从 JSON 配置创建)
  server.post('/admin/themes/import', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(importThemeSchema, request.body)
    const [created] = await db
      .insert(themes)
      .values({
        name: body.name,
        description: body.description,
        isDark: body.isDark ?? false,
        preset: body.preset,
        settings: body.settings ?? {},
      })
      .returning()
    if (!created) return reply.status(500).send(error(500, '创建主题失败'))
    if (body.colors?.length) {
      await db.insert(themeColors).values(
        body.colors.map((c) => ({
          themeId: created.id,
          key: c.key,
          value: c.value,
          label: c.label,
          sortOrder: c.sortOrder ?? 0,
        })),
      )
    }
    if (body.fonts?.length) {
      await db.insert(themeFonts).values(
        body.fonts.map((f) => ({
          themeId: created.id,
          name: f.name,
          family: f.family,
          url: f.url,
          isDefault: f.isDefault ?? false,
          sortOrder: f.sortOrder ?? 0,
        })),
      )
    }
    if (body.assets?.length) {
      await db.insert(themeAssets).values(
        body.assets.map((a) => ({
          themeId: created.id,
          type: a.type,
          url: a.url,
          label: a.label,
          sortOrder: a.sortOrder ?? 0,
        })),
      )
    }
    return reply.status(201).send(success(created))
  })

  // POST /admin/themes/apply-preset — 应用预设(从 themePresets 创建主题)
  server.post(
    '/admin/themes/apply-preset',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = parseOrThrow(applyPresetSchema, request.body)
      let preset
      if (body.presetId) {
        const [p] = await db
          .select()
          .from(themePresets)
          .where(eq(themePresets.id, body.presetId))
          .limit(1)
        preset = p
      } else if (body.preset) {
        const [p] = await db
          .select()
          .from(themePresets)
          .where(eq(themePresets.preset, body.preset))
          .limit(1)
        preset = p
      }
      if (!preset) return reply.status(404).send(error(404, '预设不存在'))
      const [created] = await db
        .insert(themes)
        .values({
          name: body.name ?? preset.name,
          preset: preset.preset,
          settings: preset.config,
        })
        .returning()
      return reply.status(201).send(success(created))
    },
  )

  // --- Theme colors routes (5) ---

  // GET /admin/themes/colors — 颜色列表(可按 themeId 筛选,分页)
  server.get('/admin/themes/colors', { preHandler: requireAdmin }, async (request, reply) => {
    const q = parseThemesPagination(request, reply)
    if (!q) return
    const offset = (q.page - 1) * q.pageSize
    const where = q.themeId ? eq(themeColors.themeId, q.themeId) : undefined
    const [items, totalRows] = await Promise.all([
      db
        .select()
        .from(themeColors)
        .where(where)
        .orderBy(desc(themeColors.createdAt))
        .limit(q.pageSize)
        .offset(offset),
      db.select({ count: count() }).from(themeColors).where(where),
    ])
    return reply.send(
      success({ list: items, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // POST /admin/themes/colors — 创建颜色
  server.post('/admin/themes/colors', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createThemeColorSchema, request.body)
    const [created] = await db.insert(themeColors).values(body).returning()
    return reply.status(201).send(success(created))
  })

  // PUT /admin/themes/colors — 批量更新颜色(接收数组)
  server.put('/admin/themes/colors', { preHandler: requireAdmin }, async (request, reply) => {
    const { colors } = parseOrThrow(bulkUpdateThemeColorsSchema, request.body)
    await db.transaction(async (tx) => {
      for (const c of colors) {
        await tx
          .update(themeColors)
          .set({ ...c, updatedAt: new Date() })
          .where(eq(themeColors.id, c.id))
      }
    })
    return reply.send(success({ updated: colors.length }))
  })

  // PUT /admin/themes/colors/:id — 更新单个颜色
  server.put('/admin/themes/colors/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateThemeColorSchema, request.body)
    const [updated] = await db
      .update(themeColors)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(themeColors.id, id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '颜色不存在'))
    return reply.send(success(updated))
  })

  // DELETE /admin/themes/colors/:id — 删除颜色
  server.delete(
    '/admin/themes/colors/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      await db.delete(themeColors).where(eq(themeColors.id, id))
      return reply.send(success({ deleted: true }))
    },
  )

  // --- Theme fonts routes (4) ---

  // GET /admin/themes/fonts — 字体列表(分页)
  server.get('/admin/themes/fonts', { preHandler: requireAdmin }, async (request, reply) => {
    const q = parseThemesPagination(request, reply)
    if (!q) return
    const offset = (q.page - 1) * q.pageSize
    const where = q.themeId ? eq(themeFonts.themeId, q.themeId) : undefined
    const [items, totalRows] = await Promise.all([
      db
        .select()
        .from(themeFonts)
        .where(where)
        .orderBy(desc(themeFonts.createdAt))
        .limit(q.pageSize)
        .offset(offset),
      db.select({ count: count() }).from(themeFonts).where(where),
    ])
    return reply.send(
      success({ list: items, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // POST /admin/themes/fonts — 创建字体
  server.post('/admin/themes/fonts', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createThemeFontSchema, request.body)
    const [created] = await db.insert(themeFonts).values(body).returning()
    return reply.status(201).send(success(created))
  })

  // PATCH /admin/themes/fonts/:id — 更新字体
  server.patch('/admin/themes/fonts/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateThemeFontSchema, request.body)
    const [updated] = await db
      .update(themeFonts)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(themeFonts.id, id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '字体不存在'))
    return reply.send(success(updated))
  })

  // DELETE /admin/themes/fonts/:id — 删除字体
  server.delete('/admin/themes/fonts/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    await db.delete(themeFonts).where(eq(themeFonts.id, id))
    return reply.send(success({ deleted: true }))
  })

  // --- Theme assets routes (3) ---

  // GET /admin/themes/assets — 资源列表(分页)
  server.get('/admin/themes/assets', { preHandler: requireAdmin }, async (request, reply) => {
    const q = parseThemesPagination(request, reply)
    if (!q) return
    const offset = (q.page - 1) * q.pageSize
    const where = q.themeId ? eq(themeAssets.themeId, q.themeId) : undefined
    const [items, totalRows] = await Promise.all([
      db
        .select()
        .from(themeAssets)
        .where(where)
        .orderBy(desc(themeAssets.createdAt))
        .limit(q.pageSize)
        .offset(offset),
      db.select({ count: count() }).from(themeAssets).where(where),
    ])
    return reply.send(
      success({ list: items, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // POST /admin/themes/assets — 创建资源
  server.post('/admin/themes/assets', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createThemeAssetSchema, request.body)
    const [created] = await db.insert(themeAssets).values(body).returning()
    return reply.status(201).send(success(created))
  })

  // DELETE /admin/themes/assets/:id — 删除资源
  server.delete(
    '/admin/themes/assets/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      await db.delete(themeAssets).where(eq(themeAssets.id, id))
      return reply.send(success({ deleted: true }))
    },
  )

  // --- Theme presets routes (1) ---

  // GET /admin/themes/presets — 预设列表(分页)
  server.get('/admin/themes/presets', { preHandler: requireAdmin }, async (request, reply) => {
    const q = parseThemesPagination(request, reply)
    if (!q) return
    const offset = (q.page - 1) * q.pageSize
    const [items, totalRows] = await Promise.all([
      db
        .select()
        .from(themePresets)
        .orderBy(desc(themePresets.createdAt))
        .limit(q.pageSize)
        .offset(offset),
      db.select({ count: count() }).from(themePresets),
    ])
    return reply.send(
      success({ list: items, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // --- Theme main CRUD (parametric routes last, 8 + import + apply-preset = 10) ---

  // POST /admin/themes — 创建主题(isCurrent=true 时事务取消其他当前)
  server.post('/admin/themes', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createThemeSchema, request.body)
    const values = {
      name: body.name,
      description: body.description,
      isDark: body.isDark ?? false,
      isActive: body.isActive ?? true,
      isCurrent: body.isCurrent ?? false,
      preset: body.preset,
      settings: body.settings ?? {},
    }
    if (body.isCurrent) {
      const [created] = await db.transaction(async (tx) => {
        await tx
          .update(themes)
          .set({ isCurrent: false, updatedAt: new Date() })
          .where(eq(themes.isCurrent, true))
        return tx.insert(themes).values(values).returning()
      })
      return reply.status(201).send(success(created))
    }
    const [created] = await db.insert(themes).values(values).returning()
    return reply.status(201).send(success(created))
  })

  // GET /admin/themes/:id — 查询主题详情(含 colors/fonts/assets 聚合)
  server.get('/admin/themes/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const [theme] = await db.select().from(themes).where(eq(themes.id, id)).limit(1)
    if (!theme) return reply.status(404).send(error(404, '主题不存在'))
    const [colors, fonts, assets] = await Promise.all([
      db
        .select()
        .from(themeColors)
        .where(eq(themeColors.themeId, id))
        .orderBy(themeColors.sortOrder),
      db.select().from(themeFonts).where(eq(themeFonts.themeId, id)).orderBy(themeFonts.sortOrder),
      db
        .select()
        .from(themeAssets)
        .where(eq(themeAssets.themeId, id))
        .orderBy(themeAssets.sortOrder),
    ])
    return reply.send(success({ ...theme, colors, fonts, assets }))
  })

  // PUT /admin/themes/:id — 更新主题(Zod partial,isCurrent=true 时事务取消其他)
  server.put('/admin/themes/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateThemeSchema, request.body)
    if (body.isCurrent) {
      const [updated] = await db.transaction(async (tx) => {
        await tx
          .update(themes)
          .set({ isCurrent: false, updatedAt: new Date() })
          .where(eq(themes.isCurrent, true))
        return tx
          .update(themes)
          .set({ ...body, updatedAt: new Date() })
          .where(eq(themes.id, id))
          .returning()
      })
      if (!updated) return reply.status(404).send(error(404, '主题不存在'))
      return reply.send(success(updated))
    }
    const [updated] = await db
      .update(themes)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(themes.id, id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '主题不存在'))
    return reply.send(success(updated))
  })

  // PATCH /admin/themes/:id — 部分更新(同 PUT)
  server.patch('/admin/themes/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateThemeSchema, request.body)
    if (body.isCurrent) {
      const [updated] = await db.transaction(async (tx) => {
        await tx
          .update(themes)
          .set({ isCurrent: false, updatedAt: new Date() })
          .where(eq(themes.isCurrent, true))
        return tx
          .update(themes)
          .set({ ...body, updatedAt: new Date() })
          .where(eq(themes.id, id))
          .returning()
      })
      if (!updated) return reply.status(404).send(error(404, '主题不存在'))
      return reply.send(success(updated))
    }
    const [updated] = await db
      .update(themes)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(themes.id, id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '主题不存在'))
    return reply.send(success(updated))
  })

  // DELETE /admin/themes/:id — 删除主题(cascade 删除子表)
  server.delete('/admin/themes/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const [deleted] = await db.delete(themes).where(eq(themes.id, id)).returning()
    if (!deleted) return reply.status(404).send(error(404, '主题不存在'))
    return reply.send(success({ deleted: true }))
  })
  server.put(
    '/admin/user-agent-audio/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const body = parseOrThrow(updateUserAgentAudioSchema, request.body)
      const [row] = await db
        .update(zhsUserAgentAudio)
        .set(body)
        .where(eq(zhsUserAgentAudio.id, Number(id)))
        .returning()
      if (!row) return reply.status(404).send(error(404, '记录不存在'))
      return reply.send(success(row))
    },
  )
  server.put('/admin/zhs-user/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateUserPlatformSchema, request.body)
    const [row] = await db
      .update(zhsUserPlatform)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(zhsUserPlatform.id, Number(id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })

  // POST 创建路由（前端 editing ? PUT /:id : POST / 模式）。有表的资源接入真实 CRUD，
  // agent-task / clawdbot/bots 已接入真实 DB 查询。
  server.post('/admin/agent-rule', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createAgentRuleSchema, request.body)
    const [row] = await db.insert(agentRule).values(body).returning()
    return reply.status(201).send(success(row))
  })
  server.post('/admin/agent-task', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createAgentTaskSchema, request.body)
    const [row] = await db.insert(agentTasks).values(body).returning()
    return reply.status(201).send(success(row))
  })
  server.post('/admin/clawdbot/bots', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createClawdbotBotSchema, request.body)
    const [row] = await db.insert(clawdbotBots).values(body).returning()
    return reply.status(201).send(success(row))
  })
  server.post('/admin/member-levels', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createMemberLevelSchema, request.body)
    const [row] = await db.insert(eduMemberLevels).values(body).returning()
    return reply.status(201).send(success(row))
  })
  server.post('/admin/user-platform', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createUserPlatformSchema, request.body)
    const [row] = await db.insert(zhsUserPlatform).values(body).returning()
    return reply.status(201).send(success(row))
  })
  server.post('/admin/product-identity', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createProductIdentitySchema, request.body)
    const [existing] = await db
      .select()
      .from(productIdentities)
      .where(eq(productIdentities.code, body.code))
      .limit(1)
    if (existing) return reply.status(409).send(error(409, '产品标识编码已存在'))
    const [row] = await db
      .insert(productIdentities)
      .values({ ...body, status: body.status ?? 'active' })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.post('/admin/user-agent-audio', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createUserAgentAudioSchema, request.body)
    const [row] = await db.insert(zhsUserAgentAudio).values(body).returning()
    return reply.status(201).send(success(row))
  })
  server.post('/admin/zhs-user', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createUserPlatformSchema, request.body)
    const [row] = await db.insert(zhsUserPlatform).values(body).returning()
    return reply.status(201).send(success(row))
  })
}
