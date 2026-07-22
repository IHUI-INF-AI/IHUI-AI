import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql, count } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { developerApiKeys, plans, orders, commissionFlows, auditLogs } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { isValidApiKeyPermission } from '@ihui/types'
import { generateApiKey, hashSecret } from '../utils/api-key-hash.js'

// =============================================================================
// Zod schemas
// =============================================================================

const permissionsSchema = z
  .array(z.string())
  .refine((arr) => arr.every(isValidApiKeyPermission), '包含非法权限点')

const createAppSchema = z.object({
  name: z.string().min(1).max(100),
  userId: z.string().uuid(),
  permissions: permissionsSchema.default([]),
  rateLimit: z.number().int().min(1).max(10000).default(60),
})

const updateAppSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: permissionsSchema.optional(),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  status: z.enum(['active', 'revoked']).optional(),
})

const createPackageSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
  price: z.number().int().min(0),
  interval: z.enum(['month', 'year']),
  features: z.array(z.string()).default([]),
  sortOrder: z.number().int().default(0),
})

const updatePackageSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(500).optional(),
  price: z.number().int().min(0).optional(),
  interval: z.enum(['month', 'year']).optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

const billingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const usageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// =============================================================================
// 路由
// =============================================================================

export const adminApiPlatformRoutes: FastifyPluginAsync = async (server) => {
  // admin 创建 API 平台应用后返回明文 secret,需跳过响应脱敏
  // 防止 response-sanitizer 把 secret 字段误伤为 '***'
  server.addHook('onRequest', async (request) => {
    request.skipResponseSanitization = true
  })

  server.addHook('preHandler', requireAdmin)

  // ===== 应用管理（developerApiKeys）=====

  server.get('/api-platform/apps', async (_request, reply) => {
    const list = await dbRead
      .select({
        id: developerApiKeys.id,
        name: developerApiKeys.name,
        userId: developerApiKeys.userId,
        key: developerApiKeys.key,
        permissions: developerApiKeys.permissions,
        status: developerApiKeys.status,
        rateLimit: developerApiKeys.rateLimit,
        lastUsedAt: developerApiKeys.lastUsedAt,
        createdAt: developerApiKeys.createdAt,
      })
      .from(developerApiKeys)
      .orderBy(desc(developerApiKeys.createdAt))
    return reply.send(success({ list }))
  })

  server.post('/api-platform/apps', async (request, reply) => {
    const parsed = createAppSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { name, userId, permissions, rateLimit } = parsed.data
    // 2026-07-22 安全加固:secret 用 sha256 哈希存储,明文仅此一次返回给调用方
    const { key, secret } = generateApiKey()
    const [created] = await db
      .insert(developerApiKeys)
      .values({ name, userId, key, secret: hashSecret(secret), permissions, rateLimit })
      .returning()
    // 返回明文 secret 供 Admin 一次性查看(skipResponseSanitization 已在 onRequest hook 全局设置)
    return reply.send(success({ ...created, secret }))
  })

  server.patch('/api-platform/apps/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const parsed = updateAppSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [updated] = await db
      .update(developerApiKeys)
      .set(parsed.data)
      .where(eq(developerApiKeys.id, id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '应用不存在'))
    return reply.send(success(updated))
  })

  // PATCH /api-platform/apps/:id/status — 状态切换（前端传 0|1，转换为 active|revoked）
  server.patch('/api-platform/apps/:id/status', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const b = z.object({ status: z.number().int() }).safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    const statusStr = b.data.status === 1 ? 'active' : 'revoked'
    const [updated] = await db
      .update(developerApiKeys)
      .set({ status: statusStr, updatedAt: new Date() })
      .where(eq(developerApiKeys.id, id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '应用不存在'))
    return reply.send(success(updated))
  })

  server.delete('/api-platform/apps/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const [deleted] = await db
      .delete(developerApiKeys)
      .where(eq(developerApiKeys.id, id))
      .returning()
    if (!deleted) return reply.status(404).send(error(404, '应用不存在'))
    return reply.send(success({ deleted: true }))
  })

  // ===== 套餐管理（plans）=====

  server.get('/api-platform/packages', async (_request, reply) => {
    const list = await dbRead.select().from(plans).orderBy(plans.sortOrder)
    return reply.send(success({ list }))
  })

  server.post('/api-platform/packages', async (request, reply) => {
    const parsed = createPackageSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [created] = await db.insert(plans).values(parsed.data).returning()
    return reply.send(success(created))
  })

  server.patch('/api-platform/packages/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const parsed = updatePackageSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [updated] = await db.update(plans).set(parsed.data).where(eq(plans.id, id)).returning()
    if (!updated) return reply.status(404).send(error(404, '套餐不存在'))
    return reply.send(success(updated))
  })

  server.delete('/api-platform/packages/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const [deleted] = await db.delete(plans).where(eq(plans.id, id)).returning()
    if (!deleted) return reply.status(404).send(error(404, '套餐不存在'))
    return reply.send(success({ deleted: true }))
  })

  // ===== 计费管理 =====

  server.get('/api-platform/billing/summary', async (_request, reply) => {
    const [orderCount] = await dbRead.select({ total: count() }).from(orders)
    const [revenueRow] = await dbRead
      .select({ total: sql<number>`coalesce(sum(${orders.amount}), 0)` })
      .from(orders)
      .where(eq(orders.status, 'paid'))
    const [commissionRow] = await dbRead
      .select({ total: sql<number>`coalesce(sum(${commissionFlows.amount}), 0)` })
      .from(commissionFlows)
    return reply.send(
      success({
        totalOrders: orderCount?.total ?? 0,
        totalRevenue: Number(revenueRow?.total ?? 0),
        totalCommission: Number(commissionRow?.total ?? 0),
      }),
    )
  })

  server.get('/api-platform/billing', async (request, reply) => {
    const parsed = billingQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsed.data
    const offset = (page - 1) * pageSize
    const list = await dbRead
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset(offset)
    return reply.send(success({ list, page, pageSize }))
  })

  // ===== 用量管理 =====

  server.get('/api-platform/usage/summary', async (_request, reply) => {
    const [totalRow] = await dbRead.select({ total: count() }).from(auditLogs)
    const [todayRow] = await dbRead
      .select({ total: count() })
      .from(auditLogs)
      .where(sql`${auditLogs.createdAt} > now() - interval '1 day'`)
    return reply.send(
      success({
        totalCalls: totalRow?.total ?? 0,
        todayCalls: todayRow?.total ?? 0,
      }),
    )
  })

  server.get('/api-platform/usage', async (request, reply) => {
    const parsed = usageQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsed.data
    const offset = (page - 1) * pageSize
    const list = await dbRead
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset)
    return reply.send(success({ list, page, pageSize }))
  })
}
