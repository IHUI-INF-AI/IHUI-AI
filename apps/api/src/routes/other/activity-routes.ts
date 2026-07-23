/**
 * 活动报名 + 圈子退出(从 frontend-stub-other-routes.ts 拆分)。
 * POST /activities/:id — 用户报名参与活动
 * POST /circles/:id/leave — 退出圈子
 */
import type { FastifyPluginAsync } from 'fastify'
import { eq, and, sql } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db, dbRead } from '../../db/index.js'
import { circles, circleMembers } from '@ihui/database'
import { findActivityById, joinActivity } from '../../db/promotion-queries.js'
import { parseIdParam } from './_shared.js'

export const activityRoutes: FastifyPluginAsync = async (server) => {
  // POST /activities/:id — 用户报名参与活动(activityParticipants 表)
  server.post('/activities/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const activity = await findActivityById(id)
    if (!activity) return reply.status(404).send(error(404, '活动不存在'))
    if (activity.status !== 'published')
      return reply.status(400).send(error(400, '活动未发布或已结束'))
    const participant = await joinActivity(id, request.userId!, request.body)
    if (!participant) return reply.send(success({ joined: true, message: '已参与该活动' }))
    return reply.status(201).send(success({ joined: true, participant }))
  })

  // POST /circles/:id/leave — 退出圈子
  server.post('/circles/:id/leave', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [existing] = await dbRead
      .select()
      .from(circleMembers)
      .where(and(eq(circleMembers.circleId, id), eq(circleMembers.userId, request.userId!)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '未加入该圈子'))
    if (existing.role === 'owner')
      return reply.status(400).send(error(400, '圈主不能退出,请先转让'))
    const [left] = await db
      .update(circleMembers)
      .set({ status: 0, updatedAt: new Date() })
      .where(eq(circleMembers.id, existing.id))
      .returning()
    // 圈子成员数 -1
    await db
      .update(circles)
      .set({ memberCount: sql`GREATEST(${circles.memberCount} - 1, 0)` })
      .where(eq(circles.id, id))
    return reply.status(201).send(success({ left: true, member: left }))
  })
}
