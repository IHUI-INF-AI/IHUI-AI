/**
 * /api/admin/zhs-identity 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { zhsIdentity } from '@ihui/database'
import { eq, ilike, desc, sql } from 'drizzle-orm'
import { paginationSchema, idParamSchema } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'

const createZhsIdentitySchema = z.object({
  identityName: z.string().max(100).default(''),
  identityType: z.string().max(50).nullable().optional(),
  status: z.coerce.number().int().min(0).default(1),
})

const updateZhsIdentitySchema = z.object({
  identityName: z.string().max(100).optional(),
  identityType: z.string().max(50).nullable().optional(),
  status: z.coerce.number().int().min(0).optional(),
})

const zhsIdentityRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  server.get('/zhs-identity', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(zhsIdentity.identityName, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(zhsIdentity)
      .where(where)
      .orderBy(desc(zhsIdentity.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(zhsIdentity)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.get('/zhs-identity/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .select()
      .from(zhsIdentity)
      .where(eq(zhsIdentity.id, Number(p.data.id)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.post('/zhs-identity', async (request, reply) => {
    const parsed = createZhsIdentitySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数校验失败'))
    }
    const [row] = await db
      .insert(zhsIdentity)
      .values({
        identityName: parsed.data.identityName,
        identityType: parsed.data.identityType ?? null,
        status: parsed.data.status,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/zhs-identity/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const parsed = updateZhsIdentitySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数校验失败'))
    }
    const [row] = await db
      .update(zhsIdentity)
      .set({
        ...(parsed.data.identityName !== undefined && { identityName: parsed.data.identityName }),
        ...(parsed.data.identityType !== undefined && {
          identityType: parsed.data.identityType ?? null,
        }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        updatedAt: new Date(),
      })
      .where(eq(zhsIdentity.id, Number(p.data.id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/zhs-identity/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsIdentity).where(eq(zhsIdentity.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}

export default zhsIdentityRoutes
