/**
 * /api/admin/coupons 优惠券管理(2026-07-31 立,折扣券/满减券/裂变券三合一)。
 *
 * 端点清单:
 * 1. GET    /admin/coupons              — 列券(分页 + 筛选 type/enabled)
 * 2. POST   /admin/coupons              — 建券
 * 3. PATCH  /admin/coupons/:id          — 改券
 * 4. DELETE /admin/coupons/:id          — 删券
 * 5. GET    /admin/coupons/:id/stats    — 券统计(发行量/已领/已用/裂变转化)
 * 6. GET    /admin/coupons/:id/user-coupons — 领券记录
 * 7. POST   /admin/coupons/batch        — 批量生成(N 个随机码 + 模板)
 *
 * 复用 promo_coupons + user_coupons 表 + coupon-service.ts。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { promoCoupons } from '@ihui/database'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { paginationSchema, idParamSchema } from './_shared.js'
import {
  batchGenerateCoupons,
  listCoupons,
  getCouponStats,
  listUserCouponsByCoupon,
  generateCouponCode,
} from '../../services/coupon-service.js'

// 创建/批量生成券的共用 schema
const couponBodyBase = {
  name: z.string().min(1, '名称不能为空').max(128),
  type: z.enum(['discount', 'deduction', 'referral']),
  /** 折扣率(0-1)或减额(分) */
  value: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  /** 满减门槛(分) */
  minSpend: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  /** 裂变券:分享人得什么 */
  referrerGets: z.preprocess(emptyToUndefined, z.enum(['duplicate', 'credit']).optional()),
  /** 裂变券:分享人得多少(分) */
  referralValue: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  /** 适用模型列表,null=全部 */
  applicableModels: z.array(z.string()).nullable().optional(),
  /** 适用范围 */
  applicableScope: z.enum(['relay', 'subscription', 'all']).default('relay'),
  /** 总发行量,null=无限(不传 = 无限) */
  totalQuota: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  /** 每人限领 */
  perUserLimit: z.coerce.number().int().min(0).default(1),
  /** 生效时间(ISO 8601) */
  startsAt: z.string().datetime(),
  /** 过期时间(ISO 8601) */
  expiresAt: z.string().datetime(),
  /** 是否启用 */
  enabled: z.boolean().default(true),
}

const createBodySchema = z.object(couponBodyBase)

const updateBodySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  value: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  minSpend: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  referrerGets: z.preprocess(emptyToUndefined, z.enum(['duplicate', 'credit']).optional()),
  referralValue: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  applicableModels: z.array(z.string()).nullable().optional(),
  applicableScope: z.enum(['relay', 'subscription', 'all']).optional(),
  totalQuota: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  perUserLimit: z.coerce.number().int().min(0).optional(),
  startsAt: z.preprocess(emptyToUndefined, z.string().datetime().optional()),
  expiresAt: z.preprocess(emptyToUndefined, z.string().datetime().optional()),
  enabled: z.boolean().optional(),
})

const listQuerySchema = paginationSchema.extend({
  type: z.preprocess(emptyToUndefined, z.enum(['discount', 'deduction', 'referral']).optional()),
  enabled: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
})

const batchBodySchema = z.object({
  count: z.number().int().min(1).max(1000),
  template: z.object(couponBodyBase),
})

const adminCouponsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /admin/coupons — 列券 =====
  server.get('/admin/coupons', async (request, reply) => {
    const q = listQuerySchema.safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const result = await listCoupons({
        type: q.data.type,
        enabled: q.data.enabled,
        page: q.data.page,
        pageSize: q.data.pageSize,
      })
      return reply.send(
        success({
          items: result.items,
          total: result.total,
          page: q.data.page,
          pageSize: q.data.pageSize,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询优惠券列表失败'))
    }
  })

  // ===== 2. POST /admin/coupons — 建券 =====
  server.post('/admin/coupons', async (request, reply) => {
    const parsed = createBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const d = parsed.data
      const [row] = await db
        .insert(promoCoupons)
        .values({
          code: generateCouponCode(),
          name: d.name,
          type: d.type,
          value: d.value != null ? String(d.value) : null,
          minSpend: d.minSpend ?? null,
          referrerGets: d.referrerGets ?? null,
          referralValue: d.referralValue ?? null,
          applicableModels: d.applicableModels ?? null,
          applicableScope: d.applicableScope,
          totalQuota: d.totalQuota ?? null,
          perUserLimit: d.perUserLimit,
          startsAt: new Date(d.startsAt),
          expiresAt: new Date(d.expiresAt),
          enabled: d.enabled,
        })
        .returning()

      if (!row) return reply.status(500).send(error(500, '创建优惠券失败'))
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建优惠券失败'))
    }
  })

  // ===== 3. PATCH /admin/coupons/:id — 改券 =====
  server.patch('/admin/coupons/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const parsed = updateBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const d = parsed.data
      const set: Record<string, unknown> = { updatedAt: new Date() }
      if (d.name !== undefined) set.name = d.name
      if (d.value !== undefined) set.value = String(d.value)
      if (d.minSpend !== undefined) set.minSpend = d.minSpend
      if (d.referrerGets !== undefined) set.referrerGets = d.referrerGets
      if (d.referralValue !== undefined) set.referralValue = d.referralValue
      if (d.applicableModels !== undefined) set.applicableModels = d.applicableModels
      if (d.applicableScope !== undefined) set.applicableScope = d.applicableScope
      if (d.totalQuota !== undefined) set.totalQuota = d.totalQuota
      if (d.perUserLimit !== undefined) set.perUserLimit = d.perUserLimit
      if (d.startsAt !== undefined) set.startsAt = new Date(d.startsAt)
      if (d.expiresAt !== undefined) set.expiresAt = new Date(d.expiresAt)
      if (d.enabled !== undefined) set.enabled = d.enabled

      const [row] = await db
        .update(promoCoupons)
        .set(set)
        .where(eq(promoCoupons.id, p.data.id))
        .returning()

      if (!row) return reply.status(404).send(error(404, '优惠券不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新优惠券失败'))
    }
  })

  // ===== 4. DELETE /admin/coupons/:id — 删券 =====
  server.delete('/admin/coupons/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))

    try {
      const [row] = await db
        .delete(promoCoupons)
        .where(eq(promoCoupons.id, p.data.id))
        .returning({ id: promoCoupons.id })

      if (!row) return reply.status(404).send(error(404, '优惠券不存在'))
      return reply.send(success({ id: row.id, deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除优惠券失败'))
    }
  })

  // ===== 5. GET /admin/coupons/:id/stats — 券统计 =====
  server.get('/admin/coupons/:id/stats', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))

    try {
      const stats = await getCouponStats(p.data.id)
      return reply.send(success(stats))
    } catch (e) {
      request.log.error(e)
      const msg = e instanceof Error ? e.message : '查询统计失败'
      if (msg === 'coupon_not_found') {
        return reply.status(404).send(error(404, '优惠券不存在'))
      }
      return reply.status(500).send(error(500, '查询券统计失败'))
    }
  })

  // ===== 6. GET /admin/coupons/:id/user-coupons — 领券记录 =====
  server.get('/admin/coupons/:id/user-coupons', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const result = await listUserCouponsByCoupon(p.data.id, q.data.page, q.data.pageSize)
      return reply.send(
        success({
          items: result.items,
          total: result.total,
          page: q.data.page,
          pageSize: q.data.pageSize,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询领券记录失败'))
    }
  })

  // ===== 7. POST /admin/coupons/batch — 批量生成 =====
  server.post('/admin/coupons/batch', async (request, reply) => {
    const parsed = batchBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const d = parsed.data
      const t = d.template
      const created = await batchGenerateCoupons({
        count: d.count,
        template: {
          name: t.name,
          type: t.type,
          value: t.value != null ? String(t.value) : null,
          minSpend: t.minSpend ?? null,
          referrerGets: t.referrerGets ?? null,
          referralValue: t.referralValue ?? null,
          applicableModels: t.applicableModels ?? null,
          applicableScope: t.applicableScope,
          totalQuota: t.totalQuota ?? null,
          perUserLimit: t.perUserLimit,
          startsAt: new Date(t.startsAt),
          expiresAt: new Date(t.expiresAt),
          enabled: t.enabled,
        },
      })
      return reply.status(201).send(
        success({
          count: created.length,
          coupons: created,
        }),
      )
    } catch (e) {
      request.log.error(e)
      const msg = e instanceof Error ? e.message : '批量生成失败'
      return reply.status(400).send(error(400, msg))
    }
  })
}

export default adminCouponsRoutes
