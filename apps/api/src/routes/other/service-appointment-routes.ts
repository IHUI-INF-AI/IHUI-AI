/**
 * 服务预约(从 frontend-stub-other-routes.ts 拆分)。
 * GET /service-appointment/:id, GET /service-appointment/:id/{cancel,confirm,complete}
 * 状态机: pending → confirmed → completed;pending/confirmed → cancelled
 */
import type { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db, dbRead } from '../../db/index.js'
import { serviceAppointments } from '@ihui/database'
import { parseIdParam } from './_shared.js'

export const serviceAppointmentRoutes: FastifyPluginAsync = async (server) => {
  // GET /service-appointment/:id — 预约详情
  server.get('/service-appointment/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [row] = await dbRead
      .select()
      .from(serviceAppointments)
      .where(eq(serviceAppointments.id, id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '预约不存在'))
    return reply.send(success(row))
  })

  // GET /service-appointment/:id/cancel — 取消预约(pending/confirmed → cancelled)
  server.get('/service-appointment/:id/cancel', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [row] = await dbRead
      .select()
      .from(serviceAppointments)
      .where(eq(serviceAppointments.id, id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '预约不存在'))
    if (row.status !== 'pending' && row.status !== 'confirmed') {
      return reply.status(409).send(error(409, '当前状态不允许取消'))
    }
    const [updated] = await db
      .update(serviceAppointments)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(serviceAppointments.id, id))
      .returning()
    return reply.send(success(updated))
  })

  // GET /service-appointment/:id/confirm — 确认预约(pending → confirmed)
  server.get('/service-appointment/:id/confirm', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [row] = await dbRead
      .select()
      .from(serviceAppointments)
      .where(eq(serviceAppointments.id, id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '预约不存在'))
    if (row.status !== 'pending') {
      return reply.status(409).send(error(409, '当前状态不允许确认'))
    }
    const [updated] = await db
      .update(serviceAppointments)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(eq(serviceAppointments.id, id))
      .returning()
    return reply.send(success(updated))
  })

  // GET /service-appointment/:id/complete — 完成预约(confirmed → completed)
  server.get('/service-appointment/:id/complete', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [row] = await dbRead
      .select()
      .from(serviceAppointments)
      .where(eq(serviceAppointments.id, id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '预约不存在'))
    if (row.status !== 'confirmed') {
      return reply.status(409).send(error(409, '当前状态不允许完成'))
    }
    const [updated] = await db
      .update(serviceAppointments)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(serviceAppointments.id, id))
      .returning()
    return reply.send(success(updated))
  })
}
