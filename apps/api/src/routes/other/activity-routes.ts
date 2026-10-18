// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 活动报名 + 圈子加入/退出(从 frontend-stub-other-routes.ts 拆分)。
 * POST /activities/:id — 用户报名参与活动
 * POST /circles/:id/join — 加入圈子
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

  // POST /circles/:id/join — 加入圈子(与 leave 成对;曾退出者复活,不新建第二行)
  server.post('/circles/:id/join', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const [circle] = await dbRead
      .select({ id: circles.id })
      .from(circles)
      .where(eq(circles.id, id))
      .limit(1)
    if (!circle) return reply.status(404).send(error(404, '圈子不存在'))

    const [existing] = await dbRead
      .select()
      .from(circleMembers)
      .where(and(eq(circleMembers.circleId, id), eq(circleMembers.userId, userId)))
      .limit(1)

    if (existing && existing.status === 1) {
      // 重复点"加入"不是第二次加入:成员数不能再 +1
      return reply.send(success({ joined: true, already: true, member: existing }))
    }

    let member = null
    if (existing) {
      // 库里留着她上次退出的那一行(status=0)⇒ 复活原行,role 不动(可能是被邀回来的管理员)
      const [revived] = await db
        .update(circleMembers)
        .set({ status: 1, updatedAt: new Date() })
        .where(eq(circleMembers.id, existing.id))
        .returning()
      member = revived ?? null
    } else {
      // 唯一索引 (circle_id, user_id) 在,并发撞索引时 returning 为空 ⇒ 判"已加入"而不是判成功新建
      const [inserted] = await db
        .insert(circleMembers)
        .values({ circleId: id, userId })
        .onConflictDoNothing()
        .returning()
      member = inserted ?? null
    }

    if (!member) return reply.send(success({ joined: true, already: true }))

    await db
      .update(circles)
      .set({ memberCount: sql`${circles.memberCount} + 1` })
      .where(eq(circles.id, id))

    return reply.status(201).send(success({ joined: true, already: false, member }))
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
    // 守门 198 的出口形态:值由现值比较导出,没变就不发 UPDATE、不盖 updatedAt
    // (updatedAt 是增量读的消费源 —— tasks.ts since 补拉 / user-routes gte 窗口)
    const changed: Partial<{ status: number }> = existing.status === 0 ? {} : { status: 0 }
    if (Object.keys(changed).length === 0) {
      return reply.send(success({ left: true, already: true, member: existing }))
    }
    const [left] = await db
      .update(circleMembers)
      .set({ ...changed, updatedAt: new Date() })
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
