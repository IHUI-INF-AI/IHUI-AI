// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 商品(G-962 B8)路由 — 购物车商品分页查询。
 *
 * 路径(在 index.ts 以 prefix:'/api' 注册 → /api/goods/select):
 *   GET /goods/select — 在架商品分页查询(page/pageSize),响应 { list, total, page, pageSize }
 *
 * 消费方:packages/api-client/src/endpoints/goods.ts selectGoods(),
 * mobile-rn CartScreen 与 miniapp pkg-shop/cart 共用(均读 data.list)。
 * 数据源 zhs_product(status=1)公开目录数据,不含用户私有字段。
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { asc, eq, sql } from 'drizzle-orm'
import { zhsProduct } from '@ihui/database'
import { db } from '../db/index.js'
import { success, error } from '../utils/response.js'

const selectGoodsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const goodsRoutes: FastifyPluginAsync = async (server) => {
  // GET /goods/select — 在架商品分页
  server.get('/goods/select', async (request, reply) => {
    const parsed = selectGoodsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsed.data
    const where = eq(zhsProduct.status, 1)
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(zhsProduct)
        .where(where)
        .orderBy(asc(zhsProduct.sort), asc(zhsProduct.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(zhsProduct)
        .where(where),
    ])
    // 字段名对齐 CartGoods 适配层(title/name/price/quantity),空字段不伪造
    const list = rows.map((r) => ({
      id: String(r.id),
      title: r.name ?? '',
      name: r.name ?? '',
      price: r.price ?? 0,
      quantity: 1,
      type: r.type ?? '',
      tokenAmount: r.tokenAmount ?? 0,
      billingPeriod: r.billingPeriod,
      isRecurring: r.isRecurring,
    }))
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })
}
