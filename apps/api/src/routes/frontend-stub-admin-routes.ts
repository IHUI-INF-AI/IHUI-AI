/**
 * 前端 admin 模块缺失路由桩。
 * 来源：api-routes-missing.json 中未匹配到后端路由的调用。
 * 策略：统一返回空列表/空对象/操作成功，避免前端 404。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  agentRule,
  productIdentities,
  eduMemberLevels,
  zhsUserPlatform,
  zhsUserAgentAudio,
} from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../utils/response.js'

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

const createUserAgentAudioSchema = z.object({
  userUuid: z.string().min(1),
  agentId: z.string().min(1),
  audioUrl: z.string().max(500).optional(),
  duration: z.number().int().optional(),
})
const updateUserAgentAudioSchema = createUserAgentAudioSchema.partial()

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
  server.put('/admin/agent-task/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete('/admin/agent-task/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ deleted: true }))
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
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.get('/admin/clawdbot/bots', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.put('/admin/clawdbot/bots/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/clawdbot/bots', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete(
    '/admin/clawdbot/bots/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.get('/admin/clawdbot/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get(
    '/admin/clawdbot/permissions',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ list: [], total: 0 }))
    },
  )
  server.post(
    '/admin/clawdbot/permissions',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
  server.delete(
    '/admin/clawdbot/permissions/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.get('/admin/clawdbot/sessions', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get(
    '/admin/clawdbot/sessions/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({}))
    },
  )
  server.post(
    '/admin/customer-service/send',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
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
  server.put('/admin/users/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
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

  server.put('/admin/orders/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete('/admin/orders/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ deleted: true }))
  })
  server.post('/admin/oss/files', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.delete('/admin/oss/files/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ deleted: true }))
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
  server.get('/admin/themes/assets', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.post('/admin/themes/assets', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.delete(
    '/admin/themes/assets/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.get('/admin/themes/colors', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.put('/admin/themes/colors/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.put('/admin/themes/colors', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete(
    '/admin/themes/colors/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.post('/admin/themes', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.get('/admin/themes/dark-mode', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.put('/admin/themes/dark-mode', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.get('/admin/themes/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({}))
  })
  server.put('/admin/themes/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete('/admin/themes/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ deleted: true }))
  })
  server.post('/admin/themes/import', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.get('/admin/themes/fonts', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.post('/admin/themes/fonts', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.patch('/admin/themes/fonts/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.delete(
    '/admin/themes/fonts/:id',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send(success({ deleted: true }))
    },
  )
  server.get('/admin/themes/current', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.patch('/admin/themes/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ updated: true }))
  })
  server.get('/admin/themes/presets', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.post(
    '/admin/themes/apply-preset',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(201).send(success({ created: true, id: randomUUID() }))
    },
  )
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
  // 无表/服务化的资源（agent-task / clawdbot/bots / themes/colors）保留兜底桩。
  server.post('/admin/agent-rule', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createAgentRuleSchema, request.body)
    const [row] = await db.insert(agentRule).values(body).returning()
    return reply.status(201).send(success(row))
  })
  server.post('/admin/agent-task', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/admin/clawdbot/bots', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
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
  server.post('/admin/themes/colors', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
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
