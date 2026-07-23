/**
 * 收货地址(从 frontend-stub-other-routes.ts 拆分)。
 * POST /addresses, PUT/DELETE /addresses/:id, POST /addresses/:id/default
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db, dbRead } from '../../db/index.js'
import { userAddresses } from '@ihui/database'
import { parseIdParam } from './_shared.js'

const addressBodySchema = z.object({
  recipientName: z.string().min(1).max(100),
  phone: z.string().min(1).max(20),
  province: z.string().min(1).max(50),
  city: z.string().min(1).max(50),
  district: z.string().min(1).max(50),
  detail: z.string().min(1).max(500),
  postalCode: z.string().max(20).optional(),
  isDefault: z.boolean().optional(),
})

export const addressRoutes: FastifyPluginAsync = async (server) => {
  // PUT /addresses/:id — 更新地址(仅所有者)
  server.put('/addresses/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = addressBodySchema.partial().safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await dbRead
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '地址不存在'))
    if (existing.userId !== request.userId)
      return reply.status(403).send(error(403, '无权修改此地址'))
    const [updated] = await db
      .update(userAddresses)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(userAddresses.id, id))
      .returning()
    return reply.send(success({ item: updated }))
  })

  // POST /addresses — 创建地址(若 isDefault=true 则取消其他默认)
  server.post('/addresses', async (request, reply) => {
    const body = addressBodySchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    if (body.data.isDefault) {
      await db
        .update(userAddresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(userAddresses.userId, request.userId!), eq(userAddresses.isDefault, true)))
    }
    const [item] = await db
      .insert(userAddresses)
      .values({
        userId: request.userId!,
        recipientName: body.data.recipientName,
        phone: body.data.phone,
        province: body.data.province,
        city: body.data.city,
        district: body.data.district,
        detail: body.data.detail,
        postalCode: body.data.postalCode ?? null,
        isDefault: body.data.isDefault ?? false,
      })
      .returning()
    return reply.status(201).send(success({ item }))
  })

  // DELETE /addresses/:id — 删除地址(仅所有者)
  server.delete('/addresses/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [existing] = await dbRead
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '地址不存在'))
    if (existing.userId !== request.userId)
      return reply.status(403).send(error(403, '无权删除此地址'))
    await db.delete(userAddresses).where(eq(userAddresses.id, id))
    return reply.send(success({ deleted: true }))
  })

  // POST /addresses/:id/default — 设为默认(事务取消其他默认)
  server.post('/addresses/:id/default', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [existing] = await dbRead
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '地址不存在'))
    if (existing.userId !== request.userId)
      return reply.status(403).send(error(403, '无权修改此地址'))
    await db.transaction(async (tx) => {
      await tx
        .update(userAddresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(userAddresses.userId, request.userId!), eq(userAddresses.isDefault, true)))
      await tx
        .update(userAddresses)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(userAddresses.id, id))
    })
    return reply.send(success({ updated: true }))
  })
}
