import type { FastifyPluginAsync } from 'fastify'
import { success, error } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { generateInsights } from '../../services/relay-insights-service.js'

/**
 * /api/admin/relay/insights 运营洞察(2026-09-17 立,补强 62,差异化能力)。
 *
 * 端点(requireAdmin):
 * 1. GET /relay/insights        — 生成并返回全部洞察(错误突增/成本异常/容量预警/慢调用/免费敞口)
 * 2. GET /relay/insights/recent — 最近一次评估的告警事件(与洞察联动)
 *
 * 设计说明:规则驱动(确定性,数字全部来自 SQL 实测),不做 LLM 臆断;
 * 洞察可扩展喂给 LLM 做归因叙述。每次调用实时生成(数据量小,无需缓存表)。
 */
const adminRelayInsightsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/relay/insights', async (request, reply) => {
    try {
      const result = await generateInsights()
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '生成运营洞察失败'))
    }
  })
}

export default adminRelayInsightsRoutes
