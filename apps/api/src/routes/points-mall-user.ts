// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 积分商城用户端(2026-09-30 立)。
 * 读 points_mall_products(商品),写 points_mall_orders(订单)+ 积分流水(spendPoints)。
 * 旧 /points/redeem(读 point_redeem_items、无库存/限购/订单)逻辑不动,见
 * other/member-routes.ts 的 DEPRECATED 注释,新端点是其替代。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, asc, eq, gt, sql } from 'drizzle-orm'
import { success, error } from '../utils/response.js'
import { db, dbRead } from '../db/index.js'
import { pointsMallOrders, pointsMallProducts } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { ensureUserPoints } from '../db/gamification-queries.js'
import { spendPoints } from '../services/points-service.js'

const redeemParamsSchema = z
  .object({
    id: z.string().uuid('商品 id 非法'),
  })
  .strict()

function inWindow(startTime: Date | null, endTime: Date | null, now: Date): boolean {
  if (startTime && now < startTime) return false
  if (endTime && now > endTime) return false
  return true
}

export const pointsMallUserRoutes: FastifyPluginAsync = async (server) => {
  // GET /points/mall/redeem — 仅 status='on' 且时间窗内商品(登录时附带 balance,查失败不 500)
  server.get('/points/mall/redeem', async (request, reply) => {
    const rows = await dbRead
      .select({
        id: pointsMallProducts.id,
        name: pointsMallProducts.name,
        cover: pointsMallProducts.cover,
        pointsCost: pointsMallProducts.pointsCost,
        stock: pointsMallProducts.stock,
        sold: pointsMallProducts.sold,
        limitPerUser: pointsMallProducts.limitPerUser,
        startTime: pointsMallProducts.startTime,
        endTime: pointsMallProducts.endTime,
      })
      .from(pointsMallProducts)
      .where(eq(pointsMallProducts.status, 'on'))
      .orderBy(asc(pointsMallProducts.createdAt), asc(pointsMallProducts.name))
    const now = new Date()
    const list = rows
      .filter((r) => inWindow(r.startTime, r.endTime, now))
      .map((r) => ({
        id: r.id,
        name: r.name,
        cover: r.cover,
        pointsCost: r.pointsCost,
        stock: r.stock,
        sold: r.sold,
        limitPerUser: r.limitPerUser,
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
    return reply.send(success({ list, ...(balance !== undefined ? { balance } : {}) }))
  })

  // POST /points/mall/redeem/:id — 积分兑换商城商品(落单+扣积分+stock-1/sold+1)
  server.post<{ Params: z.infer<typeof redeemParamsSchema> }>(
    '/points/mall/redeem/:id',
    async (request, reply) => {
      try {
        await authenticate(request)
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
        return reply.status(statusCode).send(error(statusCode, (e as Error).message || '请先登录'))
      }
      const userId = request.userId!
      const parsed = redeemParamsSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { id } = parsed.data
      const [product] = await dbRead
        .select()
        .from(pointsMallProducts)
        .where(eq(pointsMallProducts.id, id))
        .limit(1)
      if (!product) {
        return reply.status(404).send(error(404, '兑换商品不存在'))
      }
      if (product.status !== 'on') {
        return reply.status(400).send(error(400, '商品已下架'))
      }
      const now = new Date()
      if (product.startTime && now < product.startTime) {
        return reply.status(400).send(error(400, '兑换尚未开始'))
      }
      if (product.endTime && now > product.endTime) {
        return reply.status(400).send(error(400, '兑换已结束'))
      }
      if (product.stock <= 0) {
        return reply.status(400).send(error(400, '库存不足'))
      }
      if (product.limitPerUser > 0) {
        // 归属预查询（与下方库存 UPDATE 同函数体）：以令牌主体 userId 限死本批 productId，
        // 订单行归属 = 下单人本人，库存扣减只在该判定通过后发生。
        const myOrders = await dbRead
          .select({ id: pointsMallOrders.id })
          .from(pointsMallOrders)
          .where(and(eq(pointsMallOrders.userId, userId), eq(pointsMallOrders.productId, id)))
        if (myOrders.length >= product.limitPerUser) {
          return reply.status(409).send(error(409, '已达个人兑换上限'))
        }
      }
      const balance = await ensureUserPoints(userId)
      if (balance.points < product.pointsCost) {
        return reply.status(400).send(error(400, '积分余额不足'))
      }
      let pointsAfter: number
      try {
        const result = await spendPoints(
          userId,
          product.pointsCost,
          'mall-redeem',
          `mall-redeem:${id}`,
          id,
        )
        pointsAfter = result.points.points
      } catch (e) {
        const message = (e as Error).message || '兑换失败'
        // spend 路径原子 UPDATE:并发扣光时抛"积分余额不足",仍是 400 语义
        const statusCode = message.includes('积分余额不足') ? 400 : 500
        return reply.status(statusCode).send(error(statusCode, message))
      }
      const orderRows = await db
        .insert(pointsMallOrders)
        .values({ userId, productId: id, pointsCost: product.pointsCost })
        .returning({ id: pointsMallOrders.id })
      const orderId = orderRows[0]?.id ?? ''
      // 并发兜底:仅当 stock>0 才扣减，避免超卖把库存打成负数
      await db
        .update(pointsMallProducts)
        .set({
          stock: sql`${pointsMallProducts.stock} - 1`,
          sold: sql`${pointsMallProducts.sold} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(pointsMallProducts.id, id), gt(pointsMallProducts.stock, 0)))
      return reply.send(success({ orderId, points: pointsAfter, redeemed: product.pointsCost }))
    },
  )
}
