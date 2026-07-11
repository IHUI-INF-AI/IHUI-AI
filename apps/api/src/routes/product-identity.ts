import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { productIdentities } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const listQuerySchema = z.object({
  type: z.preprocess(emptyToUndefined, z.string().max(32).optional()),
  status: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
})

const createIdentitySchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(64),
  type: z.string().min(1).max(32),
  value: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  status: z.enum(['active', 'disabled']).optional(),
})

const updateIdentitySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(1).max(64).optional(),
  type: z.string().min(1).max(32).optional(),
  value: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['active', 'disabled']).optional(),
})

// =============================================================================
// 路由
// =============================================================================

const productIdentityRoutes: FastifyPluginAsync = async (server) => {
  // GET / — 产品标识列表（公开，支持 type/status 筛选）
  server.get('/', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { type, status } = parsed.data
    const conditions = [eq(productIdentities.status, 'active')]
    if (type) conditions.push(eq(productIdentities.type, type))
    if (status) {
      // 若指定 status 则替换默认 active 过滤
      conditions[0] = eq(productIdentities.status, status)
    }

    const list = await db
      .select()
      .from(productIdentities)
      .where(and(...conditions))
      .orderBy(desc(productIdentities.createdAt))
    return reply.send(success({ list }))
  })

  // POST / — 创建产品标识（admin）
  server.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createIdentitySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 检查 code 唯一性
    const [existing] = await db
      .select()
      .from(productIdentities)
      .where(eq(productIdentities.code, parsed.data.code))
      .limit(1)
    if (existing) {
      return reply.status(409).send(error(409, '产品标识编码已存在'))
    }
    const [identity] = await db
      .insert(productIdentities)
      .values({ ...parsed.data, status: parsed.data.status ?? 'active' })
      .returning()
    return reply.status(201).send(success({ identity }))
  })

  // PATCH /:id — 更新产品标识（admin）
  server.patch('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateIdentitySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [identity] = await db
      .update(productIdentities)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(productIdentities.id, idParsed.data.id))
      .returning()
    if (!identity) return reply.status(404).send(error(404, '产品标识不存在'))
    return reply.send(success({ identity }))
  })
}

export default productIdentityRoutes
