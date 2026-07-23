/**
 * 会员权益 + 积分兑换(从 frontend-stub-other-routes.ts 拆分)。
 * GET /member/benefits, GET/PUT /member/settings, GET /points/redeem
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { asc } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { dbRead } from '../../db/index.js'
import { levels, pointRedeemItems } from '@ihui/database'
import { findUserPreferences, upsertUserPreference } from '../../db/user-preferences-queries.js'

export const memberRoutes: FastifyPluginAsync = async (server) => {
  // GET /member/benefits — 会员等级权益
  server.get('/member/benefits', async (_request, reply) => {
    const list = await dbRead.select().from(levels).orderBy(asc(levels.level))
    return reply.send(success({ list }))
  })

  // GET /member/settings — 会员偏好设置(userPreferences group=member)
  server.get('/member/settings', async (request, reply) => {
    const { list, total } = await findUserPreferences(request.userId!, 'member')
    return reply.send(success({ list, total }))
  })

  // PUT /member/settings — 更新会员偏好设置
  server.put('/member/settings', async (request, reply) => {
    const body = z
      .object({
        items: z
          .array(
            z.object({
              key: z.string().min(1).max(100),
              value: z.string().nullable(),
            }),
          )
          .min(1),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const results = await Promise.all(
      body.data.items.map((item) =>
        upsertUserPreference(request.userId!, 'member', item.key, item.value),
      ),
    )
    return reply.send(success({ updated: results.length }))
  })

  // GET /points/redeem — 积分兑换商品列表
  server.get('/points/redeem', async (_request, reply) => {
    const list = await dbRead
      .select({
        id: pointRedeemItems.id,
        name: pointRedeemItems.name,
        points: pointRedeemItems.points,
        image: pointRedeemItems.image,
      })
      .from(pointRedeemItems)
      .orderBy(asc(pointRedeemItems.sortOrder), asc(pointRedeemItems.name))
    return reply.send(success({ list, total: list.length }))
  })
}
