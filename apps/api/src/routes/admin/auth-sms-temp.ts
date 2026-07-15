/**
 * /api/admin/auth-sms-temp 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { messageTemplates } from '@ihui/database'
import { eq, ilike, desc, sql, and, or } from 'drizzle-orm'
import { paginationSchema, idParamSchema, createSmsTemplateSchema, updateSmsTemplateSchema } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const authSmsTempRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
server.get('/auth-sms-temp', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? and(
          eq(messageTemplates.channel, 'sms'),
          or(
            ilike(messageTemplates.title, `%${search}%`),
            ilike(messageTemplates.code, `%${search}%`),
          ),
        )
      : eq(messageTemplates.channel, 'sms')
    const list = await db
      .select()
      .from(messageTemplates)
      .where(where)
      .orderBy(desc(messageTemplates.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(messageTemplates)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/auth-sms-temp', async (request, reply) => {
    const b = createSmsTemplateSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .insert(messageTemplates)
      .values({
        code: b.data.code,
        channel: 'sms',
        title: b.data.title,
        content: b.data.content,
        status: b.data.status ?? 1,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/auth-sms-temp/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = updateSmsTemplateSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, b.error.message))
    const [row] = await db
      .update(messageTemplates)
      .set({
        ...(b.data.title !== undefined && { title: b.data.title }),
        ...(b.data.content !== undefined && { content: b.data.content }),
        ...(b.data.status !== undefined && { status: b.data.status }),
        updatedAt: new Date(),
      })
      .where(eq(messageTemplates.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/auth-sms-temp/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const existing = await db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.id, p.data.id))
      .limit(1)
    if (existing.length === 0) return reply.status(404).send(error(404, '记录不存在'))
    await db.delete(messageTemplates).where(eq(messageTemplates.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}

export default authSmsTempRoutes
