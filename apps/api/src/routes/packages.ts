import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { plans } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'

// 复用 billing schema 的 plans 表作为套餐数据源，避免重复建表

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const createPackageSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(2000).optional(),
  price: z.number().int().min(0),
  interval: z.enum(['month', 'year', 'quarter', 'lifetime']),
  features: z.array(z.string()).default([]),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

const updatePackageSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(2000).optional(),
  price: z.number().int().min(0).optional(),
  interval: z.enum(['month', 'year', 'quarter', 'lifetime']).optional(),
  features: z.array(z.string()).max(100).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

// =============================================================================
// 路由
// =============================================================================

const packagesRoutes: FastifyPluginAsync = async (server) => {
  // GET / — 套餐列表（公开，仅返回启用的套餐，按 sort_order 升序）
  server.get('/', async (_request, reply) => {
    const list = await db
      .select()
      .from(plans)
      .where(eq(plans.isActive, true))
      .orderBy(asc(plans.sortOrder))
    return reply.send(success({ list }))
  })

  // GET /:id — 套餐详情（公开）
  server.get('/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [pkg] = await db.select().from(plans).where(eq(plans.id, parsed.data.id)).limit(1)
    if (!pkg || !pkg.isActive) return reply.status(404).send(error(404, '套餐不存在'))
    return reply.send(success({ package: pkg }))
  })

  // POST / — 创建套餐（admin）
  server.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createPackageSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [pkg] = await db
      .insert(plans)
      .values({
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price,
        interval: parsed.data.interval,
        features: parsed.data.features,
        isActive: parsed.data.isActive ?? true,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning()
    return reply.status(201).send(success({ package: pkg }))
  })

  // PATCH /:id — 更新套餐（admin）
  server.patch('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updatePackageSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [pkg] = await db
      .update(plans)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(plans.id, idParsed.data.id))
      .returning()
    if (!pkg) return reply.status(404).send(error(404, '套餐不存在'))
    return reply.send(success({ package: pkg }))
  })
}

export default packagesRoutes
