/**
 * 管理端插件市场统计路由(2026-07-22 新增)
 *
 * 端点(全部 requireAdmin):
 *  - GET /api/admin/plugins/stats/summary    总览指标(总安装/总点击/今日/活跃)
 *  - GET /api/admin/plugins/stats/top       热度榜 Top N(按 heat 排序)
 *  - GET /api/admin/plugins/stats/trend     按天趋势(installs/clicks/uninstalls)
 *
 * 热度公式: heat = installs * 10 + clicks * 1 + pins * 20 - uninstalls * 5
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import { success } from '../utils/response.js'
import {
  getPluginStatsSummary,
  getPluginStatsByPlugin,
  getPluginStatsTrend,
} from '../db/plugin-events-queries.js'

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(7),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const adminPluginStatsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // -------------------------------------------------------------------------
  // GET /stats/summary - 总览指标
  // -------------------------------------------------------------------------
  server.get('/stats/summary', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ code: 400, message: 'Invalid query', data: null })
    }
    const summary = await getPluginStatsSummary(parsed.data.days)
    return reply.send(success(summary))
  })

  // -------------------------------------------------------------------------
  // GET /stats/top - 热度榜 Top N
  // -------------------------------------------------------------------------
  server.get('/stats/top', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ code: 400, message: 'Invalid query', data: null })
    }
    const rows = await getPluginStatsByPlugin(parsed.data.limit)
    return reply.send(success(rows))
  })

  // -------------------------------------------------------------------------
  // GET /stats/trend - 按天趋势
  // -------------------------------------------------------------------------
  server.get('/stats/trend', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ code: 400, message: 'Invalid query', data: null })
    }
    const rows = await getPluginStatsTrend(parsed.data.days)
    return reply.send(success(rows))
  })
}
