/**
 * /api/admin/relay-commission Relay 返佣管理后台(2026-07-31 立)。
 *
 * 端点清单:
 * 1. GET    /admin/relay-commission/records  — 全平台返佣记录(分页 + 筛选 sourceUserId/beneficiaryUserId/status)
 * 2. GET    /admin/relay-commission/stats     — 统计(今日/7d/30d 返佣总额 + 冻结/已释放总额)
 * 3. POST   /admin/relay-commission/release   — 手动触发释放冻结返佣(admin 操作)
 * 4. GET    /admin/relay-commission/settings  — 返佣率配置(level1/level2/frozenDays)
 * 5. PATCH  /admin/relay-commission/settings  — 修改返佣率配置(需 admin)
 *
 * 复用 relay-commission-service.ts + system_configs 表(category='relay_commission')。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { paginationSchema } from './_shared.js'
import {
  listAllCommissions,
  getCommissionStats,
  releaseExpiredCommissions,
  getCommissionConfig,
  setCommissionConfig,
} from '../../services/relay-commission-service.js'

const recordsQuerySchema = paginationSchema.extend({
  /** 被邀请人(消费方)筛选 */
  sourceUserId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  /** 邀请人(收益方)筛选 */
  beneficiaryUserId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  /** 状态筛选:frozen/released/expired */
  status: z.preprocess(emptyToUndefined, z.enum(['frozen', 'released', 'expired']).optional()),
})

const settingsBodySchema = z
  .object({
    /** 父级返佣率(0-1,0.05=5%) */
    level1Rate: z.number().min(0).max(1).optional(),
    /** 祖父级返佣率(0-1,0.01=1%) */
    level2Rate: z.number().min(0).max(1).optional(),
    /** 冻结期天数(1-365) */
    frozenDays: z.number().int().min(1).max(365).optional(),
  })
  .refine(
    (d) => d.level1Rate !== undefined || d.level2Rate !== undefined || d.frozenDays !== undefined,
    { message: '至少填写一个配置项(level1Rate / level2Rate / frozenDays)' },
  )

const adminRelayCommissionRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /relay-commission/records — 全平台返佣记录 =====
  server.get('/relay-commission/records', async (request, reply) => {
    const q = recordsQuerySchema.safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const result = await listAllCommissions({
        sourceUserId: q.data.sourceUserId,
        beneficiaryUserId: q.data.beneficiaryUserId,
        status: q.data.status,
        page: q.data.page,
        pageSize: q.data.pageSize,
      })
      return reply.send(
        success({
          records: result.records,
          total: result.total,
          page: q.data.page,
          pageSize: q.data.pageSize,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询返佣记录失败'))
    }
  })

  // ===== 2. GET /relay-commission/stats — 统计 =====
  server.get('/relay-commission/stats', async (_request, reply) => {
    try {
      const stats = await getCommissionStats()
      return reply.send(success(stats))
    } catch (e) {
      _request.log.error(e)
      return reply.status(500).send(error(500, '查询返佣统计失败'))
    }
  })

  // ===== 3. POST /relay-commission/release — 手动触发释放冻结返佣 =====
  server.post('/relay-commission/release', async (request, reply) => {
    const userId = request.userId
    try {
      const result = await releaseExpiredCommissions(200)
      request.log.info(
        { userId, released: result.releasedCount, cents: result.releasedCents },
        'admin 手动触发 relay 返佣释放',
      )
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '释放冻结返佣失败'))
    }
  })

  // ===== 4. GET /relay-commission/settings — 返佣率配置 =====
  server.get('/relay-commission/settings', async (_request, reply) => {
    try {
      const config = await getCommissionConfig()
      return reply.send(success(config))
    } catch (e) {
      _request.log.error(e)
      return reply.status(500).send(error(500, '查询返佣配置失败'))
    }
  })

  // ===== 5. PATCH /relay-commission/settings — 修改返佣率配置 =====
  server.patch('/relay-commission/settings', async (request, reply) => {
    const parsed = settingsBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    try {
      const config = await setCommissionConfig(parsed.data, userId)
      return reply.send(success(config))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '修改返佣配置失败'))
    }
  })
}

export default adminRelayCommissionRoutes
