/**
 * /api/admin/redemption-codes 兑换码管理(P0-5 刮刮卡式裂变充值,2026-07-31 立)。
 *
 * 端点清单:
 * 1. POST   /admin/redemption-codes/batch    — 批量生成兑换码(count/faceValueCents/tokenAmount/expiresAt?)
 * 2. GET    /admin/redemption-codes          — 列表(分页 + 筛选 status/batchId)
 * 3. GET    /admin/redemption-codes/stats    — 统计(total/unused/used/expired/disabled + 总面值)
 * 4. GET    /admin/redemption-codes/:id      — 详情
 * 5. PATCH  /admin/redemption-codes/:id/disable — 禁用(unused → disabled)
 *
 * 复用 redemption_codes 表 + redemption-code-service.ts。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { dbRead } from '../../db/index.js'
import { redemptionCodes } from '@ihui/database'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { paginationSchema, idParamSchema } from './_shared.js'
import {
  batchGenerateCodes,
  listCodes,
  disableCode,
  getStats,
} from '../../services/redemption-code-service.js'

const batchBodySchema = z.object({
  /** 生成数量(1-1000) */
  count: z.number().int().min(1).max(1000),
  /** 面值(分,如 990 = ¥9.90) */
  faceValueCents: z.number().int().min(0),
  /** 兑换后到账 token 数 */
  tokenAmount: z.number().int().positive(),
  /** 过期时间(ISO 8601 字符串,可选) */
  expiresAt: z
    .transform(emptyToUndefined).pipe(z.iso.datetime().optional())
    .transform((v) => (v ? new Date(v) : null)),
})

const listQuerySchema = paginationSchema.extend({
  /** 状态筛选:unused/used/expired/disabled */
  status: z.transform(emptyToUndefined).pipe(
    z.enum(['unused', 'used', 'expired', 'disabled']).optional(),
  ),
  /** 批次 ID 筛选 */
  batchId: z.transform(emptyToUndefined).pipe(z.uuid().optional()),
})

const adminRedemptionCodesRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. POST /admin/redemption-codes/batch — 批量生成 =====
  server.post('/admin/redemption-codes/batch', async (request, reply) => {
    const parsed = batchBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    try {
      const codes = await batchGenerateCodes({
        count: parsed.data.count,
        faceValueCents: parsed.data.faceValueCents,
        tokenAmount: parsed.data.tokenAmount,
        expiresAt: parsed.data.expiresAt,
        createdBy: userId,
      })
      return reply.send(
        success({
          batchId: codes[0]?.batchId ?? null,
          count: codes.length,
          codes,
        }),
      )
    } catch (e) {
      request.log.error(e)
      const message = e instanceof Error ? e.message : '批量生成失败'
      return reply.status(400).send(error(400, message))
    }
  })

  // ===== 2. GET /admin/redemption-codes — 列表 =====
  server.get('/admin/redemption-codes', async (request, reply) => {
    const q = listQuerySchema.safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const result = await listCodes({
        status: q.data.status,
        batchId: q.data.batchId,
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
      return reply.status(500).send(error(500, '查询兑换码列表失败'))
    }
  })

  // ===== 3. GET /admin/redemption-codes/stats — 统计 =====
  server.get('/admin/redemption-codes/stats', async (_request, reply) => {
    try {
      const stats = await getStats()
      return reply.send(success(stats))
    } catch (e) {
      _request.log.error(e)
      return reply.status(500).send(error(500, '查询兑换码统计失败'))
    }
  })

  // ===== 4. GET /admin/redemption-codes/:id — 详情 =====
  server.get('/admin/redemption-codes/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))

    try {
      const [row] = await dbRead
        .select()
        .from(redemptionCodes)
        .where(eq(redemptionCodes.id, p.data.id))
        .limit(1)

      if (!row) return reply.status(404).send(error(404, '兑换码不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询兑换码详情失败'))
    }
  })

  // ===== 5. PATCH /admin/redemption-codes/:id/disable — 禁用 =====
  server.patch('/admin/redemption-codes/:id/disable', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))

    try {
      const code = await disableCode(p.data.id)
      return reply.send(success(code))
    } catch (e) {
      request.log.error(e)
      const message = e instanceof Error ? e.message : '禁用失败'
      if (message === 'code_not_found') {
        return reply.status(404).send(error(404, '兑换码不存在'))
      }
      if (message === 'cannot_disable_used') {
        return reply.status(400).send(error(400, '已使用的兑换码不可禁用'))
      }
      return reply.status(500).send(error(500, '禁用兑换码失败'))
    }
  })
}

export default adminRedemptionCodesRoutes
