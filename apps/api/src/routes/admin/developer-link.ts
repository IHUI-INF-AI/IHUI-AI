/**
 * /api/admin/developer-link 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { zhsDeveloperLink } from '@ihui/database'
import { eq, ilike, desc, sql } from 'drizzle-orm'
import { paginationSchema, idParamSchema } from './_shared.js'
import { z } from 'zod'

import { requireAdmin } from '../../plugins/require-permission.js'

const createSchema = z.object({
  userId: z.string().min(1),
  cozeAccountId: z.string().optional(),
  cozeAccountName: z.string().optional(),
  status: z.number().int().optional(),
})

const updateSchema = createSchema.partial()

const developerLinkRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/developer-link', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(zhsDeveloperLink.userId, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(zhsDeveloperLink)
      .where(where)
      .orderBy(desc(zhsDeveloperLink.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(zhsDeveloperLink)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.delete('/developer-link/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsDeveloperLink).where(eq(zhsDeveloperLink.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  server.post('/developer-link', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db
      .insert(zhsDeveloperLink)
      .values({
        userId: parsed.data.userId,
        cozeAccountId: parsed.data.cozeAccountId ?? null,
        cozeAccountName: parsed.data.cozeAccountName ?? null,
        status: parsed.data.status ?? 1,
      })
      .returning()
    return reply.status(201).send(success(row))
  })

  server.put('/developer-link/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db
      .update(zhsDeveloperLink)
      .set({
        ...(parsed.data.userId !== undefined ? { userId: parsed.data.userId } : {}),
        ...(parsed.data.cozeAccountId !== undefined
          ? { cozeAccountId: parsed.data.cozeAccountId }
          : {}),
        ...(parsed.data.cozeAccountName !== undefined
          ? { cozeAccountName: parsed.data.cozeAccountName }
          : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(zhsDeveloperLink.id, Number(p.data.id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
}

export default developerLinkRoutes
