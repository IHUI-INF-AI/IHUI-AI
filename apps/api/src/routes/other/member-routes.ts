// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会员权益 + 积分兑换(从 frontend-stub-other-routes.ts 拆分)。
 * GET /member/benefits, GET/PUT /member/settings,
 * GET /points/redeem, POST /points/redeem/:id(兑换动作,2026-08-26 补齐)
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { asc, eq } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { dbRead } from '../../db/index.js'
import { levels, pointRedeemItems } from '@ihui/database'
import { findUserPreferences, upsertUserPreference } from '../../db/user-preferences-queries.js'
import { authenticate } from '../../plugins/auth.js'
import { ensureUserPoints, findPointTransactions } from '../../db/gamification-queries.js'
import { spendPoints } from '../../services/points-service.js'

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

  // GET /points/redeem — 积分兑换商品列表(登录时附带 balance,兼容 web/mobile 两端字段)
  server.get('/points/redeem', async (request, reply) => {
    const rows = await dbRead
      .select({
        id: pointRedeemItems.id,
        name: pointRedeemItems.name,
        points: pointRedeemItems.points,
        image: pointRedeemItems.image,
      })
      .from(pointRedeemItems)
      .orderBy(asc(pointRedeemItems.sortOrder), asc(pointRedeemItems.name))
    const list = rows.map((r) => ({
      id: r.id,
      name: r.name,
      points: r.points,
      image: r.image,
      // 移动端 PointsMallItem 字段兼容
      pointsCost: r.points,
      cover: r.image,
      description: '',
      stock: 0,
    }))
    const userId = request.userId ?? request.jwtPayload?.userId
    let balance: number | undefined
    if (userId) {
      // balance 为附带数据:查询失败不应导致商品列表整体 500
      try {
        balance = (await ensureUserPoints(userId)).points
      } catch {
        balance = undefined
      }
    }
    return reply.send(success({ list, total: list.length, ...(balance !== undefined ? { balance } : {}) }))
  })

  // POST /points/redeem/:id — 积分兑换商品(扣积分,幂等:同一商品重复兑换 409)
  server.post<{ Params: { id: string } }>(
    '/points/redeem/:id',
    async (request, reply) => {
      try {
        await authenticate(request)
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
        return reply.status(statusCode).send(error(statusCode, (e as Error).message || '请先登录'))
      }
      const userId = request.userId!
      const { id } = request.params
      const [item] = await dbRead
        .select({ id: pointRedeemItems.id, points: pointRedeemItems.points })
        .from(pointRedeemItems)
        .where(eq(pointRedeemItems.id, id))
        .limit(1)
      if (!item) {
        return reply.status(404).send(error(404, '兑换商品不存在'))
      }
      // 防重复兑换:description='redeem:<itemId>' 已有流水则拒绝
      const { list } = await findPointTransactions({ userId, page: 1, pageSize: 20, source: 'redeem' })
      if (list.some((t) => t.description === `redeem:${id}`)) {
        return reply.status(409).send(error(409, '该商品已兑换过'))
      }
      const balance = await ensureUserPoints(userId)
      if (balance.points < item.points) {
        return reply.status(400).send(error(400, '积分余额不足'))
      }
      const result = await spendPoints(userId, item.points, 'redeem', `redeem:${id}`, id)
      return reply.send(success({ points: result.points, redeemed: item.points }))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
