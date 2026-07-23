/**
 * 产品标识管理路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/product-identity
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { productIdentities } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../../utils/response.js'
import { idParamSchema } from './_shared.js'

const createProductIdentitySchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(64),
  type: z.string().min(1).max(32),
  value: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.string().max(20).optional(),
})
const updateProductIdentitySchema = createProductIdentitySchema.partial()

export const productIdentityRoutes: FastifyPluginAsync = async (server) => {
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
}
