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

/**
 * 兑换链内的业务拒绝:带状态码抛出,由事务外层一次性映射成响应。
 * 住在事务里意味着抛出即回滚 ⇒ 不会出现"库存扣了、积分没扣"的半截账。
 */
class RedeemError extends Error {
  readonly statusCode: number
  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
  }
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
      // 兑换是一条"占库存 → 扣积分 → 落订单"的资金链,必须全有或全无。
      // 修前的形态有三个洞:① 商品(库存/价格/上下架窗口)读的是 dbRead 副本 ⇒ 判定可以基于滞后值;
      // ② 三步各开各的连接、无事务 ⇒ 积分扣了订单没落(或反之)的半截态无人偿还;
      // ③ 那条带 stock>0 守卫的条件 UPDATE **丢弃了影响行数** ⇒ 并发把库存抢空时扣减静默 no-op,
      //    而积分照扣、订单照插、还回 200 —— 这正是超卖不退款,且 sold 也不涨,账面对不上。
      // 现在:主库事务 + 商品行锁(FOR UPDATE)串行化并发兑换;每一步都取回实际影响行。
      try {
        const outcome = await db.transaction(async (tx) => {
          const [product] = await tx
            .select()
            .from(pointsMallProducts)
            .where(eq(pointsMallProducts.id, id))
            .for('update')
            .limit(1)
          if (!product) throw new RedeemError(404, '兑换商品不存在')
          if (product.status !== 'on') throw new RedeemError(400, '商品已下架')
          const now = new Date()
          if (product.startTime && now < product.startTime) throw new RedeemError(400, '兑换尚未开始')
          if (product.endTime && now > product.endTime) throw new RedeemError(400, '兑换已结束')

          if (product.limitPerUser > 0) {
            // 归属预查询与库存扣减同住本事务:以令牌主体 userId 限死本批 productId,
            // 订单行归属 = 下单人本人,扣减只在该判定通过后发生。
            const mine = await tx
              .select({ n: sql<number>`count(*)::int` })
              .from(pointsMallOrders)
              .where(and(eq(pointsMallOrders.userId, userId), eq(pointsMallOrders.productId, id)))
            if ((mine[0]?.n ?? 0) >= product.limitPerUser) throw new RedeemError(409, '已达个人兑换上限')
          }

          // ① 先占库存:守卫条件 UPDATE + returning,空集即"这一笔没占到"(并发抢空),不当已扣。
          const stockRows = await tx
            .update(pointsMallProducts)
            .set({
              stock: sql`${pointsMallProducts.stock} - 1`,
              sold: sql`${pointsMallProducts.sold} + 1`,
              updatedAt: now,
            })
            .where(and(eq(pointsMallProducts.id, id), gt(pointsMallProducts.stock, 0)))
            .returning({ id: pointsMallProducts.id })
          if (!stockRows[0]) throw new RedeemError(400, '库存不足')

          // ② 扣积分(同一事务;spend 分支自身即 `points >= amount` 守卫式原子 UPDATE)
          const spent = await spendPoints(
            userId,
            product.pointsCost,
            'mall-redeem',
            `mall-redeem:${id}`,
            id,
            tx,
          )

          // ③ 落订单(同一事务);空集 = 下单没写成,整个事务回滚,库存与积分一起退回
          const orderRows = await tx
            .insert(pointsMallOrders)
            .values({ userId, productId: id, pointsCost: product.pointsCost })
            .returning({ id: pointsMallOrders.id })
          const orderId = orderRows[0]?.id
          if (!orderId) throw new RedeemError(500, '兑换下单失败')

          return { orderId, points: spent.points.points, redeemed: product.pointsCost }
        })
        return reply.send(success(outcome))
      } catch (e) {
        if (e instanceof RedeemError) {
          return reply.status(e.statusCode).send(error(e.statusCode, e.message))
        }
        const message = (e as Error).message || '兑换失败'
        // spend 路径原子 UPDATE:并发扣光时抛"积分余额不足",仍是 400 语义
        const statusCode = message.includes('积分余额不足') ? 400 : 500
        if (statusCode === 500) request.log.error({ err: e }, '[points-mall] 兑换事务失败')
        return reply.status(statusCode).send(error(statusCode, message))
      }
    },
  )
}
