// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 其他补充端点(7 个:/vip/benefits + /notifications/:id + /messages/:id + /categories
 * + /coupons + /coupons/available + /coupons/:couponId/claim)。
 * (原 /analytics/track 已迁至 routes/analytics.ts,见文末注记。)
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { findNotificationById } from '../../db/notification-queries.js'
import { findMessageById } from '../../db/chat-queries.js'
import { findSiteCategories } from '../../db/site-categories-queries.js'
import { listVipLevels } from '../../db/vip-queries.js'
import { authenticate } from '../../plugins/auth.js'
import {
  claimCouponById,
  claimFailureReasonOf,
  listAvailableCoupons,
  listUserCoupons,
} from '../../services/coupon-service.js'
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

/**
 * 用户面登录闸:承载层(src/routes/user/index.ts 的 preHandler)已认证时直接复用;
 * 独立挂载/测试直挂时当场 authenticate 一次。主体一律取鉴权结果 `request.userId`,
 * 不认 query/body 里的自报身份(AGENTS §5「认证不等于授权」)。
 */
async function requireUserId(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<string | null> {
  if (!request.userId) {
    try {
      await authenticate(request)
    } catch {
      reply.status(401).send(error(401, '操作失败,请稍后重试'))
      return null
    }
  }
  const userId = request.userId
  if (!userId) {
    reply.status(401).send(error(401, '未登录'))
    return null
  }
  return userId
}

/** 领券中心列表 query(沿用「我的券」同款 page/pageSize + .strict()) */
const availableCouponsQuerySchema = z
  .object({
    page: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(1).optional()),
    pageSize: z
      .transform(emptyToUndefined)
      .pipe(z.coerce.number().int().min(1).max(100).optional()),
  })
  .strict()

/** 领取 body:只收裂变券的来源券 id;其余字段(含 userId 这类「代领」自报)一律拒 */
const claimCouponBodySchema = z
  .object({
    referrerUserCouponId: z.uuid({ error: '无效的邀请券 ID' }).optional(),
  })
  .strict()

/** 领取路径参数:券模板 id(uuid 形状闸排在进 SQL 之前) */
const claimCouponParamsSchema = z.object({ couponId: z.uuid({ error: '无效的优惠券 ID' }) })

/**
 * 领券中心可领券的投影。
 * **刻意不含 code**:券码是「按码领取」的领取凭据,公开列表里出现它,等于把那个入口
 * 连同凭据一起发给所有人 —— 券码只出现在用户自己已领取的券上(GET /coupons)。
 */
interface AvailableCouponRow {
  id: string
  name: string
  type: PromoCoupon['type']
  /** 折扣券 = 折扣率(0.80=8 折);满减/裂变券 = 减额(分);null = 模板未配 */
  value: number | null
  minSpend: number | null
  perUserLimit: number
  startsAt: string
  expiresAt: string
  /** 剩余可领数;totalQuota 为 null(不限量)⇒ null */
  remaining: number | null
}

function toAvailableCouponRow(coupon: PromoCoupon): AvailableCouponRow {
  return {
    id: coupon.id,
    name: coupon.name,
    type: coupon.type,
    value: coupon.value === null ? null : Number(coupon.value),
    minSpend: coupon.minSpend,
    perUserLimit: coupon.perUserLimit,
    startsAt: coupon.startsAt.toISOString(),
    expiresAt: coupon.expiresAt.toISOString(),
    remaining:
      coupon.totalQuota === null ? null : Math.max(0, coupon.totalQuota - coupon.issuedCount),
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

  // GET /coupons/available - 领券中心:现在可领的券模板(2026-10-29 立)
  //
  // 路由顺序核过:`/coupons/available` 是静态段,find-my-way 静态段优先于参数段;且 user 面
  // 从未注册过 `/coupons/:id`(全仓只有 /admin/coupons/:id 一族,挂在 /api/admin 前缀下),
  // promotions.ts 的 `POST /coupons/verify` 是两段路径,与下面三段 `/coupons/:couponId/claim`
  // 不同形 ⇒ 两条新路由都不会被既有参数路由抢走。
  server.get('/coupons/available', async (request, reply) => {
    if (!(await requireUserId(request, reply))) return
    const parsed = availableCouponsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const page = parsed.data.page ?? 1
    const pageSize = parsed.data.pageSize ?? 20
    const { items, total } = await listAvailableCoupons({ page, pageSize })
    // SQL 已按「现在可领」收窄;响应前再用同一判据核一遍(查询到响应之间库存/时间会走)。
    // 判据单源 = claimFailureReasonOf,列表层不另写一份过滤条件。
    const now = new Date()
    const list = items
      .filter((coupon) => claimFailureReasonOf(coupon, now) === null)
      .map((coupon) => toAvailableCouponRow(coupon))
    return reply.send(success({ list, total, page, pageSize }))
  })

  // POST /coupons/:couponId/claim - 领券中心:按券模板 id 领取(主体只认鉴权结果)
  server.post('/coupons/:couponId/claim', async (request, reply) => {
    const userId = await requireUserId(request, reply)
    if (!userId) return
    const parsed = claimCouponParamsSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = claimCouponBodySchema.safeParse(request.body ?? {})
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      // userId 只来自鉴权结果;body/query 里的任何「代领」自报都会被 .strict() 当场拒掉
      const result = await claimCouponById(
        userId,
        parsed.data.couponId,
        body.data.referrerUserCouponId,
      )
      if (!result.success) {
        // 与 developer-relay.ts 的按码领取同一套 reason → 状态映射(文案按「按 id 领取」语境)
        const reasonMap: Record<string, { status: number; msg: string }> = {
          code_not_found: { status: 404, msg: '优惠券不存在' },
          disabled: { status: 403, msg: '优惠券已被禁用' },
          not_started: { status: 410, msg: '优惠券活动尚未开始' },
          expired: { status: 410, msg: '优惠券已过期' },
          sold_out: { status: 410, msg: '优惠券已发放完毕' },
          per_user_limit_exceeded: { status: 409, msg: '已超过每人限领数量' },
          insert_failed: { status: 500, msg: '领取失败' },
        }
        const mapped = reasonMap[result.reason ?? ''] ?? {
          status: 400,
          msg: result.reason ?? '领取失败',
        }
        return reply.status(mapped.status).send(error(mapped.status, mapped.msg))
      }
      const userCoupon = result.userCoupon
      if (!userCoupon) {
        // success=true 必带 userCoupon;缺了是本层契约破损,不是业务失败
        return reply.status(500).send(error(500, '领取优惠券失败'))
      }
      return reply.send(
        success({
          id: userCoupon.id,
          couponId: userCoupon.couponId,
          status: userCoupon.status,
          createdAt: userCoupon.createdAt.toISOString(),
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '领取优惠券失败'))
    }
  })

  // 2026-08-10:原 /analytics/track 已迁移至 routes/analytics.ts(公开匿名上报,
  // 兼容批量/单事件)。本文件保留其他端点,不再定义 track 避免重复。
}

export default miscRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
