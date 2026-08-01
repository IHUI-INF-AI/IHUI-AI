/**
 * /api/admin/topup 充值折扣配置管理(2026-07-31 立)。
 *
 * 端点清单:
 * 1. GET   /admin/topup/config   — 读取阶梯折扣配置
 * 2. PATCH /admin/topup/config   — 更新阶梯折扣配置(需 admin)
 * 3. POST  /admin/topup/preview  — 预览阶梯折扣(输入 amount + method,返回到账计算)
 *
 * 复用 topup-discount-service.ts + system_configs 表(category='topup_discount')。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import {
  getTopupConfig,
  updateTopupConfig,
  calculateTopupBonus,
} from '../../services/topup-discount-service.js'

const tierSchema = z.object({
  minAmount: z.number().nonnegative(),
  multiplier: z.number().positive(),
  bonus: z.number().nonnegative(),
})

const configBodySchema = z.object({
  tiers: z.array(tierSchema),
  customAmounts: z.array(z.number().positive()),
  minTopupByMethod: z.record(z.string(), z.number().nonnegative()),
})

const previewBodySchema = z.object({
  amount: z.number().positive(),
  method: z.string().min(1),
})

const adminTopupConfigRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /topup/config — 读取配置 =====
  server.get('/topup/config', async (_request, reply) => {
    try {
      const config = await getTopupConfig()
      return reply.send(success(config))
    } catch (e) {
      _request.log.error(e)
      return reply.status(500).send(error(500, '查询充值折扣配置失败'))
    }
  })

  // ===== 2. PATCH /topup/config — 更新配置 =====
  server.patch('/topup/config', async (request, reply) => {
    const parsed = configBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      await updateTopupConfig(parsed.data)
      const config = await getTopupConfig()
      return reply.send(success(config))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新充值折扣配置失败'))
    }
  })

  // ===== 3. POST /topup/preview — 预览阶梯折扣 =====
  server.post('/topup/preview', async (request, reply) => {
    const parsed = previewBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const result = await calculateTopupBonus(parsed.data.amount, parsed.data.method)
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '计算充值折扣失败'))
    }
  })
}

export default adminTopupConfigRoutes
