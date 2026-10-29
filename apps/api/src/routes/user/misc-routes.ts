// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 其他补充端点(5 个:/vip/benefits + /notifications/:id + /messages/:id + /categories + /coupons)。
 * (原 /analytics/track 已迁至 routes/analytics.ts,见文末注记。)
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { findNotificationById } from '../../db/notification-queries.js'
import { findMessageById } from '../../db/chat-queries.js'
import { findSiteCategories } from '../../db/site-categories-queries.js'
import { listVipLevels } from '../../db/vip-queries.js'
import { listUserCoupons } from '../../services/coupon-service.js'
import type { PromoCoupon, UserCoupon } from '@ihui/database'
import { parseIdParam } from './_shared.js'

/** 用户券状态词汇 = 库内词汇,三端(web 会员页 / RN / 小程序)一律按它发送与渲染 */
const myCouponsQuerySchema = z
  .object({
    status: z.transform(emptyToUndefined).pipe(z.enum(['unused', 'used', 'expired']).optional()),
    page: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(1).optional()),
    pageSize: z
      .transform(emptyToUndefined)
      .pipe(z.coerce.number().int().min(1).max(100).optional()),
  })
  .strict()

/** 投影出的行:字段名与 web `member/coupons` 页既有读取集逐字一致,新增键只加不改 */
interface MyCouponRow {
  id: string
  code: string
  name: string
  /** 券面值(分)。折扣券没有固定面额 ⇒ 0,真折扣看 discountRate(解释口径同 redeemCoupon) */
  amount: number
  discountRate: number | null
  type: PromoCoupon['type']
  minSpend: number
  status: UserCoupon['status']
  expiresAt: string
}

/** `unused` 但券已过期 ⇒ 读成 `expired`(库里靠清扫任务落状态,展示层不等它) */
function toMyCouponRow(r: UserCoupon & { coupon: PromoCoupon }, now = new Date()): MyCouponRow {
  const expired = new Date(r.coupon.expiresAt) < now
  return {
    id: r.id,
    code: r.coupon.code,
    name: r.coupon.name,
    amount: r.coupon.type === 'deduction' ? Number(r.coupon.value ?? 0) : 0,
    discountRate: r.coupon.type === 'discount' ? Number(r.coupon.value ?? 0) : null,
    type: r.coupon.type,
    minSpend: r.coupon.minSpend ?? 0,
    status: r.status === 'unused' && expired ? 'expired' : r.status,
    expiresAt: r.coupon.expiresAt.toISOString(),
  }
}

const miscRoutes: FastifyPluginAsync = async (server) => {
  server.get('/vip/benefits', async (_request, reply) => {
    const list = await listVipLevels(true)
    return reply.send(success({ list }))
  })

  server.get('/notifications/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const notification = await findNotificationById(id)
    return reply.send(success({ notification }))
  })

  server.get('/messages/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const message = await findMessageById(id)
    return reply.send(success({ message }))
  })

  server.get('/categories', async (request, reply) => {
    const type = (request.query as { type?: string } | null)?.type
    const list = await findSiteCategories({ type })
    return reply.send(success({ list }))
  })

  // GET /coupons - 我的优惠券(三端会员页共用同一份投影;归属主体只取承载层身份)
  server.get('/coupons', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const parsed = myCouponsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 不按 status 过滤取库:库里 'unused' 可能已过期(清扫任务还没落),按投影后的档位筛才自洽
    const rows = await listUserCoupons(userId)
    const all = rows.map((r) => toMyCouponRow(r))
    const list = parsed.data.status ? all.filter((c) => c.status === parsed.data.status) : all
    const page = parsed.data.page ?? 1
    const pageSize = parsed.data.pageSize ?? 20
    const offset = (page - 1) * pageSize
    return reply.send(
      success({ list: list.slice(offset, offset + pageSize), total: list.length, page, pageSize }),
    )
  })

  // 2026-08-10:原 /analytics/track 已迁移至 routes/analytics.ts(公开匿名上报,
  // 兼容批量/单事件)。本文件保留其他端点,不再定义 track 避免重复。
}

export default miscRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
